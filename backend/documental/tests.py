"""Integración de carga: archivos ficticios y transporte HTTP siempre simulado."""
import base64
import io
import http.client
import json
import tempfile
import urllib.error
from datetime import date, timedelta
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from .models import Convocatoria, Documento, DocumentoRequerido, Expediente
from .services.power_automate import enviar_documento


PDF = b'%PDF-1.4\n% documento ficticio para probar transporte\n%%EOF'


@override_settings(
    POWER_AUTOMATE_UPLOAD_URL='https://flow.example.invalid/upload?sig=SECRETO_FICTICIO',
    POWER_AUTOMATE_UPLOAD_TIMEOUT=7,
    POWER_AUTOMATE_BEARER_TOKEN='',
    POWER_AUTOMATE_IDENTITY_UPLOAD_URL='',
    POWER_AUTOMATE_IDENTITY_REQUIREMENT_IDS=frozenset(),
    POWER_AUTOMATE_IDENTITY_TIMEOUT=90,
    DOCUMENT_UPLOAD_MAX_BYTES=1024,
)
class CargaPowerAutomateTests(TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        media = override_settings(MEDIA_ROOT=directory.name)
        media.enable()
        self.addCleanup(media.disable)
        self.user = self.crear_postulante('prueba')
        self.postulante = self.user.postulante
        self.convocatoria = Convocatoria.objects.create(
            titulo='Prueba', descripcion='Ficticia', estado='abierta',
            fecha_inicio=date.today() - timedelta(days=1),
            fecha_fin=date.today() + timedelta(days=1),
        )
        Expediente.objects.create(postulante=self.postulante, convocatoria=self.convocatoria)
        self.requisito = DocumentoRequerido.objects.create(
            convocatoria=self.convocatoria, nombre='Cedula', descripcion='Prueba',
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.opener = MagicMock()
        self.response = self.opener.open.return_value.__enter__.return_value
        self.response.status = 200
        self.response.read.return_value = b'{"success": true}'
        transport = patch('documental.services.power_automate.urllib.request.build_opener', return_value=self.opener)
        transport.start()
        self.addCleanup(transport.stop)
        threads = patch('documental.views.threading.Thread')
        self.thread = threads.start()
        self.addCleanup(threads.stop)

    def crear_postulante(self, username):
        # Transición de rol existente: evita la doble creación de ficha que
        # producen los dos receivers de registro público del proyecto.
        user = User.objects.create_user(username, is_staff=True)
        perfil = user.perfil_documental
        perfil.rol = 'postulante'
        perfil.save()
        user.is_staff = False
        user.save(update_fields=['is_staff'])
        return user

    def upload(self, content=PDF, name='ficticio.pdf', **fields):
        data = {
            'archivo': SimpleUploadedFile(name, content, content_type='application/pdf'),
            'postulante': self.postulante.pk,
            'convocatoria': self.convocatoria.pk,
            'documento_requerido': self.requisito.pk,
        }
        data.update(fields)
        return self.client.post('/api/documentos/', data, format='multipart')

    def respuesta_identidad(self):
        return {
            'success': True, 'tipoDocumento': 'documento_identidad',
            'datosExtraidos': {
                'nombres': self.postulante.nombres, 'apellidos': self.postulante.apellidos,
                'numero_cedula': self.postulante.numero_documento,
                'fecha_nacimiento': '1995-01-01', 'fecha_expedicion': '2013-02-01',
                'tipo_sangre': 'O+', 'sexo': 'F', 'lugar_expedicion': 'LUGAR DE PRUEBA',
            },
            'confianzaCampos': dict(zip(
                ('nombres', 'apellidos', 'numero_cedula', 'fecha_nacimiento', 'fecha_expedicion', 'tipo_sangre', 'sexo', 'lugar_expedicion'),
                (0.98, 0.96, 1, 0.94, 0.92, 0.90, 0.88, 0.86),
            )),
        }

    def subir_identidad(self, respuesta=None, **fields):
        self.response.read.return_value = json.dumps(self.respuesta_identidad() if respuesta is None else respuesta).encode()
        with override_settings(
            POWER_AUTOMATE_IDENTITY_REQUIREMENT_IDS=frozenset({self.requisito.pk}),
            POWER_AUTOMATE_IDENTITY_UPLOAD_URL='https://identity.example.invalid/upload',
        ):
            return self.upload(**fields)

    def test_carga_contrato_base64_y_archivo_local(self):
        response = self.upload()
        self.assertEqual(response.status_code, 201, response.data)
        request = self.opener.open.call_args.args[0]
        self.assertEqual(request.get_method(), 'POST')
        self.assertEqual(request.get_header('Content-type'), 'application/json')
        self.assertEqual(self.opener.open.call_args.kwargs['timeout'], 7)
        self.assertEqual(json.loads(request.data), {
            'documento': self.postulante.numero_documento,
            'tipoDocumento': 'Cedula', 'mensaje': 'Carga documental UNI SIGEA',
            'nombreArchivo': 'ficticio.pdf',
            'contenido': base64.b64encode(PDF).decode('ascii'),
        })
        doc = Documento.objects.get()
        with doc.archivo.open('rb') as archivo:
            self.assertEqual(archivo.read(), PDF)
        self.assertIn('carga confirmada', doc.observaciones)
        self.assertEqual(doc.estado, 'procesando')
        self.assertEqual(doc.history.count(), 2)
        self.thread.return_value.start.assert_called_once()
        self.opener.open.assert_called_once()

    def test_bytes_no_utf8_se_conservan_en_el_payload(self):
        # Los streams PDF contienen bytes que no pueden convertirse a texto.
        binary_pdf = b'%PDF-1.4\nstream\n\x00\xff\xfe\x80\xc3\x28\nendstream\n%%EOF'
        response = self.upload(binary_pdf)
        self.assertEqual(response.status_code, 201, response.data)
        payload = json.loads(self.opener.open.call_args.args[0].data)
        self.assertEqual(base64.b64decode(payload['contenido'], validate=True), binary_pdf)
        self.assertNotEqual(binary_pdf.decode('utf-8', errors='replace').encode('utf-8'), binary_pdf)

    def test_identidad_usa_su_flujo_y_timeout(self):
        identity_url = 'https://identity.example.invalid/upload?sig=FICTICIO'
        with override_settings(
            POWER_AUTOMATE_IDENTITY_REQUIREMENT_IDS=frozenset({self.requisito.pk}),
            POWER_AUTOMATE_IDENTITY_UPLOAD_URL=identity_url,
            POWER_AUTOMATE_IDENTITY_TIMEOUT=80,
        ):
            self.response.read.return_value = json.dumps(self.respuesta_identidad()).encode()
            self.assertEqual(self.upload().status_code, 201)
        request = self.opener.open.call_args.args[0]
        self.assertEqual(request.full_url, identity_url)
        self.assertEqual(self.opener.open.call_args.kwargs['timeout'], 80)
        payload = json.loads(request.data)
        self.assertEqual(base64.b64decode(payload['contenido']), PDF)
        self.assertEqual(payload['tipoDocumento'], 'Cedula')

    def test_otro_requisito_conserva_flujo_general(self):
        with override_settings(
            POWER_AUTOMATE_IDENTITY_REQUIREMENT_IDS=frozenset({self.requisito.pk + 100}),
            POWER_AUTOMATE_IDENTITY_UPLOAD_URL='https://identity.example.invalid/upload',
        ):
            self.assertEqual(self.upload().status_code, 201)
        self.assertEqual(self.opener.open.call_args.args[0].full_url, 'https://flow.example.invalid/upload?sig=SECRETO_FICTICIO')
        self.assertEqual(self.opener.open.call_args.kwargs['timeout'], 7)

    def test_identidad_sin_url_no_se_envia_al_flujo_general(self):
        with override_settings(POWER_AUTOMATE_IDENTITY_REQUIREMENT_IDS=frozenset({self.requisito.pk})):
            self.assertEqual(self.upload().status_code, 502)
        self.opener.open.assert_not_called()
        self.thread.assert_not_called()
        self.assertEqual(Documento.objects.get().estado, 'error_procesamiento')

    def test_error_ai_builder_no_inicia_ocr(self):
        with override_settings(
            POWER_AUTOMATE_IDENTITY_REQUIREMENT_IDS=frozenset({self.requisito.pk}),
            POWER_AUTOMATE_IDENTITY_UPLOAD_URL='https://identity.example.invalid/upload',
        ):
            self.response.read.return_value = b'{"success":false,"error":"Error de extraccion"}'
            self.assertEqual(self.upload().status_code, 502)
        self.opener.open.assert_called_once()
        self.thread.assert_not_called()

    def test_fallos_http_conexion_timeout_y_202_no_son_exito(self):
        failures = [
            urllib.error.HTTPError('https://flow.example.invalid/?sig=SECRETO', 403, 'SECRETO', {}, io.BytesIO(b'SECRETO')),
            urllib.error.URLError('SECRETO'), TimeoutError('SECRETO'),
            http.client.IncompleteRead(b'SECRETO'),
        ]
        for failure in failures:
            with self.subTest(error=type(failure).__name__):
                self.opener.open.side_effect = failure
                response = self.upload()
                self.assertEqual(response.status_code, 502)
                doc = Documento.objects.latest('pk')
                self.assertEqual(doc.estado, 'error_procesamiento')
                self.assertIn('SharePoint:', doc.observaciones)
                self.assertNotIn('SECRETO', doc.observaciones + str(response.data))
        self.opener.open.side_effect = None
        self.response.status = 202
        self.assertEqual(self.upload().status_code, 502)
        self.assertEqual(self.opener.open.call_count, 5)  # Un solo intento por carga.
        self.thread.assert_not_called()

    def test_respuesta_con_error_aunque_http_200(self):
        self.response.read.return_value = b'{"success": false, "error": "SECRETO"}'
        response = self.upload()
        self.assertEqual(response.status_code, 502)
        self.assertNotIn('SECRETO', str(response.data))
        self.thread.assert_not_called()

    def test_rechazo_http_muestra_codigo_sin_filtrar_mensaje_ni_secretos(self):
        body = json.dumps({'error': {'code': 'TriggerInputSchemaMismatch', 'message': 'SECRETO_FICTICIO'}}).encode()
        self.opener.open.side_effect = urllib.error.HTTPError(
            'https://flow.example.invalid/?sig=SECRETO_FICTICIO', 400, 'Bad Request', {}, io.BytesIO(body),
        )
        with self.assertLogs('documental.services.power_automate', level='WARNING') as logs:
            response = self.upload()
        self.assertEqual(response.status_code, 502)
        self.assertIn('TriggerInputSchemaMismatch', str(response.data))
        doc = Documento.objects.get()
        self.assertEqual(doc.estado, 'error_procesamiento')
        output = str(response.data) + doc.observaciones + '\n'.join(logs.output)
        self.assertNotIn('SECRETO_FICTICIO', output)
        self.assertNotIn('flow.example.invalid', output)
        self.thread.assert_not_called()

    def test_codigo_http_no_reconocido_no_se_publica(self):
        body = b'{"error":{"code":"SECRETO_FICTICIO","message":"SECRETO_FICTICIO"}}'
        self.opener.open.side_effect = urllib.error.HTTPError(
            'https://flow.example.invalid/', 400, 'Bad Request', {}, io.BytesIO(body),
        )
        with self.assertLogs('documental.services.power_automate', level='WARNING') as logs:
            response = self.upload()
        self.assertNotIn('SECRETO_FICTICIO', str(response.data) + '\n'.join(logs.output))
        self.assertEqual(response.status_code, 502)

    def test_rechaza_extension_firma_archivo_vacio_y_tamano(self):
        for content, name in [(PDF, 'ficticio.exe'), (b'no es PDF', 'falso.pdf'), (b'', 'vacio.pdf'), (PDF * 100, 'grande.pdf')]:
            with self.subTest(name=name):
                self.assertEqual(self.upload(content, name).status_code, 400)
        self.opener.open.assert_not_called()
        self.assertFalse(Documento.objects.exists())

    def test_formatos_permitidos(self):
        for name, header in [('a.png', b'\x89PNG\r\n\x1a\n'), ('a.jpg', b'\xff\xd8\xff'), ('a.jpeg', b'\xff\xd8\xff'), ('a.tiff', b'II*\x00'), ('b.tiff', b'MM\x00*'), ('a.bmp', b'BM')]:
            with self.subTest(name=name):
                self.assertEqual(self.upload(header + b'ficticio', name).status_code, 201)

    def test_anonimo_otro_postulante_y_sin_expediente(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.upload().status_code, 401)
        other = self.crear_postulante('otro')
        self.client.force_authenticate(other)
        self.assertEqual(self.upload().status_code, 400)
        self.assertEqual(self.upload(postulante=other.postulante.pk).status_code, 400)
        self.opener.open.assert_not_called()

    def test_autenticacion_jwt_existente(self):
        self.client.force_authenticate(user=None)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + str(AccessToken.for_user(self.user)))
        self.assertEqual(self.upload().status_code, 201)

    def test_otro_postulante_no_puede_reemplazar_archivo(self):
        response = self.upload()
        self.client.force_authenticate(self.crear_postulante('otro'))
        self.opener.open.reset_mock()
        response = self.client.patch(
            '/api/documentos/%s/' % response.data['id'],
            {'archivo': SimpleUploadedFile('otro.pdf', PDF)}, format='multipart',
        )
        self.assertEqual(response.status_code, 404)
        self.opener.open.assert_not_called()

    def test_respuesta_excesiva_es_error(self):
        self.response.read.return_value = b'x' * 65537
        self.assertEqual(self.upload().status_code, 502)
        self.thread.assert_not_called()

    @override_settings(POWER_AUTOMATE_UPLOAD_URL='http://flow.example.invalid')
    def test_url_no_https_es_error_sin_envio(self):
        self.assertEqual(self.upload().status_code, 502)
        self.opener.open.assert_not_called()

    def test_url_con_espacio_en_ruta_se_rechaza_antes_del_envio(self):
        with override_settings(POWER_AUTOMATE_UPLOAD_URL='https://flow.example.invalid/tri ggers/manual/invoke?sig=SECRETO_FICTICIO'):
            response = self.upload()
        self.assertEqual(response.status_code, 502)
        self.assertIn('contiene espacios', str(response.data))
        self.assertNotIn('SECRETO_FICTICIO', str(response.data))
        self.opener.open.assert_not_called()
        self.thread.assert_not_called()

    def test_requisito_incoherente_convocatoria_cerrada_y_destino_incompleto(self):
        other = Convocatoria.objects.create(
            titulo='Otra', descripcion='Prueba', fecha_inicio=date.today(), fecha_fin=date.today(),
        )
        req = DocumentoRequerido.objects.create(convocatoria=other, nombre='Otro')
        self.assertEqual(self.upload(documento_requerido=req.pk).status_code, 400)
        self.assertEqual(self.upload(documento_requerido='').status_code, 400)
        self.convocatoria.estado = 'cerrada'
        self.convocatoria.save()
        self.assertEqual(self.upload().status_code, 400)
        self.opener.open.assert_not_called()

    @override_settings(POWER_AUTOMATE_UPLOAD_URL='')
    def test_url_ausente_es_error_sin_envio(self):
        self.assertEqual(self.upload().status_code, 502)
        self.opener.open.assert_not_called()
        self.thread.assert_not_called()

    def test_editar_metadatos_no_envia_y_reemplazar_archivo_si(self):
        response = self.upload()
        endpoint = '/api/documentos/%s/' % response.data['id']
        self.opener.open.reset_mock()
        self.assertEqual(self.client.patch(endpoint, {'observaciones': 'Revisión'}, format='multipart').status_code, 200)
        self.opener.open.assert_not_called()
        response = self.client.patch(endpoint, {'archivo': SimpleUploadedFile('nuevo.pdf', PDF)}, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        self.opener.open.assert_called_once()

    def test_fallo_no_se_sobrescribe_al_editar_metadatos(self):
        self.opener.open.side_effect = TimeoutError()
        self.upload()
        doc = Documento.objects.get()
        response = self.client.patch('/api/documentos/%s/' % doc.pk, {'estado': 'aprobado'}, format='multipart')
        self.assertEqual(response.status_code, 400)
        doc.refresh_from_db()
        self.assertEqual(doc.estado, 'error_procesamiento')
        self.thread.assert_not_called()

    def test_estados_finales_y_token_institucional(self):
        self.upload()
        doc = Documento.objects.get()
        for status in (200, 201, 204):
            with self.subTest(status=status), override_settings(POWER_AUTOMATE_BEARER_TOKEN='token-ficticio'):
                self.response.status = status
                self.response.read.return_value = b''
                self.assertEqual(enviar_documento(doc).status_code, status)
                request = self.opener.open.call_args.args[0]
                self.assertEqual(request.get_header('Authorization'), 'Bearer token-ficticio')

    def test_redirecciones_no_reenvian_el_archivo(self):
        from .services.power_automate import _SinRedirecciones
        handler = _SinRedirecciones()
        self.assertIsNone(handler.redirect_request(None, None, 302, '', {}, 'https://otro.example.invalid'))

    def test_logs_no_exponen_url_base64_ni_token(self):
        with self.assertLogs('documental.services.power_automate', level='INFO') as logs:
            self.assertEqual(self.upload().status_code, 201)
        output = '\n'.join(logs.output)
        self.assertNotIn('SECRETO_FICTICIO', output)
        self.assertNotIn(base64.b64encode(PDF).decode('ascii'), output)
        self.assertNotIn('flow.example.invalid', output)

    def test_eliminar_propio_borra_registro_y_archivo_despues_del_commit(self):
        self.upload()
        doc = Documento.objects.get()
        doc_id, storage, name = doc.pk, doc.archivo.storage, doc.archivo.name
        self.opener.open.reset_mock()
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete('/api/documentos/%s/' % doc_id)
            self.assertEqual(response.status_code, 204)
            self.assertTrue(storage.exists(name))
        self.assertFalse(Documento.objects.filter(pk=doc_id).exists())
        self.assertFalse(storage.exists(name))
        self.assertEqual(Documento.history.filter(id=doc_id).latest('history_date').history_type, '-')
        self.opener.open.assert_not_called()  # No elimina la copia de SharePoint.

    def test_eliminar_exige_autenticacion_y_propiedad(self):
        self.upload()
        doc = Documento.objects.get()
        endpoint = '/api/documentos/%s/' % doc.pk
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.delete(endpoint).status_code, 401)
        self.client.force_authenticate(self.crear_postulante('otro'))
        self.assertEqual(self.client.delete(endpoint).status_code, 404)
        self.assertTrue(Documento.objects.filter(pk=doc.pk).exists())
        self.assertTrue(doc.archivo.storage.exists(doc.archivo.name))

    def test_postulante_no_elimina_en_convocatoria_cerrada_o_archivada(self):
        self.upload()
        doc = Documento.objects.get()
        for estado, archivado in [('cerrada', False), ('abierta', True)]:
            with self.subTest(estado=estado, archivado=archivado):
                self.convocatoria.estado = estado
                self.convocatoria.archivado = archivado
                self.convocatoria.save()
                self.assertEqual(self.client.delete('/api/documentos/%s/' % doc.pk).status_code, 403)
        self.assertTrue(Documento.objects.filter(pk=doc.pk).exists())

    def test_admin_y_revisor_pueden_eliminar_documento_de_postulante(self):
        for superuser in (False, True):
            with self.subTest(superuser=superuser):
                self.client.force_authenticate(self.user)
                response = self.upload()
                doc_id = response.data['id']
                staff = User.objects.create_user('staff%s' % superuser, is_staff=True, is_superuser=superuser)
                self.client.force_authenticate(staff)
                with self.captureOnCommitCallbacks(execute=True):
                    self.assertEqual(self.client.delete('/api/documentos/%s/' % doc_id).status_code, 204)
                self.assertFalse(Documento.objects.filter(pk=doc_id).exists())

    def test_usuario_sin_rol_no_elimina(self):
        self.upload()
        doc_id = Documento.objects.get().pk
        self.user.perfil_documental.delete()
        self.client.force_authenticate(User.objects.get(pk=self.user.pk))
        self.assertEqual(self.client.delete('/api/documentos/%s/' % doc_id).status_code, 404)
        self.assertTrue(Documento.objects.filter(pk=doc_id).exists())

    def test_puede_eliminar_carga_con_error(self):
        self.opener.open.side_effect = TimeoutError()
        self.upload()
        doc = Documento.objects.get()
        self.assertEqual(doc.estado, 'error_procesamiento')
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.delete('/api/documentos/%s/' % doc.pk).status_code, 204)
        self.assertFalse(doc.archivo.storage.exists(doc.archivo.name))

    def test_rollback_de_eliminacion_conserva_archivo(self):
        from django.db import transaction
        self.upload()
        doc = Documento.objects.get()
        with self.assertRaises(RuntimeError):
            with transaction.atomic():
                self.assertEqual(self.client.delete('/api/documentos/%s/' % doc.pk).status_code, 204)
                raise RuntimeError('Rollback ficticio')
        self.assertTrue(Documento.objects.filter(pk=doc.pk).exists())
        self.assertTrue(doc.archivo.storage.exists(doc.archivo.name))

    def test_identidad_persiste_datos_confianzas_y_promedio_sin_ocr(self):
        response = self.subir_identidad()
        self.assertEqual(response.status_code, 201, response.data)
        doc = Documento.objects.get()
        self.assertEqual(doc.datos_extraidos['valores']['numero_cedula'], self.postulante.numero_documento)
        self.assertEqual(doc.datos_extraidos['confianzas']['nombres'], 0.98)
        resumen = response.data['resumen_extraccion']
        self.assertEqual(resumen['confianza_promedio'], 93)
        self.assertEqual(resumen['campos_extraidos'], 8)
        self.assertEqual(resumen['confianzas_disponibles'], 8)
        self.assertTrue(resumen['extraccion_completa'])
        self.assertTrue(resumen['coincidencia_identidad'])
        self.assertFalse(resumen['tiene_alertas_de_datos'])
        self.assertFalse(resumen['revision_pendiente'])
        self.assertEqual(doc.estado, 'aprobado')
        self.assertEqual(doc.estado_semaforo, 'verde')
        self.assertEqual(doc.tipo_validacion, 'automatica')
        self.assertEqual(doc.datos_extraidos['envio']['http_status'], 200)
        self.assertEqual(doc.history.latest('history_date').datos_extraidos, doc.datos_extraidos)
        self.thread.assert_not_called()

    def test_comparacion_normaliza_formato_y_conserva_originales(self):
        self.postulante.nombres = 'María José'
        self.postulante.apellidos = 'Pérez Nieto'
        self.postulante.numero_documento = '1000000001'
        self.postulante.save()
        payload = self.respuesta_identidad()
        payload['datosExtraidos'].update(nombres=' MARIA   JOSE ', apellidos='PEREZ NIETO', numero_cedula='1.000.000.001')
        response = self.subir_identidad(payload)
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['resumen_extraccion']['coincidencia_identidad'])
        self.assertEqual(response.data['estado'], 'aprobado')
        doc = Documento.objects.get()
        self.assertEqual(doc.datos_extraidos['valores']['nombres'], ' MARIA   JOSE ')
        self.postulante.refresh_from_db()
        self.assertEqual(self.postulante.nombres, 'María José')
        self.assertEqual(self.postulante.numero_documento, '1000000001')

    def test_identidad_con_diferencias_se_rechaza_con_mensaje_claro(self):
        payload = self.respuesta_identidad()
        payload['datosExtraidos']['numero_cedula'] = '1111111111'
        response = self.subir_identidad(payload)
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data['resumen_extraccion']['coincidencia_identidad'])
        self.assertTrue(response.data['resumen_extraccion']['tiene_alertas_de_datos'])
        doc = Documento.objects.get()
        self.assertFalse(doc.datos_extraidos['comparacion']['campos']['numero_cedula']['coincide'])
        self.assertEqual(doc.estado, 'rechazado')
        self.assertEqual(doc.estado_semaforo, 'rojo')
        self.assertEqual(doc.observaciones, 'Datos no coinciden. Revisa el documento que cargaste.')
        self.assertFalse(response.data['resumen_extraccion']['revision_pendiente'])
        self.assertEqual(doc.postulante.numero_documento, self.postulante.numero_documento)

    def test_faltantes_no_se_inventan_y_no_inflan_promedio(self):
        payload = self.respuesta_identidad()
        payload['datosExtraidos']['fecha_nacimiento'] = ''
        payload['confianzaCampos']['fecha_nacimiento'] = 1
        payload['confianzaCampos']['sexo'] = None
        response = self.subir_identidad(payload)
        self.assertEqual(response.status_code, 201)
        resumen = response.data['resumen_extraccion']
        self.assertEqual(resumen['campos_extraidos'], 7)
        self.assertEqual(resumen['confianzas_disponibles'], 6)
        self.assertEqual(resumen['campos_faltantes'], ['fecha_nacimiento'])
        self.assertFalse(resumen['extraccion_completa'])
        self.assertTrue(resumen['tiene_alertas_de_datos'])
        self.assertIsNone(response.data['datos_extraidos']['confianzas']['fecha_nacimiento'])
        self.assertIsNone(response.data['datos_extraidos']['valores']['fecha_nacimiento'])
        self.assertAlmostEqual(resumen['confianza_promedio'], 93.67)
        # Las fechas no tienen referencia registrada: no alteran la coincidencia.
        self.assertEqual(response.data['estado'], 'aprobado')

    def test_confianza_cero_es_valida_y_ausente_no_es_cero(self):
        payload = self.respuesta_identidad()
        payload['confianzaCampos'] = {k: None for k in payload['confianzaCampos']}
        payload['confianzaCampos']['nombres'] = 0
        response = self.subir_identidad(payload)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['resumen_extraccion']['confianza_promedio'], 0)
        self.assertEqual(response.data['resumen_extraccion']['confianzas_disponibles'], 1)
        self.assertEqual(response.data['estado'], 'aprobado')  # La regla depende de los datos coincidentes.
        payload['confianzaCampos']['nombres'] = None
        response = self.subir_identidad(payload)
        self.assertIsNone(response.data['resumen_extraccion']['confianza_promedio'])

    def test_confianzas_invalidas_no_se_guardan_como_exito(self):
        for score in (True, -0.1, 98, '98%', float('nan'), float('inf'), {}, []):
            with self.subTest(score=score):
                payload = self.respuesta_identidad()
                payload['confianzaCampos']['nombres'] = score
                response = self.subir_identidad(payload)
                self.assertEqual(response.status_code, 502)
                doc = Documento.objects.latest('pk')
                self.assertEqual(doc.estado, 'error_procesamiento')
                self.assertEqual(doc.datos_extraidos, {})
        self.thread.assert_not_called()

    def test_confianzas_numericas_como_texto_se_normalizan(self):
        payload = self.respuesta_identidad()
        payload['confianzaCampos']['nombres'] = '0.98'
        response = self.subir_identidad(payload)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['datos_extraidos']['confianzas']['nombres'], 0.98)

    def test_contrato_identidad_incorrecto_no_es_exito(self):
        variants = [
            {}, {'success': True},
            dict(self.respuesta_identidad(), tipoDocumento='otro'),
            dict(self.respuesta_identidad(), datosExtraidos=[]),
            dict(self.respuesta_identidad(), confianzaCampos=None),
        ]
        for payload in variants:
            with self.subTest(keys=list(payload)):
                response = self.subir_identidad(payload)
                self.assertEqual(response.status_code, 502)
                self.assertEqual(Documento.objects.latest('pk').datos_extraidos, {})
        self.thread.assert_not_called()

    def test_datos_extraidos_son_de_solo_lectura_y_no_se_exponen_a_otro_postulante(self):
        response = self.subir_identidad(datos_extraidos=json.dumps({'valores': {'nombres': 'FALSO'}}))
        self.assertEqual(response.status_code, 201)
        doc_id = response.data['id']
        self.assertEqual(response.data['datos_extraidos']['valores']['nombres'], self.postulante.nombres)
        self.client.patch('/api/documentos/%s/' % doc_id, {'datos_extraidos': json.dumps({'valores': {'nombres': 'FALSO'}})}, format='multipart')
        self.assertEqual(Documento.objects.get(pk=doc_id).datos_extraidos['valores']['nombres'], self.postulante.nombres)
        self.client.force_authenticate(self.crear_postulante('otro'))
        self.assertEqual(self.client.get('/api/documentos/%s/' % doc_id).status_code, 404)
        self.assertEqual(self.client.get('/api/documentos/').data['results'], [])

    def test_revision_manual_identidad_no_reenvia_ni_lanza_ocr(self):
        response = self.subir_identidad()
        doc_id = response.data['id']
        endpoint = '/api/documentos/%s/' % doc_id
        self.opener.open.reset_mock()
        self.assertEqual(self.client.patch(endpoint, {'estado': 'aprobado'}, format='multipart').status_code, 403)
        staff = User.objects.create_user('revisor', is_staff=True)
        self.client.force_authenticate(staff)
        response = self.client.patch(endpoint, {'estado': 'aprobado'}, format='multipart')
        self.assertEqual(response.status_code, 200)
        doc = Documento.objects.get(pk=doc_id)
        self.assertEqual(doc.estado, 'aprobado')
        self.assertEqual(doc.estado_semaforo, 'verde')
        self.assertEqual(doc.tipo_validacion, 'manual')
        self.assertTrue(doc.datos_extraidos)
        self.opener.open.assert_not_called()
        self.thread.assert_not_called()

    def test_reemplazo_fallido_no_conserva_extraccion_anterior(self):
        response = self.subir_identidad()
        doc_id = response.data['id']
        self.opener.open.side_effect = TimeoutError()
        with override_settings(
            POWER_AUTOMATE_IDENTITY_REQUIREMENT_IDS=frozenset({self.requisito.pk}),
            POWER_AUTOMATE_IDENTITY_UPLOAD_URL='https://identity.example.invalid/upload',
        ):
            response = self.client.patch('/api/documentos/%s/' % doc_id, {'archivo': SimpleUploadedFile('nuevo.pdf', PDF)}, format='multipart')
        self.assertEqual(response.status_code, 502)
        doc = Documento.objects.get(pk=doc_id)
        self.assertEqual(doc.datos_extraidos, {})
        self.assertEqual(doc.estado, 'error_procesamiento')
        self.thread.assert_not_called()

    def test_identidad_requiere_json_aunque_http_sea_correcto(self):
        for status, body in [(200, b'OK'), (200, b''), (204, b'')]:
            with self.subTest(status=status, body=body):
                self.response.status = status
                self.response.read.return_value = body
                with override_settings(
                    POWER_AUTOMATE_IDENTITY_REQUIREMENT_IDS=frozenset({self.requisito.pk}),
                    POWER_AUTOMATE_IDENTITY_UPLOAD_URL='https://identity.example.invalid/upload',
                ):
                    response = self.upload()
                self.assertEqual(response.status_code, 502)
                self.assertEqual(Documento.objects.latest('pk').datos_extraidos, {})
        self.thread.assert_not_called()

    def test_sin_rol_no_puede_leer_extraccion_de_otros(self):
        response = self.subir_identidad()
        doc_id = response.data['id']
        other = User.objects.create_user('sin_rol', is_staff=True)
        other.perfil_documental.delete()
        self.client.force_authenticate(User.objects.get(pk=other.pk))
        self.assertEqual(self.client.get('/api/documentos/%s/' % doc_id).status_code, 404)
        self.assertEqual(self.client.get('/api/documentos/').data['results'], [])

    def test_no_se_puede_reasociar_extraccion_sin_reemplazar_archivo(self):
        response = self.subir_identidad()
        doc_id = response.data['id']
        otro = self.crear_postulante('otro')
        staff = User.objects.create_user('staff', is_staff=True)
        self.client.force_authenticate(staff)
        response = self.client.patch('/api/documentos/%s/' % doc_id, {'postulante': otro.postulante.pk}, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Documento.objects.get(pk=doc_id).postulante_id, self.postulante.pk)

    def test_nombre_apellido_o_cedula_distintos_rechazan_aunque_confianza_sea_alta(self):
        for campo in ('nombres', 'apellidos', 'numero_cedula'):
            with self.subTest(campo=campo):
                payload = self.respuesta_identidad()
                payload['datosExtraidos'][campo] = '1111111111' if campo == 'numero_cedula' else 'OTRA PERSONA'
                payload['confianzaCampos'] = {k: 1 for k in payload['confianzaCampos']}
                response = self.subir_identidad(payload)
                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.data['estado'], 'rechazado')
                self.assertEqual(response.data['estado_semaforo'], 'rojo')
                self.assertEqual(response.data['resumen_extraccion']['confianza_promedio'], 100)
                self.assertEqual(response.data['tipo_validacion'], 'automatica')

    def test_identidad_sin_dato_comparable_queda_en_revision(self):
        for campo in ('nombres', 'apellidos', 'numero_cedula'):
            with self.subTest(campo=campo):
                payload = self.respuesta_identidad()
                payload['datosExtraidos'][campo] = ''
                response = self.subir_identidad(payload)
                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.data['estado'], 'en_revision')
                self.assertEqual(response.data['estado_semaforo'], 'amarillo')
                self.assertTrue(response.data['resumen_extraccion']['revision_pendiente'])
                self.assertIn('No se pudieron verificar', response.data['observaciones'])
        self.thread.assert_not_called()

    def test_diferencia_confirmada_rechaza_aunque_otro_dato_falte(self):
        payload = self.respuesta_identidad()
        payload['datosExtraidos'].update(nombres='', numero_cedula='1111111111')
        response = self.subir_identidad(payload)
        self.assertEqual(response.data['estado'], 'rechazado')

    def test_nueva_carga_correcta_se_aprueba_sin_cambiar_el_rechazo_anterior(self):
        payload = self.respuesta_identidad()
        payload['datosExtraidos']['numero_cedula'] = '1111111111'
        rejected = self.subir_identidad(payload)
        approved = self.subir_identidad()
        self.assertEqual(rejected.data['estado'], 'rechazado')
        self.assertEqual(approved.data['estado'], 'aprobado')
        self.assertEqual(Documento.objects.get(pk=rejected.data['id']).estado, 'rechazado')
        self.assertNotEqual(rejected.data['id'], approved.data['id'])
        self.opener.open.assert_called()
        self.thread.assert_not_called()

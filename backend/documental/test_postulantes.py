"""CRUD con datos ficticios; no realiza llamadas a Power Automate."""
from datetime import date
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from .models import Postulante, Documento, Convocatoria, Expediente
from .services.identidad_service import preparar_extraccion


class PostulantesCrudTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user('revisor_crud', is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(self.staff)
        self.payload = dict(nombres='Ana', apellidos='Prueba', numero_documento='12345678',
                            email='ana@example.invalid', telefono='3001234567', direccion='Dirección ficticia')

    def crear(self, **extra):
        response = self.client.post('/api/postulantes/', {**self.payload, **extra}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return Postulante.objects.get(pk=response.data['id'])

    def url(self, ficha):
        return f'/api/postulantes/{ficha.pk}/'

    def cuenta(self):
        user = User.objects.create_user('cuenta_crud', email='cuenta@example.invalid', is_staff=True)
        perfil = user.perfil_documental
        perfil.rol = 'postulante'
        perfil.save()
        return user

    def test_crud_manual(self):
        ficha = self.crear()
        detail = self.client.get(self.url(ficha))
        self.assertTrue(detail.data['puede_eliminar'])
        self.assertEqual(detail.data['documentos_count'], 0)
        result = self.client.patch(self.url(ficha), {'telefono': '3110000000'}, format='json')
        self.assertEqual(result.status_code, 200)
        ficha.refresh_from_db()
        self.assertEqual(ficha.telefono, '3110000000')
        self.assertEqual(self.client.delete(self.url(ficha)).status_code, 204)
        self.assertFalse(Postulante.objects.filter(pk=ficha.pk).exists())

    def test_validaciones_sin_errores_500(self):
        self.crear()
        for extra, field in [({'email': 'otro@example.invalid'}, 'numero_documento'),
                             ({'numero_documento': '87654321', 'email': 'ANA@example.invalid'}, 'email'),
                             ({'numero_documento': '123.456', 'email': 'otro@example.invalid'}, 'numero_documento')]:
            with self.subTest(field=field, extra=extra):
                result = self.client.post('/api/postulantes/', {**self.payload, **extra}, format='json')
                self.assertEqual(result.status_code, 400)
                self.assertIn(field, result.data)

    def test_no_reutiliza_email_de_otra_cuenta(self):
        result = self.client.post('/api/postulantes/', {**self.payload, 'email': self.cuenta().email.upper()}, format='json')
        self.assertEqual(result.status_code, 400)
        self.assertIn('email', result.data)

    def test_permisos_y_aislamiento(self):
        otra = self.crear()
        user = self.cuenta()
        self.client.force_authenticate(user)
        result = self.client.get('/api/postulantes/')
        self.assertEqual([p['id'] for p in result.data['results']], [user.postulante.pk])
        self.assertEqual(self.client.get(self.url(otra)).status_code, 404)
        self.assertEqual(self.client.get(self.url(user.postulante)).status_code, 200)
        self.assertEqual(self.client.patch(self.url(user.postulante), {'nombres': 'Otro'}, format='json').status_code, 403)
        self.assertEqual(self.client.post('/api/postulantes/', self.payload, format='json').status_code, 403)
        self.assertEqual(self.client.delete(self.url(user.postulante)).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/postulantes/').status_code, 401)

    def test_cuenta_vinculada_sin_borrado_y_sincronizada(self):
        user = self.cuenta()
        ficha = user.postulante
        password, username = user.password, user.username
        self.assertEqual(self.client.delete(self.url(ficha)).status_code, 409)
        result = self.client.patch(self.url(ficha), {'nombres': 'María Ana', 'apellidos': 'Ejemplo',
                                  'email': 'nuevo@example.invalid', 'estado': 'inactivo'}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        user.refresh_from_db()
        self.assertFalse(user.is_active)
        self.assertEqual(user.first_name, 'María Ana')
        self.assertEqual(user.last_name, 'Ejemplo')
        self.assertEqual(user.email, 'nuevo@example.invalid')
        self.assertEqual((user.password, user.username), (password, username))
        self.client.patch(self.url(ficha), {'telefono': '3001111111'}, format='json')
        user.refresh_from_db()
        self.assertFalse(user.is_active)
        self.client.patch(self.url(ficha), {'estado': 'activo'}, format='json')
        user.refresh_from_db()
        self.assertTrue(user.is_active)

    def test_bloquea_borrado_de_expediente_o_documento(self):
        ficha = self.crear()
        conv = Convocatoria.objects.create(titulo='Ficticia', fecha_inicio=date.today(), fecha_fin=date.today())
        expediente = Expediente.objects.create(postulante=ficha, convocatoria=conv)
        self.assertEqual(self.client.delete(self.url(ficha)).status_code, 409)
        self.assertTrue(Expediente.objects.filter(pk=expediente.pk).exists())
        otro = self.crear(numero_documento='87654321', email='otro@example.invalid')
        doc = Documento.objects.create(postulante=otro, archivo='ficticio-no-existe.pdf')
        self.assertEqual(self.client.delete(self.url(otro)).status_code, 409)
        self.assertTrue(Documento.objects.filter(pk=doc.pk).exists())

    def test_filtros_busqueda_y_paginacion(self):
        ficha = self.crear()
        self.crear(numero_documento='87654321', email='otro@example.invalid', nombres='Bruno', estado='inactivo')
        for search in ('Ana', '12345678', 'ana@example.invalid'):
            result = self.client.get('/api/postulantes/', {'search': search, 'estado': 'activo'})
            self.assertEqual([p['id'] for p in result.data['results']], [ficha.pk])
        Postulante.objects.bulk_create([Postulante(**{**self.payload, 'numero_documento': str(80000000 + i), 'email': f'p{i}@example.invalid'}) for i in range(21)])
        result = self.client.get('/api/postulantes/', {'page': 2})
        self.assertEqual(result.status_code, 200)
        self.assertTrue(result.data['previous'])
        self.assertEqual(len(result.data['results']), 3)

    def test_editar_identidad_exige_revision_y_conserva_historial(self):
        ficha = self.crear()
        extraccion = preparar_extraccion({'success': True, 'tipoDocumento': 'documento_identidad',
            'datosExtraidos': {'nombres': ficha.nombres, 'apellidos': ficha.apellidos, 'numero_cedula': ficha.numero_documento},
            'confianzaCampos': {'nombres': .95}}, ficha)
        doc = Documento.objects.create(postulante=ficha, archivo='ficticio.pdf', estado='aprobado',
                                       estado_semaforo='verde', datos_extraidos=extraccion)
        history_count = doc.history.count()
        self.client.patch(self.url(ficha), {'telefono': '3001111111'}, format='json')
        doc.refresh_from_db()
        self.assertEqual(doc.estado, 'aprobado')
        result = self.client.patch(self.url(ficha), {'nombres': 'Beatriz'}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        doc.refresh_from_db()
        self.assertEqual((doc.estado, doc.estado_semaforo), ('en_revision', 'amarillo'))
        self.assertEqual(doc.datos_extraidos['valores'], extraccion['valores'])
        self.assertEqual(doc.datos_extraidos['confianzas'], extraccion['confianzas'])
        self.assertFalse(doc.datos_extraidos['comparacion']['campos']['nombres']['coincide'])
        self.assertEqual(doc.history.count(), history_count + 1)

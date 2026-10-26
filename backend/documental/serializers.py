"""
Serializadores DRF para el módulo documental.
FASE 1-2: Serializadores completos para todos los modelos.
"""
from rest_framework import serializers
from django.conf import settings
from pathlib import Path
from rest_framework.validators import UniqueValidator
from django.core.validators import RegexValidator
from django.contrib.auth.models import User
from django.db import transaction
from .models import (
    Documento, Postulante, Convocatoria, DocumentoRequerido,
    UsuarioPerfil, Expediente
)
from .querysets import postulantes_con_rol_postulante
from .services.identidad_service import resumen_extraccion, comparar_identidad


class UsuarioSerializer(serializers.ModelSerializer):
    """Serializador para el modelo User de Django."""
    
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']


class UsuarioPerfilSerializer(serializers.ModelSerializer):
    """
    Serializador para el modelo UsuarioPerfil.
    Incluye información del usuario relacionado.
    """
    usuario = UsuarioSerializer(read_only=True)
    
    class Meta:
        model = UsuarioPerfil
        fields = ['id', 'usuario', 'rol', 'creado_en', 'actualizado_en']
        read_only_fields = ['id', 'creado_en', 'actualizado_en']


class DocumentoRequeridoSerializer(serializers.ModelSerializer):
    """
    Serializador para el modelo DocumentoRequerido.
    Agrega:
      * la lista de postulantes que han subido un documento correspondiente
        a este requisito (`subido_por`).
      * la cantidad de documentos ya subidos bajo este requisito.
    """
    subido_por = serializers.SerializerMethodField(read_only=True)
    documentos_count = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = DocumentoRequerido
        fields = [
            'id', 'nombre', 'descripcion', 'obligatorio', 'requiere_validacion_ia',
            'convocatoria', 'subido_por', 'documentos_count'
        ]
        read_only_fields = ['id', 'subido_por', 'documentos_count']
    
    def get_subido_por(self, obj):
        # buscamos postulantes únicos que tienen un Documento vinculado a este requisito
        elegibles = postulantes_con_rol_postulante().values_list("pk", flat=True)
        postulantes = (
            obj.documentos_cargados.filter(postulante_id__in=elegibles)
            .select_related("postulante")
            .values("postulante", "postulante__nombres", "postulante__apellidos")
            .distinct()
        )
        return [
            {
                'id': p['postulante'],
                'nombres': p['postulante__nombres'],
                'apellidos': p['postulante__apellidos'],
            }
            for p in postulantes if p['postulante'] is not None
        ]

    def get_documentos_count(self, obj):
        return obj.documentos_cargados.count()


class PostulanteSerializer(serializers.ModelSerializer):
    """
    Serializador para el modelo Postulante.
    Incluye información de usuario si está asociado.
    Valida unicidad de correo y formato de documento.
    """
    usuario = UsuarioSerializer(read_only=True)
    puede_eliminar = serializers.SerializerMethodField()
    documentos_count = serializers.SerializerMethodField()
    expedientes_count = serializers.SerializerMethodField()
    email = serializers.EmailField(validators=[
        UniqueValidator(queryset=Postulante.objects.all(), message="El email ya está en uso")
    ])
    numero_documento = serializers.CharField(validators=[
        UniqueValidator(queryset=Postulante.objects.all(), message="El número de documento ya está registrado."),
        RegexValidator(r'^[0-9]{6,12}$', message="Formato de documento inválido (solo dígitos, 6–12 caracteres)")
    ])
    
    class Meta:
        model = Postulante
        fields = [
            'id', 'usuario', 'nombres', 'apellidos', 'tipo_documento',
            'numero_documento', 'email', 'telefono', 'direccion',
            'fecha_registro', 'estado', 'puede_eliminar', 'documentos_count', 'expedientes_count'
        ]
        read_only_fields = ['id', 'fecha_registro']

    def get_documentos_count(self, obj):
        count = getattr(obj, 'total_documentos', None)
        return count if count is not None else obj.documentos.count()

    def get_expedientes_count(self, obj):
        count = getattr(obj, 'total_expedientes', None)
        return count if count is not None else obj.expedientes.count()

    def get_puede_eliminar(self, obj):
        return not obj.usuario_id and not self.get_documentos_count(obj) and not self.get_expedientes_count(obj)

    def validate_email(self, value):
        value = value.strip().lower()
        fichas = Postulante.objects.filter(email__iexact=value)
        cuentas = User.objects.filter(email__iexact=value)
        if self.instance:
            fichas = fichas.exclude(pk=self.instance.pk)
            if self.instance.usuario_id:
                cuentas = cuentas.exclude(pk=self.instance.usuario_id)
        if fichas.exists() or cuentas.exists():
            raise serializers.ValidationError('El correo ya está en uso.')
        return value

    @transaction.atomic
    def update(self, instance, validated_data):
        instance = Postulante.objects.select_for_update().get(pk=instance.pk)
        cambia_identidad = any(
            key in validated_data and validated_data[key] != getattr(instance, key)
            for key in ('nombres', 'apellidos', 'numero_documento')
        )
        instance = super().update(instance, validated_data)
        if instance.usuario_id:
            user = instance.usuario
            user.first_name = instance.nombres
            user.last_name = instance.apellidos
            user.email = instance.email
            fields = ['first_name', 'last_name', 'email']
            if 'estado' in validated_data:
                user.is_active = instance.estado == 'activo'
                fields.append('is_active')
            user.save(update_fields=fields)
        if cambia_identidad:
            for documento in instance.documentos.select_for_update():
                extraccion = documento.datos_extraidos
                if not isinstance(extraccion, dict) or extraccion.get('tipo_documento') != 'documento_identidad':
                    continue
                extraccion['comparacion'] = comparar_identidad(extraccion.get('valores', {}), instance)
                documento.datos_extraidos = extraccion
                documento.estado = 'en_revision'
                documento.estado_semaforo = 'amarillo'
                documento.observaciones = 'Los datos registrados del postulante cambiaron. Se requiere una nueva revisión del documento.'
                documento.save()
        return instance


class ConvocatoriaSerializer(serializers.ModelSerializer):
    """
    Serializador para el modelo Convocatoria con documentos requeridos anidados.
    Además agrega la lista de postulantes cuando se utiliza para detalle.
    """
    documentos_requeridos = DocumentoRequeridoSerializer(many=True, read_only=True)
    postulantes = serializers.SerializerMethodField()
    postulantes_count = serializers.SerializerMethodField()
    is_abierta = serializers.SerializerMethodField()
    
    class Meta:
        model = Convocatoria
        fields = [
            'id', 'titulo', 'descripcion', 'estado', 'archivado', 'fecha_inicio',
            'fecha_fin', 'documentos_requeridos', 'postulantes',
            'postulantes_count', 'is_abierta', 'creado_en', 'actualizado_en'
        ]
        read_only_fields = ['id', 'creado_en', 'actualizado_en']
    
    def get_postulantes(self, obj):
        """Devuelve la lista de postulantes que tienen un expediente en la convocatoria."""
        postulantes_qs = postulantes_con_rol_postulante().filter(
            expedientes__convocatoria=obj
        ).distinct()
        return PostulanteSerializer(postulantes_qs, many=True).data

    def get_postulantes_count(self, obj):
        """Retorna la cantidad de postulantes en esta convocatoria."""
        return obj.postulantes_count
    
    def get_is_abierta(self, obj):
        """Verifica si la convocatoria está abierta."""
        return obj.is_abierta


class DocumentoSerializer(serializers.ModelSerializer):
    """
    Serializador para el modelo Documento.
    Permite crear, leer, actualizar y eliminar documentos.
    """
    
    nombre_archivo = serializers.SerializerMethodField()
    url_archivo = serializers.SerializerMethodField()
    postulante_nombre = serializers.CharField(source='postulante.nombres', read_only=True)
    convocatoria_titulo = serializers.CharField(source='convocatoria.titulo', read_only=True)
    documento_requerido_nombre = serializers.CharField(source='documento_requerido.nombre', read_only=True)
    resumen_extraccion = serializers.SerializerMethodField()

    def get_resumen_extraccion(self, obj):
        resumen = resumen_extraccion(obj.datos_extraidos)
        if resumen is not None:
            resumen['revision_pendiente'] = obj.estado == 'en_revision'
        return resumen

    def validate_archivo(self, archivo):
        if archivo.size > settings.DOCUMENT_UPLOAD_MAX_BYTES:
            raise serializers.ValidationError('El archivo excede el tamaño máximo permitido (%s bytes).' % settings.DOCUMENT_UPLOAD_MAX_BYTES)
        # La firma complementa la extensión; Content-Type lo controla el cliente.
        signatures = {
            '.pdf': (b'%PDF-',), '.png': (b'\x89PNG\r\n\x1a\n',),
            '.jpg': (b'\xff\xd8\xff',), '.jpeg': (b'\xff\xd8\xff',),
            '.tiff': (b'II*\x00', b'MM\x00*'), '.bmp': (b'BM',),
        }
        position = archivo.tell()
        try:
            archivo.seek(0)
            header = archivo.read(16)
        finally:
            archivo.seek(position)
        prefixes = signatures.get(Path(archivo.name).suffix.lower())
        if not prefixes or not header.startswith(prefixes):
            raise serializers.ValidationError('El contenido del archivo no coincide con un formato permitido.')
        return archivo
    
    class Meta:
        model = Documento
        fields = [
            'id', 'archivo', 'nombre_archivo', 'url_archivo',
            'postulante', 'postulante_nombre', 'convocatoria', 'convocatoria_titulo',
            'documento_requerido', 'documento_requerido_nombre',
            'fecha_emision', 'fecha_vencimiento',
            'estado', 'estado_semaforo',
            'texto_extraido', 'confianza_ocr', 'observaciones',
            'tipo_validacion', 'numero_documento_usuario',
            'fecha_carga', 'datos_extraidos', 'resumen_extraccion'
        ]
        read_only_fields = ['id', 'fecha_carga', 'nombre_archivo', 'url_archivo', 'datos_extraidos', 'resumen_extraccion']
    
    def get_nombre_archivo(self, obj):
        """Retorna solo el nombre del archivo sin la ruta completa."""
        if obj.archivo:
            return obj.archivo.name.split('/')[-1]
        return None
    
    def get_url_archivo(self, obj):
        """Retorna la URL completa del archivo para descarga/visualización."""
        if obj.archivo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.archivo.url)
            return obj.archivo.url
        return None


class ExpedienteSerializer(serializers.ModelSerializer):
    """
    Serializador para el modelo Expediente.
    Incluye información del postulante y convocatoria relacionados.
    """
    postulante_nombre = serializers.CharField(
        source='postulante.nombres', read_only=True
    )
    postulante_apellidos = serializers.CharField(
        source='postulante.apellidos', read_only=True
    )
    postulante_numero_documento = serializers.CharField(
        source='postulante.numero_documento', read_only=True
    )
    postulante_email = serializers.CharField(
        source='postulante.email', read_only=True
    )
    convocatoria_titulo = serializers.CharField(
        source='convocatoria.titulo', read_only=True
    )
    documentos_count = serializers.SerializerMethodField()
    documentos_aprobados_count = serializers.SerializerMethodField()
    progreso_porcentaje = serializers.SerializerMethodField()
    
    class Meta:
        model = Expediente
        fields = [
            'id', 'postulante', 'postulante_nombre', 'postulante_apellidos',
            'postulante_numero_documento', 'postulante_email',
            'convocatoria', 'convocatoria_titulo',
            'estado', 'documentos_count', 'documentos_aprobados_count',
            'progreso_porcentaje', 'creado_en', 'actualizado_en'
        ]
        read_only_fields = ['id', 'creado_en', 'actualizado_en']
    
    def get_documentos_count(self, obj):
        """Retorna la cantidad total de documentos."""
        return obj.documentos_count
    
    def get_documentos_aprobados_count(self, obj):
        """Retorna la cantidad de documentos aprobados."""
        return obj.documentos_aprobados_count
    
    def get_progreso_porcentaje(self, obj):
        """Retorna el porcentaje de progreso."""
        return obj.progreso_porcentaje

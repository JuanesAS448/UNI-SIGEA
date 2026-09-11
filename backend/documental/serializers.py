"""
Serializadores DRF para el módulo documental.
FASE 1-2: Serializadores completos para todos los modelos.
"""
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from django.core.validators import RegexValidator
from django.contrib.auth.models import User
from .models import (
    Documento, Postulante, Convocatoria, DocumentoRequerido,
    UsuarioPerfil, Expediente
)
from .querysets import postulantes_con_rol_postulante


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
            'id', 'nombre', 'descripcion', 'obligatorio',
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
    email = serializers.EmailField(validators=[
        UniqueValidator(queryset=Postulante.objects.all(), message="El email ya está en uso")
    ])
    numero_documento = serializers.CharField(validators=[
        RegexValidator(r'^[0-9]{6,12}$', message="Formato de documento inválido (solo dígitos, 6–12 caracteres)")
    ])
    
    class Meta:
        model = Postulante
        fields = [
            'id', 'usuario', 'nombres', 'apellidos', 'tipo_documento',
            'numero_documento', 'email', 'telefono', 'direccion',
            'fecha_registro', 'estado'
        ]
        read_only_fields = ['id', 'fecha_registro']


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
            'fecha_carga'
        ]
        read_only_fields = ['id', 'fecha_carga', 'nombre_archivo', 'url_archivo']
    
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

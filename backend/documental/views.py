"""
Vistas API del módulo documental.
FASE 1-2: ViewSets CRUD para todos los modelos + Dashboard stats especial.
FASE 3: OCR al subir documento.
FASE 4: Semáforo inteligente.
"""
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import viewsets
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.exceptions import ValidationError
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta

from .models import (
    Documento, Postulante, Convocatoria, DocumentoRequerido,
    UsuarioPerfil, Expediente
)
from .querysets import postulantes_con_rol_postulante
from .serializers import (
    DocumentoSerializer, PostulanteSerializer, ConvocatoriaSerializer,
    DocumentoRequeridoSerializer, UsuarioPerfilSerializer, ExpedienteSerializer
)
from .services.ocr_service import extraer_texto_ocr
from .services.semaforo_service import actualizar_estado_documento
from .services.gemini_service import responder_consulta_documental
import threading
import logging

logger = logging.getLogger(__name__)


def _queryset_convocatorias_según_usuario(queryset, user):
    """Postulante autenticado: solo convocatorias donde tiene expediente."""
    if not user.is_authenticated:
        return queryset
    try:
        perfil = user.perfil_documental
    except UsuarioPerfil.DoesNotExist:
        return queryset
    if perfil.rol != "postulante":
        return queryset
    try:
        postulante = user.postulante
    except Postulante.DoesNotExist:
        return queryset.none()
    return queryset.filter(expedientes__postulante=postulante).distinct()


def _queryset_por_postulante_si_aplica(queryset, user, campo="postulante"):
    """Postulante autenticado: solo registros de su propia ficha."""
    if not user.is_authenticated:
        return queryset
    try:
        perfil = user.perfil_documental
    except UsuarioPerfil.DoesNotExist:
        return queryset
    if perfil.rol != "postulante":
        return queryset
    try:
        postulante = user.postulante
    except Postulante.DoesNotExist:
        return queryset.none()
    return queryset.filter(**{campo: postulante})


def _validar_subida_documento_postulante(request, postulante, convocatoria, documento_requerido):
    """Restringe cargas: expediente existente y requisito coherente con la convocatoria."""
    if not request.user.is_authenticated:
        return
    try:
        perfil = request.user.perfil_documental
    except UsuarioPerfil.DoesNotExist:
        return
    if perfil.rol != "postulante":
        return
    try:
        propio = request.user.postulante
    except Postulante.DoesNotExist:
        raise ValidationError("Su cuenta no tiene ficha de postulante.")
    if postulante != propio:
        raise ValidationError("Solo puede cargar documentos para su propio expediente.")
    if convocatoria is None:
        raise ValidationError("Debe indicar la convocatoria.")
    if not Expediente.objects.filter(postulante=propio, convocatoria=convocatoria).exists():
        raise ValidationError("No está inscrito en esta convocatoria.")
    if documento_requerido is not None:
        if documento_requerido.convocatoria_id != convocatoria.id:
            raise ValidationError("El requisito no pertenece a esta convocatoria.")


def ejecutar_procesamiento(documento_id):
    from .services.documento_service import procesar_documento_async
    try:
        procesar_documento_async(documento_id)
    except Exception as e:
        logger.error(f"Error en hilo de procesamiento OCR: {e}", exc_info=True)


@api_view(['GET'])
@permission_classes([AllowAny])
def api_health(request):
    """
    Salud de la API. Usado para confirmar que el backend responde
    y que CORS/DRF están bien configurados.
    """
    return Response({
        'status': 'ok',
        'message': 'API G-Doc operativa',
        'version': '2.0',
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def dashboard_stats(request):
    """
    ========================================================================
    ENDPOINT ESPECIAL: ESTADÍSTICAS PARA EL DASHBOARD
    ========================================================================
    
    Retorna un JSON con métricas y contadores para los gráficos del dashboard.
    NO ES UN CRUD SIMPLE - calcula estadísticas agregadas en tiempo real.
    
    Respuesta:
    {
        "total_documentos": 10,
        "documentos_aprobados": 5,
        "documentos_pendientes": 3,
        "documentos_rechazados": 2,
        "documentos_en_revision": 0,
        "semaforo_verde": 5,
        "semaforo_amarillo": 3,
        "semaforo_rojo": 2,
        "convocatorias_activas": 3,
        "convocatorias_cerradas": 1,
        "total_postulantes": 45,
        "expedientes_total": 10,
        "expedientes_completos": 3,
        "expedientes_incompletos": 4,
        "expedientes_en_proceso": 3,
        "documentos_vencidos": 1,
        "documentos_por_vencer": 2,
    }
    ========================================================================
    """
    
    today = timezone.now().date()
    
    # Contar documentos por estado
    total_documentos = Documento.objects.count()
    documentos_aprobados = Documento.objects.filter(estado='aprobado').count()
    documentos_pendientes = Documento.objects.filter(estado='pendiente').count()
    documentos_rechazados = Documento.objects.filter(estado='rechazado').count()
    documentos_en_revision = Documento.objects.filter(estado='en_revision').count()
    
    # Contar documentos por semáforo
    semaforo_verde = Documento.objects.filter(estado_semaforo='verde').count()
    semaforo_amarillo = Documento.objects.filter(estado_semaforo='amarillo').count()
    semaforo_rojo = Documento.objects.filter(estado_semaforo='rojo').count()
    
    # Contar convocatorias
    convocatorias_activas = Convocatoria.objects.filter(
        estado='abierta',
        fecha_inicio__lte=today,
        fecha_fin__gte=today
    ).count()
    convocatorias_cerradas = Convocatoria.objects.filter(estado='cerrada').count()
    
    # Contratos postulantes y expedientes
    total_postulantes = postulantes_con_rol_postulante().filter(estado='activo').count()
    expedientes_total = Expediente.objects.count()
    expedientes_completos = Expediente.objects.filter(estado='completo').count()
    expedientes_incompletos = Expediente.objects.filter(estado='incompleto').count()
    expedientes_en_proceso = Expediente.objects.filter(estado='en_proceso').count()
    
    # Documentos vencidos y por vencer
    documentos_vencidos = Documento.objects.filter(
        fecha_vencimiento__lt=today,
        fecha_vencimiento__isnull=False
    ).count()
    
    # Documentos por vencer en los próximos 30 días
    fecha_proximamente = today + timedelta(days=30)
    documentos_por_vencer = Documento.objects.filter(
        fecha_vencimiento__gte=today,
        fecha_vencimiento__lte=fecha_proximamente,
        fecha_vencimiento__isnull=False
    ).count()
    
    return Response({
        'total_documentos': total_documentos,
        'documentos_aprobados': documentos_aprobados,
        'documentos_pendientes': documentos_pendientes,
        'documentos_rechazados': documentos_rechazados,
        'documentos_en_revision': documentos_en_revision,
        'semaforo_verde': semaforo_verde,
        'semaforo_amarillo': semaforo_amarillo,
        'semaforo_rojo': semaforo_rojo,
        'convocatorias_activas': convocatorias_activas,
        'convocatorias_cerradas': convocatorias_cerradas,
        'total_postulantes': total_postulantes,
        'expedientes_total': expedientes_total,
        'expedientes_completos': expedientes_completos,
        'expedientes_incompletos': expedientes_incompletos,
        'expedientes_en_proceso': expedientes_en_proceso,
        'documentos_vencidos': documentos_vencidos,
        'documentos_por_vencer': documentos_por_vencer,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chatbot_documental(request):
    """
    Asistente documental disponible solo para usuarios con rol postulante.
    No persiste conversaciones; responde una consulta puntual.
    """
    try:
        perfil = request.user.perfil_documental
    except UsuarioPerfil.DoesNotExist:
        return Response({"detail": "Usuario sin perfil documental."}, status=403)

    if perfil.rol != "postulante":
        return Response({"detail": "Disponible solo para postulantes."}, status=403)

    mensaje = request.data.get("message")
    if not isinstance(mensaje, str) or not mensaje.strip():
        return Response({"detail": "El mensaje es obligatorio."}, status=400)

    mensaje = mensaje.strip()
    if len(mensaje) > 500:
        return Response({"detail": "El mensaje no puede superar 500 caracteres."}, status=400)

    respuesta = responder_consulta_documental(mensaje)
    return Response({"answer": respuesta})


class PostulanteViewSet(viewsets.ModelViewSet):
    """
    ViewSet CRUD para Postulante.
    - list: GET /api/postulantes/
    - create: POST /api/postulantes/
    - retrieve: GET /api/postulantes/{id}/
    - update: PUT /api/postulantes/{id}/
    - partial_update: PATCH /api/postulantes/{id}/
    - destroy: DELETE /api/postulantes/{id}/

    Query params:
    - excluir_convocatoria: id de convocatoria; omite postulantes que ya tienen expediente ahí.
    """
    serializer_class = PostulanteSerializer
    permission_classes = [AllowAny]
    filterset_fields = ['estado', 'numero_documento']
    search_fields = ['nombres', 'apellidos', 'email', 'numero_documento']

    def get_queryset(self):
        qs = postulantes_con_rol_postulante()
        conv_id = self.request.query_params.get('excluir_convocatoria')
        if conv_id:
            qs = qs.exclude(expedientes__convocatoria_id=conv_id)
        return qs


class ConvocatoriaViewSet(viewsets.ModelViewSet):
    """
    ViewSet CRUD para Convocatoria.
    - list: GET /api/convocatorias/
    - create: POST /api/convocatorias/
    - retrieve: GET /api/convocatorias/{id}/
    - update: PUT /api/convocatorias/{id}/
    - partial_update: PATCH /api/convocatorias/{id}/
    - destroy: DELETE /api/convocatorias/{id}/
    Además provee la ruta adicional:
    - detalles: GET /api/convocatorias/{id}/detalles/
      (retorna la convocatoria con requisitos y postulantes anidados)
    """
    serializer_class = ConvocatoriaSerializer
    permission_classes = [AllowAny]
    filterset_fields = ['estado', 'archivado']
    search_fields = ['titulo', 'descripcion']
    ordering_fields = ['fecha_inicio', 'fecha_fin']
    ordering = ['-fecha_inicio']

    def get_queryset(self):
        qs = Convocatoria.objects.all()
        return _queryset_convocatorias_según_usuario(qs, self.request.user)

    @action(detail=True, methods=['get'], url_path='detalles')
    def detalles(self, request, pk=None):
        convocatoria = self.get_object()
        serializer = self.get_serializer(convocatoria)
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        # intercept archiving to update postulantes estado
        instance = self.get_object()
        prev_arch = instance.archivado
        resp = super().partial_update(request, *args, **kwargs)
        # after update, check if archived flag turned from False to True
        instance.refresh_from_db()
        if not prev_arch and instance.archivado:
            # inactivate all postulantes linked via expedientes
            Postulante.objects.filter(expedientes__convocatoria=instance).update(estado='inactivo')
        return resp


class DocumentoRequeridoViewSet(viewsets.ModelViewSet):
    """
    ViewSet CRUD para DocumentoRequerido.
    - list: GET /api/documentos-requeridos/
    - create: POST /api/documentos-requeridos/
    - retrieve: GET /api/documentos-requeridos/{id}/
    - update: PUT /api/documentos-requeridos/{id}/
    - partial_update: PATCH /api/documentos-requeridos/{id}/
    - destroy: DELETE /api/documentos-requeridos/{id}/
    """
    queryset = DocumentoRequerido.objects.all()
    serializer_class = DocumentoRequeridoSerializer
    permission_classes = [AllowAny]
    filterset_fields = ['convocatoria', 'obligatorio']
    search_fields = ['nombre']


class DocumentoViewSet(viewsets.ModelViewSet):
    """
    ViewSet que proporciona acciones CRUD para Documento:
    - list: GET /api/documentos/ (lista todos)
    - create: POST /api/documentos/ (crear nuevo)
    - retrieve: GET /api/documentos/{id}/ (obtener uno)
    - update: PUT /api/documentos/{id}/ (actualizar completo)
    - partial_update: PATCH /api/documentos/{id}/ (actualizar parcial)
    - destroy: DELETE /api/documentos/{id}/ (eliminar)
    """
    serializer_class = DocumentoSerializer
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]
    filterset_fields = ['postulante', 'convocatoria', 'estado', 'estado_semaforo']
    search_fields = ['nombre_archivo', 'postulante__nombres', 'postulante__apellidos']
    ordering_fields = ['fecha_carga', 'confianza_ocr', 'estado']
    ordering = ['-fecha_carga']

    def get_queryset(self):
        qs = Documento.objects.select_related(
            "postulante", "convocatoria", "documento_requerido"
        ).all()
        return _queryset_por_postulante_si_aplica(qs, self.request.user, "postulante")
    
    def get_serializer_context(self):
        """Añade el request al contexto del serializador para generar URLs absolutas."""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_create(self, serializer):
        """
        ========================================================================
        CREAR DOCUMENTO - AQUÍ SE EJECUTA EL SEMÁFORO AL SUBIR
        ========================================================================
        Crea el documento, ejecuta OCR y calcula el estado del semáforo.
        
        Flujo:
        1. Guarda el documento en BD
        2. Ejecuta OCR sobre el archivo (FASE 3)
        3. Calcula el estado del semáforo (FASE 4)
        4. Guarda texto_extraido y estado_semaforo
        ========================================================================
        """
        convocatoria = serializer.validated_data.get('convocatoria')
        postulante = serializer.validated_data.get('postulante')
        documento_requerido = serializer.validated_data.get('documento_requerido')

        _validar_subida_documento_postulante(
            self.request, postulante, convocatoria, documento_requerido
        )

        if convocatoria and hasattr(convocatoria, 'estado'):
            if convocatoria.estado == 'cerrada' or getattr(convocatoria, 'archivado', False):
                raise ValidationError("No se pueden cargar documentos en una convocatoria cerrada o archivada.")

        doc = serializer.save(estado='procesando')
        
        # Lanzar el proceso en segundo plano
        threading.Thread(
            target=ejecutar_procesamiento,
            args=(doc.id,),
            daemon=True
        ).start()
    
    def perform_update(self, serializer):
        """
        ========================================================================
        ACTUALIZAR DOCUMENTO - RECALCULAR SEMÁFORO AL ACTUALIZAR
        ========================================================================
        """
        doc = serializer.save(estado='procesando')
        threading.Thread(
            target=ejecutar_procesamiento,
            args=(doc.id,),
            daemon=True
        ).start()


class UsuarioPerfilViewSet(viewsets.ModelViewSet):
    """
    ViewSet CRUD para UsuarioPerfil.
    - list: GET /api/usuarios-perfil/
    - create: POST /api/usuarios-perfil/
    - retrieve: GET /api/usuarios-perfil/{id}/
    - update: PUT /api/usuarios-perfil/{id}/
    - partial_update: PATCH /api/usuarios-perfil/{id}/
    - destroy: DELETE /api/usuarios-perfil/{id}/
    """
    queryset = UsuarioPerfil.objects.all()
    serializer_class = UsuarioPerfilSerializer
    permission_classes = [AllowAny]
    filterset_fields = ['rol']
    search_fields = ['usuario__username', 'usuario__first_name', 'usuario__last_name']


class ExpedienteViewSet(viewsets.ModelViewSet):
    """
    ViewSet CRUD para Expediente.
    - list: GET /api/expedientes/
    - create: POST /api/expedientes/
    - retrieve: GET /api/expedientes/{id}/
    - update: PUT /api/expedientes/{id}/
    - partial_update: PATCH /api/expedientes/{id}/
    - destroy: DELETE /api/expedientes/{id}/
    """
    serializer_class = ExpedienteSerializer
    permission_classes = [AllowAny]
    filterset_fields = ['postulante', 'convocatoria', 'estado']
    search_fields = [
        'postulante__nombres', 'postulante__apellidos',
        'convocatoria__titulo'
    ]
    ordering_fields = ['creado_en', 'actualizado_en']
    ordering = ['-creado_en']

    def get_queryset(self):
        qs = Expediente.objects.select_related("postulante", "convocatoria").all()
        return _queryset_por_postulante_si_aplica(qs, self.request.user, "postulante")

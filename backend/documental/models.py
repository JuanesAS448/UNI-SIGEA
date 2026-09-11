"""
Modelos del módulo documental.
FASE 1-2: Modelos completos para gestión de documentos, convocatorias, usuarios y expedientes.
"""
from django.db import models
from django.db.models import Q
from django.contrib.auth.models import User
from django.core.validators import FileExtensionValidator, RegexValidator
from django.utils import timezone
from simple_history.models import HistoricalRecords


class UsuarioPerfil(models.Model):
    """
    Perfil extendido del usuario con roles específicos del sistema.
    """
    ROLES = [
        ('admin', 'Administrador'),
        ('revisor', 'Revisor'),
        ('postulante', 'Postulante'),
    ]
    
    usuario = models.OneToOneField(User, on_delete=models.CASCADE, related_name='perfil_documental')
    rol = models.CharField(max_length=20, choices=ROLES, default='postulante')
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Perfil de Usuario'
        verbose_name_plural = 'Perfiles de Usuarios'
    
    def __str__(self):
        return f"{self.usuario.get_full_name() or self.usuario.username} ({self.get_rol_display()})"


class Postulante(models.Model):
    """
    Modelo de postulante con información personal.
    """
    STATUS_CHOICES = [
        ('activo', 'Activo'),
        ('inactivo', 'Inactivo'),
    ]
    
    usuario = models.OneToOneField(User, on_delete=models.CASCADE, related_name='postulante', null=True, blank=True)
    nombres = models.CharField(max_length=100)
    apellidos = models.CharField(max_length=100)
    tipo_documento = models.CharField(max_length=50, default='Cédula de Ciudadanía')
    numero_documento = models.CharField(
        max_length=50,
        unique=True,
        validators=[
            # únicamente dígitos entre 6 y 12 caracteres
            RegexValidator(r'^[0-9]{6,12}$', message='Formato de documento inválido')
        ],
    )
    email = models.EmailField(unique=True)
    telefono = models.CharField(max_length=20)
    direccion = models.CharField(max_length=255)
    fecha_registro = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(max_length=20, choices=STATUS_CHOICES, default='activo')
    
    class Meta:
        ordering = ['-fecha_registro']
        verbose_name = 'Postulante'
        verbose_name_plural = 'Postulantes'
    
    def __str__(self):
        return f"{self.nombres} {self.apellidos} ({self.numero_documento})"


class Convocatoria(models.Model):
    """
    Modelo que representa una convocatoria de vacantes/vinculación.
    """
    STATUS_CHOICES = [
        ('abierta', 'Abierta'),
        ('cerrada', 'Cerrada'),
    ]
    
    titulo = models.CharField(max_length=200)
    descripcion = models.TextField()
    estado = models.CharField(max_length=20, choices=STATUS_CHOICES, default='abierta')
    archivado = models.BooleanField(default=False)
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-fecha_inicio']
        verbose_name = 'Convocatoria'
        verbose_name_plural = 'Convocatorias'
    
    def __str__(self):
        return f"{self.titulo} ({self.get_estado_display()})"
    
    @property
    def postulantes_count(self):
        """Cuenta de postulantes (rol postulante o ficha manual) en esta convocatoria."""
        return (
            Postulante.objects.filter(
                Q(usuario__isnull=True)
                | Q(usuario__perfil_documental__rol="postulante"),
                expedientes__convocatoria=self,
            )
            .distinct()
            .count()
        )
    
    @property
    def is_abierta(self):
        """Verifica si la convocatoria está abierta."""
        hoy = timezone.now().date()
        return self.estado == 'abierta' and self.fecha_inicio <= hoy <= self.fecha_fin


class DocumentoRequerido(models.Model):
    """
    Tipo de documento requerido para una convocatoria.
    """
    convocatoria = models.ForeignKey(Convocatoria, on_delete=models.CASCADE, related_name='documentos_requeridos')
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField()
    obligatorio = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = 'Documento Requerido'
        verbose_name_plural = 'Documentos Requeridos'
        unique_together = ('convocatoria', 'nombre')
    
    def __str__(self):
        return f"{self.nombre} - {self.convocatoria.titulo}"


class Documento(models.Model):
    """
    Modelo que representa un documento subido al sistema.
    
    Campos:
    - archivo: archivo PDF/imagen subido
    - postulante: postulante que subió el documento
    - convocatoria: convocatoria a la que aplica
    - documento_requerido: tipo de documento requerido (opcional)
    - fecha_emision: fecha en que se emitió el documento
    - fecha_vencimiento: fecha de vencimiento (usado para semáforo)
    - estado: estado del documento (pendiente/en_revision/aprobado/rechazado)
    - estado_semaforo: estado del semáforo (verde/amarillo/rojo)
    - texto_extraido: texto obtenido por OCR
    - confianza_ocr: nivel de confianza del OCR (0-100)
    - observaciones: notas sobre el documento
    - tipo_validacion: automática o manual
    - fecha_carga: timestamp de cuando se subió al sistema
    """
    
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('procesando', 'Procesando'),
        ('en_revision', 'En Revisión'),
        ('aprobado', 'Aprobado'),
        ('rechazado', 'Rechazado'),
        ('error_procesamiento', 'Error de Procesamiento'),
    ]
    
    ESTADO_SEMAFORO_CHOICES = [
        ('verde', '🟢 Válido'),
        ('amarillo', '🟡 Requiere revisión'),
        ('rojo', '🔴 Inválido'),
    ]
    
    TIPO_VALIDACION_CHOICES = [
        ('automatica', 'Automática'),
        ('manual', 'Manual'),
    ]
    
    archivo = models.FileField(
        upload_to='documentos/%Y/%m/%d/',
        validators=[FileExtensionValidator(allowed_extensions=['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'bmp'])],
        help_text='Archivo del documento (PDF o imagen)'
    )
    
    postulante = models.ForeignKey(Postulante, on_delete=models.CASCADE, related_name='documentos', null=True, blank=True)
    convocatoria = models.ForeignKey(Convocatoria, on_delete=models.CASCADE, related_name='documentos', null=True, blank=True)
    documento_requerido = models.ForeignKey(DocumentoRequerido, on_delete=models.SET_NULL, null=True, blank=True, related_name='documentos_cargados')
    
    fecha_emision = models.DateField(null=True, blank=True)
    fecha_vencimiento = models.DateField(null=True, blank=True)
    
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    estado_semaforo = models.CharField(max_length=10, choices=ESTADO_SEMAFORO_CHOICES, default='amarillo')
    
    texto_extraido = models.TextField(null=True, blank=True)
    confianza_ocr = models.IntegerField(default=0, help_text='Confianza OCR de 0 a 100')
    observaciones = models.TextField(null=True, blank=True)
    tipo_validacion = models.CharField(max_length=20, choices=TIPO_VALIDACION_CHOICES, default='automatica')
    
    numero_documento_usuario = models.CharField(max_length=50, null=True, blank=True)
    
    fecha_carga = models.DateTimeField(auto_now_add=True)
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['-fecha_carga']
        verbose_name = 'Documento'
        verbose_name_plural = 'Documentos'
    
    def __str__(self):
        nombre_archivo = self.archivo.name.split('/')[-1] if self.archivo else 'Sin archivo'
        return f"{nombre_archivo} ({self.get_estado_display()})"
    
    def recalcular_estado(self):
        """
        Recalcula el estado del semáforo según las reglas de validación.
        """
        from .services.semaforo_service import actualizar_estado_documento
        actualizar_estado_documento(self)
        self.save(update_fields=['estado_semaforo'])


class Expediente(models.Model):
    """
    Expediente que agrupa los documentos de un postulante para una convocatoria.
    """
    STATUS_CHOICES = [
        ('completo', 'Completo'),
        ('incompleto', 'Incompleto'),
        ('en_proceso', 'En Proceso'),
    ]
    
    postulante = models.ForeignKey(Postulante, on_delete=models.CASCADE, related_name='expedientes')
    convocatoria = models.ForeignKey(Convocatoria, on_delete=models.CASCADE, related_name='expedientes')
    estado = models.CharField(max_length=20, choices=STATUS_CHOICES, default='en_proceso')
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()
    
    class Meta:
        ordering = ['-creado_en']
        verbose_name = 'Expediente'
        verbose_name_plural = 'Expedientes'
        unique_together = ('postulante', 'convocatoria')
    
    def __str__(self):
        return f"Expediente {self.postulante} - {self.convocatoria.titulo}"
    
    @property
    def documentos_count(self):
        """Cuenta total de documentos en este expediente."""
        return self.postulante.documentos.filter(convocatoria=self.convocatoria).count()
    
    @property
    def documentos_aprobados_count(self):
        """Cuenta de documentos aprobados."""
        return self.postulante.documentos.filter(
            convocatoria=self.convocatoria,
            estado='aprobado'
        ).count()
    
    @property
    def progreso_porcentaje(self):
        """Porcentaje de documentos aprobados."""
        total = self.documentos_count
        if total == 0:
            return 0
        aprobados = self.documentos_aprobados_count
        return round((aprobados / total) * 100, 1)

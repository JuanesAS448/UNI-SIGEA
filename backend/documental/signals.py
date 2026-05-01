from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import UsuarioPerfil, Postulante
import logging

logger = logging.getLogger(__name__)

@receiver(post_save, sender=User)
def create_user_profile_and_postulante(sender, instance, created, **kwargs):
    """
    Crea automáticamente el UsuarioPerfil (rol postulante) y la ficha de Postulante
    cuando un nuevo usuario se registra en el sistema.
    """
    if created:
        try:
            # 1. Crear el Perfil de Usuario con rol 'postulante'
            UsuarioPerfil.objects.create(
                usuario=instance,
                rol='postulante'
            )
            
            # 2. Crear el Postulante base
            # Generamos un número de documento genérico que el usuario deberá actualizar luego
            # Debe cumplir con el validador: solo dígitos, 6-12 caracteres
            num_doc_temp = f"999000{instance.id:04d}"[:12]
            
            Postulante.objects.create(
                usuario=instance,
                nombres=instance.first_name or instance.username,
                apellidos=instance.last_name or 'Sin apellido',
                email=instance.email or f"{instance.username}@temp.com",
                numero_documento=num_doc_temp,
                telefono='0000000000',
                direccion='Sin dirección'
            )
            logger.info(f"Perfil y Postulante creados automáticamente para el usuario: {instance.username}")
        except Exception as e:
            logger.error(f"Error al crear perfiles automáticos para el usuario {instance.username}: {e}", exc_info=True)

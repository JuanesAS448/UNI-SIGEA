from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import UsuarioPerfil, Postulante
import logging

logger = logging.getLogger(__name__)


def _crear_ficha_postulante_para_usuario(instance: User):
    """Crea la ficha Postulante vinculada al usuario (solo para rol postulante)."""
    num_doc_temp = f"999000{instance.id:04d}"[:12]
    Postulante.objects.create(
        usuario=instance,
        nombres=instance.first_name or instance.username,
        apellidos=instance.last_name or "Sin apellido",
        email=instance.email or f"{instance.username}@temp.com",
        numero_documento=num_doc_temp,
        telefono="0000000000",
        direccion="Sin dirección",
    )


@receiver(post_save, sender=User)
def create_user_profile_and_postulante(sender, instance, created, **kwargs):
    """
    Al crear un usuario:
    - Superusuario: perfil administrador, sin ficha de postulante.
    - Staff (no superusuario): perfil revisor, sin ficha de postulante.
    - Resto: perfil postulante y ficha Postulante (registro público / postulantes).
    """
    if not created:
        return
    try:
        if instance.is_superuser:
            UsuarioPerfil.objects.create(usuario=instance, rol="admin")
            logger.info("Perfil administrador creado para superusuario %s", instance.username)
            return
        if instance.is_staff:
            UsuarioPerfil.objects.create(usuario=instance, rol="revisor")
            logger.info("Perfil revisor creado para staff %s", instance.username)
            return

        UsuarioPerfil.objects.create(usuario=instance, rol="postulante")
        _crear_ficha_postulante_para_usuario(instance)
        logger.info("Perfil y Postulante creados para el usuario: %s", instance.username)
    except Exception as e:
        logger.error(
            "Error al crear perfiles automáticos para el usuario %s: %s",
            instance.username,
            e,
            exc_info=True,
        )


@receiver(post_save, sender=UsuarioPerfil)
def ensure_postulante_when_role_is_postulante(sender, instance, created, **kwargs):
    """
    Si el rol pasa a 'postulante' (p. ej. desde Django Admin) y no existe ficha,
    crea el registro Postulante para mantener sincronía con la vista del sistema.
    """
    if instance.rol != "postulante":
        return
    user = instance.usuario
    if Postulante.objects.filter(usuario=user).exists():
        return
    try:
        _crear_ficha_postulante_para_usuario(user)
        logger.info("Postulante creado al asignar rol postulante a: %s", user.username)
    except Exception as e:
        logger.error(
            "No se pudo crear Postulante para usuario %s: %s",
            user.username,
            e,
            exc_info=True,
        )

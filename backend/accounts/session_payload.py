"""Helpers para construir la sesion que consume el frontend."""
from rest_framework_simplejwt.tokens import RefreshToken


def role_for_user(user):
    try:
        return user.perfil_documental.rol
    except Exception:
        if user.is_superuser:
            return "admin"
        if user.is_staff:
            return "revisor"
        return "postulante"


def session_payload_for_user(user):
    rol = role_for_user(user)

    postulante_id = None
    if rol == "postulante":
        try:
            postulante_id = user.postulante.id
        except Exception:
            postulante_id = None

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "rol": rol,
        "postulante_id": postulante_id,
    }


def auth_payload_for_user(user):
    refresh = RefreshToken.for_user(user)
    payload = session_payload_for_user(user)
    payload.update({
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    })
    return payload

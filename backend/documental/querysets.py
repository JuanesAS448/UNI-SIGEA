"""
Consultas reutilizables para el módulo documental.
"""
from django.db.models import Q

from .models import Postulante


def postulantes_con_rol_postulante():
    """
    Postulantes visibles en el sistema: fichas sin usuario vinculado (carga manual)
    o usuarios cuyo perfil documental tiene rol 'postulante'.

    Excluye administradores y revisores aunque tengan una ficha residual.
    """
    return (
        Postulante.objects.filter(
            Q(usuario__isnull=True)
            | Q(usuario__perfil_documental__rol="postulante")
        )
        .select_related("usuario", "usuario__perfil_documental")
        .distinct()
    )

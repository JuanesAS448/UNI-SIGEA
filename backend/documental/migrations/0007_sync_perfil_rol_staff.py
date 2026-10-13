# Generated manually — alinea roles de perfil con is_superuser / is_staff.

from django.db import migrations


def forwards(apps, schema_editor):
    UsuarioPerfil = apps.get_model("documental", "UsuarioPerfil")
    Postulante = apps.get_model("documental", "Postulante")

    for perfil in UsuarioPerfil.objects.select_related("usuario"):
        user = perfil.usuario
        if user.is_superuser and perfil.rol != "admin":
            perfil.rol = "admin"
            perfil.save(update_fields=["rol"])
        elif user.is_staff and not user.is_superuser and perfil.rol not in ("admin", "revisor"):
            perfil.rol = "revisor"
            perfil.save(update_fields=["rol"])

    # Usuarios con rol postulante deben tener ficha para verse en el sistema
    for perfil in UsuarioPerfil.objects.filter(rol="postulante").select_related("usuario"):
        user = perfil.usuario
        if Postulante.objects.filter(usuario_id=user.pk).exists():
            continue
        num_doc_temp = str(990_000_000_000 + user.pk)[-12:]
        Postulante.objects.create(
            usuario_id=user.pk,
            nombres=user.first_name or user.username,
            apellidos=user.last_name or "Sin apellido",
            email=user.email or f"{user.username}@temp.com",
            numero_documento=num_doc_temp,
            telefono="0000000000",
            direccion="Sin dirección",
        )


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("documental", "0006_alter_documento_estado_historicaldocumento_and_more"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]

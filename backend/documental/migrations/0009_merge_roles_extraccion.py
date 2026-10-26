"""Une el grafo; no añade operaciones de datos ni de esquema."""
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('documental', '0007_sync_perfil_rol_staff'),
        ('documental', '0008_documento_datos_extraidos'),
    ]
    operations = []

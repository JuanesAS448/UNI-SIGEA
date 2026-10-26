"""Adición de esquema independiente de la migración pendiente de roles."""
from django.db import migrations, models


class Migration(migrations.Migration):
    # Rama independiente para poder añadir el campo sin ejecutar RunPython de 0007.
    dependencies = [('documental', '0006_alter_documento_estado_historicaldocumento_and_more')]

    operations = [
        migrations.AddField(
            model_name='documento', name='datos_extraidos',
            field=models.JSONField(blank=True, default=dict, editable=False),
        ),
        migrations.AddField(
            model_name='historicaldocumento', name='datos_extraidos',
            field=models.JSONField(blank=True, default=dict, editable=False),
        ),
    ]

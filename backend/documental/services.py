import base64
import os
import requests
from django.conf import settings


def enviar_documento_a_power_automate(documento):
    postulante = documento.postulante
    try:
        from .models import Expediente
        expediente = Expediente.objects.get(postulante=postulante, convocatoria=documento.convocatoria)
        expediente_id = str(expediente.id)
    except Exception:
        expediente_id = "SIN_EXPEDIENTE"

    try:
        documento.archivo.open(mode='rb')
        archivo_base64 = base64.b64encode(documento.archivo.read()).decode('utf-8')
    finally:
        documento.archivo.close()

    payload = {
        "archivo_base64": archivo_base64,
        "nombre_archivo": os.path.basename(documento.archivo.name),
        "numero_documento": postulante.numero_documento if postulante else "",
        "nombres": postulante.nombres if postulante else "",
        "apellidos": postulante.apellidos if postulante else "",
        "expediente_id": expediente_id,
        "documento_db_id": documento.id
    }

    webhook_url = getattr(settings, 'POWER_AUTOMATE_WEBHOOK_URL', None)
    if not webhook_url:
        return False, "URL no configurada"
    
    try:
        response = requests.post(webhook_url, json=payload, timeout=15)
        response.raise_for_status()
        return True, response.json()
    except requests.exceptions.RequestException as e:
        return False, str(e)

"""Envío de archivos a Power Automate, sin reintentos ni logs de secretos."""
import base64
import http.client
import json
import logging
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import PurePosixPath
from urllib.parse import urlsplit

from django.conf import settings
from .identidad_service import preparar_extraccion, ExtraccionIdentidadInvalida

logger = logging.getLogger(__name__)


class PowerAutomateError(Exception):
    """Mensaje seguro para persistir y devolver al cliente."""


@dataclass(frozen=True)
class ResultadoEnvio:
    status_code: int
    extraccion: dict | None = None


class _SinRedirecciones(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _codigo_error_http(response):
    """Extrae solo códigos conocidos; nunca devuelve mensajes ni el cuerpo."""
    conocidos = {
        'TriggerInputSchemaMismatch', 'InvalidRequestContent', 'InvalidTemplate',
        'DirectApiAuthorizationRequired', 'AuthorizationFailed',
        'InvalidAuthenticationToken', 'MisMatchingOAuthClaims',
        'WorkflowTriggerIsNotEnabled', 'WorkflowNotFound', 'WorkflowTriggerNotFound',
        'InvalidApiVersionParameter', 'MissingApiVersionParameter',
        'UnsupportedApiVersion', 'TriggerRequestMethodNotValid',
        'InvalidRequestTriggerConfig',
    }
    try:
        data = json.loads(response.read(65536))
        error = data.get('error') if isinstance(data, dict) else None
        code = error.get('code') if isinstance(error, dict) else None
        return code if isinstance(code, str) and code in conocidos else None
    except (ValueError, OSError, http.client.HTTPException):
        return None


def enviar_documento(documento):
    """200/201/204 confirman finalización; 202 no confirma Crear archivo.

    Conserva la autenticación de la URL. El token institucional opcional se
    proporciona por entorno; este servicio no lo obtiene ni renueva.
    """
    es_identidad = documento.documento_requerido_id in settings.POWER_AUTOMATE_IDENTITY_REQUIREMENT_IDS
    if es_identidad:
        url = settings.POWER_AUTOMATE_IDENTITY_UPLOAD_URL
        timeout = settings.POWER_AUTOMATE_IDENTITY_TIMEOUT
        if not url:
            raise PowerAutomateError('No está configurada la URL del flujo de documento de identidad.')
    else:
        url = settings.POWER_AUTOMATE_UPLOAD_URL
        timeout = settings.POWER_AUTOMATE_UPLOAD_TIMEOUT
    if any(c.isspace() or ord(c) < 32 or ord(c) == 127 for c in url):
        raise PowerAutomateError('La URL de Power Automate contiene espacios o saltos de línea. Copie la URL completa sin modificarlos ni agregarlos.')
    try:
        parsed = urlsplit(url)
        valid = parsed.scheme == 'https' and parsed.hostname and not parsed.username and not parsed.password
    except ValueError:
        valid = False
    if not valid:
        raise PowerAutomateError('La URL de carga de Power Automate no está configurada correctamente.')
    try:
        with documento.archivo.open('rb') as archivo:
            contenido = archivo.read(settings.DOCUMENT_UPLOAD_MAX_BYTES + 1)
    except OSError:
        raise PowerAutomateError('No se pudo leer el archivo almacenado.') from None
    if not contenido or len(contenido) > settings.DOCUMENT_UPLOAD_MAX_BYTES:
        raise PowerAutomateError('El archivo está vacío o excede el tamaño permitido.')
    payload = {
        'documento': documento.postulante.numero_documento,
        'tipoDocumento': documento.documento_requerido.nombre,
        'mensaje': 'Carga documental UNI SIGEA',
        'nombreArchivo': PurePosixPath(documento.archivo.name.replace('\\', '/')).name,
        'contenido': base64.b64encode(contenido).decode('ascii'),
    }
    headers = {'Content-Type': 'application/json'}
    if settings.POWER_AUTOMATE_BEARER_TOKEN:
        headers['Authorization'] = 'Bearer ' + settings.POWER_AUTOMATE_BEARER_TOKEN
    request = urllib.request.Request(
        url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST',
    )
    result = None
    try:
        opener = urllib.request.build_opener(_SinRedirecciones())
        with opener.open(request, timeout=timeout) as response:
            status = response.status
            if status not in (200, 201, 204):
                raise PowerAutomateError(
                    'Power Automate no confirmó la creación del archivo. No reintente sin verificar SharePoint.'
                )
            body = response.read(65537)
            if len(body) > 65536:
                raise PowerAutomateError('La respuesta de Power Automate excede el tamaño permitido.')
            if body and status != 204:
                try:
                    result = json.loads(body)
                except (ValueError, UnicodeError):
                    result = None  # El contrato permite texto o respuesta vacía.
                if isinstance(result, dict) and (result.get('success') is False or result.get('error')):
                    raise PowerAutomateError('Power Automate informó un error al almacenar el archivo.')
    except urllib.error.HTTPError as exc:
        status = exc.code
        try:
            code = _codigo_error_http(exc)
        finally:
            exc.close()
        logger.warning('Power Automate rechazó documento %s: HTTP %s, código %s', documento.pk, status, code or 'no disponible')
        detail = 'Power Automate rechazó la carga (HTTP %s).' % status
        if code:
            detail += ' Código: %s.' % code
        raise PowerAutomateError(detail) from None
    except TimeoutError:
        raise PowerAutomateError(
            'Power Automate agotó el tiempo de espera. No reintente sin verificar SharePoint.'
        ) from None
    except (urllib.error.URLError, OSError, http.client.HTTPException, ValueError):
        raise PowerAutomateError(
            'No se pudo confirmar la carga en Power Automate. No reintente sin verificar SharePoint.'
        ) from None
    extraccion = None
    if es_identidad:
        try:
            extraccion = preparar_extraccion(result, documento.postulante)
        except ExtraccionIdentidadInvalida as exc:
            raise PowerAutomateError(
                str(exc) + ' El archivo puede haberse creado en SharePoint; verifique el flujo antes de reintentar.'
            ) from None
    logger.info('Power Automate confirmó documento %s: HTTP %s', documento.pk, status)
    return ResultadoEnvio(status_code=status, extraccion=extraccion)

"""Extracción de identidad y comparación con los datos declarados del postulante."""
import math
import re
import unicodedata


CAMPOS_IDENTIDAD = (
    'nombres', 'apellidos', 'numero_cedula', 'fecha_nacimiento',
    'fecha_expedicion', 'tipo_sangre', 'sexo', 'lugar_expedicion',
)


class ExtraccionIdentidadInvalida(ValueError):
    """Error estructural sin incluir datos personales del proveedor."""


def _normalizar_nombre(value):
    text = unicodedata.normalize('NFKD', value or '')
    return ' '.join(''.join(c for c in text if not unicodedata.combining(c)).casefold().split())


def _normalizar_cedula(value):
    text = re.sub(r'[.\s-]', '', value or '')
    return text if re.fullmatch(r'[0-9]+', text) else ''


def preparar_extraccion(respuesta, postulante):
    """Conserva los valores originales; normaliza solo para la comparación.

    Las confianzas se almacenan en escala 0–1. Un valor ausente se representa
    con null; no se inventan puntuaciones ni se sustituyen los datos registrados.
    """
    if not isinstance(respuesta, dict) or respuesta.get('success') is not True or respuesta.get('tipoDocumento') != 'documento_identidad':
        raise ExtraccionIdentidadInvalida('El flujo de identidad no devolvió la respuesta JSON esperada.')
    valores = respuesta.get('datosExtraidos')
    scores = respuesta.get('confianzaCampos')
    if not isinstance(valores, dict) or not isinstance(scores, dict):
        raise ExtraccionIdentidadInvalida('La respuesta de identidad debe incluir datosExtraidos y confianzaCampos como objetos.')
    datos, confianzas = {}, {}
    for campo in CAMPOS_IDENTIDAD:
        value = valores.get(campo)
        if value is not None and (not isinstance(value, str) or len(value) > 2000):
            raise ExtraccionIdentidadInvalida('Un campo extraído tiene un formato inválido.')
        datos[campo] = value if isinstance(value, str) and value.strip() else None
        score = scores.get(campo)
        if score is None or (isinstance(score, str) and not score.strip()):
            confianzas[campo] = None
            continue
        if isinstance(score, bool) or not isinstance(score, (str, float, int)):
            raise ExtraccionIdentidadInvalida('Una puntuación de confianza tiene un formato inválido.')
        try:
            score = float(score)
        except (ValueError, OverflowError):
            raise ExtraccionIdentidadInvalida('Una puntuación de confianza no es numérica.') from None
        if not math.isfinite(score) or not 0 <= score <= 1:
            raise ExtraccionIdentidadInvalida('Las puntuaciones de confianza deben estar entre 0 y 1.')
        # No atribuir confianza a una extracción ausente, incluso si llegó un score.
        confianzas[campo] = score if datos[campo] is not None else None

    return {
        'origen': 'ai_builder', 'tipo_documento': 'documento_identidad',
        'valores': datos, 'confianzas': confianzas,
        'comparacion': comparar_identidad(datos, postulante),
    }


def comparar_identidad(datos, postulante):
    comparaciones = {}
    for campo, registrado, normalizar in (
        ('nombres', postulante.nombres, _normalizar_nombre),
        ('apellidos', postulante.apellidos, _normalizar_nombre),
        ('numero_cedula', postulante.numero_documento, _normalizar_cedula),
    ):
        reference = normalizar(registrado)
        extraido = normalizar(datos.get(campo))
        coincide = reference == extraido if reference and extraido else None
        comparaciones[campo] = {
            'registrado': registrado, 'coincide': coincide,
        }
    coincidencia = all(v['coincide'] is True for v in comparaciones.values())
    return {'coincidencia_identidad': coincidencia, 'campos': comparaciones}


def evaluar_estado_identidad(extraccion):
    """Decide por coincidencia de nombres, apellidos y cédula, no por confianza."""
    campos = extraccion.get('comparacion', {}).get('campos', {})
    coincidencias = [campos.get(campo, {}).get('coincide') for campo in ('nombres', 'apellidos', 'numero_cedula')]
    if any(coincide is False for coincide in coincidencias):
        return 'rechazado', 'rojo', 'Datos no coinciden. Revisa el documento que cargaste.'
    if all(coincide is True for coincide in coincidencias):
        return 'aprobado', 'verde', 'Datos de identidad coinciden con los registrados en la plataforma.'
    return 'en_revision', 'amarillo', 'No se pudieron verificar todos los datos de identidad. Revisa la legibilidad del documento.'


def resumen_extraccion(extraccion):
    """Resumen derivado, en porcentaje. No es una probabilidad de autenticidad."""
    if not isinstance(extraccion, dict) or extraccion.get('origen') != 'ai_builder':
        return None
    valores = extraccion.get('valores', {})
    confianzas = extraccion.get('confianzas', {})
    presentes = [campo for campo in CAMPOS_IDENTIDAD if valores.get(campo)]
    scores = [confianzas[campo] for campo in presentes if confianzas.get(campo) is not None]
    campos_faltantes = [campo for campo in CAMPOS_IDENTIDAD if campo not in presentes]
    comparacion = extraccion.get('comparacion', {})
    return {
        'confianza_promedio': round(100 * sum(scores) / len(scores), 2) if scores else None,
        'campos_esperados': len(CAMPOS_IDENTIDAD),
        'campos_extraidos': len(presentes), 'confianzas_disponibles': len(scores),
        'campos_faltantes': campos_faltantes,
        'extraccion_completa': not campos_faltantes,
        'coincidencia_identidad': comparacion.get('coincidencia_identidad', False),
        'tiene_alertas_de_datos': bool(campos_faltantes) or len(scores) < len(CAMPOS_IDENTIDAD) or not comparacion.get('coincidencia_identidad', False),
    }

import json
import logging
import os
import unicodedata
import urllib.error
import urllib.request

logger = logging.getLogger(__name__)

DOCUMENTAL_FALLBACK = "No fue posible procesar tu consulta documental en este momento."
FUERA_DE_CONTEXTO = "Solo puedo ayudarte con documentacion del proceso de vinculacion."

TEMAS_DOCUMENTALES = (
    "cedula",
    "cedula de ciudadania",
    "cc",
    "documento de identidad",
    "identificacion",
    "hoja de vida",
    "curriculum",
    "cv",
    "certificado laboral",
    "certificados laborales",
    "experiencia laboral",
    "certificado academico",
    "certificados academicos",
    "titulo",
    "rut",
    "antecedentes disciplinarios",
    "procuraduria",
    "antecedentes fiscales",
    "contraloria",
    "antecedentes judiciales",
    "certificado policia",
    "certificado de policia",
    "policia nacional",
    "policia",
    "declaracion juramentada",
    "declaracion juramentada de bienes y rentas",
    "bienes y rentas",
    "sigep",
    "tratamiento de datos",
    "autorizacion tratamiento de datos",
    "autorizacion de tratamiento de datos",
    "datos personales",
    "habeas data",
    "sistema nacional de medidas correctivas",
    "medidas correctivas",
    "rnmc",
    "comparendos",
    "clausula de confidencialidad",
    "confidencialidad",
    "inhabilidades",
    "incompatibilidades",
    "conflictos",
    "conflicto de intereses",
    "conflictos de intereses",
    "delitos sexuales",
    "menores de 18",
    "menores",
    "nit",
    "sg-sst",
    "sgsst",
    "curso sg-sst",
    "seguridad y salud en el trabajo",
    "redam",
    "deudores alimentarios",
    "moroso alimentario",
    "compromiso anticorrupcion",
    "anticorrupcion",
    "eps",
    "salud",
    "pension",
    "fondo de pensiones",
    "cuenta bancaria",
    "banco",
    "certificacion bancaria",
    "diploma",
    "acta de grado",
    "archivo",
    "documento",
    "documentos",
    "requisito",
    "requisitos",
    "cargar",
    "subir",
    "validacion",
    "revision",
    "rechazado",
    "aprobado",
)

DOCUMENTOS_PERMITIDOS = """
- Cedula de ciudadania: documento de identidad legible y vigente.
- Hoja de vida: datos personales, formacion y experiencia completos.
- Certificados laborales: deben incluir fecha de inicio y fin, cargo, funciones y estar firmados.
- Certificados academicos: diplomas, actas o soportes academicos legibles y a nombre del titular.
- RUT: documento tributario actualizado y legible.
- Certificado Contraloria / antecedentes fiscales: fecha menor a 30 dias y sin antecedentes fiscales. Error comun: certificado vencido o con deudas fiscales. Enlace: https://www.contraloria.gov.co/web/guest/persona-natural
- Certificado Procuraduria / antecedentes disciplinarios: fecha menor a 30 dias y datos coincidentes. Error comun: nombre o cedula no coinciden. Enlace: https://www.procuraduria.gov.co/Pages/Generacion-de-antecedentes.aspx
- Certificado Policia Nacional / antecedentes judiciales: validar numero de cedula y fecha reciente. Error comun: fecha de consulta antigua. Enlace: https://antecedentes.policia.gov.co:7005/WebJudicial/
- Declaracion Juramentada de Bienes y Rentas / SIGEP: debe indicar "Contratista" y tener datos completos. Error comun: colocar "Docente" o confundir datos personales. Enlace: https://www1.funcionpublica.gov.co/acceso-directo-byr/
- Autorizacion Tratamiento de Datos: completar solo campos permitidos y firmar. Error comun: editar campos protegidos o no seleccionar tipo de documento.
- Sistema Nacional de Medidas Correctivas / RNMC: fecha menor a 30 dias y sin antecedentes. Error comun: documento vencido. Enlace: https://srvcnpc.policia.gov.co/PSC/frm_cnp_consulta.aspx
- Clausula de Confidencialidad: debe incluir correo y firma, con fecha vigente. Error comun: omitir correo o firma. Enlace: https://share.google/4YHiYYXLZYBrl9rAz
- Inhabilidades, Incompatibilidades y Conflictos: incluir fecha, hora, numero de proceso y firma valida. Error comun: datos incorrectos o incompletos.
- Delitos Sexuales para Menores de 18: ingresar NIT correcto de la universidad y fecha vigente. Error comun: NIT incorrecto o vacio. Enlace: https://inhabilidades.policia.gov.co:8080/
- Curso SG-SST: certificado valido a nombre del titular. Error comun: certificado vencido o de otra persona. Enlace: https://www.sura.co/arl/educacion/cursos/50-horas-sgsst
- REDAM / Registro de Deudores Alimentarios Morosos: no aparecer como deudor y fecha menor a 30 dias. Error comun: registro como moroso activo. Enlace: https://carpetaciudadana.and.gov.co/inicio-de-sesion
- Compromiso Anticorrupcion: fecha en formato "Villa de San Diego, [dia] de [mes] del [año]". Error comun: usar "Ubate" o formato numerico. Enlace: https://share.google/IffKcX485stFlLn7G
- EPS, pension y cuenta bancaria: soportes legibles y a nombre del titular.
"""

DOCUMENTOS_INFO = (
    {
        "nombre": "Certificado Contraloria",
        "keywords": ("contraloria", "antecedentes fiscales", "certificado fiscal"),
        "enlace": "https://www.contraloria.gov.co/web/guest/persona-natural",
        "resumen": "Debe tener fecha menor a 30 dias y no presentar antecedentes fiscales. Error comun: certificado vencido o con deudas fiscales.",
    },
    {
        "nombre": "Certificado Procuraduria",
        "keywords": ("procuraduria", "antecedentes disciplinarios", "certificado disciplinario"),
        "enlace": "https://www.procuraduria.gov.co/Pages/Generacion-de-antecedentes.aspx",
        "resumen": "Debe tener fecha menor a 30 dias y datos coincidentes. Error comun: nombre o cedula no coinciden.",
    },
    {
        "nombre": "Certificado Policia Nacional",
        "keywords": ("policia nacional", "antecedentes judiciales", "certificado policia", "certificado de policia"),
        "enlace": "https://antecedentes.policia.gov.co:7005/WebJudicial/",
        "resumen": "Debe validar numero de cedula y fecha reciente. Error comun: fecha de consulta antigua.",
    },
    {
        "nombre": "Declaracion Juramentada de Bienes y Rentas (SIGEP)",
        "keywords": ("declaracion juramentada", "bienes y rentas", "sigep"),
        "enlace": "https://www1.funcionpublica.gov.co/acceso-directo-byr/",
        "resumen": "Debe indicar Contratista y tener datos completos. Error comun: colocar Docente o confundir datos personales.",
    },
    {
        "nombre": "Autorizacion Tratamiento de Datos",
        "keywords": ("tratamiento de datos", "autorizacion tratamiento de datos", "datos personales", "habeas data"),
        "enlace": "https://www1.funcionpublica.gov.co/acceso-directo-byr/",
        "resumen": "Completa solo campos permitidos y firma. Error comun: editar campos protegidos o no seleccionar tipo de documento.",
    },
    {
        "nombre": "Sistema Nacional de Medidas Correctivas",
        "keywords": ("sistema nacional de medidas correctivas", "medidas correctivas", "rnmc", "comparendos"),
        "enlace": "https://srvcnpc.policia.gov.co/PSC/frm_cnp_consulta.aspx",
        "resumen": "Debe tener fecha menor a 30 dias y no presentar antecedentes. Error comun: documento vencido.",
    },
    {
        "nombre": "Clausula de Confidencialidad",
        "keywords": ("clausula de confidencialidad", "confidencialidad"),
        "enlace": "https://share.google/4YHiYYXLZYBrl9rAz",
        "resumen": "Debe incluir correo y firma, con fecha vigente. Error comun: omitir correo o firma.",
    },
    {
        "nombre": "Delitos Sexuales (Menores de 18)",
        "keywords": ("delitos sexuales", "menores de 18", "menores", "nit universidad"),
        "enlace": "https://inhabilidades.policia.gov.co:8080/",
        "resumen": "Ingresa el NIT correcto de la universidad y verifica que la fecha este vigente. Error comun: NIT incorrecto o vacio.",
    },
    {
        "nombre": "Curso SG-SST",
        "keywords": ("curso sg-sst", "sg-sst", "sgsst", "seguridad y salud en el trabajo"),
        "enlace": "https://www.sura.co/arl/educacion/cursos/50-horas-sgsst",
        "resumen": "El certificado debe estar vigente y a nombre del titular. Error comun: certificado vencido o de otra persona.",
    },
    {
        "nombre": "REDAM",
        "keywords": ("redam", "deudores alimentarios", "moroso alimentario"),
        "enlace": "https://carpetaciudadana.and.gov.co/inicio-de-sesion",
        "resumen": "No debes aparecer como deudor y la fecha debe ser menor a 30 dias. Error comun: registro como moroso activo.",
    },
    {
        "nombre": "Compromiso Anticorrupcion",
        "keywords": ("compromiso anticorrupcion", "anticorrupcion"),
        "enlace": "https://share.google/IffKcX485stFlLn7G",
        "resumen": "La fecha debe ir como Villa de San Diego, [dia] de [mes] del [año]. Error comun: usar Ubate o formato numerico.",
    },
)


def _buscar_documento(mensaje):
    texto = _normalizar(mensaje)
    for doc in DOCUMENTOS_INFO:
        if any(keyword in texto for keyword in doc["keywords"]):
            return doc
    return None


def _pide_enlace(mensaje):
    texto = _normalizar(mensaje)
    palabras = ("donde", "obtener", "descargar", "generar", "consultar", "sacar", "enlace", "link", "pagina")
    return any(palabra in texto for palabra in palabras)


def _respuesta_enlace_si_aplica(mensaje):
    if not _pide_enlace(mensaje):
        return None
    doc = _buscar_documento(mensaje)
    if not doc:
        return None
    return f"Puedes obtener {doc['nombre']} en este enlace: {doc['enlace']}. {doc['resumen']}"


def _respuesta_local(mensaje):
    doc = _buscar_documento(mensaje)
    if not doc:
        return DOCUMENTAL_FALLBACK
    return f"Sobre {doc['nombre']}: {doc['resumen']}"


def _normalizar(texto):
    limpio = unicodedata.normalize("NFKD", texto.lower())
    return "".join(c for c in limpio if not unicodedata.combining(c))


def es_consulta_documental(mensaje):
    texto = _normalizar(mensaje)
    return any(tema in texto for tema in TEMAS_DOCUMENTALES)


def responder_consulta_documental(mensaje):
    if not es_consulta_documental(mensaje):
        return FUERA_DE_CONTEXTO

    respuesta_enlace = _respuesta_enlace_si_aplica(mensaje)
    if respuesta_enlace:
        return respuesta_enlace

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY no esta configurada.")
        return _respuesta_local(mensaje)

    prompt = (
        "Eres el asistente documental del sistema UNI SIGEA. "
        "Responde solo sobre documentos del proceso de vinculacion. "
        "Documentos, sinonimos y reglas permitidas:\n"
        f"{DOCUMENTOS_PERMITIDOS}\n"
        "Si la pregunta no pertenece a esos temas, responde exactamente: "
        f"'{FUERA_DE_CONTEXTO}'. "
        "Da respuestas breves, claras, en espanol, maximo 3 frases. "
        "Cuando aplique, menciona fecha requerida, dato a revisar y error comun. "
        "Si el usuario pregunta donde obtener, descargar, generar o consultar un documento, responde con el enlace del catalogo. "
        f"Pregunta del postulante: {mensaje}"
    )

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 350,
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }

    model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        logger.error("Error consultando Gemini: %s", exc, exc_info=True)
        return _respuesta_local(mensaje)

    try:
        texto = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError, TypeError):
        logger.error("Respuesta inesperada de Gemini: %s", data)
        return _respuesta_local(mensaje)

    return texto or _respuesta_local(mensaje)

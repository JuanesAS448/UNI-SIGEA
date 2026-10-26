# Carga documental a Power Automate

La carga existente (`POST /api/documentos/`, multipart con `archivo`) requiere JWT.
El backend guarda el archivo local y lo envía al flujo. En identidad persiste la
extracción de AI Builder; los demás documentos conservan su procesamiento OCR.
También envía reemplazos de archivo mediante PUT/PATCH; editar metadatos no envía
otra copia. No hay reintentos automáticos. La etapa de identidad añade un JSONField
de extracción a Documento y su historial; ver AI-BUILDER-IDENTIDAD.md.

## Variables de entorno del backend

```dotenv
POWER_AUTOMATE_UPLOAD_URL=
POWER_AUTOMATE_UPLOAD_TIMEOUT=30
DOCUMENT_UPLOAD_MAX_BYTES=10485760
# Solo si el trigger institucional requiere Bearer:
POWER_AUTOMATE_BEARER_TOKEN=
```

La URL debe ser HTTPS. Se admite `POWER_AUTOMATE_URL` como alias de compatibilidad
si `POWER_AUTOMATE_UPLOAD_URL` está vacía. Se conserva la autenticación incluida en
la URL; no se deben copiar URLs firmadas ni tokens a archivos versionados. El token
Bearer opcional debe suministrarse y renovarse externamente según la institución;
el backend no implementa un nuevo proveedor de identidad. Reiniciar Django después
de cambiar estas variables. No se registran URL, tokens, Base64 ni respuesta remota.

Los formatos admitidos son PDF, PNG, JPG, JPEG, TIFF y BMP. Se valida extensión,
firma binaria inicial y tamaño (10 MiB por defecto). La firma no sustituye una
validación completa del documento ni un análisis antivirus.

## Contrato y resultados

Se envían únicamente `documento` (número del postulante asociado), `tipoDocumento`
(nombre del requisito), `mensaje` (`Carga documental UNI SIGEA`), `nombreArchivo`
(nombre almacenado sin ruta) y `contenido` (Base64 puro). El almacenamiento local
puede cambiar el nombre para evitar colisiones; se envía ese nombre final.

Se interpretan HTTP 200, 201 o 204 como confirmación final según el contrato del
flujo. HTTP 202 solo indica aceptación y se trata como resultado no confirmado.
Si una respuesta JSON contiene `success: false` o un `error` no vacío, se considera
fallida incluso con HTTP 200. El flujo existente debe emitir la respuesta de éxito
después de Crear archivo y comunicar sus fallos mediante HTTP de error o esos
campos. Sin ese comportamiento el backend no puede verificar SharePoint de forma
independiente. No se modifica el flujo desde esta integración.

Un fallo conserva el archivo y su registro local, persiste `error_procesamiento`
y una observación segura, y responde HTTP 502 con `detail` y `documento_id`.
No se inicia OCR en ese caso. La edición de metadatos no elimina ese estado.
El éxito se registra en `observaciones` y el historial existente; los estados
posteriores de documentos generales siguen siendo gestionados por OCR/semáforo;
identidad expone la extracción y su resumen, y se aprueba/rechaza por coincidencia
de nombres, apellidos y cédula (queda en revisión si falta información comparable).
No existe un campo
independiente para sincronización ni se guarda un identificador remoto.

Un timeout o corte de conexión puede ocurrir después de crear el archivo remoto.
Comprobar la ejecución del flujo y SharePoint antes de volver a cargarlo para
evitar duplicados. La integración no agrega idempotencia. Un fallo de base de
datos posterior al envío tampoco puede deshacer la creación remota.

El frontend mantiene su mensaje genérico de error y su comportamiento actual para
documentos con error de procesamiento. No se modificó la interfaz para reintentos.

## Prueba controlada sin tráfico externo

Desde la raíz del repositorio:

```powershell
backend\.venv\Scripts\python.exe -B backend/manage.py test documental.tests --noinput
```

Las pruebas usan base de datos de pruebas, almacenamiento temporal, datos ficticios,
transporte HTTP simulado y OCR desactivado mediante mock. Verifican el contrato,
Base64, permisos, formatos, tamaño, registro de resultados, timeout, errores HTTP,
conexión, token opcional y ausencia de reenvío en ediciones de metadatos.
Las pruebas automatizadas no envían documentos ni llaman al flujo real.
El comando anterior `python -B test_power_automate.py` desde `backend/` ahora
ejecuta estas mismas pruebas con mocks; ya no realiza una carga real de texto.

## Validación manual y corrección del contenido binario (19 de octubre de 2026)

El usuario confirmó la carga y apertura correctas del PDF en SharePoint tras
corregir el campo Contenido del archivo de la acción Crear archivo. Esta es una
confirmación funcional del usuario; el backend no descarga ni compara el archivo
remoto automáticamente.

En la primera prueba, la copia local tenía 88.416 bytes y la descargada de
SharePoint 155.863. La copia descargada coincidía con la conversión del original
a texto UTF-8 con reemplazo de bytes inválidos, más un byte final. Sus streams
comprimidos habían quedado dañados. Se encontró una expresión interpolada como
texto en el contenido de Crear archivo.

El campo debe contener únicamente la expresión insertada mediante fx:

```text
base64ToBinary(triggerBody()?['contenido'])
```

En la definición de Crear archivo debe quedar como expresión completa:

```json
"body": "@base64ToBinary(triggerBody()?['contenido'])"
```

La forma `@{base64ToBinary(...)}` interpola el resultado como texto y puede
corromper archivos binarios. Evitar texto, espacios o saltos de línea adicionales
en el campo. La corrección afecta a nuevas cargas; no repara archivos previos.
Se añadió una prueba con bytes no UTF-8 para verificar que Django conserva el
contenido binario al construir el payload. La evaluación de expresiones del flujo
se comprueba mediante la prueba manual, no mediante estos mocks.

## Siguiente etapa: AI Builder

### Flujo independiente de identidad

Para enviar solo los requisitos de cédula al nuevo flujo, agregar a `backend/.env`:

```dotenv
POWER_AUTOMATE_IDENTITY_UPLOAD_URL=
POWER_AUTOMATE_IDENTITY_REQUIREMENT_IDS=3,5,7,20
POWER_AUTOMATE_IDENTITY_TIMEOUT=90
```

Pegar la URL HTTPS firmada únicamente en el `.env` local. Los ID del ejemplo son
los requisitos de cédula de la base local revisada; verificar la correspondencia
en cada entorno y agregar nuevos ID cuando se creen requisitos en otras
convocatorias. No se selecciona el flujo por el nombre del archivo. Si un ID está
configurado como identidad y falta su URL, se registra el fallo sin enviar al
flujo general. Los demás requisitos conservan el destino general anterior.

El timeout de identidad es independiente porque AI Builder procesa antes de
responder; un timeout deja el resultado no confirmado y no dispara reintentos.
Reiniciar Django tras cambiar el entorno. Hacer la primera prueba con un PDF,
que es el tipo configurado inicialmente en la acción Procesar documentos.
La respuesta de identidad debe incluir datosExtraidos y confianzaCampos con los
ocho valores y sus puntuaciones 0–1. Django los persiste, calcula un promedio y
compara nombres, apellidos y cédula con Postulante. No lanza OCR local para estas
cargas. El detalle y el promedio están disponibles en la API y se muestran en
React mediante el resumen y el botón Ver extracción. Los documentos anteriores
sin datos extraídos mantienen el comportamiento previo; no se reprocesan solos.

Las columnas de metadatos de SharePoint siguen siendo responsabilidad del flujo.
Para el contrato, las reglas de comparación, las migraciones y la interpretación
de la confianza, consultar AI-BUILDER-IDENTIDAD.md.

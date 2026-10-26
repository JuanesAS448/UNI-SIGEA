# Integración de documento de identidad

Estado del paso 2 (21 de octubre de 2026): recepción y persistencia de los ocho
campos y sus confianzas implementadas, con promedio y comparación de identidad.
El usuario confirmó previamente el funcionamiento del flujo y configuró sus
salidas de confianza. Esta etapa se probó con mocks, sin enviar archivos al flujo.
El paso 3 añade el promedio y el detalle por campo en la interfaz de React.

## Datos solicitados

| Dato extraído | Clave interna | Representación |
| --- | --- | --- |
| Nombres | nombres | Texto o null |
| Apellidos | apellidos | Texto o null |
| Número de cédula | numero_cedula | Texto o null; no convertir a número |
| Fecha de nacimiento | fecha_nacimiento | Texto devuelto por el modelo o null |
| Fecha de expedición | fecha_expedicion | Texto devuelto por el modelo o null |
| Tipo de sangre | tipo_sangre | Texto o null |
| Sexo | sexo | Texto o null, según lo extraído |
| Lugar de expedición | lugar_expedicion | Texto o null |

El flujo mapea las salidas del modelo a estas claves. Django conserva los valores
originales; los vacíos se guardan como null. Las fechas no se asignan al perfil
ni se inventan si el modelo no pudo extraerlas. La aprobación automática depende
de la coincidencia de nombres, apellidos y cédula, no del porcentaje de confianza.

## Requisitos de carga existentes

Revisión de solo lectura realizada el 19 de octubre de 2026:

| ID de requisito | Nombre actual | ID de convocatoria |
| --- | --- | --- |
| 3 | Cedula de ciudania | 1 |
| 5 | Cedula | 2 |
| 7 | Cédula de Ciudadanía | 4 |
| 20 | Cedula | 5 |

Estos ID pertenecen a la base de datos local revisada y no deben codificarse
como constantes en el servicio. Confirmar cuáles corresponden al flujo de
identidad y configurar esa relación mediante entorno. Un requisito de otra
convocatoria puede tener otro ID. No seleccionar flujos por coincidencias vagas
con el nombre del archivo ni por datos enviados libremente por el cliente.
Las URLs y credenciales se mantienen fuera del código fuente.

## Contrato de respuesta (ejemplo ficticio)

```json
{
  "success": true,
  "tipoDocumento": "documento_identidad",
  "datosExtraidos": {
    "nombres": "PERSONA",
    "apellidos": "DE PRUEBA",
    "numero_cedula": "0000000000",
    "fecha_nacimiento": "1995-01-01",
    "fecha_expedicion": "2013-02-01",
    "tipo_sangre": "O+",
    "sexo": "F",
    "lugar_expedicion": "LUGAR DE PRUEBA"
  },
  "confianzaCampos": {
    "nombres": 0.98,
    "apellidos": 0.96,
    "numero_cedula": 1.0,
    "fecha_nacimiento": 0.94,
    "fecha_expedicion": 0.92,
    "tipo_sangre": 0.90,
    "sexo": 0.88,
    "lugar_expedicion": 0.86
  }
}
```

La respuesta del flujo de identidad debe ser JSON con success exactamente true,
tipoDocumento igual a documento_identidad y ambos objetos presentes. Se permiten
campos faltantes o null como extracción parcial. HTTP 200 con texto, respuesta
vacía, tipo documental incorrecto o estructura inválida produce un error 502.
El archivo puede haberse creado remotamente: verificar SharePoint antes de repetir.
El timeout de identidad es independiente (90 segundos por defecto); no hay reintentos.

## Persistencia y API

Documento.datos_extraidos es un JSONField de solo lectura para el cliente. Guarda:

- origen: ai_builder; tipo_documento: documento_identidad.
- valores: los ocho valores extraídos, sin sobrescribir Postulante.
- confianzas: puntuaciones numéricas 0–1 o null por campo.
- comparacion: coincidencia de nombres, apellidos y cédula, con los datos
  registrados usados en esa comparación. Es una instantánea al procesar el archivo.

No se guardan datos personales extraídos en logs ni en observaciones. Se mantienen
el aislamiento entre postulantes y el acceso del personal autorizado. Usuarios sin
rol documental no pueden consultar estas extracciones. El cliente no puede escribir
datos_extraidos ni el resumen a través de POST/PATCH.

resumen_extraccion es un campo derivado de solo lectura en la API:

- confianza_promedio: media aritmética de confianzas disponibles multiplicada por
  100, redondeada a dos decimales. No equivale a probabilidad de autenticidad.
- campos_esperados, campos_extraidos, confianzas_disponibles y campos_faltantes.
- extraccion_completa, coincidencia_identidad y tiene_alertas_de_datos.
- revision_pendiente: si el documento sigue en estado en_revision.

El promedio no inventa cero para una confianza ausente. Si no hay puntuaciones,
es null. El cero explícito sí cuenta. Si no existe valor extraído, su confianza se
guarda como null incluso si el proveedor envió una puntuación. Se aceptan números
o cadenas numéricas 0–1; porcentajes 98, booleanos, NaN e infinitos se rechazan.
El promedio siempre debe mostrarse junto con la cobertura de extracción.

## Comparación y revisión

Para comparar nombres y apellidos se ignoran mayúsculas, tildes y diferencias de
espaciado. En cédula se ignoran puntos, espacios y guiones y se conservan los
dígitos como texto. No hay coincidencia difusa ni comparación por fragmentos.
Los otros cinco campos no se comparan: aún no hay datos registrados de referencia.

Las nuevas cargas de identidad no lanzan OCR local. Su estado se decide así:

- Los tres datos coinciden: aprobado/verde, tipo de validación automática.
- Al menos uno presenta una diferencia confirmada: rechazado/rojo y el mensaje
  «Datos no coinciden. Revisa el documento que cargaste.».
- Sin diferencias confirmadas, pero falta algún dato comparable: en_revision/
  amarillo y un mensaje que pide revisar la legibilidad del documento.

Una diferencia confirmada tiene prioridad aunque otro dato no se haya extraído.
Los otros cinco campos se guardan y se muestran en la cobertura; no deciden el
estado porque no tienen referencia registrada para comparar. No hay un umbral
de confianza para esta regla. Admin/revisor puede revisar el resultado después,
sin otro envío ni OCR. Los documentos anteriores no se recalifican automáticamente.
La confirmación HTTP se conserva en datos_extraidos.envio.http_status; observaciones
contiene un mensaje de validación para el usuario en lugar de detalles técnicos.
Al sustituir un archivo se descarta su extracción anterior antes del nuevo envío,
incluso si el envío falla. Cambiar la asociación de un archivo ya extraído exige
reemplazarlo para no adjudicar sus resultados a otro postulante.

## Migración y verificación

0008_documento_datos_extraidos añade el JSONField a Documento y HistoricalDocumento.
Depende de 0006, en una rama independiente de 0007_sync_perfil_rol_staff para no
ejecutar cambios de roles no aprobados. 0009_merge_roles_extraccion une las ramas
sin operaciones. Para instalar únicamente el campo:

```powershell
backend\.venv\Scripts\python.exe -B backend/manage.py migrate documental 0008
```

Se aplicó únicamente 0008 en la base SQLite local y se verificó que roles y fichas
no cambiaron. 0007 y la unión 0009 siguen pendientes; migrate sin destino también
ejecutaría 0007. Las pruebas usan una base independiente y aplican el grafo completo.

Pasaron 50 pruebas con mocks, incluidos contrato, promedios, campos faltantes,
confianzas inválidas, comparación normalizada, solo lectura, permisos, revisión
manual, aprobación/rechazo automáticos, reemplazos y regresión de cargas generales. No se reprocesaron archivos
anteriores ni se enviaron documentos al flujo durante estas verificaciones.
Los archivos anteriores mantienen datos_extraidos vacío y resumen_extraccion null.

## Visualización (paso 3)

El componente compartido ExtraccionDocumento aparece en el portal del postulante,
Documentos, el detalle de convocatoria y la vista de documentos por semáforo.
En el portal del postulante, el bloque de extracción muestra solo la confianza
promedio. Las vistas del personal muestran además cobertura (campos
extraídos/esperados), número de puntuaciones disponibles y coincidencia de
identidad, y ofrecen Ver extracción. El estado del documento se
mantiene separado: un promedio alto no supone aprobación.

Ver extracción abre una tabla con los ocho valores, confianza individual en
porcentaje, dato registrado y comparación. Nombres, apellidos y cédula muestran
Coincide, No coincide o Sin datos para comparar. Los otros cinco campos muestran
Sin dato de referencia. La comparación usa los datos registrados al procesar el
archivo, no una nueva consulta contra cambios posteriores del perfil.

Los campos vacíos se muestran como Sin extraer, una confianza null como Sin
puntuación, y un cero explícito como 0 %. Un promedio alto conserva el aviso de
extracción incompleta y su cobertura. Los documentos anteriores sin datos de AI
Builder no muestran Ver extracción; las vistas del personal conservan su indicador
OCR. No se inventan ni reprocesan resultados de archivos anteriores.

Se añadieron ocho pruebas del componente, incluidas confianzas ausentes/cero,
extracción parcial, comparación no coincidente y apertura/cierre en ventanas
anidadas y presentación reducida en el portal. Junto con las tres pruebas de eliminación, pasaron once pruebas de
interfaz y la comprobación de TypeScript.

Para validar el recorrido completo con el flujo configurado, reiniciar Django,
mantener React en ejecución y cargar una sola vez un PDF ficticio nuevo en el
requisito de cédula. Revisar promedio y cobertura en la plataforma y abrir Ver
extracción. Comparar los valores y puntuaciones con Respuesta en el historial de
Power Automate. El desarrollo del paso 3 no envió documentos al flujo real.

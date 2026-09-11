import logging
from documental.models import Documento
from documental.services.ocr_service import extraer_texto_ocr
from documental.services.semaforo_service import actualizar_estado_documento

logger = logging.getLogger(__name__)

def procesar_documento_async(documento_id: int):
    """
    Procesa un documento de forma asíncrona (desacoplado del request HTTP).
    Extrae texto mediante OCR y actualiza el semáforo inteligente.
    """
    try:
        doc = Documento.objects.get(id=documento_id)
        
        # FASE 3: Extraer texto con OCR
        if doc.archivo:
            ruta = doc.archivo.path
            texto = extraer_texto_ocr(ruta)
            if texto:
                doc.texto_extraido = texto
        
        # FASE 4: Calcular estado del semáforo
        actualizar_estado_documento(doc)
        
        # Guardar cambios
        campos_a_actualizar = ['estado_semaforo', 'texto_extraido', 'estado']
        doc.save(update_fields=campos_a_actualizar)
        
    except Documento.DoesNotExist:
        logger.error(f"Documento {documento_id} no encontrado para procesamiento.")
    except Exception as e:
        logger.error(f"Error procesando documento {documento_id}: {e}", exc_info=True)
        try:
            # Intentar guardar el estado de error
            doc = Documento.objects.get(id=documento_id)
            doc.estado = 'error_procesamiento'
            doc.save(update_fields=['estado'])
        except Exception as e_inner:
            logger.error(f"Error crítico al actualizar estado de fallo del documento {documento_id}: {e_inner}", exc_info=True)

"""
Servicio de OCR independiente.
FASE 3: Extrae texto de imágenes y PDFs usando Tesseract.
La lógica está en un servicio para mantener las vistas limpias y poder reutilizar/testear.
"""
import io
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


def _configurar_tesseract():
    """Configura la ruta de Tesseract si está definida en Django settings."""
    try:
        from django.conf import settings
        cmd = getattr(settings, 'TESSERACT_CMD', None)
        if cmd:
            import pytesseract
            pytesseract.pytesseract.tesseract_cmd = cmd
    except Exception as e:
        logger.error("Error al configurar tesseract: %s", e, exc_info=True)


def extraer_texto_ocr(ruta_archivo: str) -> str:
    """
    Extrae texto de un archivo (imagen o PDF) usando Tesseract OCR.
    
    :param ruta_archivo: Ruta absoluta al archivo en disco.
    :return: Texto extraído o cadena vacía si falla o no hay texto.
    """
    if not ruta_archivo or not os.path.isfile(ruta_archivo):
        return ""

    ext = Path(ruta_archivo).suffix.lower()

    try:
        if ext == ".pdf":
            return _ocr_pdf(ruta_archivo)
        return _ocr_imagen(ruta_archivo)
    except Exception as e:
        logger.error("OCR falló para %s: %s", ruta_archivo, e, exc_info=True)
        raise e


def _ocr_imagen(ruta_archivo: str) -> str:
    """Extrae texto de una imagen con pytesseract."""
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        logger.warning("pytesseract o Pillow no instalados; OCR no disponible.")
        return ""

    _configurar_tesseract()
    try:
        img = Image.open(ruta_archivo)
        # Convertir a RGB si es necesario (ej. PNG con transparencia)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        texto = pytesseract.image_to_string(img, lang="spa+eng")
        return (texto or "").strip()
    except Exception as e:
        logger.error("OCR imagen falló: %s", e, exc_info=True)
        raise e


def _ocr_pdf(ruta_archivo: str) -> str:
    """Convierte cada página del PDF a imagen y extrae texto con Tesseract."""
    try:
        import fitz  # PyMuPDF
        import pytesseract
        from PIL import Image
    except ImportError:
        logger.warning("PyMuPDF, pytesseract o Pillow no instalados; OCR PDF no disponible.")
        return ""

    _configurar_tesseract()
    textos = []
    try:
        doc = fitz.open(ruta_archivo)
        for num in range(len(doc)):
            page = doc.load_page(num)
            pix = page.get_pixmap(dpi=150)
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            texto = pytesseract.image_to_string(img, lang="spa+eng")
            if texto and texto.strip():
                textos.append(texto.strip())
        doc.close()
        return "\n\n".join(textos) if textos else ""
    except Exception as e:
        logger.error("OCR PDF falló: %s", e, exc_info=True)
        raise e

import os

import pypdfium2 as pdfium
import torch
from PIL import Image

try:
    from transformers import LightOnOcrForConditionalGeneration, LightOnOcrProcessor
except ImportError:
    LightOnOcrForConditionalGeneration = None
    LightOnOcrProcessor = None

MODEL_ID = "lightonai/LightOnOCR-2-1B"
OCR_DPI = int(os.getenv("OCR_DPI", 200))
OCR_MAX_NEW_TOKENS = int(os.getenv("OCR_MAX_NEW_TOKENS", 2048))
OCR_FALLBACK_THRESHOLD = int(os.getenv("OCR_FALLBACK_THRESHOLD", 150))

_model = None
_processor = None


def _lighton_ocr_available() -> bool:
    return LightOnOcrForConditionalGeneration is not None and LightOnOcrProcessor is not None


def get_model():
    """
    Lazy-load LightOnOCR-2-1B once and cache in module globals.
    Never called at import time — only on first extraction request.
    Returns (model, processor, device).
    device = "cuda" if available, else "cpu"
    dtype  = torch.bfloat16 on CUDA, torch.float32 on CPU
    """
    global _model, _processor

    if not _lighton_ocr_available():
        raise RuntimeError(
            "LightOnOCR is not available in this environment."
        )

    if _model is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.bfloat16 if device == "cuda" else torch.float32
        _model = LightOnOcrForConditionalGeneration.from_pretrained(
            MODEL_ID, torch_dtype=dtype
        ).to(device)
        _processor = LightOnOcrProcessor.from_pretrained(MODEL_ID)

    device = next(_model.parameters()).device
    return _model, _processor, device


def pdf_to_images(pdf_bytes: bytes) -> list[Image.Image]:
    """
    Render every page of a PDF to a PIL Image.
    scale = OCR_DPI / 72
    Use pypdfium2.PdfDocument(pdf_bytes) to open.
    Iterate all pages: page.render(scale=scale).to_pil()
    Return list of PIL Images.
    """
    scale = OCR_DPI / 72
    doc = pdfium.PdfDocument(pdf_bytes)
    images: list[Image.Image] = []

    for page_index in range(len(doc)):
        page = doc[page_index]
        bitmap = page.render(scale=scale)
        images.append(bitmap.to_pil())

    return images


def ocr_images(images: list[Image.Image]) -> str:
    """
    Run LightOnOCR-2-1B on each page image.
    Return all page texts joined by "\n\n".
    """
    model, processor, device = get_model()
    dtype = next(model.parameters()).dtype
    results: list[str] = []

    for img in images:
        conversation = [{"role": "user", "content": [{"type": "image", "image": img}]}]
        inputs = processor.apply_chat_template(
            conversation,
            add_generation_prompt=True,
            tokenize=True,
            return_dict=True,
            return_tensors="pt",
        )

        for key, value in inputs.items():
            if torch.is_tensor(value):
                if torch.is_floating_point(value):
                    inputs[key] = value.to(device=device, dtype=dtype)
                else:
                    inputs[key] = value.to(device=device)

        with torch.inference_mode():
            out = model.generate(**inputs, max_new_tokens=OCR_MAX_NEW_TOKENS)

        generated_ids = out[0, inputs["input_ids"].shape[1] :]
        text = processor.decode(generated_ids, skip_special_tokens=True)
        results.append(text)

    return "\n\n".join(results)


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Hybrid extraction strategy:
    1. Try pypdfium2 text layer first.
    2. If extracted text is too short, fall back to OCR.
    3. Return final clean text.
    """
    doc = pdfium.PdfDocument(pdf_bytes)
    digital_pages: list[str] = []

    for page_index in range(len(doc)):
        page = doc[page_index]
        text_page = page.get_textpage()
        digital_pages.append(text_page.get_text_range())

    digital_text = "\n".join(digital_pages).strip()
    if len(digital_text) >= OCR_FALLBACK_THRESHOLD:
        return digital_text

    if not _lighton_ocr_available():
        return digital_text

    images = pdf_to_images(pdf_bytes)
    ocr_text = ocr_images(images)
    return ocr_text.strip()

"""
Vision Analyzer – Moondream integration via Ollama.
Provides image analysis for damage documentation, invoice OCR, and construction site photos.
"""

from __future__ import annotations

import base64
import logging
import os
from typing import Optional

import httpx
from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vision", tags=["Vision AI"])

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
VISION_MODEL = os.getenv("VISION_MODEL", "moondream")
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class VisionAnalysisResponse(BaseModel):
    description: str = Field(..., description="AI-generated description of the image")
    model: str = Field(..., description="Model used for analysis")
    eval_duration_ms: int = Field(0, description="Inference time in milliseconds")


class VisionError(BaseModel):
    error: str
    detail: Optional[str] = None


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

PROMPTS = {
    "damage": (
        "Du bist ein Gutachter. Beschreibe den sichtbaren Schaden im Bild detailliert auf Deutsch. "
        "Nenne Art des Schadens, betroffene Materialien, geschätztes Ausmaß und empfohlene Maßnahmen."
    ),
    "invoice": (
        "Extrahiere alle relevanten Daten aus dieser Rechnung/diesem Lieferschein auf Deutsch: "
        "Rechnungsnummer, Datum, Absender, Empfänger, Einzelpositionen mit Menge und Preis, "
        "Nettobetrag, MwSt, Bruttobetrag. Gib die Daten strukturiert zurück."
    ),
    "construction": (
        "Beschreibe den Baustellenfortschritt im Bild auf Deutsch. "
        "Nenne sichtbare Arbeiten, verwendete Materialien, Zustand und mögliche Mängel."
    ),
    "general": "Beschreibe was du im Bild siehst, auf Deutsch. Sei präzise und detailliert.",
}


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post("/analyze", response_model=VisionAnalysisResponse)
async def analyze_image(
    image: UploadFile = File(..., description="Image to analyze (JPEG, PNG, WebP)"),
    mode: str = Form("general", description="Analysis mode: general, damage, invoice, construction"),
    custom_prompt: Optional[str] = Form(None, description="Custom prompt (overrides mode)"),
):
    """Analyze an image using Moondream vision model via Ollama."""

    content = await image.read()
    if len(content) > MAX_IMAGE_SIZE:
        return VisionError(error="Image too large", detail=f"Max {MAX_IMAGE_SIZE // (1024*1024)} MB")

    image_b64 = base64.b64encode(content).decode("utf-8")
    prompt = custom_prompt or PROMPTS.get(mode, PROMPTS["general"])

    logger.info(f"Vision analysis: mode={mode}, size={len(content)//1024}KB, model={VISION_MODEL}")

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": VISION_MODEL,
                "prompt": prompt,
                "images": [image_b64],
                "stream": False,
            },
        )

    if resp.status_code != 200:
        logger.error(f"Ollama error: {resp.status_code} {resp.text[:200]}")
        return VisionError(error="Vision model unavailable", detail=resp.text[:200])

    data = resp.json()
    eval_ms = int(data.get("eval_duration", 0) / 1e6)

    logger.info(f"Vision analysis complete: {eval_ms}ms")

    return VisionAnalysisResponse(
        description=data.get("response", ""),
        model=VISION_MODEL,
        eval_duration_ms=eval_ms,
    )


@router.get("/models")
async def list_vision_models():
    """List available vision models from Ollama."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")

    if resp.status_code != 200:
        return {"error": "Ollama not reachable"}

    models = resp.json().get("models", [])
    return {
        "models": [
            {"name": m["name"], "size_gb": round(m["size"] / 1e9, 1)}
            for m in models
        ]
    }

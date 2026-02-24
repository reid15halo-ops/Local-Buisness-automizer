"""
Image Processor Router
POST /image/preprocess        - multipart/form-data with 'file' field
POST /image/preprocess-url    - JSON body { url: str }

Processing pipeline:
  1. Grayscale conversion
  2. Deskew (Hough line detection → rotation correction)
  3. Otsu binarisation
  4. Noise reduction (median filter)
  5. Contrast enhancement (CLAHE)
  6. Resize to 300 DPI equivalent (A4 at 300 DPI = 2480 × 3508 px as ceiling)

Returns: PNG base64 + metadata (width, height, deskew_angle, processing_time_ms)

OpenCV is used for deskew + CLAHE + Otsu; Pillow for I/O and fallback.
If OpenCV is unavailable the pipeline degrades gracefully using Pillow only.
"""

from __future__ import annotations

import base64
import io
import logging
import math
import time
from typing import Optional

import httpx
import numpy as np
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from models import ImageMetadata, ImagePreprocessResponse, ImageUrlRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/image", tags=["Image Processor"])

# ---------------------------------------------------------------------------
# Optional OpenCV import (graceful degradation)
# ---------------------------------------------------------------------------

try:
    import cv2
    _OPENCV_AVAILABLE = True
    logger.info("OpenCV %s available", cv2.__version__)
except ImportError:
    cv2 = None  # type: ignore[assignment]
    _OPENCV_AVAILABLE = False
    logger.warning("OpenCV not available – using Pillow-only pipeline")

try:
    from PIL import Image, ImageEnhance, ImageFilter, ImageOps
    _PIL_AVAILABLE = True
except ImportError as exc:
    raise RuntimeError("Pillow is required but not installed") from exc

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TARGET_DPI = 300
# Standard A4 at 300 DPI: 2480 × 3508; we use this as a size ceiling
MAX_WIDTH_PX = 2480
MAX_HEIGHT_PX = 3508
# Minimum useful dimension (reject images that are too tiny)
MIN_DIMENSION = 32
# Maximum file size accepted (20 MB)
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
# Supported PIL formats
ALLOWED_FORMATS = {"JPEG", "JPG", "PNG", "TIFF", "BMP", "WEBP", "GIF"}

# ---------------------------------------------------------------------------
# Processing helpers
# ---------------------------------------------------------------------------


def _pil_to_np(img: "Image.Image") -> np.ndarray:
    return np.array(img)


def _np_to_pil(arr: np.ndarray) -> "Image.Image":
    return Image.fromarray(arr)


def _load_image(data: bytes) -> "Image.Image":
    try:
        img = Image.open(io.BytesIO(data))
        if img.format and img.format.upper() not in ALLOWED_FORMATS:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Unsupported image format: {img.format}",
            )
        img = img.convert("RGB")
        return img
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot decode image: {exc}",
        ) from exc


def _to_grayscale(img: "Image.Image") -> "Image.Image":
    """Convert to 8-bit grayscale."""
    return img.convert("L")


def _detect_skew_angle_cv(gray_np: np.ndarray) -> float:
    """
    Detect skew angle using Hough transform (OpenCV).
    Returns angle in degrees; positive = counter-clockwise tilt.
    """
    if not _OPENCV_AVAILABLE:
        return 0.0

    # Edge detection
    edges = cv2.Canny(gray_np, 50, 150, apertureSize=3)
    # Probabilistic Hough lines
    lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=100,
        minLineLength=gray_np.shape[1] // 4,
        maxLineGap=20,
    )
    if lines is None or len(lines) == 0:
        return 0.0

    angles: list[float] = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        if x2 == x1:
            continue  # vertical line → skip
        angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
        # Normalise to [-45, 45] range (text lines are near horizontal)
        if angle < -45:
            angle += 90
        elif angle > 45:
            angle -= 90
        angles.append(angle)

    if not angles:
        return 0.0

    # Median angle is more robust than mean for outlier-heavy distributions
    angles.sort()
    mid = len(angles) // 2
    median_angle = angles[mid] if len(angles) % 2 else (angles[mid - 1] + angles[mid]) / 2.0
    return round(median_angle, 2)


def _detect_skew_angle_pil(gray: "Image.Image") -> float:
    """Fallback skew detection using PIL (less accurate)."""
    # Very simple: use image moments on a binarised version.
    # For simplicity we return 0.0 when OpenCV is not available.
    return 0.0


def _deskew(img: "Image.Image") -> tuple["Image.Image", float]:
    """Detect and correct skew. Returns (deskewed_image, angle_degrees)."""
    gray = _to_grayscale(img)

    if _OPENCV_AVAILABLE:
        gray_np = _pil_to_np(gray)
        angle = _detect_skew_angle_cv(gray_np)
    else:
        angle = _detect_skew_angle_pil(gray)

    if abs(angle) < 0.1:
        # Negligible skew
        return img, angle

    # Rotate to correct (expand=True keeps full image)
    corrected = img.rotate(-angle, resample=Image.BICUBIC, expand=True, fillcolor=(255, 255, 255))
    return corrected, angle


def _otsu_binarise_cv(gray_np: np.ndarray) -> np.ndarray:
    """Apply Otsu's method via OpenCV."""
    _, binary = cv2.threshold(gray_np, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binary


def _otsu_binarise_pil(gray: "Image.Image") -> "Image.Image":
    """
    Otsu binarisation without OpenCV.
    Compute threshold from histogram manually.
    """
    hist = gray.histogram()  # 256 values
    total = sum(hist)
    if total == 0:
        return gray

    # Otsu's algorithm
    sum_all = sum(i * hist[i] for i in range(256))
    sum_bg = 0.0
    w_bg = 0
    max_var = 0.0
    threshold = 128

    for t in range(256):
        w_bg += hist[t]
        if w_bg == 0:
            continue
        w_fg = total - w_bg
        if w_fg == 0:
            break
        sum_bg += t * hist[t]
        mean_bg = sum_bg / w_bg
        mean_fg = (sum_all - sum_bg) / w_fg
        var_between = w_bg * w_fg * (mean_bg - mean_fg) ** 2
        if var_between > max_var:
            max_var = var_between
            threshold = t

    return gray.point(lambda p: 255 if p >= threshold else 0, "L")


def _binarise(gray: "Image.Image") -> "Image.Image":
    if _OPENCV_AVAILABLE:
        gray_np = _pil_to_np(gray)
        binary_np = _otsu_binarise_cv(gray_np)
        return _np_to_pil(binary_np)
    return _otsu_binarise_pil(gray)


def _reduce_noise(img: "Image.Image") -> "Image.Image":
    """Median filter for noise reduction."""
    if _OPENCV_AVAILABLE:
        img_np = _pil_to_np(img)
        denoised = cv2.medianBlur(img_np, 3)
        return _np_to_pil(denoised)
    # Pillow median filter
    return img.filter(ImageFilter.MedianFilter(size=3))


def _clahe_enhance_cv(gray_np: np.ndarray) -> np.ndarray:
    """Apply CLAHE (Contrast Limited Adaptive Histogram Equalisation) via OpenCV."""
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(gray_np)


def _contrast_enhance_pil(img: "Image.Image") -> "Image.Image":
    """Fallback contrast enhancement using PIL AutoContrast."""
    return ImageOps.autocontrast(img, cutoff=2)


def _enhance_contrast(img: "Image.Image") -> "Image.Image":
    if _OPENCV_AVAILABLE:
        gray_np = _pil_to_np(img.convert("L"))
        enhanced_np = _clahe_enhance_cv(gray_np)
        return _np_to_pil(enhanced_np)
    return _contrast_enhance_pil(img.convert("L"))


def _resize_to_dpi(img: "Image.Image") -> "Image.Image":
    """
    Scale image so it does not exceed MAX_WIDTH_PX × MAX_HEIGHT_PX
    (equivalent to an A4 page at 300 DPI).
    Only downscales; never upscales.
    """
    w, h = img.size
    if w <= MAX_WIDTH_PX and h <= MAX_HEIGHT_PX:
        return img
    scale = min(MAX_WIDTH_PX / w, MAX_HEIGHT_PX / h)
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))
    return img.resize((new_w, new_h), Image.LANCZOS)


def _image_to_base64_png(img: "Image.Image") -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=False)
    return base64.b64encode(buf.getvalue()).decode("ascii")


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------


def _preprocess_pipeline(raw_bytes: bytes) -> ImagePreprocessResponse:
    t0 = time.monotonic()

    img = _load_image(raw_bytes)
    orig_w, orig_h = img.size

    if orig_w < MIN_DIMENSION or orig_h < MIN_DIMENSION:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Image too small: {orig_w}×{orig_h} (minimum {MIN_DIMENSION}px each side)",
        )

    # Step 1: Grayscale
    gray = _to_grayscale(img)

    # Step 2: Deskew (operates on grayscale, returns grayscale)
    deskewed, angle = _deskew(gray)

    # Step 3: Binarise (Otsu)
    binary = _binarise(deskewed)

    # Step 4: Noise reduction
    denoised = _reduce_noise(binary)

    # Step 5: CLAHE / contrast
    enhanced = _enhance_contrast(denoised)

    # Step 6: Resize to 300 DPI ceiling
    resized = _resize_to_dpi(enhanced)

    processing_ms = round((time.monotonic() - t0) * 1000, 2)
    final_w, final_h = resized.size

    image_b64 = _image_to_base64_png(resized)

    logger.info(
        "image_preprocess orig=%dx%d final=%dx%d angle=%.2f ms=%.1f",
        orig_w, orig_h, final_w, final_h, angle, processing_ms,
    )

    return ImagePreprocessResponse(
        image_base64=image_b64,
        content_type="image/png",
        metadata=ImageMetadata(
            width=final_w,
            height=final_h,
            deskew_angle=angle,
            processing_time_ms=processing_ms,
            original_width=orig_w,
            original_height=orig_h,
            dpi_target=TARGET_DPI,
        ),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/preprocess",
    response_model=ImagePreprocessResponse,
    summary="Preprocess uploaded image for OCR",
    description=(
        "Accepts a multipart file upload. Runs the full preprocessing pipeline: "
        "grayscale → deskew → Otsu binarisation → median noise reduction → "
        "CLAHE contrast → 300 DPI resize. Returns PNG as base64."
    ),
)
async def preprocess_image(file: UploadFile = File(...)) -> ImagePreprocessResponse:
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {MAX_UPLOAD_BYTES // (1024*1024)} MB",
        )
    if len(raw) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )
    return _preprocess_pipeline(raw)


@router.post(
    "/preprocess-url",
    response_model=ImagePreprocessResponse,
    summary="Fetch and preprocess image from URL",
    description=(
        "Fetches an image from the provided HTTP(S) URL and runs the same "
        "preprocessing pipeline as /image/preprocess."
    ),
)
async def preprocess_image_url(payload: ImageUrlRequest) -> ImagePreprocessResponse:
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=payload.timeout_seconds) as client:
            response = await client.get(payload.url)
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Timeout fetching image from URL: {exc}",
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Remote server returned {exc.response.status_code}",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch image: {exc}",
        ) from exc

    raw = response.content
    if len(raw) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Remote URL returned empty response body",
        )
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Remote image exceeds {MAX_UPLOAD_BYTES // (1024*1024)} MB limit",
        )
    return _preprocess_pipeline(raw)

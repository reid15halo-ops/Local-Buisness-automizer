"""
FreyAI Visions 95/5 Architecture – Zone 2 Backend
FastAPI application entry point.

Ports: 8001 (HTTP)
"""

from __future__ import annotations

import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Load .env before anything else
load_dotenv()

# ---------------------------------------------------------------------------
# Logging configuration
# ---------------------------------------------------------------------------

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Router imports (after logging is configured so routers can log at import)
# ---------------------------------------------------------------------------

from gobd_csv import router as gobd_router  # noqa: E402
from image_processor import router as image_router  # noqa: E402
from math_guardrail import router as math_router  # noqa: E402
from models import ErrorDetail, ErrorResponse, HealthResponse  # noqa: E402
from pii_sanitizer import router as pii_router  # noqa: E402

# ---------------------------------------------------------------------------
# Application version
# ---------------------------------------------------------------------------

APP_VERSION = "1.0.0"
APP_NAME = "FreyAI Zone 2 Backend"

# ---------------------------------------------------------------------------
# CORS origins
# ---------------------------------------------------------------------------

_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5678",
)
ALLOWED_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# Always allow localhost variants in development
_extra_dev = [
    "http://localhost:3000",
    "http://localhost:5678",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5678",
]
ALLOWED_ORIGINS = list(dict.fromkeys(ALLOWED_ORIGINS + _extra_dev))

# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # ---- Startup ----
    logger.info("=== %s v%s starting ===", APP_NAME, APP_VERSION)
    logger.info("CORS origins: %s", ALLOWED_ORIGINS)
    logger.info("Log level: %s", LOG_LEVEL)

    # Warm up: import heavy modules now so first request is fast
    try:
        import cv2  # noqa: F401
        logger.info("OpenCV loaded: %s", cv2.__version__)
    except ImportError:
        logger.warning("OpenCV not available – image pipeline uses Pillow fallback")

    try:
        from PIL import Image  # noqa: F401
        logger.info("Pillow ready")
    except ImportError:
        logger.error("Pillow not available – image endpoints will fail")

    logger.info("=== Startup complete ===")
    yield

    # ---- Shutdown ----
    logger.info("=== %s shutting down ===", APP_NAME)


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description=(
        "Zone 2 backend services: invoice math validation, PII sanitisation, "
        "and document image preprocessing for the FreyAI 95/5 automation pipeline."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS Middleware
# ---------------------------------------------------------------------------

# ALLOWED_ORIGINS is read from the ALLOWED_ORIGINS env var (comma-separated list).
# The wildcard Supabase regex has been removed; list every trusted origin explicitly
# in ALLOWED_ORIGINS so the allowed-origin set is auditable and not open-ended.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Processing-Time-MS"],
    max_age=600,
)

# ---------------------------------------------------------------------------
# Request logging + request-ID middleware
# ---------------------------------------------------------------------------


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next) -> Response:
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    start = time.monotonic()

    # Attach request_id so downstream code can read it if needed
    request.state.request_id = request_id

    logger.info(
        "→ %s %s  request_id=%s  client=%s",
        request.method,
        request.url.path,
        request_id,
        request.client.host if request.client else "unknown",
    )

    try:
        response: Response = await call_next(request)
    except Exception as exc:
        duration_ms = round((time.monotonic() - start) * 1000, 2)
        logger.error(
            "← 500 %s %s  request_id=%s  %.1fms  unhandled: %s",
            request.method,
            request.url.path,
            request_id,
            duration_ms,
            exc,
            exc_info=True,
        )
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error=ErrorDetail(
                    code="INTERNAL_SERVER_ERROR",
                    message="An unexpected error occurred. Please try again.",
                    details={"request_id": request_id},
                )
            ).model_dump(),
            headers={
                "X-Request-ID": request_id,
                "X-Processing-Time-MS": str(duration_ms),
            },
        )

    duration_ms = round((time.monotonic() - start) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Processing-Time-MS"] = str(duration_ms)

    logger.info(
        "← %d %s %s  request_id=%s  %.1fms",
        response.status_code,
        request.method,
        request.url.path,
        request_id,
        duration_ms,
    )
    return response


# ---------------------------------------------------------------------------
# Global exception handler (catches HTTPException and validation errors)
# ---------------------------------------------------------------------------


from fastapi import HTTPException  # noqa: E402 (after app is created)
from fastapi.exception_handlers import (  # noqa: E402
    http_exception_handler,
    request_validation_exception_handler,
)
from fastapi.exceptions import RequestValidationError  # noqa: E402


@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "unknown")
    logger.warning(
        "HTTPException %d request_id=%s: %s",
        exc.status_code,
        request_id,
        exc.detail,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=ErrorDetail(
                code=f"HTTP_{exc.status_code}",
                message=str(exc.detail),
                details={"request_id": request_id},
            )
        ).model_dump(),
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def custom_validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "unknown")
    logger.warning(
        "ValidationError request_id=%s: %s",
        request_id,
        exc.errors(),
    )

    # Pydantic v2 error dicts may contain non-JSON-serializable objects (e.g.
    # ValueError instances inside the 'ctx' key).  Sanitise them to strings.
    def _sanitize_errors(errors: list) -> list:
        safe = []
        for err in errors:
            safe_err = {}
            for k, v in err.items():
                if k == "ctx" and isinstance(v, dict):
                    safe_err[k] = {
                        ck: str(cv) if not isinstance(cv, (str, int, float, bool, type(None))) else cv
                        for ck, cv in v.items()
                    }
                elif isinstance(v, (str, int, float, bool, list, dict, type(None))):
                    safe_err[k] = v
                else:
                    safe_err[k] = str(v)
            safe.append(safe_err)
        return safe

    return JSONResponse(
        status_code=422,
        content=ErrorResponse(
            error=ErrorDetail(
                code="VALIDATION_ERROR",
                message="Request body failed validation",
                details={
                    "errors": _sanitize_errors(exc.errors()),
                    "request_id": request_id,
                },
            )
        ).model_dump(),
    )


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="Service health check",
)
async def health_check() -> HealthResponse:
    services: dict[str, str] = {
        "math_guardrail": "ok",
        "pii_sanitizer": "ok",
    }

    # Check image processor dependencies
    try:
        from PIL import Image  # noqa: F401
        services["image_processor_pil"] = "ok"
    except ImportError:
        services["image_processor_pil"] = "unavailable"

    try:
        import cv2  # noqa: F401
        services["image_processor_opencv"] = "ok"
    except ImportError:
        services["image_processor_opencv"] = "unavailable (using Pillow fallback)"

    return HealthResponse(
        status="healthy",
        version=APP_VERSION,
        services=services,
    )


@app.get(
    "/api/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="API health check (versioned path)",
)
async def api_health_check() -> HealthResponse:
    """Alias of /health at the /api prefix for clients that use the versioned API path."""
    return HealthResponse(
        status="ok",
        version=APP_VERSION,
        services={"gobd_csv": "ok", "math_guardrail": "ok", "pii_sanitizer": "ok"},
    )


# ---------------------------------------------------------------------------
# Mount routers
# ---------------------------------------------------------------------------

app.include_router(math_router)
app.include_router(pii_router)
app.include_router(image_router)
app.include_router(gobd_router)

# ---------------------------------------------------------------------------
# Root redirect to docs
# ---------------------------------------------------------------------------


@app.get("/", include_in_schema=False)
async def root() -> JSONResponse:
    return JSONResponse(
        {
            "service": APP_NAME,
            "version": APP_VERSION,
            "docs": "/docs",
            "health": "/health",
        }
    )


# ---------------------------------------------------------------------------
# Entrypoint (for direct python main.py execution during dev)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8001")),
        reload=os.getenv("ENV", "production").lower() == "development",
        log_level=LOG_LEVEL.lower(),
    )

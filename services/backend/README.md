# FreyAI Zone 2 Backend Services

Python/FastAPI microservices that handle compute-intensive tasks for the 95/5
automation pipeline running on a Hetzner CPX31 VPS.

Port: **8001**

---

## Endpoints

### System

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Returns service status and dependency availability |
| GET | `/docs` | Swagger UI (interactive) |
| GET | `/redoc` | ReDoc API documentation |

---

### Math Guardrail  `/math`

#### `POST /math/validate`

Validates invoice arithmetic: checks that `netto × (1 + mwst_rate) ≈ brutto`
and that each line item's `qty × unit_price ≈ total`.

**Request body:**
```json
{
  "netto": 100.00,
  "mwst_rate": 0.19,
  "brutto": 119.00,
  "items": [
    { "qty": 2, "unit_price": 50.00, "total": 100.00 }
  ]
}
```

**Response:**
```json
{
  "valid": true,
  "confidence": 1.0,
  "traffic_light": "green",
  "corrected_brutto": 119.00,
  "stated_brutto": 119.00,
  "delta_brutto": 0.0,
  "errors": [],
  "warnings": [],
  "line_item_results": [...]
}
```

Traffic light thresholds:
- `green`: confidence ≥ 0.95
- `yellow`: 0.80 ≤ confidence < 0.95
- `red`: confidence < 0.80

---

### PII Sanitizer  `/pii`

#### `POST /pii/sanitize`

Detects and removes/masks/tokenises personally identifiable information using
regex patterns (no external NLP dependency).

Detected entity types: `IBAN`, `TAX_ID`, `PERSONAL_ID`, `EMAIL`, `PHONE`,
`DATE_OF_BIRTH`, `NAME`.

**Request body:**
```json
{
  "text": "Bitte überweisen Sie an DE12 5001 0517 0648 4898 90. Kontakt: max@example.de",
  "mode": "mask"
}
```

Modes: `mask` (replace with label), `remove` (delete), `tokenize` (replace
with unique token, reversible within the session).

**Response:**
```json
{
  "sanitized_text": "Bitte überweisen Sie an [IBAN REDACTED]. Kontakt: [EMAIL REDACTED]",
  "entities_found": [
    { "type": "IBAN", "original": "DE12 5001 0517 0648 4898 90",
      "replacement": "[IBAN REDACTED]", "start": 24, "end": 50 }
  ],
  "entity_count": 2,
  "mode_used": "mask"
}
```

**Extending with spaCy:** import `register_ner_backend` from `pii_sanitizer`
and pass a callable `(text: str) -> list[_Match]` to plug in a spaCy pipeline.

---

### Image Processor  `/image`

#### `POST /image/preprocess`

Accepts a multipart file upload (field name: `file`). Runs the full
preprocessing pipeline and returns a base64-encoded PNG.

**Pipeline steps:**
1. Grayscale conversion
2. Deskew (Hough line detection, rotates to correct tilt)
3. Otsu binarisation (adaptive thresholding)
4. Noise reduction (3×3 median filter)
5. CLAHE contrast enhancement
6. Resize to 300 DPI ceiling (A4: 2480×3508 px max)

**Response:**
```json
{
  "image_base64": "<base64-encoded PNG>",
  "content_type": "image/png",
  "metadata": {
    "width": 2480,
    "height": 3508,
    "deskew_angle": -1.5,
    "processing_time_ms": 312.4,
    "original_width": 3264,
    "original_height": 4896,
    "dpi_target": 300
  }
}
```

#### `POST /image/preprocess-url`

Same pipeline but fetches the image from a URL first.

**Request body:**
```json
{
  "url": "https://example.com/invoice.jpg",
  "timeout_seconds": 30
}
```

**Limits:** 20 MB max file size. OpenCV is used when available; Pillow is
used as fallback.

---

## Running Locally

### With Docker (recommended)

```bash
# Build
docker build -t freyai-zone2-backend ./services/backend

# Run
docker run -d \
  --name zone2-backend \
  -p 8001:8001 \
  --env-file services/backend/.env \
  freyai-zone2-backend
```

### Without Docker (development)

```bash
cd services/backend

# Create virtual environment
python3.11 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy and edit env
cp .env.example .env

# Run with auto-reload
ENV=development uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

The API is then available at `http://localhost:8001`.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:5678` | Comma-separated CORS origins |
| `N8N_SECRET_KEY` | — | Shared secret for n8n webhook validation |
| `LOG_LEVEL` | `INFO` | Python logging level |
| `ENV` | `production` | Set to `development` for uvicorn auto-reload |
| `PORT` | `8001` | Bind port |

---

## Architecture Notes

- All routers are registered with a path prefix (`/math`, `/pii`, `/image`).
- Every response carries `X-Request-ID` and `X-Processing-Time-MS` headers.
- CORS allows all `*.supabase.co` origins via regex in addition to the explicit
  list in `ALLOWED_ORIGINS`.
- The PII module exposes `register_ner_backend()` as an extension point for
  dropping in a spaCy NER model without changing the HTTP API.
- OpenCV (`opencv-python-headless`) is optional; the image pipeline degrades
  to Pillow-only if it is not installed.

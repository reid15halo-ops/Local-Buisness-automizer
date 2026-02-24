"""
PII Sanitizer Router
POST /pii/sanitize

Detects and sanitizes personally identifiable information from text using
regex patterns only (no spacy dependency). The module is structured so that
a spacy-based NER backend can be plugged in via the _ner_backend extension
point without changing the public API.

Supported entity types:
  IBAN         - German (DE + 20 digits) and generic IBAN
  TAX_ID       - German Steuernummer (various regional formats)
  PERSONAL_ID  - German Personalausweis / Reisepass numbers
  EMAIL        - RFC-5321-ish email addresses
  PHONE        - German phone numbers (+49, 0xxx formats)
  DATE_OF_BIRTH - Dates formatted as DD.MM.YYYY or YYYY-MM-DD with context
  NAME         - Heuristic: two or more consecutive capitalised words
"""

from __future__ import annotations

import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import Callable

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from models import (
    EntityFound,
    PiiSanitizeRequest,
    PiiSanitizeResponse,
    SanitizeMode,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pii", tags=["PII Sanitizer"])

# ---------------------------------------------------------------------------
# Internal match representation
# ---------------------------------------------------------------------------


@dataclass
class _Match:
    entity_type: str
    original: str
    start: int
    end: int
    replacement: str = field(default="", init=False)


# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

# German IBAN: DE + 2 check digits + 18 alphanumeric chars (22 total)
_RE_IBAN_DE = re.compile(
    r"\bDE\d{2}[ ]?\d{4}[ ]?\d{4}[ ]?\d{4}[ ]?\d{4}[ ]?\d{2}\b",
    re.IGNORECASE,
)

# Generic IBAN: 2 letters + 2 digits + up to 30 alphanumeric (grouped or not)
_RE_IBAN_GENERIC = re.compile(
    r"\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}[A-Z0-9]{0,4}\b",
    re.IGNORECASE,
)

# German Steuernummer formats (Bundesland-specific, 10-13 digits with / or space separators)
# Common: 12/345/67890  |  123/456/78901  |  1234567890  |  12 345 67890
_RE_TAX_ID_DE = re.compile(
    r"\b(?:\d{2,3}[/ ]\d{3}[/ ]\d{4,5}|\d{10,13})\b"
)

# German Personalausweis: letter + 8 digits + letter + 1 digit, or 9-char alphanumeric
_RE_PERSONAL_ID = re.compile(
    r"\b[A-Z][0-9]{8}[A-Z][0-9]\b|\b[A-Z]{1,2}[0-9]{6,9}\b",
    re.IGNORECASE,
)

# Email
_RE_EMAIL = re.compile(
    r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"
)

# German phone numbers
# +49 xxx xxxx xxxx  |  0xxx xxxxxxx  |  (0xxx) xxxxxxx
_RE_PHONE = re.compile(
    r"(?:\+49|0049)[\s\-]?(?:\(0\))?[\s\-]?\d{2,5}[\s\-]?\d{3,}[\s\-]?\d{0,4}"
    r"|(?:\(0\d{2,5}\)|0\d{2,5})[\s\-]?\d{3,}[\s\-]?\d{0,4}",
    re.IGNORECASE,
)

# Date of birth with context keyword (geburt / born / geb. / dob)
_RE_DOB = re.compile(
    r"(?:geb(?:oren|\.)?|born|dob|geburtsdatum)[:\s]+"
    r"(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}|\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})",
    re.IGNORECASE,
)

# Standalone date pattern (less aggressive – only flagged when near PII keywords)
_RE_DATE_STANDALONE = re.compile(
    r"\b\d{1,2}\.\d{1,2}\.\d{4}\b"
)

# Name heuristic: 2–4 consecutive Title-Case words, not all-caps abbreviations
_RE_NAME = re.compile(
    r"\b(?:[A-ZÜÄÖ][a-züäöß]{1,}(?:[-'][A-ZÜÄÖ][a-züäöß]+)?)"
    r"(?:\s+(?:[A-ZÜÄÖ][a-züäöß]{1,}(?:[-'][A-ZÜÄÖ][a-züäöß]+)?)){1,3}\b"
)

# ---------------------------------------------------------------------------
# Known German first / last name fragments to reduce false positives
# A very small allow-list is used to *exclude* common German nouns that
# happen to be capitalised at sentence starts.
# ---------------------------------------------------------------------------
_COMMON_GERMAN_NOUNS = {
    "Die", "Der", "Das", "Ein", "Eine", "Sehr", "Geehrte", "Geehrter",
    "Sehr Geehrte", "Mit", "Freundlichen", "Grüßen", "Bitte", "Vielen",
    "Dank", "Danke", "Herr", "Frau", "Dr", "Prof", "Str", "Straße",
    "GmbH", "AG", "KG", "OHG", "UG", "Gesellschaft", "Rechnung",
    "Datum", "Betreff", "Anlage", "Anhang",
}


def _is_likely_name(text: str) -> bool:
    words = text.split()
    if len(words) < 2:
        return False
    # Reject if any word is a known common noun
    for w in words:
        if w in _COMMON_GERMAN_NOUNS:
            return False
    return True


# ---------------------------------------------------------------------------
# Extension point for spacy NER (plug in later without API changes)
# ---------------------------------------------------------------------------

# Signature: (text: str) -> list[_Match]
_NerBackend = Callable[[str], list[_Match]]

_ner_backend: _NerBackend | None = None


def register_ner_backend(backend: _NerBackend) -> None:
    """Register an external NER backend (e.g. spacy). Thread-safe for read."""
    global _ner_backend
    _ner_backend = backend
    logger.info("NER backend registered: %s", backend)


# ---------------------------------------------------------------------------
# Core detection logic
# ---------------------------------------------------------------------------


def _detect_entities(text: str) -> list[_Match]:
    matches: list[_Match] = []
    seen_spans: list[tuple[int, int]] = []

    def _overlaps(start: int, end: int) -> bool:
        for s, e in seen_spans:
            if start < e and end > s:
                return True
        return False

    def _add(m: re.Match, entity_type: str, group: int = 0) -> None:
        start, end = m.start(group), m.end(group)
        text_slice = m.group(group)
        if _overlaps(start, end):
            return
        seen_spans.append((start, end))
        matches.append(_Match(entity_type=entity_type, original=text_slice, start=start, end=end))

    # Order matters: more specific patterns first to avoid overlap conflicts

    # IBAN (German before generic to avoid double hits)
    for m in _RE_IBAN_DE.finditer(text):
        _add(m, "IBAN")
    for m in _RE_IBAN_GENERIC.finditer(text):
        # Only add if not already covered
        if not _overlaps(m.start(), m.end()):
            _add(m, "IBAN")

    # Email (before phone to avoid partial overlap on +49 domains)
    for m in _RE_EMAIL.finditer(text):
        _add(m, "EMAIL")

    # Phone
    for m in _RE_PHONE.finditer(text):
        original = m.group(0).strip()
        if len(re.sub(r"\D", "", original)) >= 6:
            if not _overlaps(m.start(), m.end()):
                seen_spans.append((m.start(), m.end()))
                matches.append(_Match(entity_type="PHONE", original=original, start=m.start(), end=m.end()))

    # Date of birth (capture group 1 is the date part)
    for m in _RE_DOB.finditer(text):
        full_start = m.start()
        full_end = m.end()
        date_start = m.start(1)
        date_end = m.end(1)
        if not _overlaps(full_start, full_end):
            seen_spans.append((full_start, full_end))
            matches.append(_Match(entity_type="DATE_OF_BIRTH", original=m.group(0), start=full_start, end=full_end))

    # Tax ID – only match if surrounded by relevant context to cut false positives
    tax_context = re.compile(
        r"(?:steuer(?:nummer|nr|id)|tax[ _]?(?:id|number|nr)|st\.?-?nr\.?)"
        r"[\s:]*(\d[\d/ ]{8,14}\d)",
        re.IGNORECASE,
    )
    for m in tax_context.finditer(text):
        if not _overlaps(m.start(), m.end()):
            seen_spans.append((m.start(), m.end()))
            matches.append(_Match(entity_type="TAX_ID", original=m.group(0), start=m.start(), end=m.end()))

    # Personal ID – only with context
    pid_context = re.compile(
        r"(?:ausweis(?:nummer)?|personalausweis|reisepass|passport|id[- ]?(?:nr|number)?)"
        r"[\s:]*([A-Z][0-9]{8}[A-Z][0-9]|[A-Z]{1,2}[0-9]{6,9})",
        re.IGNORECASE,
    )
    for m in pid_context.finditer(text):
        if not _overlaps(m.start(), m.end()):
            seen_spans.append((m.start(), m.end()))
            matches.append(_Match(entity_type="PERSONAL_ID", original=m.group(0), start=m.start(), end=m.end()))

    # Names (heuristic, last to reduce false positives)
    for m in _RE_NAME.finditer(text):
        candidate = m.group(0)
        if _is_likely_name(candidate) and not _overlaps(m.start(), m.end()):
            seen_spans.append((m.start(), m.end()))
            matches.append(_Match(entity_type="NAME", original=candidate, start=m.start(), end=m.end()))

    # Optionally merge with spacy results
    if _ner_backend is not None:
        try:
            ner_results = _ner_backend(text)
            for nm in ner_results:
                if not _overlaps(nm.start, nm.end):
                    seen_spans.append((nm.start, nm.end))
                    matches.append(nm)
        except Exception as exc:
            logger.warning("NER backend error (falling back to regex): %s", exc)

    matches.sort(key=lambda x: x.start)
    return matches


# ---------------------------------------------------------------------------
# Replacement helpers
# ---------------------------------------------------------------------------

_ENTITY_MASKS: dict[str, str] = {
    "IBAN": "[IBAN REDACTED]",
    "TAX_ID": "[STEUERNUMMER REDACTED]",
    "PERSONAL_ID": "[AUSWEIS REDACTED]",
    "EMAIL": "[EMAIL REDACTED]",
    "PHONE": "[TELEFON REDACTED]",
    "DATE_OF_BIRTH": "[GEBURTSDATUM REDACTED]",
    "NAME": "[NAME REDACTED]",
}

_token_store: dict[str, str] = {}  # token → original (in-memory for session)


def _make_replacement(entity_type: str, original: str, mode: SanitizeMode) -> str:
    if mode == SanitizeMode.MASK:
        return _ENTITY_MASKS.get(entity_type, "[REDACTED]")
    if mode == SanitizeMode.REMOVE:
        return ""
    if mode == SanitizeMode.TOKENIZE:
        token = f"[{entity_type}_{uuid.uuid4().hex[:8].upper()}]"
        _token_store[token] = original
        return token
    return "[REDACTED]"


# ---------------------------------------------------------------------------
# Apply replacements (right-to-left to preserve offsets)
# ---------------------------------------------------------------------------


def _apply_replacements(text: str, matches: list[_Match]) -> str:
    result = list(text)
    for m in reversed(matches):
        result[m.start : m.end] = list(m.replacement)
    return "".join(result)


# ---------------------------------------------------------------------------
# Router endpoint
# ---------------------------------------------------------------------------


@router.post(
    "/sanitize",
    response_model=PiiSanitizeResponse,
    summary="Sanitize PII from text",
    description=(
        "Detects IBAN, tax IDs, personal IDs, emails, phone numbers, "
        "dates of birth, and names using regex patterns. Returns sanitized "
        "text and a list of detected entities."
    ),
)
async def sanitize_pii(payload: PiiSanitizeRequest) -> PiiSanitizeResponse:
    raw_matches = _detect_entities(payload.text)

    entities_found: list[EntityFound] = []
    for m in raw_matches:
        replacement = _make_replacement(m.entity_type, m.original, payload.mode)
        m.replacement = replacement
        entities_found.append(
            EntityFound(
                type=m.entity_type,
                original=m.original,
                replacement=replacement,
                start=m.start,
                end=m.end,
            )
        )

    sanitized = _apply_replacements(payload.text, raw_matches)

    logger.info(
        "pii_sanitize mode=%s length=%d entities=%d",
        payload.mode,
        len(payload.text),
        len(entities_found),
    )

    return PiiSanitizeResponse(
        sanitized_text=sanitized,
        entities_found=entities_found,
        entity_count=len(entities_found),
        mode_used=payload.mode,
    )

"""
Math Guardrail Router
POST /math/validate

Validates invoice arithmetic:
  - netto * (1 + mwst_rate) ≈ brutto
  - qty * unit_price ≈ item.total for each line item

Confidence score: 1.0 = perfect, decreases per error magnitude.
Traffic light: >= 0.95 green, 0.80-0.94 yellow, < 0.80 red.
"""

from __future__ import annotations

import logging
import math

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from models import (
    LineItem,
    LineItemResult,
    MathValidateRequest,
    MathValidateResponse,
    TrafficLight,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/math", tags=["Math Guardrail"])

# Tolerance for floating-point rounding on invoice amounts (EUR cents)
BRUTTO_TOLERANCE = 0.02
LINE_ITEM_TOLERANCE = 0.02


def _round2(v: float) -> float:
    """Round to 2 decimal places (EUR cents)."""
    return round(v, 2)


def _relative_error(stated: float, computed: float) -> float:
    """Relative error between two values; 0.0 if both are zero."""
    if computed == 0.0 and stated == 0.0:
        return 0.0
    if computed == 0.0:
        return 1.0
    return abs(stated - computed) / abs(computed)


def _traffic_light(confidence: float) -> TrafficLight:
    if confidence >= 0.95:
        return TrafficLight.GREEN
    if confidence >= 0.80:
        return TrafficLight.YELLOW
    return TrafficLight.RED


def _validate_line_items(
    items: list[LineItem],
    errors: list[str],
    warnings: list[str],
) -> tuple[list[LineItemResult], float]:
    """
    Validate each line item and return (results, penalty).
    penalty accumulates per bad line (0 = all good, 1 = all bad).
    """
    results: list[LineItemResult] = []
    penalty_sum = 0.0

    for idx, item in enumerate(items):
        computed = _round2(item.qty * item.unit_price)
        delta = _round2(item.total - computed)
        abs_delta = abs(delta)
        valid = abs_delta <= LINE_ITEM_TOLERANCE

        rel_err = _relative_error(item.total, computed)
        # Penalty: clamp relative error to [0, 1]
        penalty_sum += min(rel_err, 1.0)

        result = LineItemResult(
            index=idx,
            qty=item.qty,
            unit_price=item.unit_price,
            stated_total=item.total,
            computed_total=computed,
            delta=delta,
            valid=valid,
        )
        results.append(result)

        if not valid:
            msg = (
                f"Line item {idx}: {item.qty} × {item.unit_price} = {computed} "
                f"but stated {item.total} (Δ {delta:+.4f})"
            )
            if abs_delta > 1.0:
                errors.append(msg)
            else:
                warnings.append(msg)

    # Average penalty across items (0 items → 0 penalty)
    avg_penalty = penalty_sum / len(items) if items else 0.0
    return results, avg_penalty


@router.post(
    "/validate",
    response_model=MathValidateResponse,
    summary="Validate invoice arithmetic",
    description=(
        "Checks that netto × (1 + mwst_rate) ≈ brutto and that every "
        "line item total matches qty × unit_price. Returns a confidence "
        "score and traffic-light classification."
    ),
)
async def validate_math(payload: MathValidateRequest) -> MathValidateResponse:
    errors: list[str] = []
    warnings: list[str] = []

    # -----------------------------------------------------------------------
    # 1. Validate header totals
    # -----------------------------------------------------------------------
    computed_brutto = _round2(payload.netto * (1.0 + payload.mwst_rate))
    delta_brutto = _round2(payload.brutto - computed_brutto)
    abs_delta_brutto = abs(delta_brutto)
    header_valid = abs_delta_brutto <= BRUTTO_TOLERANCE

    if not header_valid:
        msg = (
            f"Brutto mismatch: {payload.netto} × (1 + {payload.mwst_rate}) "
            f"= {computed_brutto} but stated {payload.brutto} "
            f"(Δ {delta_brutto:+.4f})"
        )
        if abs_delta_brutto > 1.0:
            errors.append(msg)
        else:
            warnings.append(msg)

    # -----------------------------------------------------------------------
    # 2. Validate line items
    # -----------------------------------------------------------------------
    line_results, line_penalty = _validate_line_items(
        payload.items, errors, warnings
    )

    # -----------------------------------------------------------------------
    # 3. Validate that sum of line item totals ≈ netto (if items provided)
    # -----------------------------------------------------------------------
    if payload.items:
        sum_items = _round2(sum(i.total for i in payload.items))
        sum_delta = _round2(sum_items - payload.netto)
        if abs(sum_delta) > BRUTTO_TOLERANCE:
            msg = (
                f"Sum of line items ({sum_items}) does not match netto "
                f"({payload.netto}) (Δ {sum_delta:+.4f})"
            )
            if abs(sum_delta) > 1.0:
                errors.append(msg)
            else:
                warnings.append(msg)

    # -----------------------------------------------------------------------
    # 4. Confidence score
    # -----------------------------------------------------------------------
    # Start at 1.0, subtract penalties
    # Header mismatch: penalty proportional to relative error, capped at 0.5
    header_rel_err = _relative_error(payload.brutto, computed_brutto)
    header_penalty = min(header_rel_err, 0.5)

    # Line item penalty (already averaged, capped at 0.5)
    total_penalty = header_penalty * 0.5 + line_penalty * 0.5
    confidence = max(0.0, min(1.0, 1.0 - total_penalty))

    # Snap to 1.0 if everything is within tolerance
    if header_valid and all(r.valid for r in line_results):
        confidence = 1.0

    confidence = round(confidence, 4)

    overall_valid = len(errors) == 0

    logger.info(
        "math_validate netto=%.2f mwst=%.4f brutto=%.2f items=%d "
        "confidence=%.4f valid=%s",
        payload.netto,
        payload.mwst_rate,
        payload.brutto,
        len(payload.items),
        confidence,
        overall_valid,
    )

    return MathValidateResponse(
        valid=overall_valid,
        confidence=confidence,
        traffic_light=_traffic_light(confidence),
        corrected_brutto=computed_brutto,
        stated_brutto=payload.brutto,
        delta_brutto=delta_brutto,
        errors=errors,
        warnings=warnings,
        line_item_results=line_results,
    )

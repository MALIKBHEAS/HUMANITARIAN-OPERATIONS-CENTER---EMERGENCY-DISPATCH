"""
EOA Global - AI Decision Validation & Zero-Hallucination Guardrail
Applies deterministic safety rules to verify AI choices and raise ValueError on violations.
"""

from __future__ import annotations

import logging
from typing import Set

from eoa_global_backend.ai_engine.schemas import (
    AgencyType,
    AIResponse,
    IncidentCategory,
)

logger = logging.getLogger("eoa.ai.validator")


def validate_ai_decision(decision: AIResponse) -> AIResponse:
    """
    CRITICAL ZERO-HALLUCINATION VALIDATION LOGIC.
    
    Applies hardcoded public safety rules to catch and block AI hallucinations:
      Rule 1: If severity is 5, at least 2 distinct agencies MUST be dispatched.
      Rule 2: If category is Fire, CivilDefense MUST be in the dispatches.
      Rule 3: If casualties are reported (>0), Hospital MUST be in the dispatches.
      Rule 4: Unit allocation per agency must be realistic (1 <= required_units <= 50).
      Rule 5: Parsed location cannot be empty or whitespace.
      
    Raises:
        ValueError: If any validation rule is violated by the AI model.
    """
    category = decision.classification.category
    severity = decision.classification.severity_level
    dispatched_agencies: Set[str] = set(
        str(getattr(d.agency_type, "value", d.agency_type))
        for d in decision.dispatches
    )

    # -------------------------------------------------------------------------
    # RULE 1: Severity Level 5 Multi-Agency Mandate
    # "If severity is 5, at least 2 agencies must be dispatched"
    # -------------------------------------------------------------------------
    if severity == 5 and len(dispatched_agencies) < 2:
        error_msg = (
            f"Zero-Hallucination Rule Violation: Incident severity is catastrophic (5/5), "
            f"but only {len(dispatched_agencies)} agency ({list(dispatched_agencies)}) was ordered. "
            f"Protocol mandates at least 2 distinct agencies for Catastrophic Level 5 emergencies."
        )
        logger.error(f"[Validator Blocked] {error_msg}")
        raise ValueError(error_msg)

    # -------------------------------------------------------------------------
    # RULE 2: Fire Requires CivilDefense Mandate
    # "If category is Fire, CivilDefense MUST be in the dispatches"
    # -------------------------------------------------------------------------
    is_fire = (category == IncidentCategory.FIRE or category == "Fire")
    if is_fire and AgencyType.CIVIL_DEFENSE.value not in dispatched_agencies:
        error_msg = (
            f"Zero-Hallucination Rule Violation: Category is 'Fire', but CivilDefense was NOT included "
            f"in the dispatches ({list(dispatched_agencies)}). CivilDefense is mandatory for fire suppression."
        )
        logger.error(f"[Validator Blocked] {error_msg}")
        raise ValueError(error_msg)

    # -------------------------------------------------------------------------
    # RULE 3: Casualties Require Hospital Dispatch
    # -------------------------------------------------------------------------
    if decision.casualties_indicated > 0 and AgencyType.HOSPITAL.value not in dispatched_agencies:
        error_msg = (
            f"Zero-Hallucination Rule Violation: SOS reports {decision.casualties_indicated} casualties, "
            f"yet Hospital/Medical dispatch was omitted by the AI."
        )
        logger.error(f"[Validator Blocked] {error_msg}")
        raise ValueError(error_msg)

    # -------------------------------------------------------------------------
    # RULE 4: Resource Allocation Sane Bounds
    # -------------------------------------------------------------------------
    for dispatch in decision.dispatches:
        if dispatch.required_units < 1 or dispatch.required_units > 50:
            error_msg = (
                f"Zero-Hallucination Rule Violation: Agency '{dispatch.agency_type}' requested "
                f"{dispatch.required_units} units. Permissible mobilization per incident is 1 to 50."
            )
            logger.error(f"[Validator Blocked] {error_msg}")
            raise ValueError(error_msg)

    # -------------------------------------------------------------------------
    # RULE 5: Valid Physical Location
    # -------------------------------------------------------------------------
    if not decision.parsed_location or not decision.parsed_location.strip():
        error_msg = "Zero-Hallucination Rule Violation: Parsed location is empty."
        logger.error(f"[Validator Blocked] {error_msg}")
        raise ValueError(error_msg)

    logger.info(
        f"[Validator Passed] Category={category} | Severity={severity}/5 | "
        f"Agencies={list(dispatched_agencies)} | Location='{decision.parsed_location}'"
    )
    return decision

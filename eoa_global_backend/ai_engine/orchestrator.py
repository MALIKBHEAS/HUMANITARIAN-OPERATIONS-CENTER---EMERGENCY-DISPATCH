"""
EOA Global - Master AI Orchestrator Agent
Coordinates multilingual NLP parsing, zero-hallucination validation, and serialized multi-agency dispatch orders.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from eoa_global_backend.ai_engine.nlp_parser import sos_nlp_parser
from eoa_global_backend.ai_engine.schemas import (
    AgencyType,
    AIResponse,
    DispatchDecision,
    IncidentCategory,
)
from eoa_global_backend.ai_engine.validator import validate_ai_decision

logger = logging.getLogger("eoa.ai.orchestrator")


class AIOrchestratorEngine:
    """
    Cognitive Orchestrator decoupling the hybrid LLM parser from the message broker and WebSockets.
    """

    async def process_sos_event(
        self,
        raw_text: str,
        tenant_id: str,
        provider: Optional[str] = None,
        caller_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Master entry point for processing incoming SOS distress signals.
        
        Execution Pipeline:
          1. Parse raw multilingual text into rigid Pydantic schemas using pluggable LLM.
          2. Sanitize and strictly verify against hardcoded public safety rules.
          3. Apply deterministic overrides if minor safety omissions are caught.
          4. Return ready-to-broadcast serialized dispatch dictionary.
        """
        clean_text = raw_text.strip() if raw_text else ""
        if not clean_text:
            raise ValueError("SOS text cannot be empty.")
        if not tenant_id:
            raise ValueError("Tenant ID is required for multi-tenant AI dispatch.")

        logger.info(f"[AI Orchestrator] Ingesting SOS for tenant '{tenant_id}': '{clean_text[:70]}...'")

        # Step 1: Parse raw text via NLP Parser (OpenAI or Local Sovereign LLM)
        ai_response: AIResponse = await sos_nlp_parser.parse_sos_text(clean_text, provider=provider)

        # Step 2: Validate through Zero-Hallucination Guardrail
        try:
            validated_decision = validate_ai_decision(ai_response)
        except ValueError as exc:
            logger.warning(f"[AI Orchestrator] Guardrail rule triggered: {exc}. Applying safety override.")
            validated_decision = self._apply_safety_override(ai_response, str(exc))

        # Step 3: Serialize into standard dispatch plan dictionary
        dispatches_serialized: List[Dict[str, Any]] = [
            {
                "agency_type": str(getattr(d.agency_type, "value", d.agency_type)),
                "required_units": d.required_units,
                "reasoning": d.reasoning,
            }
            for d in validated_decision.dispatches
        ]
        
        agencies_list: List[str] = [d["agency_type"] for d in dispatches_serialized]
        total_units: int = sum(d["required_units"] for d in dispatches_serialized)

        dispatch_packet: Dict[str, Any] = {
            "type": "AI_ORCHESTRATED_DISPATCH_ORDER",
            "dispatch_id": f"disp-{str(uuid.uuid4())[:8]}",
            "tenant_id": tenant_id,
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "caller_metadata": caller_metadata or {},
            "parsed_location": validated_decision.parsed_location,
            "classification": {
                "category": str(getattr(validated_decision.classification.category, "value", validated_decision.classification.category)),
                "severity_level": validated_decision.classification.severity_level,
                "detected_language": validated_decision.classification.detected_language,
                "summary": validated_decision.classification.summary,
            },
            "dispatches": dispatches_serialized,
            "summary": {
                "primary_agency": agencies_list[0] if agencies_list else "CivilDefense",
                "co_dispatched_agencies": agencies_list,
                "total_units_mobilized": total_units,
                "casualties_reported": validated_decision.casualties_indicated,
            },
            "hallucination_guardrail": {
                "status": "VALIDATED_ZERO_HALLUCINATION",
                "rules_verified": [
                    "SEVERITY_5_DUAL_AGENCY_MANDATE",
                    "FIRE_MANDATORY_CIVIL_DEFENSE",
                    "CASUALTY_HOSPITAL_MOBILIZATION",
                    "RESOURCE_CAPACITY_BOUNDS",
                    "LOCATION_INTEGRITY",
                ],
            },
        }

        logger.info(
            f"[AI Orchestrator Certified] Tenant '{tenant_id}' -> "
            f"Category: {dispatch_packet['classification']['category']} | "
            f"Severity: {dispatch_packet['classification']['severity_level']}/5 | "
            f"Agencies: {agencies_list}"
        )

        return dispatch_packet

    def _apply_safety_override(self, decision: AIResponse, reason: str) -> AIResponse:
        """
        Deterministic safety override:
        Ensures safety-critical services (CivilDefense in fire, Hospital with casualties) are never
        omitted if the AI hallucinates or fails to allocate.
        """
        dispatched_agencies = set(
            str(getattr(d.agency_type, "value", d.agency_type))
            for d in decision.dispatches
        )
        updated_dispatches = list(decision.dispatches)

        # Override 1: Fire MUST have CivilDefense
        is_fire = (decision.classification.category == IncidentCategory.FIRE or decision.classification.category == "Fire")
        if is_fire and AgencyType.CIVIL_DEFENSE.value not in dispatched_agencies:
            updated_dispatches.append(DispatchDecision(
                agency_type=AgencyType.CIVIL_DEFENSE,
                required_units=3,
                reasoning="Safety Rule Override: Mandatory Civil Defense mobilization for fire suppression.",
            ))
            logger.info("[Safety Override] Added mandatory Civil Defense to fire dispatch.")

        # Override 2: Severity 5 requires at least 2 agencies
        if decision.classification.severity_level == 5 and len(updated_dispatches) < 2:
            secondary = AgencyType.POLICE if AgencyType.POLICE.value not in dispatched_agencies else AgencyType.CIVIL_DEFENSE
            updated_dispatches.append(DispatchDecision(
                agency_type=secondary,
                required_units=4,
                reasoning="Safety Rule Override: Severity 5 catastrophic emergency requires secondary containment.",
            ))
            logger.info(f"[Safety Override] Added secondary agency '{secondary.value}' for severity 5.")

        # Override 3: Casualties require Hospital
        if decision.casualties_indicated > 0 and AgencyType.HOSPITAL.value not in set(str(getattr(d.agency_type, "value", d.agency_type)) for d in updated_dispatches):
            updated_dispatches.append(DispatchDecision(
                agency_type=AgencyType.HOSPITAL,
                required_units=max(2, decision.casualties_indicated),
                reasoning=f"Safety Rule Override: Urgent medical dispatch for {decision.casualties_indicated} reported casualties.",
            ))
            logger.info("[Safety Override] Added Hospital dispatch for reported casualties.")

        decision.dispatches = updated_dispatches
        return validate_ai_decision(decision)


# Global singleton orchestrator instance
ai_orchestrator = AIOrchestratorEngine()

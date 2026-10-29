# EOA Global - AI Engine Worker Integration Guide

This guide details how to seamlessly wire the Phase 3 **AI Orchestrator Engine** (`eoa_global_backend/ai_engine/orchestrator.py`) into the Phase 2 **Emergency Consumer Worker** (`eoa_global_backend/workers/emergency_consumer.py`).

---

## 1. Overview of the Data Flow

```
[SOS HTTP / Webhook] 
       │
       ▼
[RabbitMQ / Redis Queue]  (Partitioned by tenant_id)
       │
       ▼
[EmergencyConsumerWorker] (workers/emergency_consumer.py)
       │
       ▼
[AI Orchestrator Engine]  (ai_engine/orchestrator.py)
  ├── 1. Multilingual LangChain NLP Parser (Arabic/English/etc.)
  ├── 2. Zero-Hallucination Guardrail Validator (5 Safety Rules)
  └── 3. Multi-Agency Dispatch Decision (Police, Hospital, Fire)
       │
       ▼
[WebSocket Broadcaster]   (api/websocket.py -> /ws/live-feed/{tenant_id})
```

---

## 2. Step-by-Step Code Integration

Open `eoa_global_backend/workers/emergency_consumer.py` and apply the following modifications:

### Step A: Import the AI Orchestrator

At the top of `emergency_consumer.py`, add:

```python
from eoa_global_backend.ai_engine.orchestrator import ai_orchestrator
```

### Step B: Connect `process_sos_event` inside `_process_event`

Replace the simulated delay in `_process_event` with the live cognitive orchestration call:

```python
    async def _process_event(self, event: Dict[str, Any]) -> None:
        event_id = event.get("event_id", "unknown-event")
        tenant_id = event.get("tenant_id")
        incident_data = event.get("data", {})

        if not tenant_id:
            logger.error(f"[{self.worker_id}] Dropping corrupted event without tenant_id: {event_id}")
            return

        logger.info(f"[{self.worker_id}] >>> INGESTED SOS: event_id={event_id} | tenant={tenant_id}")

        # ---------------------------------------------------------------------
        # PHASE 3 COGNITIVE AI ORCHESTRATION LAYER:
        # Multilingual parsing, zero-hallucination verification, and multi-agency dispatch
        # ---------------------------------------------------------------------
        raw_text = incident_data.get("description") or incident_data.get("title", "Emergency Alert")
        
        try:
            # Execute multilingual parsing and rule verification
            ai_dispatch_order = await ai_orchestrator.process_sos_event(
                raw_text=raw_text,
                tenant_id=tenant_id,
                caller_metadata={
                    "event_id": event_id,
                    "reported_by": incident_data.get("reported_by"),
                    "latitude": incident_data.get("latitude"),
                    "longitude": incident_data.get("longitude"),
                }
            )
            # Embed raw incident data for frontend UI mapping
            ai_dispatch_order["raw_incident"] = incident_data
            broadcast_payload = ai_dispatch_order

        except Exception as exc:
            logger.error(f"[{self.worker_id}] AI Orchestration error: {exc}", exc_info=True)
            # Fallback safe emergency payload
            broadcast_payload = {
                "type": "EMERGENCY_DISPATCH_FALLBACK",
                "event_id": event_id,
                "tenant_id": tenant_id,
                "status": "MANUAL_DISPATCH_REQUIRED",
                "error": str(exc),
                "incident": incident_data,
            }

        # ---------------------------------------------------------------------
        # CRITICAL MULTI-TENANT BROADCAST:
        # Pushes ONLY to this tenant's isolated WebSocket subscribers.
        # A dispatcher in Tokyo NEVER receives a frame for Palestine.
        # ---------------------------------------------------------------------
        await broadcast_tenant_event(tenant_id, broadcast_payload)
        logger.info(f"[{self.worker_id}] <<< DISPATCHED to Tenant [{tenant_id}] WebSocket Feed (event_id={event_id})")
```

---

## 3. What the Frontend Dashboard Receives

The connected frontend operator on `ws://.../ws/live-feed/{tenant_id}` will instantly receive the structured dispatch order in real-time:

```json
{
  "type": "AI_ORCHESTRATED_DISPATCH_ORDER",
  "dispatch_id": "disp-a8f12c49",
  "tenant_id": "palestine-rcs",
  "processed_at": "2026-10-27T17:55:00Z",
  "classification": {
    "category": "Fire",
    "severity_level": 4,
    "detected_language": "Arabic",
    "english_summary": "Major fire outbreak in residential structure with multiple persons trapped and smoke inhalation risk."
  },
  "location": {
    "address_or_landmark": "شارع عمر المختار قرب برج الشفاء",
    "city_or_region": "Central Operational Jurisdiction",
    "latitude": 31.5125,
    "longitude": 34.4533,
    "confidence": 0.95
  },
  "tactical_dispatches": [
    {
      "agency_type": "Fire",
      "units": 4,
      "priority": "CODE_RED",
      "reasoning": "Active structural fire requires immediate 4-engine suppression and ladder rescue operations."
    },
    {
      "agency_type": "Hospital",
      "units": 3,
      "priority": "PRIORITY_1",
      "reasoning": "Mandatory co-dispatch rule: Mobile trauma ambulances stationed for burns and inhalation triage."
    }
  ],
  "tactical_summary": {
    "primary_agency": "Fire",
    "co_dispatched_agencies": ["Fire", "Hospital"],
    "total_units_mobilized": 7,
    "casualties_reported": 2,
    "hazards_identified": ["Explosion Risk", "Gas Leak Hazmat"]
  },
  "hallucination_guardrail": {
    "status": "PASSED_AND_CERTIFIED",
    "rules_verified": [
      "SEVERITY_5_DUAL_AGENCY_MANDATE",
      "MASSIVE_FIRE_MEDICAL_CO_DISPATCH",
      "CASUALTY_AMBULANCE_REQUISITION",
      "RESOURCE_CAPACITY_BOUNDS",
      "GEOSPATIAL_RANGE_SANITY"
    ]
  }
}
```

"""
EOA Global - Asynchronous Emergency Stream Consumer Worker
Consumes incoming SOS queues, coordinates async processing, and triggers tenant-isolated WebSocket broadcasts.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from eoa_global_backend.core.broker import broker_manager
from eoa_global_backend.core.config import settings
from eoa_global_backend.services.event_stream import broadcast_tenant_event
from eoa_global_backend.ai_engine.orchestrator import ai_orchestrator

logger = logging.getLogger("eoa.consumer")


class EmergencyConsumerWorker:
    """
    High-throughput background consumer responsible for pulling unhandled SOS events
    from the broker, coordinating asynchronous triage, and pushing updates exclusively
    to the matching tenant's real-time WebSocket channel.
    """

    def __init__(self, worker_id: Optional[str] = None) -> None:
        self.worker_id: str = worker_id or f"worker-{str(uuid.uuid4())[:8]}"
        self._is_running: bool = False
        self._task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        """
        Starts the continuous worker loop.
        """
        self._is_running = True
        logger.info(f"[{self.worker_id}] Starting Emergency Queue Consumer...")
        queue_name = settings.EMERGENCY_QUEUE_PREFIX

        while self._is_running:
            try:
                broker = broker_manager.get_broker()
                # Non-blocking dequeue with timeout to permit clean cancellation
                event = await broker.dequeue(queue_name, timeout=1.0)
                if event:
                    await self._process_event(event)
                else:
                    # Idle tick
                    await asyncio.sleep(0.05)
            except asyncio.CancelledError:
                logger.info(f"[{self.worker_id}] Consumer task received shutdown signal.")
                break
            except Exception as exc:
                logger.error(f"[{self.worker_id}] Unexpected error in dequeue loop: {exc}", exc_info=True)
                await asyncio.sleep(1.0)

        logger.info(f"[{self.worker_id}] Emergency Queue Consumer stopped successfully.")

    async def _process_event(self, event: Dict[str, Any]) -> None:
        """
        Processes a single dequeued SOS event and triggers the tenant-isolated broadcast.
        """
        event_id = event.get("event_id", "unknown-event")
        tenant_id = event.get("tenant_id")
        incident_data = event.get("data", {})

        if not tenant_id:
            logger.error(f"[{self.worker_id}] Dropping corrupted event without tenant_id: {event_id}")
            return

        logger.info(
            f"[{self.worker_id}] >>> INGESTED SOS: event_id={event_id} | "
            f"tenant={tenant_id} | type={incident_data.get('incident_type', 'GENERAL')}"
        )

        # ---------------------------------------------------------------------
        # Phase 3: Cognitive AI Multi-Agency Dispatch Orchestration
        # Multilingual parsing, zero-hallucination verification & auto-dispatch
        # ---------------------------------------------------------------------
        raw_text = incident_data.get("description") or incident_data.get("title", "Emergency Alert")
        try:
            ai_dispatch_order = await ai_orchestrator.process_sos_event(
                raw_text=raw_text,
                tenant_id=tenant_id,
                caller_metadata={
                    "event_id": event_id,
                    "reported_by": incident_data.get("reported_by"),
                    "latitude": incident_data.get("latitude"),
                    "longitude": incident_data.get("longitude"),
                },
            )
            ai_dispatch_order["raw_incident"] = incident_data
            processed_payload = ai_dispatch_order
        except Exception as exc:
            logger.error(f"[{self.worker_id}] AI Orchestration error: {exc}", exc_info=True)
            processed_payload = {
                "type": "LIVE_INCIDENT_STREAM_UPDATE",
                "event_id": event_id,
                "tenant_id": tenant_id,
                "processed_by": self.worker_id,
                "status": "MANUAL_DISPATCH_REQUIRED",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "telemetry": {
                    "priority_level": incident_data.get("severity", "HIGH"),
                    "auto_dispatched": False,
                    "ai_agent_pipeline": "FALLBACK_MODE",
                },
                "incident": incident_data,
            }

        # ---------------------------------------------------------------------
        # CRITICAL MULTI-TENANT BROADCAST:
        # Pushes ONLY to this tenant's isolated WebSocket subscribers.
        # A dispatcher in Tokyo NEVER receives a frame for Palestine.
        # ---------------------------------------------------------------------
        await broadcast_tenant_event(tenant_id, processed_payload)
        logger.info(f"[{self.worker_id}] <<< DISPATCHED to Tenant [{tenant_id}] WebSocket Feed (event_id={event_id})")

    def stop(self) -> None:
        """Signals the worker loop to terminate."""
        self._is_running = False


# Global worker instance and lifecycle helper
consumer_worker = EmergencyConsumerWorker()
_worker_task: Optional[asyncio.Task] = None


async def start_background_consumer() -> asyncio.Task:
    """Spawns the background consumer as an asynchronous task."""
    global _worker_task
    _worker_task = asyncio.create_task(consumer_worker.start())
    return _worker_task


async def stop_background_consumer() -> None:
    """Gracefully terminates the background consumer task."""
    global _worker_task
    consumer_worker.stop()
    if _worker_task and not _worker_task.done():
        _worker_task.cancel()
        try:
            await _worker_task
        except asyncio.CancelledError:
            pass
        _worker_task = None

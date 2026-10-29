"""
EOA Global - Emergency Event Stream & Multi-Tenant Partitioning Service
Provides asynchronous ingestion of high-velocity SOS requests and real-time tenant event streams.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, Optional

from eoa_global_backend.core.broker import broker_manager
from eoa_global_backend.core.config import settings

logger = logging.getLogger("eoa.event_stream")


def get_tenant_queue_name(tenant_id: str) -> str:
    """
    Computes the partitioned durable queue name for a specific tenant agency.
    Example: 'eoa_sos_queue:fema-us' or 'eoa_sos_queue:interpol-hq'
    """
    clean_tenant = tenant_id.strip().lower()
    return f"{settings.EMERGENCY_QUEUE_PREFIX}:{clean_tenant}"


def get_tenant_broadcast_channel(tenant_id: str) -> str:
    """
    Computes the partitioned real-time Pub/Sub channel for WebSocket live streams.
    Example: 'eoa_live_channel:fema-us'
    """
    clean_tenant = tenant_id.strip().lower()
    return f"{settings.EMERGENCY_CHANNEL_PREFIX}:{clean_tenant}"


async def publish_incident(tenant_id: str, incident_data: Dict[str, Any]) -> str:
    """
    Ingests an incoming emergency SOS / Incident webhook into the distributed message queue.
    
    CRITICAL MULTI-TENANT ISOLATION:
    - Automatically partitions the event into the tenant's isolated queue.
    - Asynchronous and non-blocking: handles thousands of concurrent calls within milliseconds.
    - Embeds cryptographic tracing ID and metadata.
    
    Returns:
        event_id (str): Generated UUID tracking identifier.
    """
    if not tenant_id:
        raise ValueError("Tenant ID is required for incident event stream routing.")

    event_id = str(uuid.uuid4())
    now_utc = datetime.now(timezone.utc).isoformat()

    event_packet: Dict[str, Any] = {
        "event_id": event_id,
        "tenant_id": tenant_id,
        "timestamp": now_utc,
        "stage": "INGESTED",
        "data": incident_data,
    }

    broker = broker_manager.get_broker()
    queue_name = get_tenant_queue_name(tenant_id)
    master_queue = settings.EMERGENCY_QUEUE_PREFIX

    # 1. Enqueue to tenant-isolated queue
    await broker.enqueue(queue_name, event_packet)
    # 2. Enqueue to global master processing queue for auto-scaling consumers
    await broker.enqueue(master_queue, event_packet)

    logger.info(
        f"[EventStream] SOS Ingested: event_id={event_id} | tenant={tenant_id} | "
        f"queue={queue_name} | title={incident_data.get('title', 'N/A')}"
    )

    return event_id


async def broadcast_tenant_event(tenant_id: str, event_payload: Dict[str, Any]) -> None:
    """
    Publishes a processed event or live telemetry update to the tenant's isolated
    WebSocket distribution channel. Only clients connected with matching tenant_id receive this.
    """
    if not tenant_id:
        return

    channel = get_tenant_broadcast_channel(tenant_id)
    broker = broker_manager.get_broker()
    await broker.publish(channel, event_payload)
    logger.debug(f"[EventStream] Broadcasted to tenant channel '{channel}': {event_payload.get('event_id')}")


async def subscribe_to_tenant_stream(tenant_id: str) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Subscribes to the real-time stream of events belonging strictly to the specified tenant.
    """
    channel = get_tenant_broadcast_channel(tenant_id)
    broker = broker_manager.get_broker()
    async for message in broker.subscribe(channel):
        yield message

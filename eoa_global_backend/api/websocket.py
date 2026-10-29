"""
EOA Global - Secure Multi-Tenant Real-Time WebSocket Router
Manages high-concurrency WebSocket connections strictly segregated by tenant_id.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

# Support both python-jose and PyJWT seamlessly
try:
    from jose import JWTError
except ImportError:
    from jwt.exceptions import PyJWTError as JWTError

from eoa_global_backend.core.security import decode_access_token
from eoa_global_backend.services.event_stream import subscribe_to_tenant_stream

logger = logging.getLogger("eoa.websocket")

router = APIRouter(tags=["Real-Time Emergency Feed"])


class ConnectionManager:
    """
    Enterprise WebSocket connection orchestrator.
    Guarantees strict tenant-level partitioning:
    Clients connected under 'fema-us' will NEVER receive messages targeted for 'interpol-hq' or 'tokyo-fire'.
    """

    def __init__(self) -> None:
        # Maps tenant_id -> Set of active WebSocket instances
        self._active_connections: Dict[str, Set[WebSocket]] = {}
        # Maps tenant_id -> Background asyncio subscription worker
        self._tenant_subscribers: Dict[str, asyncio.Task] = {}
        self._lock: Optional[asyncio.Lock] = None

    @property
    def lock(self) -> asyncio.Lock:
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    async def connect(self, websocket: WebSocket, tenant_id: str) -> None:
        """
        Registers an authenticated WebSocket connection under its designated tenant group.
        Spawns a tenant-specific broker listener if this is the first connected client for that tenant.
        """
        clean_tenant = tenant_id.strip().lower()
        async with self.lock:
            if clean_tenant not in self._active_connections:
                self._active_connections[clean_tenant] = set()
            self._active_connections[clean_tenant].add(websocket)

            # Spawn dedicated subscriber task for this tenant channel if not already running
            if clean_tenant not in self._tenant_subscribers or self._tenant_subscribers[clean_tenant].done():
                self._tenant_subscribers[clean_tenant] = asyncio.create_task(
                    self._tenant_stream_listener(clean_tenant)
                )

        logger.info(
            f"[WebSocket] Client connected to tenant '{clean_tenant}'. "
            f"Active connections in tenant: {len(self._active_connections[clean_tenant])}"
        )

    async def disconnect(self, websocket: WebSocket, tenant_id: str) -> None:
        """
        Gracefully deregisters a WebSocket connection and tears down idle broker listeners.
        """
        clean_tenant = tenant_id.strip().lower()
        async with self.lock:
            if clean_tenant in self._active_connections:
                self._active_connections[clean_tenant].discard(websocket)
                if not self._active_connections[clean_tenant]:
                    # No more active clients for this tenant: shut down listener task
                    del self._active_connections[clean_tenant]
                    if clean_tenant in self._tenant_subscribers:
                        self._tenant_subscribers[clean_tenant].cancel()
                        del self._tenant_subscribers[clean_tenant]
                    logger.info(f"[WebSocket] Listener task decommissioned for idle tenant '{clean_tenant}'.")

        logger.info(f"[WebSocket] Client disconnected from tenant '{clean_tenant}'.")

    async def broadcast_to_tenant(self, tenant_id: str, message: Dict[str, Any]) -> None:
        """
        CRITICAL MULTI-TENANT BROADCAST:
        Directly pushes the JSON frame ONLY to clients residing in the matching tenant partition.
        """
        clean_tenant = tenant_id.strip().lower()
        async with self.lock:
            sockets = list(self._active_connections.get(clean_tenant, set()))

        if not sockets:
            return

        dead_sockets: List[WebSocket] = []
        for socket in sockets:
            try:
                await socket.send_json(message)
            except Exception as exc:
                logger.warning(f"[WebSocket] Failed to send to socket in tenant '{clean_tenant}': {exc}")
                dead_sockets.append(socket)

        # Clean up any broken connections
        if dead_sockets:
            async with self.lock:
                for dead_socket in dead_sockets:
                    if clean_tenant in self._active_connections:
                        self._active_connections[clean_tenant].discard(dead_socket)

    async def _tenant_stream_listener(self, tenant_id: str) -> None:
        """
        Background listener task bound to a single tenant channel on the message broker.
        Relays broker events immediately to all connected WebSockets in that tenant.
        """
        logger.info(f"[WebSocket] Active broker listener initialized for tenant partition '{tenant_id}'.")
        try:
            async for event_packet in subscribe_to_tenant_stream(tenant_id):
                await self.broadcast_to_tenant(tenant_id, event_packet)
        except asyncio.CancelledError:
            logger.debug(f"[WebSocket] Broker listener cancelled for tenant '{tenant_id}'.")
        except Exception as exc:
            logger.error(f"[WebSocket] Error in tenant '{tenant_id}' stream listener: {exc}", exc_info=True)


# Global singleton connection manager
ws_manager = ConnectionManager()


@router.websocket("/ws/live-feed/{tenant_id}")
async def tenant_websocket_feed(
    websocket: WebSocket,
    tenant_id: str,
    token: Optional[str] = Query(None),
):
    """
    Secure Real-Time WebSocket endpoint.
    URL Format: ws://.../ws/live-feed/{tenant_id}?token={JWT_BEARER_TOKEN}
    
    Security & Isolation Rules:
      1. Cryptographically decodes JWT token BEFORE accepting connection.
      2. Strictly validates that token.tenant_id matches URL path parameter {tenant_id}.
      3. Rejects immediately with WS_1008_POLICY_VIOLATION on failure.
      4. Streams isolated live emergency feeds for that tenant exclusively.
    """
    clean_tenant = tenant_id.strip().lower()

    # Pre-acceptance JWT Authentication
    if not token:
        logger.warning(f"[WebSocket Auth] Rejected: Missing JWT token for tenant '{clean_tenant}'.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing authentication token.")
        return

    try:
        payload = decode_access_token(token)
        user_email: str = payload.get("sub")
        token_tenant: str = payload.get("tenant_id", "").strip().lower()
        is_superuser: bool = payload.get("is_superuser", False)

        if not user_email or not token_tenant:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token claims.")
            return

        # Enforce multi-tenant match (unless platform superuser)
        if not is_superuser and token_tenant != clean_tenant:
            logger.warning(
                f"[WebSocket Security Alert] Unauthorized cross-tenant attempt! "
                f"User '{user_email}' (tenant: '{token_tenant}') attempted connecting to '{clean_tenant}'!"
            )
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unauthorized tenant boundary access.")
            return

    except (JWTError, Exception) as exc:
        logger.warning(f"[WebSocket Auth] Invalid or expired JWT token: {exc}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication failed.")
        return

    # Accept connection and register under tenant
    await websocket.accept()
    await ws_manager.connect(websocket, clean_tenant)

    # Dispatch initial connection handshake packet
    await websocket.send_json({
        "type": "EOA_SOCKET_INITIALIZED",
        "tenant_id": clean_tenant,
        "authenticated_as": user_email,
        "connected_at": datetime.now(timezone.utc).isoformat(),
        "status": "LISTENING_FOR_TENANT_INCIDENTS",
    })

    try:
        while True:
            # Keep-alive ping/pong and client-side command ingestion
            client_message = await websocket.receive_text()
            # Echo heartbeat acknowledgements or process client queries
            await websocket.send_json({
                "type": "HEARTBEAT_ACK",
                "tenant_id": clean_tenant,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket, clean_tenant)
    except Exception as exc:
        logger.warning(f"[WebSocket] Exception on tenant '{clean_tenant}' connection: {exc}")
        await ws_manager.disconnect(websocket, clean_tenant)

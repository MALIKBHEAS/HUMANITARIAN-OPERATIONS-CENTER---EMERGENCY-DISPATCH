import logging
from typing import List, Dict, Any
from fastapi import WebSocket

logger = logging.getLogger("ws_manager")

class ConnectionManager:
    """
    Manages active WebSocket client connections for real-time dispatch broadcasting
    to connected React / Vite frontend dashboards across global control centers.
    """
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """Accepts and registers a new WebSocket client connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket) -> None:
        """Safely removes a disconnected WebSocket client."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client removed. Remaining active: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]) -> None:
        """
        Broadcasts structured JSON payload to all connected clients.
        Automatically purges stale or broken sockets.
        """
        stale_connections: List[WebSocket] = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception as exc:
                logger.warning(f"Failed to send to client, marking for removal: {exc}")
                stale_connections.append(connection)

        for stale in stale_connections:
            self.disconnect(stale)

# Global singleton instance
ws_manager = ConnectionManager()

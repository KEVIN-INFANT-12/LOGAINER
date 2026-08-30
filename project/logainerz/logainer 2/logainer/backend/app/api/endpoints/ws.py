from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List, Set
import asyncio
import json
import random
from datetime import datetime
from backend.app.api.endpoints.vehicles import FLEET_DB

router = APIRouter(tags=["WebSockets"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        dead_connections = set()
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                dead_connections.add(connection)
        for dead in dead_connections:
            self.active_connections.discard(dead)

ws_manager = ConnectionManager()

@router.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Send initial handshake state
        await websocket.send_text(json.dumps({
            "type": "CONNECTION_INIT",
            "timestamp": datetime.utcnow().isoformat(),
            "message": "Connected to LOGAINER NER Live Telemetry Stream",
            "active_vehicles": len(FLEET_DB)
        }))
        
        while True:
            # Keep connection open and accept commands from client if sent
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                # If client requests forced refresh or broadcast
                if payload.get("action") == "PING":
                    await websocket.send_text(json.dumps({"type": "PONG", "timestamp": datetime.utcnow().isoformat()}))
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)

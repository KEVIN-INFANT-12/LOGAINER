from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import logging
from backend.app.data.database import (
    db_create_emergency,
    db_get_emergency,
    db_list_emergencies,
    db_resolve_emergency,
    db_log_audit
)
from backend.app.api.endpoints.ws import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/emergencies", tags=["Emergency Broadcast & Alerts"])

class EmergencyCreateRequest(BaseModel):
    emergency_id: Optional[str] = Field(None, description="Unique client emergency ID for deduplication")
    sender_user_id: Optional[str] = Field("DRV-101", description="ID of the sender user")
    sender_role: str = Field("driver", description="Role of sender: driver, officer, citizen")
    sender_name: Optional[str] = Field("Field Personnel", description="Name of sender")
    emergency_type: str = Field(..., description="Landslide, Flood, Heavy Rain, Road Block, Accident, Weather Emergency, Other")
    message: Optional[str] = Field(None, description="Detailed emergency message")
    latitude: float = Field(..., description="Captured GPS latitude")
    longitude: float = Field(..., description="Captured GPS longitude")
    location_name: Optional[str] = Field("Field Location", description="Reverse geocoded location name")
    status: Optional[str] = Field("ACTIVE", description="ACTIVE | RESOLVED")
    timestamp: Optional[str] = Field(None, description="ISO timestamp")

class ResolveRequest(BaseModel):
    resolved_by: Optional[str] = Field("Operations Admin", description="User or role resolving the alert")
    resolution_notes: Optional[str] = Field(None, description="Resolution notes")

@router.post("")
async def create_and_broadcast_emergency(payload: EmergencyCreateRequest, request: Request):
    """
    Ingests an emergency from a Driver or Field Officer, persists it to the database,
    and broadcasts in real-time to the Admin Web App and all connected Drivers.
    """
    data = payload.dict()
    if not data.get("emergency_id"):
        data["emergency_id"] = f"EMG-{uuid.uuid4().hex[:8].upper()}"
    if not data.get("timestamp"):
        data["timestamp"] = datetime.now(timezone.utc).isoformat()
    if not data.get("message"):
        data["message"] = f"🚨 {data['emergency_type']} reported near {data.get('location_name', 'current GPS coordinates')} by {data.get('sender_name', data['sender_role'])}."

    # 1. Persist to database (idempotent / deduplication handled)
    saved_emergency = db_create_emergency(data)

    # 2. Log system audit trail
    db_log_audit(
        user_id=data.get("sender_user_id", "ANON"),
        username=data.get("sender_name", data.get("sender_role", "User")),
        action="EMERGENCY_TRIGGERED",
        details={
            "emergency_id": saved_emergency["emergency_id"],
            "type": saved_emergency["emergency_type"],
            "role": saved_emergency["sender_role"],
            "coords": [saved_emergency["latitude"], saved_emergency["longitude"]],
            "location": saved_emergency["location_name"]
        },
        ip_address=request.client.host if request.client else "127.0.0.1"
    )

    # 3. Real-time broadcast to Admin Web App and all active Driver apps
    broadcast_payload = {
        "type": "EMERGENCY_BROADCAST",
        "event": "EMERGENCY_TRIGGERED",
        "emergency": saved_emergency
    }
    
    try:
        await ws_manager.broadcast(broadcast_payload)
        logger.info(f"Broadcasted emergency {saved_emergency['emergency_id']} to {len(ws_manager.active_connections)} connected clients")
    except Exception as e:
        logger.error(f"WebSocket broadcast error: {e}")

    return {
        "status": "success",
        "message": "Emergency alert registered and broadcasted in real-time",
        "emergency": saved_emergency
    }

@router.get("")
def list_emergencies(status: Optional[str] = None, limit: int = 50):
    """
    Retrieves list of active and resolved emergency alerts.
    """
    emergencies = db_list_emergencies(status=status, limit=limit)
    return {
        "count": len(emergencies),
        "emergencies": emergencies
    }

@router.get("/{emergency_id}")
def get_emergency(emergency_id: str):
    """
    Retrieves a single emergency alert by ID.
    """
    emg = db_get_emergency(emergency_id)
    if not emg:
        raise HTTPException(status_code=404, detail="Emergency alert not found")
    return emg

@router.put("/{emergency_id}/resolve")
async def resolve_emergency(emergency_id: str, payload: Optional[ResolveRequest] = None):
    """
    Resolves an active emergency alert and notifies all connected clients.
    """
    resolved_by = payload.resolved_by if payload else "Operations Admin"
    updated = db_resolve_emergency(emergency_id, resolved_by=resolved_by)
    if not updated:
        raise HTTPException(status_code=404, detail="Emergency alert not found")
    
    # Broadcast resolution event
    broadcast_payload = {
        "type": "EMERGENCY_BROADCAST",
        "event": "EMERGENCY_RESOLVED",
        "emergency": updated
    }
    try:
        await ws_manager.broadcast(broadcast_payload)
    except Exception as e:
        logger.error(f"WebSocket resolution broadcast error: {e}")
        
    return {
        "status": "success",
        "message": f"Emergency {emergency_id} has been resolved",
        "emergency": updated
    }

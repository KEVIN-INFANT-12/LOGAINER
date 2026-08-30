import os
import uuid
import pandas as pd
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from backend.app.routing.a_star_router import router_engine

router = APIRouter(prefix="/incidents", tags=["Field Incident Reporting & Validation"])

CSV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "csv", "incidents_ner.csv")
MEDIA_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "uploads")
os.makedirs(MEDIA_UPLOAD_DIR, exist_ok=True)

class IncidentItem(BaseModel):
    id: str = Field(default_factory=lambda: f"INC-{uuid.uuid4().hex[:6].upper()}")
    client_report_id: Optional[str] = None
    user_id: Optional[str] = None
    title: str
    category: str  # LANDSLIDE, FLASH_FLOOD, BRIDGE_WASHOUT, MUDSLIDE, ROCKFALL, SNOW_BLOCK, TREE_FALL, INFRASTRUCTURE
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL_BLOCKED
    state: str
    district: str
    lat: float
    lng: float
    description: str
    reporter_name: str
    reporter_role: str = "Field Official"  # Field Officer, Citizen, BRO Sentinel
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    photo_url: Optional[str] = "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80"
    video_url: Optional[str] = None
    passable_by: str = "NONE"  # NONE, 4X4_ONLY, LIGHT_VEHICLES_ONLY, ALL_VEHICLES
    verification_status: str = "PENDING_VERIFICATION"  # PENDING_VERIFICATION, VERIFIED_OFFICIAL, REJECTED, RESOLVED
    upvotes: int = 1
    offline_synced: bool = False


def seed_incidents_from_csv():
    items = []
    if not os.path.exists(CSV_PATH):
        return items

    df = pd.read_csv(CSV_PATH)
    for _, row in df.head(100).iterrows():
        sev_raw = str(row.get("severity_level", "Moderate (Level 2)"))
        if "Critical" in sev_raw or "Level 4" in sev_raw or "Level 5" in sev_raw:
            sev = "CRITICAL_BLOCKED"
            passable = "NONE"
        elif "High" in sev_raw or "Level 3" in sev_raw:
            sev = "HIGH"
            passable = "4X4_ONLY"
        elif "Moderate" in sev_raw or "Level 2" in sev_raw:
            sev = "MEDIUM"
            passable = "LIGHT_VEHICLES_ONLY"
        else:
            sev = "LOW"
            passable = "ALL_VEHICLES"

        cat_raw = str(row.get("incident_category", "Geological"))
        inc_type = str(row.get("incident_type", "Hazard Alert"))
        
        if "Landslide" in inc_type or "Rockfall" in inc_type or "Subsidence" in inc_type:
            cat = "LANDSLIDE"
        elif "Flood" in inc_type or "Cloudburst" in inc_type:
            cat = "FLASH_FLOOD"
        elif "Bridge" in inc_type or "Washout" in inc_type:
            cat = "BRIDGE_WASHOUT"
        else:
            cat = "INFRASTRUCTURE"

        status_raw = str(row.get("incident_status", "Mitigation In Progress"))
        ver_status = "RESOLVED" if "Resolved" in status_raw else "VERIFIED_OFFICIAL"

        items.append({
            "id": str(row.get("incident_id")),
            "title": f"{inc_type} - {row.get('nearest_city_town')}",
            "category": cat,
            "severity": sev,
            "state": str(row.get("state")),
            "district": str(row.get("district")),
            "lat": float(row.get("latitude")),
            "lng": float(row.get("longitude")),
            "description": f"{row.get('action_taken')}. Affected corridor: {row.get('road_highway_affected')}. Estimated affected population: {row.get('estimated_affected_population')}.",
            "reporter_name": str(row.get("reporting_agency", "BRO Sentinel")),
            "reporter_role": "Field Officer",
            "created_at": str(row.get("timestamp_reported")),
            "photo_url": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80",
            "passable_by": passable,
            "verification_status": ver_status,
            "upvotes": int(row.get("injuries_count", 0)) + 3,
            "offline_synced": True
        })
    return items

INCIDENTS_DB: List[dict] = seed_incidents_from_csv()

@router.get("")
def list_incidents(state: Optional[str] = None, severity: Optional[str] = None, status: Optional[str] = None):
    results = INCIDENTS_DB
    if state and state != "ALL":
        results = [inc for inc in results if inc["state"].lower() == state.lower()]
    if severity and severity != "ALL":
        results = [inc for inc in results if inc["severity"].lower() == severity.lower()]
    if status and status != "ALL":
        results = [inc for inc in results if inc["verification_status"].lower() == status.lower()]
    return results

@router.post("")
def report_incident(incident: IncidentItem):
    """
    Submits a geo-tagged incident report (from Field Officer or Citizen mobile apps).
    """
    data = incident.model_dump()
    INCIDENTS_DB.insert(0, data)
    return {
        "success": True,
        "message": "Geo-tagged incident report recorded successfully.",
        "incident": data
    }

@router.post("/upload-media")
async def upload_media_file(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None),
    report_id: Optional[str] = Form(None)
):
    """
    Accepts photo/video uploads from Field Officer / Citizen apps, saves them locally,
    and returns a persistent access URL.
    """
    file_ext = os.path.splitext(file.filename or "media.jpg")[1]
    unique_name = f"{uuid.uuid4().hex[:10]}{file_ext}"
    dest_path = os.path.join(MEDIA_UPLOAD_DIR, unique_name)
    
    contents = await file.read()
    with open(dest_path, "wb") as f:
        f.write(contents)
        
    media_url = f"/uploads/{unique_name}"
    return {
        "success": True,
        "filename": unique_name,
        "original_name": file.filename,
        "mime_type": file.content_type,
        "size_bytes": len(contents),
        "media_url": media_url
    }

@router.post("/sync-batch")
def sync_offline_incidents(batch: List[IncidentItem]):
    """
    Synchronizes offline reports collected during low-connectivity operation.
    Guarantees idempotency and duplicate prevention using client_report_id / id.
    """
    synced_ids = []
    synced_items = []
    
    for inc in batch:
        data = inc.model_dump()
        data["offline_synced"] = True
        
        # Check for existing duplicate by id or client_report_id
        existing = next(
            (item for item in INCIDENTS_DB if 
             item["id"] == data["id"] or 
             (data.get("client_report_id") and item.get("client_report_id") == data.get("client_report_id"))),
            None
        )
        
        if existing:
            # Already synced, confirm without duplicate insertion
            synced_ids.append(existing["id"])
            synced_items.append(existing)
        else:
            INCIDENTS_DB.insert(0, data)
            synced_ids.append(data["id"])
            synced_items.append(data)
        
    return {
        "success": True,
        "synced_count": len(synced_ids),
        "synced_ids": synced_ids,
        "synced_incidents": synced_items,
        "server_time": datetime.now(timezone.utc).isoformat()
    }


@router.post("/{incident_id}/validate")
@router.post("/{incident_id}/verify")
def validate_incident(incident_id: str, action: str = "VERIFIED_OFFICIAL", admin_notes: Optional[str] = None):
    """
    Admin reviews and validates or rejects an incident report:
    - VERIFIED_OFFICIAL / APPROVED: Validated as genuine hazard; feeds into real-time routing avoidance.
    - REJECTED: Discarded as false or duplicate.
    - RESOLVED: Marked as cleared/repaired.
    """
    action_norm = action.upper()
    if action_norm in ["APPROVE", "APPROVED"]:
        action_norm = "VERIFIED_OFFICIAL"

    for inc in INCIDENTS_DB:
        if inc["id"] == incident_id:
            inc["verification_status"] = action_norm
            inc["validated_at"] = datetime.now(timezone.utc).isoformat()
            if admin_notes:
                inc["admin_notes"] = admin_notes
                
            if action_norm == "VERIFIED_OFFICIAL":
                inc["trust_score_pct"] = 98
                inc["trust_level"] = "OFFICIALLY VERIFIED"
                inc["trust_badge_color"] = "emerald"
            elif action_norm == "REJECTED":
                inc["trust_score_pct"] = 10
                inc["trust_level"] = "REJECTED / INVALID"
                inc["trust_badge_color"] = "rose"
            elif action_norm == "RESOLVED":
                inc["trust_score_pct"] = 100
                inc["trust_level"] = "CLEARED & RESOLVED"
                inc["trust_badge_color"] = "teal"
            else:
                inc["trust_level"] = "PENDING REVIEW"
                inc["trust_badge_color"] = "amber"

            return {
                "success": True, 
                "message": f"Incident {incident_id} status updated to {action_norm}",
                "updated_incident": inc
            }
    raise HTTPException(status_code=404, detail="Incident not found")

@router.post("/{incident_id}/upvote")
def upvote_incident(incident_id: str):
    for inc in INCIDENTS_DB:
        if inc["id"] == incident_id:
            inc["upvotes"] += 1
            return {"success": True, "upvotes": inc["upvotes"]}
    raise HTTPException(status_code=404, detail="Incident not found")

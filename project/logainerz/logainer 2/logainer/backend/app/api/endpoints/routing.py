import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from backend.app.routing.a_star_router import router_engine, NER_NODES, SAFE_HALT_LOCATIONS
from backend.app.data.ner_geo import VULNERABLE_CHOKEPOINTS, LOGISTICS_HUBS
from backend.app.api.endpoints import vehicles, ws
from backend.app.data.database import (
    db_list_trips, db_get_trip, db_save_trip,
    db_update_trip_status, db_update_trip_location
)

router = APIRouter(prefix="/routes", tags=["Routing & Trip Management"])

class RouteOptimizeRequest(BaseModel):
    origin_id: str = Field(default="GHY", description="Origin Node ID (e.g. GHY, TEZ, SHL)")
    destination_id: str = Field(default="TWG", description="Destination Node ID (e.g. TWG, AZL, GTK)")
    avoid_chokepoints: Optional[List[str]] = []
    cargo_type: Optional[str] = "ESSENTIAL_MEDICINES_COLD_CHAIN"
    priority_level: Optional[str] = "EMERGENCY"  # NORMAL, HIGH, EMERGENCY

class CreateTripRequest(BaseModel):
    origin_id: str
    destination_id: str
    commodity_type: str = "ESSENTIAL_MEDICINES"
    package_details: str = "1000 Units Emergency Vaccine Cold Packs"
    driver_id: str = "DRV-102"
    driver_name: str = "Tenzing Norbu"
    vehicle_id: str = "TRUCK-NER-402"
    vehicle_no: str = "AS-01-EC-9081"
    priority: str = "EMERGENCY"
    assigned_route_id: Optional[str] = "ROUTE-B"

class DriverDecisionRequest(BaseModel):
    decision: str  # ACCEPT or REJECT
    driver_lat: Optional[float] = None
    driver_lng: Optional[float] = None
    reason: Optional[str] = None
    selected_halt_id: Optional[str] = None

class DriverActionRequest(BaseModel):
    driver_id: Optional[str] = None
    driver_lat: Optional[float] = None
    driver_lng: Optional[float] = None

class LocationUpdateRequest(BaseModel):
    driver_id: Optional[str] = None
    lat: float
    lng: float
    speed_kmh: Optional[float] = 40.0
    progress_pct: Optional[int] = 0

# Active chokepoints state in-memory
current_chokepoints = list(VULNERABLE_CHOKEPOINTS)

@router.get("/hubs")
def get_hubs():
    return LOGISTICS_HUBS

@router.get("/nodes")
def get_nodes():
    return NER_NODES

@router.get("/chokepoints")
def get_chokepoints():
    return current_chokepoints

@router.get("/safe-halts")
def get_safe_halts(lat: Optional[float] = None, lng: Optional[float] = None, radius_km: float = 150.0):
    if lat is not None and lng is not None:
        return router_engine.find_nearby_safe_halts(lat, lng, radius_km)
    return SAFE_HALT_LOCATIONS

@router.post("/chokepoints/{cp_id}/status")
def update_chokepoint_status(cp_id: str, new_status: str, description: Optional[str] = None):
    for cp in current_chokepoints:
        if cp["id"] == cp_id:
            cp["current_status"] = new_status
            if description:
                cp["description"] = description
            return {"success": True, "updated_chokepoint": cp}
    raise HTTPException(status_code=404, detail="Chokepoint ID not found")

@router.post("/optimize")
def optimize_multi_routes(req: RouteOptimizeRequest):
    """
    Generates and ranks multiple candidate routes using OSRM/A* road graph + ConvLSTM Spatiotemporal Risk Scoring.
    """
    blocked_ids = [cp["id"] for cp in current_chokepoints if cp.get("current_status") in ["CRITICAL_BLOCKED", "HIGH_RISK"]]
    if req.avoid_chokepoints:
        blocked_ids = list(set(blocked_ids + req.avoid_chokepoints))
        
    result = router_engine.calculate_multi_candidate_routes(
        start_id=req.origin_id,
        dest_id=req.destination_id,
        active_blocks=blocked_ids,
        cargo_type=req.cargo_type,
        priority_level=req.priority_level
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
        
    return {
        "success": True,
        "query": req.model_dump(),
        "routes": result
    }

# --- Persistent Trip Management Endpoints ---

@router.get("/trips")
def list_trips(
    status: Optional[str] = None,
    driver_id: Optional[str] = None
):
    """
    Retrieves persistent trips from SQLite DB.
    If driver_id is provided, returns trips assigned to that driver.
    """
    trips = db_list_trips(driver_id=driver_id, status=status)
    return {"success": True, "count": len(trips), "trips": trips}

@router.get("/trips/{trip_id}")
def get_trip_details(trip_id: str):
    """
    Retrieves a single trip by ID.
    """
    trip = db_get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip ID not found")
    return {"success": True, "trip": trip}

@router.post("/trips")
async def create_trip(req: CreateTripRequest):
    """
    Admin creates a trip and assigns it to a driver and vehicle.
    Persists trip in SQLite DB, registers vehicle into live fleet database,
    and broadcasts a real-time WebSocket event to all connected clients.
    """
    routes_data = router_engine.calculate_multi_candidate_routes(
        start_id=req.origin_id,
        dest_id=req.destination_id,
        cargo_type=req.commodity_type,
        priority_level=req.priority
    )
    
    candidates = routes_data.get("candidate_routes", [])
    selected_candidate = next((c for c in candidates if c["route_id"] == req.assigned_route_id), candidates[0] if candidates else None)

    trip_id = f"TR-{uuid.uuid4().hex[:4].upper()}"
    orig_node = NER_NODES.get(req.origin_id, {"name": req.origin_id, "lat": 26.1445, "lng": 91.7362})
    dest_node = NER_NODES.get(req.destination_id, {"name": req.destination_id, "lat": 25.5788, "lng": 91.8933})

    new_trip = {
        "trip_id": trip_id,
        "trip_code": trip_id,
        "origin_id": req.origin_id,
        "origin_name": orig_node.get("name"),
        "destination_id": req.destination_id,
        "destination_name": dest_node.get("name"),
        "commodity_type": req.commodity_type,
        "package_details": req.package_details,
        "driver_id": req.driver_id,
        "driver_name": req.driver_name,
        "driver_phone": "+91 98624-55102",
        "vehicle_id": req.vehicle_id,
        "vehicle_no": req.vehicle_no,
        "priority": req.priority,
        "status": "ASSIGNED",
        "assigned_route_id": selected_candidate["route_id"] if selected_candidate else "ROUTE-A",
        "assigned_route_name": selected_candidate["name"] if selected_candidate else "Standard Route",
        "distance_km": selected_candidate["distance_km"] if selected_candidate else 98.0,
        "duration_mins": selected_candidate.get("duration_mins", 140) if selected_candidate else 140,
        "eta_display": selected_candidate["eta_display"] if selected_candidate else "2h 20m",
        "convlstm_risk_score": selected_candidate["convlstm_risk_score"] if selected_candidate else 0.25,
        "risk_level": selected_candidate["risk_level"] if selected_candidate else "LOW",
        "instructions": f"Assigned Priority Cargo. Maintain standard corridor route.",
        "road_condition": "Route evaluated by ConvLSTM Risk Engine.",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "assigned_at": datetime.now(timezone.utc).isoformat(),
        "current_lat": orig_node.get("lat", 26.1445),
        "current_lng": orig_node.get("lng", 91.7362),
        "progress_pct": 0,
        "speed_kmh": 0.0,
        "connectivity": "CONNECTED",
        "candidate_routes": candidates
    }

    # Persist in SQLite
    saved = db_save_trip(new_trip)

    # Update in-memory FLEET_DB
    existing_vehicle = next((v for v in vehicles.FLEET_DB if v["id"] == req.vehicle_id or v["vehicle_no"] == req.vehicle_no), None)
    if existing_vehicle:
        existing_vehicle["status"] = "ASSIGNED"
        existing_vehicle["current_lat"] = orig_node.get("lat", 26.1445)
        existing_vehicle["current_lng"] = orig_node.get("lng", 91.7362)
        existing_vehicle["speed_kmh"] = 0.0
        existing_vehicle["progress_pct"] = 0
        existing_vehicle["origin_name"] = orig_node.get("name")
        existing_vehicle["destination_name"] = dest_node.get("name")
        existing_vehicle["cargo_desc"] = f"{req.package_details} ({req.commodity_type})"
        existing_vehicle["cargo_type"] = req.commodity_type
        existing_vehicle["driver_name"] = req.driver_name
    else:
        vehicles.FLEET_DB.insert(0, {
            "id": req.vehicle_id,
            "vehicle_no": req.vehicle_no,
            "cargo_type": req.commodity_type,
            "commodity_type": req.commodity_type,
            "cargo_desc": f"{req.package_details} ({req.commodity_type})",
            "origin_id": req.origin_id,
            "origin_name": orig_node.get("name"),
            "destination_id": req.destination_id,
            "destination_name": dest_node.get("name"),
            "current_lat": orig_node.get("lat", 26.1445),
            "current_lng": orig_node.get("lng", 91.7362),
            "speed_kmh": 0.0,
            "heading_deg": 45,
            "driver_name": req.driver_name,
            "driver_phone": "+91 98624-55102",
            "temp_celsius": 4.2 if "MEDICINE" in req.commodity_type else 88.0,
            "temp_target_range": [2.0, 8.0] if "MEDICINE" in req.commodity_type else [-20.0, 100.0],
            "weight_tonnes": 4.5,
            "progress_pct": 0,
            "status": "ASSIGNED",
            "connectivity_status": "CONNECTED",
            "risk_advisory": f"Corridor: {selected_candidate['name'] if selected_candidate else 'Trunk'}. ILP: Cleared. GPS: Strong 5G.",
            "is_sos": False,
            "ilp_status": "Cleared",
            "gps_signal": "Strong (4G/5G)",
            "mid_trip_risk_score": selected_candidate["convlstm_risk_score"] if selected_candidate else 0.22,
            "mid_trip_risk_level": selected_candidate["risk_level"] if selected_candidate else "LOW",
            "disruption_alert": None
        })

    # Broadcast real-time event to Admin Web App
    try:
        await ws.ws_manager.broadcast({
            "type": "TRIP_ASSIGNED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "trip": saved,
            "message": f"New Trip #{trip_id} created and assigned to {req.driver_name}"
        })
    except Exception as e:
        print(f"[WS Broadcast Error]: {e}")

    return {
        "success": True,
        "message": f"Trip {trip_id} successfully created and assigned to {req.driver_name}.",
        "trip": saved
    }

@router.post("/trips/{trip_id}/accept")
async def accept_trip(trip_id: str, req: Optional[DriverActionRequest] = None):
    """
    Driver accepts an assigned trip.
    Updates persistent SQLite status to ACCEPTED and broadcasts event to Admin.
    """
    trip = db_get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip ID not found")

    if trip.get("status") in ["COMPLETED"]:
        raise HTTPException(status_code=400, detail="Cannot accept a completed trip.")

    updated_trip = db_update_trip_status(
        trip_id,
        "ACCEPTED",
        {
            "driver_id": req.driver_id if req and req.driver_id else trip.get("driver_id"),
            "current_lat": req.driver_lat if req and req.driver_lat else trip.get("current_lat"),
            "current_lng": req.driver_lng if req and req.driver_lng else trip.get("current_lng"),
        }
    )

    # Sync vehicle in fleet database
    v = next((veh for veh in vehicles.FLEET_DB if veh["id"] == trip["vehicle_id"] or veh["vehicle_no"] == trip["vehicle_no"]), None)
    if v:
        v["status"] = "ACCEPTED"
        v["driver_name"] = updated_trip.get("driver_name", v.get("driver_name"))

    # Broadcast real-time WebSocket event to Admin
    try:
        await ws.ws_manager.broadcast({
            "type": "TRIP_STATUS_UPDATE",
            "trip_id": trip_id,
            "status": "ACCEPTED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "trip": updated_trip,
            "message": f"Driver {updated_trip.get('driver_name', '')} ACCEPTED Trip #{trip_id}."
        })
    except Exception as e:
        print(f"[WS Broadcast Error]: {e}")

    return {
        "success": True,
        "status": "ACCEPTED",
        "message": f"Trip #{trip_id} successfully accepted.",
        "trip": updated_trip
    }

@router.post("/trips/{trip_id}/start")
async def start_trip(trip_id: str, req: Optional[DriverActionRequest] = None):
    """
    Driver starts navigation and vehicle movement along route.
    Updates persistent SQLite status to IN_PROGRESS (EN_ROUTE).
    """
    trip = db_get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip ID not found")

    updated_trip = db_update_trip_status(
        trip_id,
        "IN_PROGRESS",
        {
            "current_lat": req.driver_lat if req and req.driver_lat else trip.get("current_lat"),
            "current_lng": req.driver_lng if req and req.driver_lng else trip.get("current_lng"),
        }
    )

    # Sync vehicle in fleet database
    v = next((veh for veh in vehicles.FLEET_DB if veh["id"] == trip["vehicle_id"] or veh["vehicle_no"] == trip["vehicle_no"]), None)
    if v:
        v["status"] = "EN_ROUTE"
        v["speed_kmh"] = 45.0
        v["progress_pct"] = max(v.get("progress_pct", 0), 5)

    try:
        await ws.ws_manager.broadcast({
            "type": "TRIP_STATUS_UPDATE",
            "trip_id": trip_id,
            "status": "IN_PROGRESS",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "trip": updated_trip,
            "message": f"Driver started navigation for Trip #{trip_id}."
        })
    except Exception as e:
        print(f"[WS Broadcast Error]: {e}")

    return {
        "success": True,
        "status": "IN_PROGRESS",
        "message": f"Trip #{trip_id} is now in progress.",
        "trip": updated_trip
    }

@router.post("/trips/{trip_id}/complete")
@router.post("/trips/{trip_id}/finish")
async def complete_trip(trip_id: str, req: Optional[DriverActionRequest] = None):
    """
    Driver completes/finishes the trip upon arriving at the destination.
    Updates persistent SQLite status to COMPLETED and broadcasts event.
    """
    trip = db_get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip ID not found")

    updated_trip = db_update_trip_status(trip_id, "COMPLETED")

    # Sync vehicle in fleet database
    v = next((veh for veh in vehicles.FLEET_DB if veh["id"] == trip["vehicle_id"] or veh["vehicle_no"] == trip["vehicle_no"]), None)
    if v:
        v["status"] = "COMPLETED"
        v["speed_kmh"] = 0.0
        v["progress_pct"] = 100

    try:
        await ws.ws_manager.broadcast({
            "type": "TRIP_STATUS_UPDATE",
            "trip_id": trip_id,
            "status": "COMPLETED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "trip": updated_trip,
            "message": f"Trip #{trip_id} has been COMPLETED."
        })
    except Exception as e:
        print(f"[WS Broadcast Error]: {e}")

    return {
        "success": True,
        "status": "COMPLETED",
        "message": f"Trip #{trip_id} completed successfully.",
        "trip": updated_trip
    }

@router.post("/trips/{trip_id}/location")
async def update_trip_location(trip_id: str, req: LocationUpdateRequest):
    """
    Real-time GPS / simulation coordinate stream from Driver Mobile App.
    """
    db_update_trip_location(
        trip_id,
        lat=req.lat,
        lng=req.lng,
        speed_kmh=req.speed_kmh or 40.0,
        progress_pct=req.progress_pct or 0
    )

    # Sync vehicle
    trip = db_get_trip(trip_id)
    if trip:
        v = next((veh for veh in vehicles.FLEET_DB if veh["id"] == trip["vehicle_id"] or veh["vehicle_no"] == trip["vehicle_no"]), None)
        if v:
            v["current_lat"] = req.lat
            v["current_lng"] = req.lng
            v["speed_kmh"] = req.speed_kmh or 40.0
            v["progress_pct"] = req.progress_pct or 0

    return {"success": True, "trip_id": trip_id, "lat": req.lat, "lng": req.lng}

@router.post("/trips/{trip_id}/driver-response")
async def handle_driver_decision(trip_id: str, req: DriverDecisionRequest):
    """
    Driver decision flow from Admin test controls or Driver Application:
    - ACCEPT: Updates status to ACCEPTED / EN_ROUTE -> Starts GPS tracking.
    - REJECT: Finds nearby safe halts for driver selection.
    """
    target_trip = db_get_trip(trip_id)
    if not target_trip:
        raise HTTPException(status_code=404, detail="Trip ID not found")

    decision_norm = req.decision.upper()
    lat = req.driver_lat or target_trip.get("current_lat", 26.1445)
    lng = req.driver_lng or target_trip.get("current_lng", 91.7362)

    if decision_norm == "ACCEPT":
        updated = db_update_trip_status(trip_id, "ACCEPTED", {"current_lat": lat, "current_lng": lng})
        v = next((veh for veh in vehicles.FLEET_DB if veh["id"] == target_trip["vehicle_id"] or veh["vehicle_no"] == target_trip["vehicle_no"]), None)
        if v:
            v["status"] = "ACCEPTED"
            v["speed_kmh"] = 42.0

        try:
            await ws.ws_manager.broadcast({
                "type": "TRIP_STATUS_UPDATE",
                "trip_id": trip_id,
                "status": "ACCEPTED",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "trip": updated
            })
        except Exception:
            pass

        return {
            "success": True,
            "status": "ACCEPTED",
            "message": "Driver accepted recommended route. Live GPS navigation started.",
            "trip": updated
        }
    elif decision_norm == "REJECT":
        safe_halts = router_engine.find_nearby_safe_halts(lat, lng, radius_km=150.0)
        updated = db_update_trip_status(trip_id, "DRIVER_REJECTED", {
            "rejection_reason": req.reason or "Hazard assessment",
            "driver_response": "REJECTED"
        })

        try:
            await ws.ws_manager.broadcast({
                "type": "TRIP_STATUS_UPDATE",
                "trip_id": trip_id,
                "status": "DRIVER_REJECTED",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "trip": updated
            })
        except Exception:
            pass

        return {
            "success": True,
            "status": "REJECTED",
            "message": "Driver rejected suggested route. Showing nearby safe halt locations.",
            "safe_halt_locations": safe_halts,
            "trip": updated
        }
    else:
        raise HTTPException(status_code=400, detail="Invalid driver decision. Use ACCEPT or REJECT.")

# --- Offline Idempotent Driver Action Synchronization ---

class DriverActionSyncItem(BaseModel):
    client_action_id: str
    trip_id: str
    action_type: str  # ACCEPT, REJECT, START, COMPLETE, FINISH, LOCATION_UPDATE
    payload: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None
    timestamp: Optional[str] = None

PROCESSED_ACTION_IDS = set()

@router.post("/trips/sync-actions")
async def sync_offline_driver_actions(actions: List[DriverActionSyncItem]):
    """
    Synchronizes offline driver actions (Start, Complete, Location, Decision)
    with guaranteed idempotency using client_action_id.
    """
    synced_ids = []
    results = []
    
    # Sort chronologically if timestamps are provided
    sorted_actions = sorted(
        actions, 
        key=lambda a: a.timestamp if a.timestamp else ""
    )

    for action in sorted_actions:
        cid = action.client_action_id
        trip_id = action.trip_id
        action_type = action.action_type.upper()
        payload = action.payload or {}
        
        trip = db_get_trip(trip_id)
        if not trip:
            # If trip doesn't exist, record as handled to prevent queue stalling
            synced_ids.append(cid)
            continue

        if cid in PROCESSED_ACTION_IDS:
            synced_ids.append(cid)
            results.append({"client_action_id": cid, "status": "ALREADY_PROCESSED", "trip_id": trip_id})
            continue

        updated_trip = None
        if action_type in ["ACCEPT", "ACCEPTED"]:
            updated_trip = db_update_trip_status(trip_id, "ACCEPTED", payload)
            v = next((veh for veh in vehicles.FLEET_DB if veh["id"] == trip["vehicle_id"] or veh["vehicle_no"] == trip["vehicle_no"]), None)
            if v:
                v["status"] = "ACCEPTED"
        elif action_type in ["START", "START_TRIP", "IN_PROGRESS", "EN_ROUTE"]:
            updated_trip = db_update_trip_status(trip_id, "IN_PROGRESS", payload)
            v = next((veh for veh in vehicles.FLEET_DB if veh["id"] == trip["vehicle_id"] or veh["vehicle_no"] == trip["vehicle_no"]), None)
            if v:
                v["status"] = "EN_ROUTE"
                v["speed_kmh"] = payload.get("speed_kmh", 45.0)
                v["progress_pct"] = max(v.get("progress_pct", 0), payload.get("progress_pct", 10))
        elif action_type in ["COMPLETE", "FINISH", "COMPLETED"]:
            updated_trip = db_update_trip_status(trip_id, "COMPLETED", payload)
            v = next((veh for veh in vehicles.FLEET_DB if veh["id"] == trip["vehicle_id"] or veh["vehicle_no"] == trip["vehicle_no"]), None)
            if v:
                v["status"] = "COMPLETED"
                v["speed_kmh"] = 0.0
                v["progress_pct"] = 100
        elif action_type in ["REJECT", "DRIVER_REJECTED"]:
            updated_trip = db_update_trip_status(trip_id, "DRIVER_REJECTED", payload)
        elif action_type in ["LOCATION_UPDATE", "LOCATION"]:
            lat = payload.get("lat") or payload.get("driver_lat") or trip.get("current_lat", 26.1445)
            lng = payload.get("lng") or payload.get("driver_lng") or trip.get("current_lng", 91.7362)
            spd = payload.get("speed_kmh", 40.0)
            pct = payload.get("progress_pct", 0)
            db_update_trip_location(trip_id, lat=lat, lng=lng, speed_kmh=spd, progress_pct=pct)
            updated_trip = db_get_trip(trip_id)

        PROCESSED_ACTION_IDS.add(cid)
        synced_ids.append(cid)
        results.append({"client_action_id": cid, "status": "SYNCED", "action_type": action_type, "trip_id": trip_id})

        # Broadcast state update to Admin & central command via WebSocket
        if updated_trip:
            try:
                await ws.ws_manager.broadcast({
                    "type": "TRIP_STATUS_UPDATE",
                    "trip_id": trip_id,
                    "status": updated_trip.get("status"),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "trip": updated_trip,
                    "message": f"Offline Driver Action Synced: {action_type} for Trip #{trip_id}."
                })
            except Exception as e:
                print(f"[WS Sync Broadcast Error]: {e}")

    return {
        "success": True,
        "synced_count": len(synced_ids),
        "synced_ids": synced_ids,
        "results": results,
        "server_time": datetime.now(timezone.utc).isoformat()
    }


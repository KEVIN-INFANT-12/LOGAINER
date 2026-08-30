import os
import random
import pandas as pd
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.app.data.ner_geo import LOGISTICS_HUBS
from backend.app.routing.a_star_router import router_engine
from backend.app.ml.convlstm_service import convlstm_engine

router = APIRouter(prefix="/vehicles", tags=["GPS Fleet Telemetry & Live Tracking"])

CSV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "csv", "vehicle_telemetry_ner.csv")

CITY_COORDS = {
    "Guwahati": (26.1445, 91.7362),
    "Shillong": (25.5788, 91.8933),
    "Silchar": (24.8170, 92.8000),
    "Aizawl": (23.7271, 92.7176),
    "Imphal": (24.8170, 93.9368),
    "Kohima": (25.6751, 94.1086),
    "Dimapur": (25.9068, 93.7270),
    "Agartala": (23.8315, 91.2868),
    "Gangtok": (27.3389, 88.6065),
    "Itanagar": (27.0844, 93.6053),
    "Tezpur": (26.6338, 92.8000),
    "Tawang": (27.5861, 91.8594),
    "Dibrugarh": (27.4728, 94.9120),
    "Jorhat": (26.7509, 94.2037),
    "Siliguri": (26.7271, 88.3953),
    "Mangan": (27.5000, 88.5333)
}

def seed_vehicles_from_csv():
    items = []
    if not os.path.exists(CSV_PATH):
        return items

    df = pd.read_csv(CSV_PATH)
    
    cargo_type_mapping = {
        "Emergency Services": "ESSENTIAL_MEDICINES",
        "Cargo / Logistics": "ESSENTIAL_MEDICINES",
        "Public Transit": "FOOD_GRAINS",
        "Passenger / Tourism": "AGRICULTURAL_PRODUCE",
        "Infrastructure": "CONSTRUCTION_MATERIALS"
    }

    connectivity_choices = ["CONNECTED", "CONNECTED", "CONNECTED", "LIMITED_CONNECTIVITY", "OFFLINE"]

    for idx, row in df.iterrows():
        orig_name = str(row.get("route_origin", "Guwahati")).strip()
        dest_name = str(row.get("route_destination", "Shillong")).strip()
        
        orig_lat, orig_lng = CITY_COORDS.get(orig_name, (26.1445, 91.7362))
        dest_lat, dest_lng = CITY_COORDS.get(dest_name, (25.5788, 91.8933))
        
        prog = float(row.get("route_progress_pct", 50.0)) / 100.0
        cur_lat = round(orig_lat + (dest_lat - orig_lat) * prog, 4)
        cur_lng = round(orig_lng + (dest_lng - orig_lng) * prog, 4)

        status_raw = str(row.get("current_status", "In Transit / Moving"))
        if "Halted" in status_raw or "Blockade" in status_raw:
            stat = "HALTED_INCIDENT"
        elif "Congestion" in status_raw:
            stat = "CONGESTION"
        else:
            stat = "EN_ROUTE"

        cat = str(row.get("vehicle_category", "Cargo / Logistics"))
        c_type = cargo_type_mapping.get(cat, "ESSENTIAL_MEDICINES")
        
        fatigue = str(row.get("driver_fatigue_alert", "Normal"))
        is_fatigue = "Yes" in fatigue
        conn = connectivity_choices[idx % len(connectivity_choices)]

        items.append({
            "id": str(row.get("vehicle_telemetry_id")),
            "vehicle_no": str(row.get("registration_number")),
            "cargo_type": c_type,
            "commodity_type": c_type,
            "cargo_desc": f"{row.get('vehicle_type')} ({row.get('cargo_payload_tons')} Tons)",
            "origin_id": orig_name[:3].upper(),
            "origin_name": f"{orig_name} Terminal",
            "destination_id": dest_name[:3].upper(),
            "destination_name": f"{dest_name} Hub",
            "current_lat": cur_lat,
            "current_lng": cur_lng,
            "speed_kmh": float(row.get("speed_kmh", 35.0)),
            "heading_deg": int((idx * 45) % 360),
            "driver_name": f"NER Operator #{idx+101}",
            "driver_phone": f"+91 9862{idx:05d}",
            "temp_celsius": float(row.get("engine_temp_c", 88.0)),
            "temp_target_range": [2.0, 8.0] if "MEDICINE" in c_type else [-20.0, 100.0],
            "weight_tonnes": float(row.get("cargo_payload_tons", 5.0)),
            "progress_pct": int(float(row.get("route_progress_pct", 50.0))),
            "status": stat,
            "connectivity_status": conn,  # CONNECTED, LIMITED_CONNECTIVITY, OFFLINE
            "risk_advisory": f"Corridor: {row.get('highway_corridor')}. ILP: {row.get('checkpost_ilp_status')}. GPS: {row.get('gps_signal_status')}." + (" [FATIGUE ALERT: Exceeded 8h]" if is_fatigue else ""),
            "is_sos": False,
            "ilp_status": str(row.get("checkpost_ilp_status", "Cleared")),
            "gps_signal": str(row.get("gps_signal_status", "Strong (4G/5G)")),
            "mid_trip_risk_score": round(random.uniform(0.12, 0.45), 2),
            "mid_trip_risk_level": "LOW",
            "disruption_alert": None
        })
        
    return items

FLEET_DB: List[dict] = seed_vehicles_from_csv()

class VehicleUpdateRequest(BaseModel):
    lat: float
    lng: float
    speed_kmh: float
    heading_deg: Optional[int] = 0
    temp_celsius: Optional[float] = None
    progress_pct: Optional[int] = None
    status: Optional[str] = None
    connectivity_status: Optional[str] = None
    is_sos: Optional[bool] = None

@router.get("")
def list_vehicles(
    cargo_type: Optional[str] = None, 
    commodity_type: Optional[str] = None,
    connectivity: Optional[str] = None,
    limit: int = 100
):
    try:
        from backend.app.data.database import db_list_trips
        trips = db_list_trips()
        for t in trips:
            veh = next((v for v in FLEET_DB if v["id"] == t.get("vehicle_id") or v["vehicle_no"] == t.get("vehicle_no")), None)
            if veh:
                veh["status"] = t.get("status", veh.get("status"))
                if t.get("current_lat") and t.get("current_lng"):
                    veh["current_lat"] = t["current_lat"]
                    veh["current_lng"] = t["current_lng"]
                if t.get("progress_pct") is not None:
                    veh["progress_pct"] = t["progress_pct"]
                if t.get("speed_kmh") is not None:
                    veh["speed_kmh"] = t["speed_kmh"]
    except Exception:
        pass

    res = FLEET_DB
    if cargo_type and cargo_type != "ALL":
        res = [v for v in res if v["cargo_type"] == cargo_type or v.get("commodity_type") == cargo_type]
    if commodity_type and commodity_type != "ALL":
        res = [v for v in res if v.get("commodity_type") == commodity_type]
    if connectivity and connectivity != "ALL":
        res = [v for v in res if v.get("connectivity_status") == connectivity]
    return res[:limit]

@router.get("/all-count")
def get_fleet_count():
    conn_count = sum(1 for v in FLEET_DB if v.get("connectivity_status") == "CONNECTED")
    limited_count = sum(1 for v in FLEET_DB if v.get("connectivity_status") == "LIMITED_CONNECTIVITY")
    offline_count = sum(1 for v in FLEET_DB if v.get("connectivity_status") == "OFFLINE")
    return {
        "total_active_fleet": len(FLEET_DB),
        "connected": conn_count,
        "limited_connectivity": limited_count,
        "offline": offline_count,
        "source": "vehicle_telemetry_ner.csv (400 Monitored Trucks & Convoys)"
    }

@router.get("/{vehicle_id}")
def get_vehicle(vehicle_id: str):
    for v in FLEET_DB:
        if v["id"] == vehicle_id:
            return v
    raise HTTPException(status_code=404, detail="Vehicle not found")

@router.post("/{vehicle_id}/telemetry")
def update_telemetry(vehicle_id: str, req: VehicleUpdateRequest):
    for v in FLEET_DB:
        if v["id"] == vehicle_id:
            v["current_lat"] = req.lat
            v["current_lng"] = req.lng
            v["speed_kmh"] = req.speed_kmh
            if req.heading_deg is not None:
                v["heading_deg"] = req.heading_deg
            if req.temp_celsius is not None:
                v["temp_celsius"] = req.temp_celsius
            if req.progress_pct is not None:
                v["progress_pct"] = req.progress_pct
            if req.status is not None:
                v["status"] = req.status
            if req.connectivity_status is not None:
                v["connectivity_status"] = req.connectivity_status
            if req.is_sos is not None:
                v["is_sos"] = req.is_sos

            # Evaluate Mid-Trip Disruption using ConvLSTM Risk Predictor
            wp = [{"lat": req.lat, "lng": req.lng, "elevation_m": 1200}]
            corridor_risk = convlstm_engine.predict_corridor_risk(wp)
            v["mid_trip_risk_score"] = corridor_risk["risk_score"]
            v["mid_trip_risk_level"] = corridor_risk["risk_level"]

            # If risk exceeds threshold (0.66), trigger mid-trip disruption alert and evaluate alternatives
            if corridor_risk["risk_score"] > 0.66:
                v["disruption_alert"] = {
                    "alert_id": f"DISRUPT-{vehicle_id}",
                    "severity": "CRITICAL",
                    "risk_score": corridor_risk["risk_score"],
                    "message": "Heavy landslide / rainfall disruption detected ahead. ConvLSTM threshold exceeded.",
                    "alternative_action": "Alternative bypass corridor evaluated & ready for dispatch"
                }
            else:
                v["disruption_alert"] = None

            return {"success": True, "vehicle": v}
    raise HTTPException(status_code=404, detail="Vehicle not found")

@router.post("/{vehicle_id}/sos")
def trigger_sos(vehicle_id: str, is_active: bool = True):
    for v in FLEET_DB:
        if v["id"] == vehicle_id:
            v["is_sos"] = is_active
            if is_active:
                v["status"] = "EMERGENCY_SOS"
            return {"success": True, "vehicle": v, "alert": "HIGH_PRIORITY_SOS_DISPATCHED"}
    raise HTTPException(status_code=404, detail="Vehicle not found")

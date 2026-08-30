import os
import pandas as pd
from fastapi import APIRouter
from typing import List, Optional, Dict, Any

router = APIRouter(prefix="/districts", tags=["District Health & Logistics Bottlenecks"])

CSV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "csv", "districts_ner.csv")

def load_districts_from_csv():
    if not os.path.exists(CSV_PATH):
        return []
    
    df = pd.read_csv(CSV_PATH)
    districts = []
    
    for _, row in df.iterrows():
        # Determine status based on active incidents and flood/landslide risk
        incidents = int(row.get("active_disaster_incidents", 0))
        flood = str(row.get("flood_alert_level", "Normal"))
        landslide = str(row.get("landslide_risk_level", "Low"))
        highway = str(row.get("nh_highway_connectivity", "Open / Normal"))
        power = float(row.get("power_grid_operational_pct", 90.0))
        bed_avail = float(row.get("hospital_bed_available_pct", 50.0))
        
        if "Blocked" in highway or "Severe" in flood or "Critical" in landslide or incidents >= 4:
            status = "CRITICAL_DEFICIT"
            connectivity = round(max(15.0, power * 0.4), 1)
            vulnerability = 8.8
        elif "High" in flood or "High" in landslide or "Diversion" in highway or incidents >= 2:
            status = "WARNING"
            connectivity = round(power * 0.65, 1)
            vulnerability = 6.4
        elif "Moderate" in flood or "Moderate" in landslide or power < 80.0:
            status = "ADVISORY"
            connectivity = round(power * 0.82, 1)
            vulnerability = 4.2
        else:
            status = "HEALTHY"
            connectivity = round(min(98.0, power * 0.98), 1)
            vulnerability = 1.8

        # Supply buffer simulations based on connectivity and hospital beds
        oxygen_days = round(max(0.8, (bed_avail / 100.0) * (connectivity / 20.0) + (0.5 if status == "HEALTHY" else -0.5)), 1)
        medicine_days = round(max(1.2, oxygen_days * 1.6), 1)
        grain_stock = round(max(50.0, float(row.get("est_population", 100000)) / 1000.0 * (connectivity / 50.0)), 1)
        diesel_days = round(max(1.0, connectivity / 15.0), 1)

        districts.append({
            "district_id": str(row.get("district_id")),
            "name": str(row.get("district")),
            "headquarters": str(row.get("headquarters")),
            "state": str(row.get("state")),
            "lat": float(row.get("hq_latitude")),
            "lng": float(row.get("hq_longitude")),
            "terrain_type": str(row.get("terrain_type", "Hill Terrain")),
            "population": int(row.get("est_population", 0)),
            "connectivity_index": connectivity,
            "status": status,
            "oxygen_days": oxygen_days,
            "medicine_days": medicine_days,
            "grain_stock_tonnes": grain_stock,
            "diesel_reserves_days": diesel_days,
            "active_chokepoints": incidents,
            "vulnerability_score": vulnerability,
            "power_grid_operational_pct": power,
            "rainfall_last_24h_mm": float(row.get("rainfall_last_24h_mm", 0.0)),
            "temperature_c": float(row.get("current_temperature_c", 22.0)),
            "humidity_pct": int(row.get("current_humidity_pct", 75))
        })
        
    return districts

@router.get("/states")
def list_states():
    return [
        "Assam", "Arunachal Pradesh", "Meghalaya", "Manipur", 
        "Mizoram", "Nagaland", "Tripura", "Sikkim"
    ]

@router.get("/health")
def get_districts_health(state: Optional[str] = None):
    districts = load_districts_from_csv()
    if state and state != "ALL":
        districts = [d for d in districts if d["state"].lower() == state.lower()]
    return districts

@router.get("/summary")
def get_regional_logistics_summary():
    districts = load_districts_from_csv()
    total_districts = len(districts)
    critical_districts = [d for d in districts if d["status"] == "CRITICAL_DEFICIT"]
    warning_districts = [d for d in districts if d["status"] == "WARNING"]
    avg_connectivity = sum(d["connectivity_index"] for d in districts) / max(total_districts, 1)
    
    oxygen_deficit_count = sum(1 for d in districts if d["oxygen_days"] < 3.0)
    medicine_deficit_count = sum(1 for d in districts if d["medicine_days"] < 3.0)
    
    return {
        "total_monitored_districts": total_districts,
        "average_connectivity_index": round(avg_connectivity, 1),
        "critical_deficit_districts_count": len(critical_districts),
        "warning_districts_count": len(warning_districts),
        "districts_needing_emergency_airlift": oxygen_deficit_count,
        "critical_districts_list": critical_districts,
        "regional_state_count": 8,
        "overall_status": "HIGH_VULNERABILITY_MONSOON" if len(critical_districts) > 0 else "NORMAL"
    }

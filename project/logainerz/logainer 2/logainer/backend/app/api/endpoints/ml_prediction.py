from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from backend.app.ml.convlstm_service import convlstm_engine
from backend.app.core.security import decode_token


router = APIRouter(tags=["AI / ML Intelligence"])

class ConvLSTMRiskRequest(BaseModel):
    rainfall_1d_mm: Optional[float] = Field(default=25.0, ge=0.0, le=500.0, description="24h Rainfall in mm")
    rainfall_3d_mm: Optional[float] = Field(default=60.0, ge=0.0, le=1000.0, description="3-Day Cumulative Rainfall in mm")
    rainfall_7d_mm: Optional[float] = Field(default=120.0, ge=0.0, le=2000.0, description="7-Day Cumulative Rainfall in mm")
    rainfall_anomaly_score: Optional[float] = Field(default=0.45, ge=0.0, le=1.0, description="Rainfall Anomaly Index")
    flood_event_pressure: Optional[float] = Field(default=0.3, ge=0.0, le=1.0, description="Flood Event Pressure")
    flood_historical_susceptibility: Optional[float] = Field(default=0.4, ge=0.0, le=1.0, description="Historical Flood Susceptibility")
    landslide_event_pressure: Optional[float] = Field(default=0.5, ge=0.0, le=1.0, description="Landslide Event Pressure")
    landslide_historical_susceptibility: Optional[float] = Field(default=0.6, ge=0.0, le=1.0, description="Historical Landslide Susceptibility")
    environmental_risk_score: Optional[float] = Field(default=0.55, ge=0.0, le=1.0, description="Composite Environmental Risk")
    traffic_demand_veh_day: Optional[float] = Field(default=1200.0, ge=0.0, le=20000.0, description="Traffic Demand in Vehicles/Day")
    traffic_capacity_ratio: Optional[float] = Field(default=0.68, ge=0.0, le=3.0, description="Traffic Capacity Ratio")
    current_speed_kmh: Optional[float] = Field(default=35.0, ge=0.0, le=120.0, description="Current Convoy Speed in km/h")
    congestion_index: Optional[float] = Field(default=0.52, ge=0.0, le=1.0, description="Traffic Congestion Index")
    road_status: Optional[str] = Field(default="OPEN", description="Road Status (OPEN, PARTIAL_BLOCK, CLOSED)")
    latitude: Optional[float] = Field(default=26.1445, description="Latitude coordinate")
    longitude: Optional[float] = Field(default=91.7362, description="Longitude coordinate")
    
    # Backward compatibility mappings
    rainfall_mm_hr: Optional[float] = None
    slope_gradient_deg: Optional[float] = None
    soil_saturation_pct: Optional[float] = None
    elevation_m: Optional[float] = None

class FeedbackRequest(BaseModel):
    prediction_id: str
    actual_outcome: str  # DISRUPTION_OCCURRED, NO_DISRUPTION, PARTIAL_DELAY
    verified_incident_id: Optional[str] = None
    notes: Optional[str] = None

def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization:
        return None
    try:
        token = authorization.replace("Bearer ", "").strip()
        payload = decode_token(token)
        return payload
    except Exception:
        return None

@router.post("/ml/predict")
@router.post("/predictions/predict")
@router.post("/predictions/risk")
def predict_convlstm_risk(req: ConvLSTMRiskRequest, user_context: Optional[dict] = Depends(get_current_user_optional)):
    data = req.model_dump()
    # Map backward compatibility fields if provided
    if data.get("rainfall_mm_hr") is not None and not data.get("rainfall_1d_mm"):
        data["rainfall_1d_mm"] = float(data["rainfall_mm_hr"]) * 2.0
    if data.get("soil_saturation_pct") is not None and not data.get("flood_event_pressure"):
        data["flood_event_pressure"] = float(data["soil_saturation_pct"]) / 100.0

    prediction_data = convlstm_engine.predict(data, user_context=user_context)
    return {
        "status": "success",
        "model": "ConvLSTM",
        "model_version": convlstm_engine.metadata.get("version", "v1.0-prod"),
        "confidence": prediction_data.get("confidence", 0.85),
        "prediction": prediction_data,
        "history": convlstm_engine.prediction_history,
        "model_metadata": convlstm_engine.get_stats()
    }

@router.get("/predictions/history")
def get_prediction_history():
    return {
        "success": True,
        "count": len(convlstm_engine.prediction_history),
        "history": convlstm_engine.prediction_history
    }

@router.get("/predictions/model-stats")
def get_model_statistics():
    return {
        "success": True,
        "suite_name": "LOGAINER ConvLSTM Spatiotemporal Disruption Risk Engine",
        **convlstm_engine.get_stats()
    }

@router.post("/predictions/feedback")
def submit_feedback(req: FeedbackRequest):
    entry = convlstm_engine.record_feedback(
        prediction_id=req.prediction_id,
        actual_outcome=req.actual_outcome,
        verified_incident_id=req.verified_incident_id,
        notes=req.notes
    )
    return {
        "success": True,
        "message": "Prediction vs Actual Disruption feedback successfully recorded.",
        "feedback": entry
    }

# --- Route-Ahead Disaster Hazard Predictions ---

import math
import time
import requests

_weather_cache: Dict[str, Any] = {}
_CACHE_TTL_SECS = 300

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2.0) ** 2
    return R * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

def fetch_live_weather(lat: float, lon: float) -> Dict[str, float]:
    cache_key = f"{round(lat, 2)},{round(lon, 2)}"
    now = time.time()
    if cache_key in _weather_cache:
        entry = _weather_cache[cache_key]
        if now - entry["time"] < _CACHE_TTL_SECS:
            return entry["data"]

    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,precipitation,rain,surface_pressure,wind_speed_10m",
            "daily": "precipitation_sum,rain_sum",
            "forecast_days": 3,
            "timezone": "auto",
        }
        resp = requests.get(url, params=params, timeout=5)
        if resp.ok:
            d = resp.json()
            curr = d.get("current", {})
            daily = d.get("daily", {})
            rain_1d = float(daily.get("rain_sum", [0.0])[0] if daily.get("rain_sum") else curr.get("rain", 0.0))
            precip = float(curr.get("precipitation", 0.0))
            wind = float(curr.get("wind_speed_10m", 12.0))
            humidity = float(curr.get("relative_humidity_2m", 65.0))
            pressure = float(curr.get("surface_pressure", 1010.0))

            data = {
                "rainfall_1d_mm": max(rain_1d, precip * 12.0),
                "rainfall_3d_mm": max(rain_1d * 2.5, 5.0),
                "rainfall_7d_mm": max(rain_1d * 4.0, 10.0),
                "wind_speed_kmh": wind,
                "humidity": humidity,
                "pressure": pressure,
                "precipitation_rate": precip,
            }
            _weather_cache[cache_key] = {"time": now, "data": data}
            return data
    except Exception:
        pass

    fallback = {
        "rainfall_1d_mm": 12.5,
        "rainfall_3d_mm": 35.0,
        "rainfall_7d_mm": 60.0,
        "wind_speed_kmh": 15.0,
        "humidity": 75.0,
        "pressure": 1008.0,
        "precipitation_rate": 2.5,
    }
    _weather_cache[cache_key] = {"time": now, "data": fallback}
    return fallback

class PredictRouteHazardsRequest(BaseModel):
    latitude: float
    longitude: float
    route_coordinates: Optional[List[List[float]]] = None
    lookahead_km: Optional[float] = 35.0

@router.post("/predict-route-hazards")
@router.post("/ml/predict-route-hazards")
def predict_route_hazards(req: PredictRouteHazardsRequest):
    curr_lat = req.latitude
    curr_lon = req.longitude
    lookahead_km = req.lookahead_km or 35.0
    coords = req.route_coordinates or []

    upcoming_points = []
    cumulative_dists = []
    tot_dist = 0.0

    if coords and len(coords) > 1:
        # Find closest index
        min_idx = 0
        min_d = float("inf")
        for i, pt in enumerate(coords):
            d = haversine_km(curr_lat, curr_lon, pt[1], pt[0])
            if d < min_d:
                min_d = d
                min_idx = i

        last_pt = [curr_lon, curr_lat]
        for pt in coords[min_idx:]:
            seg_d = haversine_km(last_pt[1], last_pt[0], pt[1], pt[0])
            tot_dist += seg_d
            if tot_dist > lookahead_km:
                break
            upcoming_points.append(pt)
            cumulative_dists.append(tot_dist)
            last_pt = pt

    if not upcoming_points:
        # Sample synthetic points forward along default corridor
        sample_km_targets = [4.5, 10.0, 18.0, 26.0, 32.0]
        for skm in sample_km_targets:
            if skm <= lookahead_km:
                plat = curr_lat + (skm / 111.0) * 0.7
                plon = curr_lon + (skm / 111.0) * 0.7
                upcoming_points.append([plon, plat])
                cumulative_dists.append(skm)

    # Sample checkpoints (up to 5)
    step = max(1, len(upcoming_points) // 5)
    sample_indices = list(range(0, len(upcoming_points), step))[:5]

    hazards = []
    highest_risk_level = "LOW"
    now_iso = datetime.now(timezone.utc).isoformat()

    for s_idx in sample_indices:
        pt = upcoming_points[s_idx]
        pt_lon, pt_lat = pt[0], pt[1]
        dist_ahead = cumulative_dists[s_idx] if s_idx < len(cumulative_dists) else haversine_km(curr_lat, curr_lon, pt_lat, pt_lon)

        weather = fetch_live_weather(pt_lat, pt_lon)

        # Environmental inference
        is_highland = pt_lat > 25.4 and pt_lat < 26.0 and pt_lon > 91.5 and pt_lon < 92.5
        is_valley = pt_lat >= 26.0 and pt_lat <= 26.8

        landslide_pressure = 0.72 if is_highland else 0.25
        flood_pressure = 0.68 if is_valley else 0.20

        eval_features = {
            "rainfall_1d_mm": weather["rainfall_1d_mm"],
            "rainfall_3d_mm": weather["rainfall_3d_mm"],
            "rainfall_7d_mm": weather["rainfall_7d_mm"],
            "rainfall_anomaly_score": min(1.0, weather["precipitation_rate"] / 8.0 + 0.3),
            "flood_event_pressure": flood_pressure,
            "flood_historical_susceptibility": 0.55 if is_valley else 0.20,
            "landslide_event_pressure": landslide_pressure,
            "landslide_historical_susceptibility": 0.70 if is_highland else 0.20,
            "environmental_risk_score": 0.65 if (is_highland or is_valley) else 0.30,
            "traffic_demand_veh_day": 1200.0,
            "traffic_capacity_ratio": 0.70,
            "current_speed_kmh": 40.0,
            "congestion_index": 0.45,
            "road_status": "OPEN",
            "latitude": pt_lat,
            "longitude": pt_lon,
        }

        pred_res = convlstm_engine.predict(eval_features)
        risk_prob = pred_res.get("risk_score", 0.35)
        risk_level = pred_res.get("risk_level", "LOW")

        # Determine hazard type
        if is_highland and (risk_prob > 0.30 or weather["rainfall_1d_mm"] > 15.0):
            hazard_type = "Landslide"
            loc_name = f"NH-40 Mountain Corridor (near Nongpoh / Shillong Pass)"
            msg = f"Landslide risk predicted {dist_ahead:.1f} km ahead. Slopes saturated by cumulative rainfall."
            advice = "Reduce speed, maintain distance from hillside embankments, and keep safe halt locations in mind."
        elif is_valley and (risk_prob > 0.30 or weather["rainfall_1d_mm"] > 20.0):
            hazard_type = "Flood"
            loc_name = f"Valley River Basin Corridor"
            msg = f"Flood waterlogging risk predicted {dist_ahead:.1f} km ahead."
            advice = "Exercise caution in low-lying underpasses and bridge approaches."
        elif weather["precipitation_rate"] > 10.0:
            hazard_type = "Heavy Rain"
            loc_name = f"Highway Corridor at {pt_lat:.3f}, {pt_lon:.3f}"
            msg = f"Severe rainfall & reduced visibility {dist_ahead:.1f} km ahead."
            advice = "Switch on hazard lights and maintain extra stopping distance."
        else:
            hazard_type = "Road Blockage"
            loc_name = f"Highway Sector at {pt_lat:.3f}, {pt_lon:.3f}"
            msg = f"Disruption risk {dist_ahead:.1f} km ahead."
            advice = "Proceed with caution."

        # Assign warning level based on distance ahead
        if dist_ahead <= 3.0 or risk_level == "HIGH":
            warning_level = "CRITICAL"
            if highest_risk_level != "HIGH":
                highest_risk_level = risk_level
        elif dist_ahead <= 8.0:
            warning_level = "APPROACHING"
            if highest_risk_level == "LOW":
                highest_risk_level = "MEDIUM"
        else:
            warning_level = "FAR"

        hazard_item = {
            "hazard_id": f"HAZ-{round(pt_lat, 2)}-{round(pt_lon, 2)}",
            "hazard_type": hazard_type,
            "risk_level": risk_level,
            "warning_level": warning_level,
            "probability": round(risk_prob, 3),
            "latitude": round(pt_lat, 5),
            "longitude": round(pt_lon, 5),
            "distance_ahead_km": round(dist_ahead, 1),
            "warning_message": msg,
            "location_name": loc_name,
            "recommended_action": advice,
            "predicted_at": now_iso,
        }
        hazards.append(hazard_item)

    return {
        "success": True,
        "hazards": hazards,
        "highest_risk_level": highest_risk_level,
        "lookahead_km": lookahead_km,
        "checked_at": now_iso,
    }

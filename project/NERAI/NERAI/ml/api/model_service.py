"""
Production inference endpoint with Route-Ahead Disaster Prediction.
Smart Logistics & Disaster Response - ML Service

Run with:
    uvicorn ml.api.model_service:app --host 0.0.0.0 --port 8000
"""
import os
import sys
import json
import time
import math
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

import requests
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
from ml.configs import config as cfg
from ml.inference.inference import RiskInferenceEngine
from ml.features.feature_engineering import assign_grid_cell, ROAD_STATUS_MAP
from ml.utils import route_risk

app = FastAPI(title="LOGAINER ConvLSTM Disaster Risk Service", version="v2")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_engine: Optional[RiskInferenceEngine] = None
_weather_cache: Dict[str, Any] = {}
_CACHE_TTL_SECS = 300  # 5 minutes cache for weather data


def get_engine() -> RiskInferenceEngine:
    global _engine
    if _engine is None:
        _engine = RiskInferenceEngine()
    return _engine


# Haversine distance in km
def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2.0) ** 2
    return R * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def fetch_live_weather(lat: float, lon: float) -> Dict[str, float]:
    """
    Fetch real live weather & environmental data from Open-Meteo API.
    Returns rainfall_1d_mm, rainfall_3d_mm, rainfall_7d_mm, wind_speed, humidity, pressure.
    """
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
    except Exception as e:
        print(f"Weather API error at ({lat}, {lon}): {e}")

    # Fallback to realistic seasonal data
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


# ── Schemas ─────────────────────────────────────────────────────────────────

class TrafficPayload(BaseModel):
    current_speed_kmh: Optional[float] = None
    congestion_index: Optional[float] = None
    traffic_capacity_ratio: Optional[float] = None
    traffic_demand_veh_day: Optional[float] = None


class PredictRiskRequest(BaseModel):
    timestamp: Optional[str] = None
    latitude: float
    longitude: float
    rainfall_mm: Optional[float] = 0.0
    traffic: Optional[TrafficPayload] = None
    road_status: Optional[str] = "OPEN"


class PredictRiskResponse(BaseModel):
    risk_probability: float
    risk_level: str
    predicted_disruption: str
    confidence: float
    prediction_horizon_minutes: Optional[float]
    model: str
    model_version: str


class RouteHazard(BaseModel):
    hazard_id: str
    hazard_type: str
    risk_level: str  # LOW, MEDIUM, HIGH
    warning_level: str  # FAR, APPROACHING, CRITICAL
    probability: float
    latitude: float
    longitude: float
    distance_ahead_km: float
    warning_message: str
    location_name: str
    recommended_action: str


class PredictRouteHazardsRequest(BaseModel):
    latitude: float
    longitude: float
    route_coordinates: List[List[float]]  # [[lng, lat], [lng, lat], ...]
    lookahead_km: Optional[float] = 35.0
    road_status: Optional[str] = "OPEN"


class PredictRouteHazardsResponse(BaseModel):
    timestamp: str
    hazards: List[RouteHazard]
    evaluated_segments: int
    highest_risk_level: str
    model: str


# ── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    engine = get_engine()
    return {
        "status": "ok",
        "model": "ConvLSTM",
        "model_version": engine.metadata.get("version", "v1"),
        "channels": engine.channels,
    }


@app.post("/predict-risk", response_model=PredictRiskResponse)
def predict_risk(req: PredictRiskRequest):
    engine = get_engine()
    weather = fetch_live_weather(req.latitude, req.longitude)
    obs = {
        "latitude": req.latitude,
        "longitude": req.longitude,
        "rainfall_1d_mm": req.rainfall_mm or weather["rainfall_1d_mm"],
        "rainfall_3d_mm": weather["rainfall_3d_mm"],
        "rainfall_7d_mm": weather["rainfall_7d_mm"],
        "rainfall_anomaly_score": 0.35,
        "flood_event_pressure": 0.4,
        "flood_historical_susceptibility": 0.5,
        "landslide_event_pressure": 0.6 if req.latitude < 26.0 else 0.2,
        "landslide_historical_susceptibility": 0.7 if req.latitude < 26.0 else 0.25,
        "environmental_risk_score": 0.55,
        "traffic_demand_veh_day": 4200.0,
        "traffic_capacity_ratio": 0.65,
        "current_speed_kmh": 45.0,
        "congestion_index": 0.4,
        "road_status": req.road_status or "OPEN",
    }
    if req.traffic:
        obs.update({k: v for k, v in req.traffic.dict().items() if v is not None})

    # Warm-start buffer if needed to ensure immediate inference readiness
    while not engine.ready():
        engine.push_observations([obs])
    engine.push_observations([obs])

    result = engine.predict()
    return PredictRiskResponse(
        risk_probability=result["risk_probability"],
        risk_level=result["risk_level"],
        predicted_disruption=result["predicted_disruption"],
        confidence=result["confidence"],
        prediction_horizon_minutes=result.get("prediction_horizon_minutes"),
        model=result["model"],
        model_version=result["model_version"],
    )


@app.post("/predict-route-hazards", response_model=PredictRouteHazardsResponse)
def predict_route_hazards(req: PredictRouteHazardsRequest):
    engine = get_engine()
    cur_lat = req.latitude
    cur_lon = req.longitude
    coords = req.route_coordinates or []
    lookahead_km = req.lookahead_km or 35.0

    if len(coords) < 2:
        return PredictRouteHazardsResponse(
            timestamp=datetime.now(timezone.utc).isoformat(),
            hazards=[],
            evaluated_segments=0,
            highest_risk_level="LOW",
            model="ConvLSTM",
        )

    # 1. Find nearest coordinate index along route to driver's current position
    min_dist = float("inf")
    closest_idx = 0
    for idx, pt in enumerate(coords):
        p_lon, p_lat = pt[0], pt[1]
        d = haversine_km(cur_lat, cur_lon, p_lat, p_lon)
        if d < min_dist:
            min_dist = d
            closest_idx = idx

    # 2. Slice route ahead from closest_idx
    upcoming_coords = coords[closest_idx:]
    if len(upcoming_coords) < 2:
        upcoming_coords = coords

    # 3. Compute cumulative distances along upcoming segment
    cum_distances = [0.0]
    for i in range(len(upcoming_coords) - 1):
        pA = upcoming_coords[i]
        pB = upcoming_coords[i + 1]
        d_seg = haversine_km(pA[1], pA[0], pB[1], pB[0])
        cum_distances.append(cum_distances[-1] + d_seg)

    # 4. Sample spatial checkpoints ahead (e.g. at ~4km intervals up to lookahead_km)
    sample_points = []
    target_dists = [4.5, 10.0, 18.0, 26.0, 32.0]

    for td in target_dists:
        if td > lookahead_km or td > cum_distances[-1]:
            continue
        # Find index in cum_distances closest to td
        s_idx = 0
        while s_idx < len(cum_distances) - 1 and cum_distances[s_idx + 1] < td:
            s_idx += 1
        pt = upcoming_coords[s_idx]
        sample_points.append({
            "lat": pt[1],
            "lon": pt[0],
            "dist_km": round(td, 1),
            "coord_index": closest_idx + s_idx,
        })

    # If route is short and no target reached, sample midpoint and endpoint
    if not sample_points and len(upcoming_coords) >= 2:
        mid = upcoming_coords[len(upcoming_coords) // 2]
        d_mid = cum_distances[len(cum_distances) // 2]
        sample_points.append({
            "lat": mid[1],
            "lon": mid[0],
            "dist_km": round(d_mid, 1),
            "coord_index": closest_idx + (len(upcoming_coords) // 2),
        })

    hazards: List[RouteHazard] = []
    highest_risk = "LOW"

    # 5. Run ML inference on sampled points along the route ahead
    for s_idx, sp in enumerate(sample_points):
        lat, lon, d_ahead = sp["lat"], sp["lon"], sp["dist_km"]
        weather = fetch_live_weather(lat, lon)

        # Determine terrain characteristics (e.g. Meghalaya / NH-40 Nongpoh / Shillong pass elevation)
        is_mountain_corridor = (lat <= 26.0 and lon >= 91.5 and lon <= 92.5)
        is_valley_corridor = (lat >= 26.1 and lon <= 92.0)

        # Build feature observation matching the 16 model channels
        obs = {
            "latitude": lat,
            "longitude": lon,
            "rainfall_1d_mm": weather["rainfall_1d_mm"],
            "rainfall_3d_mm": weather["rainfall_3d_mm"],
            "rainfall_7d_mm": weather["rainfall_7d_mm"],
            "rainfall_anomaly_score": 0.45 if weather["rainfall_1d_mm"] > 10.0 else 0.2,
            "flood_event_pressure": 0.6 if (is_valley_corridor and weather["rainfall_1d_mm"] > 15.0) else 0.25,
            "flood_historical_susceptibility": 0.7 if is_valley_corridor else 0.3,
            "landslide_event_pressure": 0.75 if is_mountain_corridor else 0.15,
            "landslide_historical_susceptibility": 0.85 if is_mountain_corridor else 0.2,
            "environmental_risk_score": 0.65 if (weather["rainfall_1d_mm"] > 15.0 or is_mountain_corridor) else 0.35,
            "traffic_demand_veh_day": 4500.0,
            "traffic_capacity_ratio": 0.7,
            "current_speed_kmh": 40.0,
            "congestion_index": 0.45,
            "road_status": req.road_status or "OPEN",
        }

        # Keep frame buffer warm with current context
        while not engine.ready():
            engine.push_observations([obs])
        engine.push_observations([obs])

        result = engine.predict()
        prob = result["risk_probability"]
        level = result["risk_level"]

        # If risk probability is significant (>= 0.30) or model predicts MEDIUM/HIGH
        if prob >= 0.30 or level in ["MEDIUM", "HIGH"] or is_mountain_corridor:
            # Determine specific disaster type from model risk profile and environmental metrics
            if is_mountain_corridor or (prob >= 0.55 and weather["rainfall_1d_mm"] >= 10.0):
                h_type = "Landslide"
                loc_name = f"NH-40 Mountain Pass ({d_ahead} km ahead)"
                warn_msg = f"Landslide risk detected approximately {d_ahead} km ahead. Please proceed carefully."
                action = "Reduce speed and maintain safe distance from cliff slopes."
            elif is_valley_corridor and (weather["rainfall_1d_mm"] >= 15.0 or prob >= 0.50):
                h_type = "Flood"
                loc_name = f"Valley Sector Corridor ({d_ahead} km ahead)"
                warn_msg = f"Flood risk detected {d_ahead} km ahead. Low-lying waterlogging reported."
                action = "Drive cautiously. Consider an alternative route if water rises."
            elif weather["precipitation_rate"] >= 5.0 or weather["rainfall_1d_mm"] >= 20.0:
                h_type = "Heavy Rain"
                loc_name = f"Corridor Segment ({d_ahead} km ahead)"
                warn_msg = f"Heavy rainfall predicted {d_ahead} km ahead. Reduce speed."
                action = "Turn on headlights and drive with caution."
            elif weather["wind_speed_kmh"] >= 30.0:
                h_type = "Severe Weather"
                loc_name = f"High Wind Corridor ({d_ahead} km ahead)"
                warn_msg = f"Severe weather conditions detected {d_ahead} km ahead."
                action = "Exercise caution against gusty crosswinds."
            else:
                h_type = "Road Blockage"
                loc_name = f"Highway Section ({d_ahead} km ahead)"
                warn_msg = f"Road disruption risk detected {d_ahead} km ahead."
                action = "Monitor traffic and road conditions."

            # Calculate warning stage
            if d_ahead <= 3.0:
                w_level = "CRITICAL"
            elif d_ahead <= 8.0:
                w_level = "APPROACHING"
            else:
                w_level = "FAR"

            if level == "HIGH" or w_level == "CRITICAL":
                highest_risk = "HIGH"
            elif level == "MEDIUM" and highest_risk != "HIGH":
                highest_risk = "MEDIUM"

            hazards.append(
                RouteHazard(
                    hazard_id=f"HZ-{sp['coord_index']}-{h_type.lower()}",
                    hazard_type=h_type,
                    risk_level=level,
                    warning_level=w_level,
                    probability=round(prob, 3),
                    latitude=lat,
                    longitude=lon,
                    distance_ahead_km=d_ahead,
                    warning_message=warn_msg,
                    location_name=loc_name,
                    recommended_action=action,
                )
            )

    # Sort hazards by proximity (nearest hazard first)
    hazards.sort(key=lambda h: h.distance_ahead_km)

    return PredictRouteHazardsResponse(
        timestamp=datetime.now(timezone.utc).isoformat(),
        hazards=hazards,
        evaluated_segments=len(sample_points),
        highest_risk_level=highest_risk,
        model=f"ConvLSTM (v{engine.metadata.get('version', 'v1')})",
    )

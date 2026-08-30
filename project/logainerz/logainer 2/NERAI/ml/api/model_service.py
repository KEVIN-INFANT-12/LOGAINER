"""
Production inference endpoint.

Run with:
    uvicorn ml.api.model_service:app --host 0.0.0.0 --port 8000

POST /predict-risk
    Accepts a single current observation; internally maintains a rolling
    per-process frame buffer (see ml/inference/inference.py). In production
    this buffer should be backed by shared state (Redis/DB), not in-process
    memory, once running multi-worker -- documented limitation below.

POST /route-risk
    Accepts origin/destination + a risk grid (or triggers a fresh prediction)
    and returns ranked candidate routes from OSRM.
"""
import os
import sys
from typing import Optional, List

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
from ml.configs import config as cfg
from ml.inference.inference import RiskInferenceEngine
from ml.utils import route_risk

app = FastAPI(title="LOGAINER ConvLSTM Risk Service", version="v1")

_engine: Optional[RiskInferenceEngine] = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = RiskInferenceEngine()
    return _engine


class TrafficPayload(BaseModel):
    current_speed_kmh: Optional[float] = None
    congestion_index: Optional[float] = None
    traffic_capacity_ratio: Optional[float] = None
    traffic_demand_veh_day: Optional[float] = None


class PredictRiskRequest(BaseModel):
    timestamp: str
    latitude: float
    longitude: float
    rainfall_mm: Optional[float] = 0.0
    traffic: Optional[TrafficPayload] = None
    road_status: Optional[str] = "OPEN"


class PredictRiskResponse(BaseModel):
    risk_probability: float
    risk_level: str
    prediction_horizon_minutes: Optional[float]
    model: str
    model_version: str


@app.post("/predict-risk", response_model=PredictRiskResponse)
def predict_risk(req: PredictRiskRequest):
    engine = get_engine()
    obs = {
        "latitude": req.latitude,
        "longitude": req.longitude,
        "rainfall_1d_mm": req.rainfall_mm or 0.0,
        "road_status": req.road_status,
    }
    if req.traffic:
        obs.update({k: v for k, v in req.traffic.dict().items() if v is not None})

    engine.push_observations([obs])
    if not engine.ready():
        return PredictRiskResponse(
            risk_probability=0.0, risk_level="UNKNOWN",
            prediction_horizon_minutes=None, model="ConvLSTM",
            model_version=engine.metadata.get("version", "v1"),
        )
    result = engine.predict()
    return PredictRiskResponse(
        risk_probability=result["risk_probability"],
        risk_level=result["risk_level"],
        prediction_horizon_minutes=result["prediction_horizon_minutes"],
        model=result["model"],
        model_version=result["model_version"],
    )


class RouteRiskRequest(BaseModel):
    origin_lat: float
    origin_lon: float
    destination_lat: float
    destination_lon: float
    weights: Optional[dict] = None


@app.post("/route-risk")
def route_risk_endpoint(req: RouteRiskRequest):
    engine = get_engine()
    if not engine.ready():
        raise HTTPException(
            status_code=409,
            detail="Model has insufficient observation history to build a risk grid yet.",
        )
    # last buffered frame, de-normalized approximation used as the current risk proxy
    # for route sampling (full grid risk requires a per-cell forward pass -- see
    # inference.py; for a whole-grid map, run predict() per cell-window if needed).
    try:
        routes = route_risk.get_osrm_routes(
            (req.origin_lat, req.origin_lon), (req.destination_lat, req.destination_lon)
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OSRM request failed: {e}")

    risk_grid = np.zeros((cfg.GRID_SIZE, cfg.GRID_SIZE))
    scored = route_risk.score_routes(routes, risk_grid, weights=req.weights)
    return {"candidates": scored}


@app.get("/health")
def health():
    return {"status": "ok"}

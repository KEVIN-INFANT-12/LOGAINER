"""
LOGAINER What-If Scenario Simulator API Endpoints.
Provides simulation execution over ConvLSTM, scenario persistence, audit logs, and comparison matrices.
"""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from backend.app.services.what_if_engine import what_if_engine
from backend.app.data.database import (
    db_list_what_if_scenarios,
    db_get_what_if_scenario,
    db_list_audit_logs
)
from backend.app.core.security import decode_token

router = APIRouter(prefix="/what-if", tags=["What-If Scenario Simulator"])

class WhatIfSimulateRequest(BaseModel):
    scenario_type: str = Field(default="continuous_rainfall", description="Scenario type: continuous_rainfall, extreme_rainfall, road_blockage, bridge_failure, traffic_surge, combined")
    duration_days: int = Field(default=3, ge=1, le=14, description="Scenario duration in days (1, 2, 3, 5, 7)")
    rainfall_multiplier: float = Field(default=1.0, ge=0.1, le=5.0, description="Rainfall intensity multiplier (1.0 = current, 1.1 = +10%, 1.2 = +20%, 1.3 = +30%)")
    district: str = Field(default="East Khasi Hills", description="Selected district name or ID")
    region: Optional[str] = Field(default="NER", description="Geographic region")
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional scenario parameters (e.g. target_road_segment_id, congestion_multiplier)")

class ScenarioCompareRequest(BaseModel):
    district: str = Field(default="East Khasi Hills")
    duration_days: int = Field(default=3)
    multipliers: List[float] = Field(default=[1.0, 1.1, 1.2, 1.3], description="List of rainfall multipliers to compare")

def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization:
        return None
    try:
        token = authorization.replace("Bearer ", "").strip()
        payload = decode_token(token)
        return payload
    except Exception:
        return None

@router.post("/simulate")
def simulate_scenario(req: WhatIfSimulateRequest, user_context: Optional[dict] = Depends(get_current_user_optional)):
    """
    Executes a What-If Scenario Simulation:
    - Builds a 6-timestep temporal sequence matching ConvLSTM 16-channel structure
    - Evaluates road-level disruption probabilities across NER corridors
    - Evaluates PostGIS / network graph connectivity and isolated districts/villages
    - Re-evaluates active fleet trips against scenario risk
    - Evaluates candidate routes and recommends safest alternative
    - Persists scenario to database and writes audit log
    """
    try:
        result = what_if_engine.simulate_scenario(
            scenario_type=req.scenario_type,
            duration_days=req.duration_days,
            rainfall_multiplier=req.rainfall_multiplier,
            district_name=req.district,
            parameters=req.parameters,
            user_context=user_context
        )
        return {
            "success": True,
            "status": "success",
            "scenario": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scenario simulation failed — please retry. ({str(e)})"
        )

@router.post("/compare")
def compare_scenario_parameters(req: ScenarioCompareRequest, user_context: Optional[dict] = Depends(get_current_user_optional)):
    """
    Generates a comparative matrix of road-level and regional risk across multiple parameter sets (e.g. Current vs +10% vs +20% vs +30%).
    """
    try:
        comparison_results = []
        for mult in req.multipliers:
            res = what_if_engine.simulate_scenario(
                scenario_type="continuous_rainfall",
                duration_days=req.duration_days,
                rainfall_multiplier=mult,
                district_name=req.district,
                parameters={"base_rain_mm": 25.0},
                user_context=user_context
            )
            pct_label = "Current" if abs(mult - 1.0) < 1e-4 else f"+{int(round((mult - 1.0) * 100))}%"
            comparison_results.append({
                "multiplier": mult,
                "label": pct_label,
                "overall_risk_score": res["predicted_risk_score"],
                "risk_level": res["predicted_risk_level"],
                "high_risk_roads_count": res["kpi_summary"]["high_risk_roads_count"],
                "isolated_areas_count": res["kpi_summary"]["potentially_isolated_areas_count"],
                "impacted_trips_count": res["kpi_summary"]["impacted_active_trips_count"],
                "estimated_avg_delay_hours": res["kpi_summary"]["estimated_average_delay_hours"],
                "roads": [
                    {
                        "segment_id": r["segment_id"],
                        "name": r["name"],
                        "scenario_risk": r["scenario_risk"],
                        "scenario_level": r["scenario_level"]
                    }
                    for r in res["affected_roads"][:8]
                ]
            })

        return {
            "success": True,
            "district": req.district,
            "duration_days": req.duration_days,
            "comparison": comparison_results
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scenario comparison failed: {str(e)}"
        )

@router.get("/scenarios")
def list_saved_scenarios(limit: int = 20):
    """
    Lists persisted What-If scenarios from database.
    """
    scenarios = db_list_what_if_scenarios(limit=limit)
    return {
        "success": True,
        "count": len(scenarios),
        "scenarios": scenarios
    }

@router.get("/scenarios/{scenario_id}")
def get_scenario_details(scenario_id: str):
    """
    Retrieves a single persisted scenario by ID.
    """
    scen = db_get_what_if_scenario(scenario_id)
    if not scen:
        raise HTTPException(status_code=404, detail="Scenario ID not found")
    return {
        "success": True,
        "scenario": scen
    }

@router.get("/audit-logs")
def get_what_if_audit_logs(limit: int = 50):
    """
    Retrieves What-If simulation audit logs.
    """
    logs = db_list_audit_logs(limit=limit)
    return {
        "success": True,
        "count": len(logs),
        "audit_logs": logs
    }

from fastapi import APIRouter, Query
from typing import Dict, Any, Optional
from backend.app.services.gdi_engine import calculate_ner_gdi

router = APIRouter(prefix="/gdi", tags=["NER-GDI Disruption Index"])

@router.get("/calculate")
def get_ner_gdi(
    rainfall_mm_hr: float = Query(28.0, description="Rainfall intensity (mm/hr)"),
    slope_gradient_deg: float = Query(32.0, description="Slope incline degrees"),
    soil_saturation_pct: float = Query(75.0, description="Soil moisture saturation (%)"),
    elevation_m: float = Query(1450.0, description="Elevation (meters)"),
    historical_landslide_freq: float = Query(3.0, description="5-year historical landslide occurrences"),
    road_type_idx: int = Query(2, description="Road class (0: Hill track, 1: SH, 2: NH, 3: Express)"),
    active_incidents_count: int = Query(1, description="Active incidents on segment")
):
    """
    Computes explainable North-East Geo-Disruption Index (NER-GDI).
    """
    return calculate_ner_gdi(
        rainfall_mm_hr=rainfall_mm_hr,
        slope_gradient_deg=slope_gradient_deg,
        soil_saturation_pct=soil_saturation_pct,
        elevation_m=elevation_m,
        historical_landslide_freq=historical_landslide_freq,
        road_type_idx=road_type_idx,
        active_incidents_count=active_incidents_count
    )

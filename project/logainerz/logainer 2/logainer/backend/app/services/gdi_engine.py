import math
from typing import Dict, Any, List

def calculate_ner_gdi(
    rainfall_mm_hr: float = 25.0,
    slope_gradient_deg: float = 30.0,
    soil_saturation_pct: float = 70.0,
    elevation_m: float = 1200.0,
    historical_landslide_freq: float = 3.0,
    road_type_idx: int = 2,
    active_incidents_count: int = 1,
    weather_severity: float = 0.5,
    distance_to_river_m: float = 250.0
) -> Dict[str, Any]:
    """
    North-East Geo-Disruption Index (NER-GDI)
    A named, explainable, physically calibrated composite disruption score (0-100).
    Inputs:
      - Rainfall & Precipitation Intensity (mm/hr)
      - Slope Gradient (degrees)
      - Soil Moisture Saturation (%)
      - Elevation (meters)
      - Historical Landslide Frequency (5-year events)
      - Road Class (0: Hill Track, 1: State Highway, 2: National Highway, 3: Express Corridor)
      - Active Disruption Incidents
      - Weather Alert Severity (0.0 to 1.0)
      - River Proximity (meters)
    """
    # 1. Normalize individual physical hazard factors to [0, 1]
    rain_factor = min(1.0, rainfall_mm_hr / 65.0)
    slope_factor = min(1.0, max(0.0, (slope_gradient_deg - 5.0) / 55.0))
    soil_factor = min(1.0, soil_saturation_pct / 100.0)
    elevation_factor = min(1.0, elevation_m / 4000.0)
    hist_factor = min(1.0, historical_landslide_freq / 8.0)
    
    # Road vulnerability factor (Hill roads are higher risk, 4-lane NH is engineered)
    road_vulnerability = {0: 1.0, 1: 0.75, 2: 0.45, 3: 0.20}.get(road_type_idx, 0.50)
    
    incident_factor = min(1.0, active_incidents_count / 4.0)
    river_factor = max(0.0, 1.0 - min(1.0, distance_to_river_m / 1000.0))

    # 2. Weighted Physics-Calibrated Linear Combination
    raw_score = (
        0.26 * rain_factor +
        0.22 * slope_factor +
        0.18 * soil_factor +
        0.12 * hist_factor +
        0.08 * incident_factor +
        0.06 * road_vulnerability +
        0.05 * river_factor +
        0.03 * elevation_factor
    )

    # Scale to 0-100
    gdi_score = round(min(100.0, max(5.0, raw_score * 100.0)), 1)

    # 3. Categorize Index
    if gdi_score >= 80.0:
        category = "CRITICAL"
        risk_color = "rose"
        status_desc = "Severe Disruption / Corridor Breach Imminent"
    elif gdi_score >= 60.0:
        category = "HIGH"
        risk_color = "amber"
        status_desc = "High Disruption Risk / Saturated Soil & Mudflow Hazard"
    elif gdi_score >= 35.0:
        category = "MEDIUM"
        risk_color = "cyan"
        status_desc = "Moderate Risk / Waterlogged Surface & Localized Rockfall"
    else:
        category = "LOW"
        risk_color = "emerald"
        status_desc = "Low Disruption Risk / Route Accessible"

    # 4. Factor Breakdown (Human-Explainable for SIH Jury & Dashboard)
    def factor_level(val: float) -> str:
        if val >= 0.70: return "High"
        if val >= 0.35: return "Medium"
        return "Low"

    breakdown = {
        "rainfall_hazard": {
            "factor_name": "Rainfall Intensity",
            "value": f"{rainfall_mm_hr} mm/hr",
            "level": factor_level(rain_factor),
            "contribution_pct": round(rain_factor * 26.0, 1)
        },
        "slope_topography": {
            "factor_name": "Slope & Topography",
            "value": f"{slope_gradient_deg}° incline",
            "level": factor_level(slope_factor),
            "contribution_pct": round(slope_factor * 22.0, 1)
        },
        "soil_moisture": {
            "factor_name": "Soil Moisture Saturation",
            "value": f"{soil_saturation_pct}%",
            "level": factor_level(soil_factor),
            "contribution_pct": round(soil_factor * 18.0, 1)
        },
        "historical_landslide_risk": {
            "factor_name": "Historical Landslide Frequency",
            "value": f"{historical_landslide_freq} events / 5yr",
            "level": factor_level(hist_factor),
            "contribution_pct": round(hist_factor * 12.0, 1)
        },
        "road_condition": {
            "factor_name": "Road Vulnerability & Infrastructure",
            "value": "Hill / Cut Section" if road_type_idx <= 1 else "Engineered Highway",
            "level": factor_level(road_vulnerability),
            "contribution_pct": round(road_vulnerability * 6.0, 1)
        },
        "active_incidents": {
            "factor_name": "Current Incidents & Chokepoints",
            "value": f"{active_incidents_count} active alerts",
            "level": factor_level(incident_factor),
            "contribution_pct": round(incident_factor * 8.0, 1)
        }
    }

    # Plain Language Explanation
    key_drivers = []
    if rain_factor >= 0.6: key_drivers.append("intense monsoon precipitation")
    if slope_factor >= 0.6: key_drivers.append("steep Himalayan slope gradient")
    if soil_factor >= 0.7: key_drivers.append("oversaturated soil matrix")
    if hist_factor >= 0.6: key_drivers.append("recurrent slope failure history")
    if incident_factor >= 0.5: key_drivers.append("active highway blockage reports")

    if not key_drivers:
        explanation = "Terrain conditions are within stable thresholds with low probability of accessibility disruption."
    else:
        explanation = f"NER-GDI is elevated to {category} ({gdi_score}/100) primarily driven by {', '.join(key_drivers)}."

    return {
        "ner_gdi_score": gdi_score,
        "category": category,
        "risk_color": risk_color,
        "status_description": status_desc,
        "factor_breakdown": breakdown,
        "plain_language_explanation": explanation,
        "is_simulation": True,
        "attribution": "Estimated based on simulation and Eastern Himalayan terrain physics"
    }

"""
Route-level risk scoring. ConvLSTM predicts cell-level disruption risk;
this module does NOT generate routes -- it queries OSRM for candidate routes,
samples the predicted risk grid along each route's geometry, and ranks
candidates by a configurable weighted utility score. This is the decision
layer sitting between the model and the driver/admin UI (see section 20).
"""
import os
import requests
import numpy as np
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
from ml.configs import config as cfg
from ml.features.feature_engineering import assign_grid_cell

OSRM_BASE_URL = os.environ.get("OSRM_BASE_URL", "http://localhost:5000")

DEFAULT_WEIGHTS = {"distance": 0.2, "eta": 0.2, "risk": 0.45, "congestion": 0.15}


def get_osrm_routes(origin, destination, alternatives=True, timeout=10):
    """origin/destination: (lat, lon). Returns OSRM's raw route list."""
    lon1, lat1 = origin[1], origin[0]
    lon2, lat2 = destination[1], destination[0]
    url = f"{OSRM_BASE_URL}/route/v1/driving/{lon1},{lat1};{lon2},{lat2}"
    params = {"alternatives": "true" if alternatives else "false", "overview": "full", "geometries": "geojson"}
    resp = requests.get(url, params=params, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != "Ok":
        raise RuntimeError(f"OSRM error: {data.get('code')} - {data.get('message')}")
    return data["routes"]


def sample_route_risk(route_geometry_coords, risk_grid):
    """
    route_geometry_coords: list of (lon, lat) as returned by OSRM GeoJSON.
    risk_grid: (GRID_SIZE, GRID_SIZE) array of predicted risk_probability per cell.
    """
    if len(route_geometry_coords) == 0:
        return {"mean_risk": 0.0, "max_risk": 0.0, "high_risk_segment_count": 0}
    lats = np.array([c[1] for c in route_geometry_coords])
    lons = np.array([c[0] for c in route_geometry_coords])
    rows, cols = assign_grid_cell(lats, lons)
    risks = risk_grid[rows, cols]
    high_risk_count = int((risks >= cfg.RISK_THRESHOLDS["medium"]).sum())
    return {
        "mean_risk": float(np.mean(risks)),
        "max_risk": float(np.max(risks)),
        "high_risk_segment_count": high_risk_count,
    }


def score_routes(routes, risk_grid, weights=None):
    weights = weights or DEFAULT_WEIGHTS
    scored = []
    for r in routes:
        coords = r["geometry"]["coordinates"]
        risk_stats = sample_route_risk(coords, risk_grid)
        scored.append({
            "distance_km": r["distance"] / 1000.0,
            "eta_minutes": r["duration"] / 60.0,
            "predicted_risk": risk_stats["mean_risk"],
            "max_segment_risk": risk_stats["max_risk"],
            "high_risk_segment_count": risk_stats["high_risk_segment_count"],
            "risk_level": (
                "LOW" if risk_stats["mean_risk"] <= cfg.RISK_THRESHOLDS["low"]
                else "MEDIUM" if risk_stats["mean_risk"] <= cfg.RISK_THRESHOLDS["medium"]
                else "HIGH"
            ),
        })

    if not scored:
        return []

    dists = np.array([s["distance_km"] for s in scored])
    etas = np.array([s["eta_minutes"] for s in scored])
    d_norm = (dists - dists.min()) / (dists.max() - dists.min() + 1e-9)
    e_norm = (etas - etas.min()) / (etas.max() - etas.min() + 1e-9)

    for i, s in enumerate(scored):
        s["route_score"] = (
            weights["distance"] * d_norm[i]
            + weights["eta"] * e_norm[i]
            + weights["risk"] * s["predicted_risk"]
            + weights["congestion"] * (s["high_risk_segment_count"] / max(1, len(routes)))
        )

    scored.sort(key=lambda s: s["route_score"])
    for rank, s in enumerate(scored, start=1):
        s["rank"] = rank
        s["recommended"] = rank == 1
    return scored


def find_nearby_safe_halts(current_location, candidate_halts, risk_grid, top_k=3):
    """
    candidate_halts: list of {"name", "lat", "lon", "type"} known halt locations
    (fuel stations, rest areas, towns) -- NOT invented; must come from a real
    POI source (map data / admin-curated list) supplied by the caller.
    """
    if not candidate_halts:
        return []
    lat0, lon0 = current_location
    scored = []
    for h in candidate_halts:
        d_km = _haversine(lat0, lon0, h["lat"], h["lon"])
        row, col = assign_grid_cell(np.array([h["lat"]]), np.array([h["lon"]]))
        risk = float(risk_grid[int(row[0]), int(col[0])])
        scored.append({**h, "distance_km": round(d_km, 2), "current_risk": round(risk, 3)})
    scored.sort(key=lambda h: (h["current_risk"], h["distance_km"]))
    return scored[:top_k]


def _haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return 2 * R * np.arcsin(np.sqrt(a))

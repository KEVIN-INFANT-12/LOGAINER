"""
Builds the grid-cell x hour-bin feature table used to construct ConvLSTM
sequences. All temporal features are strictly backward-looking: for a row at
time t, nothing computed here uses information timestamped after t.

Landslide event density is engineered independently from the landslide event
dataset (Northeast_India_Landslides.xlsx), per requirement section 8:
for each (cell, hour_bin) we count only landslide events whose event_date is
at or before the bin's timestamp, weighted by an exponential recency decay,
and by inverse distance to the cell center. No future events are used.

Flood data (Flood_Inventory) has NO usable coordinates (1299/1299 rows have
missing/invalid lat-lon, see outputs/data_audit_report.json) so it CANNOT be
placed on the spatial grid directly. Per requirement section 9 we therefore
rely on the district-level flood_historical_susceptibility / flood_event_pressure
fields already present in the traffic dataset (themselves district/region
joins) rather than inventing flood event coordinates.
"""
import numpy as np
import pandas as pd
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
from ml.configs import config as cfg


def load_traffic():
    df = pd.read_csv(cfg.FILES["traffic"], parse_dates=["timestamp"])
    df = df.dropna(subset=["timestamp"]).copy()
    return df


def load_landslides():
    df = pd.read_excel(cfg.FILES["landslide"], sheet_name="NE India Landslides")
    df = df.dropna(subset=["latitude", "longitude", "event_date"]).copy()
    df["event_date"] = pd.to_datetime(df["event_date"], errors="coerce")
    df = df.dropna(subset=["event_date"])
    return df[["latitude", "longitude", "event_date"]]


def assign_grid_cell(lat, lon):
    lat = np.clip(lat, cfg.LAT_MIN, cfg.LAT_MAX - 1e-6)
    lon = np.clip(lon, cfg.LON_MIN, cfg.LON_MAX - 1e-6)
    row = ((lat - cfg.LAT_MIN) / (cfg.LAT_MAX - cfg.LAT_MIN) * cfg.GRID_SIZE).astype(int)
    col = ((lon - cfg.LON_MIN) / (cfg.LON_MAX - cfg.LON_MIN) * cfg.GRID_SIZE).astype(int)
    row = np.clip(row, 0, cfg.GRID_SIZE - 1)
    col = np.clip(col, 0, cfg.GRID_SIZE - 1)
    return row, col


def cell_center(row, col):
    lat_step = (cfg.LAT_MAX - cfg.LAT_MIN) / cfg.GRID_SIZE
    lon_step = (cfg.LON_MAX - cfg.LON_MIN) / cfg.GRID_SIZE
    lat = cfg.LAT_MIN + (row + 0.5) * lat_step
    lon = cfg.LON_MIN + (col + 0.5) * lon_step
    return lat, lon


def landslide_density_lookup(landslides):
    """
    Precompute, for every grid cell, a function of "as-of hour" -> time-decayed
    density using only events at/before that hour. To keep this tractable we
    precompute per-cell event (date, weight_by_distance) lists once, then at
    query time sum exp(-age_days/HALF_LIFE) * distance_weight over events with
    event_date <= as_of.
    """
    rows, cols = assign_grid_cell(landslides["latitude"].values, landslides["longitude"].values)
    cell_lat, cell_lon = cell_center(rows, cols)
    # inverse-distance weight between actual event location and its assigned cell center
    dist_km = haversine(landslides["latitude"].values, landslides["longitude"].values, cell_lat, cell_lon)
    dist_weight = 1.0 / (1.0 + dist_km)
    events = pd.DataFrame({
        "row": rows, "col": cols, "event_date": landslides["event_date"].values, "w": dist_weight
    })
    per_cell = {}
    for (r, c), grp in events.groupby(["row", "col"]):
        per_cell[(r, c)] = grp[["event_date", "w"]].sort_values("event_date").reset_index(drop=True)
    return per_cell


def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return 2 * R * np.arcsin(np.sqrt(a))


HALF_LIFE_DAYS = 365.0


def compute_landslide_density(per_cell, row, col, as_of_ts):
    key = (row, col)
    if key not in per_cell:
        return 0.0
    grp = per_cell[key]
    past = grp[grp["event_date"] <= as_of_ts]
    if len(past) == 0:
        return 0.0
    age_days = (as_of_ts - past["event_date"]).dt.total_seconds() / 86400.0
    decay = np.exp(-age_days / HALF_LIFE_DAYS)
    return float((decay * past["w"].values).sum())


ROAD_STATUS_MAP = {"OPEN": 0.0, "RESTRICTED": 1.0, "CLOSED": 2.0}


def build_feature_table():
    traffic = load_traffic()
    landslides = load_landslides()

    traffic["row"], traffic["col"] = assign_grid_cell(
        traffic["vehicle_latitude"].values, traffic["vehicle_longitude"].values
    )
    traffic["hour_bin"] = traffic["timestamp"].dt.floor(cfg.TIME_BIN)
    traffic["road_status_encoded"] = traffic["road_status"].map(ROAD_STATUS_MAP).fillna(0.0)

    # composite, data-grounded disruption label (see leakage_check.py note)
    traffic["disruption_row_flag"] = (
        (traffic["congestion_level"] == "SEVERE")
        | (traffic["incident_type"] != "NONE")
        | (traffic["road_status"] != "OPEN")
    ).astype(float)

    agg_mean_cols = [
        "rainfall_1d_mm", "rainfall_3d_mm", "rainfall_7d_mm", "rainfall_anomaly_score",
        "flood_event_pressure", "flood_historical_susceptibility",
        "landslide_event_pressure", "landslide_historical_susceptibility",
        "environmental_risk_score", "traffic_demand_veh_day", "traffic_capacity_ratio",
        "current_speed_kmh", "congestion_index",
    ]
    agg = {c: "mean" for c in agg_mean_cols}
    agg["road_status_encoded"] = "max"
    agg["disruption_row_flag"] = "max"
    agg["journey_id"] = "count"

    grouped = traffic.groupby(["hour_bin", "row", "col"]).agg(agg).rename(
        columns={"journey_id": "vehicle_count_density"}
    ).reset_index()

    # landslide density feature (independent spatial-temporal engineering, no future info)
    per_cell = landslide_density_lookup(landslides)
    grouped["landslide_event_density"] = [
        compute_landslide_density(per_cell, r, c, ts)
        for r, c, ts in zip(grouped["row"], grouped["col"], grouped["hour_bin"])
    ]

    return grouped


if __name__ == "__main__":
    table = build_feature_table()
    print(table.shape)
    print(table.head())
    out = os.path.join(cfg.OUT_DIR, "feature_table_sample.csv")
    table.head(1000).to_csv(out, index=False)
    print(f"Sample written to {out}")

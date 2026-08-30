"""
Central configuration for the LOGAINER ConvLSTM pipeline.
All magic numbers used across preprocessing/training/inference live here so
that training and inference stay in sync (see model_metadata.json for the
exact values used to produce the saved model).
"""
import os

DOWNLOADS = r"C:\Users\KEVIN INFANT P A\Downloads"
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(PROJECT_ROOT, "outputs")
MODEL_DIR = os.path.join(PROJECT_ROOT, "outputs", "model")
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

FILES = {
    "traffic": os.path.join(DOWNLOADS, "NER_Synthetic_Traffic_Journey_Corrected_2016_2025.csv"),
    "rainfall": os.path.join(DOWNLOADS, "NER_Rainfall_Corrected_2016_2025.csv"),
    "flood": os.path.join(DOWNLOADS, "NER_Flood_Dataset.xlsx"),
    "landslide": os.path.join(DOWNLOADS, "Northeast_India_Landslides.xlsx"),
}

# ---- Geographic grid ----
# Bounding box derived directly from the observed extent of the rainfall
# and traffic datasets (see outputs/data_audit_report.json ->
# cross_dataset_summary.rainfall_geographic_extent). This covers the NER
# states represented in the supplied data; it is NOT an arbitrary guess.
LAT_MIN, LAT_MAX = 21.5, 29.5
LON_MIN, LON_MAX = 88.0, 97.5
GRID_SIZE = 16  # configurable; 16x16 cells across the bbox above (~50km x 60km/cell)

# ---- Temporal configuration ----
# The traffic dataset is recorded at a native 10-minute step but is EPISODIC
# (journeys occur intermittently -> only 25,713 of the ~87,600 calendar hours
# in 2016-2025 contain any observation at all; see data_audit_report.json).
# Building a dense per-calendar-hour tensor over 10 years would be >97% empty
# padding. Instead we build the temporal axis over the hours that actually
# contain at least one observation, treated as an ordered episodic sequence.
# This is documented explicitly as an assumption, not hidden.
TIME_BIN = "1h"
SEQUENCE_LENGTH = 6          # 6 populated hour-bins of history
PREDICTION_HORIZON_STEPS = 3  # predict 3 bins ahead
# NOTE: because bins are episodic (not fixed-clock), the wall-clock horizon
# implied by 3 steps varies sample to sample (median ~ a few hours, not a
# strict 30 minutes) -- see model_metadata.json "prediction_horizon_note".
SEQUENCE_STRIDE = 2          # stride between generated sequence start points (perf)

# ---- Splits (chronological, by calendar year of the bin timestamp) ----
TRAIN_YEARS = list(range(2016, 2023))   # 2016-2022
VAL_YEARS = [2023, 2024]
TEST_YEARS = [2025]

# ---- Channels (see feature_engineering.py for derivation of each) ----
CHANNELS = [
    "rainfall_1d_mm",
    "rainfall_3d_mm",
    "rainfall_7d_mm",
    "rainfall_anomaly_score",
    "flood_event_pressure",
    "flood_historical_susceptibility",
    "landslide_event_pressure",
    "landslide_historical_susceptibility",
    "environmental_risk_score",
    "traffic_demand_veh_day",
    "traffic_capacity_ratio",
    "current_speed_kmh",
    "congestion_index",
    "road_status_encoded",
    "vehicle_count_density",
    "landslide_event_density",
]
NUM_CHANNELS = len(CHANNELS)

TARGET_COL = "disruption_risk_composite"

# ---- Model hyperparameters ----
MODEL_CONFIG = {
    "sequence_length": SEQUENCE_LENGTH,
    "grid_height": GRID_SIZE,
    "grid_width": GRID_SIZE,
    "num_channels": NUM_CHANNELS,
    "filters": [32, 16],
    "kernel_size": (3, 3),
    "dropout": 0.3,
    "learning_rate": 1e-3,
    "batch_size": 32,
    "epochs": 25,
}

RISK_THRESHOLDS = {"low": 0.33, "medium": 0.66}

RANDOM_SEED = 42

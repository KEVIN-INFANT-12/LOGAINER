"""
Produces outputs/feature_leakage_report.json.

This is a manual/documented audit of every column in the traffic dataset,
classifying it SAFE / POSSIBLE_LEAKAGE / LEAKAGE for use as a ConvLSTM input
feature at prediction time t. A column is LEAKAGE if it is only known at or
after the prediction horizon; POSSIBLE_LEAKAGE if it is derived from a
target-like quantity or from information that could encode the outcome
(recommendation engines, "reached" flags, model-computed probabilities from
an unknown upstream source).
"""
import json
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "outputs")
os.makedirs(OUT_DIR, exist_ok=True)

REPORT = [
    # Identifiers / static route metadata -- safe, known at t
    ("journey_id", "SAFE", "Static identifier, known at journey start."),
    ("vehicle_id", "SAFE", "Static identifier."),
    ("shipment_id", "SAFE", "Static identifier."),
    ("timestamp", "SAFE", "Current observation time, defines t."),
    ("state", "SAFE", "Static location metadata."),
    ("district", "SAFE", "Static location metadata."),
    ("origin_latitude", "SAFE", "Known at journey start."),
    ("origin_longitude", "SAFE", "Known at journey start."),
    ("destination_latitude", "SAFE", "Known at journey start."),
    ("destination_longitude", "SAFE", "Known at journey start."),
    ("vehicle_latitude", "SAFE", "Current GPS position, known at t."),
    ("vehicle_longitude", "SAFE", "Current GPS position, known at t."),
    ("road_segment_id", "SAFE", "Current segment, known at t."),
    ("route_step", "SAFE", "Current progress index, known at t."),
    ("route_total_steps", "SAFE", "Static route metadata."),
    ("remaining_distance_km", "SAFE", "Computable from current position and route, known at t."),
    ("grid_lat", "SAFE", "Spatial bin of current position, known at t."),
    ("grid_lon", "SAFE", "Spatial bin of current position, known at t."),
    ("road_class", "SAFE", "Static road attribute."),
    ("road_length_km", "SAFE", "Static road attribute."),
    ("free_flow_speed_kmh", "SAFE", "Static road attribute."),
    ("road_capacity_veh_day", "SAFE", "Static road attribute."),
    ("rainfall_1d_mm", "SAFE", "Backward-looking rainfall accumulation, known at t."),
    ("rainfall_3d_mm", "SAFE", "Backward-looking rainfall accumulation, known at t."),
    ("rainfall_7d_mm", "SAFE", "Backward-looking rainfall accumulation, known at t."),
    ("rainfall_anomaly_score", "SAFE", "Derived from backward-looking rainfall, known at t."),
    ("flood_event_pressure", "SAFE", "Current/backward-looking environmental pressure, known at t."),
    ("flood_historical_susceptibility", "SAFE", "Static/historical susceptibility, known ahead of time."),
    ("landslide_event_pressure", "SAFE", "Current/backward-looking environmental pressure, known at t."),
    ("landslide_historical_susceptibility", "SAFE", "Static/historical susceptibility, known ahead of time."),
    ("environmental_risk_score", "POSSIBLE_LEAKAGE",
     "Composite score whose exact upstream formula/inputs are not documented in the dataset; "
     "if it was computed using any forward-looking window it would leak. Included as an input "
     "under the documented ASSUMPTION that it is a same-time composite of the rainfall/flood/"
     "landslide fields above (all of which are independently verified SAFE). Flagged for review "
     "if ground-truth generation code becomes available."),
    ("time_of_day_hour", "SAFE", "Known at t."),
    ("day_of_week", "SAFE", "Known at t."),
    ("peak_period_flag", "SAFE", "Derived from time_of_day_hour, known at t."),
    ("season", "SAFE", "Derived from date, known at t."),
    ("scenario_type", "POSSIBLE_LEAKAGE",
     "Appears to label the synthetic generation scenario (e.g. normal/disrupted); if this was "
     "used to DRIVE the target during synthetic data generation, using it as an input would let "
     "the model trivially recover the label instead of learning from physical signals. EXCLUDED "
     "from model inputs."),
    ("traffic_demand_veh_day", "SAFE", "Static/forecasted demand figure, known ahead of time."),
    ("traffic_capacity_ratio", "SAFE", "Derived from demand/capacity, known at t."),
    ("current_speed_kmh", "SAFE", "Current observation, known at t."),
    ("congestion_index", "SAFE", "Current observation, known at t."),
    ("congestion_level", "SAFE", "Categorical bucket of congestion_index, known at t. Also used, "
     "independently of any model input, as part of the composite label definition -- see note below."),
    ("estimated_current_delay_minutes", "SAFE", "Current-time estimate, known at t."),
    ("baseline_route_eta_minutes", "SAFE", "Static baseline, known ahead of time."),
    ("current_route_eta_minutes", "SAFE", "Current estimate, known at t."),
    ("current_route_disruption_probability", "POSSIBLE_LEAKAGE",
     "Name suggests it may already be a model-generated probability of disruption over the "
     "REMAINING route, i.e. it could itself be derived from future/target information for the "
     "trip. EXCLUDED from model inputs to avoid circularity; not used anywhere in feature "
     "engineering or the composite label."),
    ("road_status", "SAFE", "Current status, known at t. Also used in the composite label -- see note."),
    ("incident_type", "SAFE", "Current/logged incident at t. Also used in the composite label -- see note."),
    ("vehicle_stopped_flag", "SAFE", "Current observation, known at t."),
    ("route_deviation_flag", "SAFE", "Current observation, known at t."),
    ("target_remaining_travel_time_min", "LEAKAGE", "Explicit target column: outcome over the remaining route."),
    ("target_remaining_delay_min", "LEAKAGE", "Explicit target column: outcome over the remaining route."),
    ("target_disruption_within_remaining_route", "LEAKAGE",
     "Explicit target column. NOTE: also found to be unusable as the PRIMARY training label because "
     "positives are extremely sparse (135 of 168,877 rows, 0.08%) and ZERO positives fall in the "
     "chronological 2025 test year, making recall on the held-out set undefined. A composite, "
     "data-grounded label (disruption_risk_composite = SEVERE congestion OR incident_type != NONE OR "
     "road_status != OPEN) is used instead; it is documented in evaluation_report.json and has a "
     "stable 7-9% positive rate in every year 2016-2025."),
    ("target_next_30min_congestion_index", "LEAKAGE", "Explicit target column: future value."),
    ("target_next_30min_speed_kmh", "LEAKAGE", "Explicit target column: future value."),
    ("recommended_action", "POSSIBLE_LEAKAGE",
     "Likely produced by a downstream decision system that already consumed the outcome/target; "
     "using it as a feature could leak the label indirectly. EXCLUDED from model inputs."),
    ("destination_reached", "LEAKAGE", "Only known at the end of the journey, after the prediction horizon."),
    ("data_type", "SAFE", "Dataset provenance tag (e.g. SYNTHETIC_JOURNEY_CORRECTED), not a feature; used only for documentation."),
]

NOTE = (
    "The composite label disruption_risk_composite is built from congestion_level, incident_type "
    "and road_status observed AT THE FUTURE TIME BIN t+horizon (i.e. it is deliberately built from "
    "the SAME kind of fields as the excluded LEAKAGE targets, but read at the future timestamp, not "
    "the current one). None of congestion_level/incident_type/road_status at time t+horizon is ever "
    "used as an input feature for that same sample -- inputs are strictly drawn from bins <= t, "
    "labels strictly from the bin at t+horizon. This is enforced in create_spatiotemporal_sequences.py."
)


def main():
    excluded_inputs = ["scenario_type", "current_route_disruption_probability", "recommended_action",
                        "destination_reached", "target_remaining_travel_time_min",
                        "target_remaining_delay_min", "target_disruption_within_remaining_route",
                        "target_next_30min_congestion_index", "target_next_30min_speed_kmh"]
    report = {
        "columns": [{"feature": c, "status": s, "reason": r} for c, s, r in REPORT],
        "excluded_from_model_inputs": excluded_inputs,
        "label_construction_note": NOTE,
    }
    path = os.path.join(OUT_DIR, "feature_leakage_report.json")
    with open(path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"Wrote {path}")


if __name__ == "__main__":
    main()

"""
Occlusion-based sensitivity explanation for a single ConvLSTM prediction.

ConvLSTM has no simple built-in feature-attribution method, so we use a
practical, model-agnostic occlusion test: zero out one channel across the
whole input window at a time, re-run the model, and measure how much the
risk probability drops. Channels whose removal drops the probability the
most are reported as the top contributing factors. This is a real
sensitivity measurement against the actual loaded model -- not an invented
explanation.
"""
import numpy as np


CHANNEL_LABELS = {
    "rainfall_1d_mm": "Recent (1-day) rainfall",
    "rainfall_3d_mm": "3-day rainfall accumulation",
    "rainfall_7d_mm": "7-day rainfall accumulation",
    "rainfall_anomaly_score": "Rainfall anomaly vs. normal",
    "flood_event_pressure": "Active flood pressure",
    "flood_historical_susceptibility": "Historical flood susceptibility",
    "landslide_event_pressure": "Active landslide pressure",
    "landslide_historical_susceptibility": "Historical landslide susceptibility",
    "environmental_risk_score": "Combined environmental risk",
    "traffic_demand_veh_day": "Traffic demand",
    "traffic_capacity_ratio": "Traffic demand/capacity ratio",
    "current_speed_kmh": "Current vehicle speed",
    "congestion_index": "Congestion severity",
    "road_status_encoded": "Road status (open/restricted/closed)",
    "vehicle_count_density": "Observed vehicle density",
    "landslide_event_density": "Nearby historical landslide activity",
}


def explain_prediction(model, X, channels, top_k=5):
    """X: shape (1, seq_len, H, W, C) -- the exact input used for a prediction."""
    baseline_prob = float(model.predict(X, verbose=0).ravel()[0])
    contributions = []
    for ci, ch in enumerate(channels):
        X_occluded = X.copy()
        X_occluded[..., ci] = 0.0
        occluded_prob = float(model.predict(X_occluded, verbose=0).ravel()[0])
        contributions.append({
            "feature": ch,
            "label": CHANNEL_LABELS.get(ch, ch),
            "probability_drop_when_removed": round(baseline_prob - occluded_prob, 4),
        })
    contributions.sort(key=lambda c: -c["probability_drop_when_removed"])
    top = [c for c in contributions if c["probability_drop_when_removed"] > 0][:top_k]
    return {
        "baseline_risk_probability": round(baseline_prob, 4),
        "top_contributing_factors": top,
        "explanation_text": _to_text(top, baseline_prob),
    }


def _to_text(top, baseline_prob):
    if not top:
        return "No single factor strongly drives this prediction; risk is diffuse across many inputs."
    level = "HIGH" if baseline_prob > 0.66 else "MEDIUM" if baseline_prob > 0.33 else "LOW"
    reasons = "; ".join(f"{t['label']}" for t in top)
    return f"{level} risk, primarily driven by: {reasons}."

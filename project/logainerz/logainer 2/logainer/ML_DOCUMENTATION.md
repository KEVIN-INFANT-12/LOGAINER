# LOGAINER — ConvLSTM Spatiotemporal ML Model Documentation

## Overview
LOGAINER integrates a dedicated **ConvLSTM (Convolutional Long Short-Term Memory) Neural Network Pipeline** for predicting terrain landslide hazards, logistics disruption probabilities, and estimated delivery transit delays across the 8 states of the North Eastern Region (NER), India.

The model is integrated directly from `NERAI/outputs/model/convlstm_model.keras` and operates **strictly without LLMs, Ollama, LangChain, or external generative AI services**.

---

## 1. What the ConvLSTM Model Predicts
- **Primary Spatiotemporal Disruption Risk**: Disruption Probability ($0.0 - 1.0$) across a 16×16 spatial grid covering the NER bounding box (Lat 21.5–29.5, Lon 88.0–97.5).
- **Risk Level Classification**:
  - `LOW`: Disruption Probability $\le 0.33$
  - `MEDIUM`: Disruption Probability $0.33 - 0.66$
  - `HIGH`: Disruption Probability $> 0.66$
- **Corridor-Level Disruption Probability**: Aggregates spatial risk along transit waypoints for candidate routes (Route A, Route B, Route C).
- **Action Recommendation**: Automated operational protocols (e.g. green corridor rerouting, safe halt suggestions, convoy speed advisories).

---

## 2. Architecture & 16 Feature Channels

### Architecture:
- **Spatial Grid**: $16 \times 16$ spatial matrix covering the entire North Eastern Region.
- **Sequence Length**: 6 rolling spatiotemporal frames ($T=6$).
- **Layers**:
  - `ConvLSTM2D(32, kernel_size=(3,3), padding='same', return_sequences=True)`
  - `BatchNormalization()`
  - `ConvLSTM2D(16, kernel_size=(3,3), padding='same', return_sequences=False)`
  - `BatchNormalization()`
  - `Conv2D(16, kernel_size=(3,3), activation='relu', padding='same')`
  - `GlobalAveragePooling2D()`
  - `Dense(32, activation='relu')`
  - `Dropout(0.3)`
  - `Dense(1, activation='sigmoid')`

### 16 Input Channels:
1. `rainfall_1d_mm`: 1-Day Cumulative Precipitation (mm)
2. `rainfall_3d_mm`: 3-Day Cumulative Precipitation (mm)
3. `rainfall_7d_mm`: 7-Day Antecedent Precipitation (mm)
4. `rainfall_anomaly_score`: Precipitation Anomaly Index
5. `flood_event_pressure`: Active Flood Hydraulic Pressure
6. `flood_historical_susceptibility`: Historical Flood Susceptibility Index
7. `landslide_event_pressure`: Active Landslide Trigger Pressure
8. `landslide_historical_susceptibility`: Slope & Geological Landslide Susceptibility
9. `environmental_risk_score`: Combined Environmental Risk Score
10. `traffic_demand_veh_day`: Traffic Volume Demand (veh/day)
11. `traffic_capacity_ratio`: Volume-to-Capacity (V/C) Saturation Ratio
12. `current_speed_kmh`: Observed Traffic Flow Velocity (km/h)
13. `congestion_index`: Real-Time Corridor Congestion Index
14. `road_status_encoded`: Road Operational Status (0=Open, 1=Partial, 2=Blocked)
15. `vehicle_count_density`: Real-Time Vehicle Spatial Concentration
16. `landslide_event_density`: Historical & Spatial Landslide Concentration

---

## 3. Evaluation Metrics & Verified Performance

- **Accuracy**: $67.61\%$
- **ROC-AUC**: $0.7412$
- **Recall**: $65.27\%$
- **Precision**: $29.94\%$
- **F1-Score**: $0.4105$
- **PR-AUC**: $0.3413$
- **Brier Score**: $0.2319$
- **Optimal Classification Threshold**: $0.61$

---

## 4. API Endpoints

### `POST /api/v1/ml/predict`
- **Request Body**:
```json
{
  "rainfall_1d_mm": 55.0,
  "rainfall_3d_mm": 110.0,
  "rainfall_7d_mm": 180.0,
  "flood_event_pressure": 0.65,
  "landslide_event_pressure": 0.70,
  "traffic_capacity_ratio": 0.82,
  "current_speed_kmh": 22.0,
  "congestion_index": 0.75,
  "road_status": "PARTIAL_BLOCK",
  "latitude": 25.5788,
  "longitude": 91.8933
}
```

- **Response Body**:
```json
{
  "success": true,
  "prediction": {
    "prediction_id": "PRED-CONV-A1B2C3",
    "timestamp": "2026-08-30T00:15:00Z",
    "model": "ConvLSTM",
    "risk_probability": 0.7216,
    "risk_level": "HIGH",
    "grid_cell": [8, 6],
    "disruption_expected": true
  }
}
```

### `GET /api/v1/predictions/model-stats`
Returns complete ConvLSTM architecture metadata, feature list, normalization bounds, and evaluation metrics.

### `POST /api/v1/predictions/feedback`
Logs actual outcome vs. predicted disruption for the continuous feedback loop and operational monitoring.

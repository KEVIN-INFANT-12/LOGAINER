# LOGAINER ConvLSTM Risk Pipeline

Spatiotemporal disruption-risk prediction for NER road/route logistics, built on the
four supplied datasets. Primary model: **ConvLSTM** (not replaced by any tabular model).

## Project structure

```
ml/
  configs/config.py                 - all grid/sequence/model hyperparameters
  data/data_audit.py                - loads all 4 datasets, writes data_audit_report.{json,csv}
  preprocessing/leakage_check.py    - writes feature_leakage_report.json
  features/feature_engineering.py   - builds per-(grid cell, hour) channel table
  features/create_spatiotemporal_sequences.py - builds (seq, H, W, C) tensors + chronological split
  models/convlstm_model.py          - ConvLSTM2D architecture
  training/train_convlstm.py        - trains ConvLSTM + baseline, writes all reports/plots
  inference/inference.py            - RiskInferenceEngine: rolling-buffer real-time inference
  utils/route_risk.py               - OSRM query + route scoring/ranking
  utils/driver_decision.py          - accept/reject -> navigate / show safe halts
  utils/explainability.py           - occlusion-based per-prediction explanation
  api/model_service.py              - FastAPI: /predict-risk, /route-risk
  api/landslide_api_client.py       - optional external API client (env-var config, no hardcoded key)
outputs/                            - all generated reports, plots, model, sequences
requirements.txt
```

## Running it

```bash
pip install -r requirements.txt
python ml/data/data_audit.py
python ml/preprocessing/leakage_check.py
python -c "from ml.features.feature_engineering import build_feature_table; build_feature_table().to_parquet('outputs/feature_table.parquet')"
python ml/features/create_spatiotemporal_sequences.py
python ml/training/train_convlstm.py
```

Inference demo:
```bash
python ml/inference/inference.py
```

API:
```bash
uvicorn ml.api.model_service:app --reload
```

## Key data-grounded decisions (see outputs/ reports for full detail)

- **Grid**: 16x16 (configurable) over the bbox actually spanned by the rainfall/traffic
  data (lat 21.5-29.5, lon 88.0-97.5), not an arbitrary box.
- **Temporal axis**: traffic data is 10-min resolution but *episodic* — only 25,713 of
  ~87,600 possible hours in 2016-2025 have any observation. Sequences are built over
  populated hours only (documented in config.py), SEQUENCE_LENGTH=6, horizon=3 bins.
- **Target pivot**: the dataset's own `target_disruption_within_remaining_route` has
  only 135/168,877 positives and **zero** in the 2025 test year — unusable for
  held-out evaluation. A composite label (SEVERE congestion OR incident OR
  non-OPEN road) is used instead; it has a stable ~17% positive rate in every split.
  Documented in `outputs/evaluation_report.json` and `feature_leakage_report.json`.
- **No fabrication**: terrain/elevation is reported as unavailable, not invented.
  Flood_Inventory has no usable coordinates (100% missing) so flood signal comes
  only from the traffic dataset's district-level flood_* columns; landslide spatial
  density is engineered independently from the 556 real historical events
  (2007-2017), decayed forward — reported as historical extrapolation, not fresh data.
- **Leakage**: every explicit `target_*` column, plus `current_route_disruption_probability`,
  `recommended_action`, `scenario_type`, `destination_reached` are excluded from
  model inputs (see `outputs/feature_leakage_report.json`).

## Architecture reasoning

Input (6, 16, 16, 16) → ConvLSTM2D(32) → BN → Dropout → ConvLSTM2D(16) → BN →
Conv2D(16) → GlobalAveragePooling2D → Dense(32) → Dense(1, sigmoid) = risk_probability.

ConvLSTM2D convolves *inside* the recurrent update, so it learns spatial adjacency
(risk spreading to neighboring cells) and temporal evolution (rainfall accumulating,
congestion building) jointly — which a flattened-tabular model cannot represent.

## How this fits LOGAINER end to end

DATA → GRID → ConvLSTM (`risk_probability` per corridor/region) → `route_risk.py`
samples that risk along each OSRM candidate route → weighted `route_score`
(distance/eta/risk/congestion, weights configurable) → ranked routes shown to
driver/admin → `driver_decision.py` navigates on ACCEPT or surfaces curated nearby
safe halts on REJECT → validated field/admin feedback is the only path back into
future retraining data (never raw unverified reports).

## Limitations (see outputs/evaluation_report.json for the numeric detail)

- Traffic data is **synthetic**; results demonstrate pipeline validity, not
  field-validated real-world accuracy.
- Prediction horizon is "3 populated-hour-bins ahead", not a strict 30 minutes,
  because the source data itself is episodic.
- The model predicts **general road disruption risk**, not disaster-type
  classification (LANDSLIDE vs FLOOD vs TRAFFIC) — labels don't support that split.
- OSRM/API integrations are wired but require the operator to supply a running
  OSRM instance and the real `LANDSLIDE_API_URL`/`LANDSLIDE_API_KEY`.

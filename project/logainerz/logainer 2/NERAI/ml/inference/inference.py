"""
Real-time inference pipeline for the ConvLSTM disruption-risk model.

This module keeps a rolling buffer of the last SEQUENCE_LENGTH grid frames in
memory, updates it as new observations (GPS/rainfall/traffic/road-status)
arrive, and runs the saved model on the current window. It uses the SAME
grid assignment, channel list and normalization stats saved at training time
(outputs/normalization_stats.json, outputs/model_metadata.json) so inference
preprocessing is guaranteed identical to training preprocessing.
"""
import json
import os
import sys
from collections import deque
from datetime import datetime, timezone

import numpy as np
import tensorflow as tf

sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
from ml.configs import config as cfg
from ml.features.feature_engineering import assign_grid_cell, ROAD_STATUS_MAP


class RiskInferenceEngine:
    def __init__(self, model_path=None, metadata_path=None, norm_stats_path=None):
        model_path = model_path or os.path.join(cfg.MODEL_DIR, "convlstm_model.keras")
        metadata_path = metadata_path or os.path.join(cfg.OUT_DIR, "model_metadata.json")
        norm_stats_path = norm_stats_path or os.path.join(cfg.OUT_DIR, "normalization_stats.json")

        self.model = tf.keras.models.load_model(model_path, compile=False)
        with open(metadata_path) as f:
            self.metadata = json.load(f)
        with open(norm_stats_path) as f:
            self.norm_stats = json.load(f)

        self.channels = self.metadata["features"]
        self.seq_len = self.metadata["sequence_length"]
        self.grid_size = self.metadata["grid_size"]
        self.threshold = self.metadata["thresholds"]["classification_threshold"]
        self.risk_thresholds = cfg.RISK_THRESHOLDS

        self.frame_buffer = deque(maxlen=self.seq_len)

    def _normalize(self, frame):
        norm = np.zeros_like(frame)
        for ci, ch in enumerate(self.channels):
            stats = self.norm_stats[ch]
            vmin, vmax = stats["min"], stats["max"]
            norm[:, :, ci] = np.clip((frame[:, :, ci] - vmin) / (vmax - vmin + 1e-9), 0, 1)
        return norm

    def build_frame(self, observations):
        """
        observations: list of dicts, each with lat/lon and the raw channel
        values available at prediction time (same names as cfg.CHANNELS,
        except road_status_encoded which may be given as raw 'road_status'
        string and vehicle_count_density which is derived).
        """
        frame = np.zeros((self.grid_size, self.grid_size, len(self.channels)), dtype=np.float32)
        counts = np.zeros((self.grid_size, self.grid_size), dtype=np.float32)
        for obs in observations:
            row, col = assign_grid_cell(np.array([obs["latitude"]]), np.array([obs["longitude"]]))
            row, col = int(row[0]), int(col[0])
            counts[row, col] += 1
            for ci, ch in enumerate(self.channels):
                if ch == "vehicle_count_density":
                    continue
                if ch == "road_status_encoded":
                    val = ROAD_STATUS_MAP.get(obs.get("road_status", "OPEN"), 0.0)
                else:
                    val = float(obs.get(ch, 0.0))
                frame[row, col, ci] = max(frame[row, col, ci], val) if ch == "road_status_encoded" else val
        vd_idx = self.channels.index("vehicle_count_density")
        frame[:, :, vd_idx] = counts
        return frame

    def push_observations(self, observations):
        frame = self.build_frame(observations)
        norm_frame = self._normalize(frame)
        self.frame_buffer.append(norm_frame)

    def ready(self):
        return len(self.frame_buffer) == self.seq_len

    def predict(self, affected_hint="ROAD_DISRUPTION"):
        if not self.ready():
            raise ValueError(
                f"Insufficient history: have {len(self.frame_buffer)} frames, need {self.seq_len}. "
                "Call push_observations() with more historical batches first."
            )
        X = np.expand_dims(np.stack(self.frame_buffer, axis=0), axis=0)
        prob = float(self.model.predict(X, verbose=0).ravel()[0])
        level = "LOW" if prob <= self.risk_thresholds["low"] else (
            "MEDIUM" if prob <= self.risk_thresholds["medium"] else "HIGH"
        )
        # NOTE: training labels are a general disruption composite (congestion/
        # incident/road-status), not disaster-type-specific. We do NOT claim to
        # distinguish LANDSLIDE vs FLOOD vs TRAFFIC -- see model_metadata.json.
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "risk_probability": round(prob, 4),
            "risk_level": level,
            "predicted_disruption": "ROAD_DISRUPTION",
            "confidence": round(abs(prob - 0.5) * 2, 4),
            "prediction_horizon_minutes": None,
            "prediction_horizon_note": self.metadata.get("prediction_horizon_note"),
            "model": "ConvLSTM",
            "model_version": self.metadata.get("version"),
        }


if __name__ == "__main__":
    engine = RiskInferenceEngine()
    print("Loaded model. Channels:", engine.channels)
    print("Push", engine.seq_len, "synthetic observation batches to demo the buffer...")
    rng = np.random.default_rng(0)
    for _ in range(engine.seq_len):
        obs = [{
            "latitude": 25.5, "longitude": 93.0,
            "rainfall_1d_mm": float(rng.uniform(0, 50)),
            "current_speed_kmh": float(rng.uniform(10, 60)),
            "congestion_index": float(rng.uniform(0.3, 0.9)),
            "road_status": "OPEN",
        }]
        engine.push_observations(obs)
    print(json.dumps(engine.predict(), indent=2))

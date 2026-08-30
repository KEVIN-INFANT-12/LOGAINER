"""
Turns the (hour_bin, row, col) feature table into ConvLSTM-ready tensors.

Design:
- Time axis = the sorted list of DISTINCT hour_bins that contain at least one
  observation anywhere in NER (see config.py note on episodic coverage).
- For each hour_bin we materialize a dense (GRID_SIZE, GRID_SIZE, NUM_CHANNELS)
  frame; cells with no observation in that hour are zero-filled (documented
  assumption: zero represents "no vehicle/observation", not "zero risk";
  vehicle_count_density = 0 lets the model learn this distinction).
- A sample is SEQUENCE_LENGTH consecutive frames (t-5..t) -> label at bin
  index (t + PREDICTION_HORIZON_STEPS), i.e. strictly future relative to the
  input window across the *episodic* hour-bin index, not necessarily exactly
  clock-30-minutes (documented in config.py / model_metadata.json).
- Chronological split is applied by the CALENDAR YEAR of the label's hour_bin,
  and sequences are only formed from consecutive bins entirely within one
  split (no sequence crosses a split boundary), preventing leakage across
  train/val/test.
"""
import numpy as np
import pandas as pd
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
from ml.configs import config as cfg


def build_dense_frames(feature_table: pd.DataFrame):
    hour_bins = pd.Series(feature_table["hour_bin"].unique()).sort_values().reset_index(drop=True)
    bin_index = pd.Series(np.arange(len(hour_bins)), index=hour_bins.values)
    n_bins = len(hour_bins)

    frames = np.zeros((n_bins, cfg.GRID_SIZE, cfg.GRID_SIZE, cfg.NUM_CHANNELS), dtype=np.float32)
    labels = np.zeros(n_bins, dtype=np.float32)  # max disruption flag in that bin (any cell)

    channel_cols = cfg.CHANNELS
    idx = bin_index.loc[feature_table["hour_bin"].values].values
    rows = feature_table["row"].values
    cols = feature_table["col"].values
    for ci, col_name in enumerate(channel_cols):
        frames[idx, rows, cols, ci] = feature_table[col_name].values.astype(np.float32)

    lbl_df = feature_table.groupby("hour_bin")["disruption_row_flag"].max()
    lbl_idx = bin_index.loc[lbl_df.index.values].values
    labels[lbl_idx] = lbl_df.values

    return hour_bins.values, frames, labels


def normalize_channels(frames, train_mask):
    """Min-max normalize each channel using TRAIN split statistics only."""
    stats = {}
    norm = frames.copy()
    for c in range(frames.shape[-1]):
        train_vals = frames[train_mask, :, :, c]
        vmin, vmax = float(train_vals.min()), float(train_vals.max())
        if vmax - vmin < 1e-9:
            vmax = vmin + 1e-9
        norm[:, :, :, c] = (frames[:, :, :, c] - vmin) / (vmax - vmin)
        stats[cfg.CHANNELS[c]] = {"min": vmin, "max": vmax}
    norm = np.clip(norm, 0.0, 1.0)
    return norm, stats


def make_sequences(hour_bins, frames, labels):
    years = pd.to_datetime(hour_bins).year
    split_of_bin = np.array([
        "train" if y in cfg.TRAIN_YEARS else ("val" if y in cfg.VAL_YEARS else "test")
        for y in years
    ])

    seq_len = cfg.SEQUENCE_LENGTH
    horizon = cfg.PREDICTION_HORIZON_STEPS
    stride = cfg.SEQUENCE_STRIDE

    X_idx = []
    y_idx = []
    split_tags = []
    n = len(hour_bins)
    for start in range(0, n - seq_len - horizon, stride):
        end = start + seq_len  # window = [start, end)
        label_pos = end - 1 + horizon
        if label_pos >= n:
            continue
        window_splits = set(split_of_bin[start:end])
        label_split = split_of_bin[label_pos]
        # no sequence may straddle a split boundary
        if len(window_splits) != 1 or label_split not in window_splits:
            continue
        X_idx.append((start, end))
        y_idx.append(label_pos)
        split_tags.append(label_split)

    return X_idx, y_idx, np.array(split_tags)


def build_dataset():
    feature_table = pd.read_parquet(os.path.join(cfg.OUT_DIR, "feature_table.parquet"))
    hour_bins, frames, labels = build_dense_frames(feature_table)
    X_idx, y_idx, split_tags = make_sequences(hour_bins, frames, labels)

    train_bin_mask = np.array([pd.Timestamp(b).year in cfg.TRAIN_YEARS for b in hour_bins])
    norm_frames, norm_stats = normalize_channels(frames, train_bin_mask)

    X = np.stack([norm_frames[s:e] for s, e in X_idx]).astype(np.float32)
    y = np.array([labels[i] for i in y_idx]).astype(np.float32)

    return {
        "X": X, "y": y, "split": split_tags,
        "hour_bins": hour_bins, "norm_stats": norm_stats,
    }


if __name__ == "__main__":
    data = build_dataset()
    print("X shape", data["X"].shape, "y shape", data["y"].shape)
    for s in ["train", "val", "test"]:
        m = data["split"] == s
        print(s, m.sum(), "positive_rate=", data["y"][m].mean() if m.sum() else None)
    np.savez_compressed(
        os.path.join(cfg.OUT_DIR, "sequences.npz"),
        X=data["X"], y=data["y"], split=data["split"],
    )
    import json
    with open(os.path.join(cfg.OUT_DIR, "normalization_stats.json"), "w") as f:
        json.dump(data["norm_stats"], f, indent=2)
    print("Saved sequences.npz and normalization_stats.json")

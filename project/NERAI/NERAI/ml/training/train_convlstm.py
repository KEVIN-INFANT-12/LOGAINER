"""
Trains the ConvLSTM disruption-risk model on outputs/sequences.npz, trains a
simple baseline for comparison, evaluates both on the chronological test
split (2025), and writes all required reports/plots/artifacts.
"""
import json
import os
import sys

import numpy as np
import tensorflow as tf
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, confusion_matrix,
    roc_curve, precision_recall_curve, brier_score_loss,
)
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
from ml.configs import config as cfg
from ml.models.convlstm_model import build_convlstm_model

tf.random.set_seed(cfg.RANDOM_SEED)
np.random.seed(cfg.RANDOM_SEED)


def load_splits():
    data = np.load(os.path.join(cfg.OUT_DIR, "sequences.npz"), allow_pickle=True)
    X, y, split = data["X"], data["y"], data["split"]
    return {s: (X[split == s], y[split == s]) for s in ["train", "val", "test"]}


def compute_metrics(y_true, y_prob, threshold=0.5):
    y_pred = (y_prob >= threshold).astype(int)
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_true, y_prob)),
        "pr_auc": float(average_precision_score(y_true, y_prob)),
        "brier_score": float(brier_score_loss(y_true, y_prob)),
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
        "threshold_used": threshold,
    }


def main():
    splits = load_splits()
    Xtr, ytr = splits["train"]
    Xval, yval = splits["val"]
    Xte, yte = splits["test"]
    print("train/val/test sizes:", Xtr.shape, Xval.shape, Xte.shape)

    # class weights (documented per requirement 15: severe-imbalance handling comparison)
    pos = ytr.sum()
    neg = len(ytr) - pos
    class_weight = {0: 1.0, 1: float(neg / max(pos, 1))}
    print("class_weight:", class_weight, "train positive rate:", ytr.mean())

    mc = cfg.MODEL_CONFIG
    model = build_convlstm_model(
        sequence_length=mc["sequence_length"], grid_height=mc["grid_height"],
        grid_width=mc["grid_width"], num_channels=mc["num_channels"],
        filters=mc["filters"], kernel_size=mc["kernel_size"], dropout=mc["dropout"],
        learning_rate=mc["learning_rate"],
    )
    model.summary()

    ckpt_path = os.path.join(cfg.MODEL_DIR, "convlstm_model.keras")
    callbacks = [
        tf.keras.callbacks.EarlyStopping(monitor="val_auc", mode="max", patience=5, restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3),
        tf.keras.callbacks.ModelCheckpoint(ckpt_path, monitor="val_auc", mode="max", save_best_only=True),
    ]

    history = model.fit(
        Xtr, ytr, validation_data=(Xval, yval),
        epochs=mc["epochs"], batch_size=mc["batch_size"],
        class_weight=class_weight, callbacks=callbacks, verbose=2,
    )

    model.save(ckpt_path)

    # ---- training history plot ----
    plt.figure(figsize=(10, 4))
    plt.subplot(1, 2, 1)
    plt.plot(history.history["loss"], label="train_loss")
    plt.plot(history.history["val_loss"], label="val_loss")
    plt.legend(); plt.title("Loss"); plt.xlabel("epoch")
    plt.subplot(1, 2, 2)
    plt.plot(history.history["auc"], label="train_auc")
    plt.plot(history.history["val_auc"], label="val_auc")
    plt.legend(); plt.title("ROC-AUC"); plt.xlabel("epoch")
    plt.tight_layout()
    plt.savefig(os.path.join(cfg.OUT_DIR, "training_history.png"))
    plt.close()

    # ---- threshold selection on validation set (maximize F1) ----
    val_prob = model.predict(Xval, verbose=0).ravel()
    best_thr, best_f1 = 0.5, -1
    for thr in np.arange(0.05, 0.96, 0.01):
        f1 = f1_score(yval, (val_prob >= thr).astype(int), zero_division=0)
        if f1 > best_f1:
            best_f1, best_thr = f1, thr
    print("selected threshold (val F1-optimal):", best_thr, "val F1:", best_f1)

    # ---- test evaluation ----
    test_prob = model.predict(Xte, verbose=0).ravel()
    convlstm_metrics = compute_metrics(yte, test_prob, threshold=best_thr)
    print("ConvLSTM test metrics:", json.dumps(convlstm_metrics, indent=2))

    # ---- baseline: logistic regression on flattened, time-averaged frame ----
    def flatten_for_baseline(X):
        return X.mean(axis=1).reshape(X.shape[0], -1)  # average over time, flatten space*channels

    baseline = LogisticRegression(max_iter=500, class_weight="balanced")
    baseline.fit(flatten_for_baseline(Xtr), ytr)
    base_prob = baseline.predict_proba(flatten_for_baseline(Xte))[:, 1]
    baseline_metrics = compute_metrics(yte, base_prob, threshold=0.5)
    print("Baseline (logistic regression) test metrics:", json.dumps(baseline_metrics, indent=2))

    # ---- plots: ROC / PR / confusion matrix (ConvLSTM) ----
    fpr, tpr, _ = roc_curve(yte, test_prob)
    plt.figure(); plt.plot(fpr, tpr, label=f"ConvLSTM (AUC={convlstm_metrics['roc_auc']:.3f})")
    plt.plot([0, 1], [0, 1], "--", color="gray")
    plt.xlabel("FPR"); plt.ylabel("TPR"); plt.title("ROC Curve (test 2025)"); plt.legend()
    plt.savefig(os.path.join(cfg.OUT_DIR, "roc_curve.png")); plt.close()

    prec, rec, _ = precision_recall_curve(yte, test_prob)
    plt.figure(); plt.plot(rec, prec, label=f"ConvLSTM (PR-AUC={convlstm_metrics['pr_auc']:.3f})")
    plt.xlabel("Recall"); plt.ylabel("Precision"); plt.title("Precision-Recall Curve (test 2025)"); plt.legend()
    plt.savefig(os.path.join(cfg.OUT_DIR, "precision_recall_curve.png")); plt.close()

    cm = np.array(convlstm_metrics["confusion_matrix"])
    plt.figure(); plt.imshow(cm, cmap="Blues")
    for i in range(2):
        for j in range(2):
            plt.text(j, i, str(cm[i, j]), ha="center", va="center")
    plt.xticks([0, 1], ["Pred 0", "Pred 1"]); plt.yticks([0, 1], ["True 0", "True 1"])
    plt.title("Confusion Matrix (test 2025)")
    plt.savefig(os.path.join(cfg.OUT_DIR, "confusion_matrix.png")); plt.close()

    # ---- evaluation report ----
    eval_report = {
        "primary_target": cfg.TARGET_COL,
        "target_definition": (
            "Binary label = 1 if ANY grid cell in NER experiences SEVERE congestion, "
            "a logged incident (TRAFFIC_JAM/LANDSLIDE/FLOOD), or non-OPEN road_status "
            "within the hour bin at t+PREDICTION_HORIZON_STEPS."
        ),
        "pivot_from_original_target": (
            "The dataset's own target_disruption_within_remaining_route column has only 135 "
            "positive rows out of 168,877 (0.08%) and ZERO positives in the 2025 chronological "
            "test year, so recall could not be evaluated on the held-out set. A composite label "
            "was constructed from congestion_level/incident_type/road_status (all present in the "
            "traffic dataset, all SAFE per feature_leakage_report.json) evaluated at the FUTURE "
            "bin only -- see leakage report note for the strict input/label time separation."
        ),
        "class_distribution": {
            "train_positive_rate": float(ytr.mean()), "train_n": int(len(ytr)),
            "val_positive_rate": float(yval.mean()), "val_n": int(len(yval)),
            "test_positive_rate": float(yte.mean()), "test_n": int(len(yte)),
        },
        "selected_threshold": float(best_thr),
        "risk_level_thresholds": cfg.RISK_THRESHOLDS,
        "convlstm_test_metrics": convlstm_metrics,
        "baseline_logistic_regression_test_metrics": baseline_metrics,
        "improvement_over_baseline": {
            "roc_auc_delta": convlstm_metrics["roc_auc"] - baseline_metrics["roc_auc"],
            "pr_auc_delta": convlstm_metrics["pr_auc"] - baseline_metrics["pr_auc"],
            "recall_delta": convlstm_metrics["recall"] - baseline_metrics["recall"],
        },
        "data_quality_warnings": [
            "Traffic dataset is SYNTHETIC (data_type=SYNTHETIC_JOURNEY_CORRECTED for all rows); "
            "results describe pipeline validity on simulated journeys, not field-validated accuracy.",
            "Terrain/elevation data not available in current training datasets.",
            "Flood_Inventory sheet has no usable coordinates (100% missing/invalid); flood signal "
            "enters the model only via the traffic dataset's district-level flood_* columns.",
            "Landslide event dataset covers 2007-2017 only (556 events); landslide_event_density "
            "for 2018-2025 bins is decayed/extrapolated from that historical record, not fresh events.",
            "Temporal coverage is episodic, not continuous (25,713 of ~87,600 possible hours in "
                "2016-2025 have any observation); sequences are built over populated hours only, so "
                "the 'prediction horizon' is 3 populated-hour-bins ahead, not a fixed 30 minutes.",
            "This is not claimed to be 100% accurate; see confusion matrix and PR-AUC for the "
            "actual, unembellished performance on the 2025 held-out year.",
        ],
    }
    with open(os.path.join(cfg.OUT_DIR, "evaluation_report.json"), "w") as f:
        json.dump(eval_report, f, indent=2)

    # ---- metadata ----
    metadata = {
        "model_name": "logainer_convlstm",
        "version": "v1",
        "training_period": "2016-2022",
        "validation_period": "2023-2024",
        "test_period": "2025",
        "features": cfg.CHANNELS,
        "sequence_length": cfg.SEQUENCE_LENGTH,
        "prediction_horizon_steps": cfg.PREDICTION_HORIZON_STEPS,
        "prediction_horizon_note": "3 populated-hour-bins ahead (episodic data; not a fixed clock interval)",
        "grid_size": cfg.GRID_SIZE,
        "bbox": {"lat_min": cfg.LAT_MIN, "lat_max": cfg.LAT_MAX, "lon_min": cfg.LON_MIN, "lon_max": cfg.LON_MAX},
        "normalization": "per-channel min-max, fit on TRAIN split only (outputs/normalization_stats.json)",
        "target": cfg.TARGET_COL,
        "thresholds": {"classification_threshold": float(best_thr), **cfg.RISK_THRESHOLDS},
        "metrics": convlstm_metrics,
        "model_config": cfg.MODEL_CONFIG,
    }
    with open(os.path.join(cfg.OUT_DIR, "model_metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2, default=str)

    print("Training complete. Model saved to", ckpt_path)


if __name__ == "__main__":
    main()

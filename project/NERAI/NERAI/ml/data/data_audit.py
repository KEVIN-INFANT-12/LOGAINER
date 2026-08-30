"""
Data audit for LOGAINER datasets.
Loads the four supplied datasets, reports shape/columns/missingness/duplicates/
coordinate validity/date coverage/temporal resolution/class balance, and writes
data_audit_report.json / data_audit_report.csv.

No values are fabricated here. Anything that cannot be determined from the
data itself is reported as "unknown"/"not available".
"""
import json
import os
import pandas as pd
import numpy as np

DOWNLOADS = r"C:\Users\KEVIN INFANT P A\Downloads"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "outputs")
os.makedirs(OUT_DIR, exist_ok=True)

FILES = {
    "traffic": os.path.join(DOWNLOADS, "NER_Synthetic_Traffic_Journey_Corrected_2016_2025.csv"),
    "rainfall": os.path.join(DOWNLOADS, "NER_Rainfall_Corrected_2016_2025.csv"),
    "flood": os.path.join(DOWNLOADS, "NER_Flood_Dataset.xlsx"),
    "landslide": os.path.join(DOWNLOADS, "Northeast_India_Landslides.xlsx"),
}

NER_LAT_RANGE = (21.5, 29.5)
NER_LON_RANGE = (88.0, 97.5)


def valid_coord_mask(lat, lon):
    lat = pd.to_numeric(lat, errors="coerce")
    lon = pd.to_numeric(lon, errors="coerce")
    return (
        lat.between(*NER_LAT_RANGE) & lon.between(*NER_LON_RANGE)
    )


def find_date_cols(df):
    candidates = []
    for c in df.columns:
        cl = c.lower()
        if any(k in cl for k in ["date", "timestamp", "time"]):
            candidates.append(c)
    return candidates


def find_coord_cols(df):
    lat_cols = [c for c in df.columns if "lat" in c.lower()]
    lon_cols = [c for c in df.columns if "lon" in c.lower() or "lng" in c.lower()]
    return lat_cols, lon_cols


def audit_dataframe(name, df):
    report = {"dataset": name, "shape": list(df.shape), "columns": list(df.columns)}

    # missing values
    miss = df.isna().sum()
    report["missing_values"] = {c: int(v) for c, v in miss.items() if v > 0}
    report["missing_pct"] = {
        c: round(float(v) / len(df) * 100, 3) for c, v in miss.items() if v > 0
    }

    # duplicates
    report["duplicate_rows"] = int(df.duplicated().sum())

    # date columns
    date_cols = find_date_cols(df)
    date_info = {}
    for c in date_cols:
        try:
            parsed = pd.to_datetime(df[c], errors="coerce")
            valid = parsed.notna().sum()
            date_info[c] = {
                "parseable_count": int(valid),
                "unparseable_count": int(len(df) - valid),
                "min": str(parsed.min()) if valid else None,
                "max": str(parsed.max()) if valid else None,
            }
            if valid > 1:
                diffs = parsed.dropna().sort_values().diff().dropna()
                if len(diffs) > 0:
                    date_info[c]["median_gap_seconds"] = float(diffs.median().total_seconds())
        except Exception as e:
            date_info[c] = {"error": str(e)}
    report["date_columns"] = date_info

    # coordinate columns
    lat_cols, lon_cols = find_coord_cols(df)
    coord_info = {"lat_columns": lat_cols, "lon_columns": lon_cols}
    if lat_cols and lon_cols:
        # pair first lat/lon found (dataset-specific pairing done by caller if multiple)
        for lat_c in lat_cols:
            for lon_c in lon_cols:
                if lat_c.replace("lat", "") == lon_c.replace("lon", "").replace("lng", "") or len(lat_cols) == 1:
                    mask = valid_coord_mask(df[lat_c], df[lon_c])
                    coord_info[f"{lat_c}__{lon_c}_valid_count"] = int(mask.sum())
                    coord_info[f"{lat_c}__{lon_c}_invalid_count"] = int((~mask).sum())
                    coord_info[f"{lat_c}__{lon_c}_missing_count"] = int(
                        df[lat_c].isna().sum() + df[lon_c].isna().sum()
                    )
    report["coordinates"] = coord_info

    return report


def main():
    reports = {}
    csv_summary_rows = []

    # ---- Rainfall ----
    rain = pd.read_csv(FILES["rainfall"])
    r = audit_dataframe("rainfall", rain)
    reports["rainfall"] = r

    # ---- Traffic ----
    traffic = pd.read_csv(FILES["traffic"])
    t = audit_dataframe("traffic", traffic)
    # class distribution of disruption target if present
    if "target_disruption_within_remaining_route" in traffic.columns:
        vc = traffic["target_disruption_within_remaining_route"].value_counts(dropna=False)
        t["target_disruption_within_remaining_route_distribution"] = {
            str(k): int(v) for k, v in vc.items()
        }
    if "data_type" in traffic.columns:
        t["data_type_distribution"] = {
            str(k): int(v) for k, v in traffic["data_type"].value_counts(dropna=False).items()
        }
    reports["traffic"] = t

    # ---- Flood (multi-sheet) ----
    flood_xl = pd.ExcelFile(FILES["flood"])
    flood_sheets = {}
    for sheet in flood_xl.sheet_names:
        df = flood_xl.parse(sheet)
        flood_sheets[sheet] = audit_dataframe(f"flood::{sheet}", df)
    reports["flood"] = {"sheets": flood_xl.sheet_names, "sheet_reports": flood_sheets}

    # ---- Landslide ----
    landslide_xl = pd.ExcelFile(FILES["landslide"])
    landslide_sheets = {}
    for sheet in landslide_xl.sheet_names:
        df = landslide_xl.parse(sheet)
        landslide_sheets[sheet] = audit_dataframe(f"landslide::{sheet}", df)
    reports["landslide"] = {"sheets": landslide_xl.sheet_names, "sheet_reports": landslide_sheets}

    # ---- Cross-dataset geographic / temporal coverage summary ----
    summary = {
        "rainfall_geographic_extent": {
            "lat_min": float(pd.to_numeric(rain.get("latitude"), errors="coerce").min()) if "latitude" in rain else None,
            "lat_max": float(pd.to_numeric(rain.get("latitude"), errors="coerce").max()) if "latitude" in rain else None,
            "lon_min": float(pd.to_numeric(rain.get("longitude"), errors="coerce").min()) if "longitude" in rain else None,
            "lon_max": float(pd.to_numeric(rain.get("longitude"), errors="coerce").max()) if "longitude" in rain else None,
        },
        "traffic_rows": len(traffic),
        "rainfall_rows": len(rain),
        "assumptions": [
            "NER coordinate validity bounding box assumed as lat[21.5,29.5], lon[88.0,97.5] "
            "(approximate bounding box for India's North Eastern Region states); points outside "
            "this box are flagged invalid, not discarded automatically.",
            "Traffic dataset is explicitly synthetic ('Synthetic_Traffic' in filename); it is treated "
            "as simulation-derived, not ground-truth sensor telemetry. Its per-timestep GPS/road fields "
            "are used as the spatiotemporal backbone regardless, since it is the only journey-level dataset provided.",
            "Rainfall and landslide/flood datasets are treated as the closest available ground-truth "
            "environmental observations.",
            "No missing values are imputed in this audit stage; imputation only happens in feature engineering, "
            "each imputation choice is logged there.",
        ],
    }
    reports["cross_dataset_summary"] = summary

    out_json = os.path.join(OUT_DIR, "data_audit_report.json")
    with open(out_json, "w") as f:
        json.dump(reports, f, indent=2, default=str)

    # Flatten to CSV (one row per dataset/sheet with key stats)
    rows = []
    def flat_row(name, rep):
        rows.append({
            "dataset": name,
            "n_rows": rep["shape"][0],
            "n_cols": rep["shape"][1],
            "duplicate_rows": rep["duplicate_rows"],
            "n_missing_columns": len(rep["missing_values"]),
            "date_columns": ";".join(rep["date_columns"].keys()),
            "lat_columns": ";".join(rep["coordinates"]["lat_columns"]),
            "lon_columns": ";".join(rep["coordinates"]["lon_columns"]),
        })

    flat_row("rainfall", reports["rainfall"])
    flat_row("traffic", reports["traffic"])
    for s, rep in flood_sheets.items():
        flat_row(f"flood::{s}", rep)
    for s, rep in landslide_sheets.items():
        flat_row(f"landslide::{s}", rep)

    pd.DataFrame(rows).to_csv(os.path.join(OUT_DIR, "data_audit_report.csv"), index=False)

    print("Audit complete.")
    print(f"JSON -> {out_json}")
    print(f"CSV  -> {os.path.join(OUT_DIR, 'data_audit_report.csv')}")
    print(json.dumps({k: v["shape"] if "shape" in v else v.get("sheets") for k, v in reports.items() if k != "cross_dataset_summary"}, indent=2))


if __name__ == "__main__":
    main()

import os
import sys
import unittest
import joblib
from fastapi.testclient import TestClient

# Ensure root logainer folder is on sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, BASE_DIR)

from backend.app.main import app
from backend.app.ml.risk_model import ml_model, TerrainLandslideRiskModel
from backend.app.ml.train_rf_model import MODEL_FILE, train_and_export_model

class TestMLPipeline(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Ensure model artifact exists
        if not os.path.exists(MODEL_FILE):
            train_and_export_model()
        cls.client = TestClient(app)

    def test_01_artifact_file_exists(self):
        self.assertTrue(os.path.exists(MODEL_FILE), "Model joblib artifact should exist on disk.")

    def test_02_joblib_artifact_contents(self):
        artifact = joblib.load(MODEL_FILE)
        self.assertIn("classifier", artifact)
        self.assertIn("regressor", artifact)
        self.assertIn("metrics", artifact)
        self.assertEqual(artifact.get("model_version"), "1.0")
        self.assertEqual(artifact.get("model_type"), "Random Forest")

    def test_03_model_inference(self):
        features = {
            "rainfall_mm_hr": 45.0,
            "slope_gradient_deg": 38.0,
            "soil_saturation_pct": 82.0,
            "elevation_m": 1850.0,
            "road_type_idx": 1,
            "distance_to_river_m": 80.0,
            "historical_landslide_freq": 6.0,
            "vegetation_cover_pct": 30.0,
            "seismic_zone_v_score": 0.9
        }
        res = ml_model.predict(features)
        self.assertIn("risk_level", res)
        self.assertIn("susceptibility_score_10", res)
        self.assertIn("confidence", res)
        self.assertIn("recommended_action", res)
        self.assertGreaterEqual(res["confidence"], 0.0)
        self.assertLessEqual(res["confidence"], 100.0)

    def test_04_api_predict_endpoint(self):
        payload = {
            "rainfall_mm_hr": 35.0,
            "slope_gradient_deg": 40.0,
            "soil_saturation_pct": 80.0,
            "elevation_m": 1500.0
        }
        response = self.client.post("/api/v1/ml/predict", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "success")
        self.assertEqual(data.get("model"), "Random Forest")
        self.assertEqual(data.get("model_version"), "1.0")
        self.assertIn("confidence", data)
        self.assertIn("prediction", data)

    def test_05_api_invalid_input_validation(self):
        # Exceeding validation bounds (e.g. rainfall > 200)
        invalid_payload = {
            "rainfall_mm_hr": 999.0
        }
        response = self.client.post("/api/v1/ml/predict", json=invalid_payload)
        self.assertEqual(response.status_code, 422)

    def test_06_prediction_history(self):
        response = self.client.get("/api/v1/predictions/history")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get("success"))
        self.assertIn("history", data)
        self.assertGreaterEqual(data.get("count"), 1)

if __name__ == "__main__":
    unittest.main()

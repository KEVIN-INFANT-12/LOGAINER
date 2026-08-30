"""
LOGAINER AI/ML Risk Intelligence Module.
Replaces legacy Random Forest with the trained ConvLSTM Spatiotemporal Disruption Risk Model.
"""
from typing import Dict, Any, List, Optional
from backend.app.ml.convlstm_service import convlstm_engine

class CompositeNERLogisticsAI:
    def __init__(self):
        self.convlstm_engine = convlstm_engine
        self.is_initialized = False

    def initialize_all(self) -> Dict[str, Any]:
        self.convlstm_engine.initialize()
        self.is_initialized = True
        return {
            "status": "ConvLSTM Spatiotemporal Risk Model Loaded Successfully",
            "model_type": "ConvLSTM",
            "model_version": self.convlstm_engine.metadata.get("version", "v1.0-prod"),
            "metrics": self.convlstm_engine.metadata.get("metrics", {})
        }

    def predict(self, features: dict, user_context: Optional[dict] = None) -> dict:
        return self.convlstm_engine.predict(features, user_context=user_context)

    def predict_corridor_risk(self, waypoints: List[dict]) -> dict:
        return self.convlstm_engine.predict_corridor_risk(waypoints)

    def get_stats(self) -> dict:
        return self.convlstm_engine.get_stats()

    @property
    def prediction_history(self) -> List[dict]:
        return self.convlstm_engine.prediction_history

# Global singleton instance for backend endpoints
ml_model = CompositeNERLogisticsAI()
PREDICTION_HISTORY = convlstm_engine.prediction_history

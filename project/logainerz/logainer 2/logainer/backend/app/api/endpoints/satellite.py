from fastapi import APIRouter
from typing import Dict, Any
from backend.app.services.satellite_service import satellite_service

router = APIRouter(prefix="/satellite", tags=["Satellite Earth Observation Layer"])

@router.get("/metadata")
def get_satellite_metadata() -> Dict[str, Any]:
    """
    Returns preprocessed satellite and earth observation raster metadata with orbit update timestamps.
    """
    return satellite_service.get_satellite_layer_metadata()

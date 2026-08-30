from fastapi import APIRouter
from typing import List, Dict, Any
from backend.app.services.spatial_index import spatial_index

router = APIRouter(prefix="/corridors", tags=["Corridor Analytics"])

@router.get("/analytics")
def get_corridor_analytics() -> List[Dict[str, Any]]:
    """
    Returns corridor-level risk, disruption frequency, and alternative route availability.
    """
    return spatial_index.get_corridor_analytics()

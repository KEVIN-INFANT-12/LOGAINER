import math
from typing import List, Dict, Any, Tuple, Optional

class SpatialIndexCache:
    """
    Spatial Indexing & Corridor Cache (PostGIS Architecture Abstraction)
    Implements 2D Bounding-Box (R-Tree / GiST equivalent) and spatial cell hashing
    to quickly locate nearby chokepoints, incidents, and terrain hazards along route geometries.
    """
    def __init__(self, cell_size_deg: float = 0.25):
        self.cell_size = cell_size_deg
        self.spatial_grid: Dict[Tuple[int, int], List[Dict[str, Any]]] = {}
        self.cached_corridors: Dict[str, Dict[str, Any]] = {}

    def _get_cell_key(self, lat: float, lng: float) -> Tuple[int, int]:
        return (int(math.floor(lat / self.cell_size)), int(math.floor(lng / self.cell_size)))

    def index_feature(self, feature: Dict[str, Any]):
        lat = feature.get("lat") or feature.get("current_lat") or feature.get("latitude")
        lng = feature.get("lng") or feature.get("current_lng") or feature.get("longitude")
        if lat is not None and lng is not None:
            cell = self._get_cell_key(float(lat), float(lng))
            if cell not in self.spatial_grid:
                self.spatial_grid[cell] = []
            self.spatial_grid[cell].append(feature)

    def query_radius(self, lat: float, lng: float, radius_km: float = 50.0) -> List[Dict[str, Any]]:
        # Approximate degree delta
        deg_delta = radius_km / 111.0
        min_lat, max_lat = lat - deg_delta, lat + deg_delta
        min_lng, max_lng = lng - deg_delta, lng + deg_delta

        min_cell_x, min_cell_y = self._get_cell_key(min_lat, min_lng)
        max_cell_x, max_cell_y = self._get_cell_key(max_lat, max_lng)

        results = []
        for cx in range(min_cell_x, max_cell_x + 1):
            for cy in range(min_cell_y, max_cell_y + 1):
                cell_items = self.spatial_grid.get((cx, cy), [])
                for item in cell_items:
                    i_lat = float(item.get("lat") or item.get("current_lat") or item.get("latitude", 0))
                    i_lng = float(item.get("lng") or item.get("current_lng") or item.get("longitude", 0))
                    # Distance check
                    dist = math.hypot(lat - i_lat, lng - i_lng) * 111.0
                    if dist <= radius_km:
                        results.append(item)
        return results

    def get_corridor_analytics(self) -> List[Dict[str, Any]]:
        """
        Corridor-Level Accessibility & Disruption Analytics (F16)
        Key National Highway corridors in NER.
        """
        return [
            {
                "corridor_id": "NH-27",
                "corridor_name": "NH-27 East-West Trunk Corridor (Guwahati - Nagaon - Dibrugarh)",
                "length_km": 540,
                "current_accessibility_status": "OPEN / NORMAL",
                "corridor_risk_score": 18,
                "active_disruptions_count": 1,
                "average_delay_mins": 25,
                "alternate_bypass_available": True,
                "criticality": "HIGH (Main Regional Lifeline)",
                "state_coverage": ["Assam"]
            },
            {
                "corridor_id": "NH-06",
                "corridor_name": "NH-06 Shillong - Jowai - Sonapur - Silchar Lifeline",
                "length_km": 286,
                "current_accessibility_status": "HIGH RISK / WATERLOGGING",
                "corridor_risk_score": 78,
                "active_disruptions_count": 4,
                "average_delay_mins": 240,
                "alternate_bypass_available": True,
                "bypass_corridor": "Umrangso - Haflong - Silchar Green Corridor",
                "criticality": "CRITICAL (Only Link to Barak Valley, Tripura & Mizoram)",
                "state_coverage": ["Meghalaya", "Assam"]
            },
            {
                "corridor_id": "NH-29",
                "corridor_name": "NH-29 Dimapur - Kohima - Senapati - Imphal Axis",
                "length_km": 215,
                "current_accessibility_status": "CAUTION / ACTIVE ROCKFALL",
                "corridor_risk_score": 64,
                "active_disruptions_count": 3,
                "average_delay_mins": 110,
                "alternate_bypass_available": True,
                "bypass_corridor": "Niuland - Kohima Mountain Track",
                "criticality": "CRITICAL (Primary Access to Manipur)",
                "state_coverage": ["Nagaland", "Manipur"]
            },
            {
                "corridor_id": "NH-13",
                "corridor_name": "NH-13 Trans-Arunachal Highway (Bhalukpong - Bomdila - Sela - Tawang)",
                "length_km": 310,
                "current_accessibility_status": "CAUTION / SNOW & BLACK ICE",
                "corridor_risk_score": 58,
                "active_disruptions_count": 2,
                "average_delay_mins": 90,
                "alternate_bypass_available": False,
                "criticality": "STRATEGIC (Border National Security & Defense Logistics)",
                "state_coverage": ["Arunachal Pradesh"]
            },
            {
                "corridor_id": "NH-10",
                "corridor_name": "NH-10 Siliguri - Teesta - Rangpo - Gangtok",
                "length_km": 114,
                "current_accessibility_status": "VULNERABLE / RIVER UNDERCUTTING",
                "corridor_risk_score": 72,
                "active_disruptions_count": 2,
                "average_delay_mins": 140,
                "alternate_bypass_available": True,
                "bypass_corridor": "Lava - Gorubathan - Pakyong Hill Route",
                "criticality": "CRITICAL (Sole Highway Connecting Sikkim)",
                "state_coverage": ["West Bengal", "Sikkim"]
            }
        ]

spatial_index = SpatialIndexCache()

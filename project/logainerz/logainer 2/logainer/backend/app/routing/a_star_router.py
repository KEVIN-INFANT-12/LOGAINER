import math
import heapq
import requests
from typing import List, Dict, Any, Tuple, Optional
from backend.app.ml.convlstm_service import convlstm_engine

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# Core NER Transport Network Node Graph
NER_NODES = {
    "GHY": {"name": "Guwahati", "lat": 26.1445, "lng": 91.7362, "elevation_m": 55, "district": "Kamrup Metropolitan", "state": "Assam"},
    "NGAON": {"name": "Nagaon Junction", "lat": 26.3456, "lng": 92.6840, "elevation_m": 60, "district": "Nagaon", "state": "Assam"},
    "TEZ": {"name": "Tezpur", "lat": 26.6528, "lng": 92.7926, "elevation_m": 78, "district": "Sonitpur", "state": "Assam"},
    "BHALUK": {"name": "Bhalukpong Gate", "lat": 27.0142, "lng": 92.6450, "elevation_m": 213, "district": "West Kameng", "state": "Arunachal Pradesh"},
    "BOMDILA": {"name": "Bomdila Pass", "lat": 27.2645, "lng": 92.4222, "elevation_m": 2217, "district": "West Kameng", "state": "Arunachal Pradesh"},
    "SELA": {"name": "Sela Pass", "lat": 27.5042, "lng": 92.1039, "elevation_m": 4170, "district": "Tawang", "state": "Arunachal Pradesh"},
    "TWG": {"name": "Tawang", "lat": 27.5860, "lng": 91.8594, "elevation_m": 3048, "district": "Tawang", "state": "Arunachal Pradesh"},
    "ITN": {"name": "Itanagar", "lat": 27.0844, "lng": 93.6053, "elevation_m": 320, "district": "Papum Pare", "state": "Arunachal Pradesh"},
    "DBR": {"name": "Dibrugarh", "lat": 27.4728, "lng": 94.9120, "elevation_m": 108, "district": "Dibrugarh", "state": "Assam"},
    "JOR": {"name": "Jorhat", "lat": 26.7509, "lng": 94.2037, "elevation_m": 116, "district": "Jorhat", "state": "Assam"},
    "LMD": {"name": "Lumding Junction", "lat": 25.8197, "lng": 93.1706, "elevation_m": 125, "district": "Hojai", "state": "Assam"},
    "HFL": {"name": "Haflong Hill Cut", "lat": 25.1723, "lng": 93.0232, "elevation_m": 966, "district": "Dima Hasao", "state": "Assam"},
    "UMR": {"name": "Umrangso Bypass", "lat": 25.5100, "lng": 92.7700, "elevation_m": 640, "district": "Dima Hasao", "state": "Assam"},
    "SHL": {"name": "Shillong", "lat": 25.5788, "lng": 91.8933, "elevation_m": 1525, "district": "East Khasi Hills", "state": "Meghalaya"},
    "JOWAI": {"name": "Jowai Plateau", "lat": 25.4497, "lng": 92.2033, "elevation_m": 1380, "district": "West Jaintia Hills", "state": "Meghalaya"},
    "SONAPUR": {"name": "Sonapur Tunnel Chokepoint", "lat": 25.1147, "lng": 92.3619, "elevation_m": 450, "district": "East Jaintia Hills", "state": "Meghalaya"},
    "SIL": {"name": "Silchar (Barak Valley)", "lat": 24.8333, "lng": 92.7789, "elevation_m": 35, "district": "Cachar", "state": "Assam"},
    "VAI": {"name": "Vairengte Gateway", "lat": 24.3050, "lng": 92.7630, "elevation_m": 290, "district": "Kolasib", "state": "Mizoram"},
    "KOLASIB": {"name": "Kolasib Ridge", "lat": 24.2246, "lng": 92.6784, "elevation_m": 620, "district": "Kolasib", "state": "Mizoram"},
    "AZL": {"name": "Aizawl", "lat": 23.7271, "lng": 92.7176, "elevation_m": 1132, "district": "Aizawl", "state": "Mizoram"},
    "LGL": {"name": "Lunglei", "lat": 22.8833, "lng": 92.7333, "elevation_m": 722, "district": "Lunglei", "state": "Mizoram"},
    "AGT": {"name": "Agartala", "lat": 23.8315, "lng": 91.2868, "elevation_m": 15, "district": "West Tripura", "state": "Tripura"},
    "UDAI": {"name": "Udaipur", "lat": 23.5333, "lng": 91.4833, "elevation_m": 21, "district": "Gomati", "state": "Tripura"},
    "DMP": {"name": "Dimapur Railhead", "lat": 25.9042, "lng": 93.7276, "elevation_m": 145, "district": "Dimapur", "state": "Nagaland"},
    "NIU": {"name": "Niuland Emergency Bypass", "lat": 25.8200, "lng": 93.9200, "elevation_m": 310, "district": "Niuland", "state": "Nagaland"},
    "KHM": {"name": "Kohima", "lat": 25.6751, "lng": 94.1086, "elevation_m": 1444, "district": "Kohima", "state": "Nagaland"},
    "SEN": {"name": "Senapati Pass", "lat": 25.2667, "lng": 94.0167, "elevation_m": 1265, "district": "Senapati", "state": "Manipur"},
    "IMP": {"name": "Imphal Valley", "lat": 24.8170, "lng": 93.9368, "elevation_m": 786, "district": "Imphal West", "state": "Manipur"},
    "CCP": {"name": "Churachandpur", "lat": 24.3333, "lng": 93.6667, "elevation_m": 922, "district": "Churachandpur", "state": "Manipur"},
    "SLG": {"name": "Siliguri Gateway", "lat": 26.7271, "lng": 88.3953, "elevation_m": 122, "district": "Darjeeling", "state": "West Bengal"},
    "SEV": {"name": "Sevoke Bridge Chokepoint", "lat": 26.8854, "lng": 88.4721, "elevation_m": 195, "district": "Kalimpong", "state": "West Bengal"},
    "LAVA": {"name": "Lava Hill Ridge Bypass", "lat": 27.0864, "lng": 88.6617, "elevation_m": 2138, "district": "Kalimpong", "state": "West Bengal"},
    "RANGPO": {"name": "Rangpo Border Gate", "lat": 27.1764, "lng": 88.5312, "elevation_m": 360, "district": "Pakyong", "state": "Sikkim"},
    "GTK": {"name": "Gangtok", "lat": 27.3389, "lng": 88.6065, "elevation_m": 1650, "district": "East Sikkim", "state": "Sikkim"},
    "MGN": {"name": "Mangan (North Sikkim)", "lat": 27.5000, "lng": 88.5333, "elevation_m": 1310, "district": "Mangan", "state": "Sikkim"}
}

# Network Edges: (u, v, base_distance_km, road_class, normal_speed_kmh, default_risk, highway_name)
NER_EDGES = [
    # Assam Trunk Corridor
    ("GHY", "NGAON", 120.0, "EXPRESS_NH27", 75.0, 0.05, "NH-27 East-West Corridor"),
    ("NGAON", "TEZ", 62.0, "NH", 65.0, 0.08, "NH-715 Kolia Bhomora Bridge"),
    ("NGAON", "JOR", 185.0, "NH", 65.0, 0.08, "NH-715 Kaziranga Sector"),
    ("JOR", "DBR", 138.0, "NH", 65.0, 0.06, "NH-2 Upper Assam NH"),
    ("TEZ", "ITN", 155.0, "NH", 55.0, 0.15, "NH-415 Papu Nalah Link"),
    
    # Arunachal / Tawang Mountain Pass
    ("TEZ", "BHALUK", 58.0, "STATE_HWY", 45.0, 0.22, "Chariduar - Bhalukpong Road"),
    ("BHALUK", "BOMDILA", 98.0, "HILL_PASS", 32.0, 0.38, "NH-13 Bomdila Ascent"),
    ("BOMDILA", "SELA", 75.0, "HIGH_ALPINE", 25.0, 0.65, "NH-13 Sela Pass High Altitude"),
    ("SELA", "TWG", 78.0, "HILL_PASS", 28.0, 0.45, "NH-13 Tawang Valley Descent"),
    ("TEZ", "BOMDILA", 145.0, "DEFENSE_LINK", 30.0, 0.35, "Orang-Kalaktang-Shergaon-Rupa-Tenga (OKSRT) Road"),
    
    # Meghalaya - Barak Valley - Tripura - Mizoram Lifeline (NH-6)
    ("GHY", "SHL", 98.0, "EXPRESS_NH", 60.0, 0.12, "NH-6 Guwahati-Shillong 4-Lane"),
    ("SHL", "JOWAI", 64.0, "NH", 45.0, 0.28, "NH-6 Jowai Plateau"),
    ("JOWAI", "SONAPUR", 72.0, "VULNERABLE_NH", 30.0, 0.78, "NH-6 Sonapur Landslide Corridor"),
    ("SONAPUR", "SIL", 52.0, "NH", 40.0, 0.35, "NH-6 Barak Incline"),
    
    # Alternative Hill Bypass around Sonapur Blockage: Umrangso - Haflong
    ("NGAON", "LMD", 76.0, "STATE_HWY", 50.0, 0.15, "SH-18 Lumding Highway"),
    ("LMD", "HFL", 68.0, "HILL_PASS", 35.0, 0.30, "Mahur - Haflong Mountain Road"),
    ("HFL", "SIL", 96.0, "HILL_PASS", 38.0, 0.25, "Haflong - Silchar Green Bypass"),
    ("JOWAI", "UMR", 84.0, "HILL_CUT", 30.0, 0.40, "Jowai - Umrangso Link"),
    ("UMR", "HFL", 62.0, "HILL_CUT", 32.0, 0.35, "Umrangso - Haflong Hill Track"),
    
    # Mizoram Lifeline
    ("SIL", "VAI", 48.0, "NH", 45.0, 0.18, "NH-306 Gateway"),
    ("VAI", "KOLASIB", 38.0, "HILL_PASS", 35.0, 0.25, "NH-306 Kolasib Grade"),
    ("KOLASIB", "AZL", 86.0, "HILL_PASS", 32.0, 0.32, "NH-306 Aizawl Ascent"),
    ("AZL", "LGL", 168.0, "HILL_PASS", 30.0, 0.42, "World Bank Road NH-54"),
    
    # Tripura Corridor
    ("SIL", "AGT", 255.0, "NH", 50.0, 0.20, "NH-8 Assam-Tripura Highway"),
    ("AGT", "UDAI", 52.0, "NH", 60.0, 0.08, "NH-8 Agartala-Udaipur 2-Lane"),
    
    # Nagaland - Manipur Corridor (NH-29 & NH-2)
    ("NGAON", "DMP", 165.0, "NH", 60.0, 0.12, "NH-29 Assam-Nagaland Trunk"),
    ("DMP", "KHM", 74.0, "VULNERABLE_NH", 32.0, 0.72, "NH-29 Pagla Pahar Gorge"),
    ("DMP", "NIU", 36.0, "RURAL_LINK", 30.0, 0.25, "Niuland Bypass Road"),
    ("NIU", "KHM", 58.0, "HILL_CUT", 28.0, 0.35, "Niuland - Kohima Mountain Track"),
    ("KHM", "SEN", 52.0, "HILL_PASS", 35.0, 0.40, "NH-2 Mao - Senapati Pass"),
    ("SEN", "IMP", 62.0, "NH", 48.0, 0.22, "NH-2 Senapati - Imphal"),
    ("IMP", "CCP", 64.0, "NH", 50.0, 0.15, "Tiddim Road NH-102B"),
    
    # Sikkim Corridor (NH-10 & Lava Bypass)
    ("SLG", "SEV", 22.0, "NH", 50.0, 0.25, "NH-10 Sevoke Gateway"),
    ("SEV", "RANGPO", 52.0, "VULNERABLE_NH", 28.0, 0.82, "NH-10 Teesta River Gorge"),
    ("RANGPO", "GTK", 39.0, "NH", 40.0, 0.25, "NH-10 Rangpo-Gangtok 2-Lane"),
    ("SLG", "LAVA", 72.0, "HILL_PASS", 32.0, 0.32, "Gorubathan - Lava Hill Bypass"),
    ("LAVA", "RANGPO", 44.0, "HILL_CUT", 30.0, 0.35, "Reshi - Pedong - Rangpo Route"),
    ("GTK", "MGN", 68.0, "HIGH_ALPINE", 24.0, 0.75, "North Sikkim Highway (Dikchu-Mangan)")
]

# Designated Safe Halt Locations across NER Mountain Corridors
SAFE_HALT_LOCATIONS = [
    {
        "id": "HALT-GHY-01",
        "name": "Guwahati Integrated Logistics Terminal",
        "type": "LOGISTICS_PARK",
        "lat": 26.1200,
        "lng": 91.7100,
        "district": "Kamrup Metro",
        "state": "Assam",
        "capacity_trucks": 120,
        "security_level": "SECURE_24X7",
        "amenities": ["Fuel Station", "Cold Storage Bay", "Driver Dormitory", "Workshop", "Satellite Comms"],
        "safety_rating": 98
    },
    {
        "id": "HALT-TEZ-01",
        "name": "Tezpur Army Transit Supply Holding Camp",
        "type": "DEFENSE_HOLDING_POINT",
        "lat": 26.6400,
        "lng": 92.8100,
        "district": "Sonitpur",
        "state": "Assam",
        "capacity_trucks": 80,
        "security_level": "HIGH_MILITARY",
        "amenities": ["Fuel Depot", "Helipad Access", "Emergency Medical", "Weighbridge"],
        "safety_rating": 96
    },
    {
        "id": "HALT-BHALUK-01",
        "name": "Bhalukpong BRO Staging Yard",
        "type": "BRO_FORWARD_CAMP",
        "lat": 27.0200,
        "lng": 92.6400,
        "district": "West Kameng",
        "state": "Arunachal Pradesh",
        "capacity_trucks": 45,
        "security_level": "SECURE_24X7",
        "amenities": ["Heavy Recovery Crane", "Snow Clearance Depot", "Driver Rest Area"],
        "safety_rating": 92
    },
    {
        "id": "HALT-BOMDILA-01",
        "name": "Bomdila Mountain Pass Shelter & Depot",
        "type": "EMERGENCY_SHELTER",
        "lat": 27.2600,
        "lng": 92.4200,
        "district": "West Kameng",
        "state": "Arunachal Pradesh",
        "capacity_trucks": 35,
        "security_level": "MONITORED",
        "amenities": ["Oxygen Support", "Insulated Bays", "Chains & Towing Support"],
        "safety_rating": 89
    },
    {
        "id": "HALT-LMD-01",
        "name": "Lumding Railway Logistics Yard",
        "type": "RAILHEAD_HOLDING",
        "lat": 25.8250,
        "lng": 93.1680,
        "district": "Hojai",
        "state": "Assam",
        "capacity_trucks": 90,
        "security_level": "SECURE_24X7",
        "amenities": ["Container Yard", "Fuel Station", "Canteen", "Repair Bay"],
        "safety_rating": 95
    },
    {
        "id": "HALT-HFL-01",
        "name": "Haflong Dima Hasao Safe Transit Yard",
        "type": "CIVIC_STAGING",
        "lat": 25.1800,
        "lng": 93.0200,
        "district": "Dima Hasao",
        "state": "Assam",
        "capacity_trucks": 40,
        "security_level": "MONITORED",
        "amenities": ["Emergency Rations", "Wireless Relay", "Mechanic Shed"],
        "safety_rating": 90
    },
    {
        "id": "HALT-JOWAI-01",
        "name": "Jowai Bypass Truck Terminal",
        "type": "TRUCK_PARK",
        "lat": 25.4400,
        "lng": 92.1900,
        "district": "West Jaintia Hills",
        "state": "Meghalaya",
        "capacity_trucks": 65,
        "security_level": "SECURE_24X7",
        "amenities": ["24/7 Security", "Fuel Pump", "Diner", "Tire Service"],
        "safety_rating": 93
    },
    {
        "id": "HALT-SIL-01",
        "name": "Silchar Cachar Supply Depot",
        "type": "LOGISTICS_PARK",
        "lat": 24.8300,
        "lng": 92.7900,
        "district": "Cachar",
        "state": "Assam",
        "capacity_trucks": 110,
        "security_level": "SECURE_24X7",
        "amenities": ["Cold Chain Plug-in Points", "Warehousing", "Driver Dorms"],
        "safety_rating": 97
    },
    {
        "id": "HALT-DMP-01",
        "name": "Dimapur Highway Freight Hub",
        "type": "INTERSTATE_HUB",
        "lat": 25.9100,
        "lng": 93.7300,
        "district": "Dimapur",
        "state": "Nagaland",
        "capacity_trucks": 100,
        "security_level": "SECURE_24X7",
        "amenities": ["Police Checkpoint Protection", "Fuel Station", "Workshop"],
        "safety_rating": 94
    },
    {
        "id": "HALT-SLG-01",
        "name": "Siliguri Corridor Central Staging Area",
        "type": "LOGISTICS_PARK",
        "lat": 26.7300,
        "lng": 88.4000,
        "district": "Darjeeling",
        "state": "West Bengal",
        "capacity_trucks": 150,
        "security_level": "SECURE_24X7",
        "amenities": ["Full Maintenance Depot", "Reefer Support", "Medical Bay"],
        "safety_rating": 99
    }
]

class NERRouteOptimizer:
    def __init__(self):
        self.nodes = NER_NODES
        self.adjacency = {}
        self._build_graph()

    def _build_graph(self):
        for node in self.nodes:
            self.adjacency[node] = []
            
        for u, v, dist, road_class, speed, risk, hwy in NER_EDGES:
            self.adjacency[u].append({"to": v, "dist": dist, "road_class": road_class, "speed": speed, "base_risk": risk, "highway": hwy})
            self.adjacency[v].append({"to": u, "dist": dist, "road_class": road_class, "speed": speed, "base_risk": risk, "highway": hwy})

    def a_star_search(
        self, 
        start_node: str, 
        end_node: str, 
        risk_weight: float = 1.0, 
        blocked_nodes: Optional[List[str]] = None,
        avoid_edges: Optional[List[Tuple[str, str]]] = None,
        is_emergency_corridor: bool = False
    ) -> Optional[Dict[str, Any]]:
        if start_node not in self.nodes or end_node not in self.nodes:
            return None
            
        blocked = set(blocked_nodes or [])
        avoid_e = set(avoid_edges or [])
        
        start_h = self._heuristic(start_node, end_node)
        open_set = [(start_h, 0.0, start_node, [start_node], 0.0, 0.0, 0.0)]
        g_scores = {start_node: 0.0}
        
        best_solution = None

        while open_set:
            f, g, current, path, dist_km, total_risk, elev_gain = heapq.heappop(open_set)
            
            if current == end_node:
                best_solution = {
                    "path_nodes": path,
                    "distance_km": round(dist_km, 1),
                    "elevation_gain_m": round(elev_gain, 1),
                    "base_risk_score": round(total_risk / max(len(path) - 1, 1), 3),
                    "estimated_time_hrs": round(g / 50.0, 2)
                }
                break

            if g > g_scores.get(current, float('inf')):
                continue

            for edge in self.adjacency[current]:
                neighbor = edge["to"]
                
                # Avoid blocked nodes or specific avoided edges
                if (neighbor in blocked and neighbor != end_node) or (current, neighbor) in avoid_e or (neighbor, current) in avoid_e:
                    continue

                edge_dist = edge["dist"]
                edge_speed = edge["speed"]
                edge_risk = edge["base_risk"]
                
                if is_emergency_corridor:
                    edge_speed *= 1.25
                
                elev_diff = self.nodes[neighbor]["elevation_m"] - self.nodes[current]["elevation_m"]
                elev_penalty = max(0.0, elev_diff / 500.0) * 0.15
                travel_time_hrs = edge_dist / edge_speed
                
                edge_cost = (
                    travel_time_hrs * 60.0 + 
                    (edge_risk * 120.0 * risk_weight) + 
                    (elev_penalty * 30.0)
                )
                
                tentative_g = g + edge_cost
                
                if tentative_g < g_scores.get(neighbor, float('inf')):
                    g_scores[neighbor] = tentative_g
                    h = self._heuristic(neighbor, end_node)
                    new_elev_gain = elev_gain + max(0, elev_diff)
                    heapq.heappush(open_set, (
                        tentative_g + h,
                        tentative_g,
                        neighbor,
                        path + [neighbor],
                        dist_km + edge_dist,
                        total_risk + edge_risk,
                        new_elev_gain
                    ))

        if not best_solution:
            return None
            
        waypoints = []
        for n_id in best_solution["path_nodes"]:
            node_data = self.nodes[n_id]
            waypoints.append({
                "id": n_id,
                "name": node_data["name"],
                "lat": node_data["lat"],
                "lng": node_data["lng"],
                "elevation_m": node_data["elevation_m"],
                "district": node_data.get("district"),
                "state": node_data.get("state")
            })
            
        best_solution["waypoints"] = waypoints
        return best_solution

    def _heuristic(self, node_a: str, node_b: str) -> float:
        a = self.nodes[node_a]
        b = self.nodes[node_b]
        dist_km = haversine_distance_km(a["lat"], a["lng"], b["lat"], b["lng"])
        return (dist_km / 65.0) * 60.0

    def calculate_multi_candidate_routes(
        self, 
        start_id: str, 
        dest_id: str, 
        active_blocks: Optional[List[str]] = None,
        cargo_type: str = "ESSENTIAL_MEDICINES_COLD_CHAIN",
        priority_level: str = "NORMAL"
    ) -> Dict[str, Any]:
        """
        Generates and evaluates multiple practical candidate routes (Route A, Route B, Route C).
        Separation of concerns:
        - OSRM / A* graph evaluates topology, distance, and baseline travel time.
        - ConvLSTM spatiotemporal model predicts disruption probability & risk score for each corridor.
        - Decision Engine combines distance + ETA + ConvLSTM risk to recommend the best route.
        """
        blocks = active_blocks or []
        
        # 1. Primary Direct Route (Standard highway network)
        res_primary = self.a_star_search(start_id, dest_id, risk_weight=0.2, blocked_nodes=[])
        
        # 2. Risk-Mitigated Alternative Route (strictly avoids blocks and penalizes hazardous slopes)
        res_alt1 = self.a_star_search(start_id, dest_id, risk_weight=2.8, blocked_nodes=blocks)
        
        # 3. Third Alternative Corridor (penalizes primary edges to discover distinct bypass)
        avoid_edges = []
        if res_primary and len(res_primary["path_nodes"]) >= 2:
            p_nodes = res_primary["path_nodes"]
            mid = len(p_nodes) // 2
            avoid_edges.append((p_nodes[mid-1], p_nodes[mid]))

        res_alt2 = self.a_star_search(start_id, dest_id, risk_weight=1.8, blocked_nodes=blocks, avoid_edges=avoid_edges)
        
        if not res_primary and not res_alt1 and not res_alt2:
            return {"error": "No viable route exists between origin and destination on current network."}

        # Format candidates with ConvLSTM evaluation
        candidates = []
        
        def build_candidate_route(res, route_id: str, name: str, route_type: str):
            if not res:
                return None
            
            # Predict Spatiotemporal Risk with ConvLSTM
            convlstm_res = convlstm_engine.predict_corridor_risk(res["waypoints"])
            risk_score = convlstm_res["risk_score"]
            risk_level = convlstm_res["risk_level"]
            disruption_prob = convlstm_res["disruption_probability"]
            
            # Distance & ETA calculations
            dist_km = res["distance_km"]
            speed_kmh = 42.0 if route_type == "PRIMARY" else (48.0 if route_type == "EMERGENCY_CORRIDOR" else 36.0)
            duration_hrs = round(dist_km / speed_kmh, 2)
            hrs = int(duration_hrs)
            mins = int((duration_hrs - hrs) * 60)
            eta_display = f"{hrs}h {mins:02d}m"
            
            # Major incidents / status checks along path
            is_blocked = any(n in blocks for n in res["path_nodes"])
            status = "BLOCKED" if is_blocked else ("HIGH_RISK" if risk_score >= 0.66 else ("CAUTION" if risk_score >= 0.33 else "OPEN"))
            
            # Weather / Terrain Risk
            weather_risk = "HEAVY_RAINFALL_ZONE" if risk_score >= 0.55 else ("MODERATE_FOG_PRECIPITATION" if risk_score >= 0.30 else "FAVORABLE")
            bridge_status = "UNDER_WATCH" if risk_score >= 0.60 else "STABLE"
            
            fuel_est = round(dist_km / 3.5 + (res["elevation_gain_m"] / 1000.0) * 2.5, 1)

            return {
                "route_id": route_id,
                "name": name,
                "route_type": route_type,
                "distance_km": dist_km,
                "estimated_time_hrs": duration_hrs,
                "eta_display": eta_display,
                "convlstm_risk_score": risk_score,
                "risk_score": risk_score,
                "risk_level": risk_level,
                "disruption_probability": disruption_prob,
                "predicted_disruption": "ROAD_DISRUPTION" if risk_score > 0.33 else "MINIMAL",
                "road_bridge_status": f"Road: {status} | Bridge: {bridge_status}",
                "weather_risk": weather_risk,
                "route_status": status,
                "elevation_gain_m": res["elevation_gain_m"],
                "fuel_estimate_litres": fuel_est,
                "waypoints": res["waypoints"],
                "path_nodes": res["path_nodes"],
                "composite_penalty": round(duration_hrs * 1.5 + (dist_km / 100.0) + (risk_score * 8.0) + (50.0 if is_blocked else 0.0), 2)
            }

        c_a = build_candidate_route(res_primary, "ROUTE-A", "Route A (Direct Trunk Highway)", "PRIMARY")
        c_b = build_candidate_route(res_alt1 or res_primary, "ROUTE-B", "Route B (AI Risk-Mitigated Bypass)", "AI_OPTIMIZED")
        c_c = build_candidate_route(res_alt2 or res_alt1 or res_primary, "ROUTE-C", "Route C (Secondary Mountain Ridge Bypass)", "EMERGENCY_CORRIDOR")
        
        valid_candidates = [c for c in [c_a, c_b, c_c] if c]

        # Decision Engine Ranking: Best feasible route combines risk + distance + ETA
        # Sort by composite penalty
        valid_candidates.sort(key=lambda x: x["composite_penalty"])
        
        for idx, c in enumerate(valid_candidates):
            if c["route_status"] == "BLOCKED" or c["risk_level"] == "HIGH":
                c["recommendation"] = "AVOID"
                c["recommendation_badge"] = "❌ Avoid"
                c["is_recommended"] = False
            elif idx == 0:
                c["recommendation"] = "RECOMMENDED"
                c["recommendation_badge"] = "✅ Recommended"
                c["is_recommended"] = True
            else:
                c["recommendation"] = "ALTERNATIVE"
                c["recommendation_badge"] = "⚠️ Alternative"
                c["is_recommended"] = False

        # Build recommendation rationale
        recommended_route = next((c for c in valid_candidates if c["is_recommended"]), valid_candidates[0])
        reason = (
            f"{recommended_route['name']} is recommended by the ConvLSTM decision engine. "
            f"It delivers optimal spatiotemporal safety (Risk: {recommended_route['risk_score']} {recommended_route['risk_level']}) "
            f"and ETA of {recommended_route['eta_display']} while circumventing vulnerable mountain chokepoints."
        )

        return {
            "origin": self.nodes.get(start_id, {}),
            "destination": self.nodes.get(dest_id, {}),
            "cargo_type": cargo_type,
            "priority_level": priority_level,
            "candidate_routes": valid_candidates,
            "primary_route": c_a or valid_candidates[0],
            "ai_optimized_route": c_b or valid_candidates[0],
            "emergency_green_route": c_c or valid_candidates[0],
            "recommended_route_id": recommended_route["route_id"],
            "recommendation_justification": reason,
            "convlstm_model_version": convlstm_engine.metadata.get("version", "v1.0-prod"),
            "timestamp": "2026-08-30T05:30:00Z"
        }

    def find_nearby_safe_halts(self, lat: float, lng: float, radius_km: float = 120.0) -> List[Dict[str, Any]]:
        """
        Locates certified safe halt locations within radius when a driver rejects a route or encounters blockage.
        """
        halts = []
        for h in SAFE_HALT_LOCATIONS:
            dist = haversine_distance_km(lat, lng, h["lat"], h["lng"])
            if dist <= radius_km:
                halt_copy = dict(h)
                halt_copy["distance_from_vehicle_km"] = round(dist, 1)
                halt_copy["eta_minutes"] = int(round((dist / 35.0) * 60.0))
                halts.append(halt_copy)
                
        halts.sort(key=lambda x: x["distance_from_vehicle_km"])
        if not halts:
            # Fallback to closest 2 locations regardless of radius
            all_sorted = []
            for h in SAFE_HALT_LOCATIONS:
                dist = haversine_distance_km(lat, lng, h["lat"], h["lng"])
                halt_copy = dict(h)
                halt_copy["distance_from_vehicle_km"] = round(dist, 1)
                halt_copy["eta_minutes"] = int(round((dist / 35.0) * 60.0))
                all_sorted.append(halt_copy)
            all_sorted.sort(key=lambda x: x["distance_from_vehicle_km"])
            halts = all_sorted[:3]

        return halts

router_engine = NERRouteOptimizer()

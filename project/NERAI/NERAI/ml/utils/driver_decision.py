"""
Driver accept/reject decision layer (section 21). This is deliberately kept
outside the ConvLSTM model -- it is application logic that consumes ranked
routes (from route_risk.score_routes) and, on rejection, searches curated
nearby halt locations rather than looping the driver through more route
suggestions indefinitely.
"""
from ml.utils.route_risk import find_nearby_safe_halts


def handle_driver_response(decision, ranked_routes, current_location, candidate_halts, risk_grid):
    """
    decision: "ACCEPT" or "REJECT"
    ranked_routes: output of route_risk.score_routes (already ranked)
    candidate_halts: real POI list supplied by caller (map data / admin list)
    """
    if decision == "ACCEPT":
        chosen = next((r for r in ranked_routes if r.get("recommended")), ranked_routes[0])
        return {"action": "NAVIGATE", "route": chosen}

    if decision == "REJECT":
        halts = find_nearby_safe_halts(current_location, candidate_halts, risk_grid)
        return {"action": "SHOW_SAFE_HALTS", "safe_halts": halts}

    raise ValueError(f"Unknown decision: {decision}")

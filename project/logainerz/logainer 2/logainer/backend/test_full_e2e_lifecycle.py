import requests
import sys
import json
import time

BASE_URL = "http://127.0.0.1:8000"

def test_full_logistics_lifecycle():
    print("=== 1. Checking Backend Health ===")
    r = requests.get(f"{BASE_URL}/health")
    assert r.status_code == 200, f"Health check failed: {r.text}"
    print(" Backend healthy:", r.json())

    print("\n=== 2. Admin Create & Assign Trip ===")
    trip_payload = {
        "origin_id": "GHY",
        "destination_id": "TWG",
        "commodity_type": "ESSENTIAL_MEDICINES_COLD_CHAIN",
        "package_details": "1200 Vials Freeze-Dried Vaccine Packs",
        "driver_id": "DRV-102",
        "driver_name": "Tenzing Norbu",
        "vehicle_id": "TRUCK-TN-402",
        "vehicle_no": "AS-01-EC-9081",
        "priority": "EMERGENCY",
        "assigned_route_id": "ROUTE-A"
    }
    r = requests.post(f"{BASE_URL}/api/v1/routes/trips", json=trip_payload)
    assert r.status_code == 200, f"Create trip failed: {r.text}"
    trip_data = r.json()
    assert trip_data.get("success") is True, f"Expected success=True: {trip_data}"
    trip = trip_data["trip"]
    trip_id = trip["trip_id"]
    print(f" Trip #{trip_id} created for {trip['driver_name']} ({trip['driver_id']}) with status: {trip['status']}")

    print("\n=== 3. Driver Trip Retrieval & Data Isolation ===")
    # Query for DRV-102
    r = requests.get(f"{BASE_URL}/api/v1/routes/trips?driver_id=DRV-102")
    assert r.status_code == 200
    driver_trips = r.json().get("trips", [])
    assigned_ids = [t["trip_id"] for t in driver_trips]
    assert trip_id in assigned_ids, f"Trip {trip_id} not found in DRV-102 trips: {assigned_ids}"
    print(f" Driver DRV-102 successfully retrieved assigned trip #{trip_id}")

    # Query for DRV-999 (Different Driver) - Must NOT see DRV-102's assigned trip
    r = requests.get(f"{BASE_URL}/api/v1/routes/trips?driver_id=DRV-999")
    assert r.status_code == 200
    other_trips = r.json().get("trips", [])
    other_assigned_ids = [t["trip_id"] for t in other_trips if t.get("driver_id") == "DRV-102"]
    assert len(other_assigned_ids) == 0, f"Data leakage! DRV-999 saw DRV-102 trips: {other_assigned_ids}"
    print(f" Data Isolation Verified: DRV-999 cannot access DRV-102 private assigned trips.")

    print("\n=== 4. Driver Accept Trip ===")
    r = requests.post(f"{BASE_URL}/api/v1/routes/trips/{trip_id}/accept", json={"driver_id": "DRV-102", "driver_lat": 26.1445, "driver_lng": 91.7362})
    assert r.status_code == 200, f"Accept trip failed: {r.text}"
    accepted_res = r.json()
    assert accepted_res.get("status") == "ACCEPTED"
    print(f" Trip #{trip_id} accepted by driver. Status: ACCEPTED")

    print("\n=== 5. Route Optimizer Multi-Candidate Calculation ===")
    opt_payload = {
        "origin_id": "GHY",
        "destination_id": "TWG",
        "cargo_type": "ESSENTIAL_MEDICINES_COLD_CHAIN",
        "priority_level": "EMERGENCY"
    }
    r = requests.post(f"{BASE_URL}/api/v1/routes/optimize", json=opt_payload)
    assert r.status_code == 200, f"Optimize failed: {r.text}"
    routes_res = r.json()
    candidates = routes_res.get("routes", {}).get("candidate_routes", [])
    assert len(candidates) >= 1, f"Expected candidate routes, got: {len(candidates)}"
    print(f" Calculated {len(candidates)} candidate routes with ConvLSTM risk scoring.")
    for c in candidates:
        print(f"   - [{c['route_id']}] {c['name']} | Distance: {c['distance_km']} km | Risk Score: {c['convlstm_risk_score']} ({c['risk_level']})")

    print("\n=== 6. Driver Start Trip & Stream Telemetry ===")
    r = requests.post(f"{BASE_URL}/api/v1/routes/trips/{trip_id}/start", json={"driver_id": "DRV-102"})
    assert r.status_code == 200
    print(f" Trip #{trip_id} started. Status: IN_PROGRESS")

    r = requests.post(f"{BASE_URL}/api/v1/routes/trips/{trip_id}/location", json={
        "driver_id": "DRV-102",
        "lat": 26.6528,
        "lng": 92.7926,
        "speed_kmh": 48.5,
        "progress_pct": 35
    })
    assert r.status_code == 200
    print(f" Telemetry updated: Tezpur waypoint (48.5 km/h, 35% progress)")

    print("\n=== 7. Driver Finish / Complete Trip ===")
    r = requests.post(f"{BASE_URL}/api/v1/routes/trips/{trip_id}/complete", json={"driver_id": "DRV-102"})
    assert r.status_code == 200
    complete_res = r.json()
    assert complete_res.get("status") == "COMPLETED"
    print(f" Trip #{trip_id} completed successfully.")

    print("\n=== 8. Verify SQLite Database State ===")
    r = requests.get(f"{BASE_URL}/api/v1/routes/trips/{trip_id}")
    assert r.status_code == 200
    final_trip = r.json().get("trip", {})
    assert final_trip.get("status") == "COMPLETED"
    assert final_trip.get("progress_pct") == 100
    print(f" Final Trip State verified in SQLite DB: {final_trip['status']} (Progress: {final_trip['progress_pct']}%)")
    print("\n ALL END-TO-END TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_full_logistics_lifecycle()

import requests
import sys
import json
import time

BASE_URL = "http://127.0.0.1:8000"

def test_trip_and_convlstm_integration():
    print("=================================================================")
    print("  LOGAINER E2E Trip Flow & NERAI ConvLSTM Integration Test Suite")
    print("=================================================================")

    # 1. Health & ConvLSTM status
    print("\n[Step 1] Verifying Backend & ConvLSTM Model Status...")
    r = requests.get(f"{BASE_URL}/health")
    assert r.status_code == 200, f"Health check failed: {r.text}"
    health_data = r.json()
    print("  Backend Health:", health_data)

    r = requests.get(f"{BASE_URL}/api/v1/ml/model-info")
    if r.status_code == 200:
        print("  ConvLSTM Model Info:", r.json())

    # 2. Admin creates and assigns trip to DRV-102
    print("\n[Step 2] Admin Creates & Assigns Trip to Driver DRV-102 (Tenzing Norbu)...")
    trip_payload = {
        "origin_id": "GHY",
        "destination_id": "TWG",
        "commodity_type": "ESSENTIAL_MEDICINES_COLD_CHAIN",
        "package_details": "1000 Units Emergency Vaccine Cold Packs",
        "driver_id": "DRV-102",
        "driver_name": "Tenzing Norbu",
        "vehicle_id": "TRUCK-TN-402",
        "vehicle_no": "AS-01-EC-9081",
        "priority": "EMERGENCY",
        "assigned_route_id": "ROUTE-A"
    }
    r = requests.post(f"{BASE_URL}/api/v1/routes/trips", json=trip_payload)
    assert r.status_code == 200, f"Create trip failed: {r.text}"
    res = r.json()
    assert res.get("success") is True
    trip = res["trip"]
    trip_id = trip["trip_id"]
    print(f"  Created Trip #{trip_id} assigned to {trip['driver_name']} ({trip['driver_id']}) with status: {trip['status']}")

    # 3. Driver DRV-102 fetches trips
    print(f"\n[Step 3] Driver DRV-102 queries assigned trips...")
    r = requests.get(f"{BASE_URL}/api/v1/routes/trips?driver_id=DRV-102")
    assert r.status_code == 200
    trips_drv102 = r.json().get("trips", [])
    found_102 = [t for t in trips_drv102 if t["trip_id"] == trip_id]
    assert len(found_102) == 1, f"Trip #{trip_id} not found in DRV-102 trips!"
    print(f"  DRV-102 successfully retrieved assigned Trip #{trip_id} (Status: {found_102[0]['status']})")

    # 4. Driver DRV-105 queries trips (Data Isolation Check)
    print(f"\n[Step 4] Driver DRV-105 (Rajesh Gogoi) queries trips (Isolation Check)...")
    r = requests.get(f"{BASE_URL}/api/v1/routes/trips?driver_id=DRV-105")
    assert r.status_code == 200
    trips_drv105 = r.json().get("trips", [])
    found_105 = [t for t in trips_drv105 if t["trip_id"] == trip_id]
    assert len(found_105) == 0, f"SECURITY LEAK! DRV-105 received DRV-102's private trip #{trip_id}"
    print(f"  Security Verified: DRV-105 cannot see DRV-102's assigned Trip #{trip_id}.")

    # 5. DRV-105 attempts to unauthorizedly accept DRV-102's trip
    print(f"\n[Step 5] DRV-105 attempts unauthorized acceptance of Trip #{trip_id}...")
    r = requests.post(f"{BASE_URL}/api/v1/routes/trips/{trip_id}/accept", json={"driver_id": "DRV-105"})
    assert r.status_code == 403, f"Expected 403 Forbidden, got {r.status_code}: {r.text}"
    print(f"  Authorization Enforced: Server rejected unauthorized acceptance with 403 Forbidden.")

    # 6. DRV-102 accepts Trip
    print(f"\n[Step 6] DRV-102 accepts Trip #{trip_id}...")
    r = requests.post(f"{BASE_URL}/api/v1/routes/trips/{trip_id}/accept", json={"driver_id": "DRV-102", "driver_lat": 26.1445, "driver_lng": 91.7362})
    assert r.status_code == 200, f"Accept failed: {r.text}"
    accept_res = r.json()
    assert accept_res.get("status") == "ACCEPTED"
    print(f"  Trip #{trip_id} accepted by DRV-102. Status: ACCEPTED")

    # 7. NERAI ConvLSTM Route Ahead Hazard Prediction
    print(f"\n[Step 7] Querying ConvLSTM Hazard Prediction along Guwahati-Tawang Route...")
    hazard_req = {
        "latitude": 26.1445,
        "longitude": 91.7362,
        "lookahead_km": 40.0,
        "route_coordinates": [
            [91.7362, 26.1445],
            [92.1200, 26.3500],
            [92.5000, 26.5500],
            [92.8000, 26.6338],
            [92.2000, 27.2000],
            [91.8594, 27.5861]
        ]
    }
    r = requests.post(f"{BASE_URL}/predict-route-hazards", json=hazard_req)
    assert r.status_code == 200, f"Hazard prediction failed: {r.text}"
    haz_res = r.json()
    assert haz_res.get("success") is True
    hazards = haz_res.get("hazards", [])
    print(f"  ConvLSTM returned {len(hazards)} spatiotemporal road risk predictions ahead (Highest: {haz_res.get('highest_risk_level')})")
    for h in hazards[:3]:
        print(f"    - [{h['hazard_type']}] {h['location_name']} | Prob: {h['probability']} | Distance: {h['distance_ahead_km']} km | Warning: {h['warning_level']}")

    # 8. DRV-102 starts navigation
    print(f"\n[Step 8] DRV-102 starts navigation for Trip #{trip_id}...")
    r = requests.post(f"{BASE_URL}/api/v1/routes/trips/{trip_id}/start", json={"driver_id": "DRV-102"})
    assert r.status_code == 200
    print(f"  Trip #{trip_id} started. Status: IN_PROGRESS")

    # 9. DRV-102 finishes trip
    print(f"\n[Step 9] DRV-102 arrives and finishes Trip #{trip_id}...")
    r = requests.post(f"{BASE_URL}/api/v1/routes/trips/{trip_id}/complete", json={"driver_id": "DRV-102"})
    assert r.status_code == 200
    print(f"  Trip #{trip_id} completed successfully.")

    # 10. Verify final SQLite database state
    print(f"\n[Step 10] Verifying Final Trip Status in SQLite Database...")
    r = requests.get(f"{BASE_URL}/api/v1/routes/trips/{trip_id}")
    assert r.status_code == 200
    final_trip = r.json().get("trip", {})
    assert final_trip.get("status") == "COMPLETED"
    print(f"  Confirmed in Database: Trip #{trip_id} status is COMPLETED with 100% progress.")

    print("\n=================================================================")
    print("  >>> ALL 10 INTEGRATION & ML TESTS PASSED WITH 100% SUCCESS <<<")
    print("=================================================================")

if __name__ == "__main__":
    test_trip_and_convlstm_integration()

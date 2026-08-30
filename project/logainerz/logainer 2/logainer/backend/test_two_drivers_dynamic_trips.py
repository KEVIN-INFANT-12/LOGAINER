import requests
import sys
import json
import time

BASE_URL = "http://127.0.0.1:8000"

def test_two_drivers_fully_dynamic_flow():
    print("=================================================================")
    print("  TWO-DRIVER FULLY DYNAMIC TRIP ASSIGNMENT & PERSISTENCE TEST   ")
    print("=================================================================")

    # 1. Health check
    print("\n[1] Checking Backend Health...")
    r = requests.get(f"{BASE_URL}/health")
    assert r.status_code == 200, f"Backend offline: {r.text}"
    print("  Backend Online & Healthy.")

    # 2. Admin Assigns Trip 1 to Driver A (DRV-102 - Tenzing Norbu)
    print("\n[2] Admin assigns Trip 1 to Driver A (DRV-102 - Tenzing Norbu)...")
    t1_payload = {
        "origin_id": "GHY",
        "destination_id": "TWG",
        "commodity_type": "ESSENTIAL_MEDICINES_COLD_CHAIN",
        "package_details": "800 Units High-Altitude Medical Supplies",
        "driver_id": "DRV-102",
        "driver_name": "Tenzing Norbu",
        "vehicle_id": "TRUCK-TN-402",
        "vehicle_no": "AS-01-EC-9081",
        "priority": "EMERGENCY",
        "assigned_route_id": "ROUTE-A"
    }
    r = requests.post(f"{BASE_URL}/api/v1/routes/trips", json=t1_payload)
    assert r.status_code == 200, f"Admin assign Trip 1 failed: {r.text}"
    t1_res = r.json()
    assert t1_res.get("success") is True
    trip1 = t1_res["trip"]
    trip1_id = trip1["trip_id"]
    print(f"  Trip 1 Created: #{trip1_id} -> Assigned to DRV-102 ({trip1['driver_name']})")

    # 3. Verify Driver A sees Trip 1, Driver B does NOT see Trip 1
    print("\n[3] Verifying Isolation for Trip 1...")
    r_a = requests.get(f"{BASE_URL}/api/v1/routes/trips?driver_id=DRV-102")
    assert r_a.status_code == 200
    trips_a = [t["trip_id"] for t in r_a.json().get("trips", [])]
    assert trip1_id in trips_a, f"Driver A (DRV-102) did NOT receive Trip 1 ({trip1_id})!"
    print(f"  Driver A (DRV-102) successfully retrieved Trip 1: #{trip1_id}")

    r_b = requests.get(f"{BASE_URL}/api/v1/routes/trips?driver_id=DRV-105")
    assert r_b.status_code == 200
    trips_b = [t["trip_id"] for t in r_b.json().get("trips", []) if t.get("driver_id") == "DRV-102"]
    assert len(trips_b) == 0, f"DATA LEAKAGE! Driver B (DRV-105) received Driver A's trip: {trips_b}"
    print(f"  Driver B (DRV-105) does NOT see Trip 1 (Isolation Confirmed).")

    # 4. Admin Assigns Trip 2 to Driver B (DRV-105 - Rajesh Gogoi)
    print("\n[4] Admin assigns Trip 2 to Driver B (DRV-105 - Rajesh Gogoi)...")
    t2_payload = {
        "origin_id": "TEZ",
        "destination_id": "SHL",
        "commodity_type": "FOOD_GRAINS",
        "package_details": "400 Bags Fortified Rice & Pulses",
        "driver_id": "DRV-105",
        "driver_name": "Rajesh Gogoi",
        "vehicle_id": "TRUCK-AS-101",
        "vehicle_no": "AS-01-EC-9081",
        "priority": "HIGH",
        "assigned_route_id": "ROUTE-B"
    }
    r = requests.post(f"{BASE_URL}/api/v1/routes/trips", json=t2_payload)
    assert r.status_code == 200, f"Admin assign Trip 2 failed: {r.text}"
    t2_res = r.json()
    assert t2_res.get("success") is True
    trip2 = t2_res["trip"]
    trip2_id = trip2["trip_id"]
    print(f"  Trip 2 Created: #{trip2_id} -> Assigned to DRV-105 ({trip2['driver_name']})")

    # 5. Verify Driver B sees Trip 2, Driver A does NOT see Trip 2
    print("\n[5] Verifying Isolation for Trip 2...")
    r_b2 = requests.get(f"{BASE_URL}/api/v1/routes/trips?driver_id=DRV-105")
    assert r_b2.status_code == 200
    trips_b_all = [t["trip_id"] for t in r_b2.json().get("trips", [])]
    assert trip2_id in trips_b_all, f"Driver B (DRV-105) did NOT receive Trip 2 ({trip2_id})!"
    print(f"  Driver B (DRV-105) successfully retrieved Trip 2: #{trip2_id}")

    r_a2 = requests.get(f"{BASE_URL}/api/v1/routes/trips?driver_id=DRV-102")
    assert r_a2.status_code == 200
    trips_a_leak = [t["trip_id"] for t in r_a2.json().get("trips", []) if t.get("driver_id") == "DRV-105"]
    assert len(trips_a_leak) == 0, f"DATA LEAKAGE! Driver A (DRV-102) received Driver B's trip: {trips_a_leak}"
    print(f"  Driver A (DRV-102) does NOT see Trip 2 (Isolation Confirmed).")

    # 6. Cross-driver Unauthorized Acceptance Security Tests
    print("\n[6] Testing Unauthorized Acceptance Protections...")
    # Driver B tries to accept Trip 1
    r_fake1 = requests.post(f"{BASE_URL}/api/v1/routes/trips/{trip1_id}/accept", json={"driver_id": "DRV-105"})
    assert r_fake1.status_code == 403, f"Expected 403 Forbidden, got {r_fake1.status_code}"
    print(f"  Driver B (DRV-105) rejected when attempting to accept Driver A's Trip 1 (403 Forbidden).")

    # Driver A tries to accept Trip 2
    r_fake2 = requests.post(f"{BASE_URL}/api/v1/routes/trips/{trip2_id}/accept", json={"driver_id": "DRV-102"})
    assert r_fake2.status_code == 403, f"Expected 403 Forbidden, got {r_fake2.status_code}"
    print(f"  Driver A (DRV-102) rejected when attempting to accept Driver B's Trip 2 (403 Forbidden).")

    # 7. Authorized Acceptances
    print("\n[7] Executing Authorized Driver Acceptances...")
    # Driver A accepts Trip 1
    r_acc1 = requests.post(f"{BASE_URL}/api/v1/routes/trips/{trip1_id}/accept", json={"driver_id": "DRV-102"})
    assert r_acc1.status_code == 200
    print(f"  Driver A (DRV-102) accepted Trip 1 -> Status: ACCEPTED")

    # Driver B accepts Trip 2
    r_acc2 = requests.post(f"{BASE_URL}/api/v1/routes/trips/{trip2_id}/accept", json={"driver_id": "DRV-105"})
    assert r_acc2.status_code == 200
    print(f"  Driver B (DRV-105) accepted Trip 2 -> Status: ACCEPTED")

    # 8. Admin Verification & Page Reload Persistence
    print("\n[8] Verifying Database Persistence (Simulating Admin Refresh)...")
    db_trip1 = requests.get(f"{BASE_URL}/api/v1/routes/trips/{trip1_id}").json().get("trip", {})
    assert db_trip1.get("status") == "ACCEPTED", f"Trip 1 status in DB is {db_trip1.get('status')}"
    assert db_trip1.get("driver_id") == "DRV-102"
    print(f"  Trip 1 Database State: {db_trip1['status']} | Driver: {db_trip1['driver_id']}")

    db_trip2 = requests.get(f"{BASE_URL}/api/v1/routes/trips/{trip2_id}").json().get("trip", {})
    assert db_trip2.get("status") == "ACCEPTED", f"Trip 2 status in DB is {db_trip2.get('status')}"
    assert db_trip2.get("driver_id") == "DRV-105"
    print(f"  Trip 2 Database State: {db_trip2['status']} | Driver: {db_trip2['driver_id']}")

    # 9. Lifecycle Progression (Start -> Finish)
    print("\n[9] Testing Trip Lifecycle (Start -> Finish -> Complete)...")
    # Driver A starts Trip 1
    r_start = requests.post(f"{BASE_URL}/api/v1/routes/trips/{trip1_id}/start", json={"driver_id": "DRV-102"})
    assert r_start.status_code == 200
    db_trip1_prog = requests.get(f"{BASE_URL}/api/v1/routes/trips/{trip1_id}").json().get("trip", {})
    assert db_trip1_prog.get("status") == "IN_PROGRESS"
    print(f"  Driver A started Trip 1 -> Status: IN_PROGRESS")

    # Driver A completes Trip 1
    r_comp = requests.post(f"{BASE_URL}/api/v1/routes/trips/{trip1_id}/complete", json={"driver_id": "DRV-102"})
    assert r_comp.status_code == 200
    db_trip1_done = requests.get(f"{BASE_URL}/api/v1/routes/trips/{trip1_id}").json().get("trip", {})
    assert db_trip1_done.get("status") == "COMPLETED"
    print(f"  Driver A completed Trip 1 -> Final DB Status: COMPLETED (Progress: 100%)")

    print("\n=================================================================")
    print("  >>> ALL TWO-DRIVER DYNAMIC INTEGRATION TESTS PASSED 100% <<<   ")
    print("=================================================================")

if __name__ == "__main__":
    test_two_drivers_fully_dynamic_flow()

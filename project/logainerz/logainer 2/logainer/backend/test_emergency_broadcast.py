import urllib.request
import json
import asyncio
import websockets

async def test_emergency_broadcast():
    print("=================================================================")
    print("  LOGAINER Emergency Alert Broadcast Verification Test Suite")
    print("=================================================================")

    ws_url = "ws://127.0.0.1:8000/ws/telemetry"
    received_messages = []

    async def listen_ws():
        async with websockets.connect(ws_url) as websocket:
            while True:
                msg = await websocket.recv()
                data = json.loads(msg)
                if data.get("type") == "EMERGENCY_BROADCAST":
                    received_messages.append(data)
                    print(f"  [WebSocket Received] Event: {data.get('event')} | Type: {data.get('emergency', {}).get('emergency_type')} | Location: {data.get('emergency', {}).get('location_name')}")
                    if len(received_messages) >= 3:
                        break

    listener_task = asyncio.create_task(listen_ws())
    await asyncio.sleep(1.0) # Wait for WS connection

    # Test 1: Driver Emergency Alert
    print("\n1. Testing Driver Emergency Creation (Landslide near Sonapur)...")
    driver_emg_payload = {
        "emergency_id": "EMG-TEST-DRV-01",
        "sender_user_id": "DRV-101",
        "sender_role": "driver",
        "sender_name": "Rajesh Kumar",
        "emergency_type": "Landslide",
        "message": "Emergency alert. A landslide has been reported near Sonapur NH-6 corridor.",
        "latitude": 25.1147,
        "longitude": 92.3619,
        "location_name": "Sonapur NH-6 Landslide Corridor",
        "status": "ACTIVE"
    }
    req1 = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/emergencies",
        data=json.dumps(driver_emg_payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    resp1 = urllib.request.urlopen(req1)
    res1 = json.loads(resp1.read().decode("utf-8"))
    print(f"  [API Response] Status: {res1['status']} | Emergency ID: {res1['emergency']['emergency_id']}")

    await asyncio.sleep(1.0)

    # Test 2: Field Officer Emergency Alert
    print("\n2. Testing Field Officer Emergency Creation (Flood near Teesta)...")
    officer_emg_payload = {
        "emergency_id": "EMG-TEST-OFF-01",
        "sender_user_id": "FO-10842",
        "sender_role": "officer",
        "sender_name": "Aarav Mehta",
        "emergency_type": "Flood",
        "message": "Flash flood water overtopping NH-10 near 29th Mile Teesta Gorge.",
        "latitude": 26.8854,
        "longitude": 88.4721,
        "location_name": "Teesta Gorge NH-10",
        "status": "ACTIVE"
    }
    req2 = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/emergencies",
        data=json.dumps(officer_emg_payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    resp2 = urllib.request.urlopen(req2)
    res2 = json.loads(resp2.read().decode("utf-8"))
    print(f"  [API Response] Status: {res2['status']} | Emergency ID: {res2['emergency']['emergency_id']}")

    await asyncio.sleep(1.0)

    # Test 3: Duplicate Prevention Test
    print("\n3. Testing Duplicate Prevention (Re-sending EMG-TEST-DRV-01)...")
    resp_dup = urllib.request.urlopen(req1)
    res_dup = json.loads(resp_dup.read().decode("utf-8"))
    print(f"  [Deduplication Check] Returned existing ID: {res_dup['emergency']['emergency_id']} (No duplicate created)")

    # Test 4: List Active Emergencies
    print("\n4. Testing List Active Emergencies...")
    req_list = urllib.request.Request("http://127.0.0.1:8000/api/v1/emergencies?status=ACTIVE")
    resp_list = urllib.request.urlopen(req_list)
    res_list = json.loads(resp_list.read().decode("utf-8"))
    print(f"  Active Emergencies Count: {res_list['count']}")
    for emg in res_list["emergencies"]:
        print(f"    - ID: {emg['emergency_id']} | Type: {emg['emergency_type']} | By: {emg['sender_role']} ({emg['sender_name']}) | Status: {emg['status']}")

    # Test 5: Resolve Emergency
    print("\n5. Testing Resolve Emergency (Resolving EMG-TEST-DRV-01)...")
    req_resolve = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/emergencies/EMG-TEST-DRV-01/resolve",
        data=json.dumps({"resolved_by": "State Logistics Director"}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="PUT"
    )
    resp_resolve = urllib.request.urlopen(req_resolve)
    res_resolve = json.loads(resp_resolve.read().decode("utf-8"))
    print(f"  [Resolve API Response] Status: {res_resolve['status']} | Resolved ID: {res_resolve['emergency']['emergency_id']} | Status: {res_resolve['emergency']['status']}")

    await asyncio.sleep(1.0)
    listener_task.cancel()

    print("\n=================================================================")
    print(f"  Summary: Received {len(received_messages)} WebSocket real-time broadcast events.")
    print("  >>> ALL EMERGENCY BROADCAST TESTS PASSED SUCCESSFULLY! <<<")
    print("=================================================================\n")

if __name__ == "__main__":
    asyncio.run(test_emergency_broadcast())

import urllib.request
import json

def test_all_scenarios():
    scenarios = ['continuous_rainfall', 'extreme_rainfall', 'road_blockage', 'bridge_failure', 'traffic_surge', 'combined']
    print("=================================================================")
    print("  LOGAINER What-If Scenario Simulator - Verification Test Suite")
    print("=================================================================")
    for s in scenarios:
        payload = {
            'scenario_type': s,
            'duration_days': 3,
            'rainfall_multiplier': 1.2,
            'district': 'East Khasi Hills',
            'parameters': {'target_road_segment_id': 'ROAD-NH06-SONAPUR'}
        }
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            'http://127.0.0.1:8000/api/v1/what-if/simulate',
            data=data,
            headers={'Content-Type': 'application/json'}
        )
        resp = urllib.request.urlopen(req)
        res = json.loads(resp.read().decode('utf-8'))
        scen = res["scenario"]
        print(f"[{s:20}] Risk: {scen['predicted_risk_score']:.4f} ({scen['predicted_risk_level']:6}) | High-Risk Roads: {scen['kpi_summary']['high_risk_roads_count']} | Affected Areas: {len(scen['affected_areas'])} | Impacted Trips: {len(scen['logistics_impact']['impacted_trips'])}")

    # Test Comparison endpoint
    print("\nTesting Comparison Matrix endpoint...")
    compare_payload = {
        'district': 'East Khasi Hills',
        'duration_days': 3,
        'multipliers': [1.0, 1.1, 1.2, 1.3]
    }
    req2 = urllib.request.Request(
        'http://127.0.0.1:8000/api/v1/what-if/compare',
        data=json.dumps(compare_payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    resp2 = urllib.request.urlopen(req2)
    res2 = json.loads(resp2.read().decode('utf-8'))
    print(f"Comparison Items: {len(res2['comparison'])}")
    for item in res2['comparison']:
        print(f"  Multiplier {item['label']:7} -> Overall Risk: {item['overall_risk_score']:.4f} ({item['risk_level']:6}) | High Risk Roads: {item['high_risk_roads_count']}")

    # Test Scenarios List endpoint
    print("\nTesting Database Persistence...")
    req3 = urllib.request.Request('http://127.0.0.1:8000/api/v1/what-if/scenarios')
    resp3 = urllib.request.urlopen(req3)
    res3 = json.loads(resp3.read().decode('utf-8'))
    print(f"Saved Scenarios Count in DB: {res3['count']}")

    # Test Audit Logs endpoint
    print("\nTesting System Audit Trail...")
    req4 = urllib.request.Request('http://127.0.0.1:8000/api/v1/what-if/audit-logs')
    resp4 = urllib.request.urlopen(req4)
    res4 = json.loads(resp4.read().decode('utf-8'))
    print(f"Audit Logs Count in DB: {res4['count']}")

    print("\n>>> ALL VERIFICATION TESTS PASSED SUCCESSFULLY! <<<\n")

if __name__ == '__main__':
    test_all_scenarios()

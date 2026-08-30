import sqlite3
import os
import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logainer.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Trips table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS trips (
            trip_id TEXT PRIMARY KEY,
            trip_code TEXT,
            origin_id TEXT,
            origin_name TEXT,
            destination_id TEXT,
            destination_name TEXT,
            commodity_type TEXT,
            package_details TEXT,
            driver_id TEXT,
            driver_name TEXT,
            driver_phone TEXT,
            vehicle_id TEXT,
            vehicle_no TEXT,
            priority TEXT DEFAULT 'EMERGENCY',
            status TEXT DEFAULT 'ASSIGNED',
            assigned_route_id TEXT,
            assigned_route_name TEXT,
            distance_km REAL,
            duration_mins INTEGER,
            eta_display TEXT,
            convlstm_risk_score REAL DEFAULT 0.25,
            risk_level TEXT DEFAULT 'LOW',
            instructions TEXT,
            road_condition TEXT,
            created_at TEXT,
            assigned_at TEXT,
            accepted_at TEXT,
            started_at TEXT,
            completed_at TEXT,
            current_lat REAL,
            current_lng REAL,
            progress_pct INTEGER DEFAULT 0,
            speed_kmh REAL DEFAULT 0.0,
            connectivity TEXT DEFAULT 'CONNECTED',
            candidate_routes_json TEXT,
            safe_halts_json TEXT,
            driver_response TEXT,
            rejection_reason TEXT
        )
    ''')

    # Fleet vehicles table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS fleet_vehicles (
            id TEXT PRIMARY KEY,
            vehicle_no TEXT,
            cargo_type TEXT,
            commodity_type TEXT,
            cargo_desc TEXT,
            origin_id TEXT,
            origin_name TEXT,
            destination_id TEXT,
            destination_name TEXT,
            current_lat REAL,
            current_lng REAL,
            speed_kmh REAL DEFAULT 0.0,
            heading_deg INTEGER DEFAULT 0,
            driver_id TEXT,
            driver_name TEXT,
            driver_phone TEXT,
            temp_celsius REAL,
            weight_tonnes REAL,
            progress_pct INTEGER DEFAULT 0,
            status TEXT DEFAULT 'AVAILABLE',
            connectivity_status TEXT DEFAULT 'CONNECTED',
            risk_advisory TEXT,
            is_sos INTEGER DEFAULT 0,
            ilp_status TEXT DEFAULT 'Cleared',
            gps_signal TEXT DEFAULT 'Strong (4G/5G)',
            mid_trip_risk_score REAL DEFAULT 0.22,
            mid_trip_risk_level TEXT DEFAULT 'LOW',
            disruption_alert TEXT,
            updated_at TEXT
        )
    ''')

    # What-If scenarios persistence table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS what_if_scenarios (
            scenario_id TEXT PRIMARY KEY,
            created_by TEXT,
            scenario_type TEXT,
            district TEXT,
            parameters_json TEXT,
            prediction_horizon TEXT,
            predicted_risk REAL,
            predicted_risk_level TEXT,
            kpi_summary_json TEXT,
            affected_roads_json TEXT,
            affected_areas_json TEXT,
            logistics_impact_json TEXT,
            candidate_routes_json TEXT,
            recommended_route_json TEXT,
            model_metadata_json TEXT,
            created_at TEXT
        )
    ''')

    # System Audit logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_logs (
            log_id TEXT PRIMARY KEY,
            user_id TEXT,
            username TEXT,
            action TEXT,
            details_json TEXT,
            ip_address TEXT,
            timestamp TEXT
        )
    ''')

    # Emergency Alerts table (Broadcast & Synchronization)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS emergencies (
            emergency_id TEXT PRIMARY KEY,
            sender_user_id TEXT,
            sender_role TEXT,
            sender_name TEXT,
            emergency_type TEXT NOT NULL,
            message TEXT,
            latitude REAL,
            longitude REAL,
            location_name TEXT,
            status TEXT DEFAULT 'ACTIVE',
            resolved_by TEXT,
            resolved_at TEXT,
            created_at TEXT
        )
    ''')

    conn.commit()

    # Seed initial demo trips if empty
    cursor.execute('SELECT COUNT(*) FROM trips')
    count = cursor.fetchone()[0]
    if count == 0:
        seed_initial_trips(cursor)
        conn.commit()

    conn.close()

def seed_initial_trips(cursor):
    now_iso = datetime.now(timezone.utc).isoformat()
    initial_trips = [
        {
            "trip_id": "TR-2048",
            "trip_code": "TR-2048",
            "origin_id": "GHY",
            "origin_name": "Guwahati Distribution Center",
            "destination_id": "SHL",
            "destination_name": "Shillong Warehouse",
            "commodity_type": "Electronics",
            "package_details": "24 Packages Fragile Electronic Equipment",
            "driver_id": "DRV-102",
            "driver_name": "Tenzing Norbu",
            "driver_phone": "+91 98624-55102",
            "vehicle_id": "TRUCK-NER-402",
            "vehicle_no": "AS-01-EC-9081",
            "priority": "priority",
            "status": "ASSIGNED",
            "assigned_route_id": "ROUTE-A",
            "assigned_route_name": "NH-40 Express Corridor",
            "distance_km": 98.0,
            "duration_mins": 140,
            "eta_display": "2h 20m",
            "convlstm_risk_score": 0.35,
            "risk_level": "MEDIUM",
            "instructions": "Handle with care. Fragile electronic equipment. Use padded loading.",
            "road_condition": "Wet roads reported on NH-40 beyond Nongpoh. Drive cautiously.",
            "created_at": now_iso,
            "assigned_at": now_iso,
            "current_lat": 26.1445,
            "current_lng": 91.7362,
            "progress_pct": 0,
            "speed_kmh": 0.0
        },
        {
            "trip_id": "TR-2036",
            "trip_code": "TR-2036",
            "origin_id": "GHY",
            "origin_name": "Guwahati Medical Hub",
            "destination_id": "TEZ",
            "destination_name": "Tezpur Civil Depot",
            "commodity_type": "ESSENTIAL_MEDICINES",
            "package_details": "45 Crates Critical Cold-Chain Vaccines & Blood Units",
            "driver_id": "DRV-102",
            "driver_name": "Tenzing Norbu",
            "driver_phone": "+91 98624-55102",
            "vehicle_id": "TRUCK-NER-403",
            "vehicle_no": "AS-01-MC-4412",
            "priority": "urgent",
            "status": "ASSIGNED",
            "assigned_route_id": "ROUTE-B",
            "assigned_route_name": "Route B (Risk-Mitigated Bypass)",
            "distance_km": 175.0,
            "duration_mins": 220,
            "eta_display": "3h 40m",
            "convlstm_risk_score": 0.22,
            "risk_level": "LOW",
            "instructions": "Temperature-sensitive cargo. Maintain cold chain (2-8°C). Priority dispatch.",
            "road_condition": "Clear roads reported on corridor.",
            "created_at": now_iso,
            "assigned_at": now_iso,
            "current_lat": 26.1445,
            "current_lng": 91.7362,
            "progress_pct": 0,
            "speed_kmh": 0.0
        },
        {
            "trip_id": "TR-2029",
            "trip_code": "TR-2029",
            "origin_id": "GHY",
            "origin_name": "Guwahati Logistics Hub",
            "destination_id": "NLG",
            "destination_name": "Nagaon Relief Center",
            "commodity_type": "Water Purification Units",
            "package_details": "12 High-Capacity Flood Relief Water Purification Units",
            "driver_id": "demo-driver",
            "driver_name": "Rajesh Kumar",
            "driver_phone": "+91 98765-43210",
            "vehicle_id": "TRUCK-NER-404",
            "vehicle_no": "AS-01-WD-1029",
            "priority": "urgent",
            "status": "ASSIGNED",
            "assigned_route_id": "ROUTE-A",
            "assigned_route_name": "NH-27 Central Trunk",
            "distance_km": 122.0,
            "duration_mins": 160,
            "eta_display": "2h 40m",
            "convlstm_risk_score": 0.18,
            "risk_level": "LOW",
            "instructions": "Flood response priority dispatch. Deliver directly to emergency relief camp.",
            "road_condition": "Minor waterlogging near Jagiroad bypass. Passable with heavy truck.",
            "created_at": now_iso,
            "assigned_at": now_iso,
            "current_lat": 26.1445,
            "current_lng": 91.7362,
            "progress_pct": 0,
            "speed_kmh": 0.0
        }
    ]

    for t in initial_trips:
        cursor.execute('''
            INSERT OR REPLACE INTO trips (
                trip_id, trip_code, origin_id, origin_name, destination_id, destination_name,
                commodity_type, package_details, driver_id, driver_name, driver_phone,
                vehicle_id, vehicle_no, priority, status, assigned_route_id, assigned_route_name,
                distance_km, duration_mins, eta_display, convlstm_risk_score, risk_level,
                instructions, road_condition, created_at, assigned_at, current_lat, current_lng,
                progress_pct, speed_kmh
            ) VALUES (
                :trip_id, :trip_code, :origin_id, :origin_name, :destination_id, :destination_name,
                :commodity_type, :package_details, :driver_id, :driver_name, :driver_phone,
                :vehicle_id, :vehicle_no, :priority, :status, :assigned_route_id, :assigned_route_name,
                :distance_km, :duration_mins, :eta_display, :convlstm_risk_score, :risk_level,
                :instructions, :road_condition, :created_at, :assigned_at, :current_lat, :current_lng,
                :progress_pct, :speed_kmh
            )
        ''', t)

# --- Trip DB Queries ---

def db_list_trips(driver_id: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM trips WHERE 1=1"
    params = []

    if driver_id:
        # Match specific assigned driver OR unassigned available pool trips
        query += " AND (driver_id = ? OR driver_id IS NULL OR driver_id = '' OR status IN ('AVAILABLE', 'available'))"
        params.append(driver_id)

    if status and status != "ALL":
        # Normalize status checks
        status_norm = status.upper()
        if status_norm in ["ASSIGNED", "AVAILABLE"]:
            query += " AND status IN ('ASSIGNED', 'AVAILABLE', 'available')"
        elif status_norm in ["ACCEPTED", "EN_ROUTE", "IN_TRANSIT"]:
            query += " AND status IN ('ACCEPTED', 'accepted', 'EN_ROUTE', 'in_transit', 'in_progress', 'going_to_pickup')"
        elif status_norm in ["COMPLETED"]:
            query += " AND status IN ('COMPLETED', 'completed')"
        else:
            query += " AND UPPER(status) = ?"
            params.append(status_norm)

    query += " ORDER BY created_at DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    trips = []
    for r in rows:
        t = dict(r)
        if t.get("candidate_routes_json"):
            try:
                t["candidate_routes"] = json.loads(t["candidate_routes_json"])
            except Exception:
                t["candidate_routes"] = []
        if t.get("safe_halts_json"):
            try:
                t["safe_halts_available"] = json.loads(t["safe_halts_json"])
            except Exception:
                t["safe_halts_available"] = []
        trips.append(t)

    conn.close()
    return trips

def db_get_trip(trip_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM trips WHERE trip_id = ? OR trip_code = ?", (trip_id, trip_id))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    t = dict(row)
    if t.get("candidate_routes_json"):
        try:
            t["candidate_routes"] = json.loads(t["candidate_routes_json"])
        except Exception:
            pass
    return t

def db_save_trip(trip_dict: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()

    candidates_json = json.dumps(trip_dict.get("candidate_routes", [])) if "candidate_routes" in trip_dict else None
    safe_halts_json = json.dumps(trip_dict.get("safe_halts_available", [])) if "safe_halts_available" in trip_dict else None

    trip_id = trip_dict.get("trip_id")
    trip_code = trip_dict.get("trip_code", trip_id)

    cursor.execute('''
        INSERT OR REPLACE INTO trips (
            trip_id, trip_code, origin_id, origin_name, destination_id, destination_name,
            commodity_type, package_details, driver_id, driver_name, driver_phone,
            vehicle_id, vehicle_no, priority, status, assigned_route_id, assigned_route_name,
            distance_km, duration_mins, eta_display, convlstm_risk_score, risk_level,
            instructions, road_condition, created_at, assigned_at, accepted_at, started_at,
            completed_at, current_lat, current_lng, progress_pct, speed_kmh, connectivity,
            candidate_routes_json, safe_halts_json, driver_response, rejection_reason
        ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?
        )
    ''', (
        trip_id,
        trip_code,
        trip_dict.get("origin_id"),
        trip_dict.get("origin_name"),
        trip_dict.get("destination_id"),
        trip_dict.get("destination_name"),
        trip_dict.get("commodity_type"),
        trip_dict.get("package_details"),
        trip_dict.get("driver_id"),
        trip_dict.get("driver_name"),
        trip_dict.get("driver_phone", "+91 98624-55102"),
        trip_dict.get("vehicle_id"),
        trip_dict.get("vehicle_no"),
        trip_dict.get("priority", "EMERGENCY"),
        trip_dict.get("status", "ASSIGNED"),
        trip_dict.get("assigned_route_id"),
        trip_dict.get("assigned_route_name"),
        trip_dict.get("distance_km"),
        trip_dict.get("duration_mins", 180),
        trip_dict.get("eta_display"),
        trip_dict.get("convlstm_risk_score", 0.25),
        trip_dict.get("risk_level", "LOW"),
        trip_dict.get("instructions"),
        trip_dict.get("road_condition"),
        trip_dict.get("created_at", datetime.now(timezone.utc).isoformat()),
        trip_dict.get("assigned_at", datetime.now(timezone.utc).isoformat()),
        trip_dict.get("accepted_at"),
        trip_dict.get("started_at"),
        trip_dict.get("completed_at"),
        trip_dict.get("current_lat"),
        trip_dict.get("current_lng"),
        trip_dict.get("progress_pct", 0),
        trip_dict.get("speed_kmh", 0.0),
        trip_dict.get("connectivity", "CONNECTED"),
        candidates_json,
        safe_halts_json,
        trip_dict.get("driver_response"),
        trip_dict.get("rejection_reason")
    ))

    conn.commit()
    conn.close()
    return trip_dict

def db_update_trip_status(trip_id: str, new_status: str, updates: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()

    existing = db_get_trip(trip_id)
    if not existing:
        conn.close()
        return None

    now_iso = datetime.now(timezone.utc).isoformat()
    update_fields = ["status = ?"]
    params = [new_status]

    if new_status.upper() in ["ACCEPTED", "EN_ROUTE"]:
        update_fields.append("accepted_at = COALESCE(accepted_at, ?)")
        params.append(now_iso)
        update_fields.append("driver_response = 'ACCEPTED'")
    elif new_status.upper() in ["IN_PROGRESS", "IN_TRANSIT"]:
        update_fields.append("started_at = COALESCE(started_at, ?)")
        params.append(now_iso)
    elif new_status.upper() in ["COMPLETED"]:
        update_fields.append("completed_at = ?")
        params.append(now_iso)
        update_fields.append("progress_pct = 100")
        update_fields.append("speed_kmh = 0.0")

    if updates:
        for k, v in updates.items():
            if k in ["current_lat", "current_lng", "progress_pct", "speed_kmh", "driver_id", "driver_name", "rejection_reason", "driver_response"]:
                update_fields.append(f"{k} = ?")
                params.append(v)

    params.append(trip_id)
    params.append(trip_id)
    query = f"UPDATE trips SET {', '.join(update_fields)} WHERE trip_id = ? OR trip_code = ?"
    cursor.execute(query, params)
    conn.commit()
    conn.close()

    return db_get_trip(trip_id)

def db_update_trip_location(trip_id: str, lat: float, lng: float, speed_kmh: float, progress_pct: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE trips SET current_lat = ?, current_lng = ?, speed_kmh = ?, progress_pct = ? WHERE trip_id = ? OR trip_code = ?",
        (lat, lng, speed_kmh, progress_pct, trip_id, trip_id)
    )
    conn.commit()
    conn.close()

# ----------------- What-If Scenarios CRUD -----------------

def db_save_what_if_scenario(scen_dict: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()

    scenario_id = scen_dict.get("scenario_id") or f"SCEN-{uuid.uuid4().hex[:8].upper()}"
    cursor.execute('''
        INSERT OR REPLACE INTO what_if_scenarios (
            scenario_id, created_by, scenario_type, district, parameters_json,
            prediction_horizon, predicted_risk, predicted_risk_level,
            kpi_summary_json, affected_roads_json, affected_areas_json,
            logistics_impact_json, candidate_routes_json, recommended_route_json,
            model_metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        scenario_id,
        scen_dict.get("created_by", "Admin Central Command"),
        scen_dict.get("scenario_type", "continuous_rainfall"),
        scen_dict.get("district", "NER Regional"),
        json.dumps(scen_dict.get("parameters", {})),
        scen_dict.get("prediction_horizon", "3 Days"),
        float(scen_dict.get("predicted_risk_score", 0.35)),
        scen_dict.get("predicted_risk_level", "LOW"),
        json.dumps(scen_dict.get("kpi_summary", {})),
        json.dumps(scen_dict.get("affected_roads", [])),
        json.dumps(scen_dict.get("affected_areas", [])),
        json.dumps(scen_dict.get("logistics_impact", {})),
        json.dumps(scen_dict.get("candidate_routes", [])),
        json.dumps(scen_dict.get("recommended_route", {})),
        json.dumps(scen_dict.get("model_metadata", {})),
        scen_dict.get("created_at", datetime.now(timezone.utc).isoformat())
    ))

    conn.commit()
    conn.close()
    return scen_dict

def db_list_what_if_scenarios(limit: int = 20) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM what_if_scenarios ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()

    results = []
    for r in rows:
        item = dict(r)
        for key in ["parameters_json", "kpi_summary_json", "affected_roads_json", "affected_areas_json", "logistics_impact_json", "candidate_routes_json", "recommended_route_json", "model_metadata_json"]:
            clean_key = key.replace("_json", "")
            if item.get(key):
                try:
                    item[clean_key] = json.loads(item[key])
                except Exception:
                    item[clean_key] = None
        results.append(item)
    return results

def db_get_what_if_scenario(scenario_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM what_if_scenarios WHERE scenario_id = ?", (scenario_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    item = dict(row)
    for key in ["parameters_json", "kpi_summary_json", "affected_roads_json", "affected_areas_json", "logistics_impact_json", "candidate_routes_json", "recommended_route_json", "model_metadata_json"]:
        clean_key = key.replace("_json", "")
        if item.get(key):
            try:
                item[clean_key] = json.loads(item[key])
            except Exception:
                item[clean_key] = None
    return item

# ----------------- System Audit Logs -----------------

def db_log_audit(user_id: str, username: str, action: str, details: Optional[Dict[str, Any]] = None, ip_address: Optional[str] = "127.0.0.1"):
    conn = get_db_connection()
    cursor = conn.cursor()
    log_id = f"AUD-{uuid.uuid4().hex[:10].upper()}"
    timestamp = datetime.now(timezone.utc).isoformat()
    cursor.execute('''
        INSERT INTO audit_logs (log_id, user_id, username, action, details_json, ip_address, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        log_id,
        user_id,
        username,
        action,
        json.dumps(details or {}),
        ip_address,
        timestamp
    ))
    conn.commit()
    conn.close()

def db_list_audit_logs(limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    logs = []
    for r in rows:
        item = dict(r)
        if item.get("details_json"):
            try:
                item["details"] = json.loads(item["details_json"])
            except Exception:
                item["details"] = {}
        logs.append(item)
    return logs

# ----------------- Emergency Alerts (Real-Time Broadcast & Synchronization) -----------------

def db_create_emergency(emg_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Persists an emergency alert with idempotency and deduplication.
    If sender is a driver linked to a fleet vehicle, marks the vehicle's is_sos = 1.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    emergency_id = emg_data.get("emergency_id") or f"EMG-{uuid.uuid4().hex[:8].upper()}"
    
    # Check if already exists (Idempotent / duplicate prevention)
    cursor.execute("SELECT * FROM emergencies WHERE emergency_id = ?", (emergency_id,))
    existing = cursor.fetchone()
    if existing:
        conn.close()
        return dict(existing)
    
    sender_user_id = emg_data.get("sender_user_id", "")
    sender_role = emg_data.get("sender_role", "driver")
    sender_name = emg_data.get("sender_name", "Field Personnel")
    emergency_type = emg_data.get("emergency_type", "Other")
    message = emg_data.get("message", f"{emergency_type} reported at current location")
    latitude = float(emg_data.get("latitude", 26.1445))
    longitude = float(emg_data.get("longitude", 91.7362))
    location_name = emg_data.get("location_name", "Field Coordinates")
    status = emg_data.get("status", "ACTIVE")
    created_at = emg_data.get("timestamp") or datetime.now(timezone.utc).isoformat()
    
    cursor.execute('''
        INSERT INTO emergencies (
            emergency_id, sender_user_id, sender_role, sender_name,
            emergency_type, message, latitude, longitude,
            location_name, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        emergency_id, sender_user_id, sender_role, sender_name,
        emergency_type, message, latitude, longitude,
        location_name, status, created_at
    ))
    
    # If sender is driver, mark vehicle is_sos = 1 in fleet_vehicles
    if sender_role in ["driver", "Driver"]:
        cursor.execute('''
            UPDATE fleet_vehicles
            SET is_sos = 1, status = 'EMERGENCY_SOS', disruption_alert = ?, updated_at = ?
            WHERE driver_id = ? OR id = ?
        ''', (f"🚨 SOS: {emergency_type}", created_at, sender_user_id, sender_user_id))
    
    conn.commit()
    conn.close()
    
    return {
        "emergency_id": emergency_id,
        "sender_user_id": sender_user_id,
        "sender_role": sender_role,
        "sender_name": sender_name,
        "emergency_type": emergency_type,
        "message": message,
        "latitude": latitude,
        "longitude": longitude,
        "location_name": location_name,
        "status": status,
        "created_at": created_at
    }

def db_get_emergency(emergency_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM emergencies WHERE emergency_id = ?", (emergency_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def db_list_emergencies(status: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if status:
        cursor.execute("SELECT * FROM emergencies WHERE status = ? ORDER BY created_at DESC LIMIT ?", (status, limit))
    else:
        cursor.execute("SELECT * FROM emergencies ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def db_resolve_emergency(emergency_id: str, resolved_by: str = "Admin") -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM emergencies WHERE emergency_id = ?", (emergency_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    
    resolved_at = datetime.now(timezone.utc).isoformat()
    cursor.execute('''
        UPDATE emergencies
        SET status = 'RESOLVED', resolved_by = ?, resolved_at = ?
        WHERE emergency_id = ?
    ''', (resolved_by, resolved_at, emergency_id))
    
    # If associated with fleet vehicle, restore normal status
    sender_user_id = row["sender_user_id"]
    cursor.execute('''
        UPDATE fleet_vehicles
        SET is_sos = 0, status = 'EN_ROUTE', disruption_alert = NULL, updated_at = ?
        WHERE driver_id = ? OR id = ?
    ''', (resolved_at, sender_user_id, sender_user_id))
    
    conn.commit()
    
    cursor.execute("SELECT * FROM emergencies WHERE emergency_id = ?", (emergency_id,))
    updated = cursor.fetchone()
    conn.close()
    return dict(updated) if updated else None

# Initialize DB on module import
init_db()

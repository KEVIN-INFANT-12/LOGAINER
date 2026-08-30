import os
import asyncio
import random
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


from fastapi.staticfiles import StaticFiles
from backend.app.core.config import settings
from backend.app.ml.risk_model import ml_model
from backend.app.api.endpoints import (
    auth,
    routing,
    ml_prediction,
    incidents,
    vehicles,
    districts,
    weather,
    ws,
    gdi,
    satellite,
    corridors,
    what_if,
    emergencies
)

# Background telemetry broadcaster task
async def telemetry_background_daemon():
    print("[LOGAINER] Telemetry daemon started for monitored NER fleet units & live WebSockets.")
    while True:
        try:
            await asyncio.sleep(3.0)
            if ws.ws_manager.active_connections:
                updates = []
                for v in vehicles.FLEET_DB[:30]:
                    speed_factor = v.get("speed_kmh", 30) / 3600.0 * 0.03
                    v["current_lat"] += speed_factor * 0.4
                    v["current_lng"] += speed_factor * 0.3 * (1 if v["id"] != "NER-CONVOY-104" else -1)
                    
                    if "temp_celsius" in v and v["temp_celsius"] is not None:
                        if "MEDICINE" in str(v.get("cargo_type", "")):
                            v["temp_celsius"] = round(v["temp_celsius"] + random.uniform(-0.1, 0.1), 2)
                            v["temp_celsius"] = max(2.1, min(7.8, v["temp_celsius"]))
                    
                    v["progress_pct"] = (v["progress_pct"] + 1) if v["progress_pct"] < 99 else 15
                    
                    updates.append({
                        "id": v["id"],
                        "lat": round(v["current_lat"], 5),
                        "lng": round(v["current_lng"], 5),
                        "speed_kmh": round(v["speed_kmh"] + random.uniform(-1.5, 1.5), 1),
                        "temp_celsius": v.get("temp_celsius"),
                        "progress_pct": v["progress_pct"],
                        "status": v["status"],
                        "connectivity_status": v.get("connectivity_status", "CONNECTED"),
                        "mid_trip_risk_score": v.get("mid_trip_risk_score", 0.25),
                        "is_sos": v.get("is_sos", False)
                    })
                    
                await ws.ws_manager.broadcast({
                    "type": "FLEET_GPS_TICK",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "vehicles": updates
                })
        except Exception as e:
            print(f"[LOGAINER Daemon Error]: {e}")
            await asyncio.sleep(5.0)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[LOGAINER] Initializing AI/ML Pipeline: Loading ConvLSTM Spatiotemporal Model...")
    res = ml_model.initialize_all()
    print(f"[LOGAINER] ConvLSTM AI Model initialized: {res.get('status')}")
    daemon_task = asyncio.create_task(telemetry_background_daemon())
    yield
    daemon_task.cancel()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-Powered Logistics Visibility and Terrain Accessibility Intelligence Platform for North Eastern Region (NER)",
    version="2.1.0",
    lifespan=lifespan
)

# Enable CORS for React frontend & mobile apps
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(routing.router, prefix=settings.API_V1_STR)
app.include_router(ml_prediction.router, prefix=settings.API_V1_STR)
app.include_router(ml_prediction.router) # Root fallback for /predict-route-hazards
app.include_router(incidents.router, prefix=settings.API_V1_STR)
app.include_router(vehicles.router, prefix=settings.API_V1_STR)
app.include_router(districts.router, prefix=settings.API_V1_STR)
app.include_router(weather.router, prefix=settings.API_V1_STR)
app.include_router(gdi.router, prefix=settings.API_V1_STR)
app.include_router(satellite.router, prefix=settings.API_V1_STR)
app.include_router(corridors.router, prefix=settings.API_V1_STR)
app.include_router(what_if.router, prefix=settings.API_V1_STR)
app.include_router(what_if.router, prefix="/api") # Root /api/what-if support
app.include_router(emergencies.router, prefix=settings.API_V1_STR)
app.include_router(emergencies.router, prefix="/api") # Root /api/emergencies support
app.include_router(ws.router)

# Mount static media uploads directory
os.makedirs(incidents.MEDIA_UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=incidents.MEDIA_UPLOAD_DIR), name="uploads")



@app.get("/health")
def health():
    return {"status": "ok", "service": "LOGAINER Unified Backend", "version": "2.1.0"}

@app.get("/")
def root():
    return {
        "platform": "LOGAINER - NER Logistics & Accessibility Intelligence",
        "region": "North Eastern Region (NER, India)",
        "version": "2.1.0",
        "states_covered": ["Assam", "Arunachal Pradesh", "Meghalaya", "Manipur", "Mizoram", "Nagaland", "Tripura", "Sikkim"],
        "status": "OPERATIONAL",
        "api_docs": "/docs",
        "ai_suite": ml_model.get_stats()
    }

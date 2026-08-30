# LOGAINER
### AI-Based Smart Logistics & Accessibility Intelligence Platform for North Eastern Region (NER)

![LOGAINER Banner](https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80)

---

## 🏔️ Background & Problem Context
The **North Eastern Region (NER)** of India (Assam, Arunachal Pradesh, Meghalaya, Manipur, Mizoram, Nagaland, Tripura, Sikkim) faces extreme logistics and accessibility barriers caused by treacherous terrain, high-intensity monsoon rains, cloudbursts, severe landslides, and flash floods. Essential goods such as life-saving medicines, vaccines, cryogenic medical oxygen, food rations (PDS/FCI), and petroleum fuels frequently face road disruptions along critical mountain corridors (e.g., NH-6 Meghalaya-Silchar, NH-29 Kohima-Dimapur, NH-10 Sikkim-Siliguri, and Sela Pass in Arunachal Pradesh).

**LOGAINER** is an integrated, full-stack, AI-powered logistics visibility and terrain accessibility intelligence platform built specifically for the geographical and operational realities of the North Eastern Region.

---

## 🛠️ Complete Technology Stack

| Layer | Technology |
|---|---|
| **Web Application** | React 18 + TypeScript + Vite |
| **UI / Design System** | Tailwind CSS (Dark/Light glassmorphism, responsive) |
| **GIS Mapping** | Leaflet + OpenStreetMap + Topographical/Hazard layers |
| **Data Processing** | Pandas + NumPy + GeoPandas |
| **Authentication** | JWT + bcrypt (GovTech Role-Based Access Control) |
| **Route Calculation** | OSRM + Multi-Modal Road Graph |
| **Route Optimization** | Python + A* Pathfinding (Terrain & Landslide Hazard Cost Matrix) |
| **AI / Machine Learning** | ConvLSTM Spatiotemporal Neural Network (Keras / 16-Channel 16x16 Grid) |
| **Backend API Server** | Python + FastAPI |
| **Database** | PostgreSQL + PostGIS & SQLite / IndexedDB Offline-First Fallbacks |
| **GPS Tracking & Telemetry** | Geolocation API + WebSockets |
| **Weather & Radar** | Weather API (OpenWeatherMap + NER Station Grid) |
| **Multilingual Voice System** | Web Speech API (Assamese, Hindi, Bengali, Manipuri, Mizo, Bodo, Khasi, English) |
| **Offline-First Resilience** | IndexedDB / LocalStorage Queue with Auto-Reconnection Sync |

---

## 🚀 Key Modules & Capabilities

1. **Interactive GIS Command & Hazard Center (`GISMap.tsx`)**
   - Live Leaflet map focused on 8 NER States with toggles for Topography, Active Fleets, Landslide Vulnerability Belts, Flood Plains, Weather Radar, and Chokepoint Alerts.
   - Interactive vehicle & chokepoint telemetry drawers.

2. **AI Multi-Modal Route & Disruption Optimizer (`RouteOptimizer.tsx`)**
   - Python **A* Pathfinding Algorithm** + **ConvLSTM Spatiotemporal Risk Scoring**:
     $$Cost(e) = Distance \times (1 + \alpha \cdot ConvLSTMRisk + \beta \cdot ElevationGradient) + DelayPenalty$$
   - Generates & ranks multiple candidate routes:
     - **Route A (Direct Trunk Highway)**
     - **Route B (AI Risk-Mitigated Bypass)**
     - **Route C (Secondary Mountain Ridge Bypass)**
   - Displays road/bridge status, distance, ETA, risk score, and recommendation badges.

3. **ConvLSTM Spatiotemporal Risk Prediction Console (`MLRiskPredictor.tsx`)**
   - Real-time spatiotemporal inference analyzing 16 input feature channels across a rolling 6-frame sequence buffer and 16×16 spatial grid.
   - Outputs: Disruption Probability (%), Risk Classification (`LOW`/`MEDIUM`/`HIGH`), ROC-AUC (0.741), Brier score, and feedback loop verification.

4. **Live GPS Fleet Tracking & Cold-Chain Telemetry (`FleetTracker.tsx`)**
   - Real-time simulated vehicle movements across actual NER coordinates.
   - Continuous internal temperature sensor monitoring ($2^\circ C - 8^\circ C$ for vaccines, $-182^\circ C$ for cryogenic liquid oxygen).
   - Instant Driver SOS panic triggers.

5. **District Connectivity Index & Supply Reserves (`DistrictHealth.tsx`)**
   - District Connectivity Index (DCI: 0–100) across 8 NER states.
   - Tracks buffer days for Medical Oxygen, Critical Pharma, FCI Grain Stocks, and Diesel Reserves.
   - Automated triggers for Emergency Drone / Airlift dispatches when districts are isolated for >48h.

6. **Field Incident Reporting with Offline-First Queue (`IncidentReportModal.tsx`)**
   - Geo-tagged incident reporting with GPS auto-detection, photo attachments, obstacle categorization, and passability status.
   - **Offline-First Sync**: Reports created in zero-network hill areas are cached locally and automatically synced with FastAPI once satellite/cellular connectivity is re-established.

7. **Disaster Emergency Monsoon Red Alert Mode (`DisasterModeCenter.tsx`)**
   - Simulates extreme cloudburst/cyclone events across NER corridors.
   - Automated bulk rerouting of all active medical trucks to Green Corridors.
   - Prepares heavy-lift drone payload missions for cut-off hamlets.

8. **Multilingual Voice Broadcast Engine (`VoiceBroadcastModal.tsx`)**
   - Audio broadcast synthesizer supporting **English, Hindi, Assamese (অসমীয়া), Bengali (বাংলা), Manipuri (মৈতৈলোন্), Mizo, Bodo, Khasi**.

---

## 💻 Running the Application Locally

### 1. Backend Server (FastAPI + AI/ML)
```bash
# Navigate to project root
cd logainer

# Activate Python virtual environment & start server
./backend/venv/bin/python backend/run_server.py
```
FastAPI server will be live at `http://127.0.0.1:8000` (API Docs at `http://127.0.0.1:8000/docs`).

### 2. Frontend Application (React + Vite + Tailwind)
```bash
# Start Vite development server
npm run dev
```
Frontend will be accessible at `http://127.0.0.1:5174` (or `http://127.0.0.1:5173`).

---

## 👥 Demo GovTech User Credentials
- **State Logistics Director (MDoNER)**: `officer@logainer.gov.in` / `admin123`
- **Chief Engineer (Border Roads Organisation)**: `bro.commander@gov.in` / `bro123`
- **Emergency Response Officer (NDRF)**: `ndrf.commander@gov.in` / `ndrf123`
- **Fleet Driver / Ground Operator**: `driver@nerlogistics.in` / `driver123`

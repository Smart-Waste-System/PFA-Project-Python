<div align="center">

# 🗑️ SmartWaste AI

**An intelligent, IoT-driven urban waste management system — with algorithmic route optimization.**

![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat&logo=python)
![Django](https://img.shields.io/badge/Django-4.2-092E20?style=flat&logo=django)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)
![OR-Tools](https://img.shields.io/badge/OR--Tools-VRP-4285F4?style=flat&logo=google)

</div>

---

## ✨ Features

- **🗺️ Live Map Dashboard** — Interactive Mapbox map showing all containers color-coded in real time: 🟢 Green (0–50%), 🟠 Orange (51–79%), 🔴 Red (80–100% — critical).
- **📡 IoT Simulator** — A Python script simulates HC-SR04 ultrasonic sensors, publishing fill-level telemetry via the **MQTT** protocol at regular intervals.
- **🧠 VRP Route Optimizer** — When containers hit the 80% threshold, Google **OR-Tools** computes the mathematically shortest collection route across all critical bins.
- **📐 Dijkstra Distance Matrix** — Inter-container distances are computed via a Dijkstra graph algorithm before being fed into the VRP solver.
- **👷 Driver Interface** — Drivers receive their ordered collection route and validate each bin pickup from a mobile-friendly UI.
- **⚠️ Anomaly Reporting** — Drivers can report vehicle breakdowns or blocked containers, instantly updating the asset's `physical_status` to `BROKEN` in the database.
- **🔔 Real-Time Alerts** — WebSocket notifications push overflow alerts (>90%) to the admin dashboard the moment a sensor fires.
- **👤 Role-Based Access** — Centralized JWT authentication with typed roles: `ADMIN` and `DRIVER`, securing all API routes.
- **🚛 Fleet & Park Management** — Full CRUD for containers, trucks, and drivers with GPS coordinate validation.
- **📊 Mission Traceability** — Every route is a persistent entity linked to a unique `{Driver, Truck}` pair with statuses: `PLANNED → IN_PROGRESS → COMPLETED`.

---

## 🚀 Getting Started

### Prerequisites
- [Python](https://www.python.org/) (v3.11 or higher)
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Docker](https://www.docker.com/) & Docker Compose
- [PostgreSQL](https://www.postgresql.org/) (handled via Docker)

### Option 1: Docker (Recommended)
The entire stack — Django, PostgreSQL, React, and the MQTT broker — runs in isolated containers.

```bash
git clone https://github.com/AyoubBentahir/SmartWaste-AI
cd SmartWaste-AI
docker-compose up --build
```

Open [http://localhost:3000](http://localhost:3000) for the frontend and [http://localhost:8000/api](http://localhost:8000/api) for the API.

### Option 2: Manual Setup (For Developers)

#### 1. Clone the repository
```bash
git clone https://github.com/AyoubBentahir/SmartWaste-AI
cd SmartWaste-AI
```

#### 2. Backend setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### 3. Configure environment variables
Create a `.env` file in `backend/`:
```env
SECRET_KEY="your_django_secret_key"
DATABASE_URL="postgresql://user:password@localhost:5432/smartwaste"
MQTT_BROKER_HOST="localhost"
MQTT_BROKER_PORT=1883
```

> ⚠️ **Never commit this file to GitHub.** It is already listed in `.gitignore`.

#### 4. Apply migrations
```bash
python manage.py makemigrations
python manage.py migrate
```

#### 5. Run the backend
```bash
python manage.py runserver
```

#### 6. Frontend setup
```bash
cd ../frontend
npm install
npm run dev
```

#### 7. Start the IoT simulator
```bash
cd ../simulator
python iot_simulator.py
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend Framework | Django 4.2 + Django REST Framework |
| Route Optimization | Google OR-Tools (VRP Solver) |
| Graph Algorithm | Dijkstra (distance matrix) |
| IoT Protocol | MQTT (Mosquitto broker) |
| IoT Simulation | Python + `paho-mqtt` |
| Async Tasks | Celery + Redis |
| Frontend | React 18 + Tailwind CSS |
| Map | Mapbox GL JS |
| Database | PostgreSQL + Django ORM |
| Real-Time | WebSockets |
| Containerization | Docker + Docker Compose |
| Auth | JWT (Token-based, role-typed) |

---

## 📁 Project Structure

├── backend/
│   ├── core_app/          # Containers, Trucks, Users, Routes — models & API
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   ├── routing_app/       # VRP solver, Dijkstra, OR-Tools integration
│   │   ├── solver.py
│   │   └── views.py
│   ├── mqtt_listener/     # MQTT subscriber & telemetry handler
│   └── manage.py
├── frontend/
│   ├── components/        # Dashboard, Map, DriverView, Fleet panels
│   ├── hooks/             # Custom React hooks
│   ├── services/          # Axios API service layer
│   └── App.tsx
├── simulator/
│   └── iot_simulator.py   # Simulates ultrasonic sensors over MQTT
├── docker-compose.yml
└── README.md

---

## 🔁 How It Works

[IoT Simulator] --MQTT--> [Django Backend] --ORM--> [PostgreSQL]
|
detects fill ≥ 80%
|
[OR-Tools VRP Solver]
|
computes optimal route
|
[React Dashboard] <--WebSocket-- alert  

1. The **IoT simulator** publishes fill-level data every N seconds via MQTT.
2. The **Django backend** listens, updates each container's `fill_level`, and flags it `CRITICAL` when ≥ 80%.
3. The **Admin** clicks "Optimize Routes" — Django calls OR-Tools, which returns the shortest ordered tour.
4. The route is saved as a `Route` + `CollectionPoint` chain and assigned to a `{Driver, Truck}` pair.
5. The **Driver** sees their ordered stops, validates each pickup, and can report anomalies on the go.

---

## 🔒 Privacy & Security

All API routes are protected via **JWT authentication**. Role guards (`ADMIN` / `DRIVER`) restrict access at the view level. No external cloud service is required — the VRP solver runs entirely **locally in Python**.

---

## 📄 License

This project is open source, developed as a Final Year Project (PFA) at **EMSI — École Marocaine des Sciences de l'Ingénieur**. Feel free to fork, study, and build upon it for educational purposes.

---

<div align="center">

Made with ❤️ by **Ayoub Bentahir** & **Aymane Belaizi** — supervised by **Mme. A. KASSID**

</div>

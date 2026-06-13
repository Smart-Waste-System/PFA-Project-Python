<div align="center">

# ♻️ Smart Waste System

**A smart, IoT-powered urban waste management system — optimizing routes and resources in real-time.**

![Django](https://img.shields.io/badge/Django-092E20?style=flat&logo=django&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)
![Python](https://img.shields.io/badge/Python-3670A0?style=flat&logo=python&logoColor=ffdd54)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)

*Projet de Fin d'Année (PFA) - EMSI 3iir*  
*Réalisé par : Ayoub Bentahir & Aymane Belaizi | Encadré par : M. GAMAL*

</div>

---

## ✨ Features

- **📊 Real-time Dashboard** — Interactive map interface powered by Mapbox, visualizing container fill levels, truck locations, and dynamic routes.
- **🛣️ Route Optimization (VRP)** — Intelligent Vehicle Routing Problem solver using Google OR-Tools embedded within Django to minimize travel distance and operational costs.
- **🗑️ IoT Simulation** — Realistic MQTT-based sensor simulation generating real-time waste accumulation data across urban collection points.
- **🔐 Secure Access (RBAC)** — Role-Based Access Control via JWT with dedicated interfaces for Super Admins, Admins, and Drivers.
- **📱 Driver Interface** — Dedicated mobile-responsive views for drivers to follow optimal routes and validate collections.
- **🐳 Dockerized Infrastructure** — Fully containerized deployment including PostgreSQL, Mosquitto MQTT broker, Django backend, and React frontend.

---

## 🏗️ Architecture

```text
/
├── backend/          Django (REST Framework + OR-Tools + JWT Auth + MQTT)
├── frontend/         React + Vite + Mapbox + Tailwind CSS (Dashboard)
├── iot_simulator.py  Python (MQTT Sensor Simulator)
├── mosquitto/        Mosquitto MQTT Broker Configuration
└── docker-compose.yml
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Python](https://www.python.org/) (3.10+)
- [Docker](https://www.docker.com/) & Docker Compose
- A free **Mapbox GL JS** token

### 1. Launch Docker Infrastructure
Start the database and MQTT broker:
```bash
docker-compose up -d
```

### 2. Django Backend
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate | Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python insert_users.py  # Seed initial data
python manage.py runserver
# Running on http://localhost:8000
```

### 3. IoT Simulator
In a new terminal window:
```bash
# Ensure you are in the project root and your virtual environment is active
python iot_simulator.py
```

### 4. React Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env and add your Mapbox GL JS token
npm run dev
# Running on http://localhost:5173
```

---

## 🔑 Demo Accounts
*(Automatically seeded via `insert_users.py`)*

| Role | Email | Password |
|------|-------|----------|
| **Super Admin** | `super@smartwaste.ma` | `super123` |
| **Admin** | `admin@smartwaste.ma` | `admin123` |
| **Driver 1** | `driver@smartwaste.ma` | `driver123` |
| **Driver 2** | `driver2@smartwaste.ma` | `driver123` |

---

## 🕹️ Demo Workflow

1. Start the **IoT Simulator** → Watch the bins fill up automatically in real-time.
2. Log in as an **Admin** → Monitor the dynamic map as containers turn red (critical fill level).
3. Click **"Optimiser la Tournée"** → The OR-Tools engine calculates the most optimal path in < 5 seconds.
4. **Assign** the optimized route to a truck in the Logistics Center.
5. Log in as a **Driver** → View the assigned itinerary and sequentially validate collections.

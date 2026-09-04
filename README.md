# DrivePulse

**DrivePulse** is a full-stack connected-vehicle intelligence platform that simulates vehicle telemetry, processes it through an event-driven backend, detects abnormal operating conditions, evaluates vehicle health, and turns telemetry into maintenance information in real time.

The project is designed as a software-engineering portfolio system rather than a simple CRUD application. It combines IoT-style messaging, real-time communication, telemetry analytics, fault simulation, background monitoring, system health checks, and a modern web interface.

> **Project status:** Core platform, Simulation Lab, real-time telemetry, alerting, health scoring, trend analysis, maintenance workflows, watchdog monitoring, and resilient local demo startup are implemented.

---

## What DrivePulse Demonstrates

- Connected-vehicle telemetry
- MQTT messaging
- Event-driven backend processing
- PostgreSQL persistence
- Real-time Socket.IO updates
- Vehicle health analysis
- Statistical telemetry trend analysis
- Automated fault detection
- Maintenance recommendations
- Background watchdog services
- Multi-vehicle simulation
- System health monitoring
- Automatic local service recovery
- Full-stack TypeScript development
- Python service integration
- Docker-based infrastructure

---

## Platform Overview

A Python Simulation Service generates vehicle telemetry and publishes it through an MQTT broker.

The backend then:

1. Receives MQTT telemetry
2. Validates incoming readings
3. Stores telemetry in PostgreSQL
4. Updates vehicle state
5. Evaluates alert conditions
6. Calculates vehicle health
7. Analyses telemetry trends
8. Detects stale or missing telemetry
9. Generates maintenance recommendations for supported faults
10. Pushes live events to the frontend through Socket.IO

The React frontend provides operational views for fleet monitoring, vehicle analytics, alerts, vehicle health, maintenance, simulation control, and platform health.

---

# Core Features

## Real-Time Vehicle Telemetry

DrivePulse processes:

- Vehicle speed
- RPM
- Temperature
- Battery voltage
- Battery percentage
- Current draw
- Vibration
- GPS coordinates

Telemetry is transmitted through MQTT and persisted in PostgreSQL.

```text
Vehicle Simulator
       |
       | MQTT
       v
Mosquitto Broker
       |
       v
DrivePulse API
       |
       +------> PostgreSQL
       +------> Alert Engine
       +------> Health Analysis
       +------> Socket.IO
                    |
                    v
              React Dashboard
```

## Fleet Overview

The Fleet Overview provides:

- Registered vehicle count
- Online vehicles
- Vehicles with warnings
- Offline vehicles
- Active alerts
- Current vehicle states
- Quick access to vehicle analytics
- Vehicle registration

Newly registered vehicles remain offline until telemetry is received.

## Vehicle Analytics

Vehicle analytics include:

- Current telemetry
- Historical telemetry
- Telemetry charts
- Vehicle information
- Active alerts
- Health score
- Health condition
- Health-factor breakdown
- Trend analysis
- Recent telemetry behaviour

The frontend uses route-based lazy loading so larger analytics and charting code loads only when required.

---

# Simulation Lab

DrivePulse includes a browser-controlled **Simulation Lab**.

Supported scenarios:

| Scenario | Purpose |
| --- | --- |
| Normal | Generates normal operating telemetry |
| High Temperature | Produces critical engine-temperature readings |
| Low Battery | Produces low battery percentage and voltage |
| Excessive Vibration | Produces abnormal vibration telemetry |
| Stop Telemetry | Stops a vehicle from transmitting |
| Restore Normal | Returns the vehicle to normal simulated operation |

The simulator maintains simulation state independently for each vehicle.

```text
Simulation Lab
      |
      v
DrivePulse API
      |
      v
Python Simulation Service
      |
      v
Mosquitto MQTT
      |
      v
Telemetry Processing
      |
      +----> Alerts
      +----> Health
      +----> Maintenance
      +----> Live Dashboard
```

---

# Automated Alert Engine

Current alert types include:

| Alert | Current trigger |
| --- | --- |
| High temperature | Temperature >= 95 C |
| Low battery voltage | Battery voltage <= 11.8 V |
| Low battery percentage | Battery percentage <= 20% |
| Excessive vibration | Vibration >= 0.8 |
| Telemetry missing | No recent vehicle telemetry |

Severity levels:

- `INFO`
- `WARNING`
- `CRITICAL`

Alert states:

```text
ACTIVE
   |
   +----> ACKNOWLEDGED
   |
   +----> RESOLVED
```

Alerts store vehicle, type, severity, status, message, trigger time, last observed time, acknowledgement time, and resolution time.

---

# Vehicle Health Scoring

DrivePulse calculates a health score from `0` to `100`.

The current model considers:

- Temperature
- Vibration
- Battery voltage
- Battery percentage
- Active alerts
- Telemetry freshness
- Recent telemetry trends

| Score | Condition |
| ---: | --- |
| 90-100 | Excellent |
| 75-89 | Good |
| 60-74 | Fair |
| Below 60 | Poor |

> The current health system is a **heuristic and statistical risk model**, not a trained machine-learning model.

---

# Telemetry Trend Analysis

DrivePulse analyses a recent telemetry window rather than only the latest reading.

Linear regression is used to estimate changing behaviour for:

- Temperature
- Vibration
- Battery voltage

This helps distinguish a single unusual reading from a sustained worsening condition.

---

# Predictive Maintenance Workflow

Supported conditions can create maintenance recommendations.

| Condition | Recommendation |
| --- | --- |
| High temperature | Inspect cooling system |
| Low battery | Inspect battery system |
| Excessive vibration | Inspect vibration-related components |

Workflow:

```text
OPEN
 |
 v
IN_PROGRESS
 |
 +----> COMPLETED
 |
 +----> DISMISSED
```

Duplicate open recommendations for the same vehicle and category are prevented.

---

# Telemetry Watchdog

If a vehicle stops reporting for roughly 30 seconds:

```text
Telemetry stops
      |
      v
Watchdog detects stale telemetry
      |
      v
TELEMETRY_MISSING alert
      |
      v
Vehicle becomes OFFLINE
```

When telemetry resumes, the missing-telemetry condition can resolve and the vehicle returns to the appropriate operational state.

---

# Live System Health

The DrivePulse sidebar contains a real platform-health indicator.

It can display:

```text
Checking
Operational
Recovering
Degraded
```

The indicator is based on real backend health rather than a hard-coded label.

---

# Resilient Demo Mode

Start the full supervised platform with:

```powershell
npm run demo
```

The demo launcher:

1. Checks Docker
2. Starts Docker Desktop when required
3. Starts PostgreSQL and Mosquitto
4. Waits for PostgreSQL health
5. Waits for MQTT
6. Starts the API
7. Verifies API health
8. Verifies database connectivity
9. Starts the Python Simulation Service
10. Verifies simulator health
11. Starts the React frontend
12. Waits for the frontend
13. Opens DrivePulse in the browser
14. Continues monitoring services

If the API becomes unavailable, the supervisor can automatically restart it and verify recovery.

Demo logs are written to:

```text
.demo-logs/
```

---

# System Architecture

```mermaid
flowchart LR
    WEB[React Web Interface]
    API[Node.js / Express API]
    DB[(PostgreSQL)]
    MQTT[Eclipse Mosquitto]
    SIM[Python Simulation Service]
    ALERT[Alert Engine]
    HEALTH[Health and Trend Analysis]
    WATCHDOG[Telemetry Watchdog]
    MAINT[Maintenance Engine]
    SOCKET[Socket.IO]

    WEB --> API
    WEB -->|Simulation commands| API
    API --> SIM
    SIM -->|Telemetry| MQTT
    MQTT --> API
    API --> DB
    DB --> API
    API --> ALERT
    API --> HEALTH
    WATCHDOG --> DB
    WATCHDOG --> ALERT
    ALERT --> MAINT
    API --> SOCKET
    ALERT --> SOCKET
    MAINT --> SOCKET
    SOCKET --> WEB
```

---

# Technology Stack

## Frontend
- React
- TypeScript
- Vite
- React Router
- Socket.IO Client
- Recharts
- Responsive CSS

## Backend
- Node.js
- TypeScript
- Express
- Socket.IO
- MQTT
- Zod
- Prisma ORM

## Data
- PostgreSQL
- Prisma ORM

## Infrastructure
- Docker
- Docker Compose
- Eclipse Mosquitto

## Simulation
- Python
- `paho-mqtt`
- Multi-vehicle simulation manager
- HTTP simulation-control service

## Testing and Quality
- Vitest
- TypeScript type checking
- Oxlint
- Vite production builds

---

# Project Structure

```text
DrivePulse/
|
+-- apps/
|   +-- api/
|   +-- web/
|   +-- simulator/
|       +-- service.py
|       +-- simulator.py
|       +-- high_temperature_test.py
|
+-- packages/
|   +-- shared-types/
|
+-- scripts/
|   +-- demo.ps1
|
+-- docs/
+-- docker-compose.yml
+-- package.json
+-- package-lock.json
+-- README.md
```

---

# Local Setup

## Prerequisites

- Node.js
- npm
- Docker Desktop
- Python
- Git

## 1. Clone

```powershell
git clone https://github.com/Codes051/DrivePulse.git
cd DrivePulse
```

## 2. Install Node dependencies

```powershell
npm ci
```

## 3. Install simulator dependencies

```powershell
cd apps\simulator
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..\..
```

## 4. Configure the API

Example:

```text
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://drivepulse:drivepulse_dev_password@127.0.0.1:5433/drivepulse?schema=public
MQTT_URL=mqtt://127.0.0.1:1883
```

Environment files should not be committed.

## 5. Generate Prisma

```powershell
cd apps\api
npx --no-install prisma generate
cd ..\..
```

## 6. Start DrivePulse

```powershell
npm run demo
```

Service endpoints:

```text
Frontend            http://localhost:5173
API                 http://localhost:3000
API Health          http://localhost:3000/health
Simulation Service  http://127.0.0.1:3010
Simulator Health    http://127.0.0.1:3010/health
MQTT                127.0.0.1:1883
PostgreSQL          127.0.0.1:5433
```

---

# Development Mode

```powershell
npm run dev:api
npm run dev:web
npm run dev
```

For a complete demonstration, prefer:

```powershell
npm run demo
```

---

# Suggested Portfolio Demo

1. Open Fleet Overview
2. Open Simulation Lab
3. Start normal telemetry
4. Watch the vehicle become online
5. Open Analytics
6. Trigger high temperature
7. Observe the critical alert
8. Watch the health score change
9. Open Maintenance
10. Restore normal operation

A second reliability demonstration can show the API being terminated and automatically restarted by the demo supervisor.

---

# API Overview

Major API areas:

```text
/api/vehicles
/api/telemetry
/api/alerts
/api/maintenance
/api/health
/api/simulation
```

---

# Real-Time Events

```text
telemetry:updated

alert:created
alert:updated
alert:resolved

maintenance:created
maintenance:updated
```

---

# Automated Testing

The backend includes automated tests for alert handling, health scoring, telemetry watchdog behaviour, maintenance recommendations, duplicate prevention, and recovery workflows.

Run:

```powershell
npm test
```

---

# Useful Commands

```powershell
npm run demo
npm run dev
npm run dev:api
npm run dev:web
npm test
npm run typecheck --workspace=@drivepulse/api
npm run lint --workspace=@drivepulse/web
npm run build --workspace=@drivepulse/web
docker compose ps
```

---

# Screenshots

Recommended screenshots:

1. Fleet Overview
2. Vehicle Analytics
3. Simulation Lab
4. Live Telemetry
5. Active Alerts
6. Vehicle Health
7. Maintenance Recommendations

Suggested folder:

```text
docs/
  screenshots/
```

---

# Current Limitations

DrivePulse is currently a local portfolio and engineering demonstration platform.

Areas for production hardening include:

- Authentication
- Role-based access control
- Cloud deployment
- Centralised logging
- Production observability
- Configurable alert thresholds
- Historical maintenance records
- Notification services
- CI/CD
- Containerisation of application services
- Production secrets management
- Larger-scale telemetry aggregation

The current health score is heuristic/statistical rather than machine-learning based.

---

# Future Improvements

Potential additions include:

- Authentication and RBAC
- Cloud deployment
- CI/CD
- Configurable alert rules
- More simulation scenarios
- Additional vehicle sensors
- Notification delivery
- Historical maintenance reporting
- Fleet-level trend analytics
- Containerised API and frontend
- Centralised application monitoring
- Machine-learning-based failure prediction

---

# Portfolio Purpose

DrivePulse was created as a software-engineering portfolio project focused on connected vehicles, distributed systems, backend engineering, real-time communication, analytics, and full-stack development.

The goal is to demonstrate an integrated system rather than an isolated frontend or API.

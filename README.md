# DrivePulse

DrivePulse is a full-stack connected-vehicle telemetry and maintenance platform that simulates how vehicle data can be collected, monitored, analysed, and turned into actionable maintenance information in real time.

The project combines MQTT telemetry ingestion, live dashboards, automated alerts, vehicle health scoring, telemetry trend analysis, and a maintenance workflow in one system.

> **Status:** Core telemetry, analytics, alerting, health scoring, watchdog monitoring, and maintenance workflows are implemented.

---

## Overview

A Python vehicle simulator publishes telemetry through MQTT.

The backend:

1. Receives telemetry from MQTT
2. Validates and stores it in PostgreSQL
3. Evaluates alert conditions
4. Calculates vehicle health
5. Analyses recent telemetry trends
6. Detects missing telemetry
7. Creates maintenance recommendations
8. Pushes live updates to the frontend through Socket.IO

The React frontend provides fleet, vehicle analytics, alerts, health, trend, and maintenance views.

---

## Key Features

### Real-Time Vehicle Telemetry

DrivePulse processes simulated telemetry including:

- Vehicle speed
- RPM
- Temperature
- Battery voltage
- Battery percentage
- Current draw
- Vibration
- GPS coordinates

Telemetry is published through MQTT and persisted in PostgreSQL.

### Live Fleet Dashboard

The dashboard displays vehicle state and operational information in real time.

Vehicle states include:

- `ONLINE`
- `WARNING`
- `OFFLINE`
- `MAINTENANCE`

Socket.IO is used so dashboard data can update without a page refresh.

### Vehicle Analytics

Each vehicle has a detailed analytics view containing:

- Current telemetry
- Historical telemetry charts
- Vehicle information
- Active alerts
- Health score
- Health condition
- Health-factor breakdown
- Recent telemetry trends

The frontend uses route-based lazy loading so larger analytics/charting code is loaded only when needed.

### Automated Alert Engine

Incoming telemetry is checked against operational thresholds.

| Alert | Example condition |
| --- | --- |
| High temperature | Temperature exceeds the configured safe threshold |
| Low battery voltage | Battery voltage falls below threshold |
| Low battery percentage | Battery charge becomes low |
| Excessive vibration | Abnormal vibration is detected |
| Telemetry missing | Vehicle stops reporting telemetry |

Alerts include:

- Severity
- Status
- Trigger time
- Last observed time
- Acknowledgement time
- Resolution time

Alert lifecycle:

```text
ACTIVE
  |
  +--> ACKNOWLEDGED
  |
  +--> RESOLVED
```

---

## Vehicle Health Scoring

DrivePulse calculates a vehicle health score from `0` to `100`.

The score currently considers:

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

The current health system is a **heuristic and statistical risk model**, not a trained machine-learning model.

---

## Telemetry Trend Analysis

The backend analyses a recent telemetry window instead of looking only at the latest reading.

Linear regression is used to calculate rates of change for:

- Temperature
- Vibration
- Battery voltage

This helps distinguish between a one-off unusual reading and a sustained worsening trend.

Example:

```text
Temperature rises over time
        |
        v
Sustained upward trend
        |
        v
Higher trend risk
```

---

## Predictive Maintenance Workflow

New alerts can automatically create maintenance recommendations.

| Vehicle condition | Recommendation |
| --- | --- |
| High temperature | Inspect cooling system |
| Low battery | Inspect battery system |
| Excessive vibration | Inspect abnormal vibration |
| Missing telemetry | Inspect telemetry system |

Recommendations include:

- Vehicle
- Maintenance category
- Priority
- Description
- Reason
- Creation time
- Completion time
- Status

Workflow:

```text
OPEN
  |
  v
IN_PROGRESS
  |
  +--> COMPLETED
  |
  +--> DISMISSED
```

The Maintenance page also receives live Socket.IO updates.

Duplicate open recommendations for the same vehicle and maintenance category are prevented.

---

## Telemetry Watchdog

DrivePulse includes a background watchdog that checks whether vehicles are still reporting telemetry.

If telemetry becomes stale for roughly 30 seconds:

```text
Telemetry stops
      |
      v
Watchdog detects stale vehicle
      |
      v
TELEMETRY_MISSING alert
      |
      v
Vehicle status = OFFLINE
```

When telemetry resumes, the missing-telemetry alert is resolved and the vehicle returns to the appropriate state.

---

## System Architecture

```mermaid
flowchart LR
    SIM[Python Vehicle Simulator]
    MQTT[Mosquitto MQTT Broker]
    API[Node.js / Express API]
    DB[(PostgreSQL)]
    ALERT[Alert Engine]
    HEALTH[Health & Trend Analysis]
    WATCHDOG[Telemetry Watchdog]
    MAINT[Maintenance Engine]
    SOCKET[Socket.IO]
    WEB[React Dashboard]

    SIM --> MQTT
    MQTT --> API
    API --> DB
    API --> ALERT
    API --> HEALTH
    WATCHDOG --> DB
    WATCHDOG --> ALERT
    ALERT --> MAINT
    API --> SOCKET
    ALERT --> SOCKET
    MAINT --> SOCKET
    SOCKET --> WEB
    DB --> API
    API --> WEB
```

---

## Technology Stack

### Frontend
- React
- TypeScript
- Vite
- React Router
- Socket.IO Client
- Responsive CSS
- Chart-based telemetry visualisation

### Backend
- Node.js
- TypeScript
- Express
- Socket.IO
- MQTT
- Zod
- Prisma ORM

### Data
- PostgreSQL
- Prisma ORM

### Infrastructure
- Docker
- Docker Compose
- Eclipse Mosquitto

### Simulation
- Python
- MQTT-based simulated telemetry

### Testing and Quality
- Vitest
- TypeScript type checking
- Oxlint
- Production Vite builds

---

## Project Structure

```text
DrivePulse/
|
+-- apps/
|   +-- api/
|   |   +-- prisma/
|   |   +-- src/
|   |       +-- controllers/
|   |       +-- generated/
|   |       +-- lib/
|   |       +-- realtime/
|   |       +-- routes/
|   |       +-- schemas/
|   |       +-- services/
|   |
|   +-- web/
|   |   +-- src/
|   |       +-- pages/
|   |       +-- App.tsx
|   |       +-- socket.ts
|   |
|   +-- simulator/
|       +-- simulator.py
|       +-- high_temperature_test.py
|
+-- packages/
|   +-- shared-types/
|
+-- docs/
+-- docker-compose.yml
+-- package.json
+-- package-lock.json
+-- README.md
```

---

## Local Development

### Prerequisites

- Node.js
- npm
- Docker Desktop
- Python
- Git

### 1. Install dependencies

```powershell
npm ci
```

### 2. Start infrastructure

Make sure Docker Desktop is running, then:

```powershell
docker compose up -d
docker compose ps
```

DrivePulse uses Docker Compose for PostgreSQL and Mosquitto.

### 3. Configure the API

Example local environment:

```text
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://drivepulse:drivepulse_dev_password@127.0.0.1:5433/drivepulse?schema=public
MQTT_URL=mqtt://127.0.0.1:1883
```

Environment files should not be committed to Git.

### 4. Generate the Prisma client

```powershell
cd apps/api
npx --no-install prisma generate
cd ../..
```

### 5. Start DrivePulse

```powershell
npm run dev
```

This starts:

```text
API      -> http://localhost:3000
Frontend -> http://localhost:5173
```

### 6. Start simulated telemetry

Open a second terminal:

```powershell
npm run simulator
```

The simulator publishes telemetry for the test vehicle `CAR-001`.

---

## Fault Simulation

To simulate a high-temperature fault:

```powershell
npm run fault:temperature
```

This can trigger:

```text
High temperature
       |
       v
Critical alert
       |
       v
Vehicle warning state
       |
       v
Cooling-system maintenance recommendation
```

---

## Useful Commands

```powershell
# Start API and frontend
npm run dev

# Start normal telemetry
npm run simulator

# Simulate high temperature
npm run fault:temperature

# Run backend tests
npm test

# API type check
npm run typecheck --workspace=@drivepulse/api

# Frontend lint
npm run lint --workspace=@drivepulse/web

# Production frontend build
npm run build --workspace=@drivepulse/web
```

---

## Automated Testing

The backend currently includes automated tests for:

### Alert Service
- Creates alerts for abnormal telemetry
- Prevents duplicate active alerts
- Resolves alerts when telemetry returns to normal

### Vehicle Health Service
- Normal vehicle health
- High-temperature penalties
- Critical alert penalties
- Stale telemetry
- Missing telemetry
- Rising-temperature trends
- Normal telemetry variation
- Worsening vibration and battery trends

### Telemetry Watchdog
- Detects stale telemetry
- Prevents duplicate missing-telemetry alerts
- Resolves missing-telemetry alerts
- Preserves warning state when another alert remains active

### Maintenance Service
- Cooling-system recommendations
- Battery-system recommendations
- Vibration recommendations
- Duplicate prevention
- Completion workflow
- Live maintenance updates

Current suite:

```text
Test Files: 4
Tests:      20
```

---

## Frontend Performance

DrivePulse uses route-based lazy loading.

This reduced the main frontend JavaScript bundle from approximately:

```text
653 kB
```

to approximately:

```text
228 kB
```

The larger vehicle analytics and charting code is loaded only when the Vehicle Details route is opened.

---

## API Overview

Major API areas include:

```text
/api/vehicles
/api/telemetry
/api/alerts
/api/maintenance
```

Real-time events include:

```text
telemetry:updated

alert:created
alert:updated
alert:resolved

maintenance:created
maintenance:updated
```

---

## Screenshots

Add screenshots here before using the repository in applications.

Recommended screenshots:

1. Fleet Overview
2. Vehicle Analytics
3. Live Telemetry Charts
4. Alerts
5. Vehicle Health and Trend Analysis
6. Maintenance Recommendations

Example Markdown once images are added to `docs/screenshots/`:

```markdown
![Fleet Overview](docs/screenshots/fleet-overview.png)
```

---

## Engineering Goals

DrivePulse was designed to demonstrate more than a standard CRUD application.

The project explores:

- Event-driven systems
- IoT-style telemetry
- Real-time communication
- MQTT
- WebSockets
- Background monitoring
- Time-series analysis
- Relational database modelling
- API architecture
- Automated testing
- Fault simulation
- System health monitoring
- Predictive-maintenance concepts
- Frontend performance optimisation

---

## Future Improvements

Potential additions include:

- Multiple simulated vehicles
- Authentication and role-based access control
- Cloud deployment
- Historical maintenance records
- Notification services
- More fault simulators
- Configurable alert thresholds
- Additional vehicle sensors
- Improved telemetry aggregation
- CI/CD
- Containerised application deployment
- Machine-learning-based failure prediction

A future ML model could use historical telemetry and maintenance outcomes to estimate component failure probability.

The current statistical trend-analysis system provides a foundation for that work without presenting heuristic analytics as trained machine learning.

---

## Portfolio Purpose

DrivePulse was created as a software engineering portfolio project focused on connected vehicles, backend engineering, real-time systems, data analysis, and full-stack development.

The goal is to demonstrate a complete connected system rather than an isolated frontend or API:

```text
Telemetry
    +
Messaging
    +
Backend Processing
    +
Database
    +
Analytics
    +
Real-Time Communication
    +
Frontend
    +
Testing
    =
DrivePulse
```

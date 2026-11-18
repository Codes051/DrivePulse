#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Starting DrivePulse..."

# Check for existing application processes.
for port in 3000 3010 5173; do
  if ss -ltnH "( sport = :$port )" | grep -q LISTEN; then
    echo "Port $port is already in use."
    echo "Stop the old API, simulator or frontend terminal first."
    exit 1
  fi
done

# Application configuration.
export DATABASE_URL="postgresql://drivepulse:drivepulse_dev_password@127.0.0.1:5433/drivepulse?schema=public"
export MQTT_URL="mqtt://127.0.0.1:1883"
export MQTT_HOST="127.0.0.1"
export MQTT_PORT=1883
export SIMULATION_SERVICE_URL="http://127.0.0.1:3010"
export PORT=3000
export VITE_API_URL=""

# Install dependencies if necessary.
if [ ! -d node_modules ]; then
  npm ci
fi

if [ ! -x apps/simulator/.venv/bin/python ]; then
  python3 -m venv apps/simulator/.venv
  apps/simulator/.venv/bin/python -m pip install -r apps/simulator/requirements.txt
fi

# Start PostgreSQL and MQTT.
docker compose up -d

echo "Checking database health..."
for attempt in {1..30}; do
  if [ "$(docker inspect -f '{{.State.Health.Status}}' drivepulse-postgres)" = "healthy" ]; then
    break
  fi
  sleep 2
done

if [ "$(docker inspect -f '{{.State.Health.Status}}' drivepulse-postgres)" != "healthy" ]; then
  echo "Database is not healthy."
  exit 1
fi

# Prepare the database.
npx prisma generate --schema=apps/api/prisma/schema.prisma
(cd apps/api && npx prisma migrate deploy)

echo "Starting API, simulator and dashboard..."
echo "Dashboard port: 5173"
echo "Press Ctrl+C to stop the application processes."

npx concurrently --kill-others \
  --names "API,SIM,WEB" \
  -c "blue,magenta,green" \
  "npm run dev:api" \
  "apps/simulator/.venv/bin/python -u apps/simulator/service.py" \
  "npm run dev --workspace=@drivepulse/web -- --host 0.0.0.0 --port 5173 --strictPort"

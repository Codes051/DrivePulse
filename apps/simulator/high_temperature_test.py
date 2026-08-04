import json
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt


VEHICLE_CODE = "CAR-001"
TOPIC = f"vehicles/{VEHICLE_CODE}/telemetry"

client = mqtt.Client(
    callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
    client_id="drivepulse-high-temperature-test",
)

client.connect("127.0.0.1", 1883, 60)
client.loop_start()

print("Publishing high-temperature fault telemetry...")

for reading_number in range(1, 6):
    payload = {
        "vehicleCode": VEHICLE_CODE,
        "recordedAt": datetime.now(timezone.utc).isoformat(),
        "speedKmh": 60.0,
        "rpm": 3200,
        "temperatureC": 101.5,
        "batteryVoltage": 13.7,
        "batteryPercentage": 82.0,
        "currentAmps": 24.0,
        "vibration": 0.18,
        "latitude": -25.7479,
        "longitude": 28.2293,
    }

    result = client.publish(
        TOPIC,
        json.dumps(payload),
        qos=1,
    )

    result.wait_for_publish()

    print(
        f"Reading {reading_number}/5 published | "
        f"Temperature: {payload['temperatureC']} C"
    )

    time.sleep(2)

client.loop_stop()
client.disconnect()

print("High-temperature test completed.")

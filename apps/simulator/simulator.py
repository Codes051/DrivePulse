import json
import math
import random
import signal
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone

import paho.mqtt.client as mqtt


MQTT_HOST = "127.0.0.1"
MQTT_PORT = 1883

VEHICLE_CODE = "CAR-001"
PUBLISH_INTERVAL_SECONDS = 2

MQTT_TOPIC = f"vehicles/{VEHICLE_CODE}/telemetry"


@dataclass
class VehicleState:
    vehicleCode: str
    recordedAt: str
    speedKmh: float
    rpm: int
    temperatureC: float
    batteryVoltage: float
    batteryPercentage: float
    currentAmps: float
    vibration: float
    latitude: float
    longitude: float


class VehicleSimulator:
    def __init__(self, vehicle_code: str) -> None:
        self.vehicle_code = vehicle_code

        self.speed_kmh = 0.0
        self.temperature_c = 24.0
        self.battery_voltage = 13.9
        self.battery_percentage = 100.0
        self.vibration = 0.05

        self.latitude = -25.7479
        self.longitude = 28.2293

        self.elapsed_seconds = 0
        self.running = True

    def update(self) -> VehicleState:
        self.elapsed_seconds += PUBLISH_INTERVAL_SECONDS

        target_speed = self._calculate_target_speed()

        acceleration = random.uniform(3.0, 9.0)
        deceleration = random.uniform(4.0, 11.0)

        if self.speed_kmh < target_speed:
            self.speed_kmh = min(
                target_speed,
                self.speed_kmh + acceleration,
            )
        else:
            self.speed_kmh = max(
                target_speed,
                self.speed_kmh - deceleration,
            )

        self.speed_kmh = max(
            0.0,
            self.speed_kmh + random.uniform(-1.5, 1.5),
        )

        rpm = self._calculate_rpm()

        target_temperature = 28.0 + (rpm / 6500.0) * 65.0

        self.temperature_c += (
            target_temperature - self.temperature_c
        ) * 0.08

        self.temperature_c += random.uniform(-0.3, 0.3)

        current_amps = 3.0 + (self.speed_kmh / 140.0) * 42.0
        current_amps += random.uniform(-1.0, 1.0)
        current_amps = max(0.0, current_amps)

        self.battery_percentage -= (
            current_amps * PUBLISH_INTERVAL_SECONDS / 360000.0
        )

        self.battery_percentage = max(
            0.0,
            self.battery_percentage,
        )

        self.battery_voltage = (
            11.8 + (self.battery_percentage / 100.0) * 2.2
        )

        self.battery_voltage += random.uniform(-0.04, 0.04)

        self.vibration = 0.04 + (rpm / 6500.0) * 0.3
        self.vibration += random.uniform(-0.02, 0.02)
        self.vibration = max(0.0, self.vibration)

        distance_km = (
            self.speed_kmh
            * PUBLISH_INTERVAL_SECONDS
            / 3600.0
        )

        self.latitude += distance_km / 111.0
        self.longitude += distance_km / 111.0 * 0.25

        return VehicleState(
            vehicleCode=self.vehicle_code,
            recordedAt=datetime.now(timezone.utc).isoformat(),
            speedKmh=round(self.speed_kmh, 2),
            rpm=rpm,
            temperatureC=round(self.temperature_c, 2),
            batteryVoltage=round(self.battery_voltage, 2),
            batteryPercentage=round(self.battery_percentage, 2),
            currentAmps=round(current_amps, 2),
            vibration=round(self.vibration, 3),
            latitude=round(self.latitude, 6),
            longitude=round(self.longitude, 6),
        )

    def _calculate_target_speed(self) -> float:
        cycle_position = self.elapsed_seconds % 120

        if cycle_position < 15:
            return 0.0

        if cycle_position < 45:
            return 60.0

        if cycle_position < 80:
            return 105.0

        if cycle_position < 105:
            return 45.0

        return 0.0

    def _calculate_rpm(self) -> int:
        if self.speed_kmh < 1.0:
            return random.randint(700, 850)

        base_rpm = 850 + self.speed_kmh * 32
        oscillation = math.sin(self.elapsed_seconds / 4.0) * 180
        noise = random.uniform(-80, 80)

        return int(max(700, min(6500, base_rpm + oscillation + noise)))


def on_connect(
    client: mqtt.Client,
    userdata: object,
    flags: dict,
    reason_code: int,
    properties: object | None = None,
) -> None:
    if reason_code == 0:
        print(
            f"Connected to MQTT broker at "
            f"{MQTT_HOST}:{MQTT_PORT}"
        )
        print(f"Publishing to: {MQTT_TOPIC}")
    else:
        print(f"MQTT connection failed: {reason_code}")


def create_mqtt_client() -> mqtt.Client:
    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id=f"drivepulse-simulator-{VEHICLE_CODE}",
    )

    client.on_connect = on_connect

    client.reconnect_delay_set(
        min_delay=1,
        max_delay=30,
    )

    return client


def main() -> None:
    simulator = VehicleSimulator(VEHICLE_CODE)
    client = create_mqtt_client()

    def stop_simulator(
        signal_number: int,
        frame: object,
    ) -> None:
        print("\nStopping vehicle simulator...")
        simulator.running = False

    signal.signal(signal.SIGINT, stop_simulator)
    signal.signal(signal.SIGTERM, stop_simulator)

    try:
        client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
        client.loop_start()

        print(f"Starting simulation for {VEHICLE_CODE}")

        while simulator.running:
            state = simulator.update()
            payload = json.dumps(asdict(state))

            result = client.publish(
                MQTT_TOPIC,
                payload,
                qos=1,
            )

            if result.rc != mqtt.MQTT_ERR_SUCCESS:
                print(
                    f"Failed to publish MQTT message. "
                    f"Code: {result.rc}"
                )
            else:
                print(
                    f"{state.recordedAt} | "
                    f"Speed: {state.speedKmh:6.2f} km/h | "
                    f"RPM: {state.rpm:4d} | "
                    f"Temp: {state.temperatureC:5.2f} C | "
                    f"Battery: {state.batteryPercentage:6.2f}%"
                )

            time.sleep(PUBLISH_INTERVAL_SECONDS)

    except ConnectionRefusedError:
        print(
            "Could not connect to Mosquitto. "
            "Confirm the Docker MQTT container is running."
        )
        sys.exit(1)

    except OSError as error:
        print(f"MQTT connection error: {error}")
        sys.exit(1)

    finally:
        client.loop_stop()
        client.disconnect()
        print("Simulator stopped.")


if __name__ == "__main__":
    main()

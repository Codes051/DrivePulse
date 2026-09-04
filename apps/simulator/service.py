import json
import math
import random
import signal
import threading
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
from urllib.parse import unquote

import paho.mqtt.client as mqtt


MQTT_HOST = os.getenv("MQTT_HOST", "127.0.0.1")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))

HTTP_HOST = os.getenv("HTTP_HOST", "127.0.0.1")
HTTP_PORT = int(os.getenv("HTTP_PORT", "3010"))

PUBLISH_INTERVAL_SECONDS = 2

VALID_SCENARIOS = {
    "normal",
    "high-temperature",
    "low-battery",
    "vibration",
}


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


class VehicleSimulation:
    def __init__(
        self,
        vehicle_code: str,
        mqtt_client: mqtt.Client,
    ) -> None:
        self.vehicle_code = vehicle_code
        self.mqtt_client = mqtt_client

        self.scenario = "normal"

        self.speed_kmh = 0.0
        self.temperature_c = 24.0
        self.battery_voltage = 13.9
        self.battery_percentage = 100.0
        self.vibration = 0.05

        self.latitude = -25.7479
        self.longitude = 28.2293

        self.elapsed_seconds = 0

        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()

    @property
    def running(self) -> bool:
        return (
            self._thread is not None
            and self._thread.is_alive()
            and not self._stop_event.is_set()
        )

    def start(self) -> None:
        with self._lock:
            if self.running:
                return

            self._stop_event = threading.Event()

            self._thread = threading.Thread(
                target=self._run,
                name=f"simulation-{self.vehicle_code}",
                daemon=True,
            )

            self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()

    def set_scenario(
        self,
        scenario: str,
    ) -> None:
        if scenario not in VALID_SCENARIOS:
            raise ValueError(
                f"Unknown simulation scenario: {scenario}"
            )

        with self._lock:
            self.scenario = scenario

            if scenario == "normal":
                self._restore_normal_baseline()

        self.start()

    def status(self) -> dict:
        return {
            "vehicleCode": self.vehicle_code,
            "running": self.running,
            "scenario": self.scenario,
        }

    def _restore_normal_baseline(self) -> None:
        self.temperature_c = 72.0
        self.battery_percentage = max(
            self.battery_percentage,
            78.0,
        )
        self.battery_voltage = 13.4
        self.vibration = 0.12

    def _run(self) -> None:
        print(
            f"Simulation started for {self.vehicle_code}"
        )

        while not self._stop_event.is_set():
            state = self._update()

            topic = (
                f"vehicles/"
                f"{self.vehicle_code}/telemetry"
            )

            payload = json.dumps(
                asdict(state)
            )

            result = self.mqtt_client.publish(
                topic,
                payload,
                qos=1,
            )

            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(
                    f"{self.vehicle_code} | "
                    f"{self.scenario:<16} | "
                    f"{state.speedKmh:6.1f} km/h | "
                    f"{state.temperatureC:5.1f} C | "
                    f"{state.batteryPercentage:5.1f}% | "
                    f"Vibration {state.vibration:.3f}"
                )
            else:
                print(
                    f"MQTT publish failed for "
                    f"{self.vehicle_code}: "
                    f"{result.rc}"
                )

            self._stop_event.wait(
                PUBLISH_INTERVAL_SECONDS
            )

        print(
            f"Simulation stopped for {self.vehicle_code}"
        )

    def _update(self) -> VehicleState:
        self.elapsed_seconds += (
            PUBLISH_INTERVAL_SECONDS
        )

        target_speed = (
            self._calculate_target_speed()
        )

        if self.speed_kmh < target_speed:
            self.speed_kmh = min(
                target_speed,
                self.speed_kmh
                + random.uniform(3.0, 9.0),
            )
        else:
            self.speed_kmh = max(
                target_speed,
                self.speed_kmh
                - random.uniform(4.0, 11.0),
            )

        self.speed_kmh = max(
            0.0,
            self.speed_kmh
            + random.uniform(-1.5, 1.5),
        )

        rpm = self._calculate_rpm()

        target_temperature = (
            28.0
            + (rpm / 6500.0) * 65.0
        )

        self.temperature_c += (
            target_temperature
            - self.temperature_c
        ) * 0.08

        self.temperature_c += random.uniform(
            -0.3,
            0.3,
        )

        current_amps = (
            3.0
            + (self.speed_kmh / 140.0) * 42.0
            + random.uniform(-1.0, 1.0)
        )

        current_amps = max(
            0.0,
            current_amps,
        )

        self.battery_percentage -= (
            current_amps
            * PUBLISH_INTERVAL_SECONDS
            / 360000.0
        )

        self.battery_percentage = max(
            0.0,
            self.battery_percentage,
        )

        self.battery_voltage = (
            11.8
            + (
                self.battery_percentage
                / 100.0
            )
            * 2.2
        )

        self.battery_voltage += (
            random.uniform(-0.04, 0.04)
        )

        self.vibration = (
            0.04
            + (rpm / 6500.0) * 0.3
            + random.uniform(-0.02, 0.02)
        )

        self.vibration = max(
            0.0,
            self.vibration,
        )

        if self.scenario == "high-temperature":
            self.temperature_c = (
                101.5
                + random.uniform(-0.4, 0.4)
            )

        elif self.scenario == "low-battery":
            self.battery_percentage = (
                12.0
                + random.uniform(-0.4, 0.4)
            )

            self.battery_voltage = (
                11.45
                + random.uniform(-0.05, 0.05)
            )

        elif self.scenario == "vibration":
            self.vibration = (
                1.05
                + random.uniform(-0.05, 0.05)
            )

        distance_km = (
            self.speed_kmh
            * PUBLISH_INTERVAL_SECONDS
            / 3600.0
        )

        self.latitude += (
            distance_km / 111.0
        )

        self.longitude += (
            distance_km
            / 111.0
            * 0.25
        )

        return VehicleState(
            vehicleCode=self.vehicle_code,
            recordedAt=datetime.now(
                timezone.utc
            ).isoformat(),
            speedKmh=round(
                self.speed_kmh,
                2,
            ),
            rpm=rpm,
            temperatureC=round(
                self.temperature_c,
                2,
            ),
            batteryVoltage=round(
                self.battery_voltage,
                2,
            ),
            batteryPercentage=round(
                self.battery_percentage,
                2,
            ),
            currentAmps=round(
                current_amps,
                2,
            ),
            vibration=round(
                self.vibration,
                3,
            ),
            latitude=round(
                self.latitude,
                6,
            ),
            longitude=round(
                self.longitude,
                6,
            ),
        )

    def _calculate_target_speed(
        self,
    ) -> float:
        cycle_position = (
            self.elapsed_seconds % 120
        )

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
            return random.randint(
                700,
                850,
            )

        base_rpm = (
            850
            + self.speed_kmh * 32
        )

        oscillation = (
            math.sin(
                self.elapsed_seconds / 4.0
            )
            * 180
        )

        noise = random.uniform(
            -80,
            80,
        )

        return int(
            max(
                700,
                min(
                    6500,
                    base_rpm
                    + oscillation
                    + noise,
                ),
            )
        )


class SimulationManager:
    def __init__(self) -> None:
        self.simulations: dict[
            str,
            VehicleSimulation,
        ] = {}

        self._lock = threading.Lock()

        self.mqtt_client = mqtt.Client(
            callback_api_version=(
                mqtt.CallbackAPIVersion.VERSION2
            ),
            client_id=(
                "drivepulse-simulation-service"
            ),
        )

        self.mqtt_client.reconnect_delay_set(
            min_delay=1,
            max_delay=30,
        )

    def connect(self) -> None:
        self.mqtt_client.connect(
            MQTT_HOST,
            MQTT_PORT,
            keepalive=60,
        )

        self.mqtt_client.loop_start()

        print(
            f"Simulation service connected "
            f"to MQTT at "
            f"{MQTT_HOST}:{MQTT_PORT}"
        )

    def get_or_create(
        self,
        vehicle_code: str,
    ) -> VehicleSimulation:
        vehicle_code = (
            vehicle_code
            .strip()
            .upper()
        )

        if not vehicle_code:
            raise ValueError(
                "Vehicle code is required."
            )

        with self._lock:
            simulation = (
                self.simulations.get(
                    vehicle_code
                )
            )

            if simulation is None:
                simulation = VehicleSimulation(
                    vehicle_code,
                    self.mqtt_client,
                )

                self.simulations[
                    vehicle_code
                ] = simulation

            return simulation

    def list_statuses(self) -> list[dict]:
        with self._lock:
            return [
                simulation.status()
                for simulation
                in self.simulations.values()
            ]

    def shutdown(self) -> None:
        with self._lock:
            simulations = list(
                self.simulations.values()
            )

        for simulation in simulations:
            simulation.stop()

        self.mqtt_client.loop_stop()
        self.mqtt_client.disconnect()


manager = SimulationManager()


class SimulationRequestHandler(
    BaseHTTPRequestHandler
):
    def _send_json(
        self,
        status_code: int,
        body: object,
    ) -> None:
        encoded = json.dumps(
            body
        ).encode("utf-8")

        self.send_response(status_code)

        self.send_header(
            "Content-Type",
            "application/json",
        )

        self.send_header(
            "Content-Length",
            str(len(encoded)),
        )

        self.send_header(
            "Access-Control-Allow-Origin",
            "*",
        )

        self.send_header(
            "Access-Control-Allow-Methods",
            "GET, POST, OPTIONS",
        )

        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type",
        )

        self.end_headers()
        self.wfile.write(encoded)

    def do_OPTIONS(self) -> None:
        self._send_json(
            204,
            {},
        )

    def do_GET(self) -> None:
        parts = self._path_parts()

        if self.path == "/health":
            self._send_json(
                200,
                {
                    "status": "ok",
                    "service":
                        "drivepulse-simulator",
                    "mqttConnected":
                        manager.mqtt_client
                        .is_connected(),
                    "simulations":
                        manager.list_statuses(),
                },
            )
            return

        if parts == ["simulation"]:
            self._send_json(
                200,
                {
                    "simulations":
                        manager.list_statuses()
                },
            )
            return

        if (
            len(parts) == 2
            and parts[0] == "simulation"
        ):
            simulation = (
                manager.get_or_create(
                    unquote(parts[1])
                )
            )

            self._send_json(
                200,
                simulation.status(),
            )
            return

        self._send_json(
            404,
            {
                "error": "Route not found."
            },
        )

    def do_POST(self) -> None:
        try:
            parts = self._path_parts()

            if (
                len(parts) == 3
                and parts[0] == "simulation"
            ):
                vehicle_code = unquote(
                    parts[1]
                )

                action = parts[2]

                simulation = (
                    manager.get_or_create(
                        vehicle_code
                    )
                )

                if action == "start":
                    simulation.set_scenario(
                        "normal"
                    )

                elif action == "stop":
                    simulation.stop()

                else:
                    self._send_json(
                        404,
                        {
                            "error":
                                "Unknown action."
                        },
                    )
                    return

                self._send_json(
                    200,
                    simulation.status(),
                )
                return

            if (
                len(parts) == 4
                and parts[0] == "simulation"
                and parts[2] == "scenario"
            ):
                vehicle_code = unquote(
                    parts[1]
                )

                scenario = unquote(
                    parts[3]
                )

                simulation = (
                    manager.get_or_create(
                        vehicle_code
                    )
                )

                simulation.set_scenario(
                    scenario
                )

                self._send_json(
                    200,
                    simulation.status(),
                )
                return

            self._send_json(
                404,
                {
                    "error": "Route not found."
                },
            )

        except ValueError as error:
            self._send_json(
                400,
                {
                    "error": str(error)
                },
            )

        except Exception as error:
            print(
                "Simulation request failed:",
                error,
            )

            self._send_json(
                500,
                {
                    "error":
                        "Simulation request failed."
                },
            )

    def _path_parts(self) -> list[str]:
        path = (
            self.path
            .split("?", 1)[0]
            .strip("/")
        )

        if not path:
            return []

        return path.split("/")

    def log_message(
        self,
        format_string: str,
        *args: object,
    ) -> None:
        print(
            "Simulation API | "
            + format_string % args
        )


def main() -> None:
    manager.connect()

    server = ThreadingHTTPServer(
        (
            HTTP_HOST,
            HTTP_PORT,
        ),
        SimulationRequestHandler,
    )

    def stop_service(
        signal_number: int,
        frame: object,
    ) -> None:
        del signal_number
        del frame

        print(
            "\nStopping simulation service..."
        )

        threading.Thread(
            target=server.shutdown,
            daemon=True,
        ).start()

    signal.signal(
        signal.SIGINT,
        stop_service,
    )

    signal.signal(
        signal.SIGTERM,
        stop_service,
    )

    print(
        f"DrivePulse Simulation Service "
        f"running at "
        f"http://{HTTP_HOST}:{HTTP_PORT}"
    )

    try:
        server.serve_forever()
    finally:
        server.server_close()
        manager.shutdown()

        print(
            "Simulation service stopped."
        )


if __name__ == "__main__":
    main()
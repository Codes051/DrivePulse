import mqtt, { type MqttClient } from "mqtt";

import { telemetryPayloadSchema } from "../schemas/telemetry.schema.js";
import { saveTelemetry } from "../services/telemetry.service.js";

const mqttUrl = process.env.MQTT_URL ?? "mqtt://127.0.0.1:1883";
const telemetryTopic = "vehicles/+/telemetry";

let client: MqttClient | undefined;

export function startMqttClient(): MqttClient {
  if (client) {
    return client;
  }

  client = mqtt.connect(mqttUrl, {
    clientId: `drivepulse-api-${process.pid}`,
    reconnectPeriod: 2000,
    clean: true,
  });

  client.on("connect", () => {
    console.log(`Connected to MQTT broker at ${mqttUrl}`);

    client?.subscribe(
      telemetryTopic,
      { qos: 1 },
      (error) => {
        if (error) {
          console.error(
            `Failed to subscribe to ${telemetryTopic}:`,
            error,
          );
          return;
        }

        console.log(`Subscribed to MQTT topic: ${telemetryTopic}`);
      },
    );
  });

  client.on("message", (topic, message) => {
    void processTelemetryMessage(topic, message);
  });

  client.on("reconnect", () => {
    console.log("Reconnecting to MQTT broker...");
  });

  client.on("error", (error) => {
    console.error("MQTT client error:", error.message);
  });

  client.on("offline", () => {
    console.warn("MQTT client is offline.");
  });

  return client;
}

async function processTelemetryMessage(
  topic: string,
  message: Buffer,
): Promise<void> {
  try {
    const decodedMessage: unknown = JSON.parse(
      message.toString("utf8"),
    );

    const result = telemetryPayloadSchema.safeParse(decodedMessage);

    if (!result.success) {
      console.warn("Rejected invalid telemetry message:", {
        topic,
        issues: result.error.issues,
      });
      return;
    }

    const topicVehicleCode = topic.split("/")[1];

    if (topicVehicleCode !== result.data.vehicleCode) {
      console.warn("Rejected telemetry with mismatched vehicle code:", {
        topicVehicleCode,
        payloadVehicleCode: result.data.vehicleCode,
      });
      return;
    }

    await saveTelemetry(result.data);

    console.log(
      `Saved telemetry for ${result.data.vehicleCode}: ` +
      `${result.data.speedKmh} km/h, ${result.data.rpm} RPM`,
    );
  } catch (error) {
    console.error("Failed to process MQTT telemetry:", error);
  }
}

export async function stopMqttClient(): Promise<void> {
  if (!client) {
    return;
  }

  const currentClient = client;
  client = undefined;

  await new Promise<void>((resolve) => {
    currentClient.end(false, {}, () => {
      console.log("MQTT connection closed.");
      resolve();
    });
  });
}

import { z } from "zod";

/**
 * Flexible key/unit model for physical sensor telemetry.
 * Different equipment types measure different metrics (e.g. pressure_psi, temp_c, vibration_rms_mms).
 */
export const SensorReadingSchema = z.object({
  key: z.string().trim().min(1, "Sensor key cannot be empty").max(100),
  value: z.number().finite("Sensor value must be a finite number"),
  unit: z.string().trim().min(1, "Sensor unit cannot be empty").max(50),
  recordedAt: z.string().datetime({ offset: true }).optional(),
});

export type SensorReading = z.infer<typeof SensorReadingSchema>;

/**
 * Optional array of sensor readings.
 */
export const SensorReadingsSchema = z.array(SensorReadingSchema).optional();
export type SensorReadings = z.infer<typeof SensorReadingsSchema>;

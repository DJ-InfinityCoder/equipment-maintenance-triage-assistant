import { z } from "zod";

/**
 * Standard equipment types supported by the maintenance triage system.
 * Designed to be easy to extend by appending to this tuple.
 */
export const BASE_EQUIPMENT_TYPES = [
  "centrifugal_pump",
  "air_compressor",
  "hvac_chiller",
  "electric_motor",
  "conveyor",
] as const;

export const EquipmentTypeSchema = z.enum(BASE_EQUIPMENT_TYPES);

export type EquipmentType = z.infer<typeof EquipmentTypeSchema>;

/**
 * Human-readable display labels for each equipment type.
 */
export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  centrifugal_pump: "Centrifugal Pump",
  air_compressor: "Air Compressor",
  hvac_chiller: "HVAC Chiller",
  electric_motor: "Electric Motor",
  conveyor: "Conveyor System",
};

/**
 * Utility helper to construct an extended EquipmentType schema with additional custom equipment types.
 */
export function createExtendedEquipmentTypeSchema<T extends string>(
  additionalTypes: readonly T[]
) {
  return z.enum(
    [...BASE_EQUIPMENT_TYPES, ...additionalTypes] as unknown as [
      (typeof BASE_EQUIPMENT_TYPES)[number],
      ...T[],
    ]
  );
}

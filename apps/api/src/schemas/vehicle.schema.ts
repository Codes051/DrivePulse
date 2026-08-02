import { z } from "zod";

const currentYear = new Date().getFullYear();

export const vehicleStatusSchema = z.enum([
  "ONLINE",
  "OFFLINE",
  "WARNING",
  "MAINTENANCE",
]);

export const createVehicleSchema = z.object({
  vehicleCode: z
    .string()
    .trim()
    .min(2, "Vehicle code must contain at least 2 characters.")
    .max(30, "Vehicle code cannot exceed 30 characters.")
    .transform((value) => value.toUpperCase()),

  manufacturer: z
    .string()
    .trim()
    .min(2, "Manufacturer must contain at least 2 characters.")
    .max(80, "Manufacturer cannot exceed 80 characters."),

  model: z
    .string()
    .trim()
    .min(1, "Model is required.")
    .max(80, "Model cannot exceed 80 characters."),

  year: z
    .number()
    .int("Year must be a whole number.")
    .min(1886, "Year is too early.")
    .max(currentYear + 1, "Year cannot be more than one year in the future.")
    .optional(),

  status: vehicleStatusSchema.optional(),
});

export const updateVehicleSchema = createVehicleSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be supplied.",
  });

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

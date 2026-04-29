import { z } from "zod";

export const carSchema = z.object({
  brand: z.string().min(1, "Marque obligatoire"),
  model: z.string().min(1, "Modèle obligatoire"),
  registrationNumber: z.string().min(1, "Matricule obligatoire"),
  year: z.coerce.number().int().optional(),
  fuelType: z.string().min(1),
  transmission: z.string().min(1),
  dailyPrice: z.coerce.number().positive(),
  status: z.enum(["AVAILABLE", "RENTED", "MAINTENANCE", "UNAVAILABLE"]),
  mileage: z.coerce.number().int().optional(),
});

export const clientSchema = z.object({
  fullName: z.string().min(1, "Nom obligatoire"),
  phone: z.string().min(1, "Téléphone obligatoire"),
  email: z.string().email().optional().or(z.literal("")),
  cin: z.string().optional(),
  passportNumber: z.string().optional(),
  drivingLicense: z.string().optional(),
  address: z.string().optional(),
});

import type { Car } from "@/types/car";
import type { Client } from "@/types/client";

export type ReservationStatus = "RESERVED" | "ONGOING" | "COMPLETED" | "CANCELLED";

export interface Reservation {
  id: number;
  clientId: number;
  carId: number;
  startDate: string;
  endDate: string;
  dailyPrice: number;
  totalPrice: number;
  depositAmount: number;
  status: ReservationStatus;
  pickupMileage?: number | null;
  returnMileage?: number | null;
  pickupFuelLevel?: string | null;
  returnFuelLevel?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  car?: Car;
}

export type CreateReservationDto = Omit<Reservation, "id" | "createdAt" | "updatedAt" | "client" | "car">;

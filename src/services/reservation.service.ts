import { invokeCommand } from "@/services/invoke";
import type { CreateReservationDto, Reservation, ReservationStatus } from "@/types/reservation";

export async function getReservations() {
  return invokeCommand<Reservation[]>("get_reservations");
}

export async function createReservation(data: CreateReservationDto) {
  return invokeCommand<Reservation>("create_reservation", { data });
}

export async function updateReservationStatus(
  id: number,
  data: { status: ReservationStatus; returnMileage?: number | null; returnFuelLevel?: string | null },
) {
  return invokeCommand<Reservation>("update_reservation_status", { id, data });
}

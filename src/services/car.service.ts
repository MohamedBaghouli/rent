import { invokeCommand } from "@/services/invoke";
import type { Car, CreateCarDto } from "@/types/car";

export async function getCars() {
  return invokeCommand<Car[]>("get_cars");
}

export async function createCar(data: CreateCarDto) {
  return invokeCommand<Car>("create_car", { data });
}

export async function updateCar(id: number, data: CreateCarDto) {
  return invokeCommand<Car>("update_car", { id, data });
}

export async function changeCarStatus(id: number, status: Car["status"]) {
  return invokeCommand<Car>("change_car_status", { id, status });
}

export async function deleteCar(id: number) {
  return invokeCommand<void>("delete_car", { id });
}

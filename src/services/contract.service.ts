import { invokeCommand } from "@/services/invoke";
import type { Contract } from "@/types/contract";

export async function getContracts() {
  return invokeCommand<Contract[]>("get_contracts");
}

export async function generateContract(reservationId: number) {
  return invokeCommand<Contract>("generate_contract", { reservationId });
}

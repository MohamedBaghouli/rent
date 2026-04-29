import { invokeCommand } from "@/services/invoke";
import type { CreatePaymentDto, Payment } from "@/types/payment";

export async function getPayments() {
  return invokeCommand<Payment[]>("get_payments");
}

export async function createPayment(data: CreatePaymentDto) {
  return invokeCommand<Payment>("create_payment", { data });
}

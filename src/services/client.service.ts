import { invokeCommand } from "@/services/invoke";
import type { Client, CreateClientDto } from "@/types/client";

export async function getClients() {
  return invokeCommand<Client[]>("get_clients");
}

export async function createClient(data: CreateClientDto) {
  return invokeCommand<Client>("create_client", { data });
}

export async function updateClient(id: number, data: CreateClientDto) {
  return invokeCommand<Client>("update_client", { id, data });
}

export async function deactivateClient(id: number) {
  return invokeCommand<Client>("deactivate_client", { id });
}

export async function reactivateClient(id: number) {
  return invokeCommand<Client>("reactivate_client", { id });
}

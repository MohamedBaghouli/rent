import type { Reservation } from "@/types/reservation";

export type ContractStatus = "GENERATED" | "SIGNED" | "CANCELLED";

export interface Contract {
  id: number;
  reservationId: number;
  contractNumber: string;
  pdfPath?: string | null;
  status: ContractStatus;
  generatedAt: string;
  signedAt?: string | null;
  createdAt: string;
  reservation?: Reservation;
}

export interface Client {
  id: number;
  fullName: string;
  phone: string;
  email?: string | null;
  cin?: string | null;
  passportNumber?: string | null;
  drivingLicense?: string | null;
  address?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateClientDto = Omit<Client, "id" | "createdAt" | "updatedAt">;

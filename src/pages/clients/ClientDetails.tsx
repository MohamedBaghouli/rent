import { Card, CardTitle } from "@/components/ui/card";
import type { Client } from "@/types/client";
import { formatPhoneNumber, normalizeClientName } from "@/utils/client";

export function ClientDetails({ client }: { client: Client }) {
  return (
    <Card>
      <CardTitle>{normalizeClientName(client.fullName)}</CardTitle>
      <p className="mt-2 text-sm">{formatPhoneNumber(client.phone)}</p>
      <p className="text-sm text-muted-foreground">{client.cin ? `CIN: ${client.cin}` : client.passportNumber ? `Passeport: ${client.passportNumber}` : "-"}</p>
    </Card>
  );
}

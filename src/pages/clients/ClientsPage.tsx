import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { PageHeader } from "@/app/layout";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ClientForm } from "@/pages/clients/ClientForm";
import { createClient, deleteClient, getClients, updateClient } from "@/services/client.service";
import { getReservations } from "@/services/reservation.service";
import type { Client, CreateClientDto } from "@/types/client";
import type { Reservation } from "@/types/reservation";
import { formatPhoneNumber, normalizeClientName } from "@/utils/client";
import { formatShortPeriod } from "@/utils/date";
import { formatMoney } from "@/utils/money";

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [detailsClient, setDetailsClient] = useState<Client | null>(null);

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    const [clientsData, reservationsData] = await Promise.all([getClients(), getReservations()]);
    setClients(clientsData);
    setReservations(reservationsData);
  }

  const filteredClients = useMemo(
    () =>
      clients.filter((client) =>
        `${normalizeClientName(client.fullName)} ${client.phone} ${formatPhoneNumber(client.phone)} ${client.cin ?? ""} ${client.drivingLicense ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [clients, query],
  );

  const locationsByClient = useMemo(() => {
    const counts = new Map<number, number>();
    reservations.forEach((reservation) => counts.set(reservation.clientId, (counts.get(reservation.clientId) ?? 0) + 1));
    return counts;
  }, [reservations]);

  const columns: ColumnDef<Client>[] = [
    {
      header: "Nom complet",
      cell: ({ row }) => <ClientNameCell client={row.original} locationsCount={locationsByClient.get(row.original.id) ?? 0} />,
    },
    { header: "Téléphone", cell: ({ row }) => formatPhoneNumber(row.original.phone) },
    {
      header: "Permis",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.drivingLicense || "-"}</span>,
    },
    { header: "Locations", cell: ({ row }) => locationsByClient.get(row.original.id) ?? 0 },
    {
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button aria-label="Voir" onClick={() => setDetailsClient(row.original)} size="icon" title="Voir" variant="ghost">
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            aria-label="Modifier"
            onClick={() => {
              setEditingClient(row.original);
              setOpen(true);
            }}
            size="icon"
            title="Modifier"
            variant="ghost"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button aria-label="Supprimer" onClick={() => handleDelete(row.original.id)} size="icon" title="Supprimer" variant="ghost">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  async function handleSubmit(data: CreateClientDto) {
    if (editingClient) {
      const client = await updateClient(editingClient.id, normalizeClientPayload(data));
      setClients((current) => current.map((item) => (item.id === client.id ? client : item)));
    } else {
      const client = await createClient(normalizeClientPayload(data));
      setClients((current) => [client, ...current]);
    }
    setEditingClient(null);
    setOpen(false);
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Supprimer ce client ?")) return;
    await deleteClient(id);
    setClients((current) => current.filter((client) => client.id !== id));
  }

  const history = reservations.filter((reservation) => reservation.clientId === detailsClient?.id);

  return (
    <>
      <PageHeader title="Clients">
        <Dialog
          onOpenChange={(value) => {
            setOpen(value);
            if (!value) setEditingClient(null);
          }}
          open={open}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Ajouter client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClient ? "Modifier un client" : "Ajouter un client"}</DialogTitle>
            </DialogHeader>
            <ClientForm defaultValues={editingClient ?? undefined} onSubmit={handleSubmit} />
          </DialogContent>
        </Dialog>
      </PageHeader>
      <div className="mb-4 max-w-md">
        <Input onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher (nom, téléphone, CIN)" value={query} />
      </div>
      <DataTable columns={columns} data={filteredClients} />

      <Dialog onOpenChange={(value) => !value && setDetailsClient(null)} open={Boolean(detailsClient)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Détails client</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {detailsClient && (
              <div className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{normalizeClientName(detailsClient.fullName)}</p>
                  {(locationsByClient.get(detailsClient.id) ?? 0) > 5 && <LoyaltyBadge />}
                </div>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  <DetailItem label="Téléphone" value={formatPhoneNumber(detailsClient.phone)} />
                  <DetailItem label="Email" value={detailsClient.email || "-"} />
                  <DetailItem label="CIN" value={detailsClient.cin || "-"} />
                  <DetailItem label="Passeport" value={detailsClient.passportNumber || "-"} />
                  <DetailItem label="Permis" value={detailsClient.drivingLicense || "-"} />
                  <DetailItem label="Adresse" value={detailsClient.address || "-"} />
                  <DetailItem label="Locations" value={String(locationsByClient.get(detailsClient.id) ?? 0)} />
                </dl>
              </div>
            )}
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune location pour ce client.</p>
            ) : (
              history.map((reservation) => (
                <div className="rounded-md border border-border p-3 text-sm" key={reservation.id}>
                  <div className="flex items-center justify-between">
                    <span>Réservation #{reservation.id}</span>
                    <StatusBadge status={reservation.status} />
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {formatShortPeriod(reservation.startDate, reservation.endDate)} | {formatMoney(reservation.totalPrice)}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function normalizeClientPayload(data: CreateClientDto): CreateClientDto {
  return {
    ...data,
    fullName: normalizeClientName(data.fullName),
    phone: data.phone.replace(/\D/g, ""),
    email: data.email || null,
    cin: data.cin || null,
    passportNumber: data.passportNumber || null,
    drivingLicense: data.drivingLicense?.trim() ?? "",
    address: data.address || null,
  };
}

function ClientNameCell({ client, locationsCount }: { client: Client; locationsCount: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="font-semibold">{normalizeClientName(client.fullName)}</span>
        {locationsCount > 5 && <LoyaltyBadge />}
      </div>
    </div>
  );
}

function LoyaltyBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
      <Star className="h-3 w-3 fill-current" />
      Fidèle
    </span>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

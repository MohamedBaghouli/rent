import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Eye, Pencil, Plus, RotateCcw, Star } from "lucide-react";
import { PageHeader } from "@/app/layout";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ClientForm } from "@/pages/clients/ClientForm";
import { createClient, deactivateClient, getClients, reactivateClient, updateClient } from "@/services/client.service";
import { getReservations } from "@/services/reservation.service";
import type { Client, CreateClientDto } from "@/types/client";
import type { Reservation } from "@/types/reservation";
import { formatDrivingLicense, formatPhoneNumber, normalizeClientName } from "@/utils/client";
import { formatShortPeriod } from "@/utils/date";
import { formatMoney } from "@/utils/money";
import { useToast } from "@/hooks/useToast";

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ACTIVE");
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [detailsClient, setDetailsClient] = useState<Client | null>(null);
  const { showToast } = useToast();

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
      clients
        .filter((client) => {
          if (statusFilter === "ACTIVE") return isClientActive(client);
          if (statusFilter === "INACTIVE") return !isClientActive(client);
          return true;
        })
        .filter((client) =>
          `${normalizeClientName(client.fullName)} ${client.phone} ${formatPhoneNumber(client.phone)} ${client.cin ?? ""} ${client.passportNumber ?? ""} ${client.drivingLicense ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        ),
    [clients, query, statusFilter],
  );

  const locationsByClient = useMemo(() => {
    const counts = new Map<number, number>();
    reservations.forEach((reservation) => {
      counts.set(reservation.clientId, (counts.get(reservation.clientId) ?? 0) + 1);
      if (reservation.secondClientId) {
        counts.set(reservation.secondClientId, (counts.get(reservation.secondClientId) ?? 0) + 1);
      }
    });
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
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDrivingLicense(row.original.drivingLicense)}</span>,
    },
    { header: "Locations", cell: ({ row }) => locationsByClient.get(row.original.id) ?? 0 },
    { header: "Statut", cell: ({ row }) => <ClientStatusBadge isActive={isClientActive(row.original)} /> },
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
          {isClientActive(row.original) ? (
            <Button
              aria-label="Désactiver"
              onClick={() => handleDeactivate(row.original.id)}
              size="icon"
              title="Désactiver"
              variant="ghost"
            >
              <Ban className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              aria-label="Réactiver"
              onClick={() => handleReactivate(row.original.id)}
              size="icon"
              title="Réactiver"
              variant="ghost"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  async function handleSubmit(data: CreateClientDto) {
    try {
      if (editingClient) {
        const client = await updateClient(editingClient.id, normalizeClientPayload(data));
        setClients((current) => current.map((item) => (item.id === client.id ? client : item)));
        showToast({ title: "Client modifié", type: "success" });
      } else {
        const client = await createClient(normalizeClientPayload(data));
        setClients((current) => [client, ...current]);
        showToast({ title: "Client ajouté", type: "success" });
      }
      setEditingClient(null);
      setOpen(false);
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Erreur client", type: "error" });
    }
  }

  async function handleDeactivate(id: number) {
    if (!window.confirm("Désactiver ce client ? Il restera visible dans l'historique.")) return;
    try {
      const client = await deactivateClient(id);
      setClients((current) => current.map((item) => (item.id === id ? client : item)));
      showToast({ title: "Client désactivé", type: "success" });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Désactivation impossible", type: "error" });
    }
  }

  async function handleReactivate(id: number) {
    try {
      const client = await reactivateClient(id);
      setClients((current) => current.map((item) => (item.id === id ? client : item)));
      showToast({ title: "Client réactivé", type: "success" });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Réactivation impossible", type: "error" });
    }
  }

  const history = reservations.filter(
    (reservation) => reservation.clientId === detailsClient?.id || reservation.secondClientId === detailsClient?.id,
  );

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
          <DialogContent className="max-h-[92vh] w-[min(96vw,700px)] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingClient ? "Modifier un client" : "Ajouter un client"}</DialogTitle>
            </DialogHeader>
            <ClientForm defaultValues={editingClient ?? undefined} onSubmit={handleSubmit} />
          </DialogContent>
        </Dialog>
      </PageHeader>
      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(240px,420px)_220px]">
        <Input onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher (nom, téléphone, CIN, passeport)" value={query} />
        <select
          className="h-10 rounded-md border border-input bg-white px-3 text-sm"
          onChange={(event) => setStatusFilter(event.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
          value={statusFilter}
        >
          <option value="ACTIVE">Clients Actifs</option>
          <option value="INACTIVE">Clients Inactifs</option>
          <option value="ALL">Tous les clients</option>
        </select>
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
                  <div className="flex items-center gap-2">
                    {(locationsByClient.get(detailsClient.id) ?? 0) > 5 && <LoyaltyBadge />}
                    <ClientStatusBadge isActive={isClientActive(detailsClient)} />
                  </div>
                </div>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  <DetailItem label="Téléphone" value={formatPhoneNumber(detailsClient.phone)} />
                  {detailsClient.birthDate && (
                    <DetailItem label="Date de naissance" value={formatIsoDate(detailsClient.birthDate)} />
                  )}
                  {detailsClient.birthPlace && (
                    <DetailItem label="Lieu de naissance" value={detailsClient.birthPlace} />
                  )}
                  {detailsClient.nationality && (
                    <DetailItem label="Nationalité" value={detailsClient.nationality} />
                  )}
                  {detailsClient.cin && (
                    <DetailItem label="CIN" value={detailsClient.cin} />
                  )}
                  {detailsClient.cinIssueDate && (
                    <DetailItem label="Obtention CIN" value={formatIsoDate(detailsClient.cinIssueDate)} />
                  )}
                  {detailsClient.cinIssuePlace && (
                    <DetailItem label="Lieu CIN" value={detailsClient.cinIssuePlace} />
                  )}
                  {detailsClient.passportNumber && (
                    <DetailItem label="Passeport" value={detailsClient.passportNumber} />
                  )}
                  <DetailItem label="Permis" value={formatDrivingLicense(detailsClient.drivingLicense)} />
                  {detailsClient.drivingLicenseDate && (
                    <DetailItem label="Obtention permis" value={formatIsoDate(detailsClient.drivingLicenseDate)} />
                  )}
                  {detailsClient.address && (
                    <DetailItem label="Adresse" value={detailsClient.address} />
                  )}
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
    phone: data.phone.trim(),
    cin: cleanOptional(data.cin),
    passportNumber: cleanOptional(data.passportNumber),
    drivingLicense: cleanOptional(data.drivingLicense),
    drivingLicenseDate: data.drivingLicenseDate || null,
    cinIssueDate: data.cinIssueDate || null,
    cinIssuePlace: data.cinIssuePlace || null,
    birthDate: data.birthDate || null,
    birthPlace: data.birthPlace || null,
    nationality: data.nationality || null,
    address: data.address || null,
  };
}

function cleanOptional(value?: string | null) {
  const cleaned = value?.trim() ?? "";
  return cleaned || null;
}

function formatIsoDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function ClientNameCell({ client, locationsCount }: { client: Client; locationsCount: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className={isClientActive(client) ? "font-semibold" : "font-semibold text-muted-foreground"}>
          {normalizeClientName(client.fullName)}
        </span>
        {locationsCount > 5 && <LoyaltyBadge />}
        {!isClientActive(client) && <ClientStatusBadge isActive={false} />}
      </div>
    </div>
  );
}

function isClientActive(client: Client) {
  return client.isActive !== false;
}

function ClientStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={
        isActive
          ? "inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200"
          : "inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200"
      }
    >
      {isActive ? "Actif" : "Désactivé"}
    </span>
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

function getErrorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : String(caught);
}

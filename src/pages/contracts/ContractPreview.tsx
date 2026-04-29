import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Eye, Printer } from "lucide-react";
import { PageHeader } from "@/app/layout";
import { DataTable } from "@/components/DataTable";
import { getStatusLabel, StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ContractPDF } from "@/pages/contracts/ContractPDF";
import { getCars } from "@/services/car.service";
import { getClients } from "@/services/client.service";
import { getContracts } from "@/services/contract.service";
import { getReservations } from "@/services/reservation.service";
import type { Car } from "@/types/car";
import type { Client } from "@/types/client";
import type { Contract, ContractStatus } from "@/types/contract";
import type { Reservation } from "@/types/reservation";
import { formatCarName } from "@/utils/car";
import { normalizeClientName } from "@/utils/client";
import { formatDate, formatShortPeriod } from "@/utils/date";
import { createContractPdf } from "@/utils/pdf";

type ContractRow = {
  car?: Car;
  client?: Client;
  contract: Contract;
  reservation?: Reservation;
};

const contractStatuses: Array<"ALL" | ContractStatus> = ["ALL", "GENERATED", "SIGNED", "CANCELLED"];

export function ContractPreview() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [selected, setSelected] = useState<Contract | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | ContractStatus>("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [clientFilter, setClientFilter] = useState<number>(0);

  useEffect(() => {
    void Promise.all([getContracts(), getReservations(), getClients(), getCars()]).then(
      ([contractsData, reservationsData, clientsData, carsData]) => {
        setContracts(contractsData);
        setReservations(reservationsData);
        setClients(clientsData);
        setCars(carsData);
      },
    );
  }, []);

  const reservationMap = useMemo(() => new Map(reservations.map((reservation) => [reservation.id, reservation])), [reservations]);
  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const carMap = useMemo(() => new Map(cars.map((car) => [car.id, car])), [cars]);

  const rows = useMemo(
    () =>
      contracts.map((contract): ContractRow => {
        const reservation = reservationMap.get(contract.reservationId);

        return {
          car: reservation ? carMap.get(reservation.carId) : undefined,
          client: reservation ? clientMap.get(reservation.clientId) : undefined,
          contract,
          reservation,
        };
      }),
    [carMap, clientMap, contracts, reservationMap],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const matchesStatus = statusFilter === "ALL" || row.contract.status === statusFilter;
        const matchesDate = !dateFilter || row.contract.generatedAt.slice(0, 10) === dateFilter;
        const matchesClient = clientFilter === 0 || row.reservation?.clientId === clientFilter;

        return matchesStatus && matchesDate && matchesClient;
      }),
    [clientFilter, dateFilter, rows, statusFilter],
  );

  const columns: ColumnDef<ContractRow>[] = [
    { header: "N° Contrat", cell: ({ row }) => row.original.contract.contractNumber },
    { header: "Client", cell: ({ row }) => <ClientCell client={row.original.client} /> },
    { header: "Voiture", cell: ({ row }) => formatCar(row.original.car) },
    { header: "Période", cell: ({ row }) => formatPeriod(row.original.reservation) },
    { header: "Statut", cell: ({ row }) => <StatusBadge status={row.original.contract.status} /> },
    { header: "Généré le", cell: ({ row }) => formatDateTime(row.original.contract.generatedAt) },
    { header: "Signature", cell: ({ row }) => formatSignature(row.original.contract) },
    {
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button aria-label="Voir contrat" onClick={() => setSelected(row.original.contract)} size="icon" title="Voir contrat" variant="ghost">
            <Eye className="h-4 w-4" />
          </Button>
          <Button aria-label="Télécharger" onClick={() => downloadContract(row.original.contract)} size="icon" title="Télécharger" variant="ghost">
            <Download className="h-4 w-4" />
          </Button>
          <Button aria-label="Imprimer" onClick={() => window.print()} size="icon" title="Imprimer" variant="ghost">
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  async function downloadContract(contract: Contract) {
    const bytes = await createContractPdf(contract);
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${contract.contractNumber}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const reservation = selected ? reservationMap.get(selected.reservationId) : undefined;
  const client = reservation ? clientMap.get(reservation.clientId) : undefined;
  const car = reservation ? carMap.get(reservation.carId) : undefined;

  return (
    <>
      <PageHeader title="Contrats" />
      <Card className="mb-4">
        <CardTitle>Numérotation</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">Format : CNT-2026-0001</p>
        <p className="text-sm text-muted-foreground">Les contrats sont générés automatiquement après chaque réservation.</p>
      </Card>

      <div className="mb-4 grid gap-3 md:grid-cols-[220px_180px_minmax(240px,1fr)]">
        <select
          className="h-10 rounded-md border border-input bg-white px-3 text-sm"
          onChange={(event) => setStatusFilter(event.target.value as "ALL" | ContractStatus)}
          value={statusFilter}
        >
          {contractStatuses.map((status) => (
            <option key={status} value={status}>
              {status === "ALL" ? "Tous les statuts" : getStatusLabel(status)}
            </option>
          ))}
        </select>
        <Input onChange={(event) => setDateFilter(event.target.value)} type="date" value={dateFilter} />
        <select
          className="h-10 rounded-md border border-input bg-white px-3 text-sm"
          onChange={(event) => setClientFilter(Number(event.target.value))}
          value={clientFilter}
        >
          <option value={0}>Tous les clients</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {normalizeClientName(client.fullName)}
            </option>
          ))}
        </select>
      </div>

      <DataTable columns={columns} data={filteredRows} />

      <Dialog onOpenChange={(value) => !value && setSelected(null)} open={Boolean(selected)}>
        <DialogContent className="max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Prévisualisation contrat</DialogTitle>
          </DialogHeader>
          {selected && <ContractPDF car={car} client={client} contract={selected} reservation={reservation} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatCar(car?: Car) {
  return car ? formatCarName(car.brand, car.model) : "-";
}

function formatPeriod(reservation?: Reservation) {
  if (!reservation) return "-";
  return formatShortPeriod(reservation.startDate, reservation.endDate);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatSignature(contract: Contract) {
  if (contract.status === "SIGNED" && contract.signedAt) {
    return `Signé le : ${formatDate(contract.signedAt)}`;
  }

  if (contract.status === "SIGNED") return "Signé";
  if (contract.status === "CANCELLED") return "Annulé";

  return "En attente";
}

function ClientCell({ client }: { client?: Client }) {
  if (!client) return <span>-</span>;

  return (
    <div>
      <p>{normalizeClientName(client.fullName)}</p>
      <p className="text-xs text-muted-foreground">CIN : {client.cin || "-"}</p>
    </div>
  );
}

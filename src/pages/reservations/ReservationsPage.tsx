import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, CheckCircle2, FileText, Play, Plus } from "lucide-react";
import { PageHeader } from "@/app/layout";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ReservationForm } from "@/pages/reservations/ReservationForm";
import { generateContract } from "@/services/contract.service";
import { getCars } from "@/services/car.service";
import { getClients } from "@/services/client.service";
import { getPayments } from "@/services/payment.service";
import { createReservation, getReservations, updateReservationStatus } from "@/services/reservation.service";
import type { Car } from "@/types/car";
import type { Client } from "@/types/client";
import type { Payment } from "@/types/payment";
import type { CreateReservationDto, Reservation } from "@/types/reservation";
import { formatCarName, isValidRegistrationNumber, normalizeRegistrationNumber } from "@/utils/car";
import { normalizeClientName } from "@/utils/client";
import { formatRentalDuration, formatShortPeriod, getLocalDateKey, getRentalDays } from "@/utils/date";
import { formatMoney } from "@/utils/money";

const reservationStatuses: Array<"ALL" | Reservation["status"]> = ["ALL", "RESERVED", "ONGOING", "COMPLETED", "CANCELLED"];

export function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | Reservation["status"]>("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [carFilter, setCarFilter] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    const [reservationsData, clientsData, carsData, paymentsData] = await Promise.all([
      getReservations(),
      getClients(),
      getCars(),
      getPayments(),
    ]);
    setReservations(reservationsData);
    setClients(clientsData);
    setCars(carsData);
    setPayments(paymentsData);
  }

  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const carsById = useMemo(() => new Map(cars.map((car) => [car.id, car])), [cars]);
  const filteredReservations = useMemo(
    () =>
      reservations.filter((reservation) => {
        const matchesStatus = statusFilter === "ALL" || reservation.status === statusFilter;
        const matchesCar = carFilter === 0 || reservation.carId === carFilter;
        const startKey = getLocalDateKey(reservation.startDate);
        const endKey = getLocalDateKey(reservation.endDate);
        const matchesDate = !dateFilter || (dateFilter >= startKey && dateFilter <= endKey);

        return matchesStatus && matchesCar && matchesDate;
      }),
    [carFilter, dateFilter, reservations, statusFilter],
  );

  const columns: ColumnDef<Reservation>[] = [
    { header: "Client", cell: ({ row }) => <ClientCell client={clientsById.get(row.original.clientId)} /> },
    { header: "Voiture", cell: ({ row }) => <CarCell car={carsById.get(row.original.carId)} /> },
    { header: "Période", cell: ({ row }) => <PeriodCell reservation={row.original} /> },
    { header: "Paiement", cell: ({ row }) => <PaymentCell payments={payments} reservation={row.original} /> },
    { header: "Caution", cell: ({ row }) => <DepositCell payments={payments} reservation={row.original} /> },
    { header: "Statut", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          {row.original.status === "RESERVED" && (
            <Button
              aria-label="Démarrer"
              className="px-2"
              onClick={() => handleStatus(row.original.id, "ONGOING")}
              size="sm"
              title="Démarrer"
              variant="ghost"
            >
              <Play className="h-4 w-4" />
              Démarrer
            </Button>
          )}
          {row.original.status === "ONGOING" && (
            <Button
              aria-label="Terminer"
              className="px-2"
              onClick={() => handleStatus(row.original.id, "COMPLETED")}
              size="sm"
              title="Terminer"
              variant="ghost"
            >
              <CheckCircle2 className="h-4 w-4" />
              Terminer
            </Button>
          )}
          {["RESERVED", "ONGOING"].includes(row.original.status) && (
            <Button
              aria-label="Annuler"
              className="px-2"
              onClick={() => handleStatus(row.original.id, "CANCELLED")}
              size="sm"
              title="Annuler"
              variant="ghost"
            >
              <Ban className="h-4 w-4" />
              Annuler
            </Button>
          )}
          <Button
            aria-label="Contrat"
            className="px-2"
            onClick={() => handleGenerateContract(row.original.id)}
            size="sm"
            title="Contrat"
            variant="ghost"
          >
            <FileText className="h-4 w-4" />
            Contrat
          </Button>
        </div>
      ),
    },
  ];

  async function handleCreate(data: CreateReservationDto) {
    setError(null);
    try {
      const reservation = await createReservation(data);
      setReservations((current) => [reservation, ...current]);
      setOpen(false);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function handleStatus(id: number, status: Reservation["status"]) {
    const reservation = await updateReservationStatus(id, { status });
    setReservations((current) => current.map((item) => (item.id === id ? reservation : item)));
    await reload();
  }

  async function handleGenerateContract(reservationId: number) {
    await generateContract(reservationId);
    window.alert("Contrat genere. Consulte la page Contrats.");
  }

  return (
    <>
      <PageHeader title="Reservations">
        <Dialog
          onOpenChange={(value) => {
            setOpen(value);
            if (!value) setError(null);
          }}
          open={open}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Créer réservation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92vh] w-[min(96vw,980px)] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Créer une réservation</DialogTitle>
            </DialogHeader>
            {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <ReservationForm cars={cars} clients={clients} onSubmit={handleCreate} reservations={reservations} />
          </DialogContent>
        </Dialog>
      </PageHeader>
      <div className="mb-4 grid gap-3 md:grid-cols-[220px_180px_minmax(240px,1fr)]">
        <select
          className="h-10 rounded-md border border-input bg-white px-3 text-sm"
          onChange={(event) => setStatusFilter(event.target.value as "ALL" | Reservation["status"])}
          value={statusFilter}
        >
          {reservationStatuses.map((status) => (
            <option key={status} value={status}>
              {status === "ALL" ? "Tous les statuts" : statusLabel(status)}
            </option>
          ))}
        </select>
        <Input onChange={(event) => setDateFilter(event.target.value)} type="date" value={dateFilter} />
        <select
          className="h-10 rounded-md border border-input bg-white px-3 text-sm"
          onChange={(event) => setCarFilter(Number(event.target.value))}
          value={carFilter}
        >
          <option value={0}>Toutes les voitures</option>
          {cars.map((car) => (
            <option key={car.id} value={car.id}>
              {formatCarName(car.brand, car.model)} ({formatRegistration(car.registrationNumber)})
            </option>
          ))}
        </select>
      </div>
      <DataTable columns={columns} data={filteredReservations} />
    </>
  );
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

function CarCell({ car }: { car?: Car }) {
  if (!car) return <span>-</span>;

  return (
    <div>
      <p className="font-medium">{formatCarName(car.brand, car.model)}</p>
      <p className="text-xs text-muted-foreground">({formatRegistration(car.registrationNumber)})</p>
    </div>
  );
}

function PeriodCell({ reservation }: { reservation: Reservation }) {
  const days = getRentalDays(reservation.startDate, reservation.endDate);

  return (
    <div>
      <p>{formatShortPeriod(reservation.startDate, reservation.endDate)}</p>
      <p className="text-xs text-muted-foreground">
        {formatRentalDuration(reservation.startDate, reservation.endDate)} | {days} {days > 1 ? "jours" : "jour"}
      </p>
    </div>
  );
}

function PaymentCell({ payments, reservation }: { payments: Payment[]; reservation: Reservation }) {
  const paid = sumPayments(payments, reservation.id, "RENTAL_PAYMENT");

  return (
    <div>
      <p className="font-medium">
        {formatMoney(paid)} / {formatMoney(reservation.totalPrice)}
      </p>
      <p className="text-xs text-muted-foreground">Reste {formatMoney(Math.max(0, reservation.totalPrice - paid))}</p>
    </div>
  );
}

function DepositCell({ payments, reservation }: { payments: Payment[]; reservation: Reservation }) {
  const collected = sumPayments(payments, reservation.id, "DEPOSIT");
  const refunded = sumPayments(payments, reservation.id, "DEPOSIT_REFUND");
  const status = collected <= 0 ? "à encaisser" : refunded >= collected ? "remboursée" : "OK";

  return (
    <div>
      <p>{formatMoney(reservation.depositAmount)}</p>
      <p className="text-xs text-muted-foreground">({status})</p>
    </div>
  );
}

function sumPayments(payments: Payment[], reservationId: number, type: Payment["type"]) {
  return payments
    .filter((payment) => payment.reservationId === reservationId && payment.type === type)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

function formatRegistration(value: string) {
  const normalized = normalizeRegistrationNumber(value);
  return isValidRegistrationNumber(normalized) ? normalized : "Format invalide";
}

function statusLabel(status: Reservation["status"]) {
  const labels: Record<Reservation["status"], string> = {
    RESERVED: "Réservée",
    ONGOING: "En cours",
    COMPLETED: "Terminée",
    CANCELLED: "Annulée",
  };

  return labels[status];
}

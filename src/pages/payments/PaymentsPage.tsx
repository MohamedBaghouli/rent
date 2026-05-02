import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, ReceiptText } from "lucide-react";
import { PageHeader } from "@/app/layout";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PaymentForm } from "@/pages/payments/PaymentForm";
import { getCars } from "@/services/car.service";
import { getClients } from "@/services/client.service";
import { createPayment, getPayments } from "@/services/payment.service";
import { getReservations } from "@/services/reservation.service";
import type { Car } from "@/types/car";
import type { Client } from "@/types/client";
import type { CreatePaymentDto, Payment } from "@/types/payment";
import type { Reservation } from "@/types/reservation";
import { formatCarName, formatRegistrationNumber } from "@/utils/car";
import { normalizeClientName } from "@/utils/client";
import { formatDateTime, formatShortPeriod } from "@/utils/date";
import { formatMoney } from "@/utils/money";
import { useToast } from "@/hooks/useToast";

type ReservationSummary = {
  car?: Car;
  client?: Client;
  secondClient?: Client;
  paid: number;
  remaining: number;
  reservation: Reservation;
  status: "Non payé" | "Partiellement payé" | "Payé" | "Annulée";
};

const paymentTypeLabels: Record<Payment["type"], string> = {
  RENTAL_PAYMENT: "Location",
  DEPOSIT: "Caution",
  DEPOSIT_REFUND: "Remboursement",
  PENALTY: "Pénalité",
};

const paymentMethodLabels: Record<Payment["method"], string> = {
  CASH: "Espèces",
  CARD: "Carte",
  BANK_TRANSFER: "Virement",
  CHECK: "Chèque",
};

const paymentMethodIcons: Record<Payment["method"], string> = {
  CASH: "💵",
  CARD: "💳",
  BANK_TRANSFER: "🏦",
  CHECK: "🧾",
};

export function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [reservationFilter, setReservationFilter] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    const [paymentsData, reservationsData, clientsData, carsData] = await Promise.all([
      getPayments(),
      getReservations(),
      getClients(),
      getCars(),
    ]);
    setPayments(paymentsData);
    setReservations(reservationsData);
    setClients(clientsData);
    setCars(carsData);
  }

  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const carsById = useMemo(() => new Map(cars.map((car) => [car.id, car])), [cars]);
  const reservationsById = useMemo(
    () => new Map(reservations.map((reservation) => [reservation.id, reservation])),
    [reservations],
  );

  const summaries = useMemo(
    () =>
      reservations.map((reservation): ReservationSummary => {
        const paid = sumPayments(payments, reservation.id, "RENTAL_PAYMENT");
        const remaining = Math.max(0, reservation.totalPrice - paid);
        const status =
          reservation.status === "CANCELLED" ? "Annulée" : paid <= 0 ? "Non payé" : remaining > 0 ? "Partiellement payé" : "Payé";

        return {
          car: carsById.get(reservation.carId),
          client: clientsById.get(reservation.clientId),
          secondClient: reservation.secondClientId ? clientsById.get(reservation.secondClientId) : undefined,
          paid,
          remaining,
          reservation,
          status,
        };
      }),
    [carsById, clientsById, payments, reservations],
  );

  const filteredPayments = useMemo(
    () =>
      [...payments]
        .filter((payment) => reservationFilter === 0 || payment.reservationId === reservationFilter)
        .sort((first, second) => {
          const dateDiff = new Date(second.paymentDate).getTime() - new Date(first.paymentDate).getTime();
          return dateDiff || second.id - first.id;
        }),
    [payments, reservationFilter],
  );

  const visibleSummaries = useMemo(
    () =>
      summaries
        .filter((summary) => reservationFilter === 0 || summary.reservation.id === reservationFilter)
        .sort((first, second) => second.remaining - first.remaining)
        .slice(0, 3),
    [reservationFilter, summaries],
  );

  const columns: ColumnDef<Payment>[] = [
    { header: "Client", cell: ({ row }) => <ClientCell client={getPaymentClient(row.original, reservationsById, clientsById)} /> },
    { header: "Voiture", cell: ({ row }) => <PaymentCarCell car={getPaymentCar(row.original, reservationsById, carsById)} /> },
    { header: "Montant", cell: ({ row }) => formatMoney(row.original.amount) },
    { header: "Type", cell: ({ row }) => paymentTypeLabels[row.original.type] },
    {
      header: "Méthode",
      cell: ({ row }) => (
        <span title={paymentMethodLabels[row.original.method]}>
          {paymentMethodIcons[row.original.method]} {paymentMethodLabels[row.original.method]}
        </span>
      ),
    },
    { header: "Date", cell: ({ row }) => formatDateTime(row.original.paymentDate) },
    {
      header: "Reçu",
      cell: ({ row }) => (
        <Button aria-label="Reçu" onClick={() => showReceipt(row.original)} size="icon" title="Reçu" variant="ghost">
          <ReceiptText className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  async function handleCreate(data: CreatePaymentDto) {
    try {
      const payment = await createPayment(data);
      setPayments((current) => [payment, ...current]);
      setOpen(false);
      showToast({ title: "Paiement ajouté", type: "success" });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Erreur paiement", type: "error" });
    }
  }

  function showReceipt(payment: Payment) {
    const reservation = reservationsById.get(payment.reservationId);
    const client = reservation ? clientsById.get(reservation.clientId) : undefined;
    const secondClient = reservation?.secondClientId ? clientsById.get(reservation.secondClientId) : undefined;
    const car = reservation ? carsById.get(reservation.carId) : undefined;

    showToast({
      message: `Client: ${client ? normalizeClientName(client.fullName) : "-"}${
        secondClient ? ` | 2e conducteur: ${normalizeClientName(secondClient.fullName)}` : ""
      } | Voiture: ${
        car ? formatCarName(car.brand, car.model) : "-"
      } | ${formatMoney(payment.amount)} | ${paymentMethodLabels[payment.method]}`,
      title: `Reçu paiement #${payment.id}`,
      type: "info",
    });
  }

  return (
    <>
      <PageHeader title="Paiements">
        <Dialog onOpenChange={setOpen} open={open}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Ajouter paiement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un paiement</DialogTitle>
            </DialogHeader>
            <PaymentForm cars={cars} clients={clients} onSubmit={handleCreate} payments={payments} reservations={reservations} />
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="mb-4 max-w-xl">
        <select
          className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
          onChange={(event) => setReservationFilter(Number(event.target.value))}
          value={reservationFilter}
        >
          <option value={0}>Toutes les réservations</option>
          {summaries.map((summary) => (
            <option key={summary.reservation.id} value={summary.reservation.id}>
              {getReservationLabel(summary)}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        {visibleSummaries.map((summary) => (
          <PaymentSummaryCard key={summary.reservation.id} summary={summary} />
        ))}
      </div>

      <DataTable columns={columns} data={filteredPayments} />
    </>
  );
}

function PaymentSummaryCard({ summary }: { summary: ReservationSummary }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>{summary.client ? normalizeClientName(summary.client.fullName) : "Client inconnu"}</CardTitle>
          {summary.secondClient && (
            <p className="mt-1 text-xs text-muted-foreground">2e conducteur : {normalizeClientName(summary.secondClient.fullName)}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">{formatSummaryCar(summary.car)}</p>
        </div>
        <PaymentStatus label={summary.status} />
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        <SummaryRow label="Période" value={formatShortPeriod(summary.reservation.startDate, summary.reservation.endDate)} />
        <SummaryRow label="Total dû" value={formatMoney(summary.reservation.totalPrice)} />
        <SummaryRow label="Total payé" value={formatMoney(summary.paid)} />
        <SummaryRow emphasized label="Reste" value={formatMoney(summary.remaining)} />
      </dl>
      {summary.reservation.status === "COMPLETED" && summary.remaining > 0 && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
          Location terminée : paiement complet attendu.
        </p>
      )}
      {summary.reservation.status === "CANCELLED" && (
        <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
          Réservation annulée : aucun paiement location attendu.
        </p>
      )}
    </Card>
  );
}

function PaymentStatus({ label }: { label: ReservationSummary["status"] }) {
  const className =
    label === "Payé"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : label === "Partiellement payé"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : label === "Annulée"
          ? "bg-slate-50 text-slate-700 ring-slate-200"
          : "bg-red-50 text-red-700 ring-red-200";

  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${className}`}>{label}</span>;
}

function SummaryRow({ emphasized, label, value }: { emphasized?: boolean; label: string; value: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${emphasized ? "border-t border-border pt-2 font-semibold" : ""}`}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function PaymentCarCell({ car }: { car?: Car }) {
  if (!car) return <span>-</span>;

  return (
    <div>
      <p className="font-medium">{formatCarName(car.brand, car.model)}</p>
      <p className="text-xs text-muted-foreground">({formatRegistrationNumber(car.registrationNumber)})</p>
    </div>
  );
}

function sumPayments(payments: Payment[], reservationId: number, type: Payment["type"]) {
  return payments
    .filter((payment) => payment.reservationId === reservationId && payment.type === type)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

function getPaymentClient(payment: Payment, reservationsById: Map<number, Reservation>, clientsById: Map<number, Client>) {
  const reservation = reservationsById.get(payment.reservationId);
  return reservation ? clientsById.get(reservation.clientId) : undefined;
}

function getPaymentCar(payment: Payment, reservationsById: Map<number, Reservation>, carsById: Map<number, Car>) {
  const reservation = reservationsById.get(payment.reservationId);
  return reservation ? carsById.get(reservation.carId) : undefined;
}

function getReservationLabel(summary: ReservationSummary) {
  const secondClient = summary.secondClient ? ` / 2e conducteur: ${normalizeClientName(summary.secondClient.fullName)}` : "";
  return `${summary.client ? normalizeClientName(summary.client.fullName) : "Client inconnu"}${secondClient} - ${formatSummaryCar(
    summary.car,
  )} - ${formatShortPeriod(summary.reservation.startDate, summary.reservation.endDate)}`;
}

function formatSummaryCar(car?: Car) {
  if (!car) return "Voiture inconnue";
  return `${formatCarName(car.brand, car.model)} (${formatRegistrationNumber(car.registrationNumber)})`;
}

function ClientCell({ client }: { client?: Client }) {
  if (!client) return <span>-</span>;

  return (
    <div>
      <p>{normalizeClientName(client.fullName)}</p>
      <p className="text-xs text-muted-foreground">{client.cin ? `CIN : ${client.cin}` : client.passportNumber ? `Passeport : ${client.passportNumber}` : "Pièce : -"}</p>
    </div>
  );
}

function getErrorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : String(caught);
}

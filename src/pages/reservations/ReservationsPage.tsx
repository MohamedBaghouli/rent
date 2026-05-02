import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  CalendarDays,
  CarFront,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/app/layout";
import { StatusBadge, getStatusLabel } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ReservationForm } from "@/pages/reservations/ReservationForm";
import { CalendarTimeGrid } from "@/pages/reservations/CalendarTimeGrid";
import { generateContract } from "@/services/contract.service";
import { getCars } from "@/services/car.service";
import { getClients } from "@/services/client.service";
import { getPayments } from "@/services/payment.service";
import {
  createReservation,
  deleteReservation,
  getReservations,
  updateReservation,
  updateReservationStatus,
} from "@/services/reservation.service";
import type { Car } from "@/types/car";
import type { Client } from "@/types/client";
import type { Payment } from "@/types/payment";
import type { CreateReservationDto, Reservation } from "@/types/reservation";
import { formatCarName, formatRegistrationNumber } from "@/utils/car";
import { formatPhoneNumber, normalizeClientName } from "@/utils/client";
import { formatDateTime, formatRentalDuration, getLocalDateKey, getStartOfWeek } from "@/utils/date";
import { formatMoney } from "@/utils/money";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/hooks/useToast";

const reservationStatuses: Array<"ALL" | Reservation["status"]> = [
  "ALL",
  "EN_ATTENTE",
  "RESERVED",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
];

const weekdays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const calendarEventTone: Record<Reservation["status"], string> = {
  CANCELLED: "bg-red-100 text-red-800 ring-red-200",
  COMPLETED: "bg-slate-100 text-slate-700 ring-slate-200",
  EN_ATTENTE: "bg-blue-100 text-blue-900 ring-blue-200",
  ONGOING: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  RESERVED: "bg-amber-100 text-amber-900 ring-amber-200",
};

export function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | Reservation["status"]>("ALL");
  const [carFilter, setCarFilter] = useState<number>(0);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarMode, setCalendarMode] = useState<"month" | "week">("month");
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateKey(new Date()));
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [weekStartDate, setWeekStartDate] = useState(() => getStartOfWeek(new Date()));
  const { push } = useNotifications();
  const { showToast } = useToast();

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
        const client = clientsById.get(reservation.clientId);
        const secondClient = reservation.secondClientId ? clientsById.get(reservation.secondClientId) : undefined;
        const car = carsById.get(reservation.carId);
        const matchesStatus = statusFilter === "ALL" || reservation.status === statusFilter;
        const matchesCar = carFilter === 0 || reservation.carId === carFilter;
        const haystack = `${client ? normalizeClientName(client.fullName) : ""} ${
          secondClient ? normalizeClientName(secondClient.fullName) : ""
        } ${car ? formatCarName(car.brand, car.model) : ""} ${car?.registrationNumber ?? ""} ${
          car ? formatRegistrationNumber(car.registrationNumber) : ""
        }`.toLowerCase();
        const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());

        return matchesStatus && matchesCar && matchesQuery;
      }),
    [carFilter, carsById, clientsById, query, reservations, statusFilter],
  );

  const stats = useMemo(
    () => ({
      cancelled: reservations.filter((reservation) => reservation.status === "CANCELLED").length,
      completed: reservations.filter((reservation) => reservation.status === "COMPLETED").length,
      ongoing: reservations.filter((reservation) => reservation.status === "ONGOING").length,
      upcoming: reservations.filter((reservation) => reservation.status === "EN_ATTENTE" || reservation.status === "RESERVED").length,
    }),
    [reservations],
  );
  const calendarDays = useMemo(() => buildCalendarDays(monthDate, selectedDate, calendarMode), [calendarMode, monthDate, selectedDate]);

  async function handleCreate(data: CreateReservationDto) {
    setError(null);
    try {
      const reservation = await createReservation(data);
      setReservations((current) => [reservation, ...current]);
      setOpen(false);
      setSelectedDate(getLocalDateKey(reservation.startDate));
      await reload();
      showToast({ title: "Réservation créée", type: "success" });
    } catch (caught) {
      const message = getErrorMessage(caught);
      setError(message);
      showToast({ message, title: "Erreur réservation", type: "error" });
    }
  }

  async function handleUpdate(data: CreateReservationDto) {
    if (!editingReservation) return;
    setError(null);
    try {
      const reservation = await updateReservation(editingReservation.id, data);
      setReservations((current) => current.map((item) => (item.id === reservation.id ? reservation : item)));
      setEditingReservation(null);
      setSelectedReservation(reservation);
      await reload();
      showToast({ title: "Réservation modifiée", type: "success" });
    } catch (caught) {
      const message = getErrorMessage(caught);
      setError(message);
      showToast({ message, title: "Modification impossible", type: "error" });
    }
  }

  async function handleStatus(id: number, status: Reservation["status"]) {
    try {
      const reservation = await updateReservationStatus(id, { status });

      if (status === "COMPLETED") {
        const { pickupMileage, returnMileage, carId } = reservation;
        if (
          returnMileage != null &&
          pickupMileage != null &&
          Math.floor(returnMileage / 10000) > Math.floor(pickupMileage / 10000)
        ) {
          const car = cars.find((item) => item.id === carId);
          const carName = car ? formatCarName(car.brand, car.model) : `Voiture #${carId}`;
          push({
            type: "mileage_threshold",
            message: `${carName} a dépassé ${Math.floor(returnMileage / 10000) * 10000} km. Vérifiez la révision.`,
            carId,
          });
        }
      }

      setReservations((current) => current.map((item) => (item.id === id ? reservation : item)));
      setSelectedReservation((current) => (current?.id === id ? reservation : current));
      await reload();
      showToast({ title: getStatusToastTitle(status), type: "success" });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Erreur statut", type: "error" });
    }
  }

  async function handleGenerateContract(reservationId: number) {
    try {
      await generateContract(reservationId);
      showToast({ message: "Consultez la page Contrats.", title: "Contrat généré", type: "success" });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Erreur contrat", type: "error" });
    }
  }

  async function handleDeleteReservation(reservation: Reservation) {
    if (!window.confirm("Supprimer cette réservation ? Les paiements et le contrat liés seront aussi supprimés.")) return;
    try {
      await deleteReservation(reservation.id);
      setSelectedReservation(null);
      setReservations((current) => current.filter((item) => item.id !== reservation.id));
      await reload();
      showToast({ title: "Réservation supprimée", type: "success" });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Suppression impossible", type: "error" });
    }
  }

  return (
    <>
      <PageHeader title="Réservations">
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

      <div className="mb-4 flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid min-w-0 gap-3 md:grid-cols-[220px_190px_minmax(260px,1fr)] xl:max-w-[900px] xl:flex-1">
          <FilterSelect statusFilter={statusFilter} setStatusFilter={setStatusFilter} />
          <Input
            className="h-10"
            onChange={(event) => {
              if (!event.target.value) return;
              setSelectedDate(event.target.value);
              setMonthDate(new Date(`${event.target.value}T00:00:00`));
            }}
            type="date"
            value={selectedDate}
          />
          <select
            className="h-10 rounded-md border border-input bg-white px-3 text-sm"
            onChange={(event) => setCarFilter(Number(event.target.value))}
            value={carFilter}
          >
            <option value={0}>Toutes les voitures</option>
            {cars.map((car) => (
              <option key={car.id} value={car.id}>
                {formatCarName(car.brand, car.model)} ({formatRegistrationNumber(car.registrationNumber)})
              </option>
            ))}
          </select>
        </div>
        <StatusLegend />
      </div>

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_560px]">
        <Card className="min-w-0 overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  if (calendarMode === "week") {
                    const prev = new Date(weekStartDate);
                    prev.setDate(prev.getDate() - 7);
                    setWeekStartDate(prev);
                    setSelectedDate(getLocalDateKey(prev));
                    setMonthDate(prev);
                    return;
                  }
                  setMonthDate(addMonths(monthDate, -1));
                }}
                size="icon"
                type="button"
                variant="outline"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="min-w-36 text-center text-lg font-semibold">
                {calendarMode === "week" ? formatWeekTitle(weekStartDate) : formatMonthTitle(monthDate)}
              </h3>
              <Button
                onClick={() => {
                  if (calendarMode === "week") {
                    const next = new Date(weekStartDate);
                    next.setDate(next.getDate() + 7);
                    setWeekStartDate(next);
                    setSelectedDate(getLocalDateKey(next));
                    setMonthDate(next);
                    return;
                  }
                  setMonthDate(addMonths(monthDate, 1));
                }}
                size="icon"
                type="button"
                variant="outline"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="inline-flex rounded-md border border-border bg-muted/50 p-1">
                {[
                  { label: "Mois", value: "month" },
                  { label: "Semaine", value: "week" },
                ].map((item) => (
                  <button
                    className={cn(
                      "h-8 rounded px-3 text-sm font-medium text-muted-foreground transition",
                      calendarMode === item.value && "bg-primary text-primary-foreground shadow-sm",
                    )}
                    key={item.value}
                    onClick={() => {
                      const nextMode = item.value as "month" | "week";
                      setCalendarMode(nextMode);
                      if (nextMode === "week") setWeekStartDate(getStartOfWeek(new Date(`${selectedDate}T00:00:00`)));
                    }}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <Button
                onClick={() => {
                  const today = new Date();
                  setMonthDate(today);
                  setWeekStartDate(getStartOfWeek(today));
                  setSelectedDate(getLocalDateKey(today));
                }}
                type="button"
                variant="outline"
              >
                Aujourd'hui
              </Button>
            </div>
          </div>

          {calendarMode === "week" ? (
            <CalendarTimeGrid
              reservations={filteredReservations}
              selectedDate={selectedDate}
              onSelectReservation={setSelectedReservation}
              weekStartDate={weekStartDate}
            />
          ) : (
            <CalendarGrid
              days={calendarDays}
              carsById={carsById}
              clientsById={clientsById}
              monthDate={monthDate}
              onSelectDate={setSelectedDate}
              reservations={filteredReservations}
              selectedDate={selectedDate}
              setSelectedReservation={setSelectedReservation}
            />
          )}
        </Card>

        <aside className="grid gap-4 xl:min-w-0">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon={CalendarDays} label="À venir" tone="blue" value={stats.upcoming} />
            <StatTile icon={Play} label="En cours" tone="green" value={stats.ongoing} />
            <StatTile icon={CalendarDays} label="Terminées" tone="slate" value={stats.completed} />
            <StatTile icon={Ban} label="Annulées" tone="red" value={stats.cancelled} />
          </div>

          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Liste des réservations</h3>
              <Button size="icon" type="button" variant="outline">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher (client, voiture...)"
                value={query}
              />
            </div>
            <div className="grid max-h-[680px] gap-3 overflow-y-auto pr-1">
              {filteredReservations.length ? (
                filteredReservations.map((reservation) => (
                  <ReservationListRow
                    car={carsById.get(reservation.carId)}
                    client={clientsById.get(reservation.clientId)}
                    key={reservation.id}
                    onClick={() => setSelectedReservation(reservation)}
                    payments={payments}
                    reservation={reservation}
                    secondClient={reservation.secondClientId ? clientsById.get(reservation.secondClientId) : undefined}
                  />
                ))
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Aucune réservation trouvée.</p>
              )}
            </div>
          </Card>
        </aside>
      </div>

      <ReservationDetailDialog
        car={selectedReservation ? carsById.get(selectedReservation.carId) : undefined}
        client={selectedReservation ? clientsById.get(selectedReservation.clientId) : undefined}
        secondClient={selectedReservation?.secondClientId ? clientsById.get(selectedReservation.secondClientId) : undefined}
        onGenerateContract={handleGenerateContract}
        onEdit={(reservation) => {
          setEditingReservation(reservation);
          setSelectedReservation(null);
          setError(null);
        }}
        onDelete={handleDeleteReservation}
        onOpenChange={(value) => !value && setSelectedReservation(null)}
        onStatusChange={handleStatus}
        open={Boolean(selectedReservation)}
        payments={payments}
        reservation={selectedReservation}
      />

      <Dialog
        onOpenChange={(value) => {
          if (!value) {
            setEditingReservation(null);
            setError(null);
          }
        }}
        open={Boolean(editingReservation)}
      >
        <DialogContent className="max-h-[92vh] w-[min(96vw,980px)] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Modifier la réservation</DialogTitle>
          </DialogHeader>
          {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {editingReservation && (
            <ReservationForm
              cars={cars}
              clients={clients}
              defaultValues={editingReservation}
              excludedReservationId={editingReservation.id}
              onSubmit={handleUpdate}
              reservations={reservations}
              submitLabel="Enregistrer la réservation"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FilterSelect({
  setStatusFilter,
  statusFilter,
}: {
  setStatusFilter: (status: "ALL" | Reservation["status"]) => void;
  statusFilter: "ALL" | Reservation["status"];
}) {
  return (
    <select
      className="h-10 rounded-md border border-input bg-white px-3 text-sm"
      onChange={(event) => setStatusFilter(event.target.value as "ALL" | Reservation["status"])}
      value={statusFilter}
    >
      {reservationStatuses.map((status) => (
        <option key={status} value={status}>
          {status === "ALL" ? "Tous les statuts" : getStatusLabel(status)}
        </option>
      ))}
    </select>
  );
}

function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
      <LegendItem color="bg-amber-500" label="À venir" />
      <LegendItem color="bg-blue-500" label="En cours" />
      <LegendItem color="bg-emerald-500" label="Confirmée" />
      <LegendItem color="bg-slate-400" label="Terminée" />
      <LegendItem color="bg-red-500" label="Annulée" />
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
      {label}
    </span>
  );
}

function CalendarGrid({
  carsById,
  clientsById,
  days,
  monthDate,
  onSelectDate,
  reservations,
  selectedDate,
  setSelectedReservation,
}: {
  carsById: Map<number, Car>;
  clientsById: Map<number, Client>;
  days: Date[];
  monthDate: Date;
  onSelectDate: (date: string) => void;
  reservations: Reservation[];
  selectedDate: string;
  setSelectedReservation: (reservation: Reservation) => void;
}) {
  const columnCount = 7;
  const headerLabels = weekdays;
  const eventSegments = buildMonthEventSegments(days, reservations);

  return (
    <div>
      <div className="grid border-b border-border" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
        {headerLabels.map((day) => (
          <div className="px-3 py-3 text-center text-sm font-medium text-muted-foreground" key={day}>
            {day}
          </div>
        ))}
      </div>
      <div className="grid relative" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
        {days.map((date, dayIndex) => {
          const dateKey = getLocalDateKey(date);
          const dayReservations = reservations.filter((reservation) => reservationTouchesDate(reservation, dateKey));
          const inMonth = date.getMonth() === monthDate.getMonth();
          const selected = selectedDate === dateKey;

          return (
            <button
              className={cn(
                "relative min-h-28 border-b border-r border-border bg-white p-2 text-left align-top transition hover:bg-blue-50/50",
                !inMonth && "bg-muted/30 text-muted-foreground",
                selected && "bg-blue-50 ring-2 ring-inset ring-primary",
              )}
              key={dateKey}
              onClick={() => onSelectDate(dateKey)}
              type="button"
            >
              <div className="mb-2 flex justify-between">
                <span className={cn("text-sm font-semibold", !inMonth && "font-normal")}>{String(date.getDate()).padStart(2, "0")}</span>
                {dayReservations.length > 2 && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {dayReservations.length} réservations
                    </span>
                  )}
              </div>
            </button>
          );
        })}
        <div
          className="pointer-events-none absolute inset-0 grid"
          style={{
            gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
            gridTemplateRows: "repeat(6, minmax(7rem, 1fr))",
          }}
        >
          {eventSegments.map((segment) => (
            <button
              className={cn(
                "pointer-events-auto z-10 mx-2 h-8 rounded-md px-3 text-left text-xs font-semibold shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md",
                calendarEventTone[segment.reservation.status],
              )}
              key={segment.key}
              onClick={() => setSelectedReservation(segment.reservation)}
              style={{
                gridColumn: `${segment.columnStart} / span ${segment.span}`,
                gridRow: segment.row + 1,
                marginTop: `${34 + segment.lane * 34}px`,
              }}
              type="button"
            >
              <span className="flex h-full min-w-0 items-center justify-between gap-2">
                <span className="min-w-0 truncate">
                  {formatCalendarReservationTitle(segment.reservation, carsById, clientsById)}
                </span>
                <span className="hidden shrink-0 items-center gap-1 opacity-80 xl:flex">
                  <Clock className="h-3 w-3" />
                  {segment.span > 1 ? formatEventDateSpan(segment.reservation) : formatTimeRange(segment.reservation)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReservationSideCard({
  car,
  client,
  onClick,
  payments,
  reservation,
  secondClient,
}: {
  car?: Car;
  client?: Client;
  onClick: () => void;
  payments: Payment[];
  reservation: Reservation;
  secondClient?: Client;
}) {
  const paid = sumPayments(payments, reservation.id, "RENTAL_PAYMENT");

  return (
    <button
      className="flex w-full gap-4 rounded-lg border border-border bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30"
      onClick={onClick}
      type="button"
    >
      <CarImage car={car} className="h-20 w-28 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{client ? normalizeClientName(client.fullName) : "Client inconnu"}</p>
            <p className="truncate text-xs text-muted-foreground">{formatClientIdentity(client)}</p>
            {secondClient && (
              <p className="truncate text-xs text-muted-foreground">
                2e conducteur : {normalizeClientName(secondClient.fullName)}
              </p>
            )}
          </div>
          <StatusBadge status={reservation.status} />
        </div>
        <p className="mt-2 truncate text-[1.05rem] font-semibold text-primary">{car ? formatCarName(car.brand, car.model) : "Voiture inconnue"}</p>
        <div className="mt-2 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span className="truncate">{formatCompactPeriod(reservation)}</span>
          <span className="shrink-0 font-semibold text-foreground">
            {formatMoney(paid)} / {formatMoney(reservation.totalPrice)}
          </span>
        </div>
      </div>
      <MoreHorizontal className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function ReservationListRow(props: {
  car?: Car;
  client?: Client;
  onClick: () => void;
  payments: Payment[];
  reservation: Reservation;
  secondClient?: Client;
}) {
  return <ReservationSideCard {...props} />;
}

function ReservationDetailDialog({
  car,
  client,
  onGenerateContract,
  onDelete,
  onEdit,
  onOpenChange,
  onStatusChange,
  open,
  payments,
  reservation,
  secondClient,
}: {
  car?: Car;
  client?: Client;
  onGenerateContract: (reservationId: number) => void | Promise<void>;
  onDelete: (reservation: Reservation) => void | Promise<void>;
  onEdit: (reservation: Reservation) => void;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (id: number, status: Reservation["status"]) => void | Promise<void>;
  open: boolean;
  payments: Payment[];
  reservation: Reservation | null;
  secondClient?: Client;
}) {
  if (!reservation) return null;

  const paid = sumPayments(payments, reservation.id, "RENTAL_PAYMENT");
  const depositCollected = sumPayments(payments, reservation.id, "DEPOSIT");
  const remaining = Math.max(0, reservation.totalPrice - paid);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="w-[min(94vw,760px)]">
        <DialogHeader>
          <DialogTitle>Détails de la réservation</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <InfoPanel icon={CalendarDays} title="Informations client">
            <p className="font-semibold">{client ? normalizeClientName(client.fullName) : "Client inconnu"}</p>
            <p>{formatPhoneNumber(client?.phone)}</p>
            <p>{formatClientIdentity(client)}</p>
            {secondClient && (
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">Deuxième conducteur</p>
                <p className="font-semibold">{normalizeClientName(secondClient.fullName)}</p>
                <p>{formatClientIdentity(secondClient)}</p>
              </div>
            )}
          </InfoPanel>

          <InfoPanel icon={CarFront} title="Informations véhicule">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{car ? formatCarName(car.brand, car.model) : "Voiture inconnue"}</p>
                <p>Plaque : {car ? formatRegistrationNumber(car.registrationNumber) : "-"}</p>
                <p>Catégorie : {car?.fuelType || "-"}</p>
              </div>
              <CarImage car={car} className="h-20 w-28" />
            </div>
          </InfoPanel>

          <InfoPanel icon={CalendarDays} title="Période de location">
            <div className="grid grid-cols-2 gap-4">
              <DetailValue label="Départ" value={formatDateTime(reservation.startDate)} />
              <DetailValue label="Retour" value={formatDateTime(reservation.endDate)} />
            </div>
            <p className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              {formatRentalDuration(reservation.startDate, reservation.endDate)}
            </p>
          </InfoPanel>

          <InfoPanel icon={FileText} title="Paiement">
            <DetailValue label="Total payé" value={`${formatMoney(paid)} / ${formatMoney(reservation.totalPrice)}`} />
            <DetailValue label="Reste à payer" value={formatMoney(remaining)} />
            <p className="mt-3">
              <StatusBadge status={remaining <= 0 ? "COMPLETED" : "EN_ATTENTE"} />
            </p>
          </InfoPanel>

          <InfoPanel icon={FileText} title="Caution">
            <DetailValue label="Montant" value={formatMoney(reservation.depositAmount)} />
            <DetailValue label="Statut" value={depositCollected > 0 ? "Encaissée" : "À encaisser"} />
          </InfoPanel>

          <InfoPanel icon={CalendarDays} title="Statut de la réservation">
            <StatusBadge status={reservation.status} />
            <p className="mt-3 text-xs text-muted-foreground">Créée le : {formatDateTime(reservation.createdAt)}</p>
          </InfoPanel>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button onClick={() => void onDelete(reservation)} type="button" variant="destructive">
            <Trash2 className="h-4 w-4" />
            Supprimer
          </Button>
          {(reservation.status === "EN_ATTENTE" || reservation.status === "RESERVED") && (
            <>
              <Button onClick={() => void onStatusChange(reservation.id, "CANCELLED")} type="button" variant="destructive">
                Annuler la réservation
              </Button>
              {reservation.status === "EN_ATTENTE" && (
                <Button onClick={() => onEdit(reservation)} type="button" variant="outline">
                  <Pencil className="h-4 w-4" />
                  Modifier
                </Button>
              )}
              <Button onClick={() => void onStatusChange(reservation.id, "ONGOING")} type="button">
                <Play className="h-4 w-4" />
                Démarrer
              </Button>
            </>
          )}
          {reservation.status !== "EN_ATTENTE" && (
            <Button onClick={() => void onGenerateContract(reservation.id)} type="button" variant="outline">
              Voir contrat
            </Button>
          )}
          <DialogClose asChild>
            <Button>Fermer</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoPanel({ children, icon: Icon, title }: { children: React.ReactNode; icon: typeof CalendarDays; title: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      {children}
    </div>
  );
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function StatTile({ icon: Icon, label, tone, value }: { icon: typeof CalendarDays; label: string; tone: string; value: number }) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-50 text-slate-700",
  }[tone];

  return (
    <Card className="flex items-center gap-4 p-4">
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-lg", toneClass)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold leading-none">{value}</p>
      </div>
    </Card>
  );
}

function CarImage({ car, className }: { car?: Car; className?: string }) {
  if (car?.imageUrl) {
    return <img alt={formatCarName(car.brand, car.model)} className={cn("rounded-md object-cover", className)} src={car.imageUrl} />;
  }

  return (
    <div className={cn("flex items-center justify-center rounded-md bg-muted text-4xl", className)} title="Image non renseignée">
      🚗
    </div>
  );
}

function buildCalendarDays(monthDate: Date, selectedDate: string, mode: "month" | "week") {
  const selected = new Date(`${selectedDate}T00:00:00`);

  if (mode === "week") {
    const firstDay = (selected.getDay() + 6) % 7;
    const start = new Date(selected);
    start.setDate(selected.getDate() - firstDay);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }

  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstDay = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - firstDay);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date);
}

function formatWeekTitle(startDate: Date) {
  const start = getStartOfWeek(startDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const formatter = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

type MonthEventSegment = {
  columnStart: number;
  key: string;
  lane: number;
  reservation: Reservation;
  row: number;
  span: number;
};

function buildMonthEventSegments(days: Date[], reservations: Reservation[]): MonthEventSegment[] {
  const rowLanes: Array<Array<Array<{ end: number; start: number }>>> = Array.from({ length: 6 }, () => []);
  const sortedReservations = [...reservations].sort(
    (first, second) => new Date(first.startDate).getTime() - new Date(second.startDate).getTime(),
  );

  return sortedReservations.flatMap((reservation) => {
    const touchedIndexes = days
      .map((day, index) => (reservationTouchesDate(reservation, getLocalDateKey(day)) ? index : -1))
      .filter((index) => index >= 0);

    if (!touchedIndexes.length) return [];

    const segments: MonthEventSegment[] = [];
    let segmentStart = touchedIndexes[0];
    const lastTouchedIndex = touchedIndexes[touchedIndexes.length - 1];

    while (segmentStart <= lastTouchedIndex) {
      const row = Math.floor(segmentStart / 7);
      const segmentEnd = Math.min(lastTouchedIndex, row * 7 + 6);
      const lane = getMonthEventLane(rowLanes[row], segmentStart, segmentEnd);

      segments.push({
        columnStart: (segmentStart % 7) + 1,
        key: `${reservation.id}-${segmentStart}`,
        lane,
        reservation,
        row,
        span: segmentEnd - segmentStart + 1,
      });

      segmentStart = segmentEnd + 1;
    }

    return segments;
  });
}

function getMonthEventLane(lanes: Array<Array<{ end: number; start: number }>>, start: number, end: number) {
  const laneIndex = lanes.findIndex((lane) => lane.every((range) => end < range.start || start > range.end));

  if (laneIndex >= 0) {
    lanes[laneIndex].push({ end, start });
    return laneIndex;
  }

  lanes.push([{ end, start }]);
  return lanes.length - 1;
}

function formatEventDateSpan(reservation: Reservation) {
  const formatter = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" });
  return `${formatter.format(new Date(reservation.startDate))}-${formatter.format(new Date(reservation.endDate))}`;
}

function reservationTouchesDate(reservation: Reservation, dateKey: string) {
  const startKey = getLocalDateKey(reservation.startDate);
  const endKey = getLocalDateKey(reservation.endDate);
  return dateKey >= startKey && dateKey <= endKey;
}

function formatTimeRange(reservation: Reservation) {
  const start = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(reservation.startDate));
  const end = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(reservation.endDate));
  return `${start} -> ${end}`;
}

function formatCalendarReservationTitle(
  reservation: Reservation,
  carsById: Map<number, Car>,
  clientsById: Map<number, Client>,
) {
  const car = carsById.get(reservation.carId);
  const client = clientsById.get(reservation.clientId);

  if (car) return formatCarName(car.brand, car.model);
  if (client) return normalizeClientName(client.fullName);
  return `Réservation #${reservation.id}`;
}

function formatCompactPeriod(reservation: Reservation) {
  return `${formatDateTime(reservation.startDate)} -> ${formatDateTime(reservation.endDate)}`;
}

function formatClientIdentity(client?: Client) {
  if (!client) return "Pièce : -";
  if (client.cin) return `CIN : ${client.cin}`;
  if (client.passportNumber) return `Passeport : ${client.passportNumber}`;
  return "Pièce : -";
}

function sumPayments(payments: Payment[], reservationId: number, type: Payment["type"]) {
  return payments
    .filter((payment) => payment.reservationId === reservationId && payment.type === type)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

function getStatusToastTitle(status: Reservation["status"]) {
  const labels: Record<Reservation["status"], string> = {
    CANCELLED: "Réservation annulée",
    COMPLETED: "Location terminée",
    EN_ATTENTE: "Réservation mise en attente",
    ONGOING: "Location démarrée",
    RESERVED: "Réservation confirmée",
  };

  return labels[status];
}

function getErrorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : String(caught);
}

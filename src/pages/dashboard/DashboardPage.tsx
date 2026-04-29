import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Banknote, CalendarDays, CarFront, Gauge, Wrench } from "lucide-react";
import { PageHeader } from "@/app/layout";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import type { Car } from "@/types/car";
import type { Payment } from "@/types/payment";
import type { Reservation } from "@/types/reservation";
import { getCars } from "@/services/car.service";
import { getPayments } from "@/services/payment.service";
import { getReservations } from "@/services/reservation.service";
import { cn } from "@/lib/utils";
import { formatCarName } from "@/utils/car";
import { formatDate, getLocalDateKey } from "@/utils/date";
import { formatMoney } from "@/utils/money";

type AlertItem = {
  car: Car;
  label: string;
  date?: string | null;
  tone: "warning" | "danger";
};

export function DashboardPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    void Promise.all([getCars(), getReservations(), getPayments()]).then(([carsData, reservationsData, paymentsData]) => {
      setCars(carsData);
      setReservations(reservationsData);
      setPayments(paymentsData);
    });
  }, []);

  const todayKey = getDateKey(new Date());
  const currentMonthKey = todayKey.slice(0, 7);
  const previousMonthKey = getPreviousMonthKey(currentMonthKey);

  const stats = useMemo(() => {
    const availableCars = cars.filter((car) => car.status === "AVAILABLE").length;
    const rentedCars = cars.filter((car) => car.status === "RENTED").length;
    const maintenanceCars = cars.filter((car) => car.status === "MAINTENANCE").length;
    const ongoingReservations = reservations.filter((reservation) => reservation.status === "ONGOING").length;
    const upcomingReservations = reservations.filter(
      (reservation) => reservation.status === "RESERVED" && getLocalDateKey(reservation.startDate) > todayKey,
    ).length;
    const departuresToday = reservations.filter(
      (reservation) => reservation.status !== "CANCELLED" && getLocalDateKey(reservation.startDate) === todayKey,
    ).length;
    const returnsToday = reservations.filter(
      (reservation) => reservation.status === "ONGOING" && getLocalDateKey(reservation.endDate) === todayKey,
    ).length;
    const startsToday = reservations.filter(
      (reservation) => reservation.status !== "CANCELLED" && getLocalDateKey(reservation.startDate) === todayKey,
    ).length;
    const currentMonthRevenue = sumRentalPaymentsByMonth(payments, currentMonthKey);
    const previousMonthRevenue = sumRentalPaymentsByMonth(payments, previousMonthKey);
    const revenueTrend =
      previousMonthRevenue > 0 ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 : null;
    const alerts = getAlerts(cars, todayKey);

    return {
      alerts,
      availableCars,
      currentMonthRevenue,
      departuresToday,
      maintenanceCars,
      ongoingReservations,
      rentedCars,
      returnsToday,
      revenueTrend,
      startsToday,
      totalCars: cars.length,
      upcomingReservations,
    };
  }, [cars, currentMonthKey, payments, previousMonthKey, reservations, todayKey]);

  const insuranceAlerts = stats.alerts.filter((alert) => alert.label.includes("Assurance")).length;
  const technicalVisitAlerts = stats.alerts.filter((alert) => alert.label.includes("Visite")).length;

  return (
    <>
      <PageHeader title="Tableau de bord" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard href="/cars" icon={CarFront} label="Total des voitures" tone="info" value={stats.totalCars} />
        <StatCard href="/cars?status=available" icon={Gauge} label="Voitures disponibles" tone="success" value={stats.availableCars} />
        <StatCard href="/reservations?status=ongoing" icon={CalendarDays} label="Locations en cours" tone="info" value={stats.ongoingReservations} />
        <StatCard href="/reservations?status=reserved" icon={CalendarDays} label="Réservations à venir" tone="warning" value={stats.upcomingReservations} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Revenus du mois</CardTitle>
            <Banknote className="h-5 w-5 text-muted-foreground" />
          </div>
          <CardValue>{formatMoney(stats.currentMonthRevenue)}</CardValue>
          <p className="mt-1 text-sm text-muted-foreground">Payé : {formatMoney(stats.currentMonthRevenue)}</p>
          <p className={cn("mt-2 text-sm font-medium", getTrendClassName(stats.revenueTrend))}>
            {formatTrend(stats.revenueTrend)} vs mois dernier
          </p>
        </Card>

        <Card>
          <CardTitle>Aujourd'hui</CardTitle>
          <div className="mt-4 space-y-2 text-sm">
            <TodayRow label="Départs prévus" value={stats.departuresToday} />
            <TodayRow label="Retours prévus" value={stats.returnsToday} />
            <TodayRow label="Réservations début aujourd'hui" value={stats.startsToday} />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>État flotte</CardTitle>
          <div className="mt-4 space-y-2 text-sm">
            <TodayRow label="Disponibles" value={stats.availableCars} />
            <TodayRow label="Louées" value={stats.rentedCars} />
            <TodayRow label="Maintenance" value={stats.maintenanceCars} />
          </div>
        </Card>

        <Link to="/cars?alert=documents">
          <Card className="h-full border-red-200 bg-red-50/60 transition hover:bg-red-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-red-700">Alertes</CardTitle>
              <AlertTriangle className="h-5 w-5 text-red-700" />
            </div>
            <CardValue>{stats.alerts.length}</CardValue>
            <div className="mt-3 space-y-1 text-sm text-red-800">
              <p>{insuranceAlerts} assurances à expirer</p>
              <p>{technicalVisitAlerts} visites techniques</p>
            </div>
          </Card>
        </Link>

        <Card>
          <CardTitle>Priorités</CardTitle>
          <div className="mt-4 space-y-3">
            {stats.alerts.slice(0, 3).length ? (
              stats.alerts.slice(0, 3).map((alert) => <AlertRow alert={alert} key={`${alert.car.id}-${alert.label}`} />)
            ) : (
              <p className="text-sm text-muted-foreground">Aucune alerte critique.</p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

function StatCard({
  href,
  icon: Icon,
  label,
  tone,
  value,
}: {
  href: string;
  icon: typeof CarFront;
  label: string;
  tone: "success" | "warning" | "info";
  value: number;
}) {
  const toneClassName = {
    info: "border-blue-200 bg-blue-50/60 text-blue-900 hover:bg-blue-50",
    success: "border-emerald-200 bg-emerald-50/60 text-emerald-900 hover:bg-emerald-50",
    warning: "border-amber-200 bg-amber-50/60 text-amber-900 hover:bg-amber-50",
  }[tone];

  return (
    <Link to={href}>
      <Card className={cn("h-full transition", toneClassName)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-current">{label}</CardTitle>
          <Icon className="h-5 w-5 opacity-75" />
        </div>
        <CardValue>{value}</CardValue>
      </Card>
    </Link>
  );
}

function TodayRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function AlertRow({ alert }: { alert: AlertItem }) {
  const className = alert.tone === "danger" ? "text-red-700" : "text-amber-700";

  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <div className={cn("flex items-center gap-2 font-medium", className)}>
        <AlertTriangle className="h-4 w-4" />
        {formatCarName(alert.car.brand, alert.car.model)}
      </div>
      <p className="mt-1 text-muted-foreground">
        {alert.label}
        {alert.date ? ` le ${formatDate(alert.date)}` : ""}
      </p>
    </div>
  );
}

function sumRentalPaymentsByMonth(payments: Payment[], monthKey: string) {
  return payments
    .filter((payment) => payment.type === "RENTAL_PAYMENT" && payment.paymentDate.slice(0, 7) === monthKey)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

function getAlerts(cars: Car[], todayKey: string): AlertItem[] {
  return cars.flatMap((car) => {
    const alerts: AlertItem[] = [];

    if (isDueSoon(car.insuranceExpiryDate, todayKey)) {
      alerts.push({ car, date: car.insuranceExpiryDate, label: "Assurance expire", tone: "warning" });
    }

    if (isExpired(car.technicalVisitExpiryDate, todayKey)) {
      alerts.push({ car, date: car.technicalVisitExpiryDate, label: "Visite technique expirée", tone: "danger" });
    } else if (isDueSoon(car.technicalVisitExpiryDate, todayKey)) {
      alerts.push({ car, date: car.technicalVisitExpiryDate, label: "Visite technique expire", tone: "warning" });
    }

    return alerts;
  });
}

function isDueSoon(value: string | null | undefined, todayKey: string) {
  if (!value) return false;

  const days = daysBetween(todayKey, value.slice(0, 10));
  return days >= 0 && days <= 30;
}

function isExpired(value: string | null | undefined, todayKey: string) {
  if (!value) return false;
  return value.slice(0, 10) < todayKey;
}

function daysBetween(startKey: string, endKey: string) {
  const start = new Date(`${startKey}T00:00:00`);
  const end = new Date(`${endKey}T00:00:00`);
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function getDateKey(date: Date) {
  return getLocalDateKey(date);
}

function getPreviousMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
}

function formatTrend(value: number | null) {
  if (value === null) return "Nouvelle base";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${Math.round(value)}%`;
}

function getTrendClassName(value: number | null) {
  if (value === null) return "text-muted-foreground";
  return value >= 0 ? "text-emerald-700" : "text-red-700";
}

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, CheckCircle2, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/app/layout";
import { DataTable } from "@/components/DataTable";
import { getStatusLabel, StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CarForm } from "@/pages/cars/CarForm";
import { createCar, deleteCar, getCars, updateCar } from "@/services/car.service";
import { getReservations, updateReservationStatus } from "@/services/reservation.service";
import type { Car, CarStatus, CreateCarDto } from "@/types/car";
import type { Reservation } from "@/types/reservation";
import {
  formatCarName,
  formatRegistrationNumber,
  isValidRegistrationNumber,
  normalizeCarBrand,
  normalizeCarModel,
  normalizeRegistrationNumber,
} from "@/utils/car";
import { formatShortPeriod } from "@/utils/date";
import { formatMoney } from "@/utils/money";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/hooks/useToast";

const statuses: Array<"ALL" | CarStatus> = ["ALL", "AVAILABLE", "RENTED", "MAINTENANCE", "UNAVAILABLE"];
const fuelLevels = ["Plein", "3/4", "1/2", "1/4", "Vide"];

export function CarsPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | CarStatus>("ALL");
  const [open, setOpen] = useState(false);
  const [editingCar, setEditingCar] = useState<Car | null>(null);
  const [detailsCar, setDetailsCar] = useState<Car | null>(null);
  const [retourCar, setRetourCar] = useState<Car | null>(null);
  const [retourMileage, setRetourMileage] = useState<string>("");
  const [retourFuel, setRetourFuel] = useState<string>("Plein");
  const { push } = useNotifications();
  const { showToast } = useToast();

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    const [carsData, reservationsData] = await Promise.all([getCars(), getReservations()]);
    setCars(carsData);
    setReservations(reservationsData);

    // Check insurance and visite technique for all cars
    const today = Date.now();
    const soon = today + 30 * 24 * 60 * 60 * 1000;
    for (const car of carsData) {
      const carName = formatCarName(car.brand, car.model);

      if (car.insuranceExpiryDate) {
        const t = new Date(car.insuranceExpiryDate).getTime();
        if (Number.isFinite(t)) {
          if (t < today) {
            push({ type: "insurance_expired", message: `${carName} : assurance expirée.`, carId: car.id });
          } else if (t <= soon) {
            push({ type: "insurance_soon", message: `${carName} : assurance expire bientôt.`, carId: car.id });
          }
        }
      }

      if (car.technicalVisitExpiryDate) {
        const t = new Date(car.technicalVisitExpiryDate).getTime();
        if (Number.isFinite(t)) {
          if (t < today) {
            push({ type: "technical_visit_expired", message: `${carName} : visite technique expirée.`, carId: car.id });
          } else if (t <= soon) {
            push({ type: "technical_visit_soon", message: `${carName} : visite technique expire bientôt.`, carId: car.id });
          }
        }
      }
    }
  }

  const filteredCars = useMemo(
    () =>
      cars.filter((car) => {
        const matchesSearch = `${formatCarName(car.brand, car.model)} ${car.registrationNumber} ${formatRegistrationNumber(car.registrationNumber)}`.toLowerCase().includes(query.toLowerCase());
        const matchesStatus = status === "ALL" || car.status === status;
        return matchesSearch && matchesStatus;
      }),
    [cars, query, status],
  );

  const ongoingByCarId = useMemo(
    () =>
      new Map(
        reservations
          .filter((r) => r.status === "ONGOING")
          .map((r) => [r.carId, r]),
      ),
    [reservations],
  );

  const columns: ColumnDef<Car>[] = [
    { header: "Immatriculation", cell: ({ row }) => <RegistrationNumber value={row.original.registrationNumber} /> },
    { header: "Voiture", cell: ({ row }) => formatCarName(row.original.brand, row.original.model) },
    { accessorKey: "fuelType", header: "Carburant" },
    { header: "Prix/jour", cell: ({ row }) => formatMoney(row.original.dailyPrice) },
    { header: "Kilométrage", cell: ({ row }) => formatMileage(row.original.mileage) },
    { header: "Alertes", cell: ({ row }) => <CarAlerts car={row.original} /> },
    { header: "Statut", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      header: "Actions",
      cell: ({ row }) => {
        const car = row.original;
        return (
          <div className="flex gap-1">
            <Button aria-label="Voir" onClick={() => setDetailsCar(car)} size="icon" title="Voir" variant="ghost">
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              aria-label="Modifier"
              onClick={() => {
                setEditingCar(car);
                setOpen(true);
              }}
              size="icon"
              title="Modifier"
              variant="ghost"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button aria-label="Supprimer" onClick={() => handleDelete(car.id)} size="icon" title="Supprimer" variant="ghost">
              <Trash2 className="h-4 w-4" />
            </Button>
            {car.status === "RENTED" && ongoingByCarId.has(car.id) && (
              <Button
                aria-label="Retour voiture"
                className="rounded-full px-3 text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => {
                  setRetourCar(car);
                  setRetourMileage("");
                  setRetourFuel("Plein");
                }}
                size="sm"
                title="Enregistrer le retour"
                variant="ghost"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Retour
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  async function handleSubmit(data: CreateCarDto) {
    try {
      const normalized = normalizeCarPayload(data);
      if (editingCar) {
        const oldMileage = editingCar.mileage ?? 0;
        const newMileage = normalized.mileage ?? 0;
        const car = await updateCar(editingCar.id, normalized);

        // Mileage threshold notification
        if (newMileage > oldMileage && Math.floor(newMileage / 10000) > Math.floor(oldMileage / 10000)) {
          const threshold = Math.floor(newMileage / 10000) * 10000;
          push({
            type: "mileage_threshold",
            message: `${formatCarName(car.brand, car.model)} a dépassé ${threshold} km. Vérifiez la révision.`,
            carId: car.id,
          });
        }

        setCars((current) => current.map((item) => (item.id === car.id ? car : item)));
        showToast({ title: "Voiture modifiée", type: "success" });
      } else {
        const car = await createCar(normalized);
        setCars((current) => [car, ...current]);
        showToast({ title: "Voiture ajoutée", type: "success" });
      }
      setEditingCar(null);
      setOpen(false);
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Erreur voiture", type: "error" });
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Supprimer cette voiture ?")) return;
    try {
      await deleteCar(id);
      setCars((current) => current.filter((car) => car.id !== id));
      showToast({ title: "Voiture supprimée", type: "success" });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Suppression impossible", type: "error" });
    }
  }

  async function handleRetour() {
    if (!retourCar) return;
    const reservation = ongoingByCarId.get(retourCar.id);
    if (!reservation) return;

    const mileage = retourMileage.trim() ? Number(retourMileage) : undefined;

    // Mileage threshold check
    if (mileage != null && reservation.pickupMileage != null) {
      if (Math.floor(mileage / 10000) > Math.floor(reservation.pickupMileage / 10000)) {
        const threshold = Math.floor(mileage / 10000) * 10000;
        push({
          type: "mileage_threshold",
          message: `${formatCarName(retourCar.brand, retourCar.model)} a dépassé ${threshold} km. Vérifiez la révision.`,
          carId: retourCar.id,
        });
      }
    }

    try {
      await updateReservationStatus(reservation.id, {
        status: "COMPLETED",
        returnMileage: mileage,
        returnFuelLevel: retourFuel,
      });

      setRetourCar(null);
      await reload();
      showToast({ title: "Retour enregistré", type: "success" });
    } catch (caught) {
      showToast({ message: getErrorMessage(caught), title: "Erreur retour", type: "error" });
    }
  }

  const detailsHistory = reservations.filter((reservation) => reservation.carId === detailsCar?.id);

  return (
    <>
      <PageHeader title="Voitures">
        <Dialog
          onOpenChange={(value) => {
            setOpen(value);
            if (!value) setEditingCar(null);
          }}
          open={open}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Ajouter voiture
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92vh] w-[min(96vw,920px)] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>{editingCar ? "Modifier une voiture" : "Ajouter une voiture"}</DialogTitle>
            </DialogHeader>
            <CarForm
              currentCarId={editingCar?.id}
              defaultValues={editingCar ? carToForm(editingCar) : undefined}
              existingCars={cars}
              onSubmit={handleSubmit}
            />
          </DialogContent>
        </Dialog>
      </PageHeader>
      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(240px,420px)_220px]">
        <Input onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher (immatriculation, marque, modèle)" value={query} />
        <select className="h-10 rounded-md border border-input bg-white px-3 text-sm" onChange={(event) => setStatus(event.target.value as "ALL" | CarStatus)} value={status}>
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item === "ALL" ? "Tous les statuts" : getStatusLabel(item)}
            </option>
          ))}
        </select>
      </div>
      <DataTable columns={columns} data={filteredCars} />

      {/* Car details dialog */}
      <Dialog onOpenChange={(value) => !value && setDetailsCar(null)} open={Boolean(detailsCar)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Historique de location</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {formatCarName(detailsCar?.brand, detailsCar?.model)} - {formatRegistrationNumber(detailsCar?.registrationNumber)}
            </p>
            {detailsHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune location pour cette voiture.</p>
            ) : (
              detailsHistory.map((reservation) => (
                <div className="rounded-md border border-border p-3 text-sm" key={reservation.id}>
                  <div className="flex items-center justify-between">
                    <span>Reservation #{reservation.id}</span>
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

      {/* Retour voiture dialog */}
      <Dialog onOpenChange={(value) => !value && setRetourCar(null)} open={Boolean(retourCar)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retour voiture</DialogTitle>
          </DialogHeader>
          {retourCar && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {formatCarName(retourCar.brand, retourCar.model)} - {formatRegistrationNumber(retourCar.registrationNumber)}
              </p>
              <div>
                <Label>Kilométrage retour (km)</Label>
                <Input
                  min={retourCar.mileage ?? 0}
                  onChange={(e) => setRetourMileage(e.target.value)}
                  placeholder={`Ex: ${(retourCar.mileage ?? 0) + 500}`}
                  type="number"
                  value={retourMileage}
                />
              </div>
              <div>
                <Label>Niveau carburant au retour</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                  onChange={(e) => setRetourFuel(e.target.value)}
                  value={retourFuel}
                >
                  {fuelLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={() => setRetourCar(null)} type="button" variant="outline">
                  Annuler
                </Button>
                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => void handleRetour()}
                  type="button"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmer retour
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function normalizeCarPayload(data: CreateCarDto): CreateCarDto {
  return {
    ...data,
    brand: normalizeCarBrand(data.brand),
    model: normalizeCarModel(data.model),
    registrationNumber: normalizeRegistrationNumber(data.registrationNumber),
    year: Number.isFinite(data.year) ? data.year : null,
    mileage: Number.isFinite(data.mileage) ? data.mileage : null,
    imageUrl: data.imageUrl || null,
    insuranceExpiryDate: data.insuranceExpiryDate || null,
    technicalVisitExpiryDate: data.technicalVisitExpiryDate || null,
  };
}

function carToForm(car: Car): CreateCarDto {
  return {
    brand: car.brand,
    model: car.model,
    registrationNumber: car.registrationNumber,
    year: car.year,
    fuelType: car.fuelType,
    transmission: car.transmission,
    dailyPrice: car.dailyPrice,
    status: car.status,
    mileage: car.mileage,
    imageUrl: car.imageUrl ?? null,
    insuranceExpiryDate: car.insuranceExpiryDate?.slice(0, 10) ?? null,
    technicalVisitExpiryDate: car.technicalVisitExpiryDate?.slice(0, 10) ?? null,
  };
}

function CarAlerts({ car }: { car: Car }) {
  const alerts = [
    getDateAlert(car.insuranceExpiryDate, "Assurance"),
    getDateAlert(car.technicalVisitExpiryDate, "Visite"),
  ].filter((alert): alert is DateAlert => Boolean(alert));

  if (!alerts.length) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {alerts.map((alert) => (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200"
          key={alert.label}
          title={alert.title}
        >
          <AlertTriangle className="h-3 w-3" />
          {alert.label}
        </span>
      ))}
    </div>
  );
}

function getDateAlert(value: string | null | undefined, label: string) {
  if (!value) return null;
  const time = new Date(value).getTime();
  const now = Date.now();
  if (!Number.isFinite(time)) return null;
  if (time < now) return { label, title: `${label} expirée` };
  if (time <= now + 30 * 24 * 60 * 60 * 1000) return { label, title: `${label} expire bientôt` };
  return null;
}

type DateAlert = {
  label: string;
  title: string;
};

function formatMileage(value?: number | null) {
  if (!Number.isFinite(value)) return "-";
  return `${new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 }).format(Number(value))} km`;
}

function getErrorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : String(caught);
}

function RegistrationNumber({ value }: { value: string }) {
  const normalized = normalizeRegistrationNumber(value);

  if (isValidRegistrationNumber(normalized)) return <span>{formatRegistrationNumber(normalized)}</span>;

  return (
    <span className="font-medium text-destructive" title={`Valeur actuelle : ${value}`}>
      Format invalide
    </span>
  );
}

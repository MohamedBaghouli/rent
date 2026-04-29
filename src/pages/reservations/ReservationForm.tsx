import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Car } from "@/types/car";
import type { Client } from "@/types/client";
import type { CreateReservationDto, Reservation } from "@/types/reservation";
import { formatCarName } from "@/utils/car";
import { normalizeClientName } from "@/utils/client";
import { combineDateAndTime, formatDateTime, formatRentalDuration, getLocalDateKey, getRentalDays } from "@/utils/date";
import { formatMoney } from "@/utils/money";

type ReservationFormProps = {
  onSubmit: (data: CreateReservationDto) => void | Promise<void>;
  cars: Car[];
  clients: Client[];
  reservations: Reservation[];
};

type ReservationFormValues = CreateReservationDto & {
  pickupTime: string;
  returnTime: string;
};

type CarAvailability = {
  available: boolean;
  bookedOnPeriod: boolean;
  technicalVisitExpired: boolean;
  unavailableStatus: boolean;
};

const selectClassName = "h-10 w-full rounded-md border border-input bg-white px-3 text-sm";
const activeReservationStatuses: Reservation["status"][] = ["RESERVED", "ONGOING"];

export function ReservationForm({ onSubmit, cars, clients, reservations }: ReservationFormProps) {
  const today = getLocalDateKey(new Date());
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { dirtyFields, errors },
  } = useForm<ReservationFormValues>({
    defaultValues: {
      clientId: 0,
      carId: 0,
      startDate: today,
      endDate: today,
      pickupTime: "09:00",
      returnTime: "09:00",
      dailyPrice: 0,
      totalPrice: 0,
      depositAmount: 0,
      status: "RESERVED",
    },
  });

  const clientId = Number(watch("clientId"));
  const carId = Number(watch("carId"));
  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const pickupTime = watch("pickupTime");
  const returnTime = watch("returnTime");
  const dailyPrice = Number(watch("dailyPrice"));
  const depositAmount = Number(watch("depositAmount"));
  const startDateTime = combineDateAndTime(startDate, pickupTime);
  const endDateTime = combineDateAndTime(endDate, returnTime);

  const selectedClient = useMemo(() => clients.find((client) => client.id === clientId), [clientId, clients]);
  const selectedCar = useMemo(() => cars.find((car) => car.id === carId), [carId, cars]);
  const dateRangeIsValid = Boolean(startDateTime && endDateTime && new Date(endDateTime).getTime() > new Date(startDateTime).getTime());
  const rentalDays = dateRangeIsValid ? getRentalDays(startDateTime, endDateTime) : 0;
  const totalPrice = rentalDays * dailyPrice;

  const availabilityByCar = useMemo(() => {
    return new Map(cars.map((car) => [car.id, getCarAvailability(car, startDateTime, endDateTime, reservations)]));
  }, [cars, endDateTime, reservations, startDateTime]);

  const sortedCars = useMemo(
    () =>
      [...cars].sort((first, second) => {
        const firstAvailable = availabilityByCar.get(first.id)?.available ?? false;
        const secondAvailable = availabilityByCar.get(second.id)?.available ?? false;

        if (firstAvailable !== secondAvailable) return firstAvailable ? -1 : 1;
        return formatCarName(first.brand, first.model).localeCompare(formatCarName(second.brand, second.model));
      }),
    [availabilityByCar, cars],
  );

  const selectedCarAvailability = selectedCar ? availabilityByCar.get(selectedCar.id) : undefined;

  useEffect(() => {
    if (!selectedCar) {
      setValue("dailyPrice", 0, { shouldValidate: true });
      setValue("depositAmount", 0, { shouldValidate: true });
      return;
    }

    setValue("dailyPrice", selectedCar.dailyPrice, { shouldValidate: true });
    setValue("depositAmount", getSuggestedDeposit(selectedCar.dailyPrice), { shouldValidate: true });
  }, [selectedCar, setValue]);

  useEffect(() => {
    setValue("totalPrice", totalPrice, { shouldValidate: true });
  }, [setValue, totalPrice]);

  useEffect(() => {
    if (startDate && (!endDate || endDate < startDate)) {
      setValue("endDate", startDate, { shouldDirty: true, shouldValidate: true });
    }
  }, [endDate, setValue, startDate]);

  useEffect(() => {
    if (pickupTime && !dirtyFields.returnTime) {
      setValue("returnTime", pickupTime, { shouldValidate: true });
    }
  }, [dirtyFields.returnTime, pickupTime, setValue]);

  useEffect(() => {
    if (carId > 0 && dateRangeIsValid) void trigger("carId");
  }, [carId, dateRangeIsValid, trigger]);

  function submitForm(data: ReservationFormValues) {
    const { pickupTime: _pickupTime, returnTime: _returnTime, ...reservation } = data;

    return onSubmit({
      ...reservation,
      carId: Number(data.carId),
      clientId: Number(data.clientId),
      startDate: startDateTime,
      endDate: endDateTime,
      dailyPrice: Number(data.dailyPrice),
      depositAmount: Number(data.depositAmount),
      totalPrice,
    });
  }

  function setToday(field: "startDate" | "endDate") {
    const value = getLocalDateKey(new Date());
    setValue(field, value, { shouldDirty: true, shouldValidate: true });

    if (field === "startDate" && (!endDate || endDate < value)) {
      setValue("endDate", value, { shouldDirty: true, shouldValidate: true });
    }
  }

  return (
    <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit(submitForm)}>
      <div>
        <Label>Client</Label>
        <select
          className={selectClassName}
          {...register("clientId", {
            valueAsNumber: true,
            validate: (value) => Number(value) > 0 || "Sélectionnez un client.",
          })}
        >
          <option value={0}>Sélectionner</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {normalizeClientName(client.fullName)}
            </option>
          ))}
        </select>
        {errors.clientId && <p className="mt-1 text-xs text-destructive">{errors.clientId.message}</p>}
      </div>

      <div>
        <Label>Voiture disponible</Label>
        <select
          className={selectClassName}
          {...register("carId", {
            valueAsNumber: true,
            validate: (value) => validateCarSelection(Number(value), availabilityByCar),
          })}
        >
          <option value={0}>Sélectionner</option>
          {sortedCars.map((car) => {
            const availability = availabilityByCar.get(car.id);
            const available = availability?.available ?? false;

            return (
              <option disabled={!available} key={car.id} value={car.id}>
                {formatCarName(car.brand, car.model)} - {car.registrationNumber} ({available ? "Disponible" : "Non disponible"})
              </option>
            );
          })}
        </select>
        {selectedCarAvailability?.bookedOnPeriod && (
          <p className="mt-1 text-xs text-destructive">Cette voiture est déjà réservée sur cette période.</p>
        )}
        {selectedCarAvailability?.technicalVisitExpired && (
          <p className="mt-1 text-xs text-destructive">La visite technique est expirée pour cette période.</p>
        )}
        {selectedCarAvailability?.unavailableStatus && (
          <p className="mt-1 text-xs text-destructive">Cette voiture est en maintenance ou indisponible.</p>
        )}
        {errors.carId && <p className="mt-1 text-xs text-destructive">{errors.carId.message}</p>}
      </div>

      <div className="grid gap-3 lg:col-span-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0">
          <div className="mb-1 flex items-center justify-between gap-3">
            <Label>Date début</Label>
            <Button onClick={() => setToday("startDate")} size="sm" type="button" variant="outline">
              Aujourd'hui
            </Button>
          </div>
          <Input
            type="date"
            {...register("startDate", {
              required: "Sélectionnez une date de début.",
            })}
          />
          {errors.startDate && <p className="mt-1 text-xs text-destructive">{errors.startDate.message}</p>}
        </div>
        <div className="min-w-0">
          <Label className="mb-1 block">Heure de prise</Label>
          <Input
            type="time"
            {...register("pickupTime", {
              required: "Sélectionnez une heure de prise.",
            })}
          />
          {errors.pickupTime && <p className="mt-1 text-xs text-destructive">{errors.pickupTime.message}</p>}
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex items-center justify-between gap-3">
            <Label>Date fin</Label>
            <Button onClick={() => setToday("endDate")} size="sm" type="button" variant="outline">
              Aujourd'hui
            </Button>
          </div>
          <Input
            min={startDate}
            type="date"
            {...register("endDate", {
              required: "Sélectionnez une date de fin.",
              validate: () => validateEndDateTime(startDateTime, endDateTime),
            })}
          />
          {errors.endDate && <p className="mt-1 text-xs text-destructive">{errors.endDate.message}</p>}
        </div>
        <div className="min-w-0">
          <Label className="mb-1 block">Heure de retour</Label>
          <Input
            type="time"
            {...register("returnTime", {
              required: "Sélectionnez une heure de retour.",
              validate: () => validateEndDateTime(startDateTime, endDateTime),
            })}
          />
          {errors.returnTime && <p className="mt-1 text-xs text-destructive">{errors.returnTime.message}</p>}
        </div>
      </div>

      <div>
        <Label>Prix/jour</Label>
        <Input
          readOnly
          step="0.001"
          type="number"
          {...register("dailyPrice", {
            valueAsNumber: true,
            validate: (value) => Number(value) > 0 || "Le prix/jour doit être supérieur à 0.",
          })}
        />
        <p className="mt-1 text-xs text-muted-foreground">Prix/jour : {formatMoney(dailyPrice)} (auto)</p>
        {errors.dailyPrice && <p className="mt-1 text-xs text-destructive">{errors.dailyPrice.message}</p>}
      </div>

      <div>
        <Label>Caution</Label>
        <Input
          min="0"
          step="0.001"
          type="number"
          {...register("depositAmount", {
            valueAsNumber: true,
            validate: (value) => Number(value) >= 0 || "La caution doit être supérieure ou égale à 0.",
          })}
        />
        {selectedCar && <p className="mt-1 text-xs text-muted-foreground">Caution suggérée automatiquement.</p>}
        {errors.depositAmount && <p className="mt-1 text-xs text-destructive">{errors.depositAmount.message}</p>}
      </div>

      <div className="lg:col-span-2 rounded-md border border-border bg-white p-4 text-sm">
        <h3 className="mb-3 font-semibold">Détail du prix</h3>
        <dl className="grid gap-2">
          <SummaryRow label="Prix/jour" value={formatMoney(dailyPrice)} />
          <SummaryRow label="Date et heure de prise" value={formatDateTime(startDateTime)} />
          <SummaryRow label="Date et heure de retour" value={formatDateTime(endDateTime)} />
          <SummaryRow label="Durée calculée" value={dateRangeIsValid ? formatRentalDuration(startDateTime, endDateTime) : "-"} />
          <SummaryRow label="Nombre de jours facturés" value={`${rentalDays} ${rentalDays > 1 ? "jours" : "jour"}`} />
          <SummaryRow emphasized label="Total location" value={formatMoney(totalPrice)} />
          <SummaryRow label="Caution" value={formatMoney(depositAmount)} />
        </dl>
      </div>

      <div className="lg:col-span-2 rounded-md border border-border bg-muted/60 p-4 text-sm">
        <h3 className="mb-3 font-semibold">Résumé</h3>
        <dl className="grid gap-2">
          <SummaryRow label="Client" value={selectedClient ? normalizeClientName(selectedClient.fullName) : "-"} />
          <SummaryRow label="Voiture" value={selectedCar ? formatCarName(selectedCar.brand, selectedCar.model) : "-"} />
          <SummaryRow label="Prise" value={formatSummaryDateTime(startDateTime)} />
          <SummaryRow label="Retour" value={formatSummaryDateTime(endDateTime)} />
          <SummaryRow label="Durée" value={dateRangeIsValid ? formatRentalDuration(startDateTime, endDateTime) : "-"} />
          <SummaryRow label="Jours facturés" value={`${rentalDays} ${rentalDays > 1 ? "jours" : "jour"}`} />
          <SummaryRow label="Total" value={formatMoney(totalPrice)} />
          <SummaryRow label="Caution" value={formatMoney(depositAmount)} />
        </dl>
      </div>

      <div className="lg:col-span-2 flex justify-end">
        <Button type="submit">Créer réservation</Button>
      </div>
    </form>
  );
}

function validateEndDateTime(startDateTime: string, endDateTime: string) {
  if (!startDateTime || !endDateTime) return "La période est incomplète.";
  return new Date(endDateTime).getTime() > new Date(startDateTime).getTime() || "Le retour doit être après la prise.";
}

function validateCarSelection(carId: number, availabilityByCar: Map<number, CarAvailability>) {
  if (carId <= 0) return "Sélectionnez une voiture.";

  const availability = availabilityByCar.get(carId);
  if (availability?.unavailableStatus) return "Cette voiture est en maintenance ou indisponible.";
  if (availability?.technicalVisitExpired) return "La visite technique est expirée pour cette période.";
  if (availability?.bookedOnPeriod) return "Cette voiture est déjà réservée sur cette période.";
  if (!availability?.available) return "Cette voiture n'est pas disponible sur cette période.";

  return true;
}

function getCarAvailability(car: Car, startDateTime: string, endDateTime: string, reservations: Reservation[]): CarAvailability {
  const technicalVisitExpired = isTechnicalVisitExpiredForPeriod(car.technicalVisitExpiryDate, endDateTime || startDateTime);
  const dateRangeIsValid = Boolean(startDateTime && endDateTime && new Date(endDateTime).getTime() > new Date(startDateTime).getTime());
  const bookedOnPeriod =
    dateRangeIsValid &&
    reservations.some(
      (reservation) =>
        reservation.carId === car.id &&
        activeReservationStatuses.includes(reservation.status) &&
        rangesOverlap(startDateTime, endDateTime, reservation.startDate, reservation.endDate),
    );
  const unavailableStatus = ["MAINTENANCE", "UNAVAILABLE"].includes(car.status);

  return {
    available: !unavailableStatus && !bookedOnPeriod && !technicalVisitExpired,
    bookedOnPeriod,
    technicalVisitExpired,
    unavailableStatus,
  };
}

function isTechnicalVisitExpiredForPeriod(technicalVisitExpiryDate?: string | null, periodEndDate?: string | null) {
  if (!technicalVisitExpiryDate || !periodEndDate) return false;

  return getLocalDateKey(technicalVisitExpiryDate) < getLocalDateKey(periodEndDate);
}

function rangesOverlap(startDate: string, endDate: string, existingStartDate: string, existingEndDate: string) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const existingStart = new Date(normalizeLegacyDateTime(existingStartDate, "start")).getTime();
  const existingEnd = new Date(normalizeLegacyDateTime(existingEndDate, "end")).getTime();

  return existingStart < end && existingEnd > start;
}

function normalizeLegacyDateTime(value: string, boundary: "start" | "end") {
  if (value.length > 10) return value;
  return boundary === "start" ? `${value}T00:00:00.000` : `${value}T23:59:59.999`;
}

function getSuggestedDeposit(dailyPrice: number) {
  return Math.max(1000, Math.ceil((dailyPrice * 8) / 100) * 100);
}

function formatSummaryDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";

  const day = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);

  return `${day} à ${time}`;
}

function SummaryRow({ emphasized, label, value }: { emphasized?: boolean; label: string; value: string }) {
  return (
    <div
      className={`grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4 ${
        emphasized ? "border-t border-border pt-2 font-semibold" : ""
      }`}
    >
      <dt className="min-w-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-left sm:text-right">{value}</dd>
    </div>
  );
}

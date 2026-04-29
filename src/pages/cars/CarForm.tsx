import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { getStatusLabel } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Car, CreateCarDto } from "@/types/car";
import {
  formatCarName,
  isValidRegistrationNumber,
  normalizeCarBrand,
  normalizeCarModel,
  normalizeRegistrationNumber,
} from "@/utils/car";
import { formatMoney } from "@/utils/money";

interface CarFormProps {
  currentCarId?: number;
  defaultValues?: Partial<CreateCarDto>;
  existingCars?: Car[];
  onSubmit: (data: CreateCarDto) => void | Promise<void>;
}

const selectClassName = "h-10 w-full rounded-md border border-input bg-white px-3 text-sm";
const fuelTypes = ["Essence", "Diesel", "Hybride", "Électrique"];
const transmissions = ["Manuelle", "Automatique"];

export function CarForm({ currentCarId, defaultValues, existingCars = [], onSubmit }: CarFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateCarDto>({
    defaultValues: {
      brand: "",
      model: "",
      registrationNumber: "",
      fuelType: "Essence",
      transmission: "Manuelle",
      dailyPrice: undefined,
      status: "AVAILABLE",
      year: undefined,
      mileage: undefined,
      insuranceExpiryDate: "",
      technicalVisitExpiryDate: "",
      ...defaultValues,
    },
  });

  const brand = normalizeCarBrand(watch("brand"));
  const model = normalizeCarModel(watch("model"));
  const registrationNumber = watch("registrationNumber")?.trim() ?? "";
  const dailyPrice = Number(watch("dailyPrice"));
  const status = watch("status") ?? "AVAILABLE";
  const insuranceExpiryDate = watch("insuranceExpiryDate");
  const technicalVisitExpiryDate = watch("technicalVisitExpiryDate");

  const existingRegistrations = useMemo(
    () =>
      new Set(
        existingCars
          .filter((car) => car.id !== currentCarId)
          .map((car) => normalizeRegistrationNumber(car.registrationNumber)),
      ),
    [currentCarId, existingCars],
  );

  const insuranceWarning = getInsuranceWarning(insuranceExpiryDate);
  const technicalVisitWarning = getTechnicalVisitWarning(technicalVisitExpiryDate);

  function submitForm(data: CreateCarDto) {
    return onSubmit({
      ...data,
      brand: normalizeCarBrand(data.brand),
      model: normalizeCarModel(data.model),
      registrationNumber: normalizeRegistrationNumber(data.registrationNumber),
      fuelType: data.fuelType,
      transmission: data.transmission,
      dailyPrice: Number(data.dailyPrice),
      status: data.status ?? "AVAILABLE",
      year: Number.isFinite(data.year) ? data.year : null,
      mileage: Number.isFinite(data.mileage) ? data.mileage : null,
      insuranceExpiryDate: data.insuranceExpiryDate || null,
      technicalVisitExpiryDate: data.technicalVisitExpiryDate || null,
    });
  }

  function handleRegistrationChange(value: string) {
    setValue("registrationNumber", normalizeRegistrationNumber(value), { shouldDirty: true, shouldValidate: true });
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(submitForm)}>
      <input type="hidden" {...register("status")} />

      <div>
        <Label>Marque *</Label>
        <Input
          placeholder="Ex: Toyota"
          {...register("brand", {
            validate: (value) => value.trim().length > 0 || "La marque est obligatoire.",
          })}
        />
        {errors.brand && <p className="mt-1 text-xs text-destructive">{errors.brand.message}</p>}
      </div>

      <div>
        <Label>Modèle *</Label>
        <Input
          placeholder="Ex: Yaris"
          {...register("model", {
            validate: (value) => value.trim().length > 0 || "Le modèle est obligatoire.",
          })}
        />
        {errors.model && <p className="mt-1 text-xs text-destructive">{errors.model.message}</p>}
      </div>

      <div>
        <Label>Immatriculation *</Label>
        <Input
          placeholder="Ex: 123TU456"
          {...register("registrationNumber", {
            onChange: (event) => handleRegistrationChange(event.target.value),
            validate: (value) => {
              const normalized = normalizeRegistrationNumber(value);

              if (!normalized) return "L'immatriculation est obligatoire.";
              if (!isValidRegistrationNumber(normalized)) return "Format attendu : 123TU456.";
              if (existingRegistrations.has(normalized)) return "Cette immatriculation existe déjà.";

              return true;
            },
          })}
        />
        {errors.registrationNumber && <p className="mt-1 text-xs text-destructive">{errors.registrationNumber.message}</p>}
      </div>

      <div>
        <Label>Année</Label>
        <Input min="1900" placeholder="Ex: 2022" type="number" {...register("year", { valueAsNumber: true })} />
      </div>

      <div>
        <Label>Type de carburant</Label>
        <select className={selectClassName} {...register("fuelType")}>
          {fuelTypes.map((fuelType) => (
            <option key={fuelType} value={fuelType}>
              {fuelType}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label>Transmission</Label>
        <select className={selectClassName} {...register("transmission")}>
          {transmissions.map((transmission) => (
            <option key={transmission} value={transmission}>
              {transmission}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label>Prix par jour (DT) *</Label>
        <Input
          min="1"
          placeholder="Ex: 120"
          step="0.001"
          type="number"
          {...register("dailyPrice", {
            valueAsNumber: true,
            validate: (value) => {
              const price = Number(value);

              if (!Number.isFinite(price) || price < 1) return "Le prix par jour doit être supérieur ou égal à 1 DT.";

              return true;
            },
          })}
        />
        {errors.dailyPrice && <p className="mt-1 text-xs text-destructive">{errors.dailyPrice.message}</p>}
      </div>

      <div>
        <Label>Kilométrage (km)</Label>
        <Input
          min="0"
          placeholder="Ex: 45000"
          type="number"
          {...register("mileage", {
            valueAsNumber: true,
            validate: (value) =>
              !Number.isFinite(value) || Number(value) >= 0 || "Le kilométrage ne peut pas être négatif.",
          })}
        />
        {errors.mileage && <p className="mt-1 text-xs text-destructive">{errors.mileage.message}</p>}
      </div>

      {currentCarId && (
        <div className="md:col-span-2">
          <Label>Statut</Label>
          <Input readOnly value={getStatusLabel(status)} />
          <p className="mt-1 text-xs text-muted-foreground">Le statut est géré par les réservations et les actions du parc.</p>
        </div>
      )}

      <div>
        <Label>Date expiration assurance</Label>
        <Input type="date" {...register("insuranceExpiryDate")} />
        {insuranceWarning && <p className="mt-1 text-xs text-amber-700">{insuranceWarning}</p>}
      </div>

      <div>
        <Label>Date visite technique</Label>
        <Input type="date" {...register("technicalVisitExpiryDate")} />
        {technicalVisitWarning && <p className="mt-1 text-xs text-destructive">{technicalVisitWarning}</p>}
      </div>

      <div className="md:col-span-2 rounded-md border border-border bg-muted/60 p-4 text-sm">
        <h3 className="mb-3 font-semibold">Résumé</h3>
        <div className="space-y-1">
          <p className="font-medium">{formatCarName(brand || "Marque", model || "Modèle")}</p>
          <p>{registrationNumber || "Immatriculation"}</p>
          <p>{Number.isFinite(dailyPrice) ? `${formatMoney(dailyPrice)} / jour` : "Prix par jour"}</p>
          <p>{getStatusLabel(status)}</p>
        </div>
      </div>

      <div className="md:col-span-2 flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">* Champs obligatoires</p>
        <Button type="submit">{currentCarId ? "Enregistrer voiture" : "Ajouter voiture"}</Button>
      </div>
    </form>
  );
}

function getInsuranceWarning(value?: string | null) {
  if (!value) return null;

  const expiryTime = new Date(value).getTime();
  const now = startOfToday().getTime();

  if (!Number.isFinite(expiryTime)) return null;
  if (expiryTime < now) return "Assurance expirée.";
  if (expiryTime <= now + 30 * 24 * 60 * 60 * 1000) return "Assurance expire bientôt.";

  return null;
}

function getTechnicalVisitWarning(value?: string | null) {
  if (!value) return null;

  const expiryTime = new Date(value).getTime();
  if (!Number.isFinite(expiryTime)) return null;

  return expiryTime < startOfToday().getTime() ? "Visite technique expirée : cette voiture ne pourra pas être réservée." : null;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

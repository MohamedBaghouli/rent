import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { getStatusLabel } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Car, CreateCarDto } from "@/types/car";
import {
  formatCarName,
  formatRegistrationNumber,
  isValidRegistrationNumber,
  joinRegistrationNumber,
  normalizeCarBrand,
  normalizeCarModel,
  normalizeRegistrationNumber,
  splitRegistrationNumber,
} from "@/utils/car";
import { formatMoney } from "@/utils/money";

interface CarFormProps {
  currentCarId?: number;
  defaultValues?: Partial<CreateCarDto>;
  existingCars?: Car[];
  onSubmit: (data: CreateCarDto) => void | Promise<void>;
}

type CarFormValues = Omit<CreateCarDto, "registrationNumber"> & {
  registrationLeft: string;
  registrationRight: string;
};

const selectClassName = "h-10 w-full rounded-md border border-input bg-white px-3 text-sm";
const fuelTypes = ["Essence", "Diesel", "Hybride", "Électrique"];
const transmissions = ["Manuelle", "Automatique"];

export function CarForm({ currentCarId, defaultValues, existingCars = [], onSubmit }: CarFormProps) {
  const initialRegistration = splitRegistrationNumber(defaultValues?.registrationNumber);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CarFormValues>({
    defaultValues: {
      brand: "",
      model: "",
      registrationLeft: initialRegistration.left,
      registrationRight: initialRegistration.right,
      fuelType: "Essence",
      transmission: "Manuelle",
      dailyPrice: undefined,
      status: "AVAILABLE",
      year: undefined,
      mileage: undefined,
      imageUrl: "",
      insuranceExpiryDate: "",
      technicalVisitExpiryDate: "",
      ...withoutRegistrationDefault(defaultValues),
    },
  });

  const brand = normalizeCarBrand(watch("brand"));
  const model = normalizeCarModel(watch("model"));
  const registrationNumber = joinRegistrationNumber(watch("registrationLeft"), watch("registrationRight"));
  const dailyPrice = Number(watch("dailyPrice"));
  const status = watch("status") ?? "AVAILABLE";
  const imageUrl = watch("imageUrl");
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

  function submitForm(data: CarFormValues) {
    return onSubmit({
      ...data,
      brand: normalizeCarBrand(data.brand),
      model: normalizeCarModel(data.model),
      registrationNumber: joinRegistrationNumber(data.registrationLeft, data.registrationRight),
      fuelType: data.fuelType,
      transmission: data.transmission,
      dailyPrice: Number(data.dailyPrice),
      status: data.status ?? "AVAILABLE",
      year: Number.isFinite(data.year) ? data.year : null,
      mileage: Number.isFinite(data.mileage) ? data.mileage : null,
      imageUrl: data.imageUrl || null,
      insuranceExpiryDate: data.insuranceExpiryDate || null,
      technicalVisitExpiryDate: data.technicalVisitExpiryDate || null,
    });
  }

  function handleRegistrationPart(field: "registrationLeft" | "registrationRight", value: string) {
    setValue(field, value.replace(/\D/g, "").slice(0, field === "registrationLeft" ? 3 : 4), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  async function handleImageUpload(file?: File) {
    if (!file) return;

    const dataUrl = await readFileAsDataUrl(file);
    setValue("imageUrl", dataUrl, { shouldDirty: true, shouldValidate: true });
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(submitForm)}>
      <input type="hidden" {...register("status")} />
      <input type="hidden" {...register("imageUrl")} />

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
        <div className="grid grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)] items-center gap-2">
          <Input
            inputMode="numeric"
            maxLength={3}
            placeholder="123"
            {...register("registrationLeft", {
              onChange: (event) => handleRegistrationPart("registrationLeft", event.target.value),
              validate: (_value, values) => validateRegistration(values.registrationLeft, values.registrationRight, existingRegistrations),
            })}
          />
          <Input readOnly className="text-center font-medium" value="Tunisie" />
          <Input
            inputMode="numeric"
            maxLength={4}
            placeholder="456"
            {...register("registrationRight", {
              onChange: (event) => handleRegistrationPart("registrationRight", event.target.value),
              validate: (_value, values) => validateRegistration(values.registrationLeft, values.registrationRight, existingRegistrations),
            })}
          />
        </div>
        {(errors.registrationLeft || errors.registrationRight) && (
          <p className="mt-1 text-xs text-destructive">
            {errors.registrationLeft?.message || errors.registrationRight?.message}
          </p>
        )}
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

      <div className="md:col-span-2">
        <Label>Image de la voiture</Label>
        <div className="mt-2 flex flex-col gap-3 rounded-md border border-border bg-white p-3 sm:flex-row sm:items-center">
          <CarImagePreview imageUrl={imageUrl} />
          <div className="flex-1 space-y-2">
            <Input accept="image/*" onChange={(event) => void handleImageUpload(event.target.files?.[0])} type="file" />
            <p className="text-xs text-muted-foreground">Champ optionnel. Si aucune image n'est ajoutée, une emoji voiture sera affichée.</p>
            {imageUrl && (
              <Button onClick={() => setValue("imageUrl", "", { shouldDirty: true, shouldValidate: true })} size="sm" type="button" variant="outline">
                Retirer l'image
              </Button>
            )}
          </div>
        </div>
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
          <p>{registrationNumber ? formatRegistrationNumber(registrationNumber) : "Immatriculation"}</p>
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

function CarImagePreview({ imageUrl }: { imageUrl?: string | null }) {
  if (imageUrl) {
    return <img alt="Voiture" className="h-24 w-32 rounded-md border border-border object-cover" src={imageUrl} />;
  }

  return (
    <div className="flex h-24 w-32 items-center justify-center rounded-md border border-dashed border-border bg-muted text-4xl">
      🚗
    </div>
  );
}

function validateRegistration(left: string, right: string, existingRegistrations: Set<string>) {
  const normalized = joinRegistrationNumber(left, right);

  if (!normalized) return "L'immatriculation est obligatoire.";
  if (!isValidRegistrationNumber(normalized)) return "Format attendu : 123 Tunisie 456.";
  if (existingRegistrations.has(normalized)) return "Cette immatriculation existe déjà.";

  return true;
}

function withoutRegistrationDefault(defaultValues?: Partial<CreateCarDto>): Partial<CarFormValues> {
  if (!defaultValues) return {};
  const { registrationNumber: _registrationNumber, ...rest } = defaultValues;
  return rest;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
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

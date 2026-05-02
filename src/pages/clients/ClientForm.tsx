import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CreateClientDto } from "@/types/client";
import {
  hasCompleteClientName,
  isValidDrivingLicense,
  joinDrivingLicense,
  joinPhoneNumber,
  normalizeClientName,
  splitDrivingLicense,
  splitPhoneNumber,
} from "@/utils/client";

type IdType = "CIN" | "PASSPORT";
type ClientFormValues = Omit<CreateClientDto, "phone" | "drivingLicense"> & {
  phoneCountryCode: string;
  phoneLocalNumber: string;
  drivingLicensePrefix: string;
  drivingLicenseNumber: string;
};

export function ClientForm({
  defaultValues,
  onSubmit,
}: {
  defaultValues?: Partial<CreateClientDto>;
  onSubmit: (data: CreateClientDto) => void | Promise<void>;
}) {
  const initialIdType: IdType =
    defaultValues?.passportNumber ? "PASSPORT" : "CIN";
  const [idType, setIdType] = useState<IdType>(initialIdType);
  const initialPhone = splitPhoneNumber(defaultValues?.phone);
  const initialLicense = splitDrivingLicense(defaultValues?.drivingLicense);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ClientFormValues>({
    defaultValues: {
      fullName: "",
      phoneCountryCode: initialPhone.countryCode,
      phoneLocalNumber: initialPhone.localNumber,
      cin: "",
      passportNumber: "",
      drivingLicensePrefix: initialLicense.prefix,
      drivingLicenseNumber: initialLicense.number,
      drivingLicenseDate: "",
      cinIssueDate: "",
      cinIssuePlace: "",
      birthDate: "",
      birthPlace: "",
      nationality: "Tunisienne",
      address: "",
      ...withoutSplitDefaults(defaultValues),
    },
  });

  function submitForm(values: ClientFormValues) {
    const drivingLicense = joinDrivingLicense(values.drivingLicensePrefix, values.drivingLicenseNumber);

    return onSubmit({
      fullName: normalizeClientName(values.fullName),
      phone: joinPhoneNumber(values.phoneCountryCode, values.phoneLocalNumber),
      cin: idType === "CIN" ? cleanOptionalValue(values.cin) : null,
      passportNumber:
        idType === "PASSPORT" ? cleanOptionalValue(values.passportNumber) : null,
      drivingLicense,
      drivingLicenseDate: cleanOptionalValue(values.drivingLicenseDate),
      cinIssueDate: idType === "CIN" ? cleanOptionalValue(values.cinIssueDate) : null,
      cinIssuePlace: idType === "CIN" ? cleanOptionalValue(values.cinIssuePlace) : null,
      birthDate: cleanOptionalValue(values.birthDate),
      birthPlace: cleanOptionalValue(values.birthPlace),
      nationality: cleanOptionalValue(values.nationality),
      address: cleanOptionalValue(values.address),
    });
  }

  function handleDigitsOnly(field: "phoneLocalNumber" | "cin" | "drivingLicenseNumber", value: string) {
    setValue(field, value.replace(/\D/g, ""), { shouldDirty: true, shouldValidate: true });
  }

  function handleLicensePrefix(value: string) {
    setValue("drivingLicensePrefix", value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 2), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(submitForm)}>
      {/* Name + Phone */}
      <div>
        <Label>Nom complet *</Label>
        <Input
          placeholder="Ex: Mohamed Ben Ali"
          {...register("fullName", {
            validate: (value) => {
              if (!value.trim()) return "Le nom complet est obligatoire.";
              return hasCompleteClientName(value) || "Indiquez au moins prénom et nom.";
            },
          })}
        />
        {errors.fullName && (
          <p className="mt-1 text-xs text-destructive">{errors.fullName.message}</p>
        )}
      </div>

      <div>
        <Label>Téléphone *</Label>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
          <Input
            inputMode="tel"
            placeholder="+216"
            type="tel"
            {...register("phoneCountryCode", {
              onChange: (event) =>
                setValue("phoneCountryCode", `+${event.target.value.replace(/\D/g, "").slice(0, 4) || "216"}`, {
                  shouldDirty: true,
                  shouldValidate: true,
                }),
              validate: (value) => /^\+\d{1,4}$/.test(value.trim()) || "Indicatif invalide.",
            })}
          />
          <Input
            inputMode="numeric"
            maxLength={8}
            placeholder="23 253 234"
            type="tel"
            {...register("phoneLocalNumber", {
              onChange: (event) => handleDigitsOnly("phoneLocalNumber", event.target.value),
              validate: (value) => {
                const phone = value.trim();
                if (!phone) return "Le numéro local est obligatoire.";
                return /^\d{8}$/.test(phone) || "Le numéro local doit contenir 8 chiffres.";
              },
            })}
          />
        </div>
        {(errors.phoneCountryCode || errors.phoneLocalNumber) && (
          <p className="mt-1 text-xs text-destructive">
            {errors.phoneCountryCode?.message || errors.phoneLocalNumber?.message}
          </p>
        )}
      </div>

      {/* Birthday */}
      <div>
        <Label>Date de naissance</Label>
        <Input type="date" {...register("birthDate")} />
      </div>

      <div>
        <Label>Lieu de naissance</Label>
        <Input placeholder="Ex: Tunis" {...register("birthPlace")} />
      </div>

      <div>
        <Label>Nationalité</Label>
        <Input placeholder="Ex: Tunisienne" {...register("nationality")} />
      </div>

      {/* ID type toggle */}
      <div className="md:col-span-2">
        <Label>Type de pièce d'identité *</Label>
        <div className="mt-1 flex gap-2">
          <button
            className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
              idType === "CIN"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-white text-foreground hover:bg-muted"
            }`}
            onClick={() => setIdType("CIN")}
            type="button"
          >
            CIN
          </button>
          <button
            className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
              idType === "PASSPORT"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-white text-foreground hover:bg-muted"
            }`}
            onClick={() => setIdType("PASSPORT")}
            type="button"
          >
            Passeport
          </button>
        </div>
      </div>

      {/* CIN fields */}
      {idType === "CIN" && (
        <>
          <div>
            <Label>Numéro CIN *</Label>
            <Input
              inputMode="numeric"
              maxLength={8}
              placeholder="Ex: 12345678"
              {...register("cin", {
                onChange: (event) => handleDigitsOnly("cin", event.target.value),
                validate: (value) => {
                  const v = value?.trim() ?? "";
                  if (!v) return "Le numéro CIN est obligatoire.";
                  return /^\d{8}$/.test(v) || "La CIN doit contenir exactement 8 chiffres.";
                },
              })}
            />
            {errors.cin && (
              <p className="mt-1 text-xs text-destructive">{errors.cin.message}</p>
            )}
          </div>

          <div>
            <Label>Date d'obtention CIN</Label>
            <Input type="date" {...register("cinIssueDate")} />
          </div>

          <div className="md:col-span-2">
            <Label>Lieu d'obtention CIN</Label>
            <Input placeholder="Ex: Tunis" {...register("cinIssuePlace")} />
          </div>
        </>
      )}

      {/* Passport field */}
      {idType === "PASSPORT" && (
        <div className="md:col-span-2">
          <Label>Numéro de passeport *</Label>
          <Input
            placeholder="Ex: AB1234567"
            {...register("passportNumber", {
              validate: (value) => {
                const v = value?.trim() ?? "";
                return v.length > 0 || "Le numéro de passeport est obligatoire.";
              },
            })}
          />
          {errors.passportNumber && (
            <p className="mt-1 text-xs text-destructive">{errors.passportNumber.message}</p>
          )}
        </div>
      )}

      {/* Driving license + date */}
      <div>
        <Label>Numéro de permis *</Label>
        <div className="grid grid-cols-[72px_24px_minmax(0,1fr)] items-center gap-2">
          <Input
            maxLength={2}
            placeholder="XX"
            {...register("drivingLicensePrefix", {
              onChange: (event) => handleLicensePrefix(event.target.value),
              validate: (value) => /^[A-Z0-9]{2}$/.test(value.trim()) || "Préfixe permis invalide.",
            })}
          />
          <span className="text-center font-semibold text-muted-foreground">/</span>
          <Input
            inputMode="numeric"
            maxLength={6}
            placeholder="XXXXX"
            {...register("drivingLicenseNumber", {
              onChange: (event) => handleDigitsOnly("drivingLicenseNumber", event.target.value),
              validate: (_value, values) => {
                const license = joinDrivingLicense(values.drivingLicensePrefix, values.drivingLicenseNumber);
                if (!license) return "Le numéro de permis est obligatoire.";
                return isValidDrivingLicense(license) || "Format attendu : XX / XXXXX ou XX / XXXXXX.";
              },
            })}
          />
        </div>
        {(errors.drivingLicensePrefix || errors.drivingLicenseNumber) && (
          <p className="mt-1 text-xs text-destructive">
            {errors.drivingLicensePrefix?.message || errors.drivingLicenseNumber?.message}
          </p>
        )}
      </div>

      <div>
        <Label>Date d'obtention du permis</Label>
        <Input type="date" {...register("drivingLicenseDate")} />
      </div>

      {/* Address */}
      <div className="md:col-span-2">
        <Label>Adresse</Label>
        <Input placeholder="Adresse complète" {...register("address")} />
      </div>

      <div className="md:col-span-2 flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">* Champs obligatoires</p>
        <Button type="submit">{defaultValues ? "Enregistrer client" : "Ajouter client"}</Button>
      </div>
    </form>
  );
}

function cleanOptionalValue(value?: string | null) {
  const cleaned = value?.trim() ?? "";
  return cleaned || null;
}

function withoutSplitDefaults(defaultValues?: Partial<CreateClientDto>): Partial<ClientFormValues> {
  if (!defaultValues) return {};
  const { phone: _phone, drivingLicense: _drivingLicense, ...rest } = defaultValues;
  return rest;
}

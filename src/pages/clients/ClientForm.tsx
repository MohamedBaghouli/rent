import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CreateClientDto } from "@/types/client";
import { hasCompleteClientName, normalizeClientName } from "@/utils/client";

type ClientFormValues = CreateClientDto;

export function ClientForm({
  defaultValues,
  onSubmit,
}: {
  defaultValues?: Partial<CreateClientDto>;
  onSubmit: (data: CreateClientDto) => void | Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ClientFormValues>({
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      cin: "",
      passportNumber: "",
      drivingLicense: "",
      address: "",
      ...defaultValues,
    },
  });

  const cin = watch("cin")?.trim() ?? "";
  const passportNumber = watch("passportNumber")?.trim() ?? "";
  const shouldDisableCin = passportNumber.length > 0 && cin.length === 0;
  const shouldDisablePassport = cin.length > 0 && passportNumber.length === 0;

  function submitForm(values: ClientFormValues) {
    return onSubmit({
      fullName: normalizeClientName(values.fullName),
      phone: values.phone.trim(),
      email: cleanOptionalValue(values.email),
      cin: cleanOptionalValue(values.cin),
      passportNumber: cleanOptionalValue(values.passportNumber),
      drivingLicense: values.drivingLicense?.trim() ?? "",
      address: cleanOptionalValue(values.address),
    });
  }

  function handleDigitsOnly(field: "phone" | "cin", value: string) {
    setValue(field, value.replace(/\D/g, ""), { shouldDirty: true, shouldValidate: true });
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(submitForm)}>
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
        {errors.fullName && <p className="mt-1 text-xs text-destructive">{errors.fullName.message}</p>}
      </div>

      <div>
        <Label>Téléphone *</Label>
        <Input
          inputMode="numeric"
          placeholder="Ex: 55 123 456"
          type="tel"
          {...register("phone", {
            onChange: (event) => handleDigitsOnly("phone", event.target.value),
            validate: (value) => {
              const phone = value.trim();
              if (!phone) return "Le téléphone est obligatoire.";
              return /^\d+$/.test(phone) || "Le téléphone doit contenir uniquement des chiffres.";
            },
          })}
        />
        {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone.message}</p>}
      </div>

      <div>
        <Label>Email</Label>
        <Input
          placeholder="exemple@email.com"
          type="email"
          {...register("email", {
            validate: (value) =>
              !value?.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || "L'email n'est pas valide.",
          })}
        />
        {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div>
        <Label>CIN (Carte d'identité)</Label>
        <Input
          disabled={shouldDisableCin}
          inputMode="numeric"
          maxLength={8}
          placeholder="Ex: 12345678"
          {...register("cin", {
            onChange: (event) => handleDigitsOnly("cin", event.target.value),
            validate: (value, values) => {
              const cinValue = value?.trim() ?? "";
              const passportValue = values.passportNumber?.trim() ?? "";

              if (!cinValue && !passportValue) return "CIN ou numéro de passeport obligatoire.";
              if (cinValue && !/^\d{8}$/.test(cinValue)) return "La CIN doit contenir exactement 8 chiffres.";

              return true;
            },
          })}
        />
        {errors.cin && <p className="mt-1 text-xs text-destructive">{errors.cin.message}</p>}
      </div>

      <div>
        <Label>Numéro de passeport</Label>
        <Input
          disabled={shouldDisablePassport}
          placeholder="Optionnel"
          {...register("passportNumber", {
            validate: (value, values) => {
              const passportValue = value?.trim() ?? "";
              const cinValue = values.cin?.trim() ?? "";

              return Boolean(passportValue || cinValue) || "CIN ou numéro de passeport obligatoire.";
            },
          })}
        />
        {errors.passportNumber && <p className="mt-1 text-xs text-destructive">{errors.passportNumber.message}</p>}
      </div>

      <div>
        <Label>Numéro de permis *</Label>
        <Input
          placeholder="Ex: 987654321"
          {...register("drivingLicense", {
            validate: (value) => (value?.trim() ?? "").length > 0 || "Le numéro de permis est obligatoire.",
          })}
        />
        {errors.drivingLicense && <p className="mt-1 text-xs text-destructive">{errors.drivingLicense.message}</p>}
      </div>

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

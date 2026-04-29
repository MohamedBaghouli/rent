const brandCorrections: Record<string, string> = {
  peugot: "Peugeot",
};

export function normalizeRegistrationNumber(value?: string | null) {
  return (value ?? "").replace(/[\s-]/g, "").toUpperCase();
}

export function isValidRegistrationNumber(value?: string | null) {
  return /^\d{1,3}[A-Z]{2,3}\d{1,4}$/.test(normalizeRegistrationNumber(value));
}

export function normalizeCarBrand(value?: string | null) {
  const brand = toTitleCase(value ?? "");
  return brandCorrections[brand.toLowerCase()] ?? brand;
}

export function normalizeCarModel(value?: string | null) {
  return toTitleCase(value ?? "");
}

export function formatCarName(brand?: string | null, model?: string | null) {
  return [normalizeCarBrand(brand), normalizeCarModel(model)].filter(Boolean).join(" ");
}

function toTitleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b[\p{L}\p{N}]/gu, (match) => match.toUpperCase());
}

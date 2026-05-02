const brandCorrections: Record<string, string> = {
  peugot: "Peugeot",
};

export function normalizeRegistrationNumber(value?: string | null) {
  const normalized = (value ?? "")
    .replace(/[\s-]/g, "")
    .replace(/TUNISIE|TUN/gi, "TU")
    .toUpperCase();
  return normalized;
}

export function isValidRegistrationNumber(value?: string | null) {
  return /^\d{1,3}TU\d{1,4}$/.test(normalizeRegistrationNumber(value));
}

export function splitRegistrationNumber(value?: string | null) {
  const normalized = normalizeRegistrationNumber(value);
  const match = normalized.match(/^(\d{1,3})TU(\d{1,4})$/);

  return {
    left: match?.[1] ?? "",
    right: match?.[2] ?? "",
  };
}

export function joinRegistrationNumber(left: string, right: string) {
  const cleanLeft = left.replace(/\D/g, "").slice(0, 3);
  const cleanRight = right.replace(/\D/g, "").slice(0, 4);
  return cleanLeft && cleanRight ? `${cleanLeft}TU${cleanRight}` : "";
}

export function formatRegistrationNumber(value?: string | null) {
  const { left, right } = splitRegistrationNumber(value);
  return left && right ? `${left} Tunisie ${right}` : normalizeRegistrationNumber(value);
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

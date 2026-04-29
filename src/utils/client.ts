const clientNameCorrections: Record<string, string> = {
  cdv: "Mohamed Trabelsi",
  youssef: "Youssef Ben Ali",
};

export function normalizeClientName(value?: string | null) {
  const normalized = (value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b[\p{L}\p{N}]/gu, (match) => match.toUpperCase());

  return clientNameCorrections[normalized.toLowerCase()] ?? normalized;
}

export function formatPhoneNumber(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "-";

  if (digits.length === 8) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }

  return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

export function hasCompleteClientName(value?: string | null) {
  return normalizeClientName(value).split(" ").filter(Boolean).length >= 2;
}

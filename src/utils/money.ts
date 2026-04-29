export function formatMoney(value: number) {
  const amount = new Intl.NumberFormat("fr-TN", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(value);

  return `${amount} DT`;
}

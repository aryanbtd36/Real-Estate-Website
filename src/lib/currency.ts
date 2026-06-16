export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatIndianRealEstatePrice(value: number): string {
  if (value >= 10000000) {
    const cr = value / 10000000;
    const formatted = Number(cr.toFixed(2));
    return `₹${formatted} Crore`;
  } else if (value >= 100000) {
    const lakh = value / 100000;
    const formatted = Number(lakh.toFixed(2));
    return `₹${formatted} Lakh`;
  } else {
    return formatCurrency(value);
  }
}

export function formatPkr(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return 'Rs. 0';
  }
  const rounded = Math.round(Number(amount));
  return `Rs. ${rounded.toLocaleString('en-PK')}`;
}

export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

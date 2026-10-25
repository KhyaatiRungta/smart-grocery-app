/** Formats paise (integer) as rupees for display, e.g. 52900 -> "₹529". */
export function formatINR(paise: number): string {
  const rupees = paise / 100;
  const hasFraction = Math.round(rupees * 100) % 100 !== 0;
  const digits = hasFraction ? rupees.toFixed(2) : Math.round(rupees).toString();
  const [whole, fraction] = digits.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `₹${grouped}${fraction ? `.${fraction}` : ''}`;
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export function formatDay(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  placed: 'Placed',
  confirmed: 'Confirmed',
  packed: 'Packed',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

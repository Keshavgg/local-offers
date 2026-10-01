// Indian mobile numbers may be typed with or without +91; other countries need the + prefix.
// Returns "+<digits>" or null when it doesn't look like a phone number.
export const normPhone = (input) => {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  if (!/^\+?[\d\s().-]+$/.test(raw)) return null;
  const digits = raw.replace(/\D/g, '');
  if (!raw.startsWith('+')) {
    if (/^[6-9]\d{9}$/.test(digits)) return '+91' + digits;
    if (/^0[6-9]\d{9}$/.test(digits)) return '+91' + digits.slice(1);
    if (/^91[6-9]\d{9}$/.test(digits)) return '+' + digits;
    return null;
  }
  return digits.length >= 8 && digits.length <= 15 ? '+' + digits : null;
};

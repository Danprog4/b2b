export function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeInn(value: string) {
  return normalizeDigits(value);
}

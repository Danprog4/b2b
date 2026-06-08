export const MOSCOW_TIME_ZONE = "Europe/Moscow";

function toDate(value: Date | string) {
  return typeof value === "string" ? new Date(value) : value;
}

export function formatMoscowDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: MOSCOW_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(toDate(value));
}

export function formatMoscowDate(value: Date | string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: MOSCOW_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(toDate(value));
}

export function formatMoscowLongDate(value: Date | string) {
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    timeZone: MOSCOW_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(toDate(value));

  return formatted.replace(/\s*г\.$/, "");
}

export function formatMoscowMonthYear(value: Date | string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: MOSCOW_TIME_ZONE,
    month: "2-digit",
    year: "numeric",
  }).format(toDate(value));
}

export function formatMoscowMediumDateTime(value: Date | string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: MOSCOW_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(toDate(value));
}

export function buildMoscowDateStamp(value: Date | string = new Date()) {
  return formatMoscowDate(value).replaceAll(".", "-");
}

export function parseMoscowDateInput(value: string | null, endOfDay = false) {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = endOfDay
    ? new Date(Date.UTC(year, month - 1, day, 20, 59, 59, 999))
    : new Date(Date.UTC(year, month - 1, day, -3, 0, 0, 0));

  return Number.isNaN(date.getTime()) ? null : date;
}

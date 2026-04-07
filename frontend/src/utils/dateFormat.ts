type FormatOptions = {
  fallback?: string;
  invalidFallback?: string;
};

const DISPLAY_DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})\.?$/;
const DISPLAY_DATETIME_RE = /^(\d{2})\.(\d{2})\.(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateParts(year: number, month: number, day: number) {
  return `${pad2(day)}.${pad2(month)}.${year}`;
}

function getFallbacks(options?: FormatOptions) {
  return {
    fallback: options?.fallback ?? "—",
    invalidFallback: options?.invalidFallback ?? "—",
  };
}

function parseDateOnlyParts(value: string) {
  const isoMatch = value.match(ISO_DATE_RE);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return { year: Number(year), month: Number(month), day: Number(day) };
  }

  const displayMatch = value.match(DISPLAY_DATE_RE);
  if (displayMatch) {
    const [, day, month, year] = displayMatch;
    return { year: Number(year), month: Number(month), day: Number(day) };
  }

  return null;
}

function parseDateValue(value: string) {
  const dateOnly = parseDateOnlyParts(value);
  if (dateOnly) {
    return new Date(dateOnly.year, dateOnly.month - 1, dateOnly.day);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function formatDate(value: string | null | undefined, options?: FormatOptions) {
  const { fallback, invalidFallback } = getFallbacks(options);
  if (!value) {
    return fallback;
  }

  const dateOnly = parseDateOnlyParts(value);
  if (dateOnly) {
    return formatDateParts(dateOnly.year, dateOnly.month, dateOnly.day);
  }

  const parsed = parseDateValue(value);
  if (!parsed) {
    return invalidFallback;
  }

  return formatDateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

export function formatDateTime(value: string | null | undefined, options?: FormatOptions) {
  const { fallback, invalidFallback } = getFallbacks(options);
  if (!value) {
    return fallback;
  }

  const parsed = parseDateValue(value);
  if (!parsed) {
    return invalidFallback;
  }

  return `${formatDateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate())} ${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
}

export function toDisplayDate(value: string | null | undefined) {
  return formatDate(value, { fallback: "", invalidFallback: "" });
}

export function toDisplayDateTime(value: string | null | undefined) {
  return formatDateTime(value, { fallback: "", invalidFallback: "" });
}

export function parseDisplayDate(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  if (ISO_DATE_RE.test(normalized)) {
    return normalized;
  }

  const match = normalized.match(DISPLAY_DATE_RE);
  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

export function parseDisplayDateTime(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  const isoMatch = normalized.match(ISO_DATETIME_RE);
  if (isoMatch) {
    const [, year, month, day, hours, minutes] = isoMatch;
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  const displayMatch = normalized.match(DISPLAY_DATETIME_RE);
  if (!displayMatch) {
    return null;
  }

  const [, day, month, year, hours, minutes] = displayMatch;
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function withDateInputHint(label: string) {
  return `${label} (ДД.ММ.ГГГГ)`;
}

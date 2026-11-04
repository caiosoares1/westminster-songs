/**
 * Setlist dates are calendar days ("the service on 08/11"), stored as
 * midnight UTC. They must be read in UTC: in Brazil (UTC-3) a local
 * conversion would show the previous day.
 */

const DATE_INPUT_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** "2026-11-08T00:00:00.000Z" -> "08/11/2026" */
export function formatServiceDate(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

/** "08/11/2026" -> "2026-11-08"; null when it isn't a real date. */
export function parseServiceDateInput(input: string): string | null {
  const match = input.trim().match(DATE_INPUT_REGEX);
  if (!match) {
    return null;
  }

  const [, day, month, year] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

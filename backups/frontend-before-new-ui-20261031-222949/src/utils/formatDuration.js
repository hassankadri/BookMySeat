/**
 * Converts movie durations into a consistent format.
 *
 * Examples:
 * 113 min       -> 1h 53m
 * 195 minutes   -> 3h 15m
 * 2h 30m        -> 2h 30m
 * 90            -> 1h 30m
 * 120 min       -> 2h
 */

export function formatDuration(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const raw = String(value).trim();

  if (!raw) return "";

  const unitPattern =
    /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)/gi;

  let totalMinutes = 0;
  let foundUnit = false;

  for (const match of raw.matchAll(unitPattern)) {
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    if (!Number.isFinite(amount)) continue;

    if (/^(hours?|hrs?|h)$/.test(unit)) {
      totalMinutes += amount * 60;
    } else {
      totalMinutes += amount;
    }

    foundUnit = true;
  }

  // Plain numeric values are treated as minutes.
  if (!foundUnit && /^\d+(?:\.\d+)?$/.test(raw)) {
    totalMinutes = Number(raw);
    foundUnit = true;
  }

  // Preserve unknown formats rather than displaying incorrect data.
  if (!foundUnit || totalMinutes < 0) {
    return raw;
  }

  const minutes = Math.round(totalMinutes);

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0 && remainingMinutes > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${remainingMinutes}m`;
}
/**
 * Timestamp formatting utilities.
 *
 * Motion's REST API returns ISO 8601 instants carrying an explicit UTC
 * designator (e.g. "2026-08-07T04:15:00.000Z"). Rendering those with
 * `Date#toLocaleString()` resolves them against the *host* timezone and emits
 * no zone label at all. On Cloudflare Workers the host timezone is always UTC,
 * so the output is a UTC wall-clock reading that every downstream consumer —
 * including an LLM — reads as local time. For a user in Asia/Kolkata that is a
 * silent 5h30m error, and near a day boundary it reports the wrong date.
 *
 * These helpers never discard the offset. The ISO instant is always emitted;
 * a human-readable local rendering is appended only when the zone is known,
 * and is always labelled with the IANA zone ID it was rendered in.
 */

/** Matches the locale-formatted shape this module exists to eliminate. */
export const LEGACY_LOCALE_SHAPE = /\b\d{1,2}\/\d{1,2}\/\d{4},\s+\d{1,2}:\d{2}:\d{2}\s*(AM|PM)\b/;

/**
 * Pick the zone to render local times in, given the account's schedules.
 *
 * Rule: render a local time only when every schedule agrees on the zone.
 * If the schedules disagree — or none carry a zone — return undefined and let
 * the caller emit the ISO instant alone. Silently electing a winner would
 * reintroduce exactly the class of unlabelled-wrong-time error this module
 * fixes; an unrendered local time is recoverable, a wrong one is not.
 */
export function resolveDisplayTimeZone(
  schedules?: ReadonlyArray<{ timezone?: string | null } | null | undefined> | null
): string | undefined {
  if (!schedules || schedules.length === 0) return undefined;

  const zones = new Set(
    schedules
      .map(schedule => schedule?.timezone?.trim())
      .filter((zone): zone is string => Boolean(zone))
  );

  if (zones.size !== 1) return undefined;
  const [zone] = [...zones];
  return isValidTimeZone(zone!) ? zone : undefined;
}

/** True when the runtime's Intl implementation accepts this IANA zone ID. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Render an instant as wall-clock parts in the given zone.
 * Built from formatToParts so output does not drift with ICU locale data.
 * Returns null if the runtime cannot honour the zone.
 */
function renderInZone(date: Date, timeZone: string, withTime: boolean): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(date)
      .reduce<Record<string, string>>((acc, part) => {
        acc[part.type] = part.value;
        return acc;
      }, {});

    if (!parts.year || !parts.month || !parts.day) return null;

    const calendarDate = `${parts.year}-${parts.month}-${parts.day}`;
    if (!withTime) return `${calendarDate} ${timeZone}`;
    if (!parts.hour || !parts.minute || !parts.second) return null;

    return `${calendarDate} ${parts.hour}:${parts.minute}:${parts.second} ${timeZone}`;
  } catch {
    return null;
  }
}

/**
 * Format a full timestamp. Always emits the unambiguous ISO 8601 instant;
 * appends a zone-labelled local rendering when a zone is supplied.
 *
 *   formatTimestamp('2026-08-07T04:15:00.000Z')
 *     -> '2026-08-07T04:15:00.000Z'
 *   formatTimestamp('2026-08-07T04:15:00.000Z', 'Asia/Kolkata')
 *     -> '2026-08-07T04:15:00.000Z (2026-08-07 09:45:00 Asia/Kolkata)'
 *
 * Unparseable input is returned verbatim rather than replaced with
 * "Invalid Date" — never destroy a value we failed to understand.
 */
export function formatTimestamp(value?: string | null, timeZone?: string): string {
  if (value === undefined || value === null || value === '') return 'Not set';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const iso = date.toISOString();
  const local = timeZone ? renderInZone(date, timeZone, true) : null;
  return local ? `${iso} (${local})` : iso;
}

/**
 * Offset (ms) the given IANA zone is ahead of UTC at the given instant.
 * Positive east of UTC, negative west. Returns null if the zone is unusable.
 */
function zoneOffsetMs(timeZone: string, date: Date): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(date)
      .reduce<Record<string, string>>((acc, part) => {
        acc[part.type] = part.value;
        return acc;
      }, {});

    if (!parts.year || !parts.month || !parts.day || !parts.hour || !parts.minute || !parts.second) {
      return null;
    }

    const asIfUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    return asIfUtc - date.getTime();
  } catch {
    return null;
  }
}

/**
 * Given a calendar date (YYYY-MM-DD) and an IANA zone, return the ISO 8601 UTC
 * instant that corresponds to 23:59:59.000 local wall-clock time on that date in
 * that zone. Stored this way, the due date renders back as the same calendar day
 * in the account's display zone instead of slipping forward one day (as a plain
 * 23:59:59Z instant does in any zone ahead of UTC).
 *
 * Returns null if the date string is malformed or the zone cannot be honoured,
 * so the caller can fall back to UTC end-of-day.
 */
export function endOfDayInZone(dateOnly: string, timeZone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Treat the target wall-clock (23:59:59 local) as if it were UTC, then correct
  // by the zone's offset. Re-evaluate the offset at the corrected instant once so
  // a DST boundary near the guess resolves to the right side.
  const asIfUtc = Date.UTC(year, month - 1, day, 23, 59, 59, 0);
  const offset = zoneOffsetMs(timeZone, new Date(asIfUtc));
  if (offset === null) return null;

  let utcMs = asIfUtc - offset;
  const refinedOffset = zoneOffsetMs(timeZone, new Date(utcMs));
  if (refinedOffset !== null && refinedOffset !== offset) {
    utcMs = asIfUtc - refinedOffset;
  }

  return new Date(utcMs).toISOString();
}

/**
 * Format a calendar date for compact list output. The zone matters: an instant
 * of 2026-08-10T23:59:59Z is 11 August in Asia/Kolkata, and reporting it as
 * "8/10/2026" is an off-by-one-day error, not a cosmetic one.
 */
export function formatDateOnly(value?: string | null, timeZone?: string): string {
  if (value === undefined || value === null || value === '') return 'Not set';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const local = timeZone ? renderInZone(date, timeZone, false) : null;
  return local ?? `${date.toISOString().slice(0, 10)} UTC`;
}

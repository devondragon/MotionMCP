/**
 * DST-boundary coverage for endOfDayInZone (issue #136).
 *
 * endOfDayInZone returns the UTC instant of 23:59:59.000 local wall-clock on a
 * given calendar date in a given IANA zone. The refined-offset step exists so a
 * date whose end-of-day sits on the far side of a DST transition resolves to the
 * offset actually in effect at 23:59:59 that day, not the offset guessed from a
 * naive UTC anchor.
 *
 * The existing dateFormat.spec.ts covers a single non-DST date in IST and NY.
 * This spec brackets both directions of the transition for a zone WEST of UTC
 * (America/New_York) and a zone EAST of UTC (Australia/Sydney, southern
 * hemisphere so the transitions run opposite), with America/Phoenix (UTC-7,
 * no DST) as a fixed-offset control. Expected instants were computed from the
 * zone offsets in effect at end-of-day on each date.
 */
import { describe, it, expect } from 'vitest';
import { endOfDayInZone } from '../src/utils/dateFormat';

describe('endOfDayInZone across DST boundaries', () => {
  describe('America/New_York (west of UTC)', () => {
    it('uses the pre-transition offset the day before spring-forward, post after', () => {
      // Spring forward 2026-03-08: EST (UTC-5) -> EDT (UTC-4) at 02:00 local.
      // Mar 7 ends in EST: 23:59:59 -05:00 = 04:59:59Z next day.
      expect(endOfDayInZone('2026-03-07', 'America/New_York')).toBe('2026-03-08T04:59:59.000Z');
      // Mar 8 ends in EDT: 23:59:59 -04:00 = 03:59:59Z next day.
      expect(endOfDayInZone('2026-03-08', 'America/New_York')).toBe('2026-03-09T03:59:59.000Z');
    });

    it('uses the pre-transition offset the day before fall-back, post after', () => {
      // Fall back 2026-11-01: EDT (UTC-4) -> EST (UTC-5) at 02:00 local.
      // Oct 31 ends in EDT: 23:59:59 -04:00 = 03:59:59Z next day.
      expect(endOfDayInZone('2026-10-31', 'America/New_York')).toBe('2026-11-01T03:59:59.000Z');
      // Nov 1 ends in EST: 23:59:59 -05:00 = 04:59:59Z next day.
      expect(endOfDayInZone('2026-11-01', 'America/New_York')).toBe('2026-11-02T04:59:59.000Z');
    });
  });

  describe('Australia/Sydney (east of UTC, southern-hemisphere DST)', () => {
    it('uses the pre-transition offset the day before fall-back, post after', () => {
      // Fall back 2026-04-05: AEDT (UTC+11) -> AEST (UTC+10) at 03:00 local.
      // Apr 4 ends in AEDT: 23:59:59 +11:00 = 12:59:59Z same day.
      expect(endOfDayInZone('2026-04-04', 'Australia/Sydney')).toBe('2026-04-04T12:59:59.000Z');
      // Apr 5 ends in AEST: 23:59:59 +10:00 = 13:59:59Z same day.
      expect(endOfDayInZone('2026-04-05', 'Australia/Sydney')).toBe('2026-04-05T13:59:59.000Z');
    });

    it('uses the pre-transition offset the day before spring-forward, post after', () => {
      // Spring forward 2026-10-04: AEST (UTC+10) -> AEDT (UTC+11) at 02:00 local.
      // Oct 3 ends in AEST: 23:59:59 +10:00 = 13:59:59Z same day.
      expect(endOfDayInZone('2026-10-03', 'Australia/Sydney')).toBe('2026-10-03T13:59:59.000Z');
      // Oct 4 ends in AEDT: 23:59:59 +11:00 = 12:59:59Z same day.
      expect(endOfDayInZone('2026-10-04', 'Australia/Sydney')).toBe('2026-10-04T12:59:59.000Z');
    });
  });

  describe('America/Phoenix (fixed offset, control)', () => {
    it('keeps the same UTC-7 offset across the DST calendar', () => {
      // Arizona does not observe DST, so winter and summer end-of-day both use
      // UTC-7: 23:59:59 -07:00 = 06:59:59Z next day.
      expect(endOfDayInZone('2026-01-15', 'America/Phoenix')).toBe('2026-01-16T06:59:59.000Z');
      expect(endOfDayInZone('2026-07-15', 'America/Phoenix')).toBe('2026-07-16T06:59:59.000Z');
    });
  });
});

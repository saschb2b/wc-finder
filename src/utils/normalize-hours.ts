/**
 * Normalize various opening hours formats to our standardized format
 * Handles: OSM format, Google Places format, simple times, seasonal, etc.
 */

import {
  StandardizedHours,
  WeeklyHours,
  DaySchedule,
  TimePeriod,
  timeToMinutes,
} from "../types/opening-hours";

const DAY_MAP: Record<string, number> = {
  // German + English combined (overlaps are fine)
  so: 0,
  son: 0,
  sonntag: 0,
  su: 0,
  sun: 0,
  sunday: 0,
  mo: 1,
  mon: 1,
  montag: 1,
  monday: 1,
  di: 2,
  die: 2,
  dienstag: 2,
  tu: 2,
  tue: 2,
  tuesday: 2,
  mi: 3,
  mit: 3,
  mittwoch: 3,
  we: 3,
  wed: 3,
  wednesday: 3,
  do: 4,
  don: 4,
  donnerstag: 4,
  th: 4,
  thu: 4,
  thursday: 4,
  fr: 5,
  fre: 5,
  freitag: 5,
  fri: 5,
  friday: 5,
  sa: 6,
  sam: 6,
  samstag: 6,
  sat: 6,
  saturday: 6,
};

/** Parse a day code to day index (0-6) */
function parseDay(dayCode: string): number | null {
  const normalized = dayCode.toLowerCase().trim();
  return DAY_MAP[normalized] ?? null;
}

/** Parse a day range like "Mo-Fr" or "Fr-Sa" into array of day indices */
function parseDayRange(rangeStr: string): number[] {
  const days: number[] = [];
  const normalized = rangeStr.toLowerCase().trim();

  // Check for range pattern (e.g., "mo-fr", "fr-sa")
  const rangeMatch = normalized.match(/^(\w{2})\s*-\s*(\w{2})$/);
  if (rangeMatch) {
    const startDay = parseDay(rangeMatch[1]);
    const endDay = parseDay(rangeMatch[2]);

    if (startDay !== null && endDay !== null) {
      if (startDay <= endDay) {
        for (let i = startDay; i <= endDay; i++) days.push(i);
      } else {
        // Wrap around (e.g., Fr-Mo)
        for (let i = startDay; i <= 6; i++) days.push(i);
        for (let i = 0; i <= endDay; i++) days.push(i);
      }
      return days;
    }
  }

  // Single day
  const singleDay = parseDay(normalized);
  if (singleDay !== null) {
    return [singleDay];
  }

  // Comma-separated days (e.g., "Sa,So" or "Sa, So, PH")
  const parts = normalized.split(/[,\s]+/).filter((p) => p.length >= 2);
  for (const part of parts) {
    const day = parseDay(part);
    if (day !== null && !days.includes(day)) {
      days.push(day);
    }
  }

  return days;
}

/** Parse a time string like "09:00" or "9:00" to minutes */
function parseTime(timeStr: string): number {
  const normalized = timeStr.trim();
  const [hours, mins] = normalized.split(":").map(Number);

  // Handle 00:00 as 24:00 (end of day) - but only if it's a closing time
  // This is handled by the caller
  return hours * 60 + (mins || 0);
}

/** Parse a time period like "09:00-17:00" */
function parsePeriod(periodStr: string): TimePeriod | null {
  const match = periodStr.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const open = parseTime(`${match[1]}:${match[2]}`);
  let close = parseTime(`${match[3]}:${match[4]}`);

  // Handle 00:00 as end of day (24:00)
  if (match[3] === "00" && match[4] === "00") {
    close = 24 * 60; // 1440 minutes
  }

  return { open, close };
}

/** Create a closed day schedule */
function closedDay(): DaySchedule {
  return { isOpen: false, periods: [] };
}

/** Create an open day schedule with given periods */
function openDay(periods: TimePeriod[]): DaySchedule {
  return { isOpen: true, periods };
}

/** Create default weekly schedule (all days closed) */
function createEmptyWeekly(): WeeklyHours {
  return {
    0: closedDay(),
    1: closedDay(),
    2: closedDay(),
    3: closedDay(),
    4: closedDay(),
    5: closedDay(),
    6: closedDay(),
  };
}

/**
 * Main normalization function
 * Converts various opening hours formats to standardized format
 */
export function normalizeOpeningHours(
  input: string | undefined,
): StandardizedHours {
  if (!input || input.trim() === "") {
    return { type: "unknown" };
  }

  const normalized = input.trim();

  // Handle 24/7
  if (normalized === "24/7" || normalized.toLowerCase() === "24/7") {
    return { type: "24_7" };
  }

  // Check for unparseable patterns
  if (
    /[{}]|\|\||comment|"|season|variable|appointment|nachAbsprache/i.test(
      normalized,
    )
  ) {
    return { type: "unknown", original: normalized };
  }

  const weekly = createEmptyWeekly();
  let hasValidData = false;

  // Split by semicolon for multiple rules
  const rules = normalized
    .split(";")
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  for (const rule of rules) {
    // Skip "off" and "closed" rules - they just mean closed (already default)
    if (/\b(off|closed|geschlossen)\b/i.test(rule)) {
      continue;
    }

    // Check for seasonal pattern (e.g., "Apr-Sep 08:00-20:00")
    const seasonalMatch = rule.match(
      /([a-z]{3,4})\s*[-–]\s*([a-z]{3,4})\s+(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/i,
    );
    if (seasonalMatch) {
      // For seasonal, just use the times (we can't easily check current season)
      // Mark as seasonal type but still parse the schedule
      const period = parsePeriod(`${seasonalMatch[3]}-${seasonalMatch[4]}`);
      if (period) {
        // Apply to all days (approximation)
        for (let i = 0; i <= 6; i++) {
          weekly[i as keyof WeeklyHours] = openDay([period]);
        }
        hasValidData = true;
        continue;
      }
    }

    // Try to extract day part and time part
    // Pattern: days followed by times
    // Examples: "Mo-Fr 09:00-17:00", "Sa,So 10:00-18:00", "Mo 09:00-12:00,14:00-18:00"
    const dayTimeMatch = rule.match(
      /^([a-z]{2}(?:\s*[,\s]\s*[a-z]{2})*(?:\s*-\s*[a-z]{2})?)\s+(.+)$/i,
    );

    if (dayTimeMatch) {
      const dayPart = dayTimeMatch[1];
      const timePart = dayTimeMatch[2];

      const days = parseDayRange(dayPart);
      if (days.length === 0) continue;

      // Parse time periods (can be multiple, e.g., "12:00-15:00,19:00-00:00")
      const periods: TimePeriod[] = [];
      const timeRanges = timePart.split(",").map((t) => t.trim());

      for (const range of timeRanges) {
        const period = parsePeriod(range);
        if (period) {
          periods.push(period);
        }
      }

      if (periods.length > 0) {
        for (const day of days) {
          weekly[day as keyof WeeklyHours] = openDay(periods);
        }
        hasValidData = true;
      }
    } else {
      // Try simple time-only pattern (e.g., "09:00-18:00")
      // This applies to all days
      const period = parsePeriod(rule);
      if (period) {
        for (let i = 0; i <= 6; i++) {
          weekly[i as keyof WeeklyHours] = openDay([period]);
        }
        hasValidData = true;
      }
    }
  }

  if (!hasValidData) {
    return { type: "unknown", original: normalized };
  }

  // Check if it's actually 24/7
  const firstDay = weekly[0];
  if (
    firstDay.isOpen &&
    firstDay.periods.length === 1 &&
    firstDay.periods[0].open === 0 &&
    firstDay.periods[0].close === 24 * 60
  ) {
    const allSame = [1, 2, 3, 4, 5, 6].every((i) => {
      const day = weekly[i as keyof WeeklyHours];
      return (
        day.isOpen &&
        day.periods.length === 1 &&
        day.periods[0].open === 0 &&
        day.periods[0].close === 24 * 60
      );
    });
    if (allSame) {
      return { type: "24_7" };
    }
  }

  return {
    type: "weekly",
    weekly,
    original: normalized,
  };
}

/** Batch normalize hours for all toilets (for migration script) */
export function batchNormalizeHours(
  toilets: Array<{ id: string; opening_hours?: string }>,
): Map<string, StandardizedHours> {
  const results = new Map<string, StandardizedHours>();

  for (const toilet of toilets) {
    if (toilet.opening_hours) {
      results.set(toilet.id, normalizeOpeningHours(toilet.opening_hours));
    }
  }

  return results;
}

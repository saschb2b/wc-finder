/**
 * Parse month name to month number (0-11)
 */
function parseMonth(monthStr: string): number | null {
  const months: Record<string, number> = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    mär: 2,
    apr: 3,
    april: 3,
    may: 4,
    mai: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    okt: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
    dez: 11,
  };
  return months[monthStr.toLowerCase()] ?? null;
}

/**
 * Check if current month is within a seasonal range.
 * Handles: "Apr-Sep", "Mar-Oct", "Oct-Mar" (wrapping around year end)
 */
function isInSeason(startMonth: string, endMonth: string): boolean {
  const start = parseMonth(startMonth);
  const end = parseMonth(endMonth);
  if (start === null || end === null) return true;

  const currentMonth = new Date().getMonth();

  if (start <= end) {
    return currentMonth >= start && currentMonth <= end;
  } else {
    return currentMonth >= start || currentMonth <= end;
  }
}

/**
 * Parse day range like "Fr-Sa" or "Mo-Fr" into array of day indices
 * Returns array of day numbers (0=Sun, 1=Mon, ..., 6=Sat)
 * Supports both German (Mo, Di, Mi) and English (Mo, Tu, We) day codes
 */
function parseDayRange(daysStr: string): number[] {
  const dayMap: Record<string, number> = {
    // German
    so: 0,
    mo: 1,
    di: 2,
    mi: 3,
    do: 4,
    fr: 5,
    sa: 6,
    // English (OSM/Google Places format)
    su: 0,
    tu: 2,
    we: 3,
    th: 4,
  };

  const lower = daysStr.toLowerCase().trim();
  const result: number[] = [];

  // Handle special keywords
  if (lower.includes("täglich") || lower.includes("daily")) {
    return [0, 1, 2, 3, 4, 5, 6];
  }
  if (lower.includes("weekend")) {
    return [0, 6]; // Sun, Sat
  }
  if (lower.includes("weekday")) {
    return [1, 2, 3, 4, 5]; // Mon-Fri
  }

  // Handle range like "mo-fr" or "fr-sa"
  const rangeMatch = lower.match(/(\w{2})\s*-\s*(\w{2})/);
  if (rangeMatch) {
    const startDay = rangeMatch[1];
    const endDay = rangeMatch[2];
    const startIdx = dayMap[startDay];
    const endIdx = dayMap[endDay];

    if (startIdx !== undefined && endIdx !== undefined) {
      if (startIdx <= endIdx) {
        // Normal range: Mo-Fr (1-5)
        for (let i = startIdx; i <= endIdx; i++) result.push(i);
      } else {
        // Wrapping range: Fr-Mo (5-1)
        for (let i = startIdx; i <= 6; i++) result.push(i);
        for (let i = 0; i <= endIdx; i++) result.push(i);
      }
      return result;
    }
  }

  // Handle individual days like "mo,we,fr" or single day "sa"
  for (const [dayCode, dayNum] of Object.entries(dayMap)) {
    // Use word boundary to avoid partial matches
    const pattern = new RegExp(`(^|[^a-z])${dayCode}([^a-z]|$)`);
    if (pattern.test(lower)) {
      result.push(dayNum);
    }
  }

  return [...new Set(result)]; // Remove duplicates
}

/**
 * Parse a single day+time rule like "Tu 09:00-00:00" or "Fr-Sa 23:00-05:00"
 * Returns true if currently open according to this rule, false otherwise
 */
function checkDayTimeRule(
  rule: string,
  currentDay: number,
  currentTime: number,
): boolean {
  const dayTimeMatch = rule.match(
    /([a-z]{2}(?:\s*-\s*[a-z]{2})?)\s+(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/i,
  );

  if (!dayTimeMatch) return false;

  const daysPart = dayTimeMatch[1];
  const startHour = parseInt(dayTimeMatch[2], 10);
  const startMin = parseInt(dayTimeMatch[3], 10);
  let endHour = parseInt(dayTimeMatch[4], 10);
  const endMin = parseInt(dayTimeMatch[5], 10);

  // Handle 00:00 as midnight (24:00) - end of day
  // So 09:00-00:00 means 09:00 to 24:00 (midnight)
  const endTime =
    endHour === 0 && endMin === 0 ? 24 * 60 : endHour * 60 + endMin;
  const startTime = startHour * 60 + startMin;
  const isOvernight = startTime > endTime;

  // Parse which days this applies to
  const applicableDays = parseDayRange(daysPart);

  // Check if current day is in the list
  if (applicableDays.includes(currentDay)) {
    // Check time range
    if (isOvernight) {
      // Overnight: open from startTime to midnight AND midnight to endTime
      if (currentTime >= startTime || currentTime <= endTime) {
        return true;
      }
    } else {
      // Normal hours - note: endTime can be 1440 (24:00) which is midnight
      if (currentTime >= startTime && currentTime < endTime) {
        return true;
      }
    }
  }

  // For overnight hours: check if we're in the early morning tail of yesterday's session
  if (isOvernight && currentTime <= endTime) {
    const yesterday = currentDay === 0 ? 6 : currentDay - 1;

    if (applicableDays.includes(yesterday)) {
      const isMultiDay = applicableDays.length > 1;
      const isLastDay = !applicableDays.includes(currentDay);

      if (!isMultiDay || !isLastDay) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a toilet is currently open based on opening_hours.
 * Returns: true (open), false (closed), null (unknown)
 */
export function isCurrentlyOpen(opening_hours?: string): boolean | null {
  if (!opening_hours) return null;

  // 24/7 is always open
  if (opening_hours === "24/7") return true;

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentTime = now.getHours() * 60 + now.getMinutes();

  // Check for seasonal restrictions: "Apr-Sep 08:00-20:00"
  const seasonalMatch = opening_hours.match(
    /([a-z]{3,4})\s*[-–]\s*([a-z]{3,4})[:\s]+(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/i,
  );
  if (seasonalMatch) {
    const startMonth = seasonalMatch[1].toLowerCase();
    const endMonth = seasonalMatch[2].toLowerCase();

    if (!isInSeason(startMonth, endMonth)) {
      return false; // Outside season = closed
    }

    // Inside season - check time
    const startHour = parseInt(seasonalMatch[3], 10);
    const startMin = parseInt(seasonalMatch[4], 10);
    const endHour = parseInt(seasonalMatch[5], 10);
    const endMin = parseInt(seasonalMatch[6], 10);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;
    return currentTime >= startTime && currentTime <= endTime;
  }

  // Handle multiple day rules separated by ;
  // e.g., "Su 09:00-00:00; Mo 09:00-00:00; Tu 09:00-00:00"
  const rules = opening_hours.split(";").map((r) => r.trim());
  let hasValidDayRule = false;

  for (const rule of rules) {
    // Check if this looks like a day+time rule before trying to parse it
    const looksLikeDayRule = /^[a-z]{2}/i.test(rule);
    if (looksLikeDayRule) {
      hasValidDayRule = true;
      if (checkDayTimeRule(rule, currentDay, currentTime)) {
        return true;
      }
    }
  }

  // If we found valid day rules but none matched, we're closed
  if (hasValidDayRule) {
    return false;
  }

  // Simple time only: "08:00-20:00" (applies to all days)
  const timeOnlyMatch = opening_hours.match(
    /^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/,
  );

  if (timeOnlyMatch) {
    const startHour = parseInt(timeOnlyMatch[1], 10);
    const startMin = parseInt(timeOnlyMatch[2], 10);
    const endHour = parseInt(timeOnlyMatch[3], 10);
    const endMin = parseInt(timeOnlyMatch[4], 10);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    }
    return currentTime >= startTime && currentTime <= endTime;
  }

  // If we can't parse it, return unknown
  return null;
}

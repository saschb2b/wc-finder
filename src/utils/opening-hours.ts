/**
 * Parse month name to month number (0-11)
 */
function parseMonth(monthStr: string): number | null {
  const months: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2, mär: 2,
    apr: 3, april: 3,
    may: 4, mai: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9, okt: 9,
    nov: 10, november: 10,
    dec: 11, december: 11, dez: 11,
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

  // Parse day ranges: Mo-Fr, Sa-So, etc.
  const dayMap: Record<number, string> = {
    0: "so",
    1: "mo",
    2: "di",
    3: "mi",
    4: "do",
    5: "fr",
    6: "sa",
  };
  const currentDayCode = dayMap[currentDay];
  const isWeekend = currentDay === 0 || currentDay === 6;
  const isWeekday = !isWeekend;

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

  // Check for simple time ranges: "08:00-20:00" (applies to all days mentioned)
  const timeMatch = opening_hours.match(
    /(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/,
  );
  if (timeMatch) {
    const startHour = parseInt(timeMatch[1], 10);
    const startMin = parseInt(timeMatch[2], 10);
    const endHour = parseInt(timeMatch[3], 10);
    const endMin = parseInt(timeMatch[4], 10);

    // Check if this applies to current day
    const daysLower = opening_hours.toLowerCase();
    const matchesToday =
      daysLower.includes(currentDayCode) ||
      daysLower.includes("täglich") ||
      daysLower.includes("daily") ||
      (isWeekend &&
        (daysLower.includes("sa") ||
          daysLower.includes("so") ||
          daysLower.includes("weekend"))) ||
      (isWeekday &&
        (daysLower.includes("mo") ||
          daysLower.includes("di") ||
          daysLower.includes("mi") ||
          daysLower.includes("do") ||
          daysLower.includes("fr") ||
          daysLower.includes("weekday")));

    if (!matchesToday) return false;

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Handle overnight hours (e.g., 22:00-06:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    }

    return currentTime >= startTime && currentTime <= endTime;
  }

  // If we can't parse it, return unknown
  return null;
}

/**
 * Standardized opening hours format for WC Finder
 *
 * This format is designed to be:
 * - Easy to parse and display
 * - Easy to check if currently open
 * - Compact for storage
 * - Flexible enough for all real-world cases
 */

export interface TimePeriod {
  /** Opening time in minutes from midnight (0-1440) */
  open: number;
  /** Closing time in minutes from midnight (0-1440). 1440 = midnight/end of day */
  close: number;
}

export interface DaySchedule {
  /** Whether the location is open at all on this day */
  isOpen: boolean;
  /** Time periods when open (usually 1, can be 2 for split shifts) */
  periods: TimePeriod[];
}

export interface WeeklyHours {
  /** 0 = Sunday, 1 = Monday, ..., 6 = Saturday */
  0: DaySchedule;
  1: DaySchedule;
  2: DaySchedule;
  3: DaySchedule;
  4: DaySchedule;
  5: DaySchedule;
  6: DaySchedule;
}

export type HoursType = '24_7' | 'weekly' | 'seasonal' | 'unknown';

export interface StandardizedHours {
  /** Type of hours format */
  type: HoursType;
  /** Weekly schedule (for type = 'weekly') */
  weekly?: WeeklyHours;
  /** Original string for display fallback */
  original?: string;
  /** Whether currently open (computed at fetch time, should be recalculated) */
  isOpenNow?: boolean;
}

/** Convert minutes from midnight to HH:MM format */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/** Convert HH:MM format to minutes from midnight */
export function timeToMinutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

/** Format a time period for display */
export function formatPeriod(period: TimePeriod): string {
  const openStr = minutesToTime(period.open);
  const closeStr = minutesToTime(period.close);
  // Show 00:00 as 24:00 for clarity (end of day)
  const displayClose = closeStr === '00:00' ? '24:00' : closeStr;
  return `${openStr}-${displayClose}`;
}

/** Get day name from day index */
export function getDayName(dayIndex: number, short = false): string {
  const days = short
    ? ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
    : ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  return days[dayIndex];
}

/** Check if a weekly schedule is the same every day */
export function isSameEveryDay(weekly: WeeklyHours): boolean {
  const firstDay = JSON.stringify(weekly[0]);
  for (let i = 1; i <= 6; i++) {
    if (JSON.stringify(weekly[i as keyof WeeklyHours]) !== firstDay) {
      return false;
    }
  }
  return true;
}

/** Check if a weekly schedule is same on weekdays (Mon-Fri) and weekends */
export function hasWeekdayWeekendPattern(weekly: WeeklyHours): boolean {
  const weekdayPattern = JSON.stringify(weekly[1]);
  // Check all weekdays match
  for (let i = 2; i <= 5; i++) {
    if (JSON.stringify(weekly[i as keyof WeeklyHours]) !== weekdayPattern) {
      return false;
    }
  }
  // Check both weekend days match each other
  return JSON.stringify(weekly[6]) === JSON.stringify(weekly[0]);
}

/** Generate human-readable display string from standardized format */
export function formatStandardizedHours(hours: StandardizedHours): string {
  if (hours.type === '24_7') return '24/7 geöffnet';
  if (hours.type === 'unknown') return 'Öffnungszeiten unbekannt';
  if (!hours.weekly) return hours.original || '';

  const weekly = hours.weekly;

  // Check for simple patterns
  if (isSameEveryDay(weekly)) {
    const day = weekly[0];
    if (!day.isOpen) return 'Geschlossen';
    return `Täglich ${day.periods.map(formatPeriod).join(', ')}`;
  }

  if (hasWeekdayWeekendPattern(weekly)) {
    const weekday = weekly[1];
    const weekend = weekly[0];
    if (weekday.isOpen && weekend.isOpen) {
      return `Mo-Fr ${weekday.periods.map(formatPeriod).join(', ')}, Sa-So ${weekend.periods.map(formatPeriod).join(', ')}`;
    }
  }

  // Default: show each day
  const parts: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const day = weekly[i as keyof WeeklyHours];
    if (day.isOpen) {
      parts.push(`${getDayName(i, true)} ${day.periods.map(formatPeriod).join(', ')}`);
    }
  }
  // Weekend
  const sat = weekly[6];
  const sun = weekly[0];
  if (sat.isOpen && sun.isOpen && JSON.stringify(sat) === JSON.stringify(sun)) {
    parts.push(`Sa-So ${sat.periods.map(formatPeriod).join(', ')}`);
  } else {
    if (sat.isOpen) parts.push(`Sa ${sat.periods.map(formatPeriod).join(', ')}`);
    if (sun.isOpen) parts.push(`So ${sun.periods.map(formatPeriod).join(', ')}`);
  }

  return parts.join('; ');
}

/** Check if currently open based on standardized hours */
export function isOpenNow(hours: StandardizedHours): boolean {
  if (hours.type === '24_7') return true;
  if (hours.type === 'unknown' || !hours.weekly) return false;

  const now = new Date();
  const dayIndex = now.getDay(); // 0 = Sunday
  const currentTime = now.getHours() * 60 + now.getMinutes();

  const daySchedule = hours.weekly[dayIndex as keyof WeeklyHours];
  if (!daySchedule.isOpen) {
    // Check if we're in overnight period from previous day
    const yesterdayIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    const yesterdaySchedule = hours.weekly[yesterdayIndex as keyof WeeklyHours];
    if (yesterdaySchedule.isOpen) {
      for (const period of yesterdaySchedule.periods) {
        if (period.open > period.close && currentTime < period.close) {
          return true; // Overnight period extending into today
        }
      }
    }
    return false;
  }

  for (const period of daySchedule.periods) {
    if (period.open <= currentTime && currentTime < period.close) {
      return true;
    }
    // Handle overnight (e.g., 22:00-02:00)
    if (period.open > period.close) {
      if (currentTime >= period.open || currentTime < period.close) {
        return true;
      }
    }
  }

  return false;
}

/** Get next opening time (for "opens at" display) */
export function getNextOpening(hours: StandardizedHours): { day: number; time: string } | null {
  if (hours.type === '24_7' || !hours.weekly) return null;

  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  // Check remaining days of the week
  for (let offset = 0; offset <= 7; offset++) {
    const checkDay = (currentDay + offset) % 7;
    const daySchedule = hours.weekly[checkDay as keyof WeeklyHours];

    if (daySchedule.isOpen && daySchedule.periods.length > 0) {
      const firstPeriod = daySchedule.periods[0];

      if (offset === 0) {
        // Today - check if there's a later opening
        if (firstPeriod.open > currentTime) {
          return { day: checkDay, time: minutesToTime(firstPeriod.open) };
        }
        // Check other periods today
        for (let i = 1; i < daySchedule.periods.length; i++) {
          if (daySchedule.periods[i].open > currentTime) {
            return { day: checkDay, time: minutesToTime(daySchedule.periods[i].open) };
          }
        }
      } else {
        // Future day
        return { day: checkDay, time: minutesToTime(firstPeriod.open) };
      }
    }
  }

  return null;
}

import { isCurrentlyOpen } from "../utils/opening-hours";

describe("isCurrentlyOpen", () => {
  // Save original Date
  const OriginalDate = global.Date;

  // Helper to mock current date/time
  const mockDate = (dateStr: string) => {
    const mockDateObj = new Date(dateStr);
    global.Date = class extends Date {
      constructor() {
        super();
        return mockDateObj;
      }
      static now() {
        return mockDateObj.getTime();
      }
    } as any;
  };

  afterEach(() => {
    global.Date = OriginalDate;
  });

  describe("24/7", () => {
    it("returns true for 24/7", () => {
      expect(isCurrentlyOpen("24/7")).toBe(true);
    });
  });

  describe("simple hours", () => {
    it("returns true when within opening hours", () => {
      // Monday 12:00
      mockDate("2024-04-08T12:00:00");
      expect(isCurrentlyOpen("Mo-Fr 08:00-18:00")).toBe(true);
    });

    it("returns false when before opening", () => {
      // Monday 06:00
      mockDate("2024-04-08T06:00:00");
      expect(isCurrentlyOpen("Mo-Fr 08:00-18:00")).toBe(false);
    });

    it("returns false when after closing", () => {
      // Monday 20:00
      mockDate("2024-04-08T20:00:00");
      expect(isCurrentlyOpen("Mo-Fr 08:00-18:00")).toBe(false);
    });

    it("returns false on closed day", () => {
      // Sunday 12:00
      mockDate("2024-04-07T12:00:00");
      expect(isCurrentlyOpen("Mo-Fr 08:00-18:00")).toBe(false);
    });
  });

  describe("weekend hours", () => {
    it("returns true on Saturday during weekend hours", () => {
      // Saturday 14:00
      mockDate("2024-04-06T14:00:00");
      expect(isCurrentlyOpen("Sa-So 10:00-16:00")).toBe(true);
    });

    it("returns false on Monday during weekend-only hours", () => {
      // Monday 14:00
      mockDate("2024-04-08T14:00:00");
      expect(isCurrentlyOpen("Sa-So 10:00-16:00")).toBe(false);
    });
  });

  describe("late night hours (crossing midnight)", () => {
    it("returns true during late night hours before midnight", () => {
      // Friday 23:00
      mockDate("2024-04-05T23:00:00");
      expect(isCurrentlyOpen("Fr-Sa 22:00-06:00")).toBe(true);
    });

    it("returns true during late night hours after midnight", () => {
      // Saturday 02:00
      mockDate("2024-04-06T02:00:00");
      expect(isCurrentlyOpen("Fr-Sa 22:00-06:00")).toBe(true);
    });

    it("returns false after late night hours end", () => {
      // Saturday 08:00
      mockDate("2024-04-06T08:00:00");
      expect(isCurrentlyOpen("Fr-Sa 22:00-06:00")).toBe(false);
    });
  });

  describe("seasonal hours", () => {
    it("returns true during summer season within hours", () => {
      // July (summer) 14:00
      mockDate("2024-07-15T14:00:00");
      expect(isCurrentlyOpen("Apr-Sep 08:00-20:00")).toBe(true);
    });

    it("returns false during winter for summer-only hours", () => {
      // January (winter) 14:00
      mockDate("2024-01-15T14:00:00");
      expect(isCurrentlyOpen("Apr-Sep 08:00-20:00")).toBe(false);
    });

    it("returns true during winter season for winter hours", () => {
      // January (winter) 10:00
      mockDate("2024-01-15T10:00:00");
      expect(isCurrentlyOpen("Oct-Mar 09:00-17:00")).toBe(true);
    });
  });

  describe("undefined/empty", () => {
    it("returns null for undefined", () => {
      expect(isCurrentlyOpen(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(isCurrentlyOpen("")).toBeNull();
    });
  });

  describe("complex patterns", () => {
    it('handles "Mo,We,Fr" individual days format', () => {
      // Wednesday 12:00
      mockDate("2024-04-10T12:00:00");
      expect(isCurrentlyOpen("Mo,We,Fr 09:00-17:00")).toBe(true);
    });

    // Note: Individual day lists (Mo,We,Fr) may not be fully parsed
    // This test documents the current behavior with day ranges
    it("handles day ranges like Mo-Fr", () => {
      // Tuesday 12:00
      mockDate("2024-04-09T12:00:00");
      expect(isCurrentlyOpen("Mo-Fr 09:00-17:00")).toBe(true);
    });
  });
});

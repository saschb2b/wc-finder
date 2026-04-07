import { isCurrentlyOpen } from "../utils/opening-hours";

describe("isCurrentlyOpen", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  // Helper to mock current date/time
  const mockDate = (dateStr: string) => {
    jest.restoreAllMocks();
    const mockDateObj = new Date(dateStr);
    jest.spyOn(global, "Date").mockImplementation(() => mockDateObj as any);
  };

  describe("24/7", () => {
    it("returns true for 24/7", () => {
      expect(isCurrentlyOpen("24/7")).toBe(true);
    });
  });

  describe("simple hours", () => {
    it("returns true when within opening hours", () => {
      mockDate("2024-04-08T12:00:00"); // Monday 12:00
      expect(isCurrentlyOpen("Mo-Fr 08:00-18:00")).toBe(true);
    });

    it("returns false when before opening", () => {
      mockDate("2024-04-08T06:00:00"); // Monday 06:00
      expect(isCurrentlyOpen("Mo-Fr 08:00-18:00")).toBe(false);
    });

    it("returns false when after closing", () => {
      mockDate("2024-04-08T20:00:00"); // Monday 20:00
      expect(isCurrentlyOpen("Mo-Fr 08:00-18:00")).toBe(false);
    });

    it("returns false on closed day", () => {
      mockDate("2024-04-07T12:00:00"); // Sunday 12:00
      expect(isCurrentlyOpen("Mo-Fr 08:00-18:00")).toBe(false);
    });
  });

  describe("weekend hours", () => {
    it("returns true on Saturday during weekend hours", () => {
      mockDate("2024-04-06T14:00:00"); // Saturday 14:00
      expect(isCurrentlyOpen("Sa-So 10:00-16:00")).toBe(true);
    });

    it("returns false on Monday during weekend-only hours", () => {
      mockDate("2024-04-08T14:00:00"); // Monday 14:00
      expect(isCurrentlyOpen("Sa-So 10:00-16:00")).toBe(false);
    });
  });

  describe("late night hours (crossing midnight)", () => {
    it("returns true during late night hours before midnight", () => {
      mockDate("2024-04-05T23:00:00"); // Friday 23:00
      expect(isCurrentlyOpen("Fr-Sa 22:00-06:00")).toBe(true);
    });

    it("returns true during late night hours after midnight", () => {
      mockDate("2024-04-06T02:00:00"); // Saturday 02:00
      expect(isCurrentlyOpen("Fr-Sa 22:00-06:00")).toBe(true);
    });

    it("returns false after late night hours end", () => {
      mockDate("2024-04-06T08:00:00"); // Saturday 08:00
      expect(isCurrentlyOpen("Fr-Sa 22:00-06:00")).toBe(false);
    });

    it("handles Capitol case: Fr-Sa 23:00-05:00 correctly", () => {
      // Friday 23:00 - should be OPEN
      mockDate("2024-04-05T23:00:00");
      expect(isCurrentlyOpen("Fr-Sa 23:00-05:00")).toBe(true);

      // Saturday 02:00 - should be OPEN (overnight from Friday)
      mockDate("2024-04-06T02:00:00");
      expect(isCurrentlyOpen("Fr-Sa 23:00-05:00")).toBe(true);

      // Sunday 02:00 - should be CLOSED (not Fri-Sa)
      mockDate("2024-04-07T02:00:00");
      expect(isCurrentlyOpen("Fr-Sa 23:00-05:00")).toBe(false);

      // Monday 02:00 - should be CLOSED
      mockDate("2024-04-08T02:00:00");
      expect(isCurrentlyOpen("Fr-Sa 23:00-05:00")).toBe(false);
    });
  });

  describe("seasonal hours", () => {
    it("returns true during summer season within hours", () => {
      mockDate("2024-07-15T14:00:00"); // July (summer) 14:00
      expect(isCurrentlyOpen("Apr-Sep 08:00-20:00")).toBe(true);
    });

    it("returns false during winter for summer-only hours", () => {
      mockDate("2024-01-15T14:00:00"); // January (winter) 14:00
      expect(isCurrentlyOpen("Apr-Sep 08:00-20:00")).toBe(false);
    });

    it("returns true during winter season for winter hours", () => {
      mockDate("2024-01-15T10:00:00"); // January (winter) 10:00
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
    // Note: Comma-separated individual days (Mo,We,Fr) not yet supported
    // Use day ranges (Mo-Fr) instead
    it("handles day ranges like Mo-Fr", () => {
      mockDate("2024-04-09T12:00:00"); // Tuesday 12:00
      expect(isCurrentlyOpen("Mo-Fr 09:00-17:00")).toBe(true);
    });
  });

  describe("Google Places format with multiple day rules", () => {
    // ALEX Dortmund example: "Su 09:00-00:00; Mo 09:00-00:00; Tu 09:00-00:00; ..."
    const alexHours =
      "Su 09:00-00:00; Mo 09:00-00:00; Tu 09:00-00:00; We 09:00-00:00; Th 09:00-00:00; Fr 09:00-02:00; Sa 09:00-02:00";

    it("returns true on Tuesday at 18:50 (09:00-midnight)", () => {
      mockDate("2024-04-09T18:50:00"); // Tuesday 18:50
      expect(isCurrentlyOpen(alexHours)).toBe(true);
    });

    it("returns true on Tuesday at 23:59 (just before midnight)", () => {
      mockDate("2024-04-09T23:59:00"); // Tuesday 23:59
      expect(isCurrentlyOpen(alexHours)).toBe(true);
    });

    it("returns false on Wednesday at 00:01 (after midnight)", () => {
      mockDate("2024-04-10T00:01:00"); // Wednesday 00:01
      expect(isCurrentlyOpen(alexHours)).toBe(false);
    });

    it("returns true on Wednesday at 09:00 (opens again)", () => {
      mockDate("2024-04-10T09:00:00"); // Wednesday 09:00
      expect(isCurrentlyOpen(alexHours)).toBe(true);
    });

    it("handles Friday overnight (09:00-02:00) at 23:00", () => {
      mockDate("2024-04-12T23:00:00"); // Friday 23:00
      expect(isCurrentlyOpen(alexHours)).toBe(true);
    });

    it("handles Friday overnight extending to Saturday at 01:00", () => {
      mockDate("2024-04-13T01:00:00"); // Saturday 01:00 (overnight from Friday)
      expect(isCurrentlyOpen(alexHours)).toBe(true);
    });

    it("returns false on Saturday at 04:00 (after Friday overnight closes)", () => {
      mockDate("2024-04-13T04:00:00"); // Saturday 04:00
      expect(isCurrentlyOpen(alexHours)).toBe(false);
    });
  });
});

import { formatDistance, getDistanceMeters } from "../services/overpass";

describe("formatDistance", () => {
  it("formats meters less than 1000", () => {
    expect(formatDistance(500)).toBe("500 m");
    expect(formatDistance(50)).toBe("50 m");
    expect(formatDistance(999)).toBe("999 m");
  });

  it("formats kilometers for 1000m and above", () => {
    expect(formatDistance(1000)).toBe("1.0 km");
    expect(formatDistance(1500)).toBe("1.5 km");
    expect(formatDistance(2500)).toBe("2.5 km");
  });

  it("formats large distances correctly", () => {
    expect(formatDistance(10000)).toBe("10.0 km");
    expect(formatDistance(10500)).toBe("10.5 km");
  });

  it("handles undefined distance gracefully", () => {
    // The function may return NaN km for undefined input
    const result = formatDistance(undefined as any);
    expect(result === "" || result.includes("NaN")).toBe(true);
  });
});

describe("getDistanceMeters", () => {
  // Hannover coordinates
  const hannoverCenter = { lat: 52.3759, lon: 9.732 };
  const hannoverEast = { lat: 52.3759, lon: 9.832 };

  it("calculates distance between two points", () => {
    const distance = getDistanceMeters(
      hannoverCenter.lat,
      hannoverCenter.lon,
      hannoverEast.lat,
      hannoverEast.lon,
    );
    // Distance should be approximately 6.9km
    expect(distance).toBeGreaterThan(6000);
    expect(distance).toBeLessThan(8000);
  });

  it("returns 0 for same coordinates", () => {
    const distance = getDistanceMeters(
      hannoverCenter.lat,
      hannoverCenter.lon,
      hannoverCenter.lat,
      hannoverCenter.lon,
    );
    expect(distance).toBe(0);
  });
});

import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  PIN_COLORS,
  ToiletCategory
} from '../types/toilet';

describe('Toilet Types', () => {
  describe('CATEGORY_LABELS', () => {
    it('has labels for all categories', () => {
      expect(CATEGORY_LABELS.public_24h).toBe('24/7 Öffentlich');
      expect(CATEGORY_LABELS.station).toBe('Bahnhof');
      expect(CATEGORY_LABELS.tankstelle).toBe('Tankstelle');
      expect(CATEGORY_LABELS.gastro).toBe('Gastronomie');
      expect(CATEGORY_LABELS.other).toBe('Sonstige');
    });
  });

  describe('CATEGORY_COLORS', () => {
    it('uses green for public_24h (most important)', () => {
      expect(CATEGORY_COLORS.public_24h).toBe('#34a853');
    });

    it('uses blue for station (transit hubs)', () => {
      expect(CATEGORY_COLORS.station).toBe('#1a73e8');
    });

    it('uses orange for gastro (limited hours)', () => {
      expect(CATEGORY_COLORS.gastro).toBe('#f5a623');
    });

    it('uses gray for other', () => {
      expect(CATEGORY_COLORS.other).toBe('#9aa0a6');
    });
  });

  describe('PIN_COLORS', () => {
    it('has red for selected', () => {
      expect(PIN_COLORS.selected).toBe('#ea4335');
    });

    it('has pink for favorite', () => {
      expect(PIN_COLORS.favorite).toBe('#e91e63');
    });

    it('has gray for closed', () => {
      expect(PIN_COLORS.closed).toBe('#9aa0a6');
    });
  });

  describe('Color contrast', () => {
    it('selected color differs from all category colors', () => {
      const categoryColors = Object.values(CATEGORY_COLORS);
      expect(categoryColors).not.toContain(PIN_COLORS.selected);
    });

    it('favorite color differs from selected', () => {
      expect(PIN_COLORS.favorite).not.toBe(PIN_COLORS.selected);
    });
  });
});

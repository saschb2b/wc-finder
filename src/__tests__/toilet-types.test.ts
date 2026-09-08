import { CATEGORY_COLORS, PIN_COLORS } from '../types/toilet';
import { categoryLabel, setLocale } from '../i18n';

describe('Toilet Types', () => {
  describe('categoryLabel', () => {
    afterEach(() => setLocale('de'));
    it('has German labels for all categories by default', () => {
      expect(categoryLabel('public_24h')).toBe('24/7 Öffentlich');
      expect(categoryLabel('station')).toBe('Bahnhof');
      expect(categoryLabel('tankstelle')).toBe('Tankstelle');
      expect(categoryLabel('gastro')).toBe('Gastronomie');
      expect(categoryLabel('other')).toBe('Sonstige');
    });
    it('switches to English', () => {
      setLocale('en');
      expect(categoryLabel('station')).toBe('Station');
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

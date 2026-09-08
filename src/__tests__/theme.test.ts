import { light, dark } from "../theme/colors";

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("both palettes define the same tokens", () => {
  expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
});

test.each([["light", light], ["dark", dark]] as const)("%s text meets WCAG AA on its surfaces", (_, c) => {
  for (const surface of [c.surface, c.surfaceAlt, c.background]) {
    expect(contrast(c.text, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.textSecondary, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.link, surface)).toBeGreaterThanOrEqual(4.5);
  }
  expect(contrast(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(c.successText, c.successSoft)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(c.dangerText, c.dangerSoft)).toBeGreaterThanOrEqual(4.5);
});

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import tokens from "../src/design/tokens.json";

const luminance = (hex: string) => {
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (a: string, b: string) => {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
describe("shared website and native presentation contract", () => {
  it("keeps generated palettes and native launch colors aligned with the source", () => {
    expect(() =>
      execFileSync(
        process.execPath,
        ["scripts/build-design-tokens.mjs", "--check", "--native-config"],
        { stdio: "pipe" },
      ),
    ).not.toThrow();
  });
  for (const mode of ["light", "dark"] as const) {
    it(`${mode}: body, supporting, action and status text meet 4.5:1 on their actual token surfaces`, () => {
      const palette = tokens[mode];
      for (const background of ["paper", "surface", "tint"] as const)
        for (const foreground of ["ink", "muted", "action"] as const)
          expect(
            contrast(palette[foreground], palette[background]),
            `${foreground}/${background}`,
          ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(palette["action-ink"], palette.action),
      ).toBeGreaterThanOrEqual(4.5);
      for (const status of ["danger", "success", "warning", "info"] as const)
        expect(
          contrast(palette[status], palette[`${status}-bg`]),
          status,
        ).toBeGreaterThanOrEqual(4.5);
    });
    it(`${mode}: necessary field boundaries and focus meet 3:1`, () => {
      for (const background of [
        tokens[mode].paper,
        tokens[mode].surface,
        tokens[mode].tint,
      ]) {
        expect(
          contrast(tokens[mode]["field-border"], background),
        ).toBeGreaterThanOrEqual(3);
        expect(contrast(tokens[mode].focus, background)).toBeGreaterThanOrEqual(
          3,
        );
      }
    });
  }
});

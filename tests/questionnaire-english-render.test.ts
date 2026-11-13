import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Questionnaire } from "../src/components/Questionnaire";
import { LocaleProvider, QuestionTextProvider } from "../src/components/i18n/LocaleProvider";
import { formDisplay, Overlay, textHash } from "../src/lib/content-translation/segments";
import { normalizeSignup } from "../src/lib/signup-schema";
import { randomizedOptions } from "../src/lib/questionnaire-model";

// Server-rendered markup of the real filler: in English mode every option label must
// belong to the canonical value it submits, including randomized option order.
const sports = ["足球", "篮球", "排球", "羽毛球", "乒乓球", "网球"];
const english: Record<string, string> = { 足球: "Football", 篮球: "Basketball", 排球: "Volleyball", 羽毛球: "Badminton", 乒乓球: "Table tennis", 网球: "Tennis", 喜欢的运动: "Favorite sport", 合成问卷: "Synthetic form" };
const form = normalizeSignup({ enabled: true, title: "合成问卷", questions: [
  { id: "sport", label: "喜欢的运动", type: "single", required: true, options: sports, randomize: true },
] });
const display = formDisplay(form, new Overlay(Object.fromEntries(Object.entries(english).map(([zh, en]) => [textHash(zh), en]))));

function render(locale: "zh" | "en", seed: number) {
  vi.spyOn(Math, "random").mockReturnValue(seed);
  try {
    return renderToStaticMarkup(createElement(LocaleProvider, { locale, children:
      createElement(QuestionTextProvider, { display, children: createElement(Questionnaire, { form }) }) }));
  } finally {
    vi.restoreAllMocks();
  }
}
const labels = (html: string) => [...html.matchAll(/<label class="signup-choice questionnaire-option"><input[^>]*\/>([^<]*)<\/label>/g)].map((match) => match[1]);

describe("English questionnaire rendering", () => {
  it("labels follow the shuffled canonical values", () => {
    for (const seed of [0.1, 0.42, 0.9]) {
      const order = randomizedOptions(sports, String(seed) + "sport");
      expect(order).not.toEqual(sports);
      expect(labels(render("en", seed))).toEqual(order.map((value) => english[value]));
      expect(labels(render("zh", seed))).toEqual(order);
    }
  });
  it("renders English chrome and the translated question, Chinese by default", () => {
    const en = render("en", 0.5), zh = render("zh", 0.5);
    expect(en).toContain("Favorite sport");
    expect(en).toContain("Review and submit");
    expect(zh).toContain("喜欢的运动");
    expect(zh).toContain("核对并提交");
    expect(zh).not.toContain("Football");
  });
});

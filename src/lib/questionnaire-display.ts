import type { Answer, EntryField, Question } from "./signup-schema";
import type { FormDisplay } from "./content-translation/segments";
import type { Locale } from "./i18n/locale";

/*
 * Display-only questionnaire text. `form.questions[*].options`, `rows` and group-field
 * `options` are the canonical answer values and are never replaced; these helpers map a
 * value to the label shown in the current language, falling back to the value itself.
 * Answers, validation, branching and submissions keep using the original values.
 */
export type { FormDisplay };

function lookup(pairs: [string, string][] | undefined, value: string) {
  if (!Array.isArray(pairs)) return undefined;
  const match = pairs.find((pair) => Array.isArray(pair) && pair[0] === value);
  return match && typeof match[1] === "string" && match[1] ? match[1] : undefined;
}

export class QuestionText {
  constructor(
    private readonly display: FormDisplay | null | undefined,
    readonly locale: Locale = display ? "en" : "zh",
  ) {}
  private entry(q: Pick<Question, "id">) {
    const questions = this.display?.questions;
    return questions && Object.hasOwn(questions, q.id) ? questions[q.id] : undefined;
  }
  title(value: string | undefined) {
    return this.display?.title || value || "";
  }
  intro(value: string) {
    return this.display?.intro || value;
  }
  completion(value: string | undefined) {
    return this.display?.completionMessage || value || "";
  }
  label(q: Pick<Question, "id" | "label">) {
    return this.entry(q)?.label || q.label;
  }
  help(q: Pick<Question, "id" | "help">) {
    return this.entry(q)?.help || q.help || "";
  }
  placeholder(q: Pick<Question, "id" | "placeholder">) {
    return this.entry(q)?.placeholder || q.placeholder;
  }
  /**
   * Label of an option *value*. Looked up by the canonical value itself, so shuffled,
   * filtered or re-sorted option lists always show the label of the value submitted.
   */
  option(q: Pick<Question, "id">, value: string) {
    return lookup(this.entry(q)?.options, value) || value;
  }
  row(q: Pick<Question, "id">, value: string) {
    return lookup(this.entry(q)?.rows, value) || value;
  }
  private field(q: Pick<Question, "id">, field: Pick<EntryField, "id">) {
    const fields = this.entry(q)?.fields;
    return fields && Object.hasOwn(fields, field.id) ? fields[field.id] : undefined;
  }
  fieldLabel(q: Pick<Question, "id">, field: Pick<EntryField, "id" | "label">) {
    return this.field(q, field)?.label || field.label;
  }
  fieldPlaceholder(q: Pick<Question, "id">, field: Pick<EntryField, "id" | "placeholder">) {
    return this.field(q, field)?.placeholder || field.placeholder;
  }
  fieldOption(q: Pick<Question, "id">, field: Pick<EntryField, "id">, value: string) {
    return lookup(this.field(q, field)?.options, value) || value;
  }
  /** Review/receipt text for an answer, in the current language. */
  answer(answer: Answer | undefined, q: Question): string {
    const en = this.locale === "en";
    const empty = en ? "Not answered" : "未填写";
    if (answer == null || answer === "") return empty;
    if (Array.isArray(answer)) {
      const objects = answer.some((value) => typeof value === "object");
      return (
        answer
          .map((entry, index) =>
            typeof entry === "string"
              ? this.option(q, entry)
              : (en ? `Entry ${index + 1}: ` : `第 ${index + 1} 条：`) +
                Object.entries(entry)
                  .map(([key, value]) => {
                    const field = q.fields?.find((item) => item.id === key);
                    const shown = field && value ? this.fieldOption(q, field, value) : value;
                    return `${field ? this.fieldLabel(q, field) : key}${en ? ": " : "："}${shown || empty}`;
                  })
                  .join(en ? "; " : "；"),
          )
          .join(objects ? "\n" : en ? ", " : "、") || empty
      );
    }
    if (typeof answer === "object")
      return Object.entries(answer)
        .map(([row, value]) => {
          const shown = q.type === "blanks"
            ? (typeof value === "string" && value) || empty
            : Array.isArray(value)
            ? value.map((item) => this.option(q, item)).join(en ? ", " : "、") || empty
            : value ? this.option(q, value) : empty;
          return `${this.row(q, row)}${en ? ": " : "："}${shown}`;
        })
        .join("\n");
    return ["single", "select"].includes(q.type) ? this.option(q, answer) : answer;
  }
}

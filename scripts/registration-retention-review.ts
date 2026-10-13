import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildRetentionReview,
  RetentionReviewInputError,
} from "../src/lib/registration-retention-review";

const usage =
  "tsx scripts/registration-retention-review.ts --input METADATA.json --as-of ISO_TIME [--output NEW_REPORT.json]";
function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    console.log(usage);
    return;
  }
  const options: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i],
      value = args[i + 1];
    if (
      !["--input", "--as-of", "--output"].includes(key) ||
      options[key] ||
      !value ||
      value.startsWith("--")
    )
      throw new RetentionReviewInputError(
        "不支持的参数。本工具只生成元数据审查清单，不提供执行或删除模式。",
      );
    options[key] = value;
  }
  if (!options["--input"] || !options["--as-of"])
    throw new RetentionReviewInputError(usage);
  const input = resolve(options["--input"]),
    output = options["--output"] && resolve(options["--output"]);
  if (output === input || statSync(input).size > 4 * 1024 * 1024)
    throw new RetentionReviewInputError(
      "输入不能超过4MiB，且报告不能覆盖输入。",
    );
  const report = buildRetentionReview(
    JSON.parse(readFileSync(input, "utf8")),
    options["--as-of"],
  );
  const text = JSON.stringify(report, null, 2) + "\n";
  if (output) writeFileSync(output, text, { flag: "wx", mode: 0o600 });
  else process.stdout.write(text);
}
try {
  main();
} catch (cause) {
  console.error(
    cause instanceof RetentionReviewInputError
      ? cause.message
      : "清单生成失败。请检查JSON元数据及输出目的地；输出须为新文件。",
  );
  process.exitCode = 1;
}

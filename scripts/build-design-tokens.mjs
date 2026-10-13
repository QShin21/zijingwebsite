import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Pure local presentation generation. No environment, database or network access.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(
  fs.readFileSync(path.join(root, "src/design/tokens.json"), "utf8"),
);
const check = process.argv.includes("--check");
const configureNative = process.argv.includes("--native-config");
const declarations = (values) =>
  Object.entries(values)
    .map(([key, value]) => `  --z-${key}: ${value};`)
    .join("\n");
const aliases = {
  "stage-bg": "paper",
  "stage-ink": "ink",
  "stage-muted": "muted",
  "stage-action": "action",
  "stage-action-ink": "action-ink",
};
const withAliases = (values) => ({
  ...values,
  ...Object.fromEntries(
    Object.entries(aliases).map(([key, target]) => [key, `var(--z-${target})`]),
  ),
});
const css = `/* Generated from src/design/tokens.json. Run node scripts/build-design-tokens.mjs. */\n:root {\n  color-scheme: light;\n${declarations(withAliases(source.light))}\n${declarations(source.shared)}\n}\n:root[data-z-theme="dark"] {\n  color-scheme: dark;\n${declarations(withAliases(source.dark))}\n}\n`;
const nativeAliases = {
  page: "paper",
  text: "ink",
  surface: "surface",
  control: "field",
  controlBorder: "field-border",
  brand: "purple",
  secondaryText: "purple",
  subtitle: "muted",
  line: "line",
  media: "media",
  muted: "muted",
  badgeText: "purple",
  badgeBg: "tint",
  badgeBorder: "line",
  primary: "action",
  onPrimary: "action-ink",
  secondaryBg: "tint",
  secondaryBorder: "field-border",
  link: "purple",
  dangerText: "danger",
  dangerBg: "danger-bg",
  dangerBorder: "danger-line",
  positive: "success",
  positiveBorder: "success-line",
  positiveBg: "success-bg",
  positiveText: "success",
  positiveLine: "success-line",
  errorBg: "danger-bg",
  errorBorder: "danger-line",
  errorText: "danger",
  selectedText: "purple",
  selectedBg: "tint",
  fieldBg: "field",
  fieldBorder: "field-border",
  body: "ink",
  focus: "focus",
  halo: "tint",
  heroBorder: "line",
  heroStart: "paper",
  heroMiddle: "paper",
  heroEnd: "paper",
  heroDescription: "muted",
  orbitOuter: "line",
  orbitMiddle: "muted",
  orbitInner: "purple",
  letter: "purple",
  artShadow: "media",
  joinBg: "tint",
  teamStart: "surface",
  teamEnd: "surface",
  disabledText: "disabled-ink",
  disabledBg: "disabled-bg",
  disabledBorder: "line",
  imageBorder: "line",
  shadow: "shadow",
  videoSurface: "dark",
  warningText: "warning",
  warningBg: "warning-bg",
  warningBorder: "warning-line",
  infoText: "info",
  infoBg: "info-bg",
  infoBorder: "info-line",
};
const tokens = {},
  chrome = {};
for (const mode of ["light", "dark"]) {
  const palette = source[mode];
  tokens[mode] = {
    ...Object.fromEntries(
      Object.entries(nativeAliases).map(([key, target]) => [
        key,
        palette[target],
      ]),
    ),
    heroShade: "none",
  };
  chrome[mode] = {
    frontColor: mode === "light" ? "#000000" : "#ffffff",
    background: palette["header-bg"],
    tabBg: palette["header-bg"],
    tabText: palette.muted,
    tabSelected: palette.action,
    borderStyle: mode === "light" ? "black" : "white",
    textStyle: mode === "light" ? "dark" : "light",
  };
}
const native = `// Generated from src/design/tokens.json. Do not edit by hand.\nmodule.exports = ${JSON.stringify({ tokens, chrome }, null, 2)};\n`;
const outputs = new Map([
  ["src/components/visual-direction/tokens.css", css],
  ["miniprogram/src/lib/design-tokens.js", native],
]);
if (configureNative) {
  const filename = "miniprogram/src/app.json";
  const app = JSON.parse(fs.readFileSync(path.join(root, filename), "utf8"));
  app.window = {
    ...app.window,
    navigationBarBackgroundColor: chrome.light.background,
    navigationBarTextStyle: "black",
    backgroundColor: tokens.light.page,
    backgroundTextStyle: "dark",
  };
  app.tabBar = {
    ...app.tabBar,
    color: chrome.light.tabText,
    selectedColor: chrome.light.tabSelected,
    backgroundColor: chrome.light.tabBg,
    borderStyle: "black",
  };
  outputs.set(filename, JSON.stringify(app, null, 2) + "\n");
  for (const page of app.pages) {
    const relative = `miniprogram/src/${page}.json`;
    const config = JSON.parse(
      fs.readFileSync(path.join(root, relative), "utf8"),
    );
    config.navigationBarBackgroundColor = chrome.light.background;
    config.navigationBarTextStyle = "black";
    config.backgroundColor = tokens.light.page;
    outputs.set(relative, JSON.stringify(config, null, 2) + "\n");
  }
}
let stale = false;
for (const [relative, content] of outputs) {
  const filename = path.join(root, relative);
  if (check) {
    if (
      !fs.existsSync(filename) ||
      fs.readFileSync(filename, "utf8") !== content
    ) {
      console.error(`Outdated design output: ${relative}`);
      stale = true;
    }
  } else {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, content);
  }
}
if (stale) process.exitCode = 1;
else
  console.log(
    `${check ? "Checked" : "Generated"} ${outputs.size} shared design outputs.`,
  );

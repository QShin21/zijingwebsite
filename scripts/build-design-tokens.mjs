import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Pure local presentation generation (V2 "紫荆赛场"). No environment, database or network access.
// Outputs: website token CSS, native mini program tokens and, with --native-config,
// the native launch/tab colors in app.json and every page JSON.
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
const css = `/* Generated from src/design/tokens.json. Run node scripts/build-design-tokens.mjs. */\n:root {\n  color-scheme: light;\n${declarations(source.light)}\n${declarations(source.shared)}\n}\n:root[data-z-theme="dark"] {\n  color-scheme: dark;\n${declarations(source.dark)}\n}\n`;
// Native names: V2 names first, then the names still referenced by retained
// native pages and templates (mapped onto the V2 palette).
const nativeAliases = {
  page: "paper",
  surface: "surface",
  raised: "raised",
  text: "ink",
  muted: "muted",
  primary: "action",
  primaryHover: "action-hover",
  onPrimary: "action-ink",
  tint: "tint",
  accent: "accent",
  onAccent: "accent-ink",
  line: "line",
  lineStrong: "line-strong",
  field: "field",
  fieldBorder: "field-border",
  focus: "focus",
  stage: "stage",
  stage2: "stage-2",
  stageInk: "stage-ink",
  stageMuted: "stage-muted",
  stageLine: "stage-line",
  overlay: "overlay",
  shadow: "shadow",
  danger: "danger",
  dangerBg: "danger-bg",
  dangerLine: "danger-line",
  success: "success",
  successBg: "success-bg",
  successLine: "success-line",
  warning: "warning",
  warningBg: "warning-bg",
  warningLine: "warning-line",
  info: "info",
  infoBg: "info-bg",
  infoLine: "info-line",
  disabledText: "disabled-ink",
  disabledBg: "disabled-bg",
  disabledBorder: "line",
  control: "field",
  controlBorder: "field-border",
  brand: "action",
  secondaryText: "action",
  subtitle: "muted",
  media: "media",
  badgeText: "action",
  badgeBg: "tint",
  badgeBorder: "line",
  secondaryBg: "tint",
  secondaryBorder: "field-border",
  link: "action",
  dangerText: "danger",
  dangerBorder: "danger-line",
  positive: "success",
  positiveBorder: "success-line",
  positiveBg: "success-bg",
  positiveText: "success",
  positiveLine: "success-line",
  errorBg: "danger-bg",
  errorBorder: "danger-line",
  errorText: "danger",
  selectedText: "action",
  selectedBg: "tint",
  fieldBg: "field",
  body: "ink",
  halo: "tint",
  heroBorder: "stage-line",
  heroStart: "stage",
  heroMiddle: "stage-2",
  heroEnd: "stage",
  heroDescription: "stage-muted",
  orbitOuter: "line",
  orbitMiddle: "muted",
  orbitInner: "action",
  letter: "action",
  artShadow: "media",
  joinBg: "tint",
  teamStart: "surface",
  teamEnd: "surface",
  imageBorder: "line",
  videoSurface: "dark",
  warningText: "warning",
  warningBorder: "warning-line",
  infoText: "info",
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
    background: palette.paper,
    tabBg: palette.surface,
    tabText: palette.muted,
    tabSelected: palette.action,
    borderStyle: mode === "light" ? "black" : "white",
    textStyle: mode === "light" ? "dark" : "light",
  };
}
const native = `// Generated from src/design/tokens.json. Do not edit by hand.\nmodule.exports = ${JSON.stringify({ tokens, chrome }, null, 2)};\n`;
const outputs = new Map([
  ["src/app/(frontend)/tokens.css", css],
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
    // Pages with a custom stage header keep their own navigation style.
    if (config.navigationStyle !== "custom") {
      config.navigationBarBackgroundColor = chrome.light.background;
      config.navigationBarTextStyle = "black";
    }
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

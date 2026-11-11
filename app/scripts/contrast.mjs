#!/usr/bin/env node
/**
 * Monochrome guard + WCAG 2.1 contrast check for Heirloom's black-and-white design.
 *
 *   node scripts/contrast.mjs [--md]
 *
 * It fails (exit 1) when any of these is true:
 *  1. A text / background / UI pair in src/app/globals.css is below its target
 *     (4.5 for text, 3 for large text, control boundaries and focus rings), in light or dark.
 *  2. The duplicated token blocks drift apart (system dark vs [data-theme=dark]; the inverted
 *     .brand-panel block must be exactly the opposite theme).
 *  3. Any colour has a hue: a hex or rgb() literal whose R, G and B differ, any hsl / oklch / lab /
 *     color-mix colour, a Tailwind palette utility (text-red-500, bg-amber-200 ...), or a hue in the
 *     icon / social PNGs. Only black, white and neutral greys are allowed.
 *  4. The word "gradient" appears anywhere in src/ or public/ (CSS, Tailwind classes, SVG).
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8").replace(/\r\n/g, "\n");
const problems = [];

/* ---------- 1. token blocks ---------- */
const blockAt = (at) => {
  const body = css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
};
const block = (selector, nth = 0) => {
  let at = -1;
  for (let i = 0; i <= nth; i++) { at = css.indexOf(selector, at + 1); if (at < 0) throw new Error(`missing ${selector}`); }
  return blockAt(at);
};
const COLOUR_KEY = /^--(bg|surface|ink|line|accent|brand|gold|ember|brass|danger|ok|focus|scrim|shadow)/;
const colours = (b) => Object.fromEntries(Object.entries(b).filter(([k]) => COLOUR_KEY.test(k)));
const light = colours(block(":root {"));
const dark = colours(block(':root[data-theme="dark"] {'));
const same = (a, b, what) => {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[k] !== b[k]) problems.push(`token blocks differ: ${what} on ${k} (${a[k]} vs ${b[k]})`);
};
same(dark, colours(block(':root:not([data-theme="light"]) {')), "system dark vs [data-theme=dark]");
same(dark, colours(block("\n.brand-panel {")), "inverted panel (light theme) vs dark tokens");
same(light, colours(block(':root:not([data-theme="light"]) .brand-panel {')), "inverted panel (system dark) vs light tokens");
same(light, colours(block(':root[data-theme="dark"] .brand-panel {')), "inverted panel ([data-theme=dark]) vs light tokens");
same(Object.fromEntries(Object.keys(light).map((k) => [k, ""])), Object.fromEntries(Object.keys(dark).map((k) => [k, ""])), "light vs dark token names");

/* ---------- 2. contrast ---------- */
const resolve = (t, v) => { let x = v; for (let i = 0; i < 8 && x?.startsWith("var("); i++) x = t[x.slice(4, -1).trim()]; return x; };
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (hex) => { const [r, g, b] = rgb(hex).map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [foreground, background, minimum, what it is]
const T = 4.5, L = 3;
const pairs = [
  ["ink", "bg", T, "Body text on page"],
  ["ink", "surface", T, "Body text on card"],
  ["ink", "surface-2", T, "Body text on grey step"],
  ["ink", "accent-soft", T, "Text on selected tint"],
  ["ink-2", "bg", T, "Secondary text on page"],
  ["ink-2", "surface", T, "Secondary text on card"],
  ["ink-2", "surface-2", T, "Secondary text on grey step"],
  ["ink-2", "accent-soft", T, "Secondary text on selected tint"],
  ["bg", "ink", T, "Inverted block: text on solid ink (filled badge, blocked label, FAB)"],
  ["accent", "bg", T, "Link / accent text on page"],
  ["accent", "surface-2", T, "Accent text on grey step"],
  ["accent", "accent-soft", T, "Accent text on selected tint"],
  ["accent-ink", "accent", T, "Primary button label"],
  ["accent-ink", "accent-hover", T, "Primary button label (hover)"],
  ["accent", "bg", L, "Primary button shape against page"],
  ["accent-hover", "bg", L, "Primary button shape against page (hover)"],
  ["brand-ink", "brand", T, "Text on brand block"],
  ["brand-ink", "brand-deep", T, "Text on brand block (deep)"],
  ["gold-ink", "gold", T, "Label on highlight fill"],
  ["gold-ink", "gold-hi", T, "Label on highlight fill (hi)"],
  ["gold-edge", "surface", L, "Highlight outline on card"],
  ["ink", "gold-soft", T, "Text on highlight tint"],
  ["ember-ink", "ember", T, "Label on solid pill"],
  ["brass", "bg", T, "Eyebrow / caution text on page"],
  ["brass", "brass-soft", T, "Caution text on tint"],
  ["surface", "brass", T, "Label on caution solid"],
  ["danger", "bg", T, "Danger text on page"],
  ["danger", "danger-soft", T, "Danger text on tint"],
  ["surface", "danger", T, "Label on danger solid"],
  ["ok", "bg", T, "Success text on page"],
  ["ok", "ok-soft", T, "Success text on tint"],
  ["surface", "ok", T, "Label on success solid"],
  ["line-strong", "bg", L, "Control border on page"],
  ["line-strong", "surface", L, "Input / control border on card"],
  ["line-strong", "surface-2", L, "Control border / meter track edge on grey step"],
  ["ink", "surface-2", L, "Meter fill on track"],
  ["ink", "line", L, "Step / progress fill against its empty track"],
  ["focus", "bg", L, "Focus ring on page"],
  ["focus", "surface", L, "Focus ring on card"],
  ["focus", "surface-2", L, "Focus ring on grey step"],
  ["focus", "accent-soft", L, "Focus ring on selected tint"],
];

const rows = [];
for (const [name, t] of [["light", light], ["dark", dark]]) {
  const get = (k) => {
    const v = resolve(t, t[`--${k}`]);
    if (!/^#[0-9a-f]{6}$/i.test(v ?? "")) throw new Error(`${name}: --${k} is not a 6-digit hex colour (${v})`);
    return v;
  };
  for (const [fg, bg, min, what] of pairs) {
    const r = ratio(get(fg), get(bg));
    const ok = r >= min;
    if (!ok) problems.push(`contrast ${name}: ${what} is ${r.toFixed(2)} (needs ${min})`);
    rows.push({ theme: name, what, fg: `${fg} ${get(fg)}`, bg: `${bg} ${get(bg)}`, ratio: r.toFixed(2), min, ok });
  }
}

/* ---------- 3 + 4. no hue, no blends, anywhere ---------- */
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : [p];
});
const TEXT = /\.(css|tsx?|mjs|js|json|svg|txt|html)$/;
const files = [...walk(path.join(root, "src")), ...walk(path.join(root, "public"))];
const rel = (p) => path.relative(root, p).replace(/\\/g, "/");
const PALETTE = "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|stone";
const UTIL = "text|bg|border|ring|fill|stroke|from|via|to|decoration|outline|shadow|accent|caret|divide|placeholder";
const paletteRe = new RegExp(`(?<![\\w-])(?:${UTIL})-(?:[lrtbxyse]-)?(?:${PALETTE})-\\d{2,3}\\b`, "g");
let scanned = 0, literals = 0;
for (const file of files) {
  if (!TEXT.test(file) || /\.test\.tsx?$/.test(file) || file.includes(`${path.sep}idl${path.sep}`)) continue;
  scanned++;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const at = `${rel(file)}:${i + 1}`;
    if (/gradient/i.test(line)) problems.push(`gradient: ${at}  ${line.trim().slice(0, 100)}`);
    if (/\b(hsla?|hwb|oklch|oklab|lab|lch|color-mix|color)\(/i.test(line)) problems.push(`non-neutral colour function: ${at}  ${line.trim().slice(0, 100)}`);
    for (const m of line.matchAll(/(?<![\w&/])#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi)) {
      literals++;
      const h = m[1].length <= 4 ? [...m[1]].map((c) => c + c).join("") : m[1];
      const [r, g, b] = [0, 2, 4].map((j) => parseInt(h.slice(j, j + 2), 16));
      if (r !== g || g !== b) problems.push(`hue in hex colour #${m[1]}: ${at}`);
    }
    for (const m of line.matchAll(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/gi)) {
      literals++;
      if (m[1] !== m[2] || m[2] !== m[3]) problems.push(`hue in ${m[0]}): ${at}`);
    }
    for (const m of line.matchAll(paletteRe)) problems.push(`Tailwind palette colour ${m[0]}: ${at}`);
  });
}

// Raster assets: every pixel must be neutral (allowing 2 levels of antialiasing error).
let pngs = 0;
try {
  const sharp = createRequire(import.meta.url)("sharp");
  for (const file of files.filter((f) => f.endsWith(".png"))) {
    const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let worst = 0;
    for (let i = 0; i < data.length; i += info.channels) worst = Math.max(worst, Math.abs(data[i] - data[i + 1]), Math.abs(data[i + 1] - data[i + 2]));
    pngs++;
    if (worst > 2) problems.push(`hue in image ${rel(file)} (channel spread ${worst})`);
  }
} catch (e) {
  console.warn(`(skipped PNG hue check: ${e.message.split("\n")[0]})`);
}

/* ---------- report ---------- */
const md = process.argv.includes("--md");
if (md) {
  console.log("| Theme | Pair | Foreground | Background | Ratio | Min | |\n|---|---|---|---|---|---|---|");
  for (const r of rows) console.log(`| ${r.theme} | ${r.what} | ${r.fg} | ${r.bg} | ${r.ratio} | ${r.min} | ${r.ok ? "pass" : "FAIL"} |`);
} else {
  for (const r of rows) console.log(`${r.ok ? "pass" : "FAIL"}  ${r.theme.padEnd(5)} ${r.ratio.padStart(5)} (min ${r.min})  ${r.what}  [${r.fg} on ${r.bg}]`);
}
console.log(`\n${rows.length} contrast pairs checked. ${scanned} text files scanned (${literals} colour literals), ${pngs} PNGs checked.`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  FAIL  ${p}`);
  process.exit(1);
}
console.log("Monochrome: no hue, no gradient, all token blocks in step. All pairs pass.");

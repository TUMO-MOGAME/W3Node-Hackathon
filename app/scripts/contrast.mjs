#!/usr/bin/env node
/**
 * WCAG 2.1 contrast check for the Harvest Moon tokens in src/app/globals.css.
 * Reads the light (:root) and dark (:root[data-theme="dark"]) blocks, resolves var() references
 * and checks every text / background pair the UI uses.  Usage: node scripts/contrast.mjs [--md]
 * Exits 1 if any pair is below its target (4.5 text, 3 large text / UI parts / focus).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/app/globals.css"), "utf8");
const block = (selector) => {
  const at = css.indexOf(selector);
  if (at < 0) throw new Error(`missing ${selector}`);
  const body = css.slice(css.indexOf("{", at) + 1, css.indexOf("\n}", at));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
};
const light = block(":root {");
const dark = { ...light, ...block(':root[data-theme="dark"] {') };
const media = block(':root:not([data-theme="light"]) {');
for (const k of Object.keys(block(':root[data-theme="dark"] {'))) if (media[k] !== dark[k] && k in media) throw new Error(`dark blocks differ on ${k}`);

const resolve = (t, v) => { let x = v; for (let i = 0; i < 8 && x.startsWith("var("); i++) x = t[x.slice(4, -1).trim()]; return x; };
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (hex) => { const [r, g, b] = rgb(hex).map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** Composite `fg` at alpha over `bg` (for the translucent tints the UI uses, e.g. bg-surface-2/50). */
const over = (fg, bg, a) => "#" + rgb(fg).map((c, i) => Math.round(c * a + rgb(bg)[i] * (1 - a)).toString(16).padStart(2, "0")).join("");

// [foreground, background, minimum, what it is]. "a/b@0.5" = a at 50% over b.
const T = 4.5, L = 3;
const pairs = [
  ["ink", "bg", T, "Body text on page"],
  ["ink", "surface", T, "Body text on card"],
  ["ink", "surface-2", T, "Body text on sand"],
  ["ink-2", "bg", T, "Secondary text on page"],
  ["ink-2", "surface", T, "Secondary text on card"],
  ["ink-2", "surface-2", T, "Secondary text on sand"],
  ["ink-2", "accent-soft", T, "Secondary text on rose tint"],
  ["ink-2", "brass-soft", T, "Secondary text on wheat tint"],
  ["ink-2", "danger-soft", T, "Secondary text on blocked panel"],
  ["ink", "accent-soft", T, "Text on rose tint"],
  ["ink", "brass-soft", T, "Text on wheat tint"],
  ["ink", "danger-soft", T, "Text on danger tint"],
  ["ink", "ok-soft", T, "Text on ok tint"],
  ["accent", "bg", T, "Link / accent text on page"],
  ["accent", "surface", T, "Link / accent text on card"],
  ["accent", "surface-2", T, "Accent text on sand"],
  ["accent", "accent-soft", T, "Accent badge / active nav"],
  ["accent-ink", "accent", T, "Primary button label"],
  ["accent-ink", "accent-hover", T, "Primary button label (hover)"],
  ["brand-ink", "brand", T, "Text on burgundy panel"],
  ["brand-ink", "brand-deep", T, "Text on burgundy panel (deep end)"],
  ["brand", "brand-ink", T, "Pill on burgundy panel"],
  ["gold", "brand", L, "Mustard accents on burgundy panel"],
  ["gold", "brand", T, "Mustard text on burgundy panel"],
  ["gold-ink", "gold", T, "Dark text on mustard"],
  ["gold-ink", "gold-hi", T, "Dark text on mustard (highlight end)"],
  ["accent", "gold", T, "Active tab icon on mustard pill (light)", "light"],
  ["gold-edge", "surface", L, "Mustard shape outline on card"],
  ["gold-edge", "bg", L, "Mustard shape outline on page"],
  ["gold-edge", "surface-2", L, "Mustard meter outline on track"],
  ["ink", "gold-soft", T, "Text on mustard tint"],
  ["ember-ink", "ember", T, "Label on burnt orange pill"],
  ["ember", "surface", L, "Burnt orange fill on card"],
  ["ember", "brass-soft", L, "Burnt orange pill on guide bar"],
  ["brass", "bg", T, "Eyebrow / warm text on page"],
  ["brass", "surface", T, "Warm text on card"],
  ["brass", "surface-2", T, "Warm text on sand"],
  ["brass", "brass-soft", T, "Warning badge / guide bar text"],
  ["brass", "brass-soft/bg@0.7", T, "Guide bar label (70% tint over page)"],
  ["surface", "brass", T, "Label on warm solid pill"],
  ["danger", "bg", T, "Danger text on page"],
  ["danger", "surface", T, "Danger text on card"],
  ["danger", "danger-soft", T, "Danger badge / blocked label"],
  ["surface", "danger", T, "Label on danger solid"],
  ["ok", "bg", T, "Success text on page"],
  ["ok", "surface", T, "Success text on card"],
  ["ok", "ok-soft", T, "Success badge"],
  ["surface", "ok", T, "Label on success solid"],
  ["bg", "ink", T, "Inverse banner (offline)"],
  ["line-strong", "surface", L, "Input / control border on card"],
  ["line-strong", "bg", L, "Control border on page"],
  ["focus", "bg", L, "Focus ring on page"],
  ["focus", "surface", L, "Focus ring on card"],
  ["focus", "surface-2", L, "Focus ring on sand"],
  ["gold", "brand", L, "Focus ring on burgundy panel"],
  ["ink-2", "surface-2/surface@0.5", T, "Secondary text on half sand"],
  ["accent", "accent-soft/surface@0.6", T, "Accent text on 60% rose tint"],
];

const md = process.argv.includes("--md");
let failed = 0;
const rows = [];
for (const [name, t] of [["light", light], ["dark", dark]]) {
  const col = (spec) => {
    const m = spec.match(/^([\w-]+)\/([\w-]+)@([\d.]+)$/);
    const get = (k) => { const v = resolve(t, t[`--${k}`]); if (!/^#[0-9a-f]{6}$/i.test(v ?? "")) throw new Error(`${name}: --${k} is not a hex colour (${v})`); return v; };
    return m ? over(get(m[1]), get(m[2]), Number(m[3])) : get(spec);
  };
  for (const [fg, bg, min, what, only] of pairs) {
    if (only && only !== name) continue;
    const r = ratio(col(fg), col(bg));
    const ok = r >= min;
    if (!ok) failed++;
    rows.push({ theme: name, what, fg: `${fg} ${col(fg)}`, bg: `${bg} ${col(bg)}`, ratio: r.toFixed(2), min, ok });
  }
}
if (md) {
  console.log("| Theme | Pair | Foreground | Background | Ratio | Min | |\n|---|---|---|---|---|---|---|");
  for (const r of rows) console.log(`| ${r.theme} | ${r.what} | ${r.fg} | ${r.bg} | ${r.ratio} | ${r.min} | ${r.ok ? "pass" : "FAIL"} |`);
} else {
  for (const r of rows) console.log(`${r.ok ? "pass" : "FAIL"}  ${r.theme.padEnd(5)} ${r.ratio.padStart(5)} (min ${r.min})  ${r.what}  [${r.fg} on ${r.bg}]`);
}
console.log(`\n${rows.length} pairs checked, ${failed} failing.`);
process.exit(failed ? 1 : 0);

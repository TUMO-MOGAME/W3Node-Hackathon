#!/usr/bin/env node
/**
 * Builds the icon font subset (Flaticon UIcons, Regular Rounded).
 *
 *   npm run icons        (also runs before every `npm run build`)
 *
 * 1. Reads the name -> glyph table (GLYPHS) from src/components/ui/icons.tsx.
 * 2. Scans src/ for the icon names actually imported from "@/components/ui/icons".
 * 3. Looks up each glyph's code point in the package's rounded.css.
 * 4. Subsets the 377 KB woff2 down to those glyphs only and writes
 *      public/fonts/uicons-rr-subset.woff2
 *      src/app/uicons.css   (@font-face + the .ui-icon box + the used .fi-rr-* rules)
 *
 * It fails loudly when a name is imported but not mapped, or a mapped glyph is not in UIcons.
 * Icons: Uicons by Flaticon (flaticon.com/uicons).
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";

const APP = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(APP, "src");
const ICONS_TSX = join(SRC, "components", "ui", "icons.tsx");
const PKG_CSS_DIR = join(APP, "node_modules", "@flaticon", "flaticon-uicons", "css");
const RR_CSS = join(PKG_CSS_DIR, "regular", "rounded.css");
const OUT_FONT = join(APP, "public", "fonts", "uicons-rr-subset.woff2");
const OUT_CSS = join(SRC, "app", "uicons.css");
const FONT_URL = "/fonts/uicons-rr-subset.woff2";
const MAX_BYTES = 25 * 1024;
const TYPE_EXPORTS = new Set(["GLYPHS", "IconName", "IconProps", "IconComponent", "LucideIcon"]);

function fail(msg) {
  console.error(`\n[icons] ERROR: ${msg}\n`);
  process.exit(1);
}

/** name -> glyph, parsed from the GLYPHS object literal in icons.tsx. */
export function readGlyphTable(source = readFileSync(ICONS_TSX, "utf8")) {
  const block = source.match(/export const GLYPHS = \{([\s\S]*?)\} as const;/);
  if (!block) fail(`could not find "export const GLYPHS = { … } as const;" in ${relative(APP, ICONS_TSX)}`);
  const table = new Map();
  for (const m of block[1].matchAll(/^\s*([A-Za-z0-9_]+):\s*"([a-z0-9-]+)",?\s*$/gm)) table.set(m[1], m[2]);
  if (table.size === 0) fail("GLYPHS table is empty");
  return table;
}

/** glyph -> code point (hex string), parsed from the package's rounded.css. */
export function readCodePoints(css = readFileSync(RR_CSS, "utf8")) {
  const map = new Map();
  for (const m of css.matchAll(/\.fi-rr-([a-z0-9-]+):before\{content:"\\([0-9a-f]+)"\}/g)) map.set(m[1], m[2]);
  if (map.size < 1000) fail(`only ${map.size} glyphs parsed from ${RR_CSS}; has the package format changed?`);
  return map;
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|mts|mjs|jsx?)$/.test(e.name) && p !== ICONS_TSX) out.push(p);
  }
  return out;
}

/** Names imported from the icons module anywhere under src/. */
function usedNames() {
  const used = new Map(); // name -> first file
  const re = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["'](?:@\/components\/ui\/icons|(?:\.\.?\/)+(?:ui\/)?icons)["']/g;
  for (const file of walk(SRC)) {
    const s = readFileSync(file, "utf8");
    for (const m of s.matchAll(re)) {
      for (let n of m[1].split(",")) {
        n = n.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
        if (n && !TYPE_EXPORTS.has(n) && !used.has(n)) used.set(n, relative(APP, file));
      }
    }
  }
  return used;
}

async function main() {
  const table = readGlyphTable();
  const points = readCodePoints();

  const missingGlyphs = [...table].filter(([, g]) => !points.has(g));
  if (missingGlyphs.length) fail(`mapped glyphs not in UIcons regular rounded: ${missingGlyphs.map(([n, g]) => `${n} -> fi-rr-${g}`).join(", ")}`);

  const used = usedNames();
  const unmapped = [...used].filter(([n]) => !table.has(n));
  if (unmapped.length) fail(`imported but not mapped in GLYPHS: ${unmapped.map(([n, f]) => `${n} (${f})`).join(", ")}`);

  let names = [...used.keys()];
  if (names.length === 0) {
    console.warn("[icons] nothing imports @/components/ui/icons yet; including every mapped glyph.");
    names = [...table.keys()];
  }
  const glyphs = [...new Set(names.map((n) => table.get(n)))].sort();

  const cssSrc = readFileSync(RR_CSS, "utf8");
  const fontRef = cssSrc.match(/url\(\.\.\/(uicons-regular-rounded-[A-Z0-9]+\.woff2)\)/);
  if (!fontRef) fail("could not find the woff2 url in rounded.css");
  const fontPath = join(PKG_CSS_DIR, fontRef[1]);
  const full = readFileSync(fontPath);

  const text = glyphs.map((g) => String.fromCodePoint(parseInt(points.get(g), 16))).join("");
  const subset = await subsetFont(full, text, { targetFormat: "woff2" });
  if (subset.length > MAX_BYTES) fail(`subset is ${subset.length} bytes, over the ${MAX_BYTES} byte budget`);

  mkdirSync(dirname(OUT_FONT), { recursive: true });
  writeFileSync(OUT_FONT, subset);

  const rules = glyphs.map((g) => `.fi-rr-${g}::before{content:"\\${points.get(g)}"}`).join("\n");
  const css = `/* GENERATED by scripts/build-icons.mjs from src/components/ui/icons.tsx. Do not edit; run \`npm run icons\`.
 * Icons: Uicons by Flaticon (flaticon.com/uicons). Regular weight, Rounded style.
 * ${glyphs.length} glyphs, ${subset.length} bytes woff2. */
@font-face {
  font-family: "uicons-rr";
  src: url("${FONT_URL}") format("woff2");
  font-style: normal;
  font-weight: 400;
  /* block: the glyphs live in the Private Use Area, so a fallback font would draw tofu boxes.
     The font is preloaded in layout.tsx, so the block period is near zero. */
  font-display: block;
}

/* The box: 1em square by default; Tailwind size-* utilities override it (they sit in a later layer). */
@layer base {
  .ui-icon {
    display: inline-grid;
    place-items: center;
    width: 1em;
    height: 1em;
    flex-shrink: 0;
    line-height: 1;
    vertical-align: middle;
    container-type: size;
  }
}

/* The glyph scales to the box with container units and inherits currentColor. UIcons draw edge to
   edge while lucide keeps a 2px margin in 24, so the glyph takes 20/24 of the box to keep sizes. */
.ui-icon > .fi {
  display: block;
  font-size: 83.333cqmin;
  line-height: 1;
  font-style: normal;
}
@supports not (container-type: size) {
  .ui-icon > .fi { font-size: 0.83333em; }
}
.fi::before {
  display: block;
  font-family: "uicons-rr" !important;
  font-style: normal;
  font-weight: 400 !important;
  font-variant: normal;
  text-transform: none;
  line-height: 1;
  speak: never;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

${rules}
`;
  writeFileSync(OUT_CSS, css);

  const kb = (subset.length / 1024).toFixed(1);
  console.log(`[icons] ${names.length} icons -> ${glyphs.length} glyphs; ${relative(APP, OUT_FONT)} ${kb} KB (from ${(statSync(fontPath).size / 1024).toFixed(0)} KB); ${relative(APP, OUT_CSS)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => fail(e?.stack ?? String(e)));
}

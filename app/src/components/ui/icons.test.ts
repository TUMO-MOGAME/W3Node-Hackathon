import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as icons from "./icons";

const css = readFileSync(new URL("../../../node_modules/@flaticon/flaticon-uicons/css/regular/rounded.css", import.meta.url), "utf8");
const rounded = new Set([...css.matchAll(/\.fi-rr-([a-z0-9-]+):before\{content:/g)].map((m) => m[1]));

const { GLYPHS, ...exported } = icons;
const components = Object.entries(exported) as [string, icons.IconComponent][];

describe("UIcons mapping", () => {
  it("reads the UIcons regular rounded glyph list", () => {
    expect(rounded.size).toBeGreaterThan(1000);
  });

  it("maps every name to a glyph that exists in rounded.css", () => {
    const missing = Object.entries(GLYPHS).filter(([, glyph]) => !rounded.has(glyph));
    expect(missing).toEqual([]);
  });

  it("exports exactly one component per mapped name", () => {
    expect(components.map(([n]) => n).sort()).toEqual(Object.keys(GLYPHS).sort());
    for (const [name, Icon] of components) expect(Icon.displayName).toBe(name);
  });

  it("renders a decorative glyph in a sized box by default", () => {
    const html = renderToStaticMarkup(createElement(icons.House, { className: "size-5", strokeWidth: 3 }));
    expect(html).toBe('<span aria-hidden="true" class="ui-icon size-5"><i class="fi fi-rr-home"></i></span>');
  });

  it("becomes an image with a name when given aria-label", () => {
    const html = renderToStaticMarkup(createElement(icons.Loader2, { "aria-label": "Loading", className: "animate-spin" }));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Loading"');
    expect(html).not.toContain("aria-hidden");
    expect(html).toContain("fi-rr-spinner");
  });

  it("turns lucide's size prop into the box size", () => {
    const html = renderToStaticMarkup(createElement(icons.X, { size: 18 }));
    expect(html).toContain("width:18px;height:18px");
  });
});

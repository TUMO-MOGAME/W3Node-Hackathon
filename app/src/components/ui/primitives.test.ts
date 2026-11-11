import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./primitives";

describe("EmptyState", () => {
  it("is a section heading by default", () => {
    expect(renderToStaticMarkup(createElement(EmptyState, { title: "Nothing yet" }))).toContain("<h2");
  });
  it("can be the page's main heading (the shared Gate uses this, so every page has an h1)", () => {
    const html = renderToStaticMarkup(createElement(EmptyState, { title: "No estate here yet", level: 1 }));
    expect(html).toContain('<h1 class="text-h3">No estate here yet</h1>');
  });
});

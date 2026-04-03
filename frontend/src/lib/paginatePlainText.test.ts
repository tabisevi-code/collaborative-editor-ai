import { describe, expect, it } from "vitest";

import { paginatePlainText } from "./paginatePlainText";

const measureTextWidth = (text: string) => text.length * 10;

describe("paginatePlainText", () => {
  it("keeps short content on a single page", () => {
    const pages = paginatePlainText("Short note", {
      maxLineWidthPx: 200,
      maxLinesPerPage: 5,
      measureTextWidth,
    });

    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({
      start: 0,
      end: 10,
      text: "Short note",
    });
  });

  it("splits long content into multiple pages after enough wrapped lines", () => {
    const content = "alpha beta gamma delta epsilon zeta eta theta";
    const pages = paginatePlainText(content, {
      maxLineWidthPx: 60,
      maxLinesPerPage: 2,
      measureTextWidth,
    });

    expect(pages).toHaveLength(4);
    expect(pages.map((page) => page.text).join("")).toBe(content);
    expect(pages[0].text).toBe("alpha beta ");
    expect(pages[1].text).toBe("gamma delta ");
  });

  it("breaks oversized tokens when no whitespace exists", () => {
    const content = "supercalifragilistic";
    const pages = paginatePlainText(content, {
      maxLineWidthPx: 50,
      maxLinesPerPage: 2,
      measureTextWidth,
    });

    expect(pages).toHaveLength(2);
    expect(pages.map((page) => page.text).join("")).toBe(content);
    expect(pages[0].text).toBe("supercalif");
    expect(pages[1].text).toBe("ragilistic");
  });

  it("preserves explicit blank lines across page boundaries", () => {
    const content = "line 1\n\nline 3\nline 4\nline 5";
    const pages = paginatePlainText(content, {
      maxLineWidthPx: 120,
      maxLinesPerPage: 2,
      measureTextWidth,
    });

    expect(pages).toHaveLength(3);
    expect(pages.map((page) => page.text).join("")).toBe(content);
    expect(pages[0].text).toBe("line 1\n\n");
    expect(pages[1].text).toBe("line 3\nline 4\n");
  });
});

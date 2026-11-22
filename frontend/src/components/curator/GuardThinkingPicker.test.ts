import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GuardThinkingPicker } from "./GuardThinkingPicker";

const render = (value: string | null, reason: string | null, disabled = false) =>
  renderToStaticMarkup(
    createElement(GuardThinkingPicker, { modes: [], defaultMode: null, value, reason, disabled, onChange: () => {} }),
  );
const selectDisabled = (html: string) => /<select[^>]*\sdisabled=""/.test(html);

// Audit pack-argus-studio-6cec0b0632: a mode Again restored must be clearable on a curator that can't take one.
describe("GuardThinkingPicker", () => {
  it("stays open while a restored mode is set on an older curator, offering the default to clear it", () => {
    const html = render("slow", "This curator can't choose a mode.");
    expect(selectDisabled(html)).toBe(false);
    expect(html).toContain('<option value="">Curator default</option>');
    expect(html).toContain('<option value="slow" selected="">slow</option>');
  });

  it("is off on an older curator with nothing to clear, and while the form is busy", () => {
    expect(selectDisabled(render(null, "This curator can't choose a mode."))).toBe(true);
    expect(selectDisabled(render("slow", "This curator can't choose a mode.", true))).toBe(true);
    expect(selectDisabled(render(null, null))).toBe(false);
  });
});

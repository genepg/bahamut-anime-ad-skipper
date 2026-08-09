/* Shared DOM interaction module for isolated and ad-frame contexts. */
namespace AniAdSkip {
  /* Why a click did not happen, not just that it did not. The close ladders in
   * AdSkipEngine and AdFrameCloser walk a list of candidates and need to tell
   * "this control is not ready yet" (invisible/disabled) apart from "this is
   * the wrong kind of element" (navigation) — a boolean collapses both into a
   * bare retry.
   *
   * There is deliberately no "no-effect" outcome: clicking a wrapper that has
   * no handler of its own is indistinguishable from clicking one that does, so
   * that case is prevented by never targeting known wrappers (see WRAPPER_IDS
   * in ad-frame-closer.ts) rather than detected here. */
  export type ClickOutcome = "clicked" | "invisible" | "disabled" | "navigation";

  export class DOMElement {
    static first(selectors: readonly string[], root: ParentNode = document): HTMLElement | null {
      for (const selector of selectors) {
        const element = root.querySelector<HTMLElement>(selector);
        if (element) return element;
      }
      return null;
    }

    /* Google hides the rewarded-ad controls it does not want clicked yet with
     * `display:none` on the control or `opacity:0` on an ancestor wrapper, so
     * both have to be honoured. Ask the engine via checkVisibility() rather
     * than walking ancestors by hand: a child may legitimately re-enable
     * `visibility` (and `pointer-events`, which is not a visibility property at
     * all) inside a disabled wrapper, and treating those wrappers as opaque is
     * what made the early close button look unclickable. */
    static isVisible(element: Element | null): element is HTMLElement {
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      /* Either dimension at zero means nothing is rendered and nothing can be
       * clicked. Both had to be zero here once, which let a full-width but
       * collapsed ad container read as an ad that was on screen. */
      if (rect.width === 0 || rect.height === 0) return false;
      const check = (element as HTMLElement & {
        checkVisibility?: (options: { checkOpacity: boolean; checkVisibilityCSS: boolean }) => boolean;
      }).checkVisibility;
      if (typeof check === "function") {
        return check.call(element, { checkOpacity: true, checkVisibilityCSS: true });
      }
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
    }

    static text(element: Element | null): string {
      return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
    }

    static isDisabled(element: HTMLElement): boolean {
      return (element as HTMLElement & { disabled?: boolean }).disabled === true;
    }

    static isNavigationLink(element: Element): boolean {
      const anchor = element.closest("a");
      if (!anchor) return false;
      const href = anchor.getAttribute("href");
      if (!href) return false;
      const trimmed = href.trim();
      return trimmed !== "" && trimmed !== "#" && !trimmed.startsWith("javascript:");
    }

    static click(element: Element | null): ClickOutcome {
      if (!this.isVisible(element)) return "invisible";
      if (this.isDisabled(element)) return "disabled";
      if (this.isNavigationLink(element)) return "navigation";
      element.click();
      return "clicked";
    }

    static clickFirst(selectors: readonly string[], root: ParentNode = document): HTMLElement | null {
      const element = this.first(selectors, root);
      return this.click(element) === "clicked" ? element : null;
    }

    static findByText(selector: string, pattern: RegExp, maxTextLength: number, root: ParentNode = document): HTMLElement | null {
      for (const element of root.querySelectorAll<HTMLElement>(selector)) {
        if (element.children.length > 3) continue;
        const text = this.text(element);
        if (text && text.length <= maxTextLength && pattern.test(text) && this.isVisible(element)) return element;
      }
      return null;
    }
  }
}

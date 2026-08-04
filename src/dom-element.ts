/* Shared DOM interaction module for isolated and ad-frame contexts. */
namespace AniAdSkip {
  export class DOMElement {
    static first(selectors: readonly string[], root: ParentNode = document): HTMLElement | null {
      for (const selector of selectors) {
        const element = root.querySelector<HTMLElement>(selector);
        if (element) return element;
      }
      return null;
    }

    static isVisible(element: Element | null): element is HTMLElement {
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
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

    static click(element: Element | null): boolean {
      if (!this.isVisible(element) || this.isDisabled(element) || this.isNavigationLink(element)) return false;
      element.click();
      return true;
    }

    static clickFirst(selectors: readonly string[], root: ParentNode = document): HTMLElement | null {
      const element = this.first(selectors, root);
      return this.click(element) ? element : null;
    }

    static findByText(selector: string, pattern: RegExp, maxTextLength: number): HTMLElement | null {
      for (const element of document.querySelectorAll<HTMLElement>(selector)) {
        if (element.children.length > 3) continue;
        const text = this.text(element);
        if (text && text.length <= maxTextLength && pattern.test(text) && this.isVisible(element)) return element;
      }
      return null;
    }
  }
}

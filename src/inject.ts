/* Main-world module that prevents anti-adblock alerts and tab backgrounding. */
(() => {
  "use strict";

  class PageInvisibilitySpoofer {
    start(): void {
      if (!this.isAllowedHost() || !this.isEnabled()) return;
      this.suppressAntiAdblockAlert();
      this.spoofVisibility();
    }

    private isAllowedHost(): boolean {
      try {
        const h = location.hostname;
        // Origin-inherited creative frames use about:blank, blob:, or data:
        // URLs. The manifest only injects this script into such documents when
        // their initiator matches one of the hosts below.
        if (["about:", "blob:", "data:"].includes(location.protocol)) return true;
        return (
          h.endsWith("ani.gamer.com.tw") ||
          h.includes("doubleclick") ||
          h.includes("googlesyndication") ||
          h.includes("imasdk") ||
          h.includes("googleadservices") ||
          h.includes("adservice")
        );
      } catch {
        return false;
      }
    }

    private isEnabled(): boolean {
      try { return localStorage.getItem("__aniAdSkip_enabled") !== "false"; } catch { return true; }
    }

    private suppressAntiAdblockAlert(): void {
      const originalAlert = window.alert.bind(window);
      window.alert = (message?: unknown): void => {
        if (typeof message === "string" && /擋廣告|廣告插件|影響播放器|ad-?block/i.test(message)) return;
        originalAlert(message);
      };
    }

    private spoofVisibility(): void {
      const targets = [document, typeof Document !== "undefined" ? Document.prototype : null];
      for (const target of targets) {
        if (!target) continue;
        try { Object.defineProperty(target, "hidden", { get: () => false, configurable: true }); } catch { /* ignore */ }
        try { Object.defineProperty(target, "visibilityState", { get: () => "visible", configurable: true }); } catch { /* ignore */ }
        try { Object.defineProperty(target, "webkitHidden", { get: () => false, configurable: true }); } catch { /* ignore */ }
        try { Object.defineProperty(target, "webkitVisibilityState", { get: () => "visible", configurable: true }); } catch { /* ignore */ }
        try { Object.defineProperty(target, "hasFocus", { value: () => true, writable: true, configurable: true }); } catch { /* ignore */ }
      }

      document.hasFocus = (): boolean => true;

      const blockEvent = (event: Event): void => {
        try {
          event.stopImmediatePropagation();
          event.stopPropagation();
        } catch { /* ignore */ }
      };

      for (const eventName of ["visibilitychange", "webkitvisibilitychange", "pagehide", "freeze"]) {
        document.addEventListener(eventName, blockEvent, true);
        window.addEventListener(eventName, blockEvent, true);
      }

      window.addEventListener("blur", (event) => {
        if (event.target === window || event.target === document) blockEvent(event);
      }, true);
    }
  }

  try { new PageInvisibilitySpoofer().start(); } catch { /* never interfere with playback */ }
})();

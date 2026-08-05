/* Main-world module that prevents anti-adblock alerts and tab backgrounding.
 *
 * Only the main world can patch the page's own globals, and only the isolated
 * world can read the settings — so this listens on the MainWorldChannel rather
 * than reading storage itself. Every patch records how to undo it, so turning
 * the extension off in the popup takes effect on the open tab instead of
 * waiting for a reload. */
(() => {
  "use strict";

  class PageInvisibilitySpoofer {
    private readonly undo: (() => void)[] = [];

    /* Idempotent — the channel republishes on every settings change. */
    apply(enabled: boolean): void {
      if (enabled === (this.undo.length > 0)) return;
      if (enabled) {
        this.suppressAntiAdblockAlert();
        this.spoofVisibility();
      } else {
        for (let step = this.undo.pop(); step !== undefined; step = this.undo.pop()) step();
      }
    }

    private suppressAntiAdblockAlert(): void {
      const previous = window.alert;
      const originalAlert = window.alert.bind(window);
      window.alert = (message?: unknown): void => {
        if (typeof message === "string" && /擋廣告|廣告插件|影響播放器|ad-?block/i.test(message)) return;
        originalAlert(message);
      };
      this.undo.push(() => { try { window.alert = previous; } catch { /* ignore */ } });
    }

    private spoofVisibility(): void {
      const targets = [document, typeof Document !== "undefined" ? Document.prototype : null];
      for (const target of targets) {
        if (!target) continue;
        this.define(target, "hidden", { get: () => false });
        this.define(target, "visibilityState", { get: () => "visible" });
        this.define(target, "webkitHidden", { get: () => false });
        this.define(target, "webkitVisibilityState", { get: () => "visible" });
        this.define(target, "hasFocus", { value: () => true, writable: true });
      }

      const blockEvent = (event: Event): void => {
        try {
          event.stopImmediatePropagation();
          event.stopPropagation();
        } catch { /* ignore */ }
      };

      for (const eventName of ["visibilitychange", "webkitvisibilitychange", "pagehide", "freeze"]) {
        this.listen(document, eventName, blockEvent);
        this.listen(window, eventName, blockEvent);
      }

      this.listen(window, "blur", (event) => {
        if (event.target === window || event.target === document) blockEvent(event);
      });
    }

    private define(target: object, name: string, descriptor: PropertyDescriptor): void {
      const original = Object.getOwnPropertyDescriptor(target, name);
      try {
        Object.defineProperty(target, name, { ...descriptor, configurable: true });
      } catch {
        return; // a locked-down frame; leave the property alone
      }
      this.undo.push(() => {
        try {
          if (original) Object.defineProperty(target, name, original);
          else delete (target as Record<string, unknown>)[name];
        } catch { /* ignore */ }
      });
    }

    private listen(target: EventTarget, name: string, handler: EventListener): void {
      target.addEventListener(name, handler, true);
      this.undo.push(() => { try { target.removeEventListener(name, handler, true); } catch { /* ignore */ } });
    }
  }

  const isAllowedHost = (): boolean => {
    try {
      const host = location.hostname;
      // Origin-inherited creative frames use about:blank, blob:, or data: URLs.
      // The manifest only injects this script into such documents when their
      // initiator matches one of the hosts below.
      if (["about:", "blob:", "data:"].includes(location.protocol)) return true;
      return (
        host.endsWith("ani.gamer.com.tw") ||
        host.includes("doubleclick") ||
        host.includes("googlesyndication") ||
        host.includes("imasdk") ||
        host.includes("googleadservices") ||
        host.includes("adservice")
      );
    } catch {
      return false;
    }
  };

  try {
    if (!isAllowedHost()) return;
    const spoofer = new PageInvisibilitySpoofer();
    new AniAdSkip.MainWorldChannel().subscribe((settings) => spoofer.apply(settings.enabled));
  } catch { /* never interfere with playback */ }
})();

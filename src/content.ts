/* Page coordinator: wires the deep modules together in the isolated world. */
(() => {
  "use strict";

  const settings = new AniAdSkip.SettingsStorage(true);
  const engine = new AniAdSkip.AdSkipEngine();
  settings.onChange((enabled) => { if (enabled) engine.start(); else engine.stop(); });
  settings.load(() => undefined);

  let badge: HTMLDivElement | null = null;
  let badgeTimer = 0;
  const showBadge = (status: string): void => {
    if (window.top !== window) return;
    if (!badge) {
      badge = document.createElement("div");
      badge.style.cssText = "position:fixed;top:8px;left:8px;z-index:2147483647;background:rgba(20,22,32,.9);color:#9ad;font:12px/1.4 monospace;padding:4px 8px;border-radius:6px;pointer-events:none;max-width:60vw;";
      (document.body ?? document.documentElement).appendChild(badge);
    }
    badge.textContent = "⏭ ad-skip: " + status;
    badge.style.opacity = "1";
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => { if (badge) badge.style.opacity = "0.15"; }, 4000);
  };

  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    const data = event.data;
    if (typeof data === "object" && data !== null && typeof (data as Record<string, unknown>)["__aniAdframe"] === "string") {
      showBadge((data as { __aniAdframe: string }).__aniAdframe);
    }
  });
})();

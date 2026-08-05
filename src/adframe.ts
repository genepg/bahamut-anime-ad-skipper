/*
 * adframe.ts — production adapter for AdFrameCloser, injected INTO the Google
 * ad iframes (cross-origin) where the rewarded-popup close UI lives.
 *
 * This file owns only the wiring the closing policy refuses to own: the clock,
 * the settings source, and the status channel back to the top page (content.ts
 * shows a badge, so behaviour is visible without DevTools). The policy itself
 * is in ad-frame-closer.ts, where it can be exercised without any of this.
 *
 * Crash-safety: this runs in MANY ad frames, so it must stay cheap. A single
 * inexpensive setInterval (NO MutationObserver — that can storm on busy ad
 * creatives), and every call wrapped so it can never throw. The interval stays
 * alive because Google can reuse a frame for a rewarded ad much later.
 */
(() => {
  "use strict";

  const DEBUG = false;
  const log = (...a: unknown[]): void => {
    try { if (DEBUG) console.log("[ani-ad-skip/adframe]", ...a); } catch { /* ignore */ }
  };

  const report = (status: string): void => {
    try { window.top?.postMessage({ __aniAdframe: status, host: location.hostname }, "*"); } catch { /* ignore */ }
  };

  let settings: AniAdSkip.AdFrameSettings = { enabled: true, waitForRewardAd: true };
  const storage = new AniAdSkip.SettingsStorage(new AniAdSkip.MainWorldChannel());
  storage.onChange((value) => { settings = value; });
  storage.load(() => undefined);

  const closer = new AniAdSkip.AdFrameCloser(document);

  log("loaded in frame:", location.hostname);
  report("frame:" + location.hostname.replace(/\..*/, "…"));

  const tick = (): void => {
    try {
      const outcome = closer.tick(settings);
      for (const candidate of outcome.candidates) report("found #" + candidate.slice(0, 20));
      if (outcome.clicked !== null) {
        log("CLICKED", outcome.clicked);
        report("clicked " + outcome.clicked);
      }
    } catch { /* never throw out of the interval */ }
  };

  try { setInterval(tick, 500); } catch { /* ignore */ }
})();

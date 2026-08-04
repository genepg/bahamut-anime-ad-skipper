/*
 * adframe.ts — injected INTO the Google ad iframes (cross-origin), where the
 * rewarded-popup close UI lives. Auto-clicks the close button once the reward
 * countdown is over, and reports status to the top page (content.ts shows a
 * badge) so behaviour is visible without DevTools.
 *
 * Crash-safety: this runs in MANY ad frames, so it must stay cheap. It uses a
 * single bounded setInterval (NO MutationObserver — that can storm on busy ad
 * creatives), every call is wrapped so it can never throw, and the whole thing
 * stops after a hard cap so nothing runs forever in idle pixel frames.
 *
 * Safe rule: only click the POST-countdown close (#dismiss-button-element) and
 * its confirmation — never the early #dismiss-button (closing before the reward
 * is earned trips anti-adblock).
 */
(() => {
  "use strict";

  const DEBUG = false;
  const log = (...a: unknown[]): void => {
    try { if (DEBUG) console.log("[ani-ad-skip/adframe]", ...a); } catch { /* ignore */ }
  };

  let enabled = true;
  const settings = new AniAdSkip.SettingsStorage();
  settings.onChange((value) => { enabled = value; });
  settings.load(() => undefined);

  const report = (s: string): void => {
    try { window.top?.postMessage({ __aniAdframe: s, host: location.hostname }, "*"); } catch { /* ignore */ }
  };
  log("loaded in frame:", location.hostname);
  report("frame:" + location.hostname.replace(/\..*/, "…"));

  const click = (el: Element | null, why: string): boolean => {
    try {
      if (!AniAdSkip.DOMElement.click(el)) return false;
      log("CLICKED", why);
      report("clicked " + why);
      return true;
    } catch { return false; }
  };

  const dumped = new Set<string>();
  function diagnose(): void {
    try {
      const els = document.querySelectorAll('[id*="dismiss"],[id*="close"],.videoAdUiSkipButton');
      for (const el of els) {
        const key = el.id + "|" + el.className;
        if (dumped.has(key)) continue;
        dumped.add(key);
        log("candidate:", "#" + (el.id || "(noid)"), "text=", JSON.stringify(AniAdSkip.DOMElement.text(el).slice(0, 24)));
        report("found #" + String(el.id || "?").slice(0, 20));
      }
    } catch { /* ignore */ }
  }

  let ticks = 0;
  let timer = 0;
  function tick(): void {
    // hard cap so this never runs forever in a persistent/idle ad frame
    if (++ticks > 900) { clearInterval(timer); return; } // ~7.5 min
    if (!enabled) return;
    try {
      diagnose();

      document.querySelectorAll<HTMLMediaElement>("video").forEach((video) => {
        try {
          if (video.paused && !video.ended) {
            const p = video.play();
            if (p && typeof p.catch === "function") p.catch(() => { /* ignore */ });
          }
        } catch { /* ignore */ }
      });

      // Skippable-ad controls are safe to click any time.
      const skip = document.querySelector<HTMLElement>(
        ".videoAdUiSkipButton, .vast-skip-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern"
      );
      if (skip && !skip.classList.contains("videoAdUiHidden") && click(skip, "skip")) return;
      if (click(document.getElementById("resume_video_button") ?? document.querySelector(".rewardResumebutton"), "resume")) return;

      const ariaSkip = document.querySelector<HTMLElement>(
        '[aria-label*="Skip"], [aria-label*="跳過"], [aria-label*="略過"]'
      );
      if (ariaSkip && click(ariaSkip, "aria-skip")) return;

      // Rewarded popup: ONLY close once the reward countdown is over. While the
      // countdown is running the reward isn't earned yet — closing then pops the
      // "您將無法獲得獎勵" confirmation / trips anti-adblock, so we wait.
      //
      // IMPORTANT: when the countdown finishes, Google HIDES the countdown
      // element (#count-down-container) but leaves its stale "N 秒" text in the
      // DOM, so textContent matches forever. Test only what is actually
      // rendered: the countdown element's visibility + body.innerText (which
      // excludes hidden text). #dismiss-button-element itself stays hidden
      // during the countdown and becomes visible exactly when closing is
      // allowed, so the visibility gate in click() is the real safety.
      const cdc = document.getElementById("count-down-container");
      const visText = ((): string => {
        try { return document.body ? document.body.innerText || "" : ""; } catch { return ""; }
      })();
      const rewardPending = (cdc !== null && AniAdSkip.DOMElement.isVisible(cdc)) || /\d+\s*秒後/.test(visText);
      if (DEBUG) {
        try { document.documentElement.setAttribute("data-aniadskip", ticks + "|" + (rewardPending ? "pending" : "ready")); } catch { /* ignore */ }
      }
      if (!rewardPending) {
        const ariaClose = document.querySelector<HTMLElement>(
          '[aria-label*="關閉"], [aria-label*="Close"], [aria-label*="dismiss"]'
        );
        if (ariaClose && click(ariaClose, "aria-close")) return;

        if (
          click(
            document.getElementById("dismiss-button-element") ??
              document.getElementById("close_button") ??
              document.getElementById("close-ad-button") ??
              document.getElementById("close_button_icon") ??
              document.querySelector(".close-button, .dismiss-button, .btn-close, .ad-close"),
            "dismiss"
          )
        )
          return;

        const CLOSE_REGEX = /關閉廣告|關閉|點此關閉|close\s*ad|close/i;
        for (const el of document.querySelectorAll<HTMLElement>("button, a, div, span, [role=button], input[type=button]")) {
          if (el.children.length > 3) continue;
          const t = AniAdSkip.DOMElement.text(el);
          if (t && t.length <= 15 && CLOSE_REGEX.test(t) && AniAdSkip.DOMElement.isVisible(el)) {
            if (click(el, "close-by-text:" + t)) return;
          }
        }
      }
    } catch { /* never throw out of the interval */ }
  }

  try { timer = setInterval(tick, 500); } catch { /* ignore */ }
})();

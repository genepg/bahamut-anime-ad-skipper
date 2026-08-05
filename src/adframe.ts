/*
 * adframe.ts — injected INTO the Google ad iframes (cross-origin), where the
 * rewarded-popup close UI lives. Auto-clicks the close button once the reward
 * countdown is over, and reports status to the top page (content.ts shows a
 * badge) so behaviour is visible without DevTools.
 *
 * Crash-safety: this runs in MANY ad frames, so it must stay cheap. It uses a
 * single inexpensive setInterval (NO MutationObserver — that can storm on busy
 * ad creatives), and every call is wrapped so it can never throw. The interval
 * stays alive because Google can reuse a frame for a rewarded ad much later.
 *
 * The rewarded creative's real structure, captured live from
 * <hash>.safeframe.googlesyndication.com:
 *
 *   <div id="dismiss-button" class="close-button-outer">      <- WRAPPER, not a button
 *     <div id="count-down-container" class="close-button">
 *       <div id="count-down-text">N 秒後即可獲得獎勵</div>
 *       <div id="close-button" class="disabled">關閉</div>      <- early close (#close-button.disabled {display:none})
 *     </div>
 *     <div id="dismiss-button-element" class="close-button">關閉</div>  <- post-countdown close
 *   </div>
 *   <div id="dialog-wrapper">                                  <- opacity:0;pointer-events:none until .visible
 *     <div id="confirmation-title">關閉廣告？</div>
 *     <div id="confirmation-message">您將無法獲得獎勵</div>
 *     <div id="close-ad-button" role="button">關閉</div>        <- forfeit the reward
 *     <div id="resume-ad-button" role="button">繼續</div>       <- keep watching (never click)
 *   </div>
 *
 * #dismiss-button must never be clicked: it is the always-visible container, so
 * clicking it does nothing while making the click loop believe it succeeded —
 * which is what kept the rewarded ad open until its countdown expired.
 *
 * By default, click #dismiss-button-element only after the countdown. When the
 * user opts out of waiting, click #close-button as soon as Google enables it
 * and confirm the forfeit with #close-ad-button.
 */
(() => {
  "use strict";

  const DEBUG = false;
  const log = (...a: unknown[]): void => {
    try { if (DEBUG) console.log("[ani-ad-skip/adframe]", ...a); } catch { /* ignore */ }
  };

  let enabled = true;
  let waitForRewardAd = true;
  const settings = new AniAdSkip.SettingsStorage();
  settings.onChange((value) => {
    enabled = value.enabled;
    waitForRewardAd = value.waitForRewardAd;
  });
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

  const clickFirstVisible = (elements: readonly (Element | null)[], why: string): boolean => {
    for (const element of elements) {
      if (click(element, why)) return true;
    }
    return false;
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
  function tick(): void {
    ticks += 1;
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

      // Resuming only serves the wait-for-reward flow: it keeps the ad running
      // so the reward is earned. When the user opted out of the reward it is
      // the opposite of what we want — the rewarded popup's "keep watching"
      // control lives right next to the close confirmation, so clicking it here
      // would undo the close we just performed, tick after tick, until the
      // countdown ran out on its own.
      if (waitForRewardAd &&
        click(document.getElementById("resume_video_button") ?? document.querySelector(".rewardResumebutton"), "resume")) return;

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
      const rewardPending =
        (cdc !== null && AniAdSkip.DOMElement.isVisible(cdc)) ||
        /秒後即可獲得獎勵/.test(visText);
      if (DEBUG) {
        try { document.documentElement.setAttribute("data-aniadskip", ticks + "|" + (rewardPending ? "pending" : "ready")); } catch { /* ignore */ }
      }
      if (click(document.getElementById("close-ad-button"), waitForRewardAd ? "confirm-dismiss" : "confirm-without-reward")) return;

      if (!waitForRewardAd) {
        // Forfeit-the-reward confirmations. KEEP_WATCHING must be excluded
        // explicitly: the confirmation dialog puts "繼續觀看" / "Continue
        // watching" beside the close button, and clicking it sends us straight
        // back into the countdown.
        const GIVE_UP_REGEX = /放棄獎勵|不取得獎勵|不要獎勵|仍要關閉|確認關閉|關閉廣告|give\s*up|close\s*(ad|anyway)/i;
        const KEEP_WATCHING_REGEX = /繼續|再看|resume|keep\s*watching|continue/i;
        for (const el of document.querySelectorAll<HTMLElement>("button, [role=button], input[type=button]")) {
          const t = AniAdSkip.DOMElement.text(el);
          if (!t || t.length > 30 || KEEP_WATCHING_REGEX.test(t)) continue;
          if (GIVE_UP_REGEX.test(t) && click(el, "confirm-without-reward")) return;
        }

        if (clickFirstVisible([
          document.getElementById("close-button"),
          document.getElementById("dismiss-button-element"),
          document.getElementById("close_button"),
          document.getElementById("close_button_icon"),
          document.querySelector(".rewarded-ad-close, .early-close-button"),
          document.querySelector('[aria-label*="關閉"], [aria-label*="Close"], [aria-label*="dismiss"]')
        ], "dismiss-without-reward")) return;
      }

      if (!rewardPending) {
        const ariaClose = document.querySelector<HTMLElement>(
          '[aria-label*="關閉"], [aria-label*="Close"], [aria-label*="dismiss"]'
        );
        if (ariaClose && click(ariaClose, "aria-close")) return;

        if (clickFirstVisible([
          document.getElementById("dismiss-button-element"),
          document.getElementById("close_button"),
          document.getElementById("close_button_icon"),
          document.querySelector(".close-button, .dismiss-button, .btn-close, .ad-close")
        ], "dismiss")) return;

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

  try { setInterval(tick, 500); } catch { /* ignore */ }
})();

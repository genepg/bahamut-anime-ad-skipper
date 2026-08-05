/*
 * ad-frame-closer.ts — the closing policy for Google ad frames.
 *
 * This module owns everything about *which* control to press and *when*. It
 * does not own the clock, the settings, or the reporting channel: a caller
 * supplies a document, then calls tick() with the current settings and does
 * what it likes with the outcome. adframe.ts is the production caller; the
 * tests are the other one.
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
 */
namespace AniAdSkip {
  export interface AdFrameSettings {
    readonly enabled: boolean;
    readonly waitForRewardAd: boolean;
  }

  export interface TickOutcome {
    /* The strategy that closed something this tick, or null if nothing was
     * pressed — including when the module deliberately waited. */
    readonly clicked: string | null;
    /* Ids of close-like controls seen for the first time. Diagnostics for the
     * caller's badge; the closing decision never depends on them. */
    readonly candidates: readonly string[];
  }

  /* When a strategy is allowed to run.
   *   always          — safe in both modes
   *   wait-for-reward — only while the user wants the reward
   *   no-reward       — only while the user has opted out of waiting
   *   countdown-done  — only once the reward countdown has finished */
  type StrategyMode = "always" | "wait-for-reward" | "no-reward" | "countdown-done";

  interface CloseStrategy {
    readonly name: string;
    readonly mode: StrategyMode;
    /* Controls to try, in click order. Nulls are allowed so a find() can stay
     * a flat list of lookups. */
    readonly find: (doc: Document) => readonly (Element | null)[];
    /* A scan that picks elements by their label rather than by a known id or
     * class. Leaf-shaped guards (short text, few children) do the safety work
     * here, so the wrapper-id list below does not apply. */
    readonly leafScan?: true;
    /* Only the resume strategy may press a keep-watching control — that is its
     * entire job. Everything else pressing one would undo its own close. */
    readonly mayKeepWatching?: true;
  }

  /* Containers that look like close buttons and are not. Clicking one does
   * nothing while reporting success, which is what kept rewarded ads open
   * until their countdown expired. No strategy may resolve these by id. */
  const WRAPPER_IDS: readonly string[] = ["dismiss-button", "count-down-container", "dialog-wrapper"];

  /* "繼續" / "keep watching" sits right beside the close control in the forfeit
   * confirmation. Pressing it returns the ad to its countdown. */
  const KEEP_WATCHING_TEXT = /繼續|再看|resume|keep\s*watching|continue/i;
  const GIVE_UP_TEXT = /放棄獎勵|不取得獎勵|不要獎勵|仍要關閉|確認關閉|關閉廣告|give\s*up|close\s*(ad|anyway)/i;
  const CLOSE_TEXT = /關閉廣告|關閉|點此關閉|close\s*ad|close/i;

  const list = (...elements: readonly (Element | null)[]): readonly (Element | null)[] => elements;

  const scan = (
    doc: Document,
    selector: string,
    pattern: RegExp,
    maxTextLength: number,
    maxChildren: number
  ): readonly Element[] => {
    const matches: Element[] = [];
    for (const element of doc.querySelectorAll<HTMLElement>(selector)) {
      if (element.children.length > maxChildren) continue;
      const text = DOMElement.text(element);
      if (!text || text.length > maxTextLength) continue;
      if (pattern.test(text)) matches.push(element);
    }
    return matches;
  };

  /* The whole closing policy, in the order it is applied. Read top to bottom. */
  const CLOSE_STRATEGIES: readonly CloseStrategy[] = [
    {
      name: "skip",
      mode: "always",
      find: (doc) => {
        const skip = doc.querySelector(".videoAdUiSkipButton, .vast-skip-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern");
        return skip && !skip.classList.contains("videoAdUiHidden") ? list(skip) : list();
      }
    },
    {
      /* Keeps the ad running so the reward is actually earned. Meaningless
       * once the user has opted out of the reward, and actively harmful — the
       * keep-watching control lives beside the close confirmation, so pressing
       * it would undo the close, tick after tick. */
      name: "resume",
      mode: "wait-for-reward",
      mayKeepWatching: true,
      find: (doc) => list(doc.getElementById("resume_video_button"), doc.querySelector(".rewardResumebutton"))
    },
    {
      name: "aria-skip",
      mode: "always",
      find: (doc) => list(doc.querySelector('[aria-label*="Skip"], [aria-label*="跳過"], [aria-label*="略過"]'))
    },
    {
      /* Confirms a forfeit dialog that is already open. Safe in both modes:
       * the dialog only exists because a close was already requested. */
      name: "confirm-dismiss",
      mode: "always",
      find: (doc) => list(doc.getElementById("close-ad-button"))
    },
    {
      name: "give-up-text",
      mode: "no-reward",
      leafScan: true,
      find: (doc) => scan(doc, "button, [role=button], input[type=button]", GIVE_UP_TEXT, 30, 3)
    },
    {
      /* The early close Google enables partway into the countdown. Taking it
       * forfeits the reward, which is exactly what this mode asked for. */
      name: "early-close",
      mode: "no-reward",
      find: (doc) => list(
        doc.getElementById("close-button"),
        doc.getElementById("dismiss-button-element"),
        doc.getElementById("close_button"),
        doc.getElementById("close_button_icon"),
        doc.querySelector(".rewarded-ad-close, .early-close-button"),
        doc.querySelector('[aria-label*="關閉"], [aria-label*="Close"], [aria-label*="dismiss"]')
      )
    },
    {
      name: "aria-close",
      mode: "countdown-done",
      find: (doc) => list(doc.querySelector('[aria-label*="關閉"], [aria-label*="Close"], [aria-label*="dismiss"]'))
    },
    {
      name: "dismiss",
      mode: "countdown-done",
      find: (doc) => list(
        doc.getElementById("dismiss-button-element"),
        doc.getElementById("close_button"),
        doc.getElementById("close_button_icon"),
        doc.querySelector(".close-button, .dismiss-button, .btn-close, .ad-close")
      )
    },
    {
      name: "close-by-text",
      mode: "countdown-done",
      leafScan: true,
      find: (doc) => scan(doc, "button, a, div, span, [role=button], input[type=button]", CLOSE_TEXT, 15, 3)
    }
  ];

  export class AdFrameCloser {
    private readonly seen = new Set<string>();

    constructor(private readonly doc: Document) {}

    tick(settings: Readonly<AdFrameSettings>): TickOutcome {
      if (!settings.enabled) return { clicked: null, candidates: [] };
      const candidates = this.newCandidates();
      try {
        MediaKeepalive.resumeAll(this.doc);
        const rewardPending = this.isRewardPending();
        for (const strategy of CLOSE_STRATEGIES) {
          if (!this.allows(strategy.mode, settings, rewardPending)) continue;
          for (const element of strategy.find(this.doc)) {
            if (element === null || this.isForbidden(element, strategy)) continue;
            if (DOMElement.click(element) === "clicked") return { clicked: strategy.name, candidates };
          }
        }
      } catch { /* a creative can rewrite itself mid-tick; the next tick retries */ }
      return { clicked: null, candidates };
    }

    /* While the countdown runs the reward is not earned yet, so closing pops
     * the "您將無法獲得獎勵" confirmation or trips anti-adblock.
     *
     * Google HIDES #count-down-container when the countdown ends but leaves its
     * stale "N 秒" text in the DOM, so textContent matches forever. Only what is
     * actually rendered may be tested: the element's visibility, plus
     * body.innerText, which excludes hidden text. */
    private isRewardPending(): boolean {
      const countdown = this.doc.getElementById("count-down-container");
      if (countdown !== null && DOMElement.isVisible(countdown)) return true;
      try {
        return /秒後即可獲得獎勵/.test(this.doc.body ? this.doc.body.innerText || "" : "");
      } catch {
        return false;
      }
    }

    private allows(mode: StrategyMode, settings: Readonly<AdFrameSettings>, rewardPending: boolean): boolean {
      switch (mode) {
        case "always": return true;
        case "wait-for-reward": return settings.waitForRewardAd;
        case "no-reward": return !settings.waitForRewardAd;
        case "countdown-done": return !rewardPending;
      }
    }

    private isForbidden(element: Element, strategy: CloseStrategy): boolean {
      if (!strategy.leafScan && WRAPPER_IDS.includes(element.id)) return true;
      if (!strategy.mayKeepWatching && KEEP_WATCHING_TEXT.test(DOMElement.text(element))) return true;
      return false;
    }

    private newCandidates(): readonly string[] {
      const found: string[] = [];
      try {
        for (const element of this.doc.querySelectorAll('[id*="dismiss"],[id*="close"],.videoAdUiSkipButton')) {
          const key = element.id + "|" + element.className;
          if (this.seen.has(key)) continue;
          this.seen.add(key);
          found.push(element.id || "?");
        }
      } catch { /* ignore */ }
      return found;
    }
  }
}

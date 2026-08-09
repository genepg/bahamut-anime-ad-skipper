/* Deep engine for page-level automation on Bahamut Ani-Gamer. */
namespace AniAdSkip {
  const AD_PLAYING_CLASSES = ["vjs-anigamer-ad-playing", "vjs-anigamer-m3u8-ad-playing", "vjs-anigamer-vast-ad-playing", "vjs-ad-playing", "vjs-anigamer-ad", "vjs-ad-loading"] as const;
  const SKIP_TEXT = /略過廣告|跳過廣告|點此跳過廣告|點擊跳過|略過|跳過|關閉廣告|關閉|點此關閉|skip\s*ad|skip|close\s*ad|close/i;
  const LOGIN_DIALOG_TEXT = /登入|登錄|會員|註冊|訪客|sign\s?in|log\s?in/i;
  const SELECTORS = {
    agree: [".choose-btn-agree", "#adult.choose-btn-agree", "#adultVerify", ".adult-verify .choose-btn-agree", ".adult-verify .btn-agree", "#adult-agree"],
    player: ["#ani_video", ".video-js"],
    adOverlay: [".video-adHandler-background-blocker", ".video-google-AD", "#ani_video_ad", ".ad-container", ".anigamer-ad", "#ad_container"],
    /* Controls that exist only while an ad is on screen. Seeing one is proof
     * of an ad, so this list must stay free of anything the site also uses for
     * its own UI — that is what `genericClose` below is for. */
    adSkip: ["#adSkipButton.enable", ".nativeAD-skip-button.enable", ".vast-skip-button.enable", "#adSkipButton", ".nativeAD-skip-button", ".vast-skip-button", ".vjs-anigamer-ad-skip", ".videoAdUiSkipButton", ".ytp-ad-skip-button", ".ytp-ad-skip-button-modern", "#resume_video_button", ".video-google-AD .skip", ".video-google-AD .close", ".btn-google-AD-close", ".ad-close", ".ad-skip-button", ".skip-ad-button", ".video-ad-skip-button", ".video-ad-skip", "#video-ad-skip", "#skip-ad-button"],
    /* Close controls an ad may use and the site's own dialogs may use too.
     * Pressed once an ad is already confirmed; never evidence of one. */
    genericClose: ["#skip-button", "#dismiss-button", ".dialog-close", ".skip-button", ".pop-close", ".btn-close", "[aria-label*='關閉']", "[aria-label*='Close']"]
  } satisfies Record<string, readonly string[]>;

  export class AdSkipEngine {
    private intervalId: number | null = null;

    start(): void {
      if (this.intervalId !== null) return;
      /* Before the first tick: the engine only nudges during an ad, so a pause
       * the viewer makes beforehand still has to be on record when one starts. */
      MediaKeepalive.watch(document);
      this.intervalId = setInterval(() => this.tick(), 300);
      this.tick();
    }

    stop(): void {
      if (this.intervalId !== null) clearInterval(this.intervalId);
      this.intervalId = null;
    }

    private isSupportedPage(): boolean {
      const path = location.pathname;
      if (path.includes("animeVideo.php") || path.includes("animeRef.php")) return true;
      if (DOMElement.first(SELECTORS.player) !== null) return true;
      if (DOMElement.first(SELECTORS.agree) !== null) return true;
      return false;
    }

    private tick(): void {
      try {
        if (!this.isSupportedPage()) return;
        DOMElement.clickFirst(SELECTORS.agree);
        this.dismissLoginNag();
        if (this.isAdPlaying()) {
          MediaKeepalive.resumeAll();
          this.clickSkip();
        }
      } catch { /* a page change must not stop the engine */ }
    }

    /* Deliberately conservative: every "yes" here turns on the keep-playing
     * nudge and the close ladder, so a false positive means the engine fights
     * the viewer's own pause and presses the site's buttons during ordinary
     * playback. Only ad-specific markers count, and the label scan is confined
     * to the player — "關閉" appears all over the site's page chrome. */
    private isAdPlaying(): boolean {
      const player = DOMElement.first(SELECTORS.player);
      if (player && AD_PLAYING_CLASSES.some((className) => player.classList.contains(className))) return true;
      if (SELECTORS.adOverlay.some((selector) => DOMElement.isVisible(document.querySelector(selector)))) return true;
      if (SELECTORS.adSkip.some((selector) => DOMElement.isVisible(document.querySelector(selector)))) return true;
      if (DOMElement.isVisible(document.querySelector('iframe[src*="doubleclick"], iframe[src*="googlesyndication"], iframe[src*="imasdk"]'))) return true;
      return player !== null && DOMElement.findByText("button, a, div, span, [role=button]", SKIP_TEXT, 15, player) !== null;
    }

    private clickSkip(): void {
      const enabled = document.querySelector<HTMLElement>("#adSkipButton.enable, .nativeAD-skip-button.enable, .vast-skip-button.enable");
      if (enabled && !enabled.classList.contains("vjs-hidden") && DOMElement.click(enabled) === "clicked") return;
      for (const selector of [...SELECTORS.adSkip, ...SELECTORS.genericClose]) {
        const element = document.querySelector<HTMLElement>(selector);
        if (element?.classList.contains("vjs-hidden")) continue;
        if (/廣告\s*\d+\s*秒/.test(DOMElement.text(element)) && !element?.classList.contains("enable")) continue;
        if (DOMElement.click(element) === "clicked") return;
      }
      const byText = DOMElement.findByText("button, a, div, span, [role=button]", SKIP_TEXT, 15);
      if (byText && !/廣告\s*\d+\s*秒/.test(DOMElement.text(byText))) DOMElement.click(byText);
    }

    private dismissLoginNag(): void {
      for (const dialog of document.querySelectorAll<HTMLElement>(".dialogify")) {
        const isInteractiveLogin = dialog.querySelector(
          "iframe[src*='user.gamer.com.tw/login'], iframe[src*='/login.php'], form[action*='/login.php']"
        ) !== null;
        if (isInteractiveLogin) continue;
        if (DOMElement.isVisible(dialog) && LOGIN_DIALOG_TEXT.test(dialog.textContent ?? "")) {
          if (DOMElement.click(dialog.querySelector(".dialogify__close")) === "clicked") return;
        }
      }
    }
  }
}

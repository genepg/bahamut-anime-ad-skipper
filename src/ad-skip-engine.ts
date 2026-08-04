/* Deep engine for page-level automation on Bahamut Ani-Gamer. */
namespace AniAdSkip {
  const AD_PLAYING_CLASSES = ["vjs-anigamer-ad-playing", "vjs-anigamer-m3u8-ad-playing", "vjs-anigamer-vast-ad-playing", "vjs-ad-playing", "vjs-anigamer-ad", "vjs-ad-loading"] as const;
  const SKIP_TEXT = /略過廣告|跳過廣告|點此跳過廣告|點擊跳過|略過|跳過|關閉廣告|關閉|點此關閉|skip\s*ad|skip|close\s*ad|close/i;
  const LOGIN_DIALOG_TEXT = /登入|登錄|會員|註冊|訪客|sign\s?in|log\s?in/i;
  const SELECTORS = {
    agree: [".choose-btn-agree", "#adult.choose-btn-agree", "#adultVerify", ".adult-verify .choose-btn-agree", ".adult-verify .btn-agree", "#adult-agree"],
    player: ["#ani_video", ".video-js"],
    adOverlay: [".video-adHandler-background-blocker", ".video-google-AD", "#ani_video_ad", ".ad-container", ".anigamer-ad", "#ad_container"],
    skip: ["#adSkipButton.enable", ".nativeAD-skip-button.enable", ".vast-skip-button.enable", "#adSkipButton", ".nativeAD-skip-button", ".vast-skip-button", ".vjs-anigamer-ad-skip", ".videoAdUiSkipButton", ".ytp-ad-skip-button", ".ytp-ad-skip-button-modern", "#skip-button", "#dismiss-button", "#resume_video_button", ".video-google-AD .skip", ".video-google-AD .close", ".btn-google-AD-close", ".ad-close", ".dialog-close", ".ad-skip-button", ".skip-ad-button", ".video-ad-skip-button", ".video-ad-skip", ".skip-button", "#video-ad-skip", "#skip-ad-button", ".pop-close", ".btn-close", "[aria-label*='關閉']", "[aria-label*='Close']"]
  } satisfies Record<string, readonly string[]>;

  export class AdSkipEngine {
    private intervalId: number | null = null;
    private adWasPlaying = false;

    start(): void {
      if (this.intervalId !== null) return;
      this.intervalId = setInterval(() => this.tick(), 300);
      this.tick();
    }

    stop(): void {
      if (this.intervalId !== null) clearInterval(this.intervalId);
      this.intervalId = null;
      this.setMuted(false);
      this.adWasPlaying = false;
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
          this.setMuted(true);
          this.clickSkip();
          this.adWasPlaying = true;
        } else if (this.adWasPlaying) {
          this.setMuted(false);
          this.adWasPlaying = false;
        }
      } catch { /* a page change must not stop the engine */ }
    }

    private isAdPlaying(): boolean {
      const player = DOMElement.first(SELECTORS.player);
      if (player && AD_PLAYING_CLASSES.some((className) => player.classList.contains(className))) return true;
      if (SELECTORS.adOverlay.some((selector) => DOMElement.isVisible(document.querySelector(selector)))) return true;
      if (SELECTORS.skip.some((selector) => DOMElement.isVisible(document.querySelector(selector)))) return true;
      if (DOMElement.isVisible(document.querySelector('iframe[src*="doubleclick"], iframe[src*="googlesyndication"], iframe[src*="imasdk"]'))) return true;
      return DOMElement.findByText("button, a, div, span, [role=button]", SKIP_TEXT, 15) !== null;
    }

    private setMuted(muted: boolean): void {
      document.querySelectorAll("video").forEach((video) => { try { video.muted = muted; } catch { /* ignore */ } });
    }

    private clickSkip(): void {
      const enabled = document.querySelector<HTMLElement>("#adSkipButton.enable, .nativeAD-skip-button.enable, .vast-skip-button.enable");
      if (enabled && !enabled.classList.contains("vjs-hidden") && DOMElement.click(enabled)) return;
      for (const selector of SELECTORS.skip) {
        const element = document.querySelector<HTMLElement>(selector);
        if (element?.classList.contains("vjs-hidden")) continue;
        if (/廣告\s*\d+\s*秒/.test(DOMElement.text(element)) && !element?.classList.contains("enable")) continue;
        if (DOMElement.click(element)) return;
      }
      const byText = DOMElement.findByText("button, a, div, span, [role=button]", SKIP_TEXT, 15);
      if (byText && !/廣告\s*\d+\s*秒/.test(DOMElement.text(byText))) DOMElement.click(byText);
    }

    private dismissLoginNag(): void {
      for (const dialog of document.querySelectorAll<HTMLElement>(".dialogify")) {
        if (DOMElement.isVisible(dialog) && LOGIN_DIALOG_TEXT.test(dialog.textContent ?? "")) {
          if (DOMElement.click(dialog.querySelector(".dialogify__close"))) return;
        }
      }
    }
  }
}

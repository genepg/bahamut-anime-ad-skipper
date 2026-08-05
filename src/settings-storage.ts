/* Shared settings module. Its interface hides Chrome storage and optional main-world mirroring. */
namespace AniAdSkip {
  export interface Settings {
    enabled: boolean;
    waitForRewardAd: boolean;
  }

  export class SettingsStorage {
    private value: Settings = { enabled: true, waitForRewardAd: true };
    private readonly listeners = new Set<(settings: Readonly<Settings>) => void>();

    constructor(private readonly mirrorToLocalStorage = false) {}

    load(ready: (settings: Readonly<Settings>) => void): void {
      try {
        chrome.storage.sync.get({ enabled: true, waitForRewardAd: true }, (stored) => {
          this.update({
            enabled: stored["enabled"] === true,
            waitForRewardAd: stored["waitForRewardAd"] === true
          });
          ready(this.value);
        });
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area !== "sync") return;
          const enabled = changes["enabled"];
          const waitForRewardAd = changes["waitForRewardAd"];
          if (!enabled && !waitForRewardAd) return;
          this.update({
            enabled: enabled ? enabled.newValue === true : this.value.enabled,
            waitForRewardAd: waitForRewardAd ? waitForRewardAd.newValue === true : this.value.waitForRewardAd
          });
        });
      } catch {
        this.update({ enabled: true, waitForRewardAd: true });
        ready(this.value);
      }
    }

    onChange(listener: (settings: Readonly<Settings>) => void): void {
      this.listeners.add(listener);
    }

    save(settings: Partial<Settings>): void {
      try { chrome.storage.sync.set(settings); } catch { /* storage unavailable */ }
    }

    private update(settings: Settings): void {
      this.value = settings;
      if (this.mirrorToLocalStorage) {
        try { localStorage.setItem("__aniAdSkip_enabled", settings.enabled ? "true" : "false"); } catch { /* unavailable */ }
      }
      for (const listener of this.listeners) listener(settings);
    }
  }
}

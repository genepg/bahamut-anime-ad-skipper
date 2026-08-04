/* Shared settings module. Its interface hides Chrome storage and optional main-world mirroring. */
namespace AniAdSkip {
  export class SettingsStorage {
    private enabled = true;
    private readonly listeners = new Set<(enabled: boolean) => void>();

    constructor(private readonly mirrorToLocalStorage = false) {}

    load(ready: (enabled: boolean) => void): void {
      try {
        chrome.storage.sync.get({ enabled: true }, (stored) => {
          this.update(stored["enabled"] === true);
          ready(this.enabled);
        });
        chrome.storage.onChanged.addListener((changes, area) => {
          const change = changes["enabled"];
          if (area === "sync" && change) this.update(change.newValue === true);
        });
      } catch {
        this.update(true);
        ready(this.enabled);
      }
    }

    onChange(listener: (enabled: boolean) => void): void {
      this.listeners.add(listener);
    }

    save(enabled: boolean): void {
      try { chrome.storage.sync.set({ enabled }); } catch { /* storage unavailable */ }
    }

    private update(enabled: boolean): void {
      this.enabled = enabled;
      if (this.mirrorToLocalStorage) {
        try { localStorage.setItem("__aniAdSkip_enabled", enabled ? "true" : "false"); } catch { /* unavailable */ }
      }
      for (const listener of this.listeners) listener(enabled);
    }
  }
}

/* The seam between the two execution worlds.
 *
 * The isolated world owns the settings (only it can reach chrome.storage); the
 * main world needs them (only it can patch the page's own globals). The two
 * cannot share an object, so they share this module — loaded into both worlds,
 * and the single place the transport keys are spelled out.
 *
 * Two transports, because one cannot do both jobs:
 *
 *   snapshot (localStorage)  — readable synchronously at document_start, which
 *                              is before the isolated world has heard back from
 *                              chrome.storage. Last known value, good enough to
 *                              decide whether to spoof before the page runs.
 *   update   (CustomEvent)   — live changes from the popup. DOM events cross
 *                              worlds; the payload is a JSON string because
 *                              object identity does not survive the crossing.
 *
 * Shipped TWICE, under two names. Chrome injects a given content-script file
 * into a given frame only once, even when two content_scripts entries name it
 * for two different worlds — the second injection is silently skipped, and the
 * world that lost the race sees an AniAdSkip without a MainWorldChannel on it.
 * The build therefore copies this module to main-world-channel.main.js for the
 * MAIN world (see `copy-static`). One source, two artifacts.
 *
 * Note for readers grepping the page for extension traces: loading this file
 * into the MAIN world puts the `AniAdSkip` namespace on the page's global
 * object. The TypeScript namespace emit uses `var`, so it cannot be deleted
 * afterwards. The page is already observably patched (window.alert, the
 * visibility descriptors), so this adds no capability the page lacked. */
namespace AniAdSkip {
  const SNAPSHOT_KEY = "__aniAdSkip_settings";
  const UPDATE_EVENT = "__aniAdSkip_settings_changed";

  const DEFAULTS: Settings = { enabled: true, waitForRewardAd: true };

  const decode = (raw: string | null): Settings => {
    if (raw === null) return DEFAULTS;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) return DEFAULTS;
      const record = parsed as Record<string, unknown>;
      return {
        enabled: record["enabled"] !== false,
        waitForRewardAd: record["waitForRewardAd"] !== false
      };
    } catch {
      return DEFAULTS;
    }
  };

  export class MainWorldChannel {
    /* Called from the isolated world on every settings change. */
    publish(settings: Readonly<Settings>): void {
      const encoded = JSON.stringify({ enabled: settings.enabled, waitForRewardAd: settings.waitForRewardAd });
      try { localStorage.setItem(SNAPSHOT_KEY, encoded); } catch { /* storage partitioned or blocked */ }
      try {
        document.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: encoded }));
      } catch { /* document torn down mid-publish */ }
    }

    /* Called from the main world. The listener fires immediately with the
     * snapshot so a caller never has to handle "settings not known yet", then
     * again on every published change. */
    subscribe(listener: (settings: Readonly<Settings>) => void): void {
      let snapshot: string | null = null;
      try { snapshot = localStorage.getItem(SNAPSHOT_KEY); } catch { /* unavailable in this frame */ }
      listener(decode(snapshot));

      document.addEventListener(UPDATE_EVENT, (event: Event) => {
        const detail = (event as CustomEvent<unknown>).detail;
        listener(decode(typeof detail === "string" ? detail : null));
      });
    }
  }
}

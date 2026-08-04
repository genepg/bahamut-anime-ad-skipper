/* Main-world guard for the Ani-Gamer anti-adblock alert. */
(() => {
  "use strict";

  try {
    const originalAlert = window.alert.bind(window);
    window.alert = (message?: unknown): void => {
      if (typeof message === "string" && /擋廣告|廣告插件|影響播放器|ad-?block/i.test(message)) return;
      originalAlert(message);
    };
  } catch { /* never interfere with playback */ }
})();

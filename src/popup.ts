/* Popup adapter for the shared SettingsStorage module. */
(() => {
  "use strict";
  const enabled = document.getElementById("enabled");
  const waitForRewardAd = document.getElementById("waitForRewardAd");
  if (!(enabled instanceof HTMLInputElement)) throw new Error("popup: #enabled checkbox not found");
  if (!(waitForRewardAd instanceof HTMLInputElement)) throw new Error("popup: #waitForRewardAd checkbox not found");

  const settings = new AniAdSkip.SettingsStorage();
  settings.load((value) => {
    enabled.checked = value.enabled;
    waitForRewardAd.checked = value.waitForRewardAd;
  });
  enabled.addEventListener("change", () => settings.save({ enabled: enabled.checked }));
  waitForRewardAd.addEventListener("change", () => settings.save({ waitForRewardAd: waitForRewardAd.checked }));
})();

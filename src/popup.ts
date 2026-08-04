/* Popup adapter for the shared SettingsStorage module. */
(() => {
  "use strict";
  const enabled = document.getElementById("enabled");
  if (!(enabled instanceof HTMLInputElement)) throw new Error("popup: #enabled checkbox not found");

  const settings = new AniAdSkip.SettingsStorage();
  settings.load((value) => { enabled.checked = value; });
  enabled.addEventListener("change", () => settings.save(enabled.checked));
})();

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";
import type { Browser, Locator } from "playwright";

test("popup loads and saves both ad-skip preferences", async () => {
  let context: Browser | undefined;

  try {
    context = await chromium.launch({ headless: true });
    const page = await context.newPage();
    await page.evaluate(() => {
      globalThis.savedSettings = [];
      /* Only the three storage entry points SettingsStorage actually reaches
       * for. The cast is the stub admitting it is not the whole chrome API. */
      const stub = {
        storage: {
          sync: {
            get(defaults: Partial<AniAdSkip.Settings>, ready: (items: Partial<AniAdSkip.Settings>) => void) { ready(defaults); },
            set(value: Partial<AniAdSkip.Settings>) { globalThis.savedSettings.push(value); },
          },
          onChanged: { addListener() {} },
        },
      };
      (globalThis as Record<string, unknown>)["chrome"] = stub;
    });

    const [popupHtml, settingsScript, popupScript] = await Promise.all([
      readFile(new URL("../dist/popup.html", import.meta.url), "utf8"),
      readFile(new URL("../dist/settings-storage.js", import.meta.url), "utf8"),
      readFile(new URL("../dist/popup.js", import.meta.url), "utf8"),
    ]);
    await page.setContent(popupHtml);
    await page.evaluate(`${settingsScript}\n${popupScript}`);

    const checkbox = page.locator("#enabled");
    const slider = page.locator('label[aria-label="啟用 / Enabled"] .slider');
    await assertCheckboxState(checkbox, true);
    await slider.click();
    await assertCheckboxState(checkbox, false);

    const waitForReward = page.locator("#waitForRewardAd");
    await assertCheckboxState(waitForReward, true);
    await page.locator('label[aria-label="等待獎勵廣告 / Wait for reward"] .slider').click();
    await assertCheckboxState(waitForReward, false);
    assert.deepEqual(await page.evaluate(() => globalThis.savedSettings), [
      { enabled: false },
      { waitForRewardAd: false },
    ]);
  } finally {
    await context?.close();
  }
});

async function assertCheckboxState(checkbox: Locator, checked: boolean): Promise<void> {
  await checkbox.waitFor({ state: "attached" });
  assert.equal(await checkbox.isChecked(), checked, "unexpected enabled switch state");
}

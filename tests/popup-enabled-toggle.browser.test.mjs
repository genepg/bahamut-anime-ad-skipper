import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";

test("popup loads and saves both ad-skip preferences", async () => {
  let context;

  try {
    context = await chromium.launch({ headless: true });
    const page = await context.newPage();
    await page.evaluate(() => {
      globalThis.savedSettings = [];
      globalThis.chrome = {
        storage: {
          sync: {
            get(defaults, ready) { ready(defaults); },
            set(value) { globalThis.savedSettings.push(value); },
          },
          onChanged: { addListener() {} },
        },
      };
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

async function assertCheckboxState(checkbox, checked) {
  await checkbox.waitFor({ state: "attached" });
  assert.equal(await checkbox.isChecked(), checked, "unexpected enabled switch state");
}

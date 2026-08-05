import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";

test("clicking the visible Enabled switch toggles the checkbox", async () => {
  let context;

  try {
    context = await chromium.launch({ headless: true });
    const page = await context.newPage();
    await page.evaluate(() => {
      globalThis.chrome = {
        storage: {
          sync: {
            get(defaults, ready) { ready(defaults); },
            set() {},
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
    const slider = page.locator(".slider");
    await assertCheckboxState(checkbox, true);
    await slider.click();
    await assertCheckboxState(checkbox, false);
  } finally {
    await context?.close();
  }
});

async function assertCheckboxState(checkbox, checked) {
  await checkbox.waitFor({ state: "attached" });
  assert.equal(await checkbox.isChecked(), checked, "unexpected enabled switch state");
}

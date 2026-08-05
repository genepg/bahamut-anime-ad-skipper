/* The seam between the isolated and main worlds, and the spoofer that lives on
 * the far side of it. Both worlds are the same JS context here — what is under
 * test is the transport contract, not Chrome's world isolation. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";

test("a subscriber hears the snapshot immediately, then every published change", async () => {
  const { browser, page } = await openHost(["main-world-channel.js"]);
  try {
    const heard = await page.evaluate(() => {
      const channel = new AniAdSkip.MainWorldChannel();
      const seen = [];
      channel.subscribe((settings) => seen.push(settings));
      channel.publish({ enabled: false, waitForRewardAd: true });
      channel.publish({ enabled: true, waitForRewardAd: false });
      return seen;
    });

    assert.deepEqual(heard, [
      { enabled: true, waitForRewardAd: true },
      { enabled: false, waitForRewardAd: true },
      { enabled: true, waitForRewardAd: false },
    ]);
  } finally {
    await browser.close();
  }
});

test("the snapshot survives a reload, so document_start knows the last value", async () => {
  const { browser, page } = await openHost(["main-world-channel.js"]);
  try {
    await page.evaluate(() => new AniAdSkip.MainWorldChannel().publish({ enabled: false, waitForRewardAd: false }));
    await page.reload();
    await loadScripts(page, ["main-world-channel.js"]);

    const snapshot = await page.evaluate(() => {
      let seen = null;
      new AniAdSkip.MainWorldChannel().subscribe((settings) => { seen = settings; });
      return seen;
    });
    assert.deepEqual(snapshot, { enabled: false, waitForRewardAd: false });
  } finally {
    await browser.close();
  }
});

test("turning the extension off un-spoofs the open page, and back on re-spoofs it", async () => {
  const { browser, page } = await openHost(["main-world-channel.js", "inject.js"]);
  try {
    assert.equal(await spoofed(page), true, "an unset snapshot defaults to enabled");

    await publish(page, { enabled: false, waitForRewardAd: true });
    assert.equal(await spoofed(page), false, "the visibility patch must not outlive the toggle");
    assert.equal(
      await page.evaluate(() => window.alert === globalThis.__alertBefore),
      true,
      "the alert override must be handed back too",
    );

    await publish(page, { enabled: true, waitForRewardAd: true });
    assert.equal(await spoofed(page), true);
  } finally {
    await browser.close();
  }
});

test("a page whose last known setting was off is never spoofed at all", async () => {
  const { browser, page } = await openHost(["main-world-channel.js"]);
  try {
    await publish(page, { enabled: false, waitForRewardAd: true });
    await page.reload();
    await loadScripts(page, ["main-world-channel.js", "inject.js"]);

    assert.equal(await spoofed(page), false);
    assert.equal(await page.evaluate(() => document.hasFocus.toString().includes("true")), false);
  } finally {
    await browser.close();
  }
});

const spoofed = (page) => page.evaluate(() => Object.hasOwn(document, "hidden"));

const publish = (page, settings) =>
  page.evaluate((value) => new AniAdSkip.MainWorldChannel().publish(value), settings);

async function loadScripts(page, scriptNames) {
  const scripts = await Promise.all(
    scriptNames.map((name) => readFile(new URL(`../dist/${name}`, import.meta.url), "utf8")),
  );
  // inject.js reads the snapshot as it loads, so capture the pristine alert first.
  await page.evaluate(() => { globalThis.__alertBefore = window.alert; });
  await page.evaluate(`${scripts.join("\n")}\nglobalThis.AniAdSkip = AniAdSkip; undefined;`);
}

async function openHost(scriptNames) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  // A real origin: localStorage is unavailable on an opaque one, and inject.js
  // only arms itself on hosts the manifest actually matches.
  await page.route("https://ani.gamer.com.tw/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>host</title>" }),
  );
  await page.goto("https://ani.gamer.com.tw/animeVideo.php?sn=test");
  await loadScripts(page, scriptNames);
  return { browser, page };
}

/* The keep-playing nudge exists for creatives that pause themselves. It must
 * never win an argument with the person watching: once the viewer presses
 * pause, the video stays paused. These drive real trusted input (page.click)
 * rather than element.click(), because "was there a user gesture" is the whole
 * question under test. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";

test("a video the viewer paused during an ad stays paused", async () => {
  const fixture = await openEngineFixture({ adPlaying: true });
  try {
    await fixture.page.locator("#pause-button").click();
    await fixture.page.waitForTimeout(1200); // four engine ticks
    assert.equal(await isPaused(fixture.page), true);
  } finally {
    await fixture.browser.close();
  }
});

test("a pause the viewer did not make is still nudged back to playing", async () => {
  const fixture = await openEngineFixture({ adPlaying: true });
  try {
    await fixture.page.evaluate(() => document.querySelector("#player").pause());
    await fixture.page.waitForFunction(() => !document.querySelector("#player").paused, null, { timeout: 5_000 });
  } finally {
    await fixture.browser.close();
  }
});

test("the viewer can pause again after resuming a paused ad themselves", async () => {
  const fixture = await openEngineFixture({ adPlaying: true });
  try {
    await fixture.page.locator("#pause-button").click();
    await fixture.page.locator("#play-button").click();
    await fixture.page.waitForFunction(() => !document.querySelector("#player").paused, null, { timeout: 5_000 });
    await fixture.page.locator("#pause-button").click();
    await fixture.page.waitForTimeout(1200);
    assert.equal(await isPaused(fixture.page), true, "the second pause is the viewer's too");
  } finally {
    await fixture.browser.close();
  }
});

test("ordinary page furniture is not mistaken for an ad", async () => {
  // No ad markers — just the site's own close controls and a collapsed ad
  // container, which is what the page looks like between ads.
  const fixture = await openEngineFixture({ adPlaying: false });
  try {
    await fixture.page.evaluate(() => document.querySelector("#player").pause());
    await fixture.page.waitForTimeout(1200);
    assert.equal(await isPaused(fixture.page), true, "no ad is playing, so nothing should be nudged");
  } finally {
    await fixture.browser.close();
  }
});

function isPaused(page) {
  return page.evaluate(() => document.querySelector("#player").paused);
}

async function openEngineFixture({ adPlaying }) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const scripts = await Promise.all(
    ["dom-element.js", "media-keepalive.js", "ad-skip-engine.js"].map((name) =>
      readFile(new URL(`../dist/${name}`, import.meta.url), "utf8"),
    ),
  );

  await page.setContent(`
    <div id="ani_video" class="${adPlaying ? "vjs-anigamer-ad-playing" : ""}" style="width:640px;height:360px">
      <video id="player" muted style="width:320px;height:180px"></video>
    </div>
    <button id="pause-button" style="width:60px;height:30px">暫停</button>
    <button id="play-button" style="width:60px;height:30px">播放</button>
    <!-- Site chrome that happens to look like ad controls. -->
    <div class="video-google-AD" style="width:640px;height:0"></div>
    <button class="btn-close" style="width:20px;height:20px">關閉</button>
    <script>
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      canvas.getContext("2d").fillRect(0, 0, 32, 32);
      const player = document.querySelector("#player");
      player.srcObject = canvas.captureStream(10);
      player.play();
      document.querySelector("#pause-button").addEventListener("click", () => player.pause());
      document.querySelector("#play-button").addEventListener("click", () => player.play());
    </script>
  `);
  await page.waitForFunction(() => !document.querySelector("#player").paused, null, { timeout: 5_000 });
  await page.evaluate(`${scripts.join("\n")}\nnew AniAdSkip.AdSkipEngine().start();`);
  return { browser, page };
}

/* The click seam reports why it refused, not just that it did. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";

const visible = "display:block;width:40px;height:20px";

test("a click attempt reports the reason it was refused", async () => {
  const { browser, page } = await openPage(`
    <button id="ready" style="${visible}">關閉</button>
    <button id="hidden" style="display:none">關閉</button>
    <button id="off" style="${visible}" disabled>關閉</button>
    <a id="away" href="https://ani.gamer.com.tw/" style="${visible}">關閉</a>
    <a id="inert" href="#" style="${visible}">關閉</a>
  `, ["dom-element.js"]);
  try {
    const outcome = (selector) => page.evaluate(
      (value) => AniAdSkip.DOMElement.click(document.querySelector(value)),
      selector,
    );

    assert.equal(await outcome("#ready"), "clicked");
    assert.equal(await outcome("#hidden"), "invisible");
    assert.equal(await outcome("#off"), "disabled");
    assert.equal(await outcome("#away"), "navigation", "following a link would leave the page");
    assert.equal(await outcome("#inert"), "clicked", "an href of # goes nowhere, so it is a control");
    assert.equal(await page.evaluate(() => AniAdSkip.DOMElement.click(null)), "invisible");
  } finally {
    await browser.close();
  }
});

test("keep-playing nudges every paused video under the root it is given", async () => {
  const { browser, page } = await openPage("", ["media-keepalive.js"]);
  try {
    // A nudged video is no longer paused, so each case starts from fresh markup.
    const resumed = (rootSelector) => page.evaluate((root) => {
      document.body.innerHTML = '<video id="a"></video><div id="frame"><video id="b"></video></div>';
      return AniAdSkip.MediaKeepalive.resumeAll(root === null ? undefined : document.querySelector(root));
    }, rootSelector);

    assert.equal(await resumed(null), 2, "the whole document by default");
    assert.equal(await resumed("#frame"), 1, "the root scopes the search");
    assert.equal(await resumed("video"), 0, "a subtree with no video of its own");
  } finally {
    await browser.close();
  }
});

async function openPage(body, scriptNames) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const scripts = await Promise.all(
    scriptNames.map((name) => readFile(new URL(`../dist/${name}`, import.meta.url), "utf8")),
  );
  await page.setContent(body);
  await page.evaluate(`${scripts.join("\n")}\nglobalThis.AniAdSkip = AniAdSkip; undefined;`);
  return { browser, page };
}

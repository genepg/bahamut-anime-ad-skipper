/* Exercises the closing policy through AdFrameCloser.tick(). No extension, no
 * chrome stub, no clock: a document goes in, a TickOutcome comes out. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";

const visible = "display:block;width:40px;height:20px";
const WAIT = { enabled: true, waitForRewardAd: true };
const NO_REWARD = { enabled: true, waitForRewardAd: false };

/* The exact structure Google serves on ani.gamer.com.tw, captured live.
 * #close-button starts disabled; Google enables it partway into the countdown,
 * which the tests trigger explicitly via enableEarlyClose(). */
const GOOGLE_REWARDED_MARKUP = `
  <div id="dismiss-button" class="close-button-outer" style="display:block;width:200px;height:40px">
    <div id="count-down-container" class="close-button" style="${visible}">
      <div id="count-down-text">10 秒後即可獲得獎勵</div>
      <div id="close-button" class="disabled" style="display:none;width:40px;height:20px">關閉</div>
    </div>
    <div id="dismiss-button-element" class="close-button" style="display:none;width:40px;height:20px">關閉</div>
  </div>
  <div id="dialog-wrapper" style="opacity:0;pointer-events:none;width:200px;height:100px">
    <div id="close-ad-button" role="button" style="${visible}">關閉</div>
    <div id="resume-ad-button" role="button" style="${visible}">繼續</div>
  </div>
  <script>
    // Taking the early close fades in the forfeit-the-reward confirmation.
    document.querySelector("#close-button").addEventListener("click", () => {
      const wrapper = document.querySelector("#dialog-wrapper");
      wrapper.style.opacity = "1";
      wrapper.style.pointerEvents = "auto";
    });
  </script>`;

test("wait-for-reward mode presses nothing while the countdown runs", async () => {
  const fixture = await openCloser(GOOGLE_REWARDED_MARKUP);
  try {
    await fixture.enableEarlyClose();
    assert.equal((await fixture.tick(WAIT)).clicked, null);
    assert.equal((await fixture.tick(WAIT)).clicked, null);
    assert.equal(await fixture.clicked("#close-button"), null, "closing early forfeits the reward");
    assert.equal(await fixture.clicked("#close-ad-button"), null);
  } finally {
    await fixture.close();
  }
});

test("wait-for-reward mode closes once the countdown is over", async () => {
  const fixture = await openCloser(GOOGLE_REWARDED_MARKUP);
  try {
    await fixture.endCountdown();
    assert.equal((await fixture.tick(WAIT)).clicked, "dismiss");
    assert.equal(await fixture.clicked("#dismiss-button-element"), "yes");
  } finally {
    await fixture.close();
  }
});

test("no-reward mode takes the early close during the countdown, then confirms the forfeit", async () => {
  const fixture = await openCloser(GOOGLE_REWARDED_MARKUP);
  try {
    assert.equal((await fixture.tick(NO_REWARD)).clicked, null, "nothing to press until Google enables the early close");
    await fixture.enableEarlyClose();

    assert.equal((await fixture.tick(NO_REWARD)).clicked, "early-close");
    assert.equal(await fixture.countdownVisible(), true, "the ad must be dismissed before its countdown ends");
    assert.equal((await fixture.tick(NO_REWARD)).clicked, "confirm-dismiss");
    assert.equal(await fixture.clicked("#close-ad-button"), "yes");
  } finally {
    await fixture.close();
  }
});

test("the #dismiss-button wrapper and the countdown container are never close controls", async () => {
  const fixture = await openCloser(GOOGLE_REWARDED_MARKUP);
  try {
    await fixture.enableEarlyClose();
    for (const settings of [NO_REWARD, NO_REWARD, WAIT]) await fixture.tick(settings);
    assert.equal(await fixture.clicked("#dismiss-button"), null, "the wrapper is not a close control");
    assert.equal(await fixture.clicked("#count-down-container"), null, "the countdown container is not one either");
    assert.equal(await fixture.clicked("#resume-ad-button"), null, "must not press 繼續");
  } finally {
    await fixture.close();
  }
});

test("no-reward mode confirms the close instead of the keep-watching control", async () => {
  const fixture = await openCloser(`
    <div id="count-down-container" style="${visible}">10 秒後即可獲得獎勵</div>
    <button id="resume_video_button" style="${visible}">繼續觀看廣告</button>
    <button id="keep-watching" style="${visible}">繼續觀看</button>
    <button id="close-ad-button" style="${visible}">關閉廣告</button>
  `);
  try {
    assert.equal((await fixture.tick(NO_REWARD)).clicked, "confirm-dismiss");
    assert.equal(await fixture.clicked("#resume_video_button"), null, "must not resume the ad it is closing");
    assert.equal(await fixture.clicked("#keep-watching"), null, "must not press 繼續觀看");
  } finally {
    await fixture.close();
  }
});

test("wait-for-reward mode keeps a stalled rewarded ad running", async () => {
  const fixture = await openCloser(`
    <div id="count-down-container" style="${visible}">10 秒後即可獲得獎勵</div>
    <button id="resume_video_button" style="${visible}">繼續觀看廣告</button>
  `);
  try {
    assert.equal((await fixture.tick(WAIT)).clicked, "resume", "resume is the one control allowed to say 繼續");
  } finally {
    await fixture.close();
  }
});

test("an early close nested in a pointer-events:none wrapper is still taken", async () => {
  // Google wraps the rewarded controls in a click-through overlay and re-enables
  // pointer events on the control itself. Treating the wrapper as opaque made
  // the early close look unclickable, so the ad ran its full countdown.
  const fixture = await openCloser(`
    <div id="count-down-container" style="${visible}">10 秒後即可獲得獎勵</div>
    <div id="overlay" style="display:block;width:200px;height:80px;pointer-events:none">
      <div id="close-button" style="${visible};pointer-events:auto">關閉</div>
    </div>
  `);
  try {
    assert.equal((await fixture.tick(NO_REWARD)).clicked, "early-close");
    assert.equal(await fixture.clicked("#close-button"), "yes");
  } finally {
    await fixture.close();
  }
});

test("a frame exposing no known countdown is closed by its label", async () => {
  const fixture = await openCloser(`<button id="dismiss-button" style="${visible}">close</button>`);
  try {
    // #dismiss-button is only a wrapper in the rewarded creative. As a leaf
    // labelled "close" it is the real control, and the text scan may take it.
    assert.equal((await fixture.tick(NO_REWARD)).clicked, "close-by-text");
    assert.equal(await fixture.clicked("#dismiss-button"), "yes");
  } finally {
    await fixture.close();
  }
});

test("a rewarded ad appearing after 900 ticks is still handled", async () => {
  const fixture = await openCloser("<main>idle ad frame</main>");
  try {
    await fixture.page.evaluate((settings) => {
      for (let index = 0; index < 901; index += 1) globalThis.__closer.tick(settings);
    }, NO_REWARD);
    await fixture.page.evaluate((style) => {
      document.body.insertAdjacentHTML("beforeend", `<button id="dismiss-button-element" style="${style}">關閉</button>`);
      document.querySelector("#dismiss-button-element").addEventListener("click", (event) => {
        event.currentTarget.dataset.clicked = "yes";
      });
    }, visible);
    assert.equal((await fixture.tick(NO_REWARD)).clicked, "early-close");
  } finally {
    await fixture.close();
  }
});

test("a disabled closer presses nothing", async () => {
  const fixture = await openCloser(`<button id="dismiss-button-element" style="${visible}">關閉</button>`);
  try {
    const outcome = await fixture.tick({ enabled: false, waitForRewardAd: false });
    assert.deepEqual(outcome, { clicked: null, candidates: [] });
    assert.equal(await fixture.clicked("#dismiss-button-element"), null);
  } finally {
    await fixture.close();
  }
});

test("close-like controls are reported once, as diagnostics", async () => {
  const fixture = await openCloser(`<div id="dismiss-button-element" style="display:none;width:0;height:0">關閉</div>`);
  try {
    assert.deepEqual((await fixture.tick(WAIT)).candidates, ["dismiss-button-element"]);
    assert.deepEqual((await fixture.tick(WAIT)).candidates, [], "already-seen controls are not re-reported");
  } finally {
    await fixture.close();
  }
});

async function openCloser(body) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const scripts = await Promise.all([
    readFile(new URL("../dist/dom-element.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/media-keepalive.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/ad-frame-closer.js", import.meta.url), "utf8"),
  ]);

  await page.setContent(`${body}
    <script>
      for (const el of document.querySelectorAll("[id]")) {
        el.addEventListener("click", (event) => {
          if (event.target === event.currentTarget) event.currentTarget.dataset.clicked = "yes";
        });
      }
    </script>`);
  await page.evaluate(`${scripts.join("\n")}
    globalThis.__closer = new AniAdSkip.AdFrameCloser(document); undefined;`);

  return {
    page,
    close: () => browser.close(),
    tick: (settings) => page.evaluate((value) => globalThis.__closer.tick(value), settings),
    clicked: (selector) => page.locator(selector).getAttribute("data-clicked"),
    countdownVisible: () => page.evaluate(() => document.querySelector("#count-down-container").style.display !== "none"),
    enableEarlyClose: () => page.evaluate(() => {
      const close = document.querySelector("#close-button");
      close.classList.remove("disabled");
      close.style.display = "block";
    }),
    endCountdown: () => page.evaluate(() => {
      document.querySelector("#count-down-container").style.display = "none";
      document.querySelector("#dismiss-button-element").style.display = "block";
    }),
  };
}

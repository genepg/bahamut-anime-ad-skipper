import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";

const visible = "display:block;width:40px;height:20px";

test("wait-for-reward mode leaves early close alone and closes after countdown", async () => {
  const fixture = await openRewardAd(true);
  try {
    await fixture.page.waitForTimeout(650);
    assert.equal(await fixture.page.locator("#dismiss-button-element").getAttribute("data-clicked"), null);

    await fixture.page.evaluate(() => {
      document.querySelector("#count-down-container").style.display = "none";
    });
    await fixture.page.waitForFunction(() => document.querySelector("#dismiss-button-element").dataset.clicked === "yes");
    await fixture.page.waitForFunction(() => document.querySelector("#close-ad-button").dataset.clicked === "yes");
  } finally {
    await fixture.browser.close();
  }
});

test("no-reward mode clicks early close and the extra confirmation button", async () => {
  const fixture = await openRewardAd(false, { useGoogleCountdownClose: true, includeHiddenDismissElement: true });
  try {
    await fixture.page.waitForFunction(() => document.querySelector("#close-button").dataset.clicked === "yes", null, { timeout: 2000 });
    assert.equal(
      await fixture.page.locator("#close-button").getAttribute("data-clicked-during-countdown"),
      "yes",
      "rewarded ad must be dismissed before its countdown ends"
    );
    await fixture.page.waitForFunction(() => document.querySelector("#close-ad-button").dataset.clicked === "yes");
  } finally {
    await fixture.browser.close();
  }
});

test("no-reward mode closes goog_rewarded when Google exposes no known countdown", async () => {
  const fixture = await openRewardAd(false, { includeCountdown: false, closeId: "dismiss-button" });
  try {
    await fixture.page.waitForFunction(() => document.querySelector("#dismiss-button").dataset.clicked === "yes");
    await fixture.page.waitForFunction(() => document.querySelector("#close-ad-button").dataset.clicked === "yes");
  } finally {
    await fixture.browser.close();
  }
});

test("no-reward mode still handles a rewarded ad appearing after 7.5 minutes", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    const [domElementScript, settingsScript, adframeScript] = await Promise.all([
      readFile(new URL("../dist/dom-element.js", import.meta.url), "utf8"),
      readFile(new URL("../dist/settings-storage.js", import.meta.url), "utf8"),
      readFile(new URL("../dist/adframe.js", import.meta.url), "utf8"),
    ]);
    await page.setContent("<main>idle ad frame</main>");
    await page.evaluate(() => {
      let callback = () => {};
      let active = true;
      globalThis.setInterval = (next) => { callback = next; return 1; };
      globalThis.clearInterval = () => { active = false; };
      globalThis.runAdframeTick = () => { if (active) callback(); };
      globalThis.chrome = {
        storage: {
          sync: { get(defaults, ready) { ready({ ...defaults, waitForRewardAd: false }); }, set() {} },
          onChanged: { addListener() {} },
        },
      };
    });
    await page.evaluate(`${domElementScript}\n${settingsScript}\n${adframeScript}`);
    await page.evaluate(() => { for (let index = 0; index < 901; index += 1) globalThis.runAdframeTick(); });
    await page.evaluate(() => {
      document.body.insertAdjacentHTML("beforeend", '<button id="dismiss-button-element" style="display:block;width:40px;height:20px">close</button>');
      document.querySelector("#dismiss-button-element").addEventListener("click", event => { event.currentTarget.dataset.clicked = "yes"; });
      globalThis.runAdframeTick();
    });
    assert.equal(await page.locator("#dismiss-button-element").getAttribute("data-clicked"), "yes");
  } finally {
    await browser.close();
  }
});

test("no-reward mode clicks an early close nested in a pointer-events:none wrapper", async () => {
  // Google wraps the rewarded controls in a click-through overlay and re-enables
  // pointer events on the control itself. Treating the wrapper as opaque made
  // the early close look unclickable, so the ad ran its full countdown.
  const { browser, page } = await openAdFrame(false, `
    <div id="count-down-container" style="${visible}">10 秒後即可獲得獎勵</div>
    <div id="overlay" style="display:block;width:200px;height:80px;pointer-events:none">
      <div id="close-button" style="${visible};pointer-events:auto">關閉</div>
    </div>
  `);
  try {
    await page.waitForFunction(() => document.querySelector("#close-button").dataset.clicked === "yes", null, { timeout: 3000 });
  } finally {
    await browser.close();
  }
});

test("no-reward mode confirms the close instead of the keep-watching control", async () => {
  const { browser, page } = await openAdFrame(false, `
    <div id="count-down-container" style="${visible}">10 秒後即可獲得獎勵</div>
    <button id="dismiss-button" style="${visible}">關閉</button>
    <button id="resume_video_button" style="${visible}">繼續觀看廣告</button>
    <button id="keep-watching" style="${visible}">繼續觀看</button>
    <button id="close-ad-button" style="${visible}">關閉廣告</button>
  `);
  try {
    await page.waitForFunction(() => document.querySelector("#close-ad-button").dataset.clicked === "yes", null, { timeout: 3000 });
    assert.equal(await page.locator("#resume_video_button").getAttribute("data-clicked"), null, "must not resume the ad it is closing");
    assert.equal(await page.locator("#keep-watching").getAttribute("data-clicked"), null, "must not press 繼續觀看");
  } finally {
    await browser.close();
  }
});

// The exact structure Google serves on ani.gamer.com.tw, captured live.
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
    // Google enables the early close a moment into the countdown, and clicking
    // it fades in the forfeit-the-reward confirmation.
    setTimeout(() => {
      const close = document.querySelector("#close-button");
      close.classList.remove("disabled");
      close.style.display = "block";
    }, 700);
    document.querySelector("#close-button").addEventListener("click", () => {
      const wrapper = document.querySelector("#dialog-wrapper");
      wrapper.style.opacity = "1";
      wrapper.style.pointerEvents = "auto";
    });
  </script>`;

test("no-reward mode ignores the #dismiss-button wrapper and takes the real early close", async () => {
  const { browser, page } = await openAdFrame(false, GOOGLE_REWARDED_MARKUP);
  try {
    await page.waitForFunction(() => document.querySelector("#close-button").dataset.clicked === "yes", null, { timeout: 4000 });
    await page.waitForFunction(() => document.querySelector("#close-ad-button").dataset.clicked === "yes", null, { timeout: 4000 });
    assert.equal(await page.locator("#dismiss-button").getAttribute("data-clicked"), null, "the wrapper is not a close control");
    assert.equal(await page.locator("#resume-ad-button").getAttribute("data-clicked"), null, "must not press 繼續");
    assert.equal(
      await page.locator("#count-down-container").getAttribute("data-clicked"), null,
      "the countdown container is not a close control either"
    );
  } finally {
    await browser.close();
  }
});

test("wait-for-reward mode leaves the enabled early close alone", async () => {
  const { browser, page } = await openAdFrame(true, GOOGLE_REWARDED_MARKUP);
  try {
    await page.waitForTimeout(2500);
    assert.equal(await page.locator("#close-button").getAttribute("data-clicked"), null, "closing early forfeits the reward");
    assert.equal(await page.locator("#close-ad-button").getAttribute("data-clicked"), null);
  } finally {
    await browser.close();
  }
});

async function openAdFrame(waitForRewardAd, body) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const [domElementScript, settingsScript, adframeScript] = await Promise.all([
    readFile(new URL("../dist/dom-element.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/settings-storage.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/adframe.js", import.meta.url), "utf8"),
  ]);
  await page.setContent(`${body}
    <script>
      for (const el of document.querySelectorAll("[id]")) {
        el.addEventListener("click", (event) => {
          if (event.target === event.currentTarget) event.currentTarget.dataset.clicked = "yes";
        });
      }
    </script>`);
  await page.evaluate((wait) => {
    globalThis.chrome = {
      storage: {
        sync: { get(defaults, ready) { ready({ ...defaults, waitForRewardAd: wait }); }, set() {} },
        onChanged: { addListener() {} },
      },
    };
  }, waitForRewardAd);
  await page.evaluate(`${domElementScript}\n${settingsScript}\n${adframeScript}`);
  return { browser, page };
}

async function openRewardAd(waitForRewardAd, options = {}) {
  const {
    includeCountdown = true,
    closeId = "dismiss-button-element",
    includeHiddenDismissElement = false,
    useGoogleCountdownClose = false,
  } = options;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const [domElementScript, settingsScript, adframeScript] = await Promise.all([
    readFile(new URL("../dist/dom-element.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/settings-storage.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/adframe.js", import.meta.url), "utf8"),
  ]);

  await page.setContent(`
    ${includeCountdown ? useGoogleCountdownClose
      ? `<div id="count-down-container" class="close-button expanded" style="${visible}">
          <div id="count-down-text" class="continue-prompt-text">秒後即可獲得獎勵</div>
          <div id="close-button" style="${visible}"><div class="continue-prompt-text">關閉</div></div>
        </div>`
      : `<div id="count-down-container" style="${visible}">10 秒後</div>` : ""}
    ${useGoogleCountdownClose ? "" : `<button id="${closeId}" style="${visible}">close</button>`}
    ${includeHiddenDismissElement ? '<button id="dismiss-button-element" style="display:none;width:0;height:0">close</button>' : ""}
    <div id="dialog-wrapper" style="opacity:0;pointer-events:none;width:120px;height:60px">
      <button id="close-ad-button" style="${visible}">關閉廣告</button>
    </div>
    <script>
      document.querySelector('#${useGoogleCountdownClose ? "close-button" : closeId}').addEventListener('click', event => {
        event.currentTarget.dataset.clicked = 'yes';
        event.currentTarget.dataset.clickedDuringCountdown =
          document.querySelector('#count-down-container')?.style.display !== 'none' ? 'yes' : 'no';
        document.querySelector('#dialog-wrapper').style.opacity = '1';
        document.querySelector('#dialog-wrapper').style.pointerEvents = 'auto';
      });
      document.querySelector('#close-ad-button').addEventListener('click', event => event.currentTarget.dataset.clicked = 'yes');
    </script>
  `);
  await page.evaluate((wait) => {
    globalThis.chrome = {
      storage: {
        sync: { get(defaults, ready) { ready({ ...defaults, waitForRewardAd: wait }); }, set() {} },
        onChanged: { addListener() {} },
      },
    };
  }, waitForRewardAd);
  await page.evaluate(`${domElementScript}\n${settingsScript}\n${adframeScript}`);
  return { browser, page };
}

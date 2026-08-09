import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";

test("user-initiated Gamer login dialog remains open", async () => {
  const fixture = await openEngineFixture();
  try {
    await fixture.page.locator(".user-info").click();
    await fixture.page.waitForTimeout(500);
    assert.equal(await fixture.page.locator("#login-dialog").getAttribute("data-closed"), null);
    assert.equal(await fixture.page.locator("#login-dialog").isVisible(), true);
  } finally {
    await fixture.browser.close();
  }
});

test("unsolicited login reminder is still dismissed", async () => {
  const fixture = await openEngineFixture();
  try {
    await fixture.page.evaluate(() => {
      document.querySelector("#nag-dialog").style.display = "block";
    });
    await fixture.page.waitForFunction(() => document.querySelector("#nag-dialog").dataset.closed === "yes");
  } finally {
    await fixture.browser.close();
  }
});

async function openEngineFixture() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  // The same modules the manifest gives the engine, in the same order.
  const scripts = await Promise.all(
    ["dom-element.js", "media-keepalive.js", "ad-skip-engine.js"].map((name) =>
      readFile(new URL(`../dist/${name}`, import.meta.url), "utf8"),
    ),
  );

  await page.setContent(`
    <div id="ani_video" style="width:640px;height:360px"></div>
    <a class="user-info" href="https://user.gamer.com.tw/login.php">點擊登入</a>
    <div id="login-dialog" class="dialogify" style="display:none;width:400px;height:300px">
      <button class="dialogify__close" style="width:20px;height:20px">close</button>
      <iframe src="https://user.gamer.com.tw/login.php" style="width:300px;height:200px"></iframe>
      <span>會員登入</span>
    </div>
    <div id="nag-dialog" class="dialogify" style="display:none;width:300px;height:120px">
      <button class="dialogify__close" style="width:20px;height:20px">close</button>
      <span>請登入會員以獲得更多功能</span>
    </div>
    <script>
      document.querySelector('.user-info').addEventListener('click', event => {
        event.preventDefault();
        document.querySelector('#login-dialog').style.display = 'block';
      });
      for (const button of document.querySelectorAll('.dialogify__close')) {
        button.addEventListener('click', event => {
          const dialog = event.currentTarget.closest('.dialogify');
          dialog.dataset.closed = 'yes';
          dialog.style.display = 'none';
        });
      }
    </script>
  `);
  await page.evaluate(`${scripts.join("\n")}\nnew AniAdSkip.AdSkipEngine().start();`);
  return { browser, page };
}

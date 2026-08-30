/* Loads the real unpacked extension and lets the real adapters drive real
 * pages. The policies are covered in isolation elsewhere; what is under test
 * here is the wiring — manifest script lists, cross-world load order, and the
 * settings round-trip through chrome.storage. Chrome injects a given file into
 * a frame once even across worlds, so a shared script path silently strands a
 * world without its shared modules; only a loaded extension catches that. */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import type { BrowserContext } from "playwright";

const extensionPath = new URL("../dist/", import.meta.url).pathname;

test("the shipped ad-frame scripts close a rewarded ad end to end", async () => {
  const profilePath = await mkdtemp(join(tmpdir(), "ani-ad-skip-frame-"));
  let context: BrowserContext | undefined;

  try {
    context = await chromium.launchPersistentContext(profilePath, {
      // Chromium only loads unpacked extensions in headed mode.
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });

    await context.route("https://pagead2.googlesyndication.com/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html>
          <div id="dismiss-button" class="close-button-outer" style="display:block;width:200px;height:40px">
            <div id="dismiss-button-element" class="close-button" style="display:block;width:40px;height:20px">關閉</div>
          </div>
          <script>
            for (const el of document.querySelectorAll("[id]")) {
              el.addEventListener("click", (event) => {
                if (event.target === event.currentTarget) event.currentTarget.dataset.clicked = "yes";
              });
            }
          </script>`,
      }),
    );

    const page = await context.newPage();
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") failures.push(message.text());
    });

    await page.goto("https://pagead2.googlesyndication.com/pagead/ads?frame=1");

    // No countdown is present, so the reward is already earned and the shipped
    // default (wait for reward) is free to take the post-countdown close.
    await page.waitForFunction(
      () => document.querySelector<HTMLElement>("#dismiss-button-element")!.dataset["clicked"] === "yes",
      null,
      { timeout: 10_000 },
    );
    assert.equal(
      await page.locator("#dismiss-button").getAttribute("data-clicked"),
      null,
      "the wrapper must not be pressed",
    );
    assert.deepEqual(failures, [], "the shipped scripts must load without errors");
  } finally {
    await context?.close();
    await rm(profilePath, { recursive: true, force: true });
  }
});

test("the shipped page scripts accept the age gate end to end", async () => {
  const profilePath = await mkdtemp(join(tmpdir(), "ani-ad-skip-page-"));
  let context: BrowserContext | undefined;

  try {
    context = await chromium.launchPersistentContext(profilePath, {
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });

    await context.route("https://ani.gamer.com.tw/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html>
          <div id="ani_video" style="width:640px;height:360px"></div>
          <button class="choose-btn-agree" style="display:block;width:80px;height:30px">我同意</button>
          <script>
            document.querySelector(".choose-btn-agree")
              .addEventListener("click", (event) => { event.currentTarget.dataset.clicked = "yes"; });
          </script>`,
      }),
    );

    const page = await context.newPage();
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(String(error)));

    await page.goto("https://ani.gamer.com.tw/animeVideo.php?sn=test");
    await page.waitForFunction(
      () => document.querySelector<HTMLElement>(".choose-btn-agree")!.dataset["clicked"] === "yes",
      null,
      { timeout: 10_000 },
    );
    assert.deepEqual(failures, [], "the shipped scripts must load without errors");
  } finally {
    await context?.close();
    await rm(profilePath, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import type { BrowserContext } from "playwright";

const extensionPath = new URL("../dist/", import.meta.url).pathname;

test("visibility guard is injected into an origin-inherited child frame", async () => {
  const profilePath = await mkdtemp(join(tmpdir(), "ani-ad-skip-test-"));
  let context: BrowserContext | undefined;

  try {
    context = await chromium.launchPersistentContext(profilePath, {
      // Chromium only loads unpacked extensions in headed mode.
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    await context.route("https://ani.gamer.com.tw/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><iframe id="creative" srcdoc="<p>creative</p>"></iframe>',
      }),
    );

    const page = await context.newPage();
    await page.goto("https://ani.gamer.com.tw/animeVideo.php?sn=test");
    await page.waitForFunction(() => {
      const iframe = document.querySelector("#creative");
      const childDocument = iframe instanceof HTMLIFrameElement ? iframe.contentDocument : null;
      return childDocument !== null && Object.hasOwn(childDocument, "visibilityState");
    });

    const childGuard = await page.evaluate(() => {
      const iframe = document.querySelector("#creative");
      if (!(iframe instanceof HTMLIFrameElement) || !iframe.contentDocument) throw new Error("creative frame missing");
      const childDocument = iframe.contentDocument;
      return {
        hidden: childDocument.hidden,
        visibilityState: childDocument.visibilityState,
        hasOwnVisibilityState: Object.hasOwn(childDocument, "visibilityState"),
      };
    });

    assert.deepEqual(childGuard, {
      hidden: false,
      visibilityState: "visible",
      hasOwnVisibilityState: true,
    });
  } finally {
    await context?.close();
    await rm(profilePath, { recursive: true, force: true });
  }
});

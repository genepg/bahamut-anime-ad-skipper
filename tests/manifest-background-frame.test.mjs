import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("main-world background guard reaches origin-inherited ad frames", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  const guard = manifest.content_scripts.find((script) => script.js?.includes("inject.js"));

  assert.ok(guard, "the main-world background guard must be registered");
  assert.equal(guard.all_frames, true);
  assert.equal(guard.match_about_blank, true);
  assert.equal(guard.match_origin_as_fallback, true);

  const adFrameRunner = manifest.content_scripts.find((script) => script.js?.includes("adframe.js"));
  assert.ok(adFrameRunner, "the ad-frame runner must be registered");
  assert.equal(adFrameRunner.all_frames, true);
  assert.equal(adFrameRunner.match_about_blank, true);
  assert.equal(adFrameRunner.match_origin_as_fallback, true);
});

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

test("both sides of the main-world seam load the same channel module", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));

  // The channel is the only place the transport keys are spelled out, so a
  // world that skips it would fall back to defaults and never hear the popup.
  for (const script of manifest.content_scripts) {
    const channel = script.js.filter((file) => file.startsWith("main-world-channel"));
    assert.equal(channel.length, 1, `${script.js.join(", ")} crosses the seam without the channel`);
    assert.equal(script.js.indexOf(channel[0]) < script.js.length - 1, true, "the channel must load before its callers");
  }

  const mainWorld = manifest.content_scripts.find((script) => script.world === "MAIN");
  assert.ok(mainWorld, "the main-world guard must be registered");
  assert.deepEqual(mainWorld.js, ["main-world-channel.main.js", "inject.js"]);

  // Chrome injects a given file into a given frame once, even across worlds:
  // sharing one path here silently leaves the isolated world without a channel.
  const isolated = manifest.content_scripts.filter((script) => script.world !== "MAIN");
  for (const script of isolated) {
    assert.equal(
      script.js.includes("main-world-channel.main.js"),
      false,
      "the isolated worlds must not reuse the MAIN world's copy of the channel",
    );
  }
});

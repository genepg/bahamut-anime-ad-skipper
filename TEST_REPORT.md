# Bahamut Ani Ad Skip — Test Report

- Target: `https://ani.gamer.com.tw/animeVideo.php?sn=49359`
- Method: the real extension loaded into Chromium (`--load-extension`), headed,
  a fresh **logged-out** profile per run.
- Caveat: a fresh/logged-out profile on a datacenter IP gets the site's **most
  aggressive** ad treatment, and ad behaviour **varies run-to-run** (the same
  build produced anywhere from 0/3 to 4/4 across sessions). Treat the numbers as
  a worst-case range, not a fixed rate.

## Final design (what the extension does)

1. `content.js` — auto-accepts the 18+ prompt, **mutes** the ad, auto-clicks the
   in-player skip button (`#adSkipButton`/`.nativeAD-skip-button`) once it has the
   `enable` class, and auto-dismisses the login popup.
2. `adframe.js` (injected into the cross-origin Google ad iframes) — for the
   **goog_rewarded popup** it finds the close button **`#dismiss-button-element`**
   and clicks it once it appears (i.e. after the reward countdown), then confirms
   the "關閉廣告？" dialog (`#close-ad-button`). Gated so it only closes **after**
   the countdown ("N 秒" gone) — closing early was flagged in this run.
3. `inject.js` — suppresses the anti-adblock `alert()` and spoofs Page Visibility
   and focus events so ad playback can continue when the tab is not foregrounded.

No network blocking and no `playbackRate` changes — both were tested and **trip
the site's anti-adblock**. Early rewarded close is off by default for the same
reason, but is now available behind the **Wait for reward** toggle (see the
2026-08-05 section at the end).

## Results (worst-case logged-out env)

| Metric | Result |
|--------|--------|
| Got past the ad to the anime | ~**2/3** of loads, at **~30s** (the rewarded reward-countdown, then auto-dismissed) |
| Hard anti-adblock block | **0** in the latest runs |
| Stuck on ad (variance) | ~1/3 |
| Age-agree (18+) | ✅ every run |
| In-player skip (`#adSkipButton.enable`) | ✅ clicked when skippable |
| Login popup auto-dismiss | ✅ confirmed firing on real popups (debug runs) |
| Non-login dialog safety | ✅ never wrongly closed |

## Honest conclusion

- The rewarded ad's **~30s reward countdown cannot be shortened** while the
  reward is being earned — every attempt to speed/skip it gets caught. In the
  default mode the extension makes it **muted and hands-free**: it plays out,
  then the close button is clicked for you. Forfeiting the reward outright is
  the opt-in path added on 2026-08-05.
- Reliability in this hostile test environment is variable (~2/3, occasional
  stuck/None). A **logged-in account on a normal residential IP** generally gets
  lighter, faster ads and should fare better — please test there.
- `Enabled` is the kill switch. The top-level page displays a small diagnostic
  badge when an ad frame reports activity.

## 2026-08-05 — Background-tab frame-injection regression

### Scope

This check covers the extension configuration and browser execution required
for the ad to keep its background-tab guard inside nested creative frames.
Google creatives can use origin-inherited `about:blank`, `blob:`, or `data:`
frames; without the two manifest flags below, Chrome does not inject the guard
or the ad-frame runner into those documents.

### Automated result

Commands run:

```sh
npm test
npm run typecheck
```

Result: **PASS** (2026-08-05).

- `tests/manifest-background-frame.test.mjs` confirms the main-world
  visibility guard (`inject.js`) uses `all_frames`, `match_about_blank`, and
  `match_origin_as_fallback`.
- The same test confirms the rewarded-ad runner (`adframe.js`) uses those
  options too.
- `tests/background-frame-injection.browser.test.mjs` starts headed Chromium
  with the built unpacked extension, loads a mocked Ani-Gamer page containing
  an `about:blank` creative frame, and confirms that frame receives
  `document.hidden === false` and `document.visibilityState === "visible"`.
- TypeScript type checking completed without errors.

### Live verification still needed

The automated browser test validates the exact Chrome injection contract, but
it does not emulate a real Ani-Gamer ad creative or Chrome's tab scheduler. To
verify the user-visible result after reloading the unpacked extension:

1. Start an episode and wait for an ad to begin.
2. Open a different browser tab for at least 10 seconds.
3. Return and confirm the ad countdown/playback progressed rather than paused,
   then confirm it closes or skips normally.

## 2026-08-05 — Rewarded-ad early close ("Wait for reward" off)

### Symptom

With **等待獎勵廣告 / Wait for reward** turned off, the rewarded ad still ran its
full ~30s countdown before closing.

### Root cause (captured live from the real creative)

The rewarded creative served on `*.safeframe.googlesyndication.com` is:

```html
<div id="dismiss-button" class="close-button-outer">          <!-- WRAPPER, not a button -->
  <div id="count-down-container" class="close-button">
    <div id="count-down-text">N 秒後即可獲得獎勵</div>
    <div id="close-button" class="disabled">關閉</div>          <!-- early close -->
  </div>
  <div id="dismiss-button-element" class="close-button">關閉</div>  <!-- post-countdown close -->
</div>
<div id="dialog-wrapper">                                      <!-- opacity:0 until .visible -->
  <div id="close-ad-button" role="button">關閉</div>            <!-- forfeit the reward -->
  <div id="resume-ad-button" role="button">繼續</div>           <!-- keep watching -->
</div>
```

Three defects, all fixed:

1. `#dismiss-button` was in the click list, but it is the always-visible
   *container*. Clicking it does nothing while the click loop counts it as a
   success and returns — so the real controls were never reached.
2. The `resume` click ran on every tick regardless of mode, and the give-up text
   matcher included `continue`; both press the confirmation dialog's
   keep-watching control and send the ad back into its countdown.
3. `DOMElement.isVisible` walked ancestors and rejected any element under a
   `pointer-events: none` wrapper — including controls that re-enable pointer
   events on themselves. Replaced with `Element.checkVisibility()`.

### Verification

- `npm test` — 13/13 pass, including regression tests built from the captured
  markup ("the wrapper is not a close control", "must not press 繼續",
  "clicks an early close nested in a pointer-events:none wrapper").
- `npm run typecheck` — clean.
- **Live, logged in, real Chrome** (`animeVideo.php?sn=50123`), extension's own
  ad-frame reporting:

  ```
  1.3s found #close-button
  1.3s clicked dismiss-without-reward     <- early close
  1.8s clicked confirm-without-reward     <- 關閉廣告？您將無法獲得獎勵 confirmed
  ```

  Rewarded ad dismissed 1.8s after it opened instead of ~30s.

### Not covered

A single live rewarded ad was observed end-to-end in this mode. Long-run
anti-adblock behaviour of forfeiting rewards repeatedly is unmeasured — the
default remains **Wait for reward: on**.

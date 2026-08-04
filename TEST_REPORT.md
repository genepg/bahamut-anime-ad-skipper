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
   the countdown ("N 秒" gone) — closing early trips anti-adblock.
3. `inject.js` — suppresses the anti-adblock `alert()` and spoofs Page Visibility
   and focus events so ad playback can continue when the tab is not foregrounded.

No network blocking, no `playbackRate` changes, and no early rewarded-ad close —
each of those was tested and **trips the site's anti-adblock**.

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

- The rewarded ad's **~30s reward countdown cannot be shortened** — every attempt
  to speed/skip/early-close it gets caught. The extension makes it **muted and
  hands-free**: it plays out, then the close button is clicked for you.
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

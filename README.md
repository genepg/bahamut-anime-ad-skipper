# 巴哈動畫瘋 跳廣告 — Bahamut Ani Ad Skip

A Chrome (Manifest V3) extension that automates available ad controls on
**巴哈姆特動畫瘋** (`ani.gamer.com.tw`).

## Why this is hard (and why normal ad blockers fail)

This site is actively anti-adblock. The ad plays through the **same video.js
player** as the anime, and if an ad fails to load/play the player shows
**"廣告播放錯誤，請重新整理…請檢查是否為瀏覽器擴充套件影響"** and removes the player.
So the usual ad-blocker move — blocking the ad's network request — gets caught
immediately (verified: blocking `securepubads/gampad`, `safeframe`, `2mdn`, etc.
makes the player error out within ~10s).

There are **two different ads**, confirmed live:

1. **Google "rewarded" popup** — the main one. A Google Publisher Tag (GPT)
   rewarded slot whose flow is `rewardedSlotReady → (~30s reward countdown) →
   rewardedSlotGranted → rewardedSlotClosed`. The player resumes the anime on
   *granted/closed*. Its bottom-right close countdown is a wall-clock timer, so
   `playbackRate` can't speed it up.
2. **In-video / in-stream ad** — a short site pre-roll and/or a Google IMA video
   ad that plays inside the player.

## How it handles ads

Instead of blocking or tampering, it lets each ad run and **clicks the
exact buttons a real viewer would**, the moment they're available — so the player
always sees a legitimately-completed ad. This mirrors the current (2025) working
userscript "Auto play ads on ani.gamer.com.tw".

- **`content.ts`** (main page) auto-accepts the 18+ prompt (`.choose-btn-agree`),
  auto-clicks the in-player skip button (`#adSkipButton` /
  `.nativeAD-skip-button`) **once it carries the `enable` class** (its real skippable state — never during the `廣告 N 秒` countdown or the
  `如何消除廣告？` upsell), and **auto-dismisses unsolicited login reminders**
  while leaving the user-initiated Gamer login iframe open.
- **`adframe.ts`** is injected *into* the Google ad iframes (cross-origin
  `safeframe.googlesyndication.com` / `imasdk.googleapis.com`). For the **rewarded
  popup** it clicks the skip / resume buttons, and — crucially — clicks
  `#dismiss-button-element`, the close that appears **after** the reward countdown
  finishes (reward earned → safe). The ad runs its ~30s countdown, then it's
  auto-closed for you. No manual clicking.

  With **Wait for reward** switched off it takes the early close (`#close-button`)
  as soon as Google enables it and answers the resulting
  `關閉廣告？您將無法獲得獎勵` dialog with `#close-ad-button`, closing the ad in
  about a second at the cost of the reward. The rewarded creative's exact control
  layout is documented at the top of `src/adframe.ts` — worth reading before
  touching those selectors, since the surrounding `#dismiss-button` element is a
  container rather than a button.
- **`inject.ts`** (page main world) suppresses the anti-adblock nag
  `alert("由於擋廣告插件會影響播放器運作…")` and **spoofs Page Visibility & focus events** (`document.hidden`, `visibilityState`, `visibilitychange`) scoped strictly to `ani.gamer.com.tw`, allowing ads to continue playing uninterrupted when switching tabs.

### What does NOT work (tested, and gets caught)

All of these were built and tested against the live player, and **all trip the
anti-adblock** — the site shows "廣告播放錯誤" and removes the player:

- **Blocking** the Google ad network requests (`gampad`, `safeframe`, `2mdn`…).
- **Fast-forwarding the ad video** (`playbackRate`) — even the site's *own*
  pre-roll. **4/4 instant blocks** in testing (~4–5s in). This is why there is no
  speed-up option, and why the countdowns cannot be accelerated. (The rewarded
  countdown also runs in a separate-process cross-origin iframe whose clock the
  page can't reach anyway.)
- **Clicking the rewarded close *early*** — flagged during the original testing,
  which is why waiting for the reward remains the default. It is available as the
  opt-in **Wait for reward → off** toggle; treat it as the riskier mode and
  switch back to waiting if the site starts complaining.
- **Faking the rewarded completion events** (`rewardedSlotGranted/Closed`) — it
  desyncs against the still-running real ad and *increased* hard blocks in testing.
  Removed in favour of the let-it-run-then-dismiss approach above.

### Measured behaviour

Tested in a **fresh, logged-out profile on a datacenter IP** (the most aggressive
ad treatment the site serves): **4/4 loads reached the anime, 0 blocks**, each
after the rewarded ad's ~30s reward countdown (which is then auto-dismissed). The
ad **cannot be made shorter** (any speed/skip tampering gets caught), but it is
closed for you automatically. A logged-in account on a normal IP generally sees
lighter/faster ads.

If it ever misbehaves, the **Enabled** toggle is a kill switch. The extension's
diagnostic badge reports activity from ad frames on the top-level page.

## Build

The extension is written in TypeScript (`src/`) and compiled to `dist/`, which is
the folder you load into Chrome.

```sh
npm install
npm run build       # type-checks, compiles src/ → dist/, copies manifest/popup/icons
```

Other scripts: `npm run typecheck` (type-check only, no emit) and
`npm run watch` (recompile on save; re-run `npm run build` if you change
`manifest.json` / `popup.html` / icons).

## Install (load unpacked)

1. Run `npm run build` (see above).
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select the **`dist/`** folder.
5. Open an episode, e.g. `https://ani.gamer.com.tw/animeVideo.php?sn=49359`.

## Settings (toolbar popup)

- **啟用 / Enabled** — master on/off (also the kill switch if the site ever
  misbehaves).
- **等待獎勵廣告 / Wait for reward** — on by default. Turn it off to close a
  rewarded ad as soon as its early close control appears and automatically
  confirm that the reward should be forfeited.

Stored in `chrome.storage.sync`; changes apply live to open tabs.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest that loads shared classic-script modules before each content-script coordinator |
| `src/ad-skip-engine.ts` | page automation module: age gate, in-video ad handling, skip controls, and login-nag dismissal |
| `src/settings-storage.ts` | shared `chrome.storage.sync` settings module; mirrors the enabled flag to `localStorage` for the main world |
| `src/dom-element.ts` | shared visibility, text-matching, and safe-click module |
| `src/inject.ts` | main-world `PageInvisibilitySpoofer`: suppresses the anti-adblock alert and spoofs visibility/focus events |
| `src/content.ts` | isolated-world coordinator plus diagnostic badge |
| `src/adframe.ts` | Google ad-frame coordinator: skip / resume / post-countdown rewarded-ad dismissal |
| `popup.html` / `src/popup.ts` | toolbar on/off toggle |
| `tsconfig.json` | strict TypeScript config (`strict`, `noUncheckedIndexedAccess`, …) |
| `dist/` | build output — the loadable extension (gitignored) |
| `icons/` | extension icons |
| `make_icons.py` | regenerates the icons (`python3 make_icons.py`) |

## Maintenance

Selectors live in `src/ad-skip-engine.ts` and `src/adframe.ts`. If the site
reworks its ads, re-inspect the player in DevTools (the ad-playing classes are
`vjs-anigamer-ad-playing` / `vjs-anigamer-m3u8-ad-playing` on `#ani_video`).

Use this project only in accordance with the site's terms and applicable law.
Please consider 動畫瘋's 訂閱 (subscription) to support the creators.

## Privacy and security

The extension does not collect, transmit, or sell browsing data. Its only stored
setting is the Enabled toggle, held in `chrome.storage.sync`. It needs access to
Ani-Gamer and the listed Google ad-frame hosts solely to run its content scripts;
it makes no network requests of its own. Please review the source and permissions
before installing an unpacked extension, and report security concerns privately to
the repository owner rather than publishing exploit details in an issue.

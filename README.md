# 巴哈動畫瘋 跳廣告 — Bahamut Ani Ad Skip

[![Install from the Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-%E5%AE%89%E8%A3%9D%20%2F%20Install-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/%E5%B7%B4%E5%93%88%E5%8B%95%E7%95%AB%E7%98%8B-%E8%B7%B3%E5%BB%A3%E5%91%8A-bahamut-ani-ad/ceklkhdkhjbbcickkpmmglpegfcigcnc)
[![Privacy policy](https://img.shields.io/badge/Privacy-%E9%9A%B1%E7%A7%81%E6%AC%8A%E6%94%BF%E7%AD%96-6b7280)](PRIVACY.md)

A Chrome (Manifest V3) extension that automates available ad controls on
**巴哈姆特動畫瘋** (`ani.gamer.com.tw`).

> **一般使用者請直接從商店安裝，不需要下載原始碼：**
> **[Chrome 線上應用程式商店 — 巴哈動畫瘋 跳廣告](https://chromewebstore.google.com/detail/%E5%B7%B4%E5%93%88%E5%8B%95%E7%95%AB%E7%98%8B-%E8%B7%B3%E5%BB%A3%E5%91%8A-bahamut-ani-ad/ceklkhdkhjbbcickkpmmglpegfcigcnc)**
>
> **Just want to use it?** Install it from the
> **[Chrome Web Store](https://chromewebstore.google.com/detail/%E5%B7%B4%E5%93%88%E5%8B%95%E7%95%AB%E7%98%8B-%E8%B7%B3%E5%BB%A3%E5%91%8A-bahamut-ani-ad/ceklkhdkhjbbcickkpmmglpegfcigcnc)** — no build step, and it auto-updates.

## 安裝 / Install (Chrome Web Store)

1. Open the listing: <https://chromewebstore.google.com/detail/%E5%B7%B4%E5%93%88%E5%8B%95%E7%95%AB%E7%98%8B-%E8%B7%B3%E5%BB%A3%E5%91%8A-bahamut-ani-ad/ceklkhdkhjbbcickkpmmglpegfcigcnc>
2. Click **加到 Chrome / Add to Chrome**, then confirm with **新增擴充功能 /
   Add extension**.
3. Open any episode, e.g. `https://ani.gamer.com.tw/animeVideo.php?sn=49359`.

That is the whole setup — there is nothing to configure. The extension accepts
the 18+ prompt, presses the player's skip control the moment the player enables
it, and closes the rewarded ad once its countdown has finished. See
[Settings](#settings-toolbar-popup) for the two toggles in the toolbar popup, and
[Privacy and security](#privacy-and-security) for what it does (and does not) do
with your data — the full policy is in [PRIVACY.md](PRIVACY.md).

Works in Chrome and in Chromium browsers that install from the Chrome Web Store
(Edge, Brave, Vivaldi, Opera). Firefox and Safari are not supported. Problems or
ideas go in [GitHub Issues](https://github.com/genepg/bahamut-anime-ad-skipper/issues).

Developers who want to run it from source: see
[Install from source](#install-from-source-load-unpacked).

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
- **`ad-frame-closer.ts`** is injected *into* the Google ad iframes (cross-origin
  `safeframe.googlesyndication.com` / `imasdk.googleapis.com`). For the **rewarded
  popup** it clicks the skip / resume buttons, and — crucially — clicks
  `#dismiss-button-element`, the close that appears **after** the reward countdown
  finishes (reward earned → safe). The ad runs its ~30s countdown, then it's
  auto-closed for you. No manual clicking.

  With **Wait for reward** switched off it takes the early close (`#close-button`)
  as soon as Google enables it and answers the resulting
  `關閉廣告？您將無法獲得獎勵` dialog with `#close-ad-button`, closing the ad in
  about a second at the cost of the reward. The rewarded creative's exact control
  layout is documented at the top of `src/ad-frame-closer.ts`, above the ordered
  `CLOSE_STRATEGIES` table that encodes the whole policy — worth reading before
  touching those selectors, since the surrounding `#dismiss-button` element is a
  container rather than a button (see `WRAPPER_IDS`).
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

## Release (automated)

The published item is
[巴哈動畫瘋 跳廣告 (Bahamut Ani Ad Skip)](https://chromewebstore.google.com/detail/%E5%B7%B4%E5%93%88%E5%8B%95%E7%95%AB%E7%98%8B-%E8%B7%B3%E5%BB%A3%E5%91%8A-bahamut-ani-ad/ceklkhdkhjbbcickkpmmglpegfcigcnc) — item id
`ceklkhdkhjbbcickkpmmglpegfcigcnc`, which is the `CWS_EXTENSION_ID` secret below.

Two GitHub Actions workflows live in `.github/workflows/`:

- **CI** (`ci.yml`) — type-checks and runs the browser suite on every push to
  `main` and every pull request. The extension tests must run headed
  (Chromium refuses `--load-extension` otherwise), so the run is wrapped in
  `xvfb-run`.
- **Publish** (`publish.yml`) — builds `dist/`, packs it, and ships it to the
  Chrome Web Store. It reruns CI first and refuses to publish if that fails.

To cut a release, bump the version in **both** `manifest.json` and
`package.json`, commit, then tag:

```bash
git tag v1.0.1 && git push origin main --tags
```

The tag is only the release record — the store publishes the version inside the
manifest, so the job fails fast if the two disagree. Running **Publish** by hand
from the Actions tab lets you pick `trustedTesters` instead of `default`; a tag
push always goes to everyone. Either way Google queues the item for review
(`ITEM_PENDING_REVIEW` in the log is success, not failure), which can take days.

### One-time store credentials

Create these four repository secrets (Settings → Secrets and variables →
Actions). The workflow also expects an environment named `chrome-web-store`,
which is where you can add a required reviewer before anything ships.

| Secret | Where it comes from |
|--------|---------------------|
| `CWS_EXTENSION_ID` | the item id in your store dashboard URL |
| `CWS_CLIENT_ID` | OAuth client (type **Desktop app**) in a Google Cloud project with the **Chrome Web Store API** enabled |
| `CWS_CLIENT_SECRET` | same OAuth client |
| `CWS_REFRESH_TOKEN` | minted once against that client (below) |

Two settings on that Cloud project decide whether the token keeps working:

- Set the OAuth consent screen's **publishing status to "In production"**. While
  it is in *Testing*, Google expires every refresh token after **7 days**, which
  breaks the pipeline a week after you set it up.
- The Google account you approve with must have publish rights on the item.

Download the OAuth client's JSON from the Cloud Console, then mint the token
with the helper script — it runs the loopback flow locally and prints the
result. (Google blocked the older `oob` copy-the-code redirect in October 2022;
a **Desktop app** client accepts `http://localhost` on any port without
registering it.)

```bash
node scripts/mint-refresh-token.mjs
```

It finds `client_secret*.json` in the current directory (or takes a path as an
argument), opens the consent page, catches the redirect on `127.0.0.1:8080`, and
prints `CWS_REFRESH_TOKEN`. Run it in a terminal you control and clear the
scrollback afterwards: that token can publish to every existing user of the
extension. Revoke it under the Google account's
[third-party access](https://myaccount.google.com/permissions) if it leaks.

`client_secret*.json`, `.env`, and `.env.*` are gitignored for the same reason.
The downloaded client JSON is only needed while minting; delete it once the four
secrets are in GitHub.

If Google returns no `refresh_token`, the account already has a live grant for
that client — revoke it at the link above and run the script again.

## Install from source (load unpacked)

Only needed for development — everyday users should install the published build
from the [Chrome Web Store](https://chromewebstore.google.com/detail/%E5%B7%B4%E5%93%88%E5%8B%95%E7%95%AB%E7%98%8B-%E8%B7%B3%E5%BB%A3%E5%91%8A-bahamut-ani-ad/ceklkhdkhjbbcickkpmmglpegfcigcnc). A source install does not auto-update,
and Chrome will nag about developer-mode extensions on every launch.

1. Run `npm run build` (see above).
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select the **`dist/`** folder.
5. Open an episode, e.g. `https://ani.gamer.com.tw/animeVideo.php?sn=49359`.

Load it from `dist/` while the store build is also installed and both will run on
the page; disable one of them.

## Settings (toolbar popup)

Click the extension's icon in the Chrome toolbar — if you don't see it, open the
puzzle-piece menu and pin **巴哈動畫瘋 跳廣告**.

- **啟用 / Enabled** — master on/off (also the kill switch if the site ever
  misbehaves).
- **等待獎勵廣告 / Wait for reward** — on by default. Turn it off to close a
  rewarded ad as soon as its early close control appears and automatically
  confirm that the reward should be forfeited. Faster, but you lose the reward,
  and it is the mode the site is more likely to object to — switch back to
  waiting if the player starts showing 廣告播放錯誤.

Stored in `chrome.storage.sync`; changes apply live to open tabs, so you don't
need to reload the episode after flipping a toggle.

### If something looks wrong

- The player shows **廣告播放錯誤** — turn **等待獎勵廣告 / Wait for reward**
  back on, then reload the episode.
- Ads are not being skipped at all — check that **啟用 / Enabled** is on, reload
  the page, and confirm the extension is enabled at `chrome://extensions`.
- Still broken? The site's ad markup may have changed: please
  [open an issue](https://github.com/genepg/bahamut-anime-ad-skipper/issues) with
  the episode URL and what you saw.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest that loads shared classic-script modules before each content-script coordinator |
| `src/ad-skip-engine.ts` | page automation module: age gate, in-video ad handling, skip controls, and login-nag dismissal |
| `src/settings-storage.ts` | shared `chrome.storage.sync` settings module; republishes changes over the `MainWorldChannel` when given one |
| `src/main-world-channel.ts` | the isolated ↔ main world seam: localStorage snapshot for `document_start`, `CustomEvent` for live changes. Built twice — Chrome injects a file into a frame only once even across worlds, so the MAIN world loads the `.main.js` copy |
| `src/dom-element.ts` | shared visibility, text-matching, and safe-click module; reports *why* a click was refused |
| `src/media-keepalive.ts` | shared nudge for paused ad videos, used by the page engine and every ad frame |
| `src/inject.ts` | main-world `PageInvisibilitySpoofer`: suppresses the anti-adblock alert and spoofs visibility/focus events; every patch is reversible, so the toggle applies without a reload |
| `src/content.ts` | isolated-world coordinator plus diagnostic badge |
| `src/ad-frame-closer.ts` | the rewarded-ad closing policy: an ordered strategy table behind `tick(settings)` |
| `src/adframe.ts` | production adapter for the closer — timer, settings, status badge |
| `popup.html` / `src/popup.ts` | toolbar on/off toggle |
| `tsconfig.json` | strict TypeScript config (`strict`, `noUncheckedIndexedAccess`, …) |
| `dist/` | build output — the loadable extension (gitignored) |
| `icons/` | extension icons |
| `make_icons.py` | regenerates the icons (`python3 make_icons.py`) |

## Maintenance

Selectors live in `src/ad-skip-engine.ts` and in the `CLOSE_STRATEGIES` table in
`src/ad-frame-closer.ts` — add a strategy as a row rather than a branch. If the site
reworks its ads, re-inspect the player in DevTools (the ad-playing classes are
`vjs-anigamer-ad-playing` / `vjs-anigamer-m3u8-ad-playing` on `#ani_video`).

Use this project only in accordance with the site's terms and applicable law.
Please consider 動畫瘋's 訂閱 (subscription) to support the creators.

## Privacy and security

The extension does not collect, transmit, or sell browsing data. The only data it
stores is the two toggles in the popup, held in `chrome.storage.sync` and
mirrored into one `localStorage` key (`__aniAdSkip_settings`) so the main world
can read them at `document_start`. It needs access to
Ani-Gamer and the listed Google ad-frame hosts solely to run its content scripts;
it makes no network requests of its own. The full policy, in English and 繁體中文,
is in [PRIVACY.md](PRIVACY.md), which is also the privacy policy linked from the
store listing. Please review the source and permissions before installing an
unpacked extension, and report security concerns privately to the repository
owner rather than publishing exploit details in an issue.

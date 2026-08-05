# Domain Glossary & Architecture Context

This document defines the ubiquitous domain vocabulary and key architectural concepts for `bahamut-anime-ad-skipper`.

## Domain Vocabulary

- **Bahamut Ani-Gamer (`巴哈姆特動畫瘋`)**: The target anime streaming site (`ani.gamer.com.tw`).
- **Age Gate (`18+ Verification Prompt`)**: Modal prompt requiring adult confirmation before video playback begins.
- **In-Video Ad (`Native / VAST Ad`)**: Pre-roll or mid-roll video ad rendered inside Video.js player (`#ani_video`).
- **Rewarded Popup Ad (`Google Rewarded Ad`)**: Intermittent Google ad iframe overlay that requires completing a countdown before clicking close.
- **Login Nag Dialog (`Dialogify Modal`)**: Intermittent guest/member reminder popup on the site.
- **Anti-Adblock Alert**: Site alert (`window.alert`) warning user about ad blockers.
- **Tab Visibility Spoof**: Overriding Page Visibility API (`document.hidden`, `visibilityState`) and window focus events to prevent ad playback pauses when switching browser tabs.

- **Close Strategy**: One named way to close an ad — a control to look for, plus the mode it is allowed to run in. The ordered list of them is the closing policy.
- **Wrapper Control**: A container that looks like a close button and has no handler of its own (`#dismiss-button`, `#count-down-container`). Clicking one reports success and closes nothing.
- **Keep-Watching Control**: The "繼續" / "resume" control beside a forfeit confirmation. Pressing it returns the ad to its countdown; only the resume strategy may.

## Architectural Concepts & Seams

- **`DOMElement` Module**: Deep interface encapsulating element visibility rules, text matching, and safe click invocation across isolated and frame contexts. `click()` returns a **Click Outcome** (`clicked` / `invisible` / `disabled` / `navigation`) so a caller can tell "not ready yet" from "wrong kind of element".
- **`MediaKeepalive` Module**: Shared nudge for paused ad videos. One implementation, two worlds — the page engine and every ad frame.
- **`SettingsStorage` Module**: Deep interface over extension settings storage (`chrome.storage.sync`), republishing across the main-world seam when constructed with a `MainWorldChannel`.
- **`MainWorldChannel` Module**: The seam between the isolated and main worlds, and the single place its transport keys are spelled out. `publish()` / `subscribe()` hide two transports: a `localStorage` snapshot readable at `document_start`, and a `CustomEvent` carrying live changes.
- **`PageInvisibilitySpoofer` Module**: Deep interface wrapping DOM prototype descriptor patches, `window.alert` overrides, and event propagation interception behind `apply(enabled)`. Every patch records its undo, so the toggle takes effect on open tabs.
- **`AdSkipEngine` Module**: Deep engine interface controlling domain handlers (`AgeGateHandler`, `VideoAdHandler`, `LoginPopupHandler`) behind a simple `start()` / `stop()` seam.
- **`AdFrameCloser` Module**: The rewarded-ad closing policy, behind `tick(settings)` → `TickOutcome`. Owns the **Close Strategy** table, the wrapper and keep-watching guards, and the countdown reading. Owns no clock, settings source, or reporting channel — `adframe.ts` is the production adapter that supplies those, and the tests are the second adapter.

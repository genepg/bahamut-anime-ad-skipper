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

## Architectural Concepts & Seams

- **`DOMElement` Module**: Deep interface encapsulating element visibility rules, text matching, and safe click invocation across isolated and frame contexts.
- **`SettingsStorage` Module**: Deep interface unifying extension settings storage (`chrome.storage.sync`) and main-world sync mirroring (`localStorage`).
- **`PageInvisibilitySpoofer` Module**: Deep interface wrapping DOM prototype descriptor patches, `window.alert` overrides, and event propagation interception.
- **`AdSkipEngine` Module**: Deep engine interface controlling domain handlers (`AgeGateHandler`, `VideoAdHandler`, `LoginPopupHandler`) behind a simple `start()` / `stop()` seam.

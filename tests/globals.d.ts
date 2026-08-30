/* Globals the fixtures park on the page under test.
 *
 * These exist only inside page.evaluate(), where the callback is checked
 * against the DOM lib and the AniAdSkip declarations in types/. Declaring them
 * here is what keeps those callbacks type-checked rather than `any`. */

/* The closer under test in reward-ad-preference, held across evaluate() calls
 * so a single instance accumulates the tick state the policy depends on. */
declare var __closer: AniAdSkip.AdFrameCloser;

/* The page's pristine window.alert, captured before inject.js overrides it, so
 * a test can assert the override is handed back when the extension goes off. */
declare var __alertBefore: typeof window.alert;

/* Writes the popup made through its chrome.storage stub, in call order. */
declare var savedSettings: Array<Partial<AniAdSkip.Settings>>;

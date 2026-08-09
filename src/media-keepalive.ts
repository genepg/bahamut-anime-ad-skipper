/* Shared keep-playing module for the page player and the ad frames.
 *
 * Ad creatives pause their <video> whenever the player thinks it lost the
 * viewport — a backgrounded tab, a reflow, an autoplay retry. Both the page
 * (AdSkipEngine) and every ad frame (AdFrameCloser) need the same nudge, so it
 * lives here rather than being written out twice.
 *
 * The nudge must never win an argument with the person watching. Nothing on a
 * paused element records who paused it, so this module watches for the only
 * evidence there is: a trusted user gesture just before the pause. pause()
 * queues its event instead of firing it inside the gesture's own dispatch, so
 * recency is the attribution — long enough for a player to route a click
 * through its own controls, short enough that an unrelated click a moment
 * earlier does not adopt a pause the creative made. A video attributed to the
 * viewer is left alone until it plays again. */
namespace AniAdSkip {
  const USER_PAUSE_WINDOW_MS = 1000;
  const GESTURE_EVENTS = ["pointerdown", "mousedown", "touchstart", "click", "keydown"] as const;

  export class MediaKeepalive {
    private static readonly watched = new WeakSet<Document>();
    private static readonly viewerPaused = new WeakSet<HTMLMediaElement>();
    private static lastGestureAt = Number.NEGATIVE_INFINITY;

    /* Returns how many paused videos were nudged, so a caller can report it.
     * play() is best-effort: a creative may reject it, and a frame may tear
     * down its media element mid-loop. Neither may stop the caller's tick. */
    static resumeAll(root: ParentNode = document): number {
      this.watch(this.documentOf(root));
      let resumed = 0;
      for (const video of root.querySelectorAll<HTMLMediaElement>("video")) {
        try {
          if (!video.paused || video.ended) continue;
          if (this.isViewerPaused(video)) continue;
          const played = video.play();
          if (played && typeof played.catch === "function") played.catch(() => undefined);
          resumed += 1;
        } catch { /* the creative blocked play(); nothing to do about it */ }
      }
      return resumed;
    }

    /* Whether the viewer paused this video and has not started it again. */
    static isViewerPaused(video: HTMLMediaElement): boolean {
      return this.viewerPaused.has(video);
    }

    /* Begin attributing pauses in a document. resumeAll() does this for the
     * root it is given, but a caller that only nudges *during* an ad has to
     * start watching earlier than its first nudge — otherwise a pause made
     * before the ad began looks unattributed once the ad arrives. */
    static watch(doc: Document = document): void {
      if (this.watched.has(doc)) return;
      this.watched.add(doc);
      try {
        for (const name of GESTURE_EVENTS) {
          doc.addEventListener(name, (event) => {
            // Only real input counts; DOMElement.click() must not adopt a pause.
            if (event.isTrusted) this.lastGestureAt = Date.now();
          }, { capture: true, passive: true });
        }
        /* Media events do not bubble, but the capture phase still walks down
         * to them — so one listener covers every <video> the page ever adds. */
        doc.addEventListener("pause", (event) => {
          const video = event.target;
          if (!(video instanceof HTMLMediaElement)) return;
          if (Date.now() - this.lastGestureAt <= USER_PAUSE_WINDOW_MS) this.viewerPaused.add(video);
        }, true);
        doc.addEventListener("play", (event) => {
          const video = event.target;
          if (video instanceof HTMLMediaElement) this.viewerPaused.delete(video);
        }, true);
      } catch { /* a locked-down frame; the nudge still works without this */ }
    }

    private static documentOf(root: ParentNode): Document {
      if (root instanceof Document) return root;
      return (root as Node).ownerDocument ?? document;
    }
  }
}

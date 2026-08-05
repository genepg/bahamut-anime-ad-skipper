/* Shared keep-playing module for the page player and the ad frames.
 *
 * Ad creatives pause their <video> whenever the player thinks it lost the
 * viewport — a backgrounded tab, a reflow, an autoplay retry. Both the page
 * (AdSkipEngine) and every ad frame (AdFrameCloser) need the same nudge, so it
 * lives here rather than being written out twice. */
namespace AniAdSkip {
  export class MediaKeepalive {
    /* Returns how many paused videos were nudged, so a caller can report it.
     * play() is best-effort: a creative may reject it, and a frame may tear
     * down its media element mid-loop. Neither may stop the caller's tick. */
    static resumeAll(root: ParentNode = document): number {
      let resumed = 0;
      for (const video of root.querySelectorAll<HTMLMediaElement>("video")) {
        try {
          if (!video.paused || video.ended) continue;
          const played = video.play();
          if (played && typeof played.catch === "function") played.catch(() => undefined);
          resumed += 1;
        } catch { /* the creative blocked play(); nothing to do about it */ }
      }
      return resumed;
    }
  }
}

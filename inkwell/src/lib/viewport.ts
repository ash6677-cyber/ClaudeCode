/**
 * How much screen there actually is, once the keyboard is up.
 *
 * `100dvh` sounds like it answers this and does not. The "dynamic" in `dvh`
 * refers to the browser's own collapsing toolbars, not to the virtual
 * keyboard: on iOS the keyboard never affects it, and on Android Chrome the
 * default `interactive-widget=resizes-visual` leaves the layout viewport at
 * full height too. So a dialog centred in `100dvh`, or an app shell sized to
 * it, keeps laying itself out against a screen half of which is now covered
 * by a keyboard — and everything in the bottom half becomes untouchable.
 *
 * That is not a cosmetic problem. It put the wizard's Back and Next buttons,
 * and the New project dialog's Cancel and Create, underneath the keyboard the
 * moment a writer tapped the title field: no way forward and no way out.
 *
 * `visualViewport` is the one API that does know. It reports the part of the
 * page a person can actually see, keyboard subtracted, along with how far
 * that region has been pushed down the layout viewport — which matters
 * because iOS anchors `position: fixed` to the layout viewport and then
 * scrolls the visual one out from under it.
 *
 * Two custom properties, so the answer is available to plain CSS:
 *
 *   --vvh    usable height
 *   --vvtop  how far down the screen that usable region begins
 *
 * Both fall back to `100dvh` / `0px` in the stylesheet, so a browser with no
 * `visualViewport` behaves exactly as it did before this existed.
 */

let stop: (() => void) | null = null

function write(root: HTMLElement, height: number, top: number): void {
  root.style.setProperty('--vvh', `${height}px`)
  root.style.setProperty('--vvtop', `${top}px`)
}

/**
 * Keeps `--vvh` and `--vvtop` matching the visible region.
 *
 * Returns a teardown, and is safe to call twice — the second call replaces
 * the first rather than stacking a second set of listeners.
 */
export function trackViewport(root: HTMLElement = document.documentElement): () => void {
  stop?.()

  const vv = typeof window !== 'undefined' ? window.visualViewport : null
  if (!vv) {
    stop = null
    return () => {}
  }

  const sync = () => {
    // `offsetTop` is how far the visible region sits down the layout
    // viewport. Ignoring it leaves a dialog correctly *sized* and still in
    // the wrong place on iOS, which is the more confusing of the two bugs.
    write(root, vv.height, vv.offsetTop)
  }

  sync()
  vv.addEventListener('resize', sync)
  vv.addEventListener('scroll', sync)

  stop = () => {
    vv.removeEventListener('resize', sync)
    vv.removeEventListener('scroll', sync)
    root.style.removeProperty('--vvh')
    root.style.removeProperty('--vvtop')
    stop = null
  }
  return stop
}

/**
 * Whether a keyboard (or anything else) is currently eating the screen.
 *
 * A threshold rather than any difference at all, because the visible region
 * is a pixel or two short of the layout viewport at all sorts of ordinary
 * moments — a rubber-band scroll, a collapsing toolbar mid-animation — and
 * none of those mean a keyboard.
 */
export function keyboardIsOpen(): boolean {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null
  if (!vv) return false
  return window.innerHeight - vv.height > 120
}

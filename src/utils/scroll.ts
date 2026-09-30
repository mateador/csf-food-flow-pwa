/**
 * The weigh forms show their result (Saved / queued offline / error) in a
 * banner above the form, but people are usually scrolled down near the
 * submit button when they trigger it -- without this, the banner is
 * invisible until they scroll up manually.
 */
export function scrollToTop(): void {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

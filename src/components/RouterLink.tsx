/**
 * Thin wrapper around preact-router's Link. preact-router's own LinkProps
 * type extends preact's generic HTMLAttributes<HTMLAnchorElement> instead
 * of AnchorHTMLAttributes<HTMLAnchorElement>, so `href` isn't recognized
 * by the type checker even though it works correctly at runtime. Fixing
 * the type once here rather than casting at every call site.
 */
import { Link as PreactRouterLink } from 'preact-router'
import type { JSX } from 'preact'

type RouterLinkProps = JSX.AnchorHTMLAttributes<HTMLAnchorElement> & {
  activeClassName?: string
}

export function Link(props: RouterLinkProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <PreactRouterLink {...(props as any)} />
}

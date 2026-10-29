// Workspace-slug helpers shared by the organizer onboarding UI (and its
// tests). The rules mirror the API schema in app/api/organizers/route.ts
// exactly — 3–80 characters of [a-z0-9] with single hyphens between
// segments — so anything the helpers accept will pass server validation.

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isValidWorkspaceSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 80 && SLUG_PATTERN.test(slug)
}

/**
 * Derive a valid workspace slug from a human organizer name: lowercase,
// diacritics folded, every non-alphanumeric run collapsed to a single
 * hyphen, edges trimmed, capped at 80 characters without a trailing
 * hyphen. May return fewer than 3 characters for very short names — the
 * caller decides whether that blocks submission (the UI does).
 */
export function slugifyWorkspaceName(name: string): string {
  const folded = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (folded.length <= 80) return folded
  return folded.slice(0, 80).replace(/-+$/g, '')
}

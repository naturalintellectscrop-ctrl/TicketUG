import type { ReactNode } from 'react'

/**
 * Console page header: compact operational title block — crumb, title,
 * one-line purpose, and (optionally) the page's primary actions on the right.
 * Deliberately NOT the marketing display scale.
 */
export function PageHeader({ crumb, title, lede, actions }: { crumb?: string; title: string; lede?: string; actions?: ReactNode }) {
  return (
    <header className="console-page-head">
      <div>
        {crumb && <p className="console-crumb">{crumb}</p>}
        <h1>{title}</h1>
        {lede && <p className="console-lede">{lede}</p>}
      </div>
      {actions && <div className="console-page-head-actions">{actions}</div>}
    </header>
  )
}

/** Console section heading row: small label + heading, optional side note. */
export function SectionHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="console-section-head">
      <h2>{title}</h2>
      {note && <span className="muted">{note}</span>}
    </div>
  )
}

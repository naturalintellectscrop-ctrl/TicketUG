/**
 * Route-level loading skeleton for the platform console. Rendered inside
 * .console-content by the app router while a server page streams in.
 * Pure structure — three neutral placeholder surfaces, no text and no
 * numbers, so nothing is implied before the real data lands.
 */
export default function PlatformLoading() {
  return (
    <div aria-hidden="true">
      <div className="surface" style={{ height: 120 }} />
      <div className="surface" style={{ height: 220, marginTop: 26 }} />
      <div className="surface" style={{ height: 160, marginTop: 26 }} />
    </div>
  )
}

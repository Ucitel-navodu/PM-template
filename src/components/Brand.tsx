import { BRAND, LOGO_GREY_PATHS, LOGO_RATIO, LOGO_RED_PATHS, LOGO_VIEWBOX, LOGO_ZONE, SYMBOL_O, SYMBOL_U_PATH, SYMBOL_VIEWBOX, type LogoVariant } from '../lib/brand'

/**
 * ORLEN Unipetrol trade mark (primary horizontal variation).
 * `height` is the height of the mark itself; the exclusion zone (height of the
 * letter O) is added around it as padding, so nothing can come closer.
 * The manual's digital minimum is 50 px of width (about 15 px of height).
 */
export function Logo({ height = 30, variant = 'color', className = '' }: { height?: number; variant?: LogoVariant; className?: string }) {
  const h = Math.max(15, height)
  const zone = Math.round(h * LOGO_ZONE)
  const [red, grey] = variant === 'color' ? [BRAND.red, BRAND.grey] : ['#ffffff', '#ffffff']
  return (
    <span className={`inline-flex shrink-0 ${className}`} style={{ padding: zone }} data-testid="brand-logo" data-variant={variant}>
      <svg viewBox={LOGO_VIEWBOX} width={Math.round(h * LOGO_RATIO)} height={h} role="img" aria-label="ORLEN Unipetrol">
        {LOGO_RED_PATHS.map((d, i) => (
          <path key={`r${i}`} fill={red} d={d} />
        ))}
        {LOGO_GREY_PATHS.map((d, i) => (
          <path key={`g${i}`} fill={grey} d={d} />
        ))}
      </svg>
    </span>
  )
}

/** The colour mark on light pages, the white negative mark on dark ones (manual 2.5 / 2.6). */
export function ThemedLogo({ height, className = '' }: { height?: number; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 ${className}`}>
      <Logo height={height} className="dark:hidden" />
      <Logo height={height} variant="negative" className="hidden dark:inline-flex" />
    </span>
  )
}

/**
 * Graphic symbol O + U, always cut by the edge of its container (manual 5.4):
 * the parent needs `relative overflow-hidden`. Decorative only.
 */
export function BrandSymbol({ size = 180, corner = 'top-right', onRed = false, className = '' }: { size?: number; corner?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'; onRed?: boolean; className?: string }) {
  const o = SYMBOL_O
  const off = -Math.round(size * 0.2)
  const pos = { 'top-right': { top: off, right: off }, 'bottom-right': { bottom: off, right: off }, 'top-left': { top: off, left: off }, 'bottom-left': { bottom: off, left: off } }[corner]
  return (
    <svg aria-hidden data-brand-symbol viewBox={SYMBOL_VIEWBOX} width={size} height={size} className={`pointer-events-none absolute select-none ${className}`} style={pos}>
      <circle cx={o.cx} cy={o.cy} r={o.r} fill="none" stroke={onRed ? '#ffffff' : BRAND.red} strokeWidth={o.stroke} />
      <path d={SYMBOL_U_PATH} className="brand-symbol-u" />
    </svg>
  )
}

/**
 * Section 2.2 — Neutral layer deformation (Eqs 14-20)
 *
 * These describe how the flexspline neutral layer deforms under
 * the cosine-type wave generator. φ is the angle of a point on
 * the undeformed neutral layer measured from the wave generator
 * major axis.
 */

/**
 * Eq 14: Radial vector of deformed neutral layer point.
 * ρ = rm + ω₀·cos(2φ)
 */
export function eq14Rho(phi: number, rm: number, w0: number): number {
  return rm + w0 * Math.cos(2.0 * phi);
}

/**
 * Eq 15: Radial change of a unit arc element.
 * A'B' - AB = (rm + ω)dφ - rm·dφ = ω·dφ
 */
export function eq15RadialArcChange(omega: number, dphi: number): number {
  return omega * dphi;
}

/**
 * Eq 16: Radial displacement (definition).
 * ω = ρ - rm
 */
export function eq16Omega(rho: number, rm: number): number {
  return rho - rm;
}

/**
 * Eq 17: Radial displacement (Eq 14 substituted into Eq 16).
 * ω = ω₀·cos(2φ)
 */
export function eq17Omega(phi: number, w0: number): number {
  return w0 * Math.cos(2.0 * phi);
}

/**
 * Eq 18: Tangential change of a unit arc element.
 * A''B'' - A'B' = (v + dv) - v = dv
 */
export function eq18TangentialArcChange(dv: number): number {
  return dv;
}

/**
 * Eq 19: Neutral layer invariance condition.
 * ω·dφ + dv = 0
 * Returns the residual (should be zero when satisfied).
 */
export function eq19NeutralLayerInvariance(omega: number, dphi: number, dv: number): number {
  return omega * dphi + dv;
}

/**
 * Eq 20: Tangential displacement (integral of Eq 19 using Eq 17).
 * v = -∫ω dφ = -½·ω₀·sin(2φ)
 */
export function eq20V(phi: number, w0: number): number {
  return -0.5 * w0 * Math.sin(2.0 * phi);
}

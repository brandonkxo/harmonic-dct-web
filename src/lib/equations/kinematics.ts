/**
 * Section 2.2 — Angular relationships (Eqs 21-27)
 *
 * These define the angular relationships needed for the coordinate
 * transformation from the flexspline frame {O_R} to the fixed
 * circular spline frame {O_G}.
 */

import { eq14Rho } from './deformation';

/**
 * Eq 21: Normal deformation angle.
 * μ = arctan(ρ̇/ρ) ≈ -(1/rm)·(dω/dφ) = (2ω₀/rm)·sin(2φ)
 *
 * where ρ̇ = dρ/dφ = -2ω₀·sin(2φ), and the approximation
 * holds because μ is small and rm >> ω.
 */
export function eq21Mu(phi: number, w0: number, rm: number): number {
  return (2.0 * w0 / rm) * Math.sin(2.0 * phi);
}

/**
 * Eq 22: Neutral layer arc length invariance (residual form).
 * rm·φ = ∫₀^φ₁ √(ρ² + ρ̇²) dφ ≈ ∫₀^φ₁ ρ dφ
 *
 * Returns rm·φ - ∫₀^φ₁ ρ dφ  (should be ~0 when φ₁ is correct).
 * Uses numerical integration (trapezoidal) for verification.
 */
export function eq22ArcLengthInvariance(phi: number, phi1: number, rm: number, w0: number): number {
  const N = 200;
  const dphi = phi1 / N;
  let integral = 0.0;

  for (let i = 0; i <= N; i++) {
    const p = i * dphi;
    const rho = eq14Rho(p, rm, w0);
    const weight = (i === 0 || i === N) ? 0.5 : 1.0;
    integral += weight * rho * dphi;
  }

  return rm * phi - integral;
}

/**
 * Eq 23: Angle of deformed endpoint relative to wave generator.
 * φ₁ = φ - ω₀·sin(2φ) / (2·rm)
 *
 * Derived from Eq 22 by evaluating the integral analytically.
 */
export function eq23Phi1(phi: number, w0: number, rm: number): number {
  return phi - w0 * Math.sin(2.0 * phi) / (2.0 * rm);
}

/**
 * Eq 24: Transmission ratio relationship.
 * z_f / z_c = φ₂ / φ
 *
 * Returns the ratio z_f / z_c.
 */
export function eq24TransmissionRatio(z_f: number, z_c: number): number {
  return z_f / z_c;
}

/**
 * Eq 25: Wave generator rotation angle.
 * φ₂ = (z_f / z_c) · φ
 */
export function eq25Phi2(phi: number, z_f: number, z_c: number): number {
  return (z_f / z_c) * phi;
}

/**
 * Eq 26: Deformation angle of flexspline's deformed endpoint.
 * γ = φ₁ - φ₂
 */
export function eq26Gamma(phi1: number, phi2: number): number {
  return phi1 - phi2;
}

/**
 * Eq 27: Angle between Y_G axis and Y_R axis.
 * ψ = μ + γ
 */
export function eq27Psi(mu: number, gamma: number): number {
  return mu + gamma;
}

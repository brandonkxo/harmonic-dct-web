/**
 * Section 2.2 — Coordinate transform & envelope (Eqs 28-30)
 *
 * Transform flexspline tooth profile points from the local tooth
 * frame {O_R - X_R - Y_R} into the fixed circular spline frame
 * {O_G - X_G - Y_G}, then apply the envelope condition to find
 * the conjugate circular spline tooth profile.
 */

import type { PointTuple } from '@/types';

/**
 * Eq 28: 3x3 homogeneous transformation matrix M.
 *
 * M = [ cos(ψ)   sin(ψ)   ρ·sin(γ) ]
 *     [-sin(ψ)   cos(ψ)   ρ·cos(γ) ]
 *     [   0         0         1     ]
 *
 * Returns the 3x3 matrix as a 2D array.
 */
export function eq28TransformMatrix(
  psi: number,
  rho: number,
  gamma: number
): [[number, number, number], [number, number, number], [number, number, number]] {
  const cp = Math.cos(psi);
  const sp = Math.sin(psi);
  const tx = rho * Math.sin(gamma);
  const ty = rho * Math.cos(gamma);

  return [
    [cp, sp, tx],
    [-sp, cp, ty],
    [0.0, 0.0, 1.0],
  ];
}

/**
 * Eq 29: Transform a point from flexspline frame to circular spline frame.
 *
 * x_g =  x_r·cos(ψ) + y_r·sin(ψ) + ρ·sin(γ)
 * y_g = -x_r·sin(ψ) + y_r·cos(ψ) + ρ·cos(γ)
 */
export function eq29Transform(
  xr: number,
  yr: number,
  psi: number,
  rho: number,
  gamma: number
): PointTuple {
  const cp = Math.cos(psi);
  const sp = Math.sin(psi);
  const xg = xr * cp + yr * sp + rho * Math.sin(gamma);
  const yg = -xr * sp + yr * cp + rho * Math.cos(gamma);
  return [xg, yg];
}

/**
 * Eq 30: Envelope conjugate condition.
 *
 * ∂x_g/∂l · ∂y_g/∂φ  -  ∂y_g/∂l · ∂x_g/∂φ  =  0
 *
 * Returns the residual (zero on the conjugate profile).
 * The four partial derivatives are computed externally via
 * finite differences.
 */
export function eq30EnvelopeCondition(
  dxg_dl: number,
  dyg_dphi: number,
  dyg_dl: number,
  dxg_dphi: number
): number {
  return dxg_dl * dyg_dphi - dyg_dl * dxg_dphi;
}

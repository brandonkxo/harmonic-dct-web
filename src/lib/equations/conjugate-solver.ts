/**
 * Conjugate profile solver using envelope condition (Eq 30)
 *
 * Solves Eq 30 over a (phi, l) grid to find the conjugate circular-
 * spline tooth profile.
 */

import type { GearParams, ProfileResult, ConjugateResult, PointTuple } from '@/types';
import { computeProfile, profilePointAtL } from './core-profile';
import { eq14Rho } from './deformation';
import { eq21Mu, eq23Phi1, eq25Phi2, eq26Gamma, eq27Psi } from './kinematics';
import { eq29Transform, eq30EnvelopeCondition } from './transforms';

/**
 * Compute (x_g, y_g) in the circular-spline frame {O_G} for a
 * flexspline tooth profile point at arc-length l and wave-generator
 * angle phi.
 *
 * Chains: Eqs 2/4/6 → Eqs 14,21,23,25,26,27 → Eq 29.
 */
function xgYgAt(
  l: number,
  phi: number,
  prof: ProfileResult,
  params: GearParams
): PointTuple {
  const rm = prof.rm;
  const w0 = params.w0;
  const z_f = params.z_f;
  const z_c = params.z_c;

  // Tooth profile point in {O_R}
  const [xr, yr] = profilePointAtL(l, prof);

  // Angular quantities (all functions of phi only)
  const rho = eq14Rho(phi, rm, w0);
  const mu = eq21Mu(phi, w0, rm);
  const phi1 = eq23Phi1(phi, w0, rm);
  const phi2 = eq25Phi2(phi, z_f, z_c);
  const gamma = eq26Gamma(phi1, phi2);
  const psi = eq27Psi(mu, gamma);

  // Eq 29 coordinate transform
  return eq29Transform(xr, yr, psi, rho, gamma);
}

/**
 * Evaluate the Eq 30 envelope residual at (l, phi) using central
 * finite differences.
 */
function eq30ResidualAt(
  l: number,
  phi: number,
  prof: ProfileResult,
  params: GearParams,
  eps_l: number = 1e-5,
  eps_phi: number = 1e-5
): number {
  const l3 = prof.l3;

  // ── ∂/∂l  (perturb l, hold phi fixed) ──
  const l_plus = Math.min(l + eps_l, l3);
  const l_minus = Math.max(l - eps_l, 0.0);
  const dl = l_plus - l_minus;

  const [xg_lp, yg_lp] = xgYgAt(l_plus, phi, prof, params);
  const [xg_lm, yg_lm] = xgYgAt(l_minus, phi, prof, params);
  const dxg_dl = (xg_lp - xg_lm) / dl;
  const dyg_dl = (yg_lp - yg_lm) / dl;

  // ── ∂/∂φ  (perturb phi, hold l fixed) ──
  const [xg_pp, yg_pp] = xgYgAt(l, phi + eps_phi, prof, params);
  const [xg_pm, yg_pm] = xgYgAt(l, phi - eps_phi, prof, params);
  const dxg_dphi = (xg_pp - xg_pm) / (2.0 * eps_phi);
  const dyg_dphi = (yg_pp - yg_pm) / (2.0 * eps_phi);

  return eq30EnvelopeCondition(dxg_dl, dyg_dphi, dyg_dl, dxg_dphi);
}

/**
 * Filter phi jumps to keep only the engagement run of a segment's conjugate points.
 */
function filterPhiJump(
  segRoots: Array<[number, number, number, number, string]>,
  pts: PointTuple[]
): PointTuple[] {
  if (segRoots.length < 3) {
    return pts;
  }

  let prevStep = Math.abs(segRoots[1][0] - segRoots[0][0]);
  for (let i = 2; i < segRoots.length; i++) {
    const step = Math.abs(segRoots[i][0] - segRoots[i - 1][0]);
    if (prevStep > 0 && step > 2.0 * prevStep) {
      return pts.slice(0, i);
    }
    prevStep = step;
  }
  return pts;
}

/**
 * Solve Eq 30 over a (phi, l) grid to find the conjugate circular-
 * spline tooth profile.
 *
 * @param params Gear parameters
 * @param N_phi Number of phi grid points (default 720)
 * @param N_l Number of l grid points (default 1000)
 * @param onProgress Optional progress callback (0-100)
 */
export function computeConjugateProfile(
  params: GearParams,
  N_phi: number = 720,
  N_l: number = 1000,
  onProgress?: (percent: number) => void
): ConjugateResult {
  const prof = computeProfile(params);
  if (prof.error) {
    return { error: prof.error } as ConjugateResult;
  }

  const { m, z_c, ha, hf } = params;
  const l3 = prof.l3;

  const rp_c = m * z_c / 2.0;  // Circular-spline pitch radius

  // Grid spacings
  const phi_min = -Math.PI / 2.0;
  const phi_max = Math.PI / 2.0;
  const dphi_grid = (phi_max - phi_min) / N_phi;
  const dl_grid = l3 / N_l;

  // Collect (phi, l_zero, x_local, y_local, segment) for every root
  const rawRoots: Array<[number, number, number, number, string]> = [];

  // Bounds for filtering spurious roots
  const margin = 0.5 * (ha + hf);
  const y_lo = -(hf + margin);
  const y_hi = ha + margin;
  const x_bound = m * Math.PI;

  const l1 = prof.l1;
  const l2 = prof.l2;

  for (let i = 0; i <= N_phi; i++) {
    const phi = phi_min + i * dphi_grid;

    // Report progress
    if (onProgress && i % 72 === 0) {
      onProgress(Math.round((i / N_phi) * 100));
    }

    // Evaluate residual along l for this phi
    const residuals: number[] = [];
    for (let j = 0; j <= N_l; j++) {
      const lv = j * dl_grid;
      residuals.push(eq30ResidualAt(lv, phi, prof, params));
    }

    // Scan for sign changes → linear interpolation
    for (let j = 0; j < N_l; j++) {
      const r0 = residuals[j];
      const r1 = residuals[j + 1];

      if (r0 * r1 < 0.0) {
        const frac = Math.abs(r0) / (Math.abs(r0) + Math.abs(r1));
        const l_zero = (j + frac) * dl_grid;
        const [xg, yg] = xgYgAt(l_zero, phi, prof, params);
        const y_local = yg - rp_c;

        // Filter spurious roots outside physical tooth bounds
        if (!(y_lo <= y_local && y_local <= y_hi && Math.abs(xg) <= x_bound)) {
          continue;
        }

        // Tag by originating tooth segment
        let seg: string;
        if (l_zero <= l1) {
          seg = 'AB';
        } else if (l_zero <= l2) {
          seg = 'BC';
        } else {
          seg = 'CD';
        }
        rawRoots.push([phi, l_zero, xg, y_local, seg]);
      }
    }
  }

  if (rawRoots.length === 0) {
    return { error: 'No conjugate points found — check parameters.' } as ConjugateResult;
  }

  // Build segment-keyed branches (sorted by phi)
  const segBranches: { AB: PointTuple[]; BC: PointTuple[]; CD: PointTuple[] } = {
    AB: [],
    BC: [],
    CD: [],
  };
  const conjugatePts: PointTuple[] = [];

  for (const segKey of ['AB', 'BC', 'CD'] as const) {
    const segPts = rawRoots.filter(r => r[4] === segKey);
    segPts.sort((a, b) => a[0] - b[0]);  // Sort by phi
    const pts: PointTuple[] = segPts.map(r => [r[2], r[3]]);
    segBranches[segKey] = filterPhiJump(segPts, pts);
    conjugatePts.push(...segBranches[segKey]);
  }

  // Legacy 'branches' list (all non-empty segments)
  const branches = Object.values(segBranches).filter(pts => pts.length >= 2);

  if (onProgress) {
    onProgress(100);
  }

  return {
    conjugate_pts: conjugatePts,
    branches,
    seg_branches: segBranches,
    rp_c,
    s: prof.s,
    t: prof.t,
    n_pts: conjugatePts.length,
    n_branches: branches.length,
  };
}

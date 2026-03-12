/**
 * Core profile equations (Equations 1-13) from Liu et al. paper
 *
 * Computes the double-circular-arc common-tangent flexspline tooth profile
 * consisting of three segments: convex arc AB, tangent line BC, concave arc CD.
 */

import type { GearParams, ProfileResult, PointTuple } from '@/types';

/**
 * Given flexspline parameters, compute the three profile segments
 * and return all intermediate values + point lists.
 */
export function computeProfile(params: GearParams): ProfileResult {
  const { m, z_f, r1, c1, e1, r2, c2, e2, ha, hf, mu_s, mu_t } = params;

  const rp = m * z_f / 2.0;  // Pitch radius

  // Compute s and t from coefficient inputs
  const s = mu_s * m * z_f;
  const t = mu_t * s;

  // ── Equation 1 ─────────────────────────────────────────────────
  // ds: distance from dedendum circle to neutral layer
  const ds = s - t / 2.0;

  // ── Equation 3 ─────────────────────────────────────────────────
  // Convex arc center O1 coordinates and start angle alpha
  const arg1 = (ha + e1) / r1;
  if (Math.abs(arg1) > 1.0) {
    return {
      error: `Eq3 arcsin domain: (ha+e1)/r1 = ${arg1.toFixed(4)}`,
    } as ProfileResult;
  }
  const alpha = Math.asin(arg1);
  const x1_R = -c1;
  const y1_R = ds + hf - e1;

  // ── Equation 7 (partial) ───────────────────────────────────────
  // Concave arc center O2 coordinates
  const x2_R = m * Math.PI / 2.0 + c2;
  const y2_R = ds + hf + e2;

  // ── Equation 8 ─────────────────────────────────────────────────
  // Distance between arc centers O1 and O2
  const d = Math.sqrt(Math.pow(y1_R - y2_R, 2) + Math.pow(x1_R - x2_R, 2));

  // ── Equation 9 ─────────────────────────────────────────────────
  const arg_eps = (r1 + r2) / d;
  if (Math.abs(arg_eps) > 1.0) {
    return {
      error: `Eq9 arccos domain: (r1+r2)/d = ${arg_eps.toFixed(4)}`,
    } as ProfileResult;
  }
  const epsilon = Math.acos(arg_eps);

  // ── Equation 10 ────────────────────────────────────────────────
  const denom = x1_R - x2_R;
  if (Math.abs(denom) < 1e-15) {
    return {
      error: 'Eq10: O1 and O2 have same x-coordinate.',
    } as ProfileResult;
  }
  const sigma = Math.atan((y1_R - y2_R) / denom);

  // ── Equation 11 ────────────────────────────────────────────────
  const delta = epsilon + sigma;

  // ── Equation 3 (continued) ─────────────────────────────────────
  // Arc length of convex segment AB
  const l1 = r1 * (alpha - delta);
  if (l1 < 0) {
    return {
      error: `l1 < 0 (${l1.toFixed(4)}). Parameters produce invalid geometry.`,
    } as ProfileResult;
  }

  // ── Equation 12 ────────────────────────────────────────────────
  // Y-coordinates of tangent points B and C
  const y_B = r1 * Math.sin(delta) + ds + hf - e1;
  const y_C = ds + hf + e2 - r2 * Math.sin(delta);

  // ── Equation 13 ────────────────────────────────────────────────
  const h1 = y_B - y_C;

  // ── Equation 5 ─────────────────────────────────────────────────
  const cos_d = Math.cos(delta);
  if (Math.abs(cos_d) < 1e-12) {
    return {
      error: 'Eq5: cos(delta) ~ 0, degenerate tangent.',
    } as ProfileResult;
  }
  const l2 = l1 + h1 / cos_d;

  // ── Equation 7 (continued) ─────────────────────────────────────
  // Total arc length including concave segment CD
  const arg2 = (e2 + hf) / r2;
  if (Math.abs(arg2) > 1.0) {
    return {
      error: `Eq7 arcsin domain: (e2+hf)/r2 = ${arg2.toFixed(4)}`,
    } as ProfileResult;
  }
  const l3 = l2 + r2 * (Math.asin(arg2) - delta);

  // ── Sample points along each segment ───────────────────────────
  const N_AB = 60;
  const N_BC = 30;
  const N_CD = 60;

  // Equation 2: Convex arc AB
  const pts_AB: PointTuple[] = [];
  for (let i = 0; i <= N_AB; i++) {
    const ll = l1 * i / N_AB;
    const x = r1 * Math.cos(alpha - ll / r1) + x1_R;
    const y = r1 * Math.sin(alpha - ll / r1) + y1_R;
    pts_AB.push([x, y]);
  }

  // Equation 4: Tangent line BC
  const pts_BC: PointTuple[] = [];
  const l_bc_len = l2 - l1;
  for (let i = 0; i <= N_BC; i++) {
    const ll = l1 + l_bc_len * i / N_BC;
    const x = r1 * Math.cos(delta) + x1_R + (ll - l1) * Math.sin(delta);
    const y = r1 * Math.sin(delta) + y1_R - (ll - l1) * Math.cos(delta);
    pts_BC.push([x, y]);
  }

  // Equation 6: Concave arc CD
  const pts_CD: PointTuple[] = [];
  const l_cd_len = l3 - l2;
  if (l_cd_len > 0) {
    for (let i = 0; i <= N_CD; i++) {
      const ll = l2 + l_cd_len * i / N_CD;
      const angle = delta + (ll - l2) / r2;
      const x = -r2 * Math.cos(angle) + x2_R;
      const y = -r2 * Math.sin(angle) + y2_R;
      pts_CD.push([x, y]);
    }
  }

  // ── Derived: neutral layer radius ────────────────────────────────
  // From geometry: rp = rm + ds + hf  →  rm = rp - ds - hf
  const rm = rp - ds - hf;

  return {
    rp,
    rm,
    ds,
    s,
    t,
    alpha,
    delta,
    x1_R,
    y1_R,
    x2_R,
    y2_R,
    r1,
    r2,
    l1,
    l2,
    l3,
    h1,
    pts_AB,
    pts_BC,
    pts_CD,
  };
}

/**
 * Evaluate profile point at a single arc-length value l.
 * Returns (x_r, y_r) in the tooth-local frame {O_R}.
 */
export function profilePointAtL(l: number, prof: ProfileResult): PointTuple {
  const { alpha, delta, x1_R, y1_R, x2_R, y2_R, r1, r2, l1, l2 } = prof;

  if (l <= l1) {
    // Eq 2 — convex arc AB
    const angle = alpha - l / r1;
    const x = r1 * Math.cos(angle) + x1_R;
    const y = r1 * Math.sin(angle) + y1_R;
    return [x, y];
  } else if (l <= l2) {
    // Eq 4 — tangent line BC
    const x = r1 * Math.cos(delta) + x1_R + (l - l1) * Math.sin(delta);
    const y = r1 * Math.sin(delta) + y1_R - (l - l1) * Math.cos(delta);
    return [x, y];
  } else {
    // Eq 6 — concave arc CD
    const angle = delta + (l - l2) / r2;
    const x = -r2 * Math.cos(angle) + x2_R;
    const y = -r2 * Math.sin(angle) + y2_R;
    return [x, y];
  }
}

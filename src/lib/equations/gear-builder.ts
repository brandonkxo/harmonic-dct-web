/**
 * Gear building functions for full flexspline and circular spline profiles
 */

import type { GearParams, ProfileResult, ToothOutlineResult, FullGearResult, PointTuple } from '@/types';
import { computeProfile } from './core-profile';
import { eq14Rho } from './deformation';
import { eq21Mu, eq23Phi1, eq27Psi } from './kinematics';
import { eq29Transform } from './transforms';
import { smoothBranch } from './smoothing';

/**
 * Apply dmax_x to profile points - shifts flanks inward to reduce tooth thickness.
 * Right side (x > 0): x_new = x - dmax_x
 * Left side (x < 0): x_new = x + dmax_x
 */
function applyDmaxX(pts: PointTuple[], dmax_x: number): PointTuple[] {
  if (dmax_x <= 0) return [...pts];
  return pts.map(([x, y]): PointTuple => {
    if (x > 0) return [x - dmax_x, y];
    if (x < 0) return [x + dmax_x, y];
    return [x, y];
  });
}

/**
 * Build the complete outline of one flexspline tooth placed on the
 * pitch circle, including reference geometry.
 */
export function buildSingleToothOutline(params: GearParams): ToothOutlineResult {
  const result = computeProfile(params);
  if (result.error) {
    return { error: result.error } as ToothOutlineResult;
  }

  const { m, z_f, ha, hf } = params;
  const rp = m * z_f / 2.0;
  const ds = result.ds;
  const rm = result.rm;

  // Right flank: A→B→C→D (addendum to dedendum)
  const rightFlank: PointTuple[] = [
    ...result.pts_AB,
    ...result.pts_BC,
    ...result.pts_CD,
  ];

  // Left flank: mirror of right, reversed (dedendum to addendum)
  const leftFlank: PointTuple[] = rightFlank
    .slice()
    .reverse()
    .map(([x, y]): PointTuple => [-x, y]);

  // Assemble outline: right flank + left flank (open at root)
  const localOutline: PointTuple[] = [...rightFlank, ...leftFlank];

  // Transform local (x, y) → polar → Cartesian on pitch circle
  const toothXy: PointTuple[] = localOutline.map(([x_loc, y_loc]): PointTuple => {
    const r = rm + y_loc;
    const theta = x_loc / rp;
    const X = r * Math.sin(theta);
    const Y = r * Math.cos(theta);
    return [X, Y];
  });

  return {
    tooth_xy: toothXy,
    local_outline: localOutline,
    right_flank: rightFlank,
    left_flank: leftFlank,
    split: rightFlank.length,
    rp,
    rm,
    ds,
    ha,
    hf,
  };
}

/**
 * Compute fillet geometry for addendum side
 */
function computeAddendumFillet(
  result: ProfileResult,
  params: GearParams,
  r_fillet: number
): {
  fillet: PointTuple[];
  pt_AB_trim: PointTuple;
  pt_add_trim_r: PointTuple;
  cy_fillet: number;
  cx_fillet: number;
} {
  const { ha, hf } = params;
  const { ds, x1_R, y1_R, r1 } = result;

  // Addendum height in local coords
  const y_add = ds + hf + ha;

  // Solve for fillet center (tangent to AB circle and horizontal addendum)
  const cy_fillet = y_add - r_fillet;
  const dy = cy_fillet - y1_R;
  const r_inner = r1 - r_fillet;
  let dx_sq = r_inner * r_inner - dy * dy;
  if (dx_sq < 0) dx_sq = 0;
  const cx_fillet = x1_R + Math.sqrt(dx_sq);

  // Tangent point on AB arc
  const dist_to_fillet = Math.sqrt((cx_fillet - x1_R) ** 2 + (cy_fillet - y1_R) ** 2);
  let dir_x: number, dir_y: number;
  if (dist_to_fillet > 1e-9) {
    dir_x = (cx_fillet - x1_R) / dist_to_fillet;
    dir_y = (cy_fillet - y1_R) / dist_to_fillet;
  } else {
    dir_x = 1;
    dir_y = 0;
  }
  const pt_AB_trim: PointTuple = [x1_R + r1 * dir_x, y1_R + r1 * dir_y];

  // Tangent point on addendum
  const pt_add_trim_r: PointTuple = [cx_fillet, y_add];

  // Generate fillet arc points (right side)
  const n_fillet = 12;
  const theta_start = Math.atan2(pt_AB_trim[1] - cy_fillet, pt_AB_trim[0] - cx_fillet);
  const theta_end = Math.atan2(pt_add_trim_r[1] - cy_fillet, pt_add_trim_r[0] - cx_fillet);
  let d_theta = theta_end - theta_start;
  if (d_theta > Math.PI) d_theta -= 2 * Math.PI;
  else if (d_theta < -Math.PI) d_theta += 2 * Math.PI;

  const fillet: PointTuple[] = [];
  for (let i = 0; i <= n_fillet; i++) {
    const frac = i / n_fillet;
    const theta = theta_start + frac * d_theta;
    const x = cx_fillet + r_fillet * Math.cos(theta);
    const y = cy_fillet + r_fillet * Math.sin(theta);
    fillet.push([x, y]);
  }

  return { fillet, pt_AB_trim, pt_add_trim_r, cy_fillet, cx_fillet };
}

/**
 * Compute fillet geometry for dedendum side
 */
function computeDedendumFillet(
  result: ProfileResult,
  params: GearParams,
  r_fillet: number
): {
  fillet: PointTuple[];
  pt_CD_trim: PointTuple;
  pt_ded_trim_r: PointTuple;
} {
  const { ds, x2_R, y2_R, r2 } = result;
  const y_ded = ds;

  // Solve for dedendum fillet center
  const cy_root = y_ded + r_fillet;
  const dy_root = cy_root - y2_R;
  const r_inner_root = Math.max(r2 - r_fillet, 0.0);
  let dx_root_sq = r_inner_root * r_inner_root - dy_root * dy_root;
  if (dx_root_sq < 0) dx_root_sq = 0;
  const cx_root = x2_R - Math.sqrt(dx_root_sq);

  // Tangent point on CD arc
  const dist_to_root = Math.sqrt((cx_root - x2_R) ** 2 + (cy_root - y2_R) ** 2);
  let dir_x_root: number, dir_y_root: number;
  if (dist_to_root > 1e-9) {
    dir_x_root = (cx_root - x2_R) / dist_to_root;
    dir_y_root = (cy_root - y2_R) / dist_to_root;
  } else {
    dir_x_root = 1;
    dir_y_root = 0;
  }
  const pt_CD_trim: PointTuple = [x2_R + r2 * dir_x_root, y2_R + r2 * dir_y_root];

  // Tangent point on dedendum
  const pt_ded_trim_r: PointTuple = [cx_root, y_ded];

  // Generate root fillet arc points
  const n_fillet = 12;
  const theta_root_start = Math.atan2(pt_CD_trim[1] - cy_root, pt_CD_trim[0] - cx_root);
  const theta_root_end = Math.atan2(pt_ded_trim_r[1] - cy_root, pt_ded_trim_r[0] - cx_root);
  let d_theta_root = theta_root_end - theta_root_start;
  if (d_theta_root > Math.PI) d_theta_root -= 2 * Math.PI;
  else if (d_theta_root < -Math.PI) d_theta_root += 2 * Math.PI;

  const fillet: PointTuple[] = [];
  for (let i = 0; i <= n_fillet; i++) {
    const frac = i / n_fillet;
    const theta = theta_root_start + frac * d_theta_root;
    const x = cx_root + r_fillet * Math.cos(theta);
    const y = cy_root + r_fillet * Math.sin(theta);
    fillet.push([x, y]);
  }

  return { fillet, pt_CD_trim, pt_ded_trim_r };
}

/**
 * Trim AB points to fillet tangent point
 */
function trimABToFillet(
  pts_AB: PointTuple[],
  pt_AB_trim: PointTuple,
  x1_R: number,
  y1_R: number
): PointTuple[] {
  const angle_trim = Math.atan2(pt_AB_trim[1] - y1_R, pt_AB_trim[0] - x1_R);
  const trimmed: PointTuple[] = [];

  for (const pt of pts_AB) {
    const angle_pt = Math.atan2(pt[1] - y1_R, pt[0] - x1_R);
    if (angle_pt <= angle_trim + 1e-9) {
      trimmed.push(pt);
    }
  }

  if (trimmed.length > 0) {
    const first_pt = trimmed[0];
    const dist_to_trim = Math.sqrt((first_pt[0] - pt_AB_trim[0]) ** 2 + (first_pt[1] - pt_AB_trim[1]) ** 2);
    if (dist_to_trim > 1e-6) {
      trimmed.unshift(pt_AB_trim);
    }
  } else {
    return [pt_AB_trim];
  }

  return trimmed;
}

/**
 * Trim CD points to fillet tangent point
 */
function trimCDToFillet(
  pts_CD: PointTuple[],
  pt_CD_trim: PointTuple,
  x2_R: number,
  y2_R: number
): PointTuple[] {
  const angle_cd_trim = Math.atan2(pt_CD_trim[1] - y2_R, pt_CD_trim[0] - x2_R);
  const trimmed: PointTuple[] = [];

  for (const pt of pts_CD) {
    const angle_pt = Math.atan2(pt[1] - y2_R, pt[0] - x2_R);
    if (angle_pt <= angle_cd_trim + 1e-9) {
      trimmed.push(pt);
    }
  }

  if (trimmed.length > 0) {
    const last_pt = trimmed[trimmed.length - 1];
    const dist_to_trim = Math.sqrt((last_pt[0] - pt_CD_trim[0]) ** 2 + (last_pt[1] - pt_CD_trim[1]) ** 2);
    if (dist_to_trim > 1e-6) {
      trimmed.push(pt_CD_trim);
    }
  } else {
    return [pt_CD_trim];
  }

  return trimmed;
}

/**
 * Pattern the flexspline tooth around the full pitch circle.
 */
export function buildFullFlexspline(
  params: GearParams,
  n_ded_arc: number = 39,
  r_fillet_add: number = 0.2,
  r_fillet_ded: number | null = null,
  smooth: number = 0.0
): FullGearResult {
  const result = computeProfile(params);
  if (result.error) {
    return { error: result.error } as FullGearResult;
  }

  const { m, ha, hf } = params;
  const z_f = Math.floor(params.z_f);
  const rp = m * z_f / 2.0;
  const ds = result.ds;
  const rm = result.rm;

  if (r_fillet_ded === null) r_fillet_ded = r_fillet_add;

  // Compute fillets
  const addFillet = computeAddendumFillet(result, params, r_fillet_add);
  const dedFillet = computeDedendumFillet(result, params, r_fillet_ded);

  // Trim AB and CD to fillet points
  const pts_AB_trimmed = trimABToFillet(result.pts_AB, addFillet.pt_AB_trim, result.x1_R, result.y1_R);
  const pts_CD_trimmed = trimCDToFillet(result.pts_CD, dedFillet.pt_CD_trim, result.x2_R, result.y2_R);

  // Single tooth flank (right side)
  let rightFlank: PointTuple[] = [...pts_AB_trimmed, ...result.pts_BC, ...pts_CD_trimmed];

  // Apply smoothing if requested
  if (smooth > 0) {
    rightFlank.sort((a, b) => b[1] - a[1]);  // Sort by y descending
    rightFlank = smoothBranch(rightFlank, smooth, 200);
  }

  const leftFlank: PointTuple[] = rightFlank.slice().reverse().map(([x, y]): PointTuple => [-x, y]);

  // Mirror fillets
  const fillet_left: PointTuple[] = addFillet.fillet.map(([x, y]): PointTuple => [-x, y]);
  const fillet_root_left: PointTuple[] = dedFillet.fillet.slice().reverse().map(([x, y]): PointTuple => [-x, y]);
  const fillet_root_right = dedFillet.fillet;

  const pt_add_trim_l: PointTuple = [-addFillet.pt_add_trim_r[0], addFillet.pt_add_trim_r[1]];
  const pt_ded_trim_l: PointTuple = [-dedFillet.pt_ded_trim_r[0], dedFillet.pt_ded_trim_r[1]];

  // Dedendum radius
  const r_ded = rm + ds;

  // Angular pitch
  const pitch_angle = (2.0 * Math.PI) / z_f;

  // Angular positions of dedendum trim points
  const theta_D = dedFillet.pt_ded_trim_r[0] / rp;
  const theta_Dp = pt_ded_trim_l[0] / rp;

  function localToPolar(x_loc: number, y_loc: number, tooth_offset_angle: number): PointTuple {
    const r = rm + y_loc;
    const theta = x_loc / rp + tooth_offset_angle;
    return [r * Math.sin(theta), r * Math.cos(theta)];
  }

  const chainXy: PointTuple[] = [];

  for (let i = 0; i < z_f; i++) {
    const angle_i = i * pitch_angle;

    // Left root fillet
    for (const [x_loc, y_loc] of fillet_root_left) {
      chainXy.push(localToPolar(x_loc, y_loc, angle_i));
    }

    // Left flank
    for (const [x_loc, y_loc] of leftFlank) {
      chainXy.push(localToPolar(x_loc, y_loc, angle_i));
    }

    // Left fillet
    for (const [x_loc, y_loc] of fillet_left) {
      chainXy.push(localToPolar(x_loc, y_loc, angle_i));
    }

    // Addendum line
    for (let j = 1; j < n_ded_arc; j++) {
      const frac = j / n_ded_arc;
      const x_loc = pt_add_trim_l[0] + frac * (addFillet.pt_add_trim_r[0] - pt_add_trim_l[0]);
      const y_loc = pt_add_trim_l[1] + frac * (addFillet.pt_add_trim_r[1] - pt_add_trim_l[1]);
      chainXy.push(localToPolar(x_loc, y_loc, angle_i));
    }

    // Right fillet (reversed)
    for (let k = addFillet.fillet.length - 1; k >= 0; k--) {
      const [x_loc, y_loc] = addFillet.fillet[k];
      chainXy.push(localToPolar(x_loc, y_loc, angle_i));
    }

    // Right flank
    for (const [x_loc, y_loc] of rightFlank) {
      chainXy.push(localToPolar(x_loc, y_loc, angle_i));
    }

    // Right root fillet
    for (const [x_loc, y_loc] of fillet_root_right) {
      chainXy.push(localToPolar(x_loc, y_loc, angle_i));
    }

    // Dedendum arc to next tooth
    const next_i = (i + 1) % z_f;
    const angle_next = next_i * pitch_angle;
    let theta_start = theta_D + angle_i;
    let theta_end = theta_Dp + angle_next;

    if (theta_end < theta_start) {
      theta_end += 2.0 * Math.PI;
    }

    for (let j = 1; j <= n_ded_arc; j++) {
      const frac = j / n_ded_arc;
      const th = theta_start + frac * (theta_end - theta_start);
      chainXy.push([r_ded * Math.sin(th), r_ded * Math.cos(th)]);
    }
  }

  return {
    chain_xy: chainXy,
    rp,
    rm,
    ds,
    s: result.s,
    t: result.t,
    ha,
    hf,
    z_f,
  };
}

/**
 * Pattern the flexspline around the DEFORMED neutral layer.
 */
export function buildDeformedFlexspline(
  params: GearParams,
  n_ded_arc: number = 39,
  r_fillet_add: number = 0.2,
  r_fillet_ded: number | null = null,
  smooth: number = 0.0
): FullGearResult {
  const result = computeProfile(params);
  if (result.error) {
    return { error: result.error } as FullGearResult;
  }

  const { m, w0, ha, hf } = params;
  const z_f = Math.floor(params.z_f);
  const rp = m * z_f / 2.0;
  const rm = result.rm;
  const ds = result.ds;

  if (r_fillet_ded === null) r_fillet_ded = r_fillet_add;

  // Compute fillets
  const addFillet = computeAddendumFillet(result, params, r_fillet_add);
  const dedFillet = computeDedendumFillet(result, params, r_fillet_ded);

  // Trim AB and CD to fillet points
  const pts_AB_trimmed = trimABToFillet(result.pts_AB, addFillet.pt_AB_trim, result.x1_R, result.y1_R);
  const pts_CD_trimmed = trimCDToFillet(result.pts_CD, dedFillet.pt_CD_trim, result.x2_R, result.y2_R);

  // Single tooth flank
  let rightFlank: PointTuple[] = [...pts_AB_trimmed, ...result.pts_BC, ...pts_CD_trimmed];

  if (smooth > 0) {
    rightFlank.sort((a, b) => b[1] - a[1]);
    rightFlank = smoothBranch(rightFlank, smooth, 200);
  }

  const leftFlank: PointTuple[] = rightFlank.slice().reverse().map(([x, y]): PointTuple => [-x, y]);

  // Mirror fillets
  const fillet_left: PointTuple[] = addFillet.fillet.map(([x, y]): PointTuple => [-x, y]);
  const fillet_root_left: PointTuple[] = dedFillet.fillet.slice().reverse().map(([x, y]): PointTuple => [-x, y]);
  const fillet_root_right = dedFillet.fillet;

  const pt_add_trim_l: PointTuple = [-addFillet.pt_add_trim_r[0], addFillet.pt_add_trim_r[1]];
  const pt_ded_trim_l: PointTuple = [-dedFillet.pt_ded_trim_r[0], dedFillet.pt_ded_trim_r[1]];

  const pitch_angle = (2.0 * Math.PI) / z_f;

  function toothPointGlobal(xr: number, yr: number, phi: number): PointTuple {
    const rho = eq14Rho(phi, rm, w0);
    const mu = eq21Mu(phi, w0, rm);
    const phi1 = eq23Phi1(phi, w0, rm);
    const gamma = phi1;  // φ₂ = 0 for deformed flexspline shape
    const psi = eq27Psi(mu, gamma);
    return eq29Transform(xr, yr, psi, rho, gamma);
  }

  const chainXy: PointTuple[] = [];
  const pt_D = dedFillet.pt_ded_trim_r;
  const pt_Dp = pt_ded_trim_l;

  for (let i = 0; i < z_f; i++) {
    const phi = i * pitch_angle;
    const next_i = (i + 1) % z_f;
    const phi_next = next_i * pitch_angle;

    // Left root fillet
    for (const [x_loc, y_loc] of fillet_root_left) {
      chainXy.push(toothPointGlobal(x_loc, y_loc, phi));
    }

    // Left flank
    for (const [xr, yr] of leftFlank) {
      chainXy.push(toothPointGlobal(xr, yr, phi));
    }

    // Left fillet
    for (const [x_loc, y_loc] of fillet_left) {
      chainXy.push(toothPointGlobal(x_loc, y_loc, phi));
    }

    // Addendum line
    for (let j = 1; j < n_ded_arc; j++) {
      const frac = j / n_ded_arc;
      const x_loc = pt_add_trim_l[0] + frac * (addFillet.pt_add_trim_r[0] - pt_add_trim_l[0]);
      const y_loc = pt_add_trim_l[1] + frac * (addFillet.pt_add_trim_r[1] - pt_add_trim_l[1]);
      chainXy.push(toothPointGlobal(x_loc, y_loc, phi));
    }

    // Right fillet (reversed)
    for (let k = addFillet.fillet.length - 1; k >= 0; k--) {
      const [x_loc, y_loc] = addFillet.fillet[k];
      chainXy.push(toothPointGlobal(x_loc, y_loc, phi));
    }

    // Right flank
    for (const [xr, yr] of rightFlank) {
      chainXy.push(toothPointGlobal(xr, yr, phi));
    }

    // Right root fillet
    for (const [x_loc, y_loc] of fillet_root_right) {
      chainXy.push(toothPointGlobal(x_loc, y_loc, phi));
    }

    // Dedendum arc (linear interpolation)
    const [xD, yD] = toothPointGlobal(pt_D[0], pt_D[1], phi);
    const [xDp, yDp] = toothPointGlobal(pt_Dp[0], pt_Dp[1], phi_next);

    for (let j = 1; j <= n_ded_arc; j++) {
      const frac = j / n_ded_arc;
      const x_arc = xD + frac * (xDp - xD);
      const y_arc = yD + frac * (yDp - yD);
      chainXy.push([x_arc, y_arc]);
    }
  }

  return {
    chain_xy: chainXy,
    rp,
    rm,
    w0,
    ds,
    s: result.s,
    t: result.t,
    ha,
    hf,
    z_f,
  };
}

/**
 * Build the full circular spline (internal gear) from the smoothed conjugate flank.
 * Exact port of Python build_full_circular_spline() function from Harmonic DCT Calc.
 *
 * Uses the pre-computed smoothed_flank (one side of the conjugate tooth
 * in tooth-local coords where y_local = y_g - rp_c) and mirrors it to
 * form a complete tooth, then repeats z_c times with dedendum arc
 * connections.
 *
 * @param params - Gear parameters dict
 * @param smoothedFlank - List of (x, y_local) for one flank, sorted addendum→dedendum (y descending)
 * @param rp_c - Circular spline pitch radius
 * @param n_ded_arc - Number of interpolation points per dedendum arc
 * @param r_fillet_add - Addendum-side fillet radius
 * @param r_fillet_ded - Dedendum-side fillet radius (defaults to r_fillet_add)
 *
 * @returns Object with chain_xy (continuous outline), rp_c, r_add, r_ded, ha, hf, z_c
 *          Or { error: msg } on failure.
 */
export function buildFullCircularSpline(
  params: GearParams,
  smoothedFlank: PointTuple[],
  rp_c: number,
  n_ded_arc: number = 39,
  r_fillet_add: number = 0.2,
  r_fillet_ded: number | null = null
): {
  chain_xy: PointTuple[];
  rp_c: number;
  r_add: number;
  r_ded: number;
  ha: number;
  hf: number;
  z_c: number;
  error?: string;
} {
  if (smoothedFlank.length < 2) {
    return {
      chain_xy: [],
      rp_c,
      r_add: rp_c,
      r_ded: rp_c,
      ha: params.ha,
      hf: params.hf,
      z_c: Math.floor(params.z_c),
      error: "Smoothed flank too short to pattern.",
    };
  }

  // Extract parameters (matching Python exactly)
  const z_c = Math.floor(params.z_c);
  const m = params.m;
  const z_f = params.z_f;
  const ha = params.ha;
  const hf = params.hf;

  // Compute s and t from coefficient inputs (matching Python)
  const mu_s = params.mu_s;
  const mu_t = params.mu_t;
  const s = mu_s * m * z_f;
  const t = mu_t * s;
  const ds = s - t / 2.0;

  // Right flank: addendum (top) -> dedendum (bottom), y descending
  const right_flank_raw = [...smoothedFlank];

  if (r_fillet_ded === null) r_fillet_ded = r_fillet_add;
  r_fillet_add = Math.max(0.0, r_fillet_add);
  r_fillet_ded = Math.max(0.0, r_fillet_ded);

  // Helper: compute circle passing through 3 points (local to this function like Python)
  function _circleFrom3Pts(p1: PointTuple, p2: PointTuple, p3: PointTuple): { cx: number; cy: number; r: number } | null {
    const [x1, y1] = p1;
    const [x2, y2] = p2;
    const [x3, y3] = p3;
    const d = 2.0 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
    if (Math.abs(d) < 1e-12) return null;
    const ux = ((x1 * x1 + y1 * y1) * (y2 - y3) +
                (x2 * x2 + y2 * y2) * (y3 - y1) +
                (x3 * x3 + y3 * y3) * (y1 - y2)) / d;
    const uy = ((x1 * x1 + y1 * y1) * (x3 - x2) +
                (x2 * x2 + y2 * y2) * (x1 - x3) +
                (x3 * x3 + y3 * y3) * (x2 - x1)) / d;
    return { cx: ux, cy: uy, r: Math.sqrt((x1 - ux) ** 2 + (y1 - uy) ** 2) };
  }

  // Helper: generate arc points (local to this function like Python)
  function _shortArc(startAngle: number, endAngle: number, nPts: number, cx: number, cy: number, radius: number): PointTuple[] {
    let dTheta = endAngle - startAngle;
    if (dTheta > Math.PI) dTheta -= 2.0 * Math.PI;
    else if (dTheta < -Math.PI) dTheta += 2.0 * Math.PI;
    const pts: PointTuple[] = [];
    for (let k = 0; k <= nPts; k++) {
      const frac = k / nPts;
      const th = startAngle + frac * dTheta;
      pts.push([cx + radius * Math.cos(th), cy + radius * Math.sin(th)]);
    }
    return pts;
  }

  let use_fillets = false;
  let right_flank: PointTuple[] = [...right_flank_raw];
  const y_add = right_flank_raw[0][1];
  const y_ded = right_flank_raw[right_flank_raw.length - 1][1];
  let pt_add_trim_r: PointTuple = right_flank_raw[0];
  let pt_add_trim_l: PointTuple = [-pt_add_trim_r[0], pt_add_trim_r[1]];
  let pt_ded_trim_r: PointTuple = right_flank_raw[right_flank_raw.length - 1];
  let pt_ded_trim_l: PointTuple = [-pt_ded_trim_r[0], pt_ded_trim_r[1]];
  let fillet_right: PointTuple[] = [];
  let fillet_left: PointTuple[] = [];
  let fillet_root_right: PointTuple[] = [];
  let fillet_root_left: PointTuple[] = [];

  // Try to compute fillets if we have enough points
  if (right_flank_raw.length >= 6 && r_fillet_add > 0.0 && r_fillet_ded > 0.0) {
    const top_circle = _circleFrom3Pts(right_flank_raw[0], right_flank_raw[1], right_flank_raw[2]);
    const bot_circle = _circleFrom3Pts(
      right_flank_raw[right_flank_raw.length - 3],
      right_flank_raw[right_flank_raw.length - 2],
      right_flank_raw[right_flank_raw.length - 1]
    );

    if (top_circle !== null && bot_circle !== null) {
      const { cx: x1_R, cy: y1_R, r: r1 } = top_circle;
      const { cx: x2_R, cy: y2_R, r: r2 } = bot_circle;

      // Addendum fillet
      const cy_fillet = y_add - r_fillet_add;
      const dy = cy_fillet - y1_R;
      const r_inner = Math.max(r1 - r_fillet_add, 0.0);
      const dx_sq = r_inner * r_inner - dy * dy;

      if (dx_sq >= 0.0) {
        // Determine fillet center position based on arc center relative to profile
        // If arc center is LEFT of profile point, fillet goes to the right (+)
        // If arc center is RIGHT of profile point, fillet goes to the left (-)
        const profile_x_top = right_flank_raw[0][0];
        const cx_fillet = x1_R < profile_x_top
          ? x1_R + Math.sqrt(dx_sq)
          : x1_R - Math.sqrt(dx_sq);

        const dist_to_fillet = Math.sqrt((cx_fillet - x1_R) ** 2 + (cy_fillet - y1_R) ** 2);

        if (dist_to_fillet > 1e-9) {
          const dir_x = (cx_fillet - x1_R) / dist_to_fillet;
          const dir_y = (cy_fillet - y1_R) / dist_to_fillet;
          const pt_AB_trim: PointTuple = [x1_R + r1 * dir_x, y1_R + r1 * dir_y];
          pt_add_trim_r = [cx_fillet, y_add];

          // Dedendum fillet
          const cy_root = y_ded + r_fillet_ded;
          const dy_root = cy_root - y2_R;
          const r_inner_root = Math.max(r2 - r_fillet_ded, 0.0);
          const dx_root_sq = r_inner_root * r_inner_root - dy_root * dy_root;

          if (dx_root_sq >= 0.0) {
            // Determine fillet center position based on arc center relative to profile
            // If arc center is RIGHT of profile point, fillet goes to the left (-)
            // If arc center is LEFT of profile point, fillet goes to the right (+)
            const profile_x_bot = right_flank_raw[right_flank_raw.length - 1][0];
            const cx_root = x2_R > profile_x_bot
              ? x2_R - Math.sqrt(dx_root_sq)
              : x2_R + Math.sqrt(dx_root_sq);

            const dist_to_root = Math.sqrt((cx_root - x2_R) ** 2 + (cy_root - y2_R) ** 2);

            if (dist_to_root > 1e-9) {
              const dir_x_root = (cx_root - x2_R) / dist_to_root;
              const dir_y_root = (cy_root - y2_R) / dist_to_root;
              const pt_CD_trim: PointTuple = [x2_R + r2 * dir_x_root, y2_R + r2 * dir_y_root];
              pt_ded_trim_r = [cx_root, y_ded];

              // Generate fillet arcs first, then find where they intersect the profile
              const n_fillet = 12;

              // Generate addendum fillet arc (from addendum line down into tooth)
              const th_add_line = Math.atan2(pt_add_trim_r[1] - cy_fillet, pt_add_trim_r[0] - cx_fillet);
              // Extend arc further than needed to find intersection
              const th_add_extend = th_add_line - Math.PI / 2;  // 90 degrees past addendum
              const fillet_arc_full = _shortArc(th_add_extend, th_add_line, n_fillet * 2, cx_fillet, cy_fillet, r_fillet_add);

              // Find where fillet arc intersects/meets the profile (closest approach)
              let best_fillet_idx = 0;
              let best_profile_idx = 0;
              let best_dist = Infinity;
              for (let fi = 0; fi < fillet_arc_full.length; fi++) {
                const fpt = fillet_arc_full[fi];
                for (let pi = 0; pi < right_flank_raw.length; pi++) {
                  const ppt = right_flank_raw[pi];
                  const d = Math.sqrt((fpt[0] - ppt[0]) ** 2 + (fpt[1] - ppt[1]) ** 2);
                  if (d < best_dist) {
                    best_dist = d;
                    best_fillet_idx = fi;
                    best_profile_idx = pi;
                  }
                }
              }

              // Trim profile: keep points from intersection down (lower y values)
              // Profile is ordered top to bottom (y descending)
              const right_flank_trimmed_top = right_flank_raw.slice(best_profile_idx);

              // The fillet starts at the intersection point and goes to addendum
              const fillet_start_pt = fillet_arc_full[best_fillet_idx];
              const th0 = Math.atan2(fillet_start_pt[1] - cy_fillet, fillet_start_pt[0] - cx_fillet);
              const th1 = Math.atan2(pt_add_trim_r[1] - cy_fillet, pt_add_trim_r[0] - cx_fillet);
              fillet_right = _shortArc(th0, th1, n_fillet, cx_fillet, cy_fillet, r_fillet_add);
              fillet_left = fillet_right.map(([x, y]): PointTuple => [-x, y]);

              // Generate dedendum fillet arc using closest-approach like addendum
              // The fillet center is at (cx_root, cy_root), dedendum point at (cx_root, y_ded)
              // Arc needs to sweep from dedendum toward the profile (which is above and to the side)
              const th_ded_line = Math.atan2(pt_ded_trim_r[1] - cy_root, pt_ded_trim_r[0] - cx_root);
              // Extend arc in BOTH directions to ensure we find intersection
              const th_ded_extend_cw = th_ded_line - Math.PI / 2;
              const th_ded_extend_ccw = th_ded_line + Math.PI / 2;
              const fillet_root_arc_cw = _shortArc(th_ded_line, th_ded_extend_cw, n_fillet * 2, cx_root, cy_root, r_fillet_ded);
              const fillet_root_arc_ccw = _shortArc(th_ded_line, th_ded_extend_ccw, n_fillet * 2, cx_root, cy_root, r_fillet_ded);

              // Find where dedendum fillet arc intersects/meets the profile (closest approach)
              // Check both directions and pick the one with better intersection
              let best_root_fillet_idx = 0;
              let best_root_profile_idx = right_flank_trimmed_top.length - 1;
              let best_root_dist = Infinity;
              let use_ccw = false;

              for (let fi = 0; fi < fillet_root_arc_cw.length; fi++) {
                const fpt = fillet_root_arc_cw[fi];
                for (let pi = 0; pi < right_flank_trimmed_top.length; pi++) {
                  const ppt = right_flank_trimmed_top[pi];
                  const d = Math.sqrt((fpt[0] - ppt[0]) ** 2 + (fpt[1] - ppt[1]) ** 2);
                  if (d < best_root_dist) {
                    best_root_dist = d;
                    best_root_fillet_idx = fi;
                    best_root_profile_idx = pi;
                    use_ccw = false;
                  }
                }
              }
              for (let fi = 0; fi < fillet_root_arc_ccw.length; fi++) {
                const fpt = fillet_root_arc_ccw[fi];
                for (let pi = 0; pi < right_flank_trimmed_top.length; pi++) {
                  const ppt = right_flank_trimmed_top[pi];
                  const d = Math.sqrt((fpt[0] - ppt[0]) ** 2 + (fpt[1] - ppt[1]) ** 2);
                  if (d < best_root_dist) {
                    best_root_dist = d;
                    best_root_fillet_idx = fi;
                    best_root_profile_idx = pi;
                    use_ccw = true;
                  }
                }
              }

              const chosen_arc = use_ccw ? fillet_root_arc_ccw : fillet_root_arc_cw;

              // Trim profile: keep points from top down to intersection
              // Safety: ensure we keep at least half the profile
              const min_keep = Math.max(3, Math.floor(right_flank_trimmed_top.length / 2));
              const trim_idx = Math.max(best_root_profile_idx + 1, min_keep);
              right_flank = right_flank_trimmed_top.slice(0, trim_idx);

              // The root fillet goes from intersection point down to dedendum
              const fillet_root_intersect_pt = chosen_arc[best_root_fillet_idx];
              const tr0 = Math.atan2(fillet_root_intersect_pt[1] - cy_root, fillet_root_intersect_pt[0] - cx_root);
              const tr1 = Math.atan2(pt_ded_trim_r[1] - cy_root, pt_ded_trim_r[0] - cx_root);
              fillet_root_right = _shortArc(tr0, tr1, n_fillet, cx_root, cy_root, r_fillet_ded);
              fillet_root_left = fillet_root_right.slice().reverse().map(([x, y]): PointTuple => [-x, y]);

              pt_add_trim_l = [-pt_add_trim_r[0], pt_add_trim_r[1]];
              pt_ded_trim_l = [-pt_ded_trim_r[0], pt_ded_trim_r[1]];
              use_fillets = true;
            }
          }
        }
      }
    }
  }

  // Left flank: mirror and reverse (dedendum -> addendum)
  const left_flank: PointTuple[] = right_flank.slice().reverse().map(([x, y]): PointTuple => [-x, y]);

  // Angular pitch
  const pitch_angle = 2.0 * Math.PI / z_c;

  function local_to_polar(x_loc: number, y_loc: number, tooth_offset_angle: number): PointTuple {
    const r = rp_c + y_loc;
    const theta = x_loc / rp_c + tooth_offset_angle;
    return [r * Math.sin(theta), r * Math.cos(theta)];
  }

  // Use actual fillet endpoints for dedendum arc connection (fixes discontinuity)
  // When fillets are used, the dedendum arc must connect from the actual last point
  // of fillet_root_right to the actual first point of fillet_root_left
  let pt_D: PointTuple;
  let pt_Dp: PointTuple;

  if (use_fillets && fillet_root_right.length > 0) {
    // Use actual fillet endpoints
    pt_D = fillet_root_right[fillet_root_right.length - 1];
    pt_Dp = fillet_root_left[0];
  } else {
    pt_D = right_flank[right_flank.length - 1];
    pt_Dp = left_flank[0];
  }

  // Dedendum radius based on actual endpoint (not theoretical y_ded)
  const r_ded = rp_c + pt_D[1];
  const theta_D = pt_D[0] / rp_c;
  const theta_Dp = pt_Dp[0] / rp_c;

  const chain_xy: PointTuple[] = [];

  for (let i = 0; i < z_c; i++) {
    const angle_i = i * pitch_angle;

    // Left root fillet (if using fillets)
    if (use_fillets) {
      for (const [x_loc, y_loc] of fillet_root_left) {
        chain_xy.push(local_to_polar(x_loc, y_loc, angle_i));
      }
    }

    // Left flank: D' -> A' (dedendum up to addendum)
    for (const [x_loc, y_loc] of left_flank) {
      chain_xy.push(local_to_polar(x_loc, y_loc, angle_i));
    }

    if (use_fillets) {
      // Left fillet
      for (const [x_loc, y_loc] of fillet_left) {
        chain_xy.push(local_to_polar(x_loc, y_loc, angle_i));
      }

      // Addendum line
      for (let j = 1; j < n_ded_arc; j++) {
        const frac = j / n_ded_arc;
        const x_add = pt_add_trim_l[0] + frac * (pt_add_trim_r[0] - pt_add_trim_l[0]);
        const y_add_seg = pt_add_trim_l[1] + frac * (pt_add_trim_r[1] - pt_add_trim_l[1]);
        chain_xy.push(local_to_polar(x_add, y_add_seg, angle_i));
      }

      // Right fillet (reversed)
      for (let k = fillet_right.length - 1; k >= 0; k--) {
        const [x_loc, y_loc] = fillet_right[k];
        chain_xy.push(local_to_polar(x_loc, y_loc, angle_i));
      }
    }

    // Right flank: A -> D (addendum down to dedendum)
    for (const [x_loc, y_loc] of right_flank) {
      chain_xy.push(local_to_polar(x_loc, y_loc, angle_i));
    }

    // Right root fillet (if using fillets)
    if (use_fillets) {
      for (const [x_loc, y_loc] of fillet_root_right) {
        chain_xy.push(local_to_polar(x_loc, y_loc, angle_i));
      }
    }

    // Dedendum arc: D of tooth i -> D' of tooth i+1
    const next_i = (i + 1) % z_c;
    const angle_next = next_i * pitch_angle;
    let theta_start = theta_D + angle_i;
    let theta_end = theta_Dp + angle_next;

    if (theta_end < theta_start) {
      theta_end += 2.0 * Math.PI;
    }

    for (let j = 1; j <= n_ded_arc; j++) {
      const frac = j / n_ded_arc;
      const th = theta_start + frac * (theta_end - theta_start);
      chain_xy.push([r_ded * Math.sin(th), r_ded * Math.cos(th)]);
    }
  }

  // Reference radii
  const r_add = rp_c + y_add;

  return {
    chain_xy,
    rp_c,
    r_add,
    r_ded,
    ha,
    hf,
    z_c,
  };
}

/**
 * Build full flexspline with dmax_x and dmax_y applied.
 * Matches Python build_dmax_deformed_flexspline exactly.
 * dmax_x: shifts tooth flanks inward (reduces tooth thickness)
 * dmax_y: lowers addendum (reduces tooth height)
 */
export function buildDmaxFullFlexspline(
  params: GearParams,
  dmax_x: number,
  dmax_y: number,
  n_ded_arc: number = 39,
  r_fillet_add: number = 0.2,
  r_fillet_ded: number | null = null,
  smooth: number = 0.0
): FullGearResult {
  const result = computeProfile(params);
  if (result.error) {
    return { error: result.error } as FullGearResult;
  }

  const { m, ha, hf } = params;
  const z_f = Math.floor(params.z_f);
  const rp = m * z_f / 2.0;
  const ds = result.ds;
  const rm = result.rm;
  const { x1_R, y1_R, r1, x2_R, y2_R, r2 } = result;

  if (r_fillet_ded === null) r_fillet_ded = r_fillet_add;

  // Apply dmax_x to all profile segments
  const pts_AB = applyDmaxX(result.pts_AB, dmax_x);
  const pts_BC = applyDmaxX(result.pts_BC, dmax_x);
  const pts_CD = applyDmaxX(result.pts_CD, dmax_x);

  // Adjust circle centers for dmax_x
  const x1_R_mod = dmax_x > 0 ? x1_R - dmax_x : x1_R;
  const x2_R_mod = dmax_x > 0 ? x2_R - dmax_x : x2_R;

  // Addendum height - LOWERED by dmax_y
  const y_add = ds + hf + ha - dmax_y;
  const y_ded = ds;

  // ===== ADDENDUM FILLET (with dmax_y) =====
  const cy_fillet = y_add - r_fillet_add;
  const dy = cy_fillet - y1_R;
  const r_inner = r1 - r_fillet_add;
  let dx_sq = r_inner * r_inner - dy * dy;
  if (dx_sq < 0) dx_sq = 0;
  const cx_fillet = x1_R_mod + Math.sqrt(dx_sq);

  // Tangent point on AB arc
  const dist_to_fillet = Math.sqrt((cx_fillet - x1_R_mod) ** 2 + (cy_fillet - y1_R) ** 2);
  let dir_x: number, dir_y: number;
  if (dist_to_fillet > 1e-9) {
    dir_x = (cx_fillet - x1_R_mod) / dist_to_fillet;
    dir_y = (cy_fillet - y1_R) / dist_to_fillet;
  } else {
    dir_x = 1;
    dir_y = 0;
  }
  const pt_AB_trim: PointTuple = [x1_R_mod + r1 * dir_x, y1_R + r1 * dir_y];
  const pt_add_trim_r: PointTuple = [cx_fillet, y_add];

  // Generate addendum fillet arc
  const n_fillet = 12;
  const theta_add_start = Math.atan2(pt_AB_trim[1] - cy_fillet, pt_AB_trim[0] - cx_fillet);
  const theta_add_end = Math.atan2(pt_add_trim_r[1] - cy_fillet, pt_add_trim_r[0] - cx_fillet);
  let d_theta_add = theta_add_end - theta_add_start;
  if (d_theta_add > Math.PI) d_theta_add -= 2 * Math.PI;
  else if (d_theta_add < -Math.PI) d_theta_add += 2 * Math.PI;

  const fillet_right: PointTuple[] = [];
  for (let i = 0; i <= n_fillet; i++) {
    const frac = i / n_fillet;
    const theta = theta_add_start + frac * d_theta_add;
    fillet_right.push([cx_fillet + r_fillet_add * Math.cos(theta), cy_fillet + r_fillet_add * Math.sin(theta)]);
  }
  const fillet_left: PointTuple[] = fillet_right.map(([x, y]): PointTuple => [-x, y]);
  const pt_add_trim_l: PointTuple = [-pt_add_trim_r[0], pt_add_trim_r[1]];

  // Trim AB points
  const angle_trim = Math.atan2(pt_AB_trim[1] - y1_R, pt_AB_trim[0] - x1_R_mod);
  const pts_AB_trimmed: PointTuple[] = [];
  for (const pt of pts_AB) {
    const angle_pt = Math.atan2(pt[1] - y1_R, pt[0] - x1_R_mod);
    if (angle_pt <= angle_trim + 1e-9) {
      pts_AB_trimmed.push(pt);
    }
  }
  if (pts_AB_trimmed.length > 0) {
    const first_pt = pts_AB_trimmed[0];
    const dist = Math.sqrt((first_pt[0] - pt_AB_trim[0]) ** 2 + (first_pt[1] - pt_AB_trim[1]) ** 2);
    if (dist > 1e-6) {
      pts_AB_trimmed.unshift(pt_AB_trim);
    }
  } else {
    pts_AB_trimmed.push(pt_AB_trim);
  }

  // ===== DEDENDUM FILLET (with dmax_x) =====
  const cy_root = y_ded + r_fillet_ded;
  const dy_root = cy_root - y2_R;
  const r_inner_root = Math.max(r2 - r_fillet_ded, 0);
  let dx_root_sq = r_inner_root * r_inner_root - dy_root * dy_root;
  if (dx_root_sq < 0) dx_root_sq = 0;
  const cx_root = x2_R_mod - Math.sqrt(dx_root_sq);

  // Tangent point on CD arc
  const dist_to_root = Math.sqrt((cx_root - x2_R_mod) ** 2 + (cy_root - y2_R) ** 2);
  let dir_x_root: number, dir_y_root: number;
  if (dist_to_root > 1e-9) {
    dir_x_root = (cx_root - x2_R_mod) / dist_to_root;
    dir_y_root = (cy_root - y2_R) / dist_to_root;
  } else {
    dir_x_root = 1;
    dir_y_root = 0;
  }
  const pt_CD_trim: PointTuple = [x2_R_mod + r2 * dir_x_root, y2_R + r2 * dir_y_root];
  const pt_ded_trim_r: PointTuple = [cx_root, y_ded];
  const pt_ded_trim_l: PointTuple = [-pt_ded_trim_r[0], pt_ded_trim_r[1]];

  // Generate dedendum fillet arc
  const theta_root_start = Math.atan2(pt_CD_trim[1] - cy_root, pt_CD_trim[0] - cx_root);
  const theta_root_end = Math.atan2(pt_ded_trim_r[1] - cy_root, pt_ded_trim_r[0] - cx_root);
  let d_theta_root = theta_root_end - theta_root_start;
  if (d_theta_root > Math.PI) d_theta_root -= 2 * Math.PI;
  else if (d_theta_root < -Math.PI) d_theta_root += 2 * Math.PI;

  const fillet_root_right: PointTuple[] = [];
  for (let i = 0; i <= n_fillet; i++) {
    const frac = i / n_fillet;
    const theta = theta_root_start + frac * d_theta_root;
    fillet_root_right.push([cx_root + r_fillet_ded * Math.cos(theta), cy_root + r_fillet_ded * Math.sin(theta)]);
  }
  const fillet_root_left: PointTuple[] = fillet_root_right.slice().reverse().map(([x, y]): PointTuple => [-x, y]);

  // Trim CD points
  const angle_cd_trim = Math.atan2(pt_CD_trim[1] - y2_R, pt_CD_trim[0] - x2_R_mod);
  const pts_CD_trimmed: PointTuple[] = [];
  for (const pt of pts_CD) {
    const angle_pt = Math.atan2(pt[1] - y2_R, pt[0] - x2_R_mod);
    if (angle_pt <= angle_cd_trim + 1e-9) {
      pts_CD_trimmed.push(pt);
    }
  }
  if (pts_CD_trimmed.length > 0) {
    const last_pt = pts_CD_trimmed[pts_CD_trimmed.length - 1];
    const dist = Math.sqrt((last_pt[0] - pt_CD_trim[0]) ** 2 + (last_pt[1] - pt_CD_trim[1]) ** 2);
    if (dist > 1e-6) {
      pts_CD_trimmed.push(pt_CD_trim);
    }
  } else {
    pts_CD_trimmed.push(pt_CD_trim);
  }

  // Build flank
  let rightFlank: PointTuple[] = [...pts_AB_trimmed, ...pts_BC, ...pts_CD_trimmed];

  if (smooth > 0) {
    rightFlank.sort((a, b) => b[1] - a[1]);
    rightFlank = smoothBranch(rightFlank, smooth, 200);
  }

  const leftFlank: PointTuple[] = rightFlank.slice().reverse().map(([x, y]): PointTuple => [-x, y]);

  // Dedendum radius
  const r_ded = rm + ds;

  // Angular pitch
  const pitch_angle = (2.0 * Math.PI) / z_f;

  // Angular positions of dedendum trim points
  const theta_D = pt_ded_trim_r[0] / rp;
  const theta_Dp = pt_ded_trim_l[0] / rp;

  function localToPolar(x_loc: number, y_loc: number, tooth_offset_angle: number): PointTuple {
    const r = rm + y_loc;
    const theta = x_loc / rp + tooth_offset_angle;
    return [r * Math.sin(theta), r * Math.cos(theta)];
  }

  const chainXy: PointTuple[] = [];

  for (let i = 0; i < z_f; i++) {
    const angle_i = i * pitch_angle;

    // Left root fillet
    for (const [x_loc, y_loc] of fillet_root_left) {
      chainXy.push(localToPolar(x_loc, y_loc, angle_i));
    }

    // Left flank
    for (const [x_loc, y_loc] of leftFlank) {
      chainXy.push(localToPolar(x_loc, y_loc, angle_i));
    }

    // Left fillet
    for (const [x_loc, y_loc] of fillet_left) {
      chainXy.push(localToPolar(x_loc, y_loc, angle_i));
    }

    // Addendum line
    for (let j = 1; j < n_ded_arc; j++) {
      const frac = j / n_ded_arc;
      const x_loc = pt_add_trim_l[0] + frac * (pt_add_trim_r[0] - pt_add_trim_l[0]);
      const y_loc = pt_add_trim_l[1] + frac * (pt_add_trim_r[1] - pt_add_trim_l[1]);
      chainXy.push(localToPolar(x_loc, y_loc, angle_i));
    }

    // Right fillet (reversed)
    for (let k = fillet_right.length - 1; k >= 0; k--) {
      chainXy.push(localToPolar(fillet_right[k][0], fillet_right[k][1], angle_i));
    }

    // Right flank
    for (const [x_loc, y_loc] of rightFlank) {
      chainXy.push(localToPolar(x_loc, y_loc, angle_i));
    }

    // Right root fillet
    for (const [x_loc, y_loc] of fillet_root_right) {
      chainXy.push(localToPolar(x_loc, y_loc, angle_i));
    }

    // Dedendum arc to next tooth
    const next_i = (i + 1) % z_f;
    const angle_next = next_i * pitch_angle;
    let theta_start = theta_D + angle_i;
    let theta_end = theta_Dp + angle_next;

    if (theta_end < theta_start) {
      theta_end += 2.0 * Math.PI;
    }

    for (let j = 1; j <= n_ded_arc; j++) {
      const frac = j / n_ded_arc;
      const th = theta_start + frac * (theta_end - theta_start);
      chainXy.push([r_ded * Math.sin(th), r_ded * Math.cos(th)]);
    }
  }

  return {
    chain_xy: chainXy,
    rp,
    rm,
    ds,
    s: result.s,
    t: result.t,
    ha: ha - dmax_y,
    hf,
    z_f,
  };
}

/**
 * Build deformed flexspline with dmax_x and dmax_y applied.
 * Matches Python build_dmax_deformed_flexspline exactly.
 */
export function buildDmaxDeformedFlexspline(
  params: GearParams,
  dmax_x: number,
  dmax_y: number,
  n_ded_arc: number = 39,
  r_fillet_add: number = 0.2,
  r_fillet_ded: number | null = null,
  smooth: number = 0.0
): FullGearResult {
  const result = computeProfile(params);
  if (result.error) {
    return { error: result.error } as FullGearResult;
  }

  const { m, w0, ha, hf } = params;
  const z_f = Math.floor(params.z_f);
  const rp = m * z_f / 2.0;
  const rm = result.rm;
  const ds = result.ds;
  const { x1_R, y1_R, r1, x2_R, y2_R, r2 } = result;

  if (r_fillet_ded === null) r_fillet_ded = r_fillet_add;

  // Apply dmax_x to all profile segments
  const pts_AB = applyDmaxX(result.pts_AB, dmax_x);
  const pts_BC = applyDmaxX(result.pts_BC, dmax_x);
  const pts_CD = applyDmaxX(result.pts_CD, dmax_x);

  // Adjust circle centers for dmax_x
  const x1_R_mod = dmax_x > 0 ? x1_R - dmax_x : x1_R;
  const x2_R_mod = dmax_x > 0 ? x2_R - dmax_x : x2_R;

  // Addendum height - LOWERED by dmax_y
  const y_add = ds + hf + ha - dmax_y;
  const y_ded = ds;

  // ===== ADDENDUM FILLET (with dmax_y) =====
  const cy_fillet = y_add - r_fillet_add;
  const dy = cy_fillet - y1_R;
  const r_inner = r1 - r_fillet_add;
  let dx_sq = r_inner * r_inner - dy * dy;
  if (dx_sq < 0) dx_sq = 0;
  const cx_fillet = x1_R_mod + Math.sqrt(dx_sq);

  const dist_to_fillet = Math.sqrt((cx_fillet - x1_R_mod) ** 2 + (cy_fillet - y1_R) ** 2);
  let dir_x: number, dir_y: number;
  if (dist_to_fillet > 1e-9) {
    dir_x = (cx_fillet - x1_R_mod) / dist_to_fillet;
    dir_y = (cy_fillet - y1_R) / dist_to_fillet;
  } else {
    dir_x = 1;
    dir_y = 0;
  }
  const pt_AB_trim: PointTuple = [x1_R_mod + r1 * dir_x, y1_R + r1 * dir_y];
  const pt_add_trim_r: PointTuple = [cx_fillet, y_add];

  const n_fillet = 12;
  const theta_add_start = Math.atan2(pt_AB_trim[1] - cy_fillet, pt_AB_trim[0] - cx_fillet);
  const theta_add_end = Math.atan2(pt_add_trim_r[1] - cy_fillet, pt_add_trim_r[0] - cx_fillet);
  let d_theta_add = theta_add_end - theta_add_start;
  if (d_theta_add > Math.PI) d_theta_add -= 2 * Math.PI;
  else if (d_theta_add < -Math.PI) d_theta_add += 2 * Math.PI;

  const fillet_right: PointTuple[] = [];
  for (let i = 0; i <= n_fillet; i++) {
    const frac = i / n_fillet;
    const theta = theta_add_start + frac * d_theta_add;
    fillet_right.push([cx_fillet + r_fillet_add * Math.cos(theta), cy_fillet + r_fillet_add * Math.sin(theta)]);
  }
  const fillet_left: PointTuple[] = fillet_right.map(([x, y]): PointTuple => [-x, y]);
  const pt_add_trim_l: PointTuple = [-pt_add_trim_r[0], pt_add_trim_r[1]];

  // Trim AB points
  const angle_trim = Math.atan2(pt_AB_trim[1] - y1_R, pt_AB_trim[0] - x1_R_mod);
  const pts_AB_trimmed: PointTuple[] = [];
  for (const pt of pts_AB) {
    const angle_pt = Math.atan2(pt[1] - y1_R, pt[0] - x1_R_mod);
    if (angle_pt <= angle_trim + 1e-9) {
      pts_AB_trimmed.push(pt);
    }
  }
  if (pts_AB_trimmed.length > 0) {
    const first_pt = pts_AB_trimmed[0];
    const dist = Math.sqrt((first_pt[0] - pt_AB_trim[0]) ** 2 + (first_pt[1] - pt_AB_trim[1]) ** 2);
    if (dist > 1e-6) {
      pts_AB_trimmed.unshift(pt_AB_trim);
    }
  } else {
    pts_AB_trimmed.push(pt_AB_trim);
  }

  // ===== DEDENDUM FILLET (with dmax_x) =====
  const cy_root = y_ded + r_fillet_ded;
  const dy_root = cy_root - y2_R;
  const r_inner_root = Math.max(r2 - r_fillet_ded, 0);
  let dx_root_sq = r_inner_root * r_inner_root - dy_root * dy_root;
  if (dx_root_sq < 0) dx_root_sq = 0;
  const cx_root = x2_R_mod - Math.sqrt(dx_root_sq);

  const dist_to_root = Math.sqrt((cx_root - x2_R_mod) ** 2 + (cy_root - y2_R) ** 2);
  let dir_x_root: number, dir_y_root: number;
  if (dist_to_root > 1e-9) {
    dir_x_root = (cx_root - x2_R_mod) / dist_to_root;
    dir_y_root = (cy_root - y2_R) / dist_to_root;
  } else {
    dir_x_root = 1;
    dir_y_root = 0;
  }
  const pt_CD_trim: PointTuple = [x2_R_mod + r2 * dir_x_root, y2_R + r2 * dir_y_root];
  const pt_ded_trim_r: PointTuple = [cx_root, y_ded];
  const pt_ded_trim_l: PointTuple = [-pt_ded_trim_r[0], pt_ded_trim_r[1]];

  const theta_root_start = Math.atan2(pt_CD_trim[1] - cy_root, pt_CD_trim[0] - cx_root);
  const theta_root_end = Math.atan2(pt_ded_trim_r[1] - cy_root, pt_ded_trim_r[0] - cx_root);
  let d_theta_root = theta_root_end - theta_root_start;
  if (d_theta_root > Math.PI) d_theta_root -= 2 * Math.PI;
  else if (d_theta_root < -Math.PI) d_theta_root += 2 * Math.PI;

  const fillet_root_right: PointTuple[] = [];
  for (let i = 0; i <= n_fillet; i++) {
    const frac = i / n_fillet;
    const theta = theta_root_start + frac * d_theta_root;
    fillet_root_right.push([cx_root + r_fillet_ded * Math.cos(theta), cy_root + r_fillet_ded * Math.sin(theta)]);
  }
  const fillet_root_left: PointTuple[] = fillet_root_right.slice().reverse().map(([x, y]): PointTuple => [-x, y]);

  // Trim CD points
  const angle_cd_trim = Math.atan2(pt_CD_trim[1] - y2_R, pt_CD_trim[0] - x2_R_mod);
  const pts_CD_trimmed: PointTuple[] = [];
  for (const pt of pts_CD) {
    const angle_pt = Math.atan2(pt[1] - y2_R, pt[0] - x2_R_mod);
    if (angle_pt <= angle_cd_trim + 1e-9) {
      pts_CD_trimmed.push(pt);
    }
  }
  if (pts_CD_trimmed.length > 0) {
    const last_pt = pts_CD_trimmed[pts_CD_trimmed.length - 1];
    const dist = Math.sqrt((last_pt[0] - pt_CD_trim[0]) ** 2 + (last_pt[1] - pt_CD_trim[1]) ** 2);
    if (dist > 1e-6) {
      pts_CD_trimmed.push(pt_CD_trim);
    }
  } else {
    pts_CD_trimmed.push(pt_CD_trim);
  }

  // Build flank
  let rightFlank: PointTuple[] = [...pts_AB_trimmed, ...pts_BC, ...pts_CD_trimmed];

  if (smooth > 0) {
    rightFlank.sort((a, b) => b[1] - a[1]);
    rightFlank = smoothBranch(rightFlank, smooth, 200);
  }

  const leftFlank: PointTuple[] = rightFlank.slice().reverse().map(([x, y]): PointTuple => [-x, y]);

  const pitch_angle = (2.0 * Math.PI) / z_f;

  function toothPointGlobal(xr: number, yr: number, phi: number): PointTuple {
    const rho = eq14Rho(phi, rm, w0);
    const mu = eq21Mu(phi, w0, rm);
    const phi1 = eq23Phi1(phi, w0, rm);
    const gamma = phi1;
    const psi = eq27Psi(mu, gamma);
    return eq29Transform(xr, yr, psi, rho, gamma);
  }

  const chainXy: PointTuple[] = [];

  for (let i = 0; i < z_f; i++) {
    const phi = i * pitch_angle;
    const next_i = (i + 1) % z_f;
    const phi_next = next_i * pitch_angle;

    // Left root fillet
    for (const [x_loc, y_loc] of fillet_root_left) {
      chainXy.push(toothPointGlobal(x_loc, y_loc, phi));
    }

    // Left flank
    for (const [xr, yr] of leftFlank) {
      chainXy.push(toothPointGlobal(xr, yr, phi));
    }

    // Left fillet
    for (const [x_loc, y_loc] of fillet_left) {
      chainXy.push(toothPointGlobal(x_loc, y_loc, phi));
    }

    // Addendum line
    for (let j = 1; j < n_ded_arc; j++) {
      const frac = j / n_ded_arc;
      const x_loc = pt_add_trim_l[0] + frac * (pt_add_trim_r[0] - pt_add_trim_l[0]);
      const y_loc = pt_add_trim_l[1] + frac * (pt_add_trim_r[1] - pt_add_trim_l[1]);
      chainXy.push(toothPointGlobal(x_loc, y_loc, phi));
    }

    // Right fillet (reversed)
    for (let k = fillet_right.length - 1; k >= 0; k--) {
      chainXy.push(toothPointGlobal(fillet_right[k][0], fillet_right[k][1], phi));
    }

    // Right flank
    for (const [xr, yr] of rightFlank) {
      chainXy.push(toothPointGlobal(xr, yr, phi));
    }

    // Right root fillet
    for (const [x_loc, y_loc] of fillet_root_right) {
      chainXy.push(toothPointGlobal(x_loc, y_loc, phi));
    }

    // Dedendum arc
    const [xD, yD] = toothPointGlobal(pt_ded_trim_r[0], pt_ded_trim_r[1], phi);
    const [xDp, yDp] = toothPointGlobal(pt_ded_trim_l[0], pt_ded_trim_l[1], phi_next);

    for (let j = 1; j <= n_ded_arc; j++) {
      const frac = j / n_ded_arc;
      const x_arc = xD + frac * (xDp - xD);
      const y_arc = yD + frac * (yDp - yD);
      chainXy.push([x_arc, y_arc]);
    }
  }

  return {
    chain_xy: chainXy,
    rp,
    rm,
    w0,
    ds,
    s: result.s,
    t: result.t,
    ha: ha - dmax_y,
    hf,
    z_f,
  };
}

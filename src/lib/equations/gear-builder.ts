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

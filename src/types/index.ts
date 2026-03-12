/**
 * TypeScript interfaces for the Harmonic DCT Tooth Calculator
 */

export interface GearParams {
  m: number;      // Module (mm)
  z_f: number;    // Number of flexspline teeth
  z_c: number;    // Number of circular spline teeth
  w0: number;     // Max radial deformation (mm)
  r1: number;     // Convex arc radius (mm)
  c1: number;     // O1 x-offset (mm)
  e1: number;     // O1 y-offset (mm)
  r2: number;     // Concave arc radius (mm)
  c2: number;     // O2 x-offset (mm)
  e2: number;     // O2 y-offset (mm)
  ha: number;     // Addendum height (mm)
  hf: number;     // Dedendum height (mm)
  mu_s: number;   // Ring wall coefficient
  mu_t: number;   // Cup wall coefficient
}

export interface Point2D {
  x: number;
  y: number;
}

export type PointTuple = [number, number];

export interface ProfileResult {
  rp: number;     // Pitch radius
  rm: number;     // Neutral layer radius
  ds: number;     // Distance from dedendum to neutral layer
  s: number;      // Ring wall thickness
  t: number;      // Cup wall thickness
  alpha: number;  // Start angle (rad)
  delta: number;  // Tangent angle (rad)
  x1_R: number;   // O1 x-coordinate
  y1_R: number;   // O1 y-coordinate
  x2_R: number;   // O2 x-coordinate
  y2_R: number;   // O2 y-coordinate
  r1: number;     // Convex arc radius
  r2: number;     // Concave arc radius
  l1: number;     // Arc length to point B
  l2: number;     // Arc length to point C
  l3: number;     // Total arc length to point D
  h1: number;     // Vertical distance B to C
  pts_AB: PointTuple[];   // Convex arc points
  pts_BC: PointTuple[];   // Tangent line points
  pts_CD: PointTuple[];   // Concave arc points
  error?: string;
}

export interface ConjugateResult {
  conjugate_pts: PointTuple[];
  branches: PointTuple[][];
  seg_branches: {
    AB: PointTuple[];
    BC: PointTuple[];
    CD: PointTuple[];
  };
  smoothed_flank?: PointTuple[];
  smoothed_seg_branches?: {
    AB: PointTuple[];
    BC: PointTuple[];
    CD: PointTuple[];
  };
  rp_c: number;   // Circular spline pitch radius
  s: number;
  t: number;
  n_pts: number;
  n_branches: number;
  error?: string;
}

export interface ToothOutlineResult {
  tooth_xy: PointTuple[];
  local_outline: PointTuple[];
  right_flank: PointTuple[];
  left_flank: PointTuple[];
  split: number;
  rp: number;
  rm: number;
  ds: number;
  ha: number;
  hf: number;
  error?: string;
}

export interface FullGearResult {
  chain_xy: PointTuple[];
  rp: number;
  rm: number;
  ds: number;
  s: number;
  t: number;
  ha: number;
  hf: number;
  z_f: number;
  w0?: number;
  d_max?: number;
  dmax_x?: number;
  dmax_y?: number;
  error?: string;
}

export interface CircularSplineResult {
  chain_xy: PointTuple[];
  rp_c: number;
  ha_c: number;
  hf_c: number;
  z_c: number;
  error?: string;
}

export interface OutputCategory {
  label: string;
  values: {
    key: string;
    label: string;
    unit?: string;
    precision?: number;
  }[];
}

export type TabId =
  | 'flexspline-tooth'
  | 'conjugate-tooth'
  | 'flexspline-full'
  | 'circular-spline'
  | 'radial-modification'
  | 'longitudinal-modification';

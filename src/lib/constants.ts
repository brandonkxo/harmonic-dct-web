/**
 * Constants and default values from Liu et al. paper
 * "A Novel Rapid Design Framework for Tooth Profile of
 *  Double-Circular-Arc Common-Tangent Flexspline in Harmonic Reducers"
 * Machines 2025, 13, 535.
 */

import type { GearParams } from '@/types';

// Default parameter values from paper (Section 3.5)
// Module m = 0.5 mm, z_f = 100, z_c = 102
export const DEFAULTS: GearParams = {
  m: 0.5,
  z_f: 100,     // Number of flexspline teeth (fixed, not optimized)
  z_c: 102,     // Number of circular spline teeth
  w0: 0.5,      // Max radial deformation omega_0 (mm)
  r1: 0.685,
  c1: 0.332,
  e1: 0.155,
  r2: 0.785,
  c2: 0.330,
  e2: 0.134,
  ha: 0.275,    // Addendum height
  hf: 0.375,    // Dedendum height
  mu_s: 0.01,   // Ring wall coefficient: s = mu_s * m * z_f
  mu_t: 0.6,    // Cup wall coefficient: t = mu_t * s
};

// Display labels for GUI
export const PARAM_LABELS: Record<string, string> = {
  m: 'Module m',
  z_f: 'FlexSpline Teeth',
  z_c: 'CircularSpline Teeth',
  w0: 'Max deform ω₀',
  r1: 'Convex radius r₁',
  c1: 'O₁ x-offset c₁',
  e1: 'O₁ y-offset e₁',
  r2: 'Concave radius r₂',
  c2: 'O₂ x-offset c₂',
  e2: 'O₂ y-offset e₂',
  ha: 'Addendum',
  hf: 'Dedendum',
  mu_s: 'Coeff μₛ (ring)',
  mu_t: 'Coeff μₜ (cup)',
};

// Parameter tooltips for user guidance
export const PARAM_TOOLTIPS: Record<string, string> = {
  m: 'Module - tooth size scaling factor (mm)',
  z_f: 'Number of flexspline teeth (typically 100)',
  z_c: 'Number of circular spline teeth (z_f + 2)',
  w0: 'Maximum radial deformation of wave generator (mm)',
  r1: 'Radius of convex arc AB (mm)',
  c1: 'X-offset of convex arc center O1 (mm)',
  e1: 'Y-offset of convex arc center O1 (mm)',
  r2: 'Radius of concave arc CD (mm)',
  c2: 'X-offset of concave arc center O2 (mm)',
  e2: 'Y-offset of concave arc center O2 (mm)',
  ha: 'Addendum height - tooth tip above pitch circle (mm)',
  hf: 'Dedendum height - tooth root below pitch circle (mm)',
  mu_s: 'Ring wall coefficient: s = mu_s * m * z_f',
  mu_t: 'Cup wall coefficient: t = mu_t * s',
};

// Ordered list of parameter keys for consistent UI ordering
export const PARAM_ORDER: (keyof GearParams)[] = [
  'm', 'z_f', 'z_c', 'w0',
  'r1', 'c1', 'e1',
  'r2', 'c2', 'e2',
  'ha', 'hf',
  'mu_s', 'mu_t'
];

// Parameter groupings for collapsible UI sections
export const PARAM_GROUPS: Record<string, (keyof GearParams)[]> = {
  'Basic Geometry': ['m', 'z_f', 'z_c', 'w0'],
  'Convex Arc (AB)': ['r1', 'c1', 'e1'],
  'Concave Arc (CD)': ['r2', 'c2', 'e2'],
  'Tooth Heights': ['ha', 'hf'],
  'Wall Coefficients': ['mu_s', 'mu_t'],
};

// Integer parameters that should use whole numbers
export const INTEGER_PARAMS = new Set<keyof GearParams>(['z_f', 'z_c']);

// Default fillet radii
export const DEFAULT_FILLET_ADD = 0.15;
export const DEFAULT_FILLET_DED = 0.1;
export const DEFAULT_SMOOTH = 0.1;

// Output categories for the output panel
export const OUTPUT_CATEGORIES = {
  flexspline_tooth: [
    {
      label: 'Wall Thickness',
      values: [
        { key: 's', label: 'Ring Wall (s)', unit: 'mm', precision: 3 },
        { key: 't', label: 'Cup Wall (t)', unit: 'mm', precision: 3 },
        { key: 'ds', label: 'Neutral Offset (ds)', unit: 'mm', precision: 3 },
      ],
    },
    {
      label: 'Angles',
      values: [
        { key: 'alpha', label: 'Alpha (α)', unit: '°', precision: 2 },
        { key: 'delta', label: 'Delta (δ)', unit: '°', precision: 2 },
      ],
    },
    {
      label: 'Arc Lengths',
      values: [
        { key: 'l1', label: 'L1 (AB)', unit: 'mm', precision: 3 },
        { key: 'l2', label: 'L2 (BC)', unit: 'mm', precision: 3 },
        { key: 'l3', label: 'L3 (CD)', unit: 'mm', precision: 3 },
      ],
    },
    {
      label: 'Radii',
      values: [
        { key: 'rp', label: 'Pitch Radius', unit: 'mm', precision: 3 },
        { key: 'rm', label: 'Neutral Radius', unit: 'mm', precision: 3 },
      ],
    },
  ],
  conjugate_tooth: [
    {
      label: 'Conjugate Profile',
      values: [
        { key: 'n_pts', label: 'Total Points', unit: '', precision: 0 },
        { key: 'n_branches', label: 'Branches', unit: '', precision: 0 },
        { key: 'rp_c', label: 'CS Pitch Radius', unit: 'mm', precision: 3 },
      ],
    },
  ],
  flexspline_full: [
    {
      label: 'Gear Geometry',
      values: [
        { key: 'z_f', label: 'Tooth Count', unit: '', precision: 0 },
        { key: 'rp', label: 'Pitch Radius', unit: 'mm', precision: 3 },
        { key: 'rm', label: 'Neutral Radius', unit: 'mm', precision: 3 },
      ],
    },
  ],
  circular_spline: [
    {
      label: 'Circular Spline',
      values: [
        { key: 'z_c', label: 'Tooth Count', unit: '', precision: 0 },
        { key: 'rp_c', label: 'Pitch Radius', unit: 'mm', precision: 3 },
      ],
    },
  ],
} as const;

// Plot colors matching Python app
export const PLOT_COLORS = {
  AB: '#ef4444',       // Red - convex arc
  BC: '#e35000',       // Orange - tangent line
  CD: '#22c55e',       // Green - concave arc
  conjugate: '#f59e0b', // Amber - conjugate profile
  mirror: '#b1b9be',   // Gray - mirrored profile
  addendum: '#f472b6', // Pink - addendum line
  pitch: '#a78bfa',    // Violet - pitch line
  dedendum: '#fb923c', // Orange - dedendum line
  center: '#fbbf24',   // Yellow - circle centers
  deformed: '#06b6d4', // Cyan - deformed gear
  modified: '#8b5cf6', // Purple - modified profile
};

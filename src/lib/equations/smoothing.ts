/**
 * B-spline smoothing for conjugate profile branches
 *
 * Pure TypeScript implementation without scipy dependency.
 * Uses cubic B-spline interpolation.
 */

import type { PointTuple, ConjugateResult } from '@/types';

/**
 * Simple cubic B-spline basis function
 */
function bsplineBasis(t: number): number[] {
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;

  return [
    mt3 / 6,
    (3 * t3 - 6 * t2 + 4) / 6,
    (-3 * t3 + 3 * t2 + 3 * t + 1) / 6,
    t3 / 6,
  ];
}

/**
 * Catmull-Rom spline interpolation for smoother curves
 */
function catmullRomInterpolate(
  p0: PointTuple,
  p1: PointTuple,
  p2: PointTuple,
  p3: PointTuple,
  t: number,
  tension: number = 0.5
): PointTuple {
  const t2 = t * t;
  const t3 = t2 * t;

  const c1 = tension * (p2[0] - p0[0]);
  const c2 = tension * (p2[1] - p0[1]);
  const c3 = tension * (p3[0] - p1[0]);
  const c4 = tension * (p3[1] - p1[1]);

  const x =
    (2 * t3 - 3 * t2 + 1) * p1[0] +
    (t3 - 2 * t2 + t) * c1 +
    (-2 * t3 + 3 * t2) * p2[0] +
    (t3 - t2) * c3;

  const y =
    (2 * t3 - 3 * t2 + 1) * p1[1] +
    (t3 - 2 * t2 + t) * c2 +
    (-2 * t3 + 3 * t2) * p2[1] +
    (t3 - t2) * c4;

  return [x, y];
}

/**
 * Compute cumulative chord lengths for parameterization
 */
function computeChordLengths(pts: PointTuple[]): number[] {
  const lengths = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    lengths.push(lengths[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  return lengths;
}

/**
 * Find the segment index and local t for a given parameter u
 */
function findSegment(u: number, lengths: number[]): { index: number; t: number } {
  const totalLength = lengths[lengths.length - 1];
  const targetLength = u * totalLength;

  for (let i = 1; i < lengths.length; i++) {
    if (lengths[i] >= targetLength) {
      const segLength = lengths[i] - lengths[i - 1];
      const t = segLength > 0 ? (targetLength - lengths[i - 1]) / segLength : 0;
      return { index: i - 1, t };
    }
  }

  return { index: lengths.length - 2, t: 1 };
}

/**
 * Fit a parametric smoothing spline to a single branch using Catmull-Rom.
 *
 * @param pts List of (x, y) points (must have >= 4 points)
 * @param s Smoothing factor (0-1, higher = smoother) - affects tension
 * @param numOut Number of resampled output points
 * @returns Resampled points along the smooth spline
 */
export function smoothBranch(
  pts: PointTuple[],
  s: number = 0.001,
  numOut: number = 200
): PointTuple[] {
  if (pts.length < 4) {
    return pts;
  }

  // Apply optional smoothing by averaging nearby points
  let workPts = [...pts];
  if (s > 0 && s < 1) {
    const smoothed: PointTuple[] = [];
    const windowSize = Math.max(1, Math.floor(s * 10));

    for (let i = 0; i < workPts.length; i++) {
      let sumX = 0;
      let sumY = 0;
      let count = 0;

      for (let j = Math.max(0, i - windowSize); j <= Math.min(workPts.length - 1, i + windowSize); j++) {
        sumX += workPts[j][0];
        sumY += workPts[j][1];
        count++;
      }

      smoothed.push([sumX / count, sumY / count]);
    }
    workPts = smoothed;
  }

  // Add phantom points at the ends for Catmull-Rom
  const extended: PointTuple[] = [
    [2 * workPts[0][0] - workPts[1][0], 2 * workPts[0][1] - workPts[1][1]],
    ...workPts,
    [
      2 * workPts[workPts.length - 1][0] - workPts[workPts.length - 2][0],
      2 * workPts[workPts.length - 1][1] - workPts[workPts.length - 2][1],
    ],
  ];

  // Compute chord-length parameterization
  const lengths = computeChordLengths(workPts);

  // Sample the spline
  const result: PointTuple[] = [];
  for (let i = 0; i < numOut; i++) {
    const u = i / (numOut - 1);
    const { index, t } = findSegment(u, lengths);

    // Get the four control points (with offset for extended array)
    const p0 = extended[index];
    const p1 = extended[index + 1];
    const p2 = extended[index + 2];
    const p3 = extended[index + 3];

    result.push(catmullRomInterpolate(p0, p1, p2, p3, t));
  }

  return result;
}

/**
 * Concatenate all segment points into one flank and fit a single spline.
 *
 * The combined points are sorted by y descending (addendum → dedendum)
 * to form a continuous traversal of the tooth flank, then fitted with
 * one cubic spline for continuity across the entire profile.
 */
export function smoothConjugateProfile(
  result: ConjugateResult,
  s: number = 0.001,
  numOut: number = 200
): ConjugateResult {
  if (result.error) {
    return result;
  }

  // Per-segment splines (for backwards compat / overlay)
  const smoothedSeg: { AB: PointTuple[]; BC: PointTuple[]; CD: PointTuple[] } = {
    AB: [],
    BC: [],
    CD: [],
  };

  for (const segKey of ['AB', 'BC', 'CD'] as const) {
    const pts = result.seg_branches?.[segKey] || [];
    smoothedSeg[segKey] = smoothBranch(pts, s, numOut);
  }

  result.smoothed_seg_branches = smoothedSeg;

  // Unified flank: concatenate all segments, sort, fit one spline
  const allPts: PointTuple[] = [];
  for (const segKey of ['AB', 'BC', 'CD'] as const) {
    allPts.push(...(result.seg_branches?.[segKey] || []));
  }

  // Sort by y descending (tip to root) to get a continuous traversal
  allPts.sort((a, b) => b[1] - a[1]);

  result.smoothed_flank = smoothBranch(allPts, s, numOut);

  return result;
}

/**
 * Cubic Bezier curve sampling
 */
export function cubicBezier(
  p0: PointTuple,
  p1: PointTuple,
  p2: PointTuple,
  p3: PointTuple,
  n: number = 12
): PointTuple[] {
  const pts: PointTuple[] = [];

  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const u2 = u * u;
    const u3 = u2 * u;
    const t2 = t * t;
    const t3 = t2 * t;

    const x = u3 * p0[0] + 3 * u2 * t * p1[0] + 3 * u * t2 * p2[0] + t3 * p3[0];
    const y = u3 * p0[1] + 3 * u2 * t * p1[1] + 3 * u * t2 * p2[1] + t3 * p3[1];
    pts.push([x, y]);
  }

  return pts;
}

/**
 * Estimate tangent and curvature at the end of a point list
 */
export function estimateTangentAndCurvature(
  pts: PointTuple[],
  end: 'first' | 'last' = 'last'
): { tangent: PointTuple; curvature: number } {
  if (pts.length < 3) {
    if (pts.length === 2) {
      const dx = pts[1][0] - pts[0][0];
      const dy = pts[1][1] - pts[0][1];
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag < 1e-15) {
        return { tangent: [0, -1], curvature: 0 };
      }
      const t: PointTuple = [dx / mag, dy / mag];
      if (end === 'last') {
        return { tangent: t, curvature: 0 };
      } else {
        return { tangent: [-t[0], -t[1]], curvature: 0 };
      }
    }
    return { tangent: [0, -1], curvature: 0 };
  }

  let p0: PointTuple, p1: PointTuple, p2: PointTuple;
  if (end === 'last') {
    p0 = pts[pts.length - 3];
    p1 = pts[pts.length - 2];
    p2 = pts[pts.length - 1];
  } else {
    p2 = pts[0];
    p1 = pts[1];
    p0 = pts[2];
  }

  // Tangent from p1→p2
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag < 1e-15) {
    return { tangent: [0, -1], curvature: 0 };
  }
  const tangent: PointTuple = [dx / mag, dy / mag];

  // Curvature via three-point circle
  const [ax, ay] = p0;
  const [bx, by] = p1;
  const [cx, cy] = p2;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));

  if (Math.abs(d) < 1e-15) {
    return { tangent, curvature: 0 };
  }

  // Radius of circumscribed circle
  const ab = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
  const bc = Math.sqrt((cx - bx) ** 2 + (cy - by) ** 2);
  const ca = Math.sqrt((ax - cx) ** 2 + (ay - cy) ** 2);
  const area = Math.abs(d) / 2;
  const R = area > 1e-15 ? (ab * bc * ca) / (4 * area) : 1e12;
  const curvature = 1.0 / R;

  return { tangent, curvature };
}

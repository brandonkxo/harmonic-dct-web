/**
 * B-spline smoothing for conjugate profile branches
 *
 * Implements parametric cubic spline fitting similar to scipy's splprep/splev.
 */

import type { PointTuple, ConjugateResult } from '@/types';

/**
 * Solve a tridiagonal system using Thomas algorithm.
 * For natural cubic spline, we need to solve for second derivatives.
 */
function solveTridiagonal(
  a: number[],  // sub-diagonal
  b: number[],  // main diagonal
  c: number[],  // super-diagonal
  d: number[]   // right-hand side
): number[] {
  const n = d.length;
  const cp = new Array(n);
  const dp = new Array(n);
  const x = new Array(n);

  // Forward sweep
  cp[0] = c[0] / b[0];
  dp[0] = d[0] / b[0];
  for (let i = 1; i < n; i++) {
    const denom = b[i] - a[i] * cp[i - 1];
    cp[i] = c[i] / denom;
    dp[i] = (d[i] - a[i] * dp[i - 1]) / denom;
  }

  // Back substitution
  x[n - 1] = dp[n - 1];
  for (let i = n - 2; i >= 0; i--) {
    x[i] = dp[i] - cp[i] * x[i + 1];
  }

  return x;
}

/**
 * Natural cubic spline interpolation for a single coordinate.
 * Returns coefficients for each segment.
 */
function cubicSplineCoefficients(
  t: number[],  // parameter values
  y: number[]   // coordinate values
): { a: number[]; b: number[]; c: number[]; d: number[] } {
  const n = t.length - 1;  // number of segments

  // Compute h_i = t[i+1] - t[i]
  const h: number[] = [];
  for (let i = 0; i < n; i++) {
    h.push(t[i + 1] - t[i]);
  }

  // Set up tridiagonal system for second derivatives (natural spline: M_0 = M_n = 0)
  // For interior points: h[i-1]*M[i-1] + 2*(h[i-1]+h[i])*M[i] + h[i]*M[i+1] = 6*((y[i+1]-y[i])/h[i] - (y[i]-y[i-1])/h[i-1])
  if (n < 2) {
    // Linear interpolation for 2 points
    return {
      a: [y[0]],
      b: [(y[1] - y[0]) / (t[1] - t[0])],
      c: [0],
      d: [0],
    };
  }

  const subDiag: number[] = [];
  const mainDiag: number[] = [];
  const superDiag: number[] = [];
  const rhs: number[] = [];

  for (let i = 1; i < n; i++) {
    subDiag.push(h[i - 1]);
    mainDiag.push(2 * (h[i - 1] + h[i]));
    superDiag.push(h[i]);
    rhs.push(6 * ((y[i + 1] - y[i]) / h[i] - (y[i] - y[i - 1]) / h[i - 1]));
  }

  // Solve for interior second derivatives
  const M_interior = solveTridiagonal(subDiag, mainDiag, superDiag, rhs);

  // Full M array with natural boundary conditions (M_0 = M_n = 0)
  const M = [0, ...M_interior, 0];

  // Compute coefficients for each segment
  // S_i(x) = a_i + b_i*(x-t_i) + c_i*(x-t_i)^2 + d_i*(x-t_i)^3
  const a: number[] = [];
  const b: number[] = [];
  const c: number[] = [];
  const d: number[] = [];

  for (let i = 0; i < n; i++) {
    a.push(y[i]);
    b.push((y[i + 1] - y[i]) / h[i] - h[i] * (2 * M[i] + M[i + 1]) / 6);
    c.push(M[i] / 2);
    d.push((M[i + 1] - M[i]) / (6 * h[i]));
  }

  return { a, b, c, d };
}

/**
 * Evaluate cubic spline at parameter u.
 */
function evalCubicSpline(
  u: number,
  t: number[],
  coeffs: { a: number[]; b: number[]; c: number[]; d: number[] }
): number {
  // Find the segment
  let i = 0;
  for (let j = 0; j < t.length - 1; j++) {
    if (u >= t[j] && u <= t[j + 1]) {
      i = j;
      break;
    }
    if (j === t.length - 2) {
      i = j;  // clamp to last segment
    }
  }

  const du = u - t[i];
  return coeffs.a[i] + coeffs.b[i] * du + coeffs.c[i] * du * du + coeffs.d[i] * du * du * du;
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
 * Fit a parametric smoothing spline to a single branch.
 * This implementation matches scipy's splprep/splev behavior more closely.
 *
 * @param pts List of (x, y) points (must have >= 4 points)
 * @param s Smoothing factor (0-1, higher = smoother) - used for averaging
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

  // Optional pre-smoothing by local averaging (similar to scipy's smoothing parameter effect)
  let workPts = [...pts];
  if (s > 0 && s < 1) {
    const smoothed: PointTuple[] = [];
    // Use a smaller window for less aggressive smoothing
    const windowSize = Math.max(1, Math.floor(s * 5));

    for (let i = 0; i < workPts.length; i++) {
      let sumX = 0;
      let sumY = 0;
      let totalWeight = 0;

      for (let j = Math.max(0, i - windowSize); j <= Math.min(workPts.length - 1, i + windowSize); j++) {
        // Gaussian-like weighting
        const dist = Math.abs(j - i);
        const weight = Math.exp(-dist * dist / (2 * windowSize * windowSize + 0.01));
        sumX += workPts[j][0] * weight;
        sumY += workPts[j][1] * weight;
        totalWeight += weight;
      }

      smoothed.push([sumX / totalWeight, sumY / totalWeight]);
    }

    // Preserve endpoints exactly (important for correct dedendum radius)
    smoothed[0] = [...workPts[0]];
    smoothed[smoothed.length - 1] = [...workPts[workPts.length - 1]];

    workPts = smoothed;
  }

  // Compute chord-length parameterization (like scipy)
  const chordLengths = computeChordLengths(workPts);
  const totalLength = chordLengths[chordLengths.length - 1];

  if (totalLength < 1e-12) {
    return pts;
  }

  // Normalize to [0, 1]
  const t = chordLengths.map(l => l / totalLength);

  // Extract x and y coordinates
  const xCoords = workPts.map(p => p[0]);
  const yCoords = workPts.map(p => p[1]);

  // Fit cubic splines to x(t) and y(t)
  const xCoeffs = cubicSplineCoefficients(t, xCoords);
  const yCoeffs = cubicSplineCoefficients(t, yCoords);

  // Sample the parametric spline
  const result: PointTuple[] = [];
  for (let i = 0; i < numOut; i++) {
    const u = i / (numOut - 1);
    const x = evalCubicSpline(u, t, xCoeffs);
    const y = evalCubicSpline(u, t, yCoeffs);
    result.push([x, y]);
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

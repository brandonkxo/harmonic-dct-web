/**
 * Equations module index - exports all equation functions
 */

// Core profile (Equations 1-13)
export { computeProfile, profilePointAtL } from './core-profile';

// Deformation (Equations 14-20)
export {
  eq14Rho,
  eq15RadialArcChange,
  eq16Omega,
  eq17Omega,
  eq18TangentialArcChange,
  eq19NeutralLayerInvariance,
  eq20V,
} from './deformation';

// Kinematics (Equations 21-27)
export {
  eq21Mu,
  eq22ArcLengthInvariance,
  eq23Phi1,
  eq24TransmissionRatio,
  eq25Phi2,
  eq26Gamma,
  eq27Psi,
} from './kinematics';

// Transforms (Equations 28-30)
export {
  eq28TransformMatrix,
  eq29Transform,
  eq30EnvelopeCondition,
} from './transforms';

// Conjugate solver
export { computeConjugateProfile } from './conjugate-solver';

// Smoothing
export {
  smoothBranch,
  smoothConjugateProfile,
  cubicBezier,
  estimateTangentAndCurvature,
} from './smoothing';

// Gear building
export {
  buildSingleToothOutline,
  buildFullFlexspline,
  buildDeformedFlexspline,
  buildFullCircularSpline,
  buildDmaxFullFlexspline,
  buildDmaxDeformedFlexspline,
} from './gear-builder';

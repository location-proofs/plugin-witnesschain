// Copyright © 2026 Sophia Systems Corporation

/**
 * WitnessChain stamp evaluation
 *
 * Assesses how well a WitnessChain stamp supports a location claim.
 * Produces a CredibilityVector incorporating spatial distance,
 * temporal overlap, and multi-source verification signals.
 */

import type {
  LocationStamp,
  LocationClaim,
  CredibilityVector,
} from '@decentralized-geo/astral-sdk/plugins';

const EARTH_RADIUS_M = 6_371_000;

/**
 * Haversine distance between two lat/lon points in meters.
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Compute overlap ratio between two time intervals.
 */
function temporalOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number }
): number {
  const overlapStart = Math.max(a.start, b.start);
  const overlapEnd = Math.min(a.end, b.end);
  if (overlapEnd <= overlapStart) return 0;
  const overlap = overlapEnd - overlapStart;
  const shorter = Math.min(a.end - a.start, b.end - b.start);
  return shorter > 0 ? overlap / shorter : 0;
}

/**
 * Evaluate how well a WitnessChain stamp supports a location claim.
 *
 * WitnessChain uses network latency triangulation with independent
 * challengers, so it provides stronger evidence than self-reported GPS.
 * The spatial score factors in KnowLocUncertainty and multi-source
 * IP geolocation agreement.
 */
export async function evaluateWitnessChainStamp(
  stamp: LocationStamp,
  claim: LocationClaim
): Promise<CredibilityVector> {
  const details: Record<string, unknown> = {};

  // --- Extract stamp coordinates ---
  let stampLat: number;
  let stampLon: number;
  const loc = stamp.location;
  if (typeof loc === 'object' && 'coordinates' in loc) {
    const coords = loc.coordinates as number[];
    stampLon = coords[0];
    stampLat = coords[1];
  } else {
    return {
      supportsClaim: false,
      score: 0,
      spatial: 0,
      temporal: 0,
      details: { error: 'Cannot extract coordinates from stamp location' },
    };
  }

  // --- Extract claim coordinates ---
  let claimLat: number;
  let claimLon: number;
  const claimLoc = claim.location;
  if (typeof claimLoc === 'object' && 'coordinates' in claimLoc) {
    const coords = claimLoc.coordinates as number[];
    claimLon = coords[0];
    claimLat = coords[1];
  } else {
    return {
      supportsClaim: false,
      score: 0,
      spatial: 0,
      temporal: 0,
      details: { error: 'Cannot extract coordinates from claim location' },
    };
  }

  // --- Spatial scoring ---
  const distance = haversineDistance(stampLat, stampLon, claimLat, claimLon);
  details.distanceMeters = Math.round(distance);

  // Factor in KnowLocUncertainty (km → m) from the consolidated result
  const knowLocUncertaintyKm =
    (stamp.signals.knowLocUncertaintyKm as number | undefined) ?? 50;
  const uncertaintyMeters = knowLocUncertaintyKm * 1000;
  const effectiveRadius = claim.radius + uncertaintyMeters;
  details.effectiveRadiusMeters = effectiveRadius;
  details.knowLocUncertaintyKm = knowLocUncertaintyKm;

  let spatial: number;
  if (distance <= effectiveRadius) {
    spatial = 1.0 - distance / effectiveRadius;
  } else {
    spatial = Math.max(0, 1.0 - distance / (effectiveRadius * 3));
  }

  // --- Multi-source verification bonuses ---
  const consolidated = stamp.signals.consolidatedResult as
    | Record<string, unknown>
    | undefined;

  if (consolidated) {
    // Count how many independent IP geolocation sources agree
    let ipSourcesAgreed = 0;
    let ipSourcesTotal = 0;
    for (const key of ['ipapi.co', 'ipregistry', 'maxmind'] as const) {
      if (consolidated[key] !== undefined) {
        ipSourcesTotal++;
        if (consolidated[key] === true) ipSourcesAgreed++;
      }
    }

    if (ipSourcesTotal > 0) {
      const ipAgreementRatio = ipSourcesAgreed / ipSourcesTotal;
      // Up to +0.1 bonus for IP geolocation agreement
      spatial = Math.min(1.0, spatial + ipAgreementRatio * 0.1);
      details.ipSourcesAgreed = ipSourcesAgreed;
      details.ipSourcesTotal = ipSourcesTotal;
    }

    // Bonus for KnowLoc verification
    if (consolidated.KnowLoc === true) {
      spatial = Math.min(1.0, spatial + 0.05);
      details.knowLocVerified = true;
    }

    // Bonus for overall verified flag
    if (consolidated.verified === true) {
      spatial = Math.min(1.0, spatial + 0.05);
      details.consolidatedVerified = true;
    }
  }

  // --- Temporal scoring ---
  const temporal = temporalOverlap(stamp.temporalFootprint, claim.time);
  details.temporalOverlap = temporal;

  // --- Penalty for failed challenge ---
  let challengePenalty = 0;
  if (stamp.signals.challengeSucceeded === false) {
    challengePenalty = 0.3;
    details.challengeFailedPenalty = challengePenalty;
  }

  // --- Combined score ---
  // WitnessChain uses independent network verification, so spatial weight is higher
  const rawScore = spatial * 0.65 + temporal * 0.35 - challengePenalty;
  const score = Math.max(0, Math.min(1, rawScore));
  const supportsClaim = score > 0.3 && spatial > 0.1 && temporal > 0;

  return { supportsClaim, score, spatial, temporal, details };
}

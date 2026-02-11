// Copyright © 2026 Sophia Systems Corporation

/**
 * WitnessChain stamp creation
 *
 * Transforms a WitnessChain challenge result into an UnsignedLocationStamp.
 */

import type { RawSignals, UnsignedLocationStamp } from '@decentralized-geo/astral-sdk/plugins';
import type { WitnessChainChallengeResult } from './types';

const PLUGIN_NAME = 'witnesschain';
const PLUGIN_VERSION = '0.1.0';

/**
 * Create an UnsignedLocationStamp from WitnessChain RawSignals.
 *
 * Expects `signals.data.challengeResult` to be a WitnessChainChallengeResult.
 */
export function createWitnessChainStamp(signals: RawSignals): UnsignedLocationStamp {
  const challengeResult = signals.data.challengeResult as WitnessChainChallengeResult;

  if (!challengeResult) {
    throw new Error('WitnessChain signals must include challengeResult');
  }

  const { latitude, longitude } = challengeResult.claims;
  const startTime = Math.floor(
    new Date(challengeResult.challenge_start_time).getTime() / 1000
  );

  // Challenge duration is approximated from the ping delay (microseconds → seconds)
  // plus a buffer. Most challenges complete within a few seconds.
  const durationSeconds = Math.max(
    10,
    Math.ceil(challengeResult.result.ping_delay / 1_000_000) + 5
  );

  return {
    lpVersion: '0.2',
    locationType: 'geojson-point',
    location: {
      type: 'Point',
      coordinates: [longitude, latitude], // GeoJSON: [lon, lat]
    },
    srs: 'EPSG:4326',
    temporalFootprint: {
      start: startTime,
      end: startTime + durationSeconds,
    },
    plugin: PLUGIN_NAME,
    pluginVersion: PLUGIN_VERSION,
    signals: {
      challengeId: challengeResult.id,
      challenger: challengeResult.challenger,
      challengerId: challengeResult.challenger_id,
      challengerClaims: challengeResult.challenger_claims,
      proverClaims: challengeResult.claims,
      challengeSucceeded: challengeResult.result.challenge_succeeded,
      pingDelayMicroseconds: challengeResult.result.ping_delay,
      consolidatedResult: challengeResult.consolidated_result,
      knowLocUncertaintyKm: challengeResult.consolidated_result.KnowLocUncertainty,
    },
  };
}

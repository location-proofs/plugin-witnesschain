// Copyright © 2026 Sophia Systems Corporation

import { ethers } from 'ethers';
import type {
  RawSignals,
  LocationClaim,
  LocationStamp,
  StampSigner,
} from '@decentralized-geo/astral-sdk/plugins';
import { WitnessChainPlugin } from '../index';
import { createWitnessChainStamp } from '../create';
import { verifyWitnessChainStamp } from '../verify';
import { evaluateWitnessChainStamp } from '../evaluate';
import { signalsFromChallengeResult } from '../collect';
import {
  createChallengeFixture,
  createFailedChallengeFixture,
  TEST_CHALLENGER_ADDRESS,
} from './fixtures/challenge-result';

// Shared fixtures
let successSignals: RawSignals;
let failedSignals: RawSignals;

beforeAll(async () => {
  const successResult = await createChallengeFixture();
  successSignals = signalsFromChallengeResult(successResult);

  const failedResult = await createFailedChallengeFixture();
  failedSignals = signalsFromChallengeResult(failedResult);
});

// Helper: create a claim near the prover's location
function nearClaim(overrides?: Partial<LocationClaim>): LocationClaim {
  return {
    lpVersion: '0.2',
    locationType: 'geojson-point',
    location: {
      type: 'Point',
      coordinates: [-73.9857, 40.7484], // Same as prover claims
    },
    srs: 'EPSG:4326',
    subject: { scheme: 'eth-address', value: '0x1234' },
    radius: 500, // 500m
    time: {
      start: Math.floor(new Date('2026-01-15T11:55:00Z').getTime() / 1000),
      end: Math.floor(new Date('2026-01-15T12:05:00Z').getTime() / 1000),
    },
    ...overrides,
  };
}

// Helper: create a signer
function createTestSigner(): StampSigner {
  const wallet = ethers.Wallet.createRandom();
  return {
    algorithm: 'secp256k1',
    signer: { scheme: 'eth-address', value: wallet.address },
    sign: (data: string) => wallet.signMessage(data),
  };
}

describe('WitnessChainPlugin', () => {
  it('has correct metadata', () => {
    const plugin = new WitnessChainPlugin();
    expect(plugin.name).toBe('witnesschain');
    expect(plugin.version).toBe('0.1.0');
    expect(plugin.runtimes).toContain('node');
    expect(plugin.requiredCapabilities).toContain('network');
  });

  it('throws if collect is called without proverId', async () => {
    const plugin = new WitnessChainPlugin();
    await expect(plugin.collect()).rejects.toThrow('proverId');
  });
});

describe('createWitnessChainStamp', () => {
  it('creates a valid unsigned stamp from signals', () => {
    const stamp = createWitnessChainStamp(successSignals);

    expect(stamp.lpVersion).toBe('0.2');
    expect(stamp.locationType).toBe('geojson-point');
    expect(stamp.plugin).toBe('witnesschain');
    expect(stamp.pluginVersion).toBe('0.1.0');
    expect(stamp.srs).toBe('EPSG:4326');

    // GeoJSON: [lon, lat]
    const coords = (stamp.location as { coordinates: number[] }).coordinates;
    expect(coords[0]).toBe(-73.9857); // longitude
    expect(coords[1]).toBe(40.7484); // latitude

    // Temporal footprint
    expect(stamp.temporalFootprint.start).toBeGreaterThan(0);
    expect(stamp.temporalFootprint.end).toBeGreaterThan(stamp.temporalFootprint.start);

    // Signals contain key fields
    expect(stamp.signals.challengeId).toBe('challenge-001');
    expect(stamp.signals.challengeSucceeded).toBe(true);
    expect(stamp.signals.pingDelayMicroseconds).toBe(15000);
    expect(stamp.signals.knowLocUncertaintyKm).toBe(5.2);
  });

  it('throws if challengeResult is missing', () => {
    const badSignals: RawSignals = {
      plugin: 'witnesschain',
      timestamp: 123,
      data: {},
    };
    expect(() => createWitnessChainStamp(badSignals)).toThrow('challengeResult');
  });
});

describe('verifyWitnessChainStamp', () => {
  it('verifies a valid stamp with challenge signature', async () => {
    const challengeResult = await createChallengeFixture();
    const unsigned = createWitnessChainStamp(signalsFromChallengeResult(challengeResult));

    // Build a LocationStamp with the challenge result in signals
    const stamp: LocationStamp = {
      ...unsigned,
      signatures: [],
      signals: {
        ...unsigned.signals,
        challengeResult,
      },
    };

    const result = await verifyWitnessChainStamp(stamp);
    expect(result.valid).toBe(true);
    expect(result.signaturesValid).toBe(true);
    expect(result.structureValid).toBe(true);
    expect(result.signalsConsistent).toBe(true);
    expect(result.details.challengeSignerVerified).toBe(true);
  });

  it('detects invalid challenge signature', async () => {
    const challengeResult = await createChallengeFixture();
    // Tamper with the challenger address
    challengeResult.challenger = '0x0000000000000000000000000000000000000001';

    const unsigned = createWitnessChainStamp(signalsFromChallengeResult(challengeResult));
    const stamp: LocationStamp = {
      ...unsigned,
      signatures: [],
      signals: {
        ...unsigned.signals,
        challengeResult,
      },
    };

    const result = await verifyWitnessChainStamp(stamp);
    expect(result.signaturesValid).toBe(false);
    expect(result.details.challengeSignatureMismatch).toBeDefined();
  });

  it('detects wrong plugin name', async () => {
    const unsigned = createWitnessChainStamp(successSignals);
    const stamp: LocationStamp = {
      ...unsigned,
      plugin: 'wrong-plugin',
      signatures: [],
    };

    const result = await verifyWitnessChainStamp(stamp);
    expect(result.structureValid).toBe(false);
    expect(result.details.pluginMismatch).toBeDefined();
  });

  it('validates Astral-level stamp signatures', async () => {
    const unsigned = createWitnessChainStamp(successSignals);
    const signer = createTestSigner();
    const sigValue = await signer.sign(JSON.stringify(unsigned));

    const stamp: LocationStamp = {
      ...unsigned,
      signatures: [
        {
          signer: signer.signer,
          algorithm: 'secp256k1',
          value: sigValue,
          timestamp: Math.floor(Date.now() / 1000),
        },
      ],
    };

    const result = await verifyWitnessChainStamp(stamp);
    expect(result.signaturesValid).toBe(true);
  });

  it('detects invalid coordinate ranges', async () => {
    const challengeResult = await createChallengeFixture({
      claims: { latitude: 200, longitude: -73.9857, radius: 100 },
    });
    const unsigned = createWitnessChainStamp(signalsFromChallengeResult(challengeResult));
    const stamp: LocationStamp = {
      ...unsigned,
      signatures: [],
      signals: {
        ...unsigned.signals,
        challengeResult,
      },
    };

    const result = await verifyWitnessChainStamp(stamp);
    expect(result.signalsConsistent).toBe(false);
    expect(result.details.invalidLatitude).toBeDefined();
  });
});

describe('evaluateWitnessChainStamp', () => {
  it('scores highly for co-located stamp and claim', async () => {
    const unsigned = createWitnessChainStamp(successSignals);
    const stamp: LocationStamp = { ...unsigned, signatures: [] };
    const claim = nearClaim();

    const result = await evaluateWitnessChainStamp(stamp, claim);
    expect(result.supportsClaim).toBe(true);
    expect(result.spatial).toBeGreaterThan(0.5);
    expect(result.temporal).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThan(0.3);
  });

  it('scores low for distant claim', async () => {
    const unsigned = createWitnessChainStamp(successSignals);
    const stamp: LocationStamp = { ...unsigned, signatures: [] };

    // Claim is in London — far from NYC
    const claim = nearClaim({
      location: {
        type: 'Point',
        coordinates: [-0.1276, 51.5074],
      },
      radius: 100,
    });

    const result = await evaluateWitnessChainStamp(stamp, claim);
    expect(result.spatial).toBeLessThan(0.2);
    expect(result.details.distanceMeters).toBeGreaterThan(5_000_000);
  });

  it('scores zero for non-overlapping time', async () => {
    const unsigned = createWitnessChainStamp(successSignals);
    const stamp: LocationStamp = { ...unsigned, signatures: [] };

    const claim = nearClaim({
      time: {
        start: Math.floor(new Date('2025-01-01T00:00:00Z').getTime() / 1000),
        end: Math.floor(new Date('2025-01-01T01:00:00Z').getTime() / 1000),
      },
    });

    const result = await evaluateWitnessChainStamp(stamp, claim);
    expect(result.temporal).toBe(0);
    expect(result.supportsClaim).toBe(false);
  });

  it('applies penalty for failed challenge', async () => {
    const unsigned = createWitnessChainStamp(failedSignals);
    const stamp: LocationStamp = { ...unsigned, signatures: [] };
    const claim = nearClaim();

    const result = await evaluateWitnessChainStamp(stamp, claim);
    expect(result.details.challengeFailedPenalty).toBe(0.3);
    expect(result.score).toBeLessThan(0.8);
  });

  it('applies IP geolocation agreement bonus', async () => {
    const unsigned = createWitnessChainStamp(successSignals);
    const stamp: LocationStamp = { ...unsigned, signatures: [] };
    const claim = nearClaim();

    const result = await evaluateWitnessChainStamp(stamp, claim);
    // 2 of 3 IP sources agreed → bonus applied
    expect(result.details.ipSourcesAgreed).toBe(2);
    expect(result.details.ipSourcesTotal).toBe(3);
  });

  it('returns error for non-GeoJSON stamp location', async () => {
    const unsigned = createWitnessChainStamp(successSignals);
    const stamp: LocationStamp = {
      ...unsigned,
      location: 'h3:8928308280fffff', // Not GeoJSON
      signatures: [],
    };
    const claim = nearClaim();

    const result = await evaluateWitnessChainStamp(stamp, claim);
    expect(result.supportsClaim).toBe(false);
    expect(result.details.error).toContain('Cannot extract coordinates');
  });
});

describe('full lifecycle', () => {
  it('create → sign → verify → evaluate', async () => {
    const challengeResult = await createChallengeFixture();
    const signals = signalsFromChallengeResult(challengeResult);

    // Create
    const unsigned = createWitnessChainStamp(signals);
    expect(unsigned.plugin).toBe('witnesschain');

    // Sign
    const plugin = new WitnessChainPlugin();
    const signer = createTestSigner();
    const signed = await plugin.sign(unsigned, signer);
    expect(signed.signatures).toHaveLength(1);
    expect(signed.signatures[0].signer.value).toBe(signer.signer.value);

    // Verify (Astral-level signature)
    const verifyResult = await plugin.verify(signed);
    expect(verifyResult.signaturesValid).toBe(true);
    expect(verifyResult.structureValid).toBe(true);

    // Evaluate
    const claim = nearClaim();
    const evalResult = await plugin.evaluate(signed, claim);
    expect(evalResult.supportsClaim).toBe(true);
    expect(evalResult.score).toBeGreaterThan(0.3);
  });

  it('create → sign → verify with embedded challenge result', async () => {
    const challengeResult = await createChallengeFixture();
    const signals = signalsFromChallengeResult(challengeResult);

    const unsigned = createWitnessChainStamp(signals);

    // Add the full challenge result for signature verification
    const withChallenge = {
      ...unsigned,
      signals: { ...unsigned.signals, challengeResult },
    };

    const signer = createTestSigner();
    const plugin = new WitnessChainPlugin();
    const signed = await plugin.sign(withChallenge, signer);

    const result = await plugin.verify(signed);
    expect(result.valid).toBe(true);
    expect(result.details.challengeSignerVerified).toBe(true);
  });
});

describe('signalsFromChallengeResult', () => {
  it('creates RawSignals from a challenge result', async () => {
    const challengeResult = await createChallengeFixture();
    const signals = signalsFromChallengeResult(challengeResult);

    expect(signals.plugin).toBe('witnesschain');
    expect(signals.timestamp).toBeGreaterThan(0);
    expect(signals.data.challengeResult).toBe(challengeResult);
  });
});

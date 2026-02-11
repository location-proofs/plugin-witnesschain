// Copyright © 2026 Sophia Systems Corporation

/**
 * WitnessChain Location Proof Plugin
 *
 * Infrastructure proof-of-location via network latency triangulation.
 * WitnessChain challenges use independent watchtowers (challengers)
 * to verify a prover's claimed location through RTT measurements
 * and multi-source IP geolocation.
 *
 * For v0, only historical mode is supported — live challenges
 * require POINTS tokens.
 */

import type {
  LocationProofPlugin,
  Runtime,
  CollectOptions,
  RawSignals,
  UnsignedLocationStamp,
  LocationStamp,
  StampSigner,
  LocationClaim,
  StampVerificationResult,
  CredibilityVector,
} from '@decentralized-geo/astral-sdk/plugins';

import type { WitnessChainPluginOptions } from './types';
import { collectWitnessChain, signalsFromChallengeResult } from './collect';
import { createWitnessChainStamp } from './create';
import { verifyWitnessChainStamp } from './verify';
import { evaluateWitnessChainStamp } from './evaluate';

export class WitnessChainPlugin implements LocationProofPlugin {
  readonly name = 'witnesschain';
  readonly version = '0.1.0';
  readonly runtimes: Runtime[] = ['react-native', 'node', 'browser'];
  readonly requiredCapabilities: string[] = ['network'];
  readonly description =
    'WitnessChain proof-of-location via network latency triangulation';

  private readonly options: WitnessChainPluginOptions;
  private proverId?: string;

  constructor(options: WitnessChainPluginOptions & { proverId?: string } = {}) {
    this.options = options;
    this.proverId = options.proverId;
  }

  /**
   * Collect challenge results from the WitnessChain API.
   *
   * For v0, fetches historical results from /pol/all-provers.
   * A proverId must be set in the constructor or passed via options.
   */
  async collect(options?: CollectOptions): Promise<RawSignals> {
    if (!this.proverId) {
      throw new Error(
        'WitnessChain collect requires a proverId. ' +
          'Pass it in the constructor options.'
      );
    }
    return collectWitnessChain(this.proverId, this.options, options);
  }

  /**
   * Transform collected signals into an unsigned location stamp.
   */
  async create(signals: RawSignals): Promise<UnsignedLocationStamp> {
    return createWitnessChainStamp(signals);
  }

  /**
   * Sign an unsigned stamp with the provided signer.
   *
   * WitnessChain challenges are already signed by the challenger.
   * This adds an Astral-level signature for the stamp wrapper.
   */
  async sign(stamp: UnsignedLocationStamp, signer: StampSigner): Promise<LocationStamp> {
    const data = JSON.stringify(stamp);
    const sigValue = await signer.sign(data);
    const now = Math.floor(Date.now() / 1000);

    return {
      ...stamp,
      signatures: [
        {
          signer: signer.signer,
          algorithm: signer.algorithm,
          value: sigValue,
          timestamp: now,
        },
      ],
    };
  }

  /**
   * Verify a WitnessChain stamp's internal validity.
   * Checks ECDSA signature, structure, and signal consistency.
   */
  async verify(stamp: LocationStamp): Promise<StampVerificationResult> {
    return verifyWitnessChainStamp(stamp);
  }

  /**
   * Evaluate how well a WitnessChain stamp supports a location claim.
   */
  async evaluate(stamp: LocationStamp, claim: LocationClaim): Promise<CredibilityVector> {
    return evaluateWitnessChainStamp(stamp, claim);
  }
}

// Re-exports
export { collectWitnessChain, signalsFromChallengeResult } from './collect';
export { createWitnessChainStamp } from './create';
export { verifyWitnessChainStamp } from './verify';
export { evaluateWitnessChainStamp } from './evaluate';
export type {
  WitnessChainChallengeResult,
  WitnessChainProver,
  WitnessChainPluginOptions,
  AuthChallenge,
} from './types';

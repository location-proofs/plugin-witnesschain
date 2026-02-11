// Copyright © 2026 Sophia Systems Corporation

/**
 * Captured WitnessChain challenge result fixture for testing.
 *
 * Based on the WitnessChain API research findings. The message and signature
 * are synthetic (generated with a test wallet) but structurally match the
 * real API response format.
 */

import { ethers } from 'ethers';
import type { WitnessChainChallengeResult } from '../../types';

// Deterministic test wallet for reproducible signatures
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

/**
 * Create a signed challenge result fixture.
 * The message is signed by the test wallet so ECDSA verification works in tests.
 */
export async function createChallengeFixture(
  overrides?: Partial<WitnessChainChallengeResult>
): Promise<WitnessChainChallengeResult> {
  const wallet = new ethers.Wallet(TEST_PRIVATE_KEY);

  const baseResult: Omit<WitnessChainChallengeResult, 'message' | 'signature'> = {
    id: 'challenge-001',
    challenge_start_time: '2026-01-15T12:00:00Z',
    challenger: wallet.address,
    challenger_id: 'watchtower-nyc-01',
    challenger_claims: {
      latitude: 40.7128,
      longitude: -74.006,
      radius: 50,
    },
    claims: {
      latitude: 40.7484,
      longitude: -73.9857,
      radius: 100,
    },
    result: {
      challenge_succeeded: true,
      ping_delay: 15000, // 15ms in microseconds
    },
    consolidated_result: {
      KnowLoc: true,
      KnowLocUncertainty: 5.2,
      'ipapi.co': true,
      ipregistry: true,
      maxmind: false,
      verified: true,
    },
    ...overrides,
  };

  // Sign the challenge data like the real API does
  const messagePayload = JSON.stringify({
    id: baseResult.id,
    challenger: baseResult.challenger,
    claims: baseResult.claims,
    result: baseResult.result,
    timestamp: baseResult.challenge_start_time,
  });

  const signature = await wallet.signMessage(messagePayload);

  return {
    ...baseResult,
    message: messagePayload,
    signature,
    ...(overrides?.message !== undefined ? { message: overrides.message } : {}),
    ...(overrides?.signature !== undefined ? { signature: overrides.signature } : {}),
  };
}

/**
 * Create a failed challenge fixture.
 */
export async function createFailedChallengeFixture(): Promise<WitnessChainChallengeResult> {
  return createChallengeFixture({
    id: 'challenge-fail-001',
    result: {
      challenge_succeeded: false,
      ping_delay: 500000, // 500ms — too slow
    },
    consolidated_result: {
      KnowLoc: false,
      KnowLocUncertainty: 150,
      verified: false,
    },
  });
}

/**
 * The test wallet address (for assertions).
 */
export const TEST_CHALLENGER_ADDRESS = new ethers.Wallet(TEST_PRIVATE_KEY).address;

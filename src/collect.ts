// Copyright © 2026 Sophia Systems Corporation

/**
 * WitnessChain evidence collection
 *
 * Fetches proof-of-location challenge results from the WitnessChain API.
 * For v0, only historical mode is supported (live challenge requires POINTS tokens).
 */

import type { RawSignals, CollectOptions } from '@decentralized-geo/astral-sdk/plugins';
import type { WitnessChainChallengeResult, WitnessChainPluginOptions } from './types';

/**
 * Collect WitnessChain challenge results for a prover.
 *
 * Currently supports historical mode only — fetches past challenge results
 * from the all-provers endpoint. Live challenge triggering is blocked by
 * POINTS token requirements.
 */
export async function collectWitnessChain(
  proverId: string,
  options: WitnessChainPluginOptions,
  _collectOptions?: CollectOptions
): Promise<RawSignals> {
  const apiUrl = options.apiUrl ?? 'https://witnesschain.com';

  // For v0, we require pre-fetched data or a session cookie.
  // Real API calls would go through the auth flow.
  if (!options.sessionCookie && !options.privateKey) {
    throw new Error(
      'WitnessChain collect requires authentication. ' +
        'Provide a privateKey for wallet auth or a sessionCookie.'
    );
  }

  // Fetch prover data with challenge results
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.sessionCookie) {
    headers['Cookie'] = options.sessionCookie;
  }

  const response = await fetch(`${apiUrl}/pol/all-provers`, { headers });
  if (!response.ok) {
    throw new Error(`WitnessChain API error: ${response.status} ${response.statusText}`);
  }

  const provers = (await response.json()) as Array<{
    id: string;
    results: WitnessChainChallengeResult[];
    claims: { latitude: number; longitude: number; radius: number };
  }>;

  const prover = provers.find(p => p.id === proverId);
  if (!prover) {
    throw new Error(`Prover '${proverId}' not found`);
  }

  // Get the most recent successful challenge
  const successfulResults = prover.results.filter(r => r.result.challenge_succeeded);
  if (successfulResults.length === 0) {
    throw new Error(`No successful challenges found for prover '${proverId}'`);
  }

  const latest = successfulResults[0];

  return {
    plugin: 'witnesschain',
    timestamp: Math.floor(new Date(latest.challenge_start_time).getTime() / 1000),
    data: {
      challengeResult: latest,
      proverClaims: prover.claims,
      proverId,
    },
  };
}

/**
 * Create RawSignals from a pre-fetched WitnessChain challenge result.
 * Use this when you already have challenge data (e.g., from captured fixtures).
 */
export function signalsFromChallengeResult(result: WitnessChainChallengeResult): RawSignals {
  return {
    plugin: 'witnesschain',
    timestamp: Math.floor(new Date(result.challenge_start_time).getTime() / 1000),
    data: {
      challengeResult: result,
      proverClaims: result.claims,
    },
  };
}

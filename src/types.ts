// Copyright © 2026 Sophia Systems Corporation

/**
 * WitnessChain-specific types
 *
 * Based on the WitnessChain API research findings.
 */

/**
 * A WitnessChain challenge result from the API.
 */
export interface WitnessChainChallengeResult {
  id: string;
  challenge_start_time: string;

  /** Challenger (watchtower) Ethereum address */
  challenger: string;
  challenger_id: string;
  challenger_claims: {
    latitude: number;
    longitude: number;
    radius: number;
  };

  /** Prover's claimed location */
  claims: {
    latitude: number;
    longitude: number;
    radius: number;
  };

  /** Challenge outcome */
  result: {
    challenge_succeeded: boolean;
    ping_delay: number; // Microseconds
  };

  /** JSON string that was signed */
  message: string;
  /** ECDSA signature (0x-prefixed) */
  signature: string;

  /** Multi-source verification */
  consolidated_result: {
    KnowLoc: boolean;
    KnowLocUncertainty: number; // km
    'ipapi.co'?: boolean;
    ipregistry?: boolean;
    maxmind?: boolean;
    verified: boolean;
  };
}

/**
 * A WitnessChain prover record from the all-provers endpoint.
 */
export interface WitnessChainProver {
  id: string;
  name: string;
  claims: {
    latitude: number;
    longitude: number;
    radius: number;
  };
  geoip: {
    city: string;
    country: string;
    region: string;
    timezone: string;
    latitude: number;
    longitude: number;
  };
  is_registered_on_chain: boolean;
  number_of_challenges: number;
  number_of_successful_challenges: number;
  results: WitnessChainChallengeResult[];
}

/**
 * Configuration for the WitnessChain plugin.
 */
export interface WitnessChainPluginOptions {
  /** WitnessChain API base URL */
  apiUrl?: string;
  /** Wallet private key for API authentication */
  privateKey?: string;
  /** Pre-authenticated session cookie (for testing) */
  sessionCookie?: string;
}

/**
 * Auth challenge from the WitnessChain pre-login endpoint.
 */
export interface AuthChallenge {
  message: string;
}

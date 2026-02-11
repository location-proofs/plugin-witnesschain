// Copyright © 2026 Sophia Systems Corporation

/**
 * WitnessChain stamp verification
 *
 * Verifies the ECDSA signature on a WitnessChain challenge result
 * and checks structural/signal consistency.
 */

import { ethers } from 'ethers';
import type { LocationStamp, StampVerificationResult } from '@decentralized-geo/astral-sdk/plugins';
import type { WitnessChainChallengeResult } from './types';

/**
 * Verify a WitnessChain stamp's internal validity.
 *
 * Checks:
 * 1. Structure: required fields, correct plugin name, LP version
 * 2. Signatures: ECDSA signature on the challenge message recovers to the challenger address
 * 3. Signal consistency: coordinates in range, challenge result present
 */
export async function verifyWitnessChainStamp(
  stamp: LocationStamp
): Promise<StampVerificationResult> {
  const details: Record<string, unknown> = {};
  let signaturesValid = true;
  let structureValid = true;
  let signalsConsistent = true;

  // --- Structure checks ---

  if (stamp.lpVersion !== '0.2') {
    structureValid = false;
    details.lpVersionError = `Expected '0.2', got '${stamp.lpVersion}'`;
  }

  if (stamp.plugin !== 'witnesschain') {
    structureValid = false;
    details.pluginMismatch = `Expected 'witnesschain', got '${stamp.plugin}'`;
  }

  if (!stamp.location || !stamp.temporalFootprint) {
    structureValid = false;
    details.missingFields = true;
  }

  // Verify challenge result is present in signals
  const challengeResult = stamp.signals.challengeResult as
    | WitnessChainChallengeResult
    | undefined;

  if (!challengeResult) {
    // Signals may have been flattened during create — check for key fields
    if (!stamp.signals.challengeId || stamp.signals.challengeSucceeded === undefined) {
      structureValid = false;
      details.missingChallengeData = true;
    }
  }

  // --- ECDSA signature verification ---
  // WitnessChain challenges include a signed message from the challenger.
  // We verify the signature recovers to the expected challenger address.

  if (challengeResult) {
    try {
      const recovered = ethers.verifyMessage(
        challengeResult.message,
        challengeResult.signature
      );

      if (recovered.toLowerCase() !== challengeResult.challenger.toLowerCase()) {
        signaturesValid = false;
        details.challengeSignatureMismatch = {
          expected: challengeResult.challenger,
          recovered,
        };
      } else {
        details.challengeSignerVerified = true;
        details.recoveredAddress = recovered;
      }
    } catch (e) {
      signaturesValid = false;
      details.challengeSignatureError = e instanceof Error ? e.message : String(e);
    }
  }

  // Also verify any Astral-level signatures on the stamp itself
  if (stamp.signatures && stamp.signatures.length > 0) {
    for (const sig of stamp.signatures) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { signatures: _, ...unsigned } = stamp;
        const message = JSON.stringify(unsigned);
        const recovered = ethers.verifyMessage(message, sig.value);
        if (recovered.toLowerCase() !== sig.signer.value.toLowerCase()) {
          signaturesValid = false;
          details.stampSignatureMismatch = {
            expected: sig.signer.value,
            recovered,
          };
        }
      } catch (e) {
        signaturesValid = false;
        details.stampSignatureError = e instanceof Error ? e.message : String(e);
      }
    }
  } else if (!challengeResult) {
    // No challenge result and no stamp signatures — nothing to verify
    signaturesValid = false;
    details.noSignatures = true;
  }

  // --- Signal consistency ---

  // Check coordinate ranges
  const loc = stamp.location;
  if (typeof loc === 'object' && 'coordinates' in loc) {
    const coords = loc.coordinates as number[];
    if (coords[0] < -180 || coords[0] > 180) {
      signalsConsistent = false;
      details.invalidLongitude = coords[0];
    }
    if (coords[1] < -90 || coords[1] > 90) {
      signalsConsistent = false;
      details.invalidLatitude = coords[1];
    }
  }

  // Check that challenge succeeded (warning, not failure)
  if (stamp.signals.challengeSucceeded === false) {
    details.challengeFailed = true;
  }

  // Validate consolidated result structure if present
  const consolidated = stamp.signals.consolidatedResult as
    | Record<string, unknown>
    | undefined;
  if (consolidated) {
    if (typeof consolidated.KnowLoc !== 'boolean') {
      signalsConsistent = false;
      details.invalidConsolidatedResult = 'KnowLoc must be boolean';
    }
  }

  return {
    valid: signaturesValid && structureValid && signalsConsistent,
    signaturesValid,
    structureValid,
    signalsConsistent,
    details,
  };
}

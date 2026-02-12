# WitnessChain Plugin

Location proof plugin for [WitnessChain](https://witnesschain.com/) - infrastructure-based proof-of-location via network latency triangulation.

[![npm version](https://img.shields.io/npm/v/@location-proofs/plugin-witnesschain.svg)](https://www.npmjs.com/package/@location-proofs/plugin-witnesschain)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What is WitnessChain?

[WitnessChain](https://witnesschain.com/) provides infrastructure-based location verification through network latency measurements. Independent watchtowers ("challengers") verify a prover's claimed location by measuring round-trip times (RTT) and correlating with IP geolocation data.

This plugin integrates WitnessChain challenges into the Astral SDK location proof framework.

## Installation

```bash
npm install @location-proofs/plugin-witnesschain
# or
pnpm add @location-proofs/plugin-witnesschain
```

## Quick Start

```typescript
import { WitnessChainPlugin } from '@location-proofs/plugin-witnesschain';
import { AstralSDK } from '@decentralized-geo/astral-sdk';

// Initialize plugin with your prover ID
const plugin = new WitnessChainPlugin({
  proverId: '0x1234...', // Your WitnessChain prover address
  apiUrl: 'https://api.witnesschain.com', // Optional, uses default
});

// Collect challenge results
const signals = await plugin.collect();

// Create stamp from signals
const unsigned = await plugin.create(signals);

// Sign with your wallet
const stamp = await plugin.sign(unsigned, ethersSigner);

// Verify the stamp
const verification = await plugin.verify(stamp);
console.log(verification.isValid); // true/false
```

## Integration with Astral SDK

```typescript
const astral = new AstralSDK({ chainId: 84532, signer: wallet });

// Register the plugin
astral.plugins.register(
  new WitnessChainPlugin({ proverId: '0x1234...' })
);

// Create a location claim
const claim = {
  location: { type: 'Point', coordinates: [-73.9857, 40.7484] },
  radius: 100,
  time: { start: timestamp, end: timestamp + 3600 }
};

// Collect and create proof
const signals = await astral.stamps.collect('witnesschain');
const stamp = await astral.stamps.create('witnesschain', signals);
const proof = astral.proofs.create(claim, [stamp]);

// SDK evaluates spatial/temporal credibility
const credibility = await astral.proofs.verify(proof);
console.log(credibility.score); // 0.0 - 1.0
```

## How It Works

**1. Challenge Process:**
- Prover claims to be at location (lat, lon)
- Multiple challengers measure RTT to prover's IP
- Challengers perform IP geolocation
- Results are compared to claimed location

**2. Verification:**
- Check challenger signatures
- Validate RTT measurements are within expected ranges
- Verify IP geolocation matches claimed area
- Assess consistency across multiple challengers

**3. Credibility Scoring (SDK):**
- Spatial accuracy based on geolocation precision
- Challenger consensus (more challengers = higher confidence)
- RTT consistency (low variance = higher confidence)

## Plugin Methods

### `collect(options?: CollectOptions): Promise<RawSignals>`

Fetch challenge results from WitnessChain API for the configured prover ID.

**Note:** v0 supports historical mode only (fetches past results). Live challenges require POINTS tokens.

### `create(signals: RawSignals): Promise<UnsignedLocationStamp>`

Transform WitnessChain challenge results into a LocationStamp.

### `sign(stamp: UnsignedLocationStamp, signer: StampSigner): Promise<LocationStamp>`

Add cryptographic signature to the stamp wrapper (challenges are already signed by challengers).

### `verify(stamp: LocationStamp): Promise<StampVerificationResult>`

Verify stamp's internal validity:
- Challenger signatures
- RTT measurement ranges
- IP geolocation consistency
- Signal structure

## Configuration

```typescript
interface WitnessChainPluginOptions {
  proverId?: string;          // WitnessChain prover address
  apiUrl?: string;            // API endpoint (default: production)
  timeout?: number;           // API request timeout (ms)
  maxChallenges?: number;     // Limit number of challenges to fetch
}
```

## Comparison: WitnessChain vs ProofMode

| Aspect | WitnessChain | ProofMode |
|--------|--------------|-----------|
| **Trust Model** | Infrastructure-based (external validators) | Device-based (self-signed) |
| **Verification** | Network latency triangulation | GPS + hardware attestation |
| **Privacy** | IP address exposed to challengers | All data on-device |
| **Accuracy** | City/region level (~10-100km) | GPS precision (~5-50m) |
| **Use Case** | DePIN node verification | Photo/video geotagging |

## Documentation

- [Full Plugin Documentation](https://docs.astral.global/plugins/witnesschain)
- [WitnessChain API](https://docs.witnesschain.com)
- [Plugin Development Guide](https://docs.astral.global/plugins/development)
- [Astral SDK](https://github.com/DecentralizedGeo/astral-sdk)

## Requirements

- Node.js ≥ 18
- WitnessChain prover ID (register at [witnesschain.com](https://witnesschain.com))
- For live challenges: POINTS tokens (historical mode is free)

## Contributing

See [CONTRIBUTING.md](https://github.com/location-proofs/.github/blob/main/CONTRIBUTING.md)

## License

MIT © Astral Protocol

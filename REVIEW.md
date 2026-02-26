# Plugin Standard Compliance Review: `@location-proofs/plugin-witnesschain`

Assessed against the Astral plugin standard published at
[astralprotocol/mintlify-docs](https://github.com/astralprotocol/mintlify-docs),
specifically `plugins/custom.mdx`, `plugins/overview.mdx`, `sdk/plugins.mdx`,
`sdk/stamps.mdx`, `sdk/types.mdx`, `sdk/location-proofs.mdx`,
`concepts/location-proof-structure.mdx`, `concepts/location-proof-evaluation.mdx`,
and `concepts/location-stamps.mdx`.

## Summary

**The plugin adheres to the published standard.** All required properties,
interface implementation, LP v0.2 stamp structure, verification result format,
signature format, and package configuration comply with the specifications
across the Astral documentation. The implementation goes beyond minimum
requirements by implementing all five pipeline methods with thorough
verification and evaluation logic.

---

## Required Plugin Properties

The standard requires five metadata properties on every `LocationProofPlugin`.
All are present:

| Property | Standard | Implementation | Status |
|---|---|---|---|
| `name` | unique identifier | `'witnesschain'` | PASS |
| `version` | semantic version | `'0.1.0'` | PASS |
| `runtimes` | `Runtime[]` | `['react-native', 'node', 'browser']` | PASS |
| `requiredCapabilities` | `string[]` | `['network']` | PASS |
| `description` | human-readable | Present | PASS |

## Interface Implementation

The class `WitnessChainPlugin implements LocationProofPlugin` (`src/index.ts:34`).
All types are imported from `@decentralized-geo/astral-sdk/plugins`, which is
the correct import path.

## Pipeline Methods

The standard defines four optional methods (`collect`, `create`, `sign`,
`verify`), and `concepts/location-proof-structure.mdx` adds a fifth
(`evaluate`). The standard recommends that **API-based services** implement at
minimum `collect`, `create`, and `verify`.

| Method | Recommended | Implemented | Status |
|---|---|---|---|
| `collect()` | Yes (API-based) | `src/collect.ts` | PASS |
| `create()` | Yes (API-based) | `src/create.ts` | PASS |
| `sign()` | Optional | `src/index.ts:79-95` | PASS |
| `verify()` | Yes (API-based) | `src/verify.ts` | PASS |
| `evaluate()` | Yes (per proof-structure spec) | `src/evaluate.ts` | PASS |

All five methods are implemented, exceeding the minimum.

## Location Protocol v0.2 Stamp Structure

The standard (`plugins/custom.mdx`) specifies eight required fields for an
`UnsignedLocationStamp`. All are present in `src/create.ts:39-64`:

| Field | Requirement | Implementation | Status |
|---|---|---|---|
| `lpVersion` | `"0.2"` | `'0.2'` | PASS |
| `locationType` | descriptor | `'geojson-point'` | PASS |
| `location` | GeoJSON geometry or string | `{ type: 'Point', coordinates: [lon, lat] }` | PASS |
| `srs` | spatial reference system | `'EPSG:4326'` | PASS |
| `temporalFootprint` | Unix start/end | `{ start, end }` in Unix seconds | PASS |
| `plugin` | matching plugin name | `'witnesschain'` | PASS |
| `pluginVersion` | semantic version | `'0.1.0'` | PASS |
| `signals` | plugin-specific key-value pairs | Flattened challenge data | PASS |

GeoJSON coordinate order `[longitude, latitude]` is correct per the GeoJSON
spec (RFC 7946).

## StampVerificationResult Structure

The standard (`sdk/stamps.mdx`, `plugins/proofmode.mdx`) specifies the
verification result shape. All fields present in `src/verify.ts:145-151`:

| Field | Required | Implemented | Status |
|---|---|---|---|
| `valid` | `boolean` | Composite of all three flags | PASS |
| `signaturesValid` | `boolean` | ECDSA recovery + Astral sigs | PASS |
| `structureValid` | `boolean` | LP version, plugin, fields | PASS |
| `signalsConsistent` | `boolean` | Coordinate ranges, consolidated result | PASS |
| `details` | object | Rich detail object | PASS |

## LocationStamp Signature Format

The standard (`sdk/stamps.mdx`) requires signatures with signer identity,
algorithm, value, and timestamp. Implementation at `src/index.ts:84-93`
matches exactly:

- `signer`: `{ scheme, value }` identity object
- `algorithm`: `'secp256k1'`
- `value`: hex signature string
- `timestamp`: Unix seconds

## CredibilityVector from evaluate()

The `evaluate()` method returns `{ supportsClaim, score, spatial, temporal,
details }` conforming to the `CredibilityVector` type from the SDK. The
spatial and temporal dimensions align with the evaluation framework in
`concepts/location-proof-evaluation.mdx`. The `score` field at the plugin
level is distinct from the proof-level multidimensional vector assembled by
the `ProofsModule`.

## Package Configuration

| Aspect | Requirement | Implementation | Status |
|---|---|---|---|
| Peer dependency | `@decentralized-geo/astral-sdk` | `>=0.2.0` | PASS |
| Dual format | CJS + ESM | `dist/index.js` + `dist/index.mjs` | PASS |
| Type declarations | `.d.ts` | `dist/index.d.ts` | PASS |
| Node engines | >= 18 | `>=18.0.0` | PASS |

## Test Coverage

Comprehensive test suite at `src/__tests__/witnesschain.test.ts` (354 lines)
covers all five pipeline methods, error paths, edge cases, and a full
lifecycle test. Deterministic fixtures with real ECDSA signatures.

---

## Issues and Observations

### 1. Minor: `verify()` could check more LP v0.2 structural fields

`verify.ts` checks `lpVersion`, `plugin`, `location`, and `temporalFootprint`
but does **not** validate `locationType`, `srs`, `pluginVersion`, or that
`signals` is present. The standard lists all eight fields as required for LP
v0.2 compliance. Adding structure checks for these would make verification
more thorough.

**Severity**: Low. The `create()` path guarantees these fields, so they will
always be present on stamps created by this plugin. But `verify()` could
receive stamps from untrusted sources.

### 2. Minor: `collect()` private key auth flow is incomplete

`src/collect.ts:29` checks for `privateKey` as an alternative to
`sessionCookie`, but the wallet-signing auth flow against WitnessChain's
pre-login endpoint is not implemented — only the cookie path works. The code
accepts `privateKey` in the options without using it, which could confuse
consumers.

**Severity**: Low. Documented limitation for v0 (historical mode only).

### 3. Observation: `evaluate()` not documented in custom plugin guide

The custom plugin guide (`plugins/custom.mdx`) only documents four methods.
The `evaluate` method appears in `concepts/location-proof-structure.mdx` as
the fifth standardized method. This is a docs gap in the standard itself, not
in the plugin.

### 4. Observation: Dual signal format (flattened vs nested)

`create()` flattens challenge result fields into `signals` (e.g.,
`signals.challengeId`, `signals.consolidatedResult`). Meanwhile, `verify()`
looks for `signals.challengeResult` (full nested object) first, then falls
back to flattened fields. This dual-path works correctly but creates a subtle
contract worth documenting.

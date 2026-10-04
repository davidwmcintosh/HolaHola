Public-CA certificate validation and PowerShell publisher approval are separate checks. Noninteractive downloaded helpers can remain blocked even with a valid Authenticode signature. Never infer unattended usability from public-CA issuance alone.

**Why:** The real downloaded Windows helper was rejected before execution; a later dummy smoke passed only after a separately approved one-file trust exception. Microsoft's PowerShell signing documentation confirms a further publisher approval prompt, and Artifact Signing documentation states daily leaf renewal. A rotating leaf may reintroduce publisher approvals despite valid chain trust.

**How to apply:** Evaluate signer rotation alongside Windows publisher trust when choosing a signing provider. Verify exact signer and package pins independently for each artifact. Require separate explicit authorization for acquisition, signing, client trust and test distribution; preserve download marks and organizational policy during native verification. Keep the full evidence and provider comparison in docs/runtime-onboarding-clients.md.

## Bounded stable-signer internal pilot

A stable, dedicated internal signer can make an Internet-marked downloaded PowerShell helper usable noninteractively after separately approved same-user Root and TrustedPublisher trust. This is a bounded internal pilot, not general public distribution.

**Why:** A real fresh downloaded signed package passed the founder-run native dummy smoke while preserving download marks and execution policies. The earlier unsigned downloaded package had required a one-file manual trust exception; signing plus exact publisher trust removed that exception for the tested copy.

**How to apply:** Keep signer/package pins independent of the download, obtain separate operation approvals, and verify the actual marked download before claiming usability. Do not infer expiry-safe or rotated-publisher support from an untimestamped stable-signer pass. Future builds must be signed before their manifest hashes are finalized.

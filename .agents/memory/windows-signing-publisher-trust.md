Public-CA certificate validation and PowerShell publisher approval are separate checks. Noninteractive downloaded helpers can remain blocked even with a valid Authenticode signature. Never infer unattended usability from public-CA issuance alone.

**Why:** The real downloaded Windows helper was rejected before execution; a later dummy smoke passed only after a separately approved one-file trust exception. Microsoft's PowerShell signing documentation confirms a further publisher approval prompt, and Artifact Signing documentation states daily leaf renewal. A rotating leaf may reintroduce publisher approvals despite valid chain trust.

**How to apply:** Evaluate signer rotation alongside Windows publisher trust when choosing a signing provider. Verify exact signer and package pins independently for each artifact. Require separate explicit authorization for acquisition, signing, client trust and test distribution; preserve download marks and organizational policy during native verification. Keep the full evidence and provider comparison in docs/runtime-onboarding-clients.md.

## Bounded stable-signer internal pilot

A stable, dedicated internal signer can make an Internet-marked downloaded PowerShell helper usable noninteractively after separately approved same-user Root and TrustedPublisher trust. This is a bounded internal pilot, not general public distribution.

**Why:** A real fresh downloaded signed package passed the founder-run native dummy smoke while preserving download marks and execution policies. The earlier unsigned downloaded package had required a one-file manual trust exception; signing plus exact publisher trust removed that exception for the tested copy.

**How to apply:** Keep signer/package pins independent of the download, obtain separate operation approvals, and verify the actual marked download before claiming usability. Do not infer expiry-safe or rotated-publisher support from an untimestamped stable-signer pass. Future builds must be signed before their manifest hashes are finalized.

## Untimestamped pilot replacement boundary

An explicitly approved untimestamped internal Windows pilot is a validity-bounded exception, not enduring publisher usability. Replacement requires new explicit operation approvals and independent artifact/certificate evidence; keeping an expired certificate trusted does not extend its validity.

**Why:** The founder selected a no-timestamp pilot, and its marked-download smoke proved only that exact signer/package in the approved machine/user scope during validity. A future renewal decision must not silently inherit the historical exception.

**How to apply:** Plan a manual review before expiry, stop on expiry or invalid signature/trust, and keep certificate creation/acquisition, signing, exact store trust, transfer and publication approvals separate. Require fresh marked-download dummy-only native evidence for the replacement; do not retrofit a success claim to the old download.

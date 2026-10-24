# Security operations

## Backup and rollback

Before this hardening, `backup/pre-security-hardening-20261024` was created and verified at commit `73b9e7af4e829a6952befce4288ce88ea945b2e1`, the then-current `main`.

This is a source/history backup, not a backup of Netlify environment variables. It does not contain later invoices or account changes. To roll back, restore **code only** from the backup in a new commit; preserve current `data/` records. New writes use encrypted format version 2, which the old code cannot read. Do not blindly roll back the data or deploy the old application against version 2 records. Keep a secure copy of the original encryption secret outside GitHub.

## Protections implemented

- Owner and staff must complete authenticator-app TOTP verification before accessing protected APIs, unless they supply a valid remembered-browser token together with their current password. New accounts first replace their temporary passwords, then enroll MFA. Enrollment includes a QR code generated locally with a vendored library; the authenticator secret is never sent to a third-party QR service. Manual key entry remains available. QR images and keys are cleared after verification or sign-out. Existing password-only sessions are invalidated on deployment. Pending setup/verification sessions last 10 minutes; completed sessions last 8 hours.
- First MFA enrollment shows 10 high-entropy, single-use recovery codes. Save them in a password manager. Codes are stored as hashes inside encrypted records and never shown again. Authenticator secrets are encrypted. The browser never persists them to local/session storage.
- Each accepted TOTP timestep is persisted with a conditional GitHub SHA write before full access is granted, preventing code reuse. Recovery-code consumption also uses conditional writes. Concurrent requests fail closed.
- After five invalid MFA attempts for an enrolled account within 15 minutes, authenticator verification pauses for 15 minutes. An unused recovery code can restore access during the pause. This counter is persisted, not held in a single serverless process. A password reset does **not** remove MFA.
- Netlify Edge Function rate rules protect the actual `/.netlify/functions/` routes, including path suffixes: login 10/minute, MFA 8/minute, password changes 6/minute, and all staff APIs 120/minute, per IP and domain. These are request ceilings, not just failed attempts. Shared office networks share an IP budget. Native enforcement can take up to 10 seconds to catch up; these are not exact application-level attempt counters. Distributed attacks are not stopped by per-IP limits alone. MFA provides another layer. No CAPTCHA service or external bot-verification account is required or claimed.
- JSON-only writes, browser origin checks and SameSite=Strict cookies reduce CSRF risk. Cookies are HttpOnly and Secure. Owner password changes, staff password resets/deactivation, and MFA-record version changes invalidate the relevant sessions.
- Only the protected owner can create, reset or remove staff accounts. Staff retain catalogue, invoice and address-lookup access.
- Uploads must have matching raster file signatures and MIME types. Sharp fully decodes and re-encodes them as WebP, discarding metadata and extra content. Limits: 5 MB input/output, 24 megapixels, 12,000-pixel input dimensions and 4,000-pixel output dimensions. Animated GIF/WebP uploads become static first-frame images.
- The build publishes an explicit `public/` allowlist. Private account, invoice and MFA files, server functions, tests and repository metadata are excluded. `data/site.json` remains public intentionally.
- Site-wide CSP, anti-framing, MIME-sniffing, referrer, permissions and HSTS headers are configured. Camera access remains available to same-origin barcode scanning. HSTS is one year, without `includeSubDomains` or preload, to avoid unexpectedly affecting other services.

## Remembered browsers (optional, 30 days)

Before this update, `backup/pre-remember-device-20261024` was created at `49eb601300e788bcc2a4660d7af33469803c92b3`. No production account, catalogue, invoice or MFA records were modified to deploy the feature, and no new environment variables are needed.

- The MFA screen offers **Remember this device for 30 days**, unchecked by default. Trust is created only after successful authenticator or single-use recovery-code verification, including first enrollment. It never replaces the username/password requirement and does not extend the normal eight-hour session.
- A separate host-only `__Host-rfw_trusted` cookie is Secure, HttpOnly, SameSite=Strict and scoped to `/`, with a fixed 30-day deadline. No password, authenticator secret, or device token is written to browser local/session storage. The server stores only a hash of the random bearer secret inside the encrypted MFA record. A selector identifies the device; account ID, username, password version, MFA version and signing key are cryptographically bound to the record.
- Each remembered password login rotates the secret with a conditional GitHub SHA write **before** issuing access. Replaying the previous secret requires MFA. Rotation never extends the original deadline. Storage failures/conflicts fail closed. At most 10 browsers are retained per account; remembering another browser evicts the least recently used when needed. Expired or stale bindings are pruned during trust updates.
- Normal **Sign out** clears the current session but deliberately retains browser trust. On the next login, a valid remembered browser still needs the correct current password but skips the additional MFA prompt. Other browser profiles, private browsing, cleared cookies, expired trust, password resets, removed/disabled accounts or MFA-version changes require MFA or deny login as appropriate.
- Every signed-in user can choose **Forget remembered devices** in the sidebar to revoke all remembered browsers for their own account. Confirmation is required. Sessions established through remembered-browser access are also invalidated; if the current session used that access, the interface returns to sign-in. Ordinary sessions established directly with MFA remain valid until their normal expiry or account/security changes.
- Only enable this on a private, trusted computer. This is trust in a browser cookie, not hardware attestation: someone who steals both the password and an unexpired token could bypass the MFA prompt. Tokens are bearer credentials; do not log, copy, share or commit them. A valid remembered browser can sign in despite a temporary MFA-code cooldown, while still requiring its password and unexpired, unrevoked token.

Tests cover real HTTPS browser cookie handling (including multiple Set-Cookie headers), optional default, sign-out persistence, skipping repeat MFA only after password verification, rotation, absolute expiry, replay/tampering, account/password/MFA binding, opt-out, revocation and derived-session invalidation, storage outages/CAS conflicts, device limits, mobile layout and CSP. Live Netlify deployment still requires verification.

## Encryption and key management

Keep the current `SESSION_SECRET` unchanged for deployment. Existing version 1 AES-GCM account/invoice records remain readable. New records use version 2 AES-GCM with purpose-specific authenticated data. HKDF derives distinct signing and encryption keys even when the existing root secret is used.

For **independently rotatable** keys, set in Netlify (Functions scope, redeploy afterwards):

- `DATA_ENCRYPTION_KEY`: a new cryptographically random value of at least 32 bytes. New records use it and are marked `data-key`. Existing records still use the original root until migrated.
- `SESSION_SIGNING_KEY`: a different random value of at least 32 bytes. Changing it signs everyone out and invalidates remembered-browser bindings without changing data encryption.
- `LEGACY_ENCRYPTION_SECRET`: only needed when retiring/changing the original `SESSION_SECRET`; it must retain the exact old value until all legacy records are migrated. Do not guess or regenerate it.

Do not change or remove `DATA_ENCRYPTION_KEY` after writing records with it. Back it up securely. Do not paste real keys into chat, commit them, or include them in logs. Migration is deliberately not automatic: `scripts/migrate-encryption.cjs` defaults to a read-only dry run and requires `--apply` to write. Make a fresh backup branch and pause staff changes before applying; preserve both keys until verified. This low-volume GitHub-backed design is not a replacement for a dedicated database or managed identity provider.

## Required deployment checks

1. Netlify must use this repository's `netlify.toml`: `npm run build`, publish directory `public`, Node 22, npm dependency installation enabled. Remove any old UI override that publishes `.`. The `sharp` native dependency must be bundled with the functions.
2. After deployment, inspect the Netlify post-processing/deploy log for **all four accepted rate-limit rules**. Invalid rules do not necessarily fail a deploy. The local manifest validator is not proof of live enforcement.
3. Confirm HTTPS on every public hostname and HTTP-to-HTTPS redirects. Check the response headers on `/`, `/products/`, `/safety/`, `/admin/` and unauthenticated function responses.
4. Verify `/data/admin-users.enc.json`, `/data/security.enc.json`, `/data/invoices/`, `/netlify/functions/_lib.cjs`, `/tests/` and `/package.json` return 404, while `/data/site.json` still works. Netlify function URLs are separately deployed and should require authentication, not expose source.
5. Sign in as owner and save MFA recovery codes. Have each staff member enroll promptly. MFA enrollment trusts the first successful password login: do this before sharing the panel broadly. Use unique, strong owner/staff passwords and MFA on both GitHub and Netlify accounts.
6. Test a staff account: password-only and temporary-password sessions must not access products/invoices. Test address lookup, uploads, barcode/camera scanning, invoices, labels and print. Old password-only cookies should require a new login.
7. Use a fine-grained GitHub token restricted to this repository with Contents read/write, short expiry and no wider permissions. Review Netlify team access and environment-variable scopes. Prefer a **private repository**: excluding files from the website does not remove encrypted records from the repository or its history, nor revoke copies already downloaded. Do not store card numbers, payment credentials or unnecessary customer data.
8. Check Netlify security/usage logs and GitHub activity for abuse, configure available alerts, and review account access regularly. `npm audit` and `npm test` should remain clean; update Sharp promptly because it parses untrusted files.

## Recovery and limitations

If an authenticator is lost, use one of its recovery codes. A staff password reset intentionally cannot bypass MFA. If all second factors are lost, an authorized repository/environment administrator must perform a controlled, audited recovery of the affected encrypted MFA record; the application has no public MFA-disable endpoint. Do not delete the entire security file or rotate encryption secrets as a workaround: that would affect other users or destroy data access.

Local tests cover cryptographic vectors, authentication gates, replay prevention, recovery, conflicts, account lockout, legacy encryption compatibility, upload validation, public-file exclusion, and browser workflows. They are not an independent penetration test, a breach investigation, a DDoS guarantee, or verification of Netlify account settings/live deployment. No website is breach-proof.

References: Netlify rate-limit documentation: https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/ ; TOTP: RFC 6238.

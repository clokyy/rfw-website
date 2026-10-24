# Security operations

## Backup and rollback

Before this hardening, `backup/pre-security-hardening-20261024` was created and verified at commit `73b9e7af4e829a6952befce4288ce88ea945b2e1`, the then-current `main`.

This is a source/history backup, not a backup of Netlify environment variables. It does not contain later invoices or account changes. To roll back, restore **code only** from the backup in a new commit; preserve current `data/` records. New writes use encrypted format version 2, which the old code cannot read. Do not blindly roll back the data or deploy the old application against version 2 records. Keep a secure copy of the original encryption secret outside GitHub.

## Protections implemented

- Owner and staff must complete authenticator-app TOTP verification before accessing protected APIs. New accounts first replace their temporary passwords, then enroll MFA. Enrollment includes a QR code generated locally with a vendored library; the authenticator secret is never sent to a third-party QR service. Manual key entry remains available. QR images and keys are cleared after verification or sign-out. Existing password-only sessions are invalidated on deployment. Pending setup/verification sessions last 10 minutes; completed sessions last 8 hours.
- First MFA enrollment shows 10 high-entropy, single-use recovery codes. Save them in a password manager. Codes are stored as hashes inside encrypted records and never shown again. Authenticator secrets are encrypted. The browser never persists them to local/session storage.
- Each accepted TOTP timestep is persisted with a conditional GitHub SHA write before full access is granted, preventing code reuse. Recovery-code consumption also uses conditional writes. Concurrent requests fail closed.
- After five invalid MFA attempts for an enrolled account within 15 minutes, authenticator verification pauses for 15 minutes. An unused recovery code can restore access during the pause. This counter is persisted, not held in a single serverless process. A password reset does **not** remove MFA.
- Netlify Edge Function rate rules protect the actual `/.netlify/functions/` routes, including path suffixes: login 10/minute, MFA 8/minute, password changes 6/minute, and all staff APIs 120/minute, per IP and domain. These are request ceilings, not just failed attempts. Shared office networks share an IP budget. Native enforcement can take up to 10 seconds to catch up; these are not exact application-level attempt counters. Distributed attacks are not stopped by per-IP limits alone. MFA provides another layer. No CAPTCHA service or external bot-verification account is required or claimed.
- JSON-only writes, browser origin checks and SameSite=Strict cookies reduce CSRF risk. Cookies are HttpOnly and Secure. Owner password changes, staff password resets/deactivation, and MFA-record version changes invalidate the relevant sessions.
- Only the protected owner can create, reset or remove staff accounts. Staff retain catalogue, invoice and address-lookup access.
- Uploads must have matching raster file signatures and MIME types. Sharp fully decodes and re-encodes them as WebP, discarding metadata and extra content. Limits: 5 MB input/output, 24 megapixels, 12,000-pixel input dimensions and 4,000-pixel output dimensions. Animated GIF/WebP uploads become static first-frame images.
- The build publishes an explicit `public/` allowlist. Private account, invoice and MFA files, server functions, tests and repository metadata are excluded. `data/site.json` remains public intentionally.
- Site-wide CSP, anti-framing, MIME-sniffing, referrer, permissions and HSTS headers are configured. Camera access remains available to same-origin barcode scanning. HSTS is one year, without `includeSubDomains` or preload, to avoid unexpectedly affecting other services.

## Encryption and key management

Keep the current `SESSION_SECRET` unchanged for deployment. Existing version 1 AES-GCM account/invoice records remain readable. New records use version 2 AES-GCM with purpose-specific authenticated data. HKDF derives distinct signing and encryption keys even when the existing root secret is used.

For **independently rotatable** keys, set in Netlify (Functions scope, redeploy afterwards):

- `DATA_ENCRYPTION_KEY`: a new cryptographically random value of at least 32 bytes. New records use it and are marked `data-key`. Existing records still use the original root until migrated.
- `SESSION_SIGNING_KEY`: a different random value of at least 32 bytes. Changing it signs everyone out without changing data encryption.
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

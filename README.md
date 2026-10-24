# Regina Fireworks website

A responsive Regina Fireworks redesign with lightweight JavaScript animations, cross-page transitions, scroll reveals, subtle parallax, sticky navigation, and reduced-motion support.

## Pages
- `/` — responsive home page
- `/products/` — complete 111-product catalogue with all 11 original subcategories, search, and progressive loading
- `/safety/` — consumer firework safety guidance adapted from Natural Resources Canada
- `/admin/` — custom username/password administration panel

## Admin-managed content
The custom admin panel uses a simple username and password. The environment-variable account is the protected owner; after signing in, only the owner can add, remove, and reset passwords for additional administrators in the dedicated **Administrators** section. Additional accounts include first name, last name, username, and an automatically generated temporary password. Passwords use unique salts and scrypt password hashes. The account records are then encrypted with AES-256-GCM using purpose-separated encryption keys derived from the configured encryption root and saved to `data/admin-users.enc.json` through the existing GitHub connection. Keep `SESSION_SECRET` unchanged; changing it makes existing additional-account records unreadable.

Products and contact details are managed in separate sections. Each product can have a non-negative whole-number inventory value; inventory `0` displays a Sold out ribbon on its public product image, while a blank value leaves inventory untracked. Product editing supports JPG, PNG, WebP, and GIF uploads only, with a 5 MB limit enforced in both the browser and server function.

Website changes are committed to `data/site.json` through a protected Netlify Function, which triggers a fresh deployment. The initial test email is `test@reginafireworks.ca`.

## Preview
Serve the project through a local web server and open `/admin/?preview=1` to preview the dashboard without authentication. Preview mode cannot publish or upload files.

## Deploy on Netlify
1. Create a Netlify site from `clokyy/rfw-website`. Use build command `npm run build`, publish directory `public`, and Node 22 (configured in `netlify.toml`). Dependencies must be installed so image processing is available.
2. In **Project configuration → Environment variables**, add:
   - `ADMIN_USERNAME` — the admin username.
   - `ADMIN_PASSWORD` — a strong admin password.
   - `SESSION_SECRET` — a long random value used to sign secure login cookies.
   - `GITHUB_TOKEN` — a fine-grained GitHub token restricted to this repository with **Contents: Read and write**.
   - Optional: `ADMIN_FIRST_NAME` and `ADMIN_LAST_NAME` — display name for the protected owner account.
3. Trigger a new deployment so the functions receive the environment variables.
4. Open `/admin/`, sign in with the configured username and password, enroll an authenticator app, and securely save your one-time MFA recovery codes. All staff must complete MFA; new staff first change their temporary passwords.
5. Follow [SECURITY.md](SECURITY.md) for rate-limit verification, independent key setup, data migration, deployment checks and recovery. Do not rotate the original encryption secret without migration.

The credentials and GitHub token remain server-side in Netlify. Never commit them to this repository. The previous GitHub OAuth/Decap setup is no longer used.

Netlify serves the folder routes without `.html`; legacy `/products.html` and `/safety.html` links redirect to the clean URLs.

## Before launch
- Confirm all copy, sales windows, and legal wording.
- Confirm phone number and address.
- Add an email address if desired.
- Replace or expand product content when a current inventory list is available.
- Connect analytics and a custom domain through the chosen host.

## Invoices
The **Invoices** section supports a product-based invoice builder, customer/billing details, quantities, editable unit prices, optional due dates, GST/PST rates, payment notes, and print / Save PDF. Amounts are in CAD; tax rates default to GST 5% and PST 6% and remain editable by the administrator. Saved invoices are immutable snapshots of seller details, products, prices, and creator identity. The server computes totals in integer cents and assigns the signed-in administrator (never a creator supplied by the browser). The invoice register filters by local creation date, administrator, and minimum/maximum order total. All active administrators can view the register.

Invoice records are AES-256-GCM encrypted using purpose-separated encryption keys derived from the configured encryption root and saved individually under `data/invoices/<uuid>.json` through the same GitHub token. Keep this secret unchanged and back it up securely; rotating it without migration makes account and invoice records unreadable. Invoice commits use `[skip ci]` to avoid unnecessary website rebuilds. Product/contact changes still require **Save changes**; invoice creation saves immediately and uses the published catalogue. Creating invoices does **not** decrement inventory or collect payment. Local preview invoices are temporary and disappear on refresh. This GitHub-backed register is intended for low-volume use (GitHub directory listings support up to 1,000 files); move invoice storage to a database before approaching that limit.

## Billing address autocomplete (Geoapify)
Create a Geoapify project at https://myprojects.geoapify.com/ and copy its API key into **Netlify → Project configuration → Environment variables → `GEOAPIFY_API_KEY`**, available to Functions. Redeploy after adding or changing it. The key is only used by the authenticated `admin-addresses` server function and is never returned to the browser or committed to the repository. If using Geoapify key restrictions, allow server-side requests from Netlify (browser-origin-only restrictions will not match this proxy).

Billing address suggestions search Canada, with ranking biased toward Regina. Typing at least 3 characters triggers a debounced lookup; selecting a suggestion fills street address, city, province, postal code, and country. Suite/unit is entered separately and preserved. All fields remain editable; missing components must be filled manually. The typed street-address search is shared with Geoapify; customer names, email, phone, and suite/unit are not sent. Geoapify/OpenStreetMap attribution is displayed in the builder. Missing configuration, quota errors, or outages leave manual billing entry and invoice creation available. Structured fields are encrypted with the invoice and printed as a combined billing address; existing invoices keep their original address. Local preview requires a function emulator for live suggestions; interface tests mock provider responses rather than call Geoapify. Monitor your Geoapify quota and select a plan appropriate to usage.

Invoice printing uses a compact 9.5-point layout, 10 mm margins, tighter line items and summary spacing, and repeated table headers on multi-page invoices. Typical invoices target 1–2 pages; very long product names, many items, or lengthy notes can require more pages. Existing saved invoice tax rates and amounts are not changed by new defaults.

## Admin startup and sign-in transition
The admin page starts with a neutral session-check screen, with the login form hidden in the initial HTML. An authenticated refresh loads the dashboard directly without flashing the login page; unauthenticated or expired sessions show sign-in. Temporary network/loading failures show a retry action rather than implying a logout, and do not clear the session cookie. Successful sign-in fades the login overlay out while the dashboard enters; reduced-motion preferences disable the movement. The existing secure, HttpOnly eight-hour session cookie and server-side access checks are unchanged; no authentication token or private dashboard data is cached in browser storage.

## Public navigation, product deletion, and browser autofill
Public pages share cross-document view-transition styles; supporting browsers animate navigation natively, while older browsers use a short fade-out/slide-in fallback. Hash links, external URLs, new-tab/modifier clicks, downloads, and reduced-motion preferences keep normal browser behavior. Browser back/forward restores the page without leaving it faded out. Transitions no longer run twice through the content script.

Removing products opens an accessible in-page confirmation dialog with the product name, a safe **Keep product** default, Escape dismissal, and a reminder that changes become public only after **Save changes**.

Administrator-creation fields and invoice customer/billing fields request `autocomplete="off"`; account creation also supplies opt-out hints for common third-party password managers. Normal admin sign-in retains username/current-password autocomplete. These are hints, not a guarantee: Chrome and password managers may ignore them. To stop save prompts completely on a workstation, disable address saving/filling and password-save offers in that browser's settings. No hidden dummy fields or focus/readonly hacks are used, so manual entry and keyboard accessibility remain intact.

Admin sidebar navigation also fades/slides in the selected Products, Invoices, Contact details, or Administrators panel and softly transitions its heading. The sidebar does not move. Rapid switching cancels previous animations; clicking the current section does not replay the animation. Panels retain their DOM and input values, and reduced-motion preferences make navigation immediate.

## Homepage presentation and White City sales
The homepage has an early CSS entrance with a gentle background reveal and staggered headline/action transitions. The hero image is preloaded; native cross-document transitions suppress the separate homepage entrance to avoid stacked effects, and reduced-motion visitors see the content immediately. The supplied fireworks photograph replaces the abstract story graphic after conservative denoising, contrast/colour correction, and sharpening. The optimized WebP is packaged in an SVG image asset for the text-based repository upload workflow.

Regina-specific seasonal-sales/bylaw banners and dates were replaced with White City ordering and pickup instructions. Public pickup footers now say White City and ask visitors to call for the exact location; the old Regina directions link was removed from the homepage. No exact White City street address was supplied, so none was invented. General safety, fire-ban, and local-law guidance remains. Existing admin-managed business/billing address data is unchanged.

### Printable product asset tags

Open **Asset tags** in the admin sidebar. Tags derive directly from the current catalogue (including hidden products), so adding, editing or removing a product updates the available labels automatically. No separate label records or server migration are needed. Save changes to persist catalogue edits for future visits.

- Default stock: Letter, 30 labels (3 × 10), 1 inch × 2⅝ inch, Avery 5160 / 8160 layout.
- Labels display Regina Fireworks, product name, a scannable Code 128 barcode and its internal ID, product code and the catalogue price in CAD; missing prices show “Call for price.”
- Search and select products, set 0–99 copies per product, or choose a starting label position for a partly used first sheet. Selection/copies reset on reload; maximum 3,000 labels per job.
- Preview, then Print / Save PDF. Choose Letter, 100% / Actual size, no margins, and turn browser headers/footers off. Always test alignment on plain paper before printing label stock.
- Print layout is isolated in an iframe to avoid affecting invoice printing.
- Browser regression test: serve the repository at port 8765, then run `node tests/labels.cjs` with Playwright available and Chromium installed (`CHROMIUM_PATH` can override its path). Covers all catalogue labels, copy counts, partial sheets, product add/remove, escaping, clipping, print invocation and mobile layout.

### Barcode scanning for invoices

The invoice builder is now scan-first. Reprint old plain-text asset tags to use the new barcode format.

- **USB scanner (laptop):** use a Code 128-capable scanner in USB HID / keyboard mode with an Enter suffix. Create an invoice, focus **USB scanner / barcode**, then scan each tag. Each scan adds one unit at the current catalogue price; another scan of the same tag increments its existing line. Unknown IDs do not add a product.
- **iPhone / camera:** open the invoice builder on the iPhone in Safari over HTTPS, tap **Scan with iPhone / camera**, and allow camera access. Hold one barcode steady. After it is added, tap **Scan next item** to arm the next scan. This prevents a stationary barcode from repeatedly increasing quantity. The phone edits its own invoice; it is not paired as a remote scanner for an invoice open on another computer.
- Camera decoding uses locally bundled ZXing (not the inconsistent native BarcodeDetector API), and no images/video are uploaded. Camera tracks stop when closed, when the page is hidden, or when an invoice is submitted. USB entry and manual lookup remain available if camera access fails.
- **Find a product manually** remains as a collapsible fallback. Products without a numeric catalogue price still require entering a unit price before saving. Existing invoice tax, validation, attribution and encrypted-storage behavior is unchanged.
- Every product has a separate immutable internal ID in the form `RF` plus 12 digits, including products without a product code. Legacy catalogue IDs are derived deterministically until their next catalogue save; new products get random, collision-checked IDs. Edits preserve them, and backend catalogue validation retains IDs and rejects duplicates/invalid values. Save catalogue changes before relying on tags for newly added products. Supplier barcodes / UPCs are not mapped automatically.
- Barcode SVGs are printed with 10-module quiet zones. Keep Letter / Actual size (100%), no browser headers/footers, and test physical alignment and scanning before printing a batch.

Tests: `node tests/barcodes.cjs` covers barcode ID/persistence/validation. With Playwright and local preview at port 8766 applying the admin CSP, `node tests/scanning.cjs` decodes every generated barcode and checks USB input, quantities, errors and invoice creation. `tests/camera-scanning.cjs` exercises the actual camera decoder using the included vector fixture `tests/fixtures/camera-code128.svg`, ImageMagick and FFmpeg to generate a temporary camera stream, including repeat-scan prevention, permission errors and late-stream cleanup. Real iPhone / USB hardware testing should be done with the intended printer and scanner.

### Invoice payments and removal

Open **Invoices**, then **View** an invoice. New and legacy invoices display **Unpaid** until payment is recorded. Choose **Cash** or **E-transfer**, then click **Mark as paid** after the full amount has been received. This records the payment method, timestamp, and signed-in administrator without changing line items, taxes, totals, invoice number, or original creator. This is manual recordkeeping, not a payment processor or bank verification. Partial payments and changing/reversing recorded payments are not supported. Paid status and method appear in the register and on printed invoices / PDFs.

Use **Remove invoice** in the invoice view to open a confirmation naming the invoice and customer. **Keep invoice** is the default; removal takes effect immediately after confirmation and does not require the catalogue's Save changes button. All active administrators have these controls. Removed invoices disappear from the current register and cannot be restored through the app; encrypted historical copies may remain in GitHub history, so removal is not permanent data erasure. Existing encryption and authentication remain in place. Payment and deletion writes use the current GitHub file SHA to prevent overwriting concurrent changes; storage errors leave the current invoice intact and show a retryable error. An identical repeat payment request keeps its original timestamp/administrator, while a conflicting method is rejected.

`node tests/invoices.cjs` covers server-side create/list/view/payment/delete, validation, authorization, encryption, legacy records, and storage conflicts. `node tests/invoice-management.cjs` covers management controls, both methods, confirmations, errors, list updates, reload persistence, mobile layout, and print output with Playwright and the CSP preview server on port 8766. Local preview changes stay in memory and are not real invoice changes.

### Staff onboarding and first-sign-in password setup

The homepage footer includes a **Staff Panel** button linking to `/admin/`. In **Administrators → Add administrator**, enter the person's name and username; the server generates a unique 24-character temporary password. The creator sees the username/password once in a copyable dialog, which clears on close. Share it through a secure channel. Plaintext passwords are not written to the repository or browser storage. A lost temporary password can be replaced with **Reset password**, which generates another temporary password and invalidates the account's previous sessions.

New accounts (and reset accounts) must choose a different 12–128-character password and confirm it before viewing or changing panel data. Temporary logins receive a restricted 30-minute session that can only check sign-in state, sign out, or complete password setup. Every protected function checks the account and password version, so bypassing the screen, using an old token after reset, or reloading does not bypass setup. Successful setup updates the salted scrypt hash in the encrypted account record and issues the normal secure eight-hour session. Record writes use an expected GitHub SHA to reject concurrent updates instead of overwriting them. The environment-managed owner and existing accounts without a setup flag keep their existing sign-in behaviour. Resetting your own account signs you out after closing the one-time credentials dialog.

`node tests/admin-onboarding.cjs` tests account creation, one-time credentials, first-sign-in enforcement across all protected endpoints, password validation, legacy accounts, resets, stale/removed/expired sessions, encryption and storage conflicts. `node tests/admin-onboarding-ui.cjs` tests the real function handlers behind mocked storage, first-login/reload flow, credential clearing, mobile layout, failure recovery and the homepage Staff Panel link. Tests never create production accounts.

## Security hardening

Read [SECURITY.md](SECURITY.md) before deployment or key rotation. The public build excludes private data and server source. MFA is required, staff-account management is owner-only, and raster uploads are validated and converted to static WebP. Existing encrypted records remain compatible; separately configured encryption/signing keys are supported. Run `npm ci`, `npm test`, `npm run build`, and `npm run test:ui` (requires Python 3.11+ and Chromium). Live Netlify rate-limit/header checks remain required.

# Regina Fireworks website

A responsive Regina Fireworks redesign with lightweight JavaScript animations, cross-page transitions, scroll reveals, subtle parallax, sticky navigation, and reduced-motion support.

## Pages
- `/` — responsive home page
- `/products/` — complete 111-product catalogue with all 11 original subcategories, search, and progressive loading
- `/safety/` — consumer firework safety guidance adapted from Natural Resources Canada
- `/admin/` — custom username/password administration panel

## Admin-managed content
The custom admin panel uses a simple username and password. The environment-variable account is the protected owner; after signing in, the owner or another administrator can add, remove, and reset passwords for additional administrators in the dedicated **Administrators** section. Additional accounts include first name, last name, username, and a password. Passwords use unique salts and scrypt password hashes. The account records are then encrypted with AES-256-GCM using `SESSION_SECRET` and saved to `data/admin-users.enc.json` through the existing GitHub connection. Keep `SESSION_SECRET` unchanged; changing it makes existing additional-account records unreadable.

Products and contact details are managed in separate sections. Each product can have a non-negative whole-number inventory value; inventory `0` displays a Sold out ribbon on its public product image, while a blank value leaves inventory untracked. Product editing supports JPG, PNG, WebP, and GIF uploads only, with a 5 MB limit enforced in both the browser and server function.

Website changes are committed to `data/site.json` through a protected Netlify Function, which triggers a fresh deployment. The initial test email is `test@reginafireworks.ca`.

## Preview
Serve the project through a local web server and open `/admin/?preview=1` to preview the dashboard without authentication. Preview mode cannot publish or upload files.

## Deploy on Netlify
1. Create a Netlify site from `clokyy/rfw-website`. No build command is required; the publish directory is `.`.
2. In **Project configuration → Environment variables**, add:
   - `ADMIN_USERNAME` — the admin username.
   - `ADMIN_PASSWORD` — a strong admin password.
   - `SESSION_SECRET` — a long random value used to sign secure login cookies.
   - `GITHUB_TOKEN` — a fine-grained GitHub token restricted to this repository with **Contents: Read and write**.
   - Optional: `ADMIN_FIRST_NAME` and `ADMIN_LAST_NAME` — display name for the protected owner account.
3. Trigger a new deployment so the functions receive the environment variables.
4. Open `/admin/` and sign in with the configured username and password.

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

Invoice records are AES-256-GCM encrypted using `SESSION_SECRET` and saved individually under `data/invoices/<uuid>.json` through the same GitHub token. Keep this secret unchanged and back it up securely; rotating it without migration makes account and invoice records unreadable. Invoice commits use `[skip ci]` to avoid unnecessary website rebuilds. Product/contact changes still require **Save changes**; invoice creation saves immediately and uses the published catalogue. Creating invoices does **not** decrement inventory or collect payment. Local preview invoices are temporary and disappear on refresh. This GitHub-backed register is intended for low-volume use (GitHub directory listings support up to 1,000 files); move invoice storage to a database before approaching that limit.

## Billing address autocomplete (Geoapify)
Create a Geoapify project at https://myprojects.geoapify.com/ and copy its API key into **Netlify → Project configuration → Environment variables → `GEOAPIFY_API_KEY`**, available to Functions. Redeploy after adding or changing it. The key is only used by the authenticated `admin-addresses` server function and is never returned to the browser or committed to the repository. If using Geoapify key restrictions, allow server-side requests from Netlify (browser-origin-only restrictions will not match this proxy).

Billing address suggestions search Canada, with ranking biased toward Regina. Typing at least 3 characters triggers a debounced lookup; selecting a suggestion fills street address, city, province, postal code, and country. Suite/unit is entered separately and preserved. All fields remain editable; missing components must be filled manually. The typed street-address search is shared with Geoapify; customer names, email, phone, and suite/unit are not sent. Geoapify/OpenStreetMap attribution is displayed in the builder. Missing configuration, quota errors, or outages leave manual billing entry and invoice creation available. Structured fields are encrypted with the invoice and printed as a combined billing address; existing invoices keep their original address. Local preview requires a function emulator for live suggestions; interface tests mock provider responses rather than call Geoapify. Monitor your Geoapify quota and select a plan appropriate to usage.

Invoice printing uses a compact 9.5-point layout, 10 mm margins, tighter line items and summary spacing, and repeated table headers on multi-page invoices. Typical invoices target 1–2 pages; very long product names, many items, or lengthy notes can require more pages. Existing saved invoice tax rates and amounts are not changed by new defaults.

# Regina Fireworks website

A responsive Regina Fireworks redesign with lightweight JavaScript animations, cross-page transitions, scroll reveals, subtle parallax, sticky navigation, and reduced-motion support.

## Pages
- `/` — responsive home page
- `/products/` — complete 111-product catalogue with all 11 original subcategories, search, and progressive loading
- `/safety/` — consumer firework safety guidance adapted from Natural Resources Canada
- `/admin/` — custom username/password administration panel

## Admin-managed content
The custom admin panel uses a simple username and password. The environment-variable account is the protected owner; after signing in, the owner or another administrator can add, remove, and reset passwords for additional administrators in the dedicated **Administrators** section. Additional accounts are stored in Netlify Blobs with unique salts and scrypt password hashes—never in GitHub.

Products and contact details are managed in separate sections. Product editing supports JPG, PNG, WebP, and GIF uploads only, with a 5 MB limit enforced in both the browser and server function.

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

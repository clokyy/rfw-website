# Regina Fireworks website

A responsive Regina Fireworks redesign with lightweight JavaScript animations, cross-page transitions, scroll reveals, subtle parallax, sticky navigation, and reduced-motion support.

## Pages
- `/` — responsive home page
- `/products/` — complete 111-product catalogue with all 11 original subcategories, search, and progressive loading
- `/safety/` — consumer firework safety guidance adapted from Natural Resources Canada
- `/admin/` — Decap CMS admin panel

## Admin-managed content
The admin panel edits `data/site.json` in GitHub. It can add, remove, reorder, hide, and edit products (including product photos), and update the phone number, address, and email used across the website.

The initial test email is `test@reginafireworks.ca`.

## Preview
Serve the project through a local web server so the pages can load `data/site.json`. For example, run `python -m http.server 8000` and open `http://localhost:8000`.

## Deploy on Netlify
1. Create a new Netlify site from the `clokyy/rfw-website` GitHub repository. No build command is required; the publish directory is `.`.
2. Create a GitHub OAuth App. Use the Netlify site URL as the homepage URL and `https://api.netlify.com/auth/done` as the callback URL.
3. In the Netlify site settings, add GitHub as an OAuth authentication provider using the app's client ID and secret.
4. Open `/admin/` on the deployed site and sign in with a GitHub account that has push access to the repository.

Netlify serves the folder routes without `.html`; legacy `/products.html` and `/safety.html` links redirect to the clean URLs.

## Before launch
- Confirm all copy, sales windows, and legal wording.
- Confirm phone number and address.
- Add an email address if desired.
- Replace or expand product content when a current inventory list is available.
- Connect analytics and a custom domain through the chosen host.

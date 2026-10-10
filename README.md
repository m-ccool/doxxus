# doxxus.us

Personal portfolio & service site for **B McCool** — freelance web developer.

## Product Planning

- [E-commerce MVP outline](docs/mvp-outline.md) — approved direction for packages, consultations, payments, client portal, and admin operations.

## Stack

- **HTML5 / CSS3** — custom theming, Bootstrap 5.3 overrides, rainbow gradient system
- **Bootstrap 5.3** — responsive layout, modals, navbar collapse
- **JavaScript / jQuery** — AOS scroll animations, Swiper carousel, smooth scroll
- **Third-party libs** — AOS, Swiper, FontAwesome 5, Typicons, GitHub Activity Feed
- **Supabase** — Postgres (clients, projects, notes, form submissions), Google and email-code sign-in, and the `contact` Edge Function
- **Hosting** — static site on GitHub Pages; Supabase for everything that needs a server

## Structure

```
index.html          — landing page (splash, software tier, IT tier, portfolio, about)
services.html       — software spec sheet, package tiers, add-ons, consultation, IT tier
build.html          — package builder (assemble a package and send the request)
signin.html         — sign-in for clients and the admin (Google or an emailed one-time code, through Supabase Auth)
account.html        — client dashboard with tabs: Overview, Project, Files & links, Account (signed-in only)
admin.html          — admin hub: clients, contracts, projects, files & links, private notes, submissions (admin role only)
terms.html          — terms of service
privacy.html        — privacy policy
sitemap.xml         — public URL list
docs/mvp-outline.md — ecommerce MVP and client portal plan
supabase/
  migrations/       — database schema, row-level security policies and grants
  functions/contact/ — Edge Function behind the contact modal and package builder
assets/
  css/
    style.css             — primary custom styles, CSS variables, ds-* design system
    animate.css           — custom keyframe animations (gradient, hueRotate, typing, etc.)
    bs-theme-overrides.css — Bootstrap :root overrides
    comet.compiled.css    — canvas style for the background shooting stars
    github-plugin.css     — GitHub activity feed styles
    globe.css             — globe icon styles
    particle.compiled.css — particle background animation
    swiper-icons.css      — swiper nav icon overrides
  js/
    site-shell.js   — injects navbar, footer and contact modal on every page
    router.js       — client-side navigation with a persistent navbar
    pages.js        — window (traffic-light) behaviour, package builder
    portal.js       — sign-in (Google or email code) and the shared session helpers
    portal-ui.js    — shared portal UI: tabs, form fields, progress model, formatting
    account.js      — the client dashboard
    admin.js        — the admin hub: client list, contract, notes, submissions
    admin-projects.js — admin project editor: phases and milestones
    admin-files.js  — admin links and file uploads
    portfolio-data.js, portfolio-carousel.js — portfolio gallery data and engine
    code-titles.js  — `$` code-style titles with the typing animation
    glitch.js       — glitch-typing effect (home page and contact modal labels)
    home.js         — home page behaviours
    explore-prompt.js — hero `$ explore projects? [Y/n]` prompt, globe tilt and scroll hand-off
    bs-init.js      — Bootstrap tooltip/AOS init
    comet.js        — shooting stars, drawn on a canvas inside the background star layer
    plugins.js      — vendor bundle (Swiper, WOW, Pace); loads before Bootstrap 5
    scripts.js      — navbar scroll, carousel, cursor, last-online, misc
  fonts/
  img/
```

## Dev Notes

- CSS variables in `:root` inside `style.css` define the full color/gradient system
- `ds-*` classes are the design system primitives shared by every page
- Rainbow gradient: `--rainbow-gradient: linear-gradient(-45deg, var(--pink), var(--indigo), var(--purple), var(--teal), var(--green))`
- Dark theme: `--bs-body-color: #0d0d0e`, `--bs-body-bg: #0f0f10`
- Navbar, footer and contact modal are injected by `site-shell.js` via the
  `data-site-nav` / `data-site-footer` mount points — edit them there, not per page
- `plugins.js` bundles Bootstrap 4, so it must load **before** Bootstrap 5
- Contact and package forms post to the Supabase `contact` Edge Function and only
  treat the literal `success` response as sent. It validates, rate-limits per IP, stores the
  message in `submissions`, then emails you and the sender from `dev@doxxus.us` over SMTP
- Edge Function secrets (set in the Supabase dashboard, never committed): `SMTP_USER`,
  `SMTP_PASS`, `IP_SALT`. Without them messages are still stored but no email is sent
- Sign-in is Google or an emailed one-time code; a client sees data only when their email matches a row
  in `clients`. The admin hub creates clients and projects; no table editing needed
- Clients can change only their additional contact. Everything else (contract, projects, phases, files) is
  admin-only, enforced by a trigger and row-level security, not by the pages
- Apply `supabase/migrations/20261010000000_portal_v2.sql` after the admin migration. It adds the contract columns,
  phases and milestones, links and files tables, and a private `client-files` storage bucket (files reach clients
  through short-lived signed links). The hand-test checklist is at the bottom of that file
- **Admin account:** Create a Supabase Auth user (email: `dev@doxxus.us`, or your own), then run this SQL in the Supabase SQL Editor:
  ```sql
  update auth.users
  set app_metadata = jsonb_set(
    coalesce(app_metadata, '{}'::jsonb),
    '{role}',
    '"admin"'
  )
  where email = 'dev@doxxus.us';
  ```
  Then sign out and back in. Email code sign-in works without a password. The admin hub is not a security boundary by itself: the database policies enforce it, so a non-admin who opens `admin.html` gets nothing
- The navbar account button shows the right menu (client or admin) from the session Supabase stores in the browser. That
  is for display only; every portal page re-checks the session
- The publishable Supabase key in `portal.js` is public by design; secret keys never go in the repo
- Billing is Stripe's hosted customer portal; set `BILLING_PORTAL_URL` in `account.js` once it exists
- Stylesheets and scripts are linked with a `?v=` query (GitHub Pages and browsers cache them hard). After changing a
  file under `assets/`, bump the value in every page, e.g. `(Get-ChildItem *.html) | % { (gc $_ -Raw) -replace '\?v=20261010e','?v=NEW' | sc $_ }`;
  `site-shell.js` has one copy too
- Serve locally with `python -m http.server 8777`

## Style References for Agents
- Liquid Glass Pro Max - https://codepen.io/fand/pen/azmPjqd
- Liquid Glass - https://codepen.io/toi-nagasawa/pen/wBzWebb
- Liquid Metal - https://codepen.io/Majoramari/pen/pvbzpoa


## Contact

**dev@doxxus.us** · [linkedin](https://www.linkedin.com/in/b-m-ccool/) · [github](https://github.com/m-ccool)

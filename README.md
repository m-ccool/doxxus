# doxxus.us

Personal portfolio & service site for **B McCool** — freelance web developer.

## Product Planning

- [E-commerce MVP outline](docs/mvp-outline.md) — approved direction for packages, consultations, payments, client portal, and admin operations.

## Stack

- **HTML5 / CSS3** — custom theming, Bootstrap 5.3 overrides, rainbow gradient system
- **Bootstrap 5.3** — responsive layout, modals, navbar collapse
- **JavaScript / jQuery** — AOS scroll animations, Swiper carousel, smooth scroll
- **Third-party libs** — AOS, Swiper, FontAwesome 5, Typicons, GitHub Activity Feed

## Structure

```
index.html          — landing page (splash, software tier, IT tier, portfolio, about)
services.html       — software spec sheet, package tiers, add-ons, consultation, IT tier
build.html          — package builder (assemble a package and send the request)
signin.html         — client portal placeholder (no authentication yet)
terms.html          — terms of service
sitemap.xml         — public URL list
ajax-form-store.php — contact/package form endpoint (host-side, not GitHub Pages)
docs/mvp-outline.md — ecommerce MVP and client portal plan
server/             — Node.js commerce API foundation
assets/
  css/
    style.css             — primary custom styles, CSS variables, ds-* design system
    animate.css           — custom keyframe animations (gradient, hueRotate, typing, etc.)
    bs-theme-overrides.css — Bootstrap :root overrides
    comet.compiled.css    — comet background animation
    globe.css             — globe icon styles
    particle.compiled.css — particle background animation
    swiper-icons.css      — swiper nav icon overrides
  js/
    site-shell.js   — injects navbar, footer and contact modal on every page
    pages.js        — services terminal expander, package builder
    glitch.js       — glitch-typing effect (home page and contact modal labels)
    bs-init.js      — Bootstrap tooltip/AOS init
    comet.js        — comet animation
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
- Contact and package forms post to `https://doxxus.us/ajax-form-store.php` and only
  treat the literal `success` response as sent
- Commerce backend starts in `server/`; run `cd server` then `npm start` for the health endpoint
- Serve locally with `python -m http.server 8777`

## Style References for Agents
- Liquid Glass Pro Max - https://codepen.io/fand/pen/azmPjqd
- Liquid Glass - https://codepen.io/toi-nagasawa/pen/wBzWebb
- Liquid Metal - https://codepen.io/Majoramari/pen/pvbzpoa


## Contact

**dev@doxxus.us** · [linkedin](https://www.linkedin.com/in/b-m-ccool/) · [github](https://github.com/m-ccool)

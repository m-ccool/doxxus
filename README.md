# doxxus.dev

Personal portfolio & service site for **B McCool** — freelance web developer.

## Stack

- **HTML5 / CSS3** — custom theming, Bootstrap 5.3 overrides, rainbow gradient system
- **Bootstrap 5.3** — responsive layout, modals, navbar collapse
- **JavaScript / jQuery** — AOS scroll animations, Swiper carousel, smooth scroll
- **Third-party libs** — AOS, Swiper, FontAwesome 5, Typicons, GitHub Activity Feed

## Structure

```
index.html          — main landing page (splash, services, portfolio, about)
host.html           — hosting/plans page
projects.html       — full portfolio page
terms.html          — terms of service
assets/
  css/
    style.css             — primary custom styles, CSS variables, component styles
    animate.css           — custom keyframe animations (gradient, hueRotate, typing, etc.)
    bs-theme-overrides.css — Bootstrap :root overrides
    comet.compiled.css    — comet background animation
    globe.css             — globe icon styles
    particle.compiled.css — particle background animation
    swiper-icons.css      — swiper nav icon overrides
  js/
    bs-init.js      — Bootstrap tooltip/AOS init
    comet.js        — comet animation
    plugins.js      — Swiper carousel init
    scripts.js      — navbar scroll, smooth scroll, misc
  fonts/
  img/
```

## Dev Notes

- CSS variables in `:root` inside `style.css` define the full color/gradient system
- Rainbow gradient: `--rainbow-gradient: linear-gradient(-45deg, var(--pink), var(--indigo), var(--purple), var(--teal), var(--green))`
- Dark theme: `--bs-body-color: #0d0d0e`, `--bs-body-bg: #0f0f10`
- Contact form posts to `https://doxxus.dev/ajax-form-store.php`

## Style References for Agents
- Liquid Glass Pro Max - https://codepen.io/fand/pen/azmPjqd
- Liquid Glass - https://codepen.io/toi-nagasawa/pen/wBzWebb
- Liquid Metal - https://codepen.io/Majoramari/pen/pvbzpoa
- NEW SPLASH - Screen Lght - https://codepen.io/toi-nagasawa/pen/OPRBwOd


## Contact

**dev@doxxus.dev** · [linkedin](https://www.linkedin.com/in/b-m-ccool/) · [github](https://github.com/m-ccool)

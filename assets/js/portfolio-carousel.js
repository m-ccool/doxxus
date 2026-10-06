/**
 * portfolio-carousel.js — renders every [data-portfolio-carousel] mount from
 * window.DOXXUS_PORTFOLIO (portfolio-data.js) and starts one Swiper per mount.
 *
 * Load order: after plugins.js (Swiper) and portfolio-data.js, before scripts.js.
 * Rendering is synchronous so later scripts can rely on the cards existing.
 *
 * Per-card behaviour is delegated and recomputed from the DOM, because Swiper's
 * loop mode clones slides with cloneNode() and clones keep no listeners or
 * JS properties.
 */
(function () {
    'use strict';

    var CYCLE_MS = 1600;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ── helpers ─────────────────────────────────────────────────── */

    function el(tag, className, attrs) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (attrs) {
            Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
        }
        return node;
    }

    function isText(value) {
        return typeof value === 'string' && value.trim() !== '';
    }

    function escapeHtml(text) {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Minimal JS tokenizer for the demo window: comments, keywords, numbers, calls.
    function highlight(code) {
        var pattern = /(\/\/[^\n]*)|\b(function|const|let|var|return|if|else|for|while|new|class)\b|\b(\d+(?:\.\d+)?)\b|([A-Za-z_$][\w$]*)(?=\()/g;
        return escapeHtml(code).replace(pattern, function (match, comment, keyword, number, call) {
            if (comment) return '<span class="cs-comment">' + comment + '</span>';
            if (keyword) return '<span class="cs-keyword">' + keyword + '</span>';
            if (number) return '<span class="cs-number">' + number + '</span>';
            if (call) return '<span class="cs-func">' + call + '</span>';
            return match;
        });
    }

    /* ── card rendering ──────────────────────────────────────────── */

    // Fail closed: a card without a real title and description is skipped, and a
    // card whose preview data is missing falls back to its backdrop image only.
    function normalize(entry) {
        if (!entry || !isText(entry.title) || !isText(entry.description)) {
            console.warn('[portfolio] skipped entry without title/description:', entry && entry.id);
            return null;
        }
        var card = {
            id: entry.id,
            title: entry.title.trim(),
            description: entry.description.trim(),
            type: entry.type,
            url: isText(entry.url) ? entry.url : null,
            backdrop: isText(entry.backdrop) ? entry.backdrop : null,
            screens: Array.isArray(entry.screens) ? entry.screens.filter(function (s) { return s && isText(s.src); }) : [],
            code: isText(entry.code) ? entry.code : null
        };
        if (card.type === 'mobile' && !card.screens.length) card.type = 'image';
        if (card.type === 'demo' && !card.code) card.type = 'image';
        if (card.type !== 'mobile' && card.type !== 'demo') card.type = 'image';
        if (card.type !== 'demo' && !card.backdrop) {
            console.warn('[portfolio] skipped entry without backdrop:', card.id);
            return null;
        }
        return card;
    }

    function buildBezel(card) {
        var bezel = el('div', 'iphone-bezel');
        bezel.appendChild(el('div', 'iphone-bezel-notch'));
        card.screens.forEach(function (screen, i) {
            bezel.appendChild(el('img', 'iphone-bezel-screen' + (i === 0 ? ' is-active' : ''), {
                src: screen.src,
                alt: screen.alt || card.title,
                loading: 'lazy'
            }));
        });
        return bezel;
    }

    function buildWindow(card) {
        var win = el('div', 'ds-window portfolio-window', { 'data-swiper-no-swiping': 'true' });
        var bar = el('div', 'ds-window-bar');
        var dots = el('span', 'ds-terminal-dots');
        [
            ['close', 'Reset the code window'],
            ['min', 'Minimize the code window'],
            ['zoom', 'Expand the code window']
        ].forEach(function (dot) {
            var action = dot[0] === 'min' ? 'minimize' : dot[0];
            dots.appendChild(el('button', 'ds-dot ds-dot--' + dot[0], {
                type: 'button',
                'data-demo-action': action,
                'aria-label': dot[1]
            }));
        });
        var title = el('button', 'ds-window-title', { type: 'button', 'data-demo-action': 'minimize' });
        title.textContent = card.title;
        var hint = el('span', 'ds-window-hint');
        hint.textContent = 'live demo';
        bar.appendChild(dots);
        bar.appendChild(title);
        bar.appendChild(hint);

        var body = el('div', 'ds-window-body ds-window-body--plain');
        var pre = el('pre', 'code-snippet-display');
        var code = el('code');
        code.innerHTML = highlight(card.code);
        pre.appendChild(code);
        body.appendChild(pre);

        win.appendChild(bar);
        win.appendChild(body);
        return win;
    }

    function buildCard(card) {
        var slide = el('div', 'swiper-slide');
        var content = el('div', 'content noraidus', { 'data-card-type': card.type });

        var backdrop = el('div', 'item-img');
        // A url() inside a custom property resolves against the stylesheet, not the page.
        if (card.backdrop) backdrop.style.setProperty('--backdrop', 'url("' + new URL(card.backdrop, document.baseURI).href + '")');
        content.appendChild(backdrop);

        if (card.type === 'mobile') {
            content.appendChild(el('div', 'iphone-bezel-aura', { 'aria-hidden': 'true' }));
            content.appendChild(buildBezel(card));
        }
        if (card.type === 'demo') content.appendChild(buildWindow(card));

        var cont = el('div', 'cont');
        var heading = el('h3', 'card-title');
        if (card.url) {
            var link = el('a', null, { href: card.url });
            link.textContent = card.title;
            heading.appendChild(link);
        } else {
            heading.textContent = card.title;
        }
        var description = el('p', 'card-desc');
        description.textContent = card.description;
        cont.appendChild(heading);
        cont.appendChild(description);
        content.appendChild(cont);

        slide.appendChild(content);
        return slide;
    }

    function buildCarousel(cards) {
        var container = el('div', 'container-fluid');
        var row = el('div', 'row');
        var col = el('div', 'col-lg-12 no-padding');
        var swiperEl = el('div', 'swiper-container');
        var wrapper = el('div', 'swiper-wrapper');
        cards.forEach(function (card) { wrapper.appendChild(buildCard(card)); });
        swiperEl.appendChild(wrapper);

        var next = el('div', 'swiper-button-next swiper-nav-ctrl simp-next cursor-pointer', { role: 'button', 'aria-label': 'Next project' });
        var nextBtn = el('span', 'simple-btn right', { 'aria-hidden': 'true' });
        nextBtn.textContent = '>';
        next.appendChild(nextBtn);
        var prev = el('div', 'swiper-button-prev swiper-nav-ctrl simp-prev cursor-pointer', { role: 'button', 'aria-label': 'Previous project' });
        var prevBtn = el('span', 'simple-btn', { 'aria-hidden': 'true' });
        prevBtn.textContent = '<';
        prev.appendChild(prevBtn);
        swiperEl.appendChild(next);
        swiperEl.appendChild(prev);

        col.appendChild(swiperEl);
        row.appendChild(col);
        container.appendChild(row);
        return container;
    }

    /* ── Swiper ──────────────────────────────────────────────────── */

    function swiperOptions(mount, compact) {
        var options = {
            slidesPerView: compact ? 1 : 2,
            spaceBetween: 0,
            speed: 2000,
            loop: true,
            centeredSlides: true,
            autoplay: { delay: 7000, disableOnInteraction: false, pauseOnMouseEnter: true },
            navigation: {
                nextEl: mount.querySelector('.swiper-button-next'),
                prevEl: mount.querySelector('.swiper-button-prev')
            }
        };
        if (!compact) {
            options.breakpoints = {
                320: { slidesPerView: 1, spaceBetween: 0 },
                640: { slidesPerView: 1, spaceBetween: 0 },
                767: { slidesPerView: 1, spaceBetween: 0, centeredSlides: false },
                991: { slidesPerView: 2 }
            };
        }
        return options;
    }

    /* ── card focus state: screen on / off ───────────────────────── */

    // A card is "focused" while it is in view AND (the active slide, hovered, or
    // holding keyboard focus). Focused cards power on; unfocused cards go dark.
    function CardState(mount) {
        var observer = null;
        var pending = false;

        function state(content) {
            if (!content._dx) content._dx = { inView: false, hover: false, focus: false, timer: null, index: 0 };
            return content._dx;
        }

        function isActive(content) {
            var slide = content.closest('.swiper-slide');
            return !!slide && slide.classList.contains('swiper-slide-active');
        }

        function apply(content) {
            var s = state(content);
            var on = reduceMotion || (s.inView && (isActive(content) || s.hover || s.focus));
            content.classList.toggle('is-on', on);
            if (!on) stopCycle(content);
        }

        function refreshAll() {
            pending = false;
            mount.querySelectorAll('.content').forEach(function (content) {
                if (observer && !content._dxObserved) {
                    content._dxObserved = true;
                    observer.observe(content);
                }
                apply(content);
            });
        }

        function schedule() {
            if (pending) return;
            pending = true;
            window.requestAnimationFrame(refreshAll);
        }

        function frames(content) {
            return content.querySelectorAll('.iphone-bezel-screen');
        }

        function show(content, i) {
            frames(content).forEach(function (frame, fi) { frame.classList.toggle('is-active', fi === i); });
        }

        function startCycle(content) {
            var s = state(content);
            if (reduceMotion || s.timer || frames(content).length < 2) return;
            s.timer = window.setInterval(function () {
                s.index = (s.index + 1) % frames(content).length;
                show(content, s.index);
            }, CYCLE_MS);
        }

        function stopCycle(content) {
            var s = state(content);
            if (!s.timer && s.index === 0) return;
            window.clearInterval(s.timer);
            s.timer = null;
            s.index = 0;
            show(content, 0);
        }

        function contentOf(target) {
            return target && target.closest ? target.closest('.content') : null;
        }

        if ('IntersectionObserver' in window && !reduceMotion) {
            observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    state(entry.target).inView = entry.isIntersecting;
                    apply(entry.target);
                });
            }, { threshold: 0.5 });
        } else {
            reduceMotion = true; // no observer: show every screen on, no animation
        }

        mount.addEventListener('pointerover', function (event) {
            var content = contentOf(event.target);
            if (!content) return;
            state(content).hover = true;
            apply(content);
            if (content.classList.contains('is-on')) startCycle(content);
        });
        mount.addEventListener('pointerout', function (event) {
            var content = contentOf(event.target);
            if (!content || content.contains(event.relatedTarget)) return;
            state(content).hover = false;
            stopCycle(content);
            apply(content);
        });
        mount.addEventListener('focusin', function (event) {
            var content = contentOf(event.target);
            if (!content) return;
            state(content).focus = true;
            apply(content);
            if (content.classList.contains('is-on')) startCycle(content);
        });
        mount.addEventListener('focusout', function (event) {
            var content = contentOf(event.target);
            if (!content || content.contains(event.relatedTarget)) return;
            state(content).focus = false;
            stopCycle(content);
            apply(content);
        });

        // Swiper flips .swiper-slide-active and rebuilds loop clones: re-sync on both.
        new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
                if (m.type === 'childList' || (m.target.classList && m.target.classList.contains('swiper-slide'))) {
                    schedule();
                    return;
                }
            }
        }).observe(mount, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });

        refreshAll();
    }

    /* ── demo window controls (delegated, so loop clones work) ───── */

    function initDemoWindows() {
        document.addEventListener('click', function (event) {
            var control = event.target.closest('[data-demo-action]');
            if (!control) return;
            var win = control.closest('.portfolio-window');
            if (!win || win.classList.contains('is-rebooting')) return;

            var action = control.getAttribute('data-demo-action');
            if (action === 'minimize') {
                win.classList.remove('is-zoomed');
                var minimized = win.classList.toggle('is-minimized');
                win.querySelectorAll('[data-demo-action="minimize"]').forEach(function (btn) {
                    btn.setAttribute('aria-expanded', String(!minimized));
                });
            } else if (action === 'zoom') {
                win.classList.remove('is-minimized');
                win.classList.toggle('is-zoomed');
            } else if (action === 'close') {
                win.classList.remove('is-zoomed');
                win.classList.add('is-rebooting');
                var resetAt = window.setTimeout(function () {
                    win.classList.remove('is-minimized');
                }, 720);
                win.addEventListener('animationend', function done(e) {
                    if (e.target !== win) return;
                    window.clearTimeout(resetAt);
                    win.classList.remove('is-rebooting');
                    win.removeEventListener('animationend', done);
                });
            }
        });
    }

    /* ── boot ────────────────────────────────────────────────────── */

    function init() {
        var mounts = document.querySelectorAll('[data-portfolio-carousel]');
        if (!mounts.length) return;

        var cards = (window.DOXXUS_PORTFOLIO || []).map(normalize).filter(Boolean);
        if (!cards.length) {
            console.warn('[portfolio] no valid cards to render');
            return;
        }

        mounts.forEach(function (mount) {
            var compact = mount.classList.contains('work-carousel--compact');
            mount.appendChild(buildCarousel(cards));

            if (typeof Swiper !== 'undefined') {
                mount._swiper = new Swiper(mount.querySelector('.swiper-container'), swiperOptions(mount, compact));
            } else {
                console.warn('[portfolio] Swiper missing; cards render without sliding');
            }
            CardState(mount);
        });

        initDemoWindows();
    }

    init();
}());

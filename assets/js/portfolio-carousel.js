/**
 * portfolio-carousel.js — renders every [data-portfolio-carousel] mount from
 * window.DOXXUS_PORTFOLIO (portfolio-data.js).
 *
 * Variants (set on the mount):
 *   default                — Swiper, 2 slides centered (home)
 *   work-carousel--wide    — full-bleed CSS marquee that drifts and pauses on hover (Build hero)
 *
 * Exposes DoxxusPortfolio.init(root) / destroy(root) so the client-side router can
 * mount and tear down carousels as page content is swapped. Runs once for the
 * document it is included in.
 *
 * Per-card behaviour is delegated and recomputed from the DOM, because Swiper's
 * loop mode clones slides with cloneNode() and clones keep no listeners or JS properties.
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

    /* ── card rendering ──────────────────────────────────────────── */

    // Fail closed: a card without a real title, description or screen is skipped.
    function normalize(entry) {
        if (!entry || !isText(entry.title) || !isText(entry.description)) {
            console.warn('[portfolio] skipped entry without title/description:', entry && entry.id);
            return null;
        }
        var screens = Array.isArray(entry.screens)
            ? entry.screens.filter(function (s) { return s && isText(s.src); })
            : [];
        if (!screens.length) {
            console.warn('[portfolio] skipped entry without screens:', entry.id);
            return null;
        }
        return {
            id: entry.id,
            title: entry.title.trim(),
            description: entry.description.trim(),
            url: isText(entry.url) ? entry.url : null,
            screens: screens
        };
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

    function buildContent(card) {
        var content = el('div', 'content noraidus');
        content.appendChild(el('div', 'iphone-bezel-aura', { 'aria-hidden': 'true' }));
        content.appendChild(buildBezel(card));

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
        return content;
    }

    function buildSwiper(cards) {
        var container = el('div', 'container-fluid');
        var row = el('div', 'row');
        var col = el('div', 'col-lg-12 no-padding');
        var swiperEl = el('div', 'swiper-container');
        var wrapper = el('div', 'swiper-wrapper');
        cards.forEach(function (card) {
            var slide = el('div', 'swiper-slide');
            slide.appendChild(buildContent(card));
            wrapper.appendChild(slide);
        });
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

    // Two identical halves; the track slides left by exactly one half, then repeats.
    // Each half repeats the card set `copies` times so it is always wider than the
    // viewport (otherwise a gap would open at the right on wide screens).
    function buildMarquee(cards, copies) {
        var viewport = el('div', 'gallery-viewport');
        var track = el('div', 'gallery-track');
        [false, true].forEach(function (isCopy) {
            var half = el('div', 'gallery-half');
            if (isCopy) half.setAttribute('aria-hidden', 'true');
            for (var n = 0; n < copies; n++) {
                cards.forEach(function (card) {
                    var item = el('div', 'gallery-item');
                    var content = buildContent(card);
                    if (isCopy || n > 0) {
                        content.querySelectorAll('a, button').forEach(function (node) { node.setAttribute('tabindex', '-1'); });
                    }
                    if (n > 0) item.setAttribute('aria-hidden', 'true');
                    item.appendChild(content);
                    half.appendChild(item);
                });
            }
            track.appendChild(half);
        });
        viewport.appendChild(track);
        return viewport;
    }

    // Drives the wide gallery: gentle auto-drift, drag (mouse/touch/pen) with inertia,
    // and horizontal wheel / trackpad scroll. Hovering a phone eases the drift down to a
    // crawl so its title card can be read; keyboard focus stops it. The track position
    // wraps modulo one half, so the loop is seamless in either direction.
    function marqueeEngine(mount) {
        var DRIFT_PX_PER_S = 27;
        var x = 0;
        var half = 0;
        var track = null;
        var rate = 1;
        var target = 1;
        var velocity = 0;
        var dragging = false;
        var moved = false;
        var hovered = false;
        var focused = false;
        var visible = true;
        var raf = 0;
        var last = performance.now();
        var lastHoverCheck = 0;
        var drag = { id: null, startX: 0, startPos: 0, lastX: 0, lastT: 0, v: 0 };

        function refresh() {
            track = mount.querySelector('.gallery-track');
            var first = track && track.firstElementChild;
            half = first ? first.offsetWidth : 0;
            apply();
        }

        function wrap() {
            if (!half) return;
            x = x % half;
            if (x > 0) x -= half;
        }

        function apply() {
            if (!track) return;
            wrap();
            track.style.transform = 'translate3d(' + x + 'px,0,0)';
        }

        function retarget() {
            target = focused ? 0 : hovered ? 0.15 : 1;
        }

        function frame(now) {
            raf = window.requestAnimationFrame(frame);
            var dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            if (!visible || document.hidden || !track) return;

            // Enter/leave events are lost during pointer capture, so re-read :hover a few times a second.
            if (!dragging && now - lastHoverCheck > 120) {
                lastHoverCheck = now;
                var nowHovered = !!mount.querySelector('.content:hover');
                if (nowHovered !== hovered) { hovered = nowHovered; retarget(); }
            }

            rate += (target - rate) * Math.min(1, dt * 6);
            if (!dragging) {
                if (!reduceMotion) x -= DRIFT_PX_PER_S * rate * dt;
                if (velocity) {
                    x += velocity * dt;
                    velocity *= Math.exp(-3.5 * dt);
                    if (Math.abs(velocity) < 5) velocity = 0;
                }
            }
            apply();
        }

        function viewportOf(event) {
            return event.target.closest ? event.target.closest('.gallery-viewport') : null;
        }

        function down(event) {
            if (!viewportOf(event) || (event.pointerType === 'mouse' && event.button !== 0)) return;
            dragging = true;
            moved = false;
            velocity = 0;
            drag.id = event.pointerId;
            drag.startX = drag.lastX = event.clientX;
            drag.startPos = x;
            drag.lastT = event.timeStamp;
            drag.v = 0;
        }

        function move(event) {
            if (!dragging || event.pointerId !== drag.id) return;
            var dx = event.clientX - drag.startX;
            if (!moved && Math.abs(dx) > 6) {
                moved = true;
                mount.classList.add('is-dragging');
                var viewport = mount.querySelector('.gallery-viewport');
                if (viewport && viewport.setPointerCapture) viewport.setPointerCapture(event.pointerId);
            }
            if (!moved) return;
            x = drag.startPos + dx;
            var dtMs = Math.max(1, event.timeStamp - drag.lastT);
            drag.v = drag.v * 0.6 + ((event.clientX - drag.lastX) / dtMs * 1000) * 0.4;
            drag.lastX = event.clientX;
            drag.lastT = event.timeStamp;
            apply();
        }

        function up(event) {
            if (!dragging || event.pointerId !== drag.id) return;
            dragging = false;
            mount.classList.remove('is-dragging');
            if (moved) velocity = Math.max(-3000, Math.min(3000, drag.v));
            // Pointer capture swallows the "leave" event, so re-read the hover state.
            hovered = !!mount.querySelector('.content:hover');
            retarget();
        }

        function leave() {
            if (dragging) return;
            hovered = false;
            retarget();
        }

        // A drag must not count as a click on a project link.
        function click(event) {
            if (moved) {
                event.preventDefault();
                event.stopPropagation();
                moved = false;
            }
        }

        // Horizontal trackpad / shift+wheel scrolls the gallery; plain vertical wheel still scrolls the page.
        function wheel(event) {
            if (!viewportOf(event)) return;
            var dx = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : (event.shiftKey ? event.deltaY : 0);
            if (!dx) return;
            event.preventDefault();
            x -= dx;
            velocity = 0;
        }

        function over(event) {
            if (!dragging && event.target.closest && event.target.closest('.content')) { hovered = true; retarget(); }
        }
        function out(event) {
            var content = event.target.closest && event.target.closest('.content');
            if (content && !content.contains(event.relatedTarget)) { hovered = false; retarget(); }
        }
        function focusIn() { focused = true; retarget(); }
        function focusOut() { focused = false; retarget(); }

        mount.addEventListener('pointerdown', down);
        mount.addEventListener('pointermove', move);
        mount.addEventListener('pointerup', up);
        mount.addEventListener('pointercancel', up);
        mount.addEventListener('click', click, true);
        mount.addEventListener('wheel', wheel, { passive: false });
        mount.addEventListener('pointerover', over);
        mount.addEventListener('pointerout', out);
        mount.addEventListener('pointerleave', leave);
        mount.addEventListener('focusin', focusIn);
        mount.addEventListener('focusout', focusOut);

        var io = null;
        if ('IntersectionObserver' in window) {
            io = new IntersectionObserver(function (entries) {
                visible = entries[entries.length - 1].isIntersecting;
            });
            io.observe(mount);
        }

        raf = window.requestAnimationFrame(frame);
        return {
            refresh: refresh,
            destroy: function () {
                window.cancelAnimationFrame(raf);
                if (io) io.disconnect();
                mount.classList.remove('is-dragging');
                mount.removeEventListener('pointerdown', down);
                mount.removeEventListener('pointermove', move);
                mount.removeEventListener('pointerup', up);
                mount.removeEventListener('pointercancel', up);
                mount.removeEventListener('click', click, true);
                mount.removeEventListener('wheel', wheel);
                mount.removeEventListener('pointerover', over);
                mount.removeEventListener('pointerout', out);
                mount.removeEventListener('pointerleave', leave);
                mount.removeEventListener('focusin', focusIn);
                mount.removeEventListener('focusout', focusOut);
            }
        };
    }

    /* ── Swiper (home) ───────────────────────────────────────────── */

    function swiperOptions(mount) {
        return {
            slidesPerView: 2,
            spaceBetween: 0,
            speed: 1400,
            loop: true,
            centeredSlides: true,
            autoplay: { delay: 5000, disableOnInteraction: false },
            navigation: {
                nextEl: mount.querySelector('.swiper-button-next'),
                prevEl: mount.querySelector('.swiper-button-prev')
            },
            breakpoints: {
                320: { slidesPerView: 1, spaceBetween: 0 },
                640: { slidesPerView: 1, spaceBetween: 0 },
                767: { slidesPerView: 1, spaceBetween: 0, centeredSlides: false },
                991: { slidesPerView: 2 }
            }
        };
    }

    /* ── card focus state: screen on / off ───────────────────────── */

    // A card is "focused" while it is in view AND (the active slide, hovered, or
    // holding keyboard focus). In the marquee there is no active slide, so every
    // card in view is focused. Focused cards power on; unfocused cards go dark.
    // Returns a function that tears everything down.
    function trackCards(mount, marquee) {
        var observer = null;
        var mutations = null;
        var pending = false;
        var alive = true;
        var always = reduceMotion;

        function state(content) {
            if (!content._dx) content._dx = { inView: false, hover: false, focus: false, timer: null, index: 0 };
            return content._dx;
        }

        function isActive(content) {
            if (marquee) return true;
            var slide = content.closest('.swiper-slide');
            return !!slide && slide.classList.contains('swiper-slide-active');
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

        function apply(content) {
            var s = state(content);
            var on = always || (s.inView && (isActive(content) || s.hover || s.focus));
            content.classList.toggle('is-on', on);
            if (!on) stopCycle(content);
        }

        function refreshAll() {
            pending = false;
            if (!alive) return;
            mount.querySelectorAll('.content').forEach(function (content) {
                if (observer && !content._dxObserved) {
                    content._dxObserved = true;
                    observer.observe(content);
                }
                apply(content);
            });
        }

        function schedule() {
            if (pending || !alive) return;
            pending = true;
            window.requestAnimationFrame(refreshAll);
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
            always = true; // no observer: every screen on, no animation
        }

        function onOver(event) {
            var content = contentOf(event.target);
            if (!content) return;
            state(content).hover = true;
            apply(content);
            if (content.classList.contains('is-on')) startCycle(content);
        }
        function onOut(event) {
            var content = contentOf(event.target);
            if (!content || content.contains(event.relatedTarget)) return;
            state(content).hover = false;
            stopCycle(content);
            apply(content);
        }
        function onFocusIn(event) {
            var content = contentOf(event.target);
            if (!content) return;
            state(content).focus = true;
            apply(content);
            if (content.classList.contains('is-on')) startCycle(content);
        }
        function onFocusOut(event) {
            var content = contentOf(event.target);
            if (!content || content.contains(event.relatedTarget)) return;
            state(content).focus = false;
            stopCycle(content);
            apply(content);
        }

        mount.addEventListener('pointerover', onOver);
        mount.addEventListener('pointerout', onOut);
        mount.addEventListener('focusin', onFocusIn);
        mount.addEventListener('focusout', onFocusOut);

        // Swiper flips .swiper-slide-active and rebuilds loop clones: re-sync on both.
        mutations = new MutationObserver(function (list) {
            for (var i = 0; i < list.length; i++) {
                var m = list[i];
                if (m.type === 'childList' || (m.target.classList && m.target.classList.contains('swiper-slide'))) {
                    schedule();
                    return;
                }
            }
        });
        mutations.observe(mount, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });

        refreshAll();

        return function destroy() {
            alive = false;
            if (observer) observer.disconnect();
            mutations.disconnect();
            mount.removeEventListener('pointerover', onOver);
            mount.removeEventListener('pointerout', onOut);
            mount.removeEventListener('focusin', onFocusIn);
            mount.removeEventListener('focusout', onFocusOut);
            mount.querySelectorAll('.content').forEach(function (content) {
                if (content._dx && content._dx.timer) window.clearInterval(content._dx.timer);
            });
        };
    }

    /* ── lifecycle ───────────────────────────────────────────────── */

    function mountOne(mount, cards) {
        if (mount._dxDestroy) return;
        var marquee = mount.classList.contains('work-carousel--wide');
        var teardown = [];

        if (marquee) {
            var copies = 1;
            var engine = marqueeEngine(mount);
            var render = function () {
                mount.querySelectorAll('.gallery-viewport').forEach(function (node) { node.remove(); });
                mount.appendChild(buildMarquee(cards, copies));
                engine.refresh();
            };
            // Grow (never shrink) until one half is wider than the mount.
            var fit = function () {
                var half = mount.querySelector('.gallery-half');
                var needed = copies;
                if (half && half.offsetWidth && mount.clientWidth) {
                    var per = half.offsetWidth / copies;
                    needed = Math.max(copies, Math.ceil(mount.clientWidth / per));
                }
                if (needed > copies && needed <= 8) { copies = needed; render(); }
            };
            render();
            fit();
            var resizeTimer = 0;
            var onResize = function () { window.clearTimeout(resizeTimer); resizeTimer = window.setTimeout(function () { fit(); engine.refresh(); }, 150); };
            window.addEventListener('resize', onResize);
            teardown.push(function () { window.clearTimeout(resizeTimer); window.removeEventListener('resize', onResize); });
            teardown.push(engine.destroy);
        } else {
            mount.appendChild(buildSwiper(cards));
            if (typeof Swiper !== 'undefined') {
                var swiper = new Swiper(mount.querySelector('.swiper-container'), swiperOptions(mount));
                mount._swiper = swiper;

                // Swiper 5 has no pauseOnMouseEnter: pause so a hovered title card can be read.
                var pause = function () { if (swiper.autoplay) swiper.autoplay.stop(); };
                var resume = function () { if (swiper.autoplay) swiper.autoplay.start(); };
                mount.addEventListener('pointerenter', pause);
                mount.addEventListener('pointerleave', resume);
                teardown.push(function () {
                    mount.removeEventListener('pointerenter', pause);
                    mount.removeEventListener('pointerleave', resume);
                    swiper.destroy(true, true);
                    mount._swiper = null;
                });
            } else {
                console.warn('[portfolio] Swiper missing; cards render without sliding');
            }
        }

        teardown.push(trackCards(mount, marquee));

        mount._dxDestroy = function () {
            teardown.forEach(function (fn) { fn(); });
            mount.querySelectorAll('.gallery-viewport, .container-fluid').forEach(function (node) { node.remove(); });
            mount._dxDestroy = null;
        };
    }

    function init(root) {
        var scope = root || document;
        var mounts = scope.querySelectorAll('[data-portfolio-carousel]');
        if (!mounts.length) return;

        var cards = (window.DOXXUS_PORTFOLIO || []).map(normalize).filter(Boolean);
        if (!cards.length) {
            console.warn('[portfolio] no valid cards to render');
            return;
        }
        mounts.forEach(function (mount) { mountOne(mount, cards); });
    }

    function destroy(root) {
        var scope = root || document;
        scope.querySelectorAll('[data-portfolio-carousel]').forEach(function (mount) {
            if (mount._dxDestroy) mount._dxDestroy();
        });
    }

    window.DoxxusPortfolio = { init: init, destroy: destroy };
    init(document);
}());

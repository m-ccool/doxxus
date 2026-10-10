/**
 * explore-prompt.js — the home hero's "$ explore projects? [Y/n]" command prompt, plus the
 * small bits of hero behaviour that need script:
 *
 *   - the prompt types itself in, character by character (including the [Y/n]), then idles on a soft caret
 *   - the whole line is a click target that continues: it scrolls to #projects at once (so does the
 *     "y" key while the prompt is on screen)
 *   - the red n (or the "n" key) turns the line red, backspaces it, and retypes it as a sadder and sadder
 *     ":( Are you sure? [Y/N] ?" (":((", ":(((", ...) each time it is pressed
 *   - pointer parallax: the globe stage tilts a few degrees toward the cursor (mouse only)
 *   - one star per project card circles the globe (varied size, speed and orbit); clicking a
 *     star pops a small flare and a burst of sparkles
 *   - scroll hand-off: the globe fades and drifts up as you scroll off the hero
 *   - hero animations are paused while #splash is off-screen
 *
 * Only transform/opacity are driven (through CSS variables on .globe-stage), so nothing here
 * triggers layout. DoxxusExplore.init(root) / destroy(root) let the client-side router mount
 * and tear the hero down as page content is swapped. Reduced motion: no typing, parallax or
 * hand-off; the prompt is shown fully typed.
 */
(function () {
    'use strict';

    var BOOT_AT_MS = 3300;      // after load, once the intro sequence has landed
    var TYPE_MS = 48;
    var ERASE_MS = 20;
    var SAD_PAUSE_MS = 260;     // the line is red for a beat before it starts deleting
    var MAX_FROWN = 10;
    var YES_DELAY_MS = 140;     // long enough to see the "y" echo, short enough to feel instant
    var MAX_TILT_X = 5;
    var MAX_TILT_Y = 6;
    var MAX_STARS = 12;
    var DEFAULT_STARS = 5;      // used if the portfolio data is missing
    var POP_COOLDOWN_MS = 600;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var canTilt = !reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var instances = [];

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function isTypingTarget(node) {
        if (!node || !node.closest) return false;
        return !!node.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="dialog"]');
    }

    function mount(prompt) {
        var splash = document.getElementById('splash');
        var stage = document.querySelector('[data-globe-stage]');
        var pill = prompt.querySelector('[data-explore-pill]');
        var question = prompt.querySelector('[data-explore-q]');
        var choices = prompt.querySelector('[data-explore-choices]');
        var yes = prompt.querySelector('[data-explore-yes]');
        var no = prompt.querySelector('[data-explore-no]');
        var tail = prompt.querySelector('[data-explore-tail]');
        var echo = prompt.querySelector('[data-explore-echo]');
        var caret = prompt.querySelector('[data-explore-caret]');
        if (!pill || !question || !choices || !yes || !no || !tail || !echo || !caret || choices.children.length !== 5) return null;

        var alive = true;
        var gen = 0;            // bumped to cancel whatever the line is currently typing or deleting
        var writing = false;    // the line is being typed or deleted: n is ignored, y still works
        var confirming = false;
        var started = false;    // the intro typing has begun (or was skipped)
        var onScreen = !('IntersectionObserver' in window);
        var delayDone = false;
        var level = 0;          // how many times n has been pressed
        var timers = [];
        var observers = [];
        var cleanups = [];

        function later(fn, ms) {
            var g = gen;
            var id = window.setTimeout(function () { if (alive && g === gen) fn(); }, ms);
            timers.push(id);
            return id;
        }

        // For timers that must survive a cancelled write (resetting after Y, the boot delay).
        function afterwards(fn, ms) {
            var id = window.setTimeout(function () { if (alive) fn(); }, ms);
            timers.push(id);
            return id;
        }

        function listen(target, type, handler, options) {
            target.addEventListener(type, handler, options);
            cleanups.push(function () { target.removeEventListener(type, handler, options); });
        }

        /* ── the line: typed, deleted and retyped one character at a time ──
           Every piece of text is a cell. Untyped characters stay in the layout but hidden (like the
           section titles), so the line never shifts while it types, and the caret sits right after the
           last typed character, wherever that is (it never jumps). Y and n are real elements, shown
           when their character is reached. */

        function textCell(el) {
            var text = el.textContent;
            var typed = document.createTextNode('');
            var rest = document.createElement('span');
            rest.className = 'explore-rest';
            rest.textContent = text;
            el.textContent = '';
            el.appendChild(typed);
            el.appendChild(rest);
            return { el: el, text: text, key: false, typed: typed, rest: rest };
        }

        function keyCell(el) {
            return { el: el, text: el.textContent, key: true };
        }

        var kids = choices.children;
        var cells = [
            textCell(question),
            textCell(kids[0]),      // [
            keyCell(kids[1]),       // Y
            textCell(kids[2]),      // /
            keyCell(kids[3]),       // n
            textCell(kids[4]),      // ]
            textCell(tail),
            textCell(echo)
        ];
        var cellQuestion = cells[0];
        var cellNo = cells[4];
        var cellTail = cells[6];
        var cellEcho = cells[7];

        function total() {
            return cells.reduce(function (sum, cell) { return sum + cell.text.length; }, 0);
        }

        function render(count) {
            var remaining = count;
            var active = null;
            var last = null;
            cells.forEach(function (cell) {
                var take = Math.min(remaining, cell.text.length);
                remaining -= take;
                if (cell.key) {
                    cell.el.textContent = cell.text;
                    cell.el.style.visibility = take ? '' : 'hidden';
                } else {
                    cell.typed.data = cell.text.slice(0, take);
                    cell.rest.textContent = cell.text.slice(take);
                }
                if (cell.text.length) last = cell;
                if (!active && cell.text.length && take < cell.text.length) active = cell;
            });
            if (active) {
                if (active.key) active.el.before(caret);
                else active.el.insertBefore(caret, active.rest);
            } else if (last) {
                if (last.key) last.el.after(caret);
                else last.el.appendChild(caret);
            }
        }

        function setLine(texts) {
            cellQuestion.text = texts.q;
            cellNo.text = texts.no;
            cellTail.text = texts.tail;
            cellEcho.text = '';
        }

        var NORMAL = { q: 'explore projects?', no: 'n', tail: '' };

        // :( then :(( then :((( ... a bit more upset each time
        function sadLine() {
            return { q: ':' + new Array(Math.min(level, MAX_FROWN) + 1).join('(') + ' Are you sure?', no: 'N', tail: '?' };
        }

        function setWriting(on) {
            writing = on;
            prompt.classList.toggle('is-writing', on);
        }

        function typeAll(done) {
            var count = 0;
            var length = total();
            (function step() {
                render(count);
                if (count >= length) { if (done) done(); return; }
                count += 1;
                later(step, TYPE_MS * (0.75 + Math.random() * 0.5));
            }());
        }

        function eraseAll(done) {
            var count = total();
            (function step() {
                render(count);
                if (count <= 0) { if (done) done(); return; }
                count -= 1;
                later(step, ERASE_MS);
            }());
        }

        /* ── answering ───────────────────────────────────────────── */

        function toProjects() {
            var target = document.getElementById('projects');
            if (target) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
            else window.location.hash = '#projects';
        }

        // Back to the plain prompt (after continuing; the page has scrolled away by then)
        function recover() {
            gen += 1;
            level = 0;
            confirming = false;
            prompt.classList.remove('is-sad', 'is-confirm');
            setLine(NORMAL);
            setWriting(false);
            render(total());
        }

        function yesAnswer() {
            if (confirming) return;
            confirming = true;
            started = true;           // the intro typing is no longer needed once they have answered
            gen += 1;                 // stop any typing or deleting in progress and show the line as it stands
            setWriting(false);
            cellEcho.text = 'y';
            render(total());
            prompt.classList.add('is-confirm');
            afterwards(toProjects, reduceMotion ? 0 : YES_DELAY_MS);
            afterwards(recover, 1600);
        }

        function noAnswer() {
            if (writing || confirming) return;
            level += 1;
            prompt.classList.add('is-sad');
            if (reduceMotion) {
                setLine(sadLine());
                render(total());
                return;
            }
            setWriting(true);
            later(function () {
                eraseAll(function () {
                    setLine(sadLine());
                    typeAll(function () { setWriting(false); });
                });
            }, SAD_PAUSE_MS);
        }

        function answer(choice) {
            if (choice === 'y') yesAnswer();
            else noAnswer();
        }

        // One handler for the whole line: the red n is its own target, everything else continues.
        // Handled here (not on the link) so it also beats the site-wide in-page anchor handler,
        // which waits 500ms.
        listen(pill, 'click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            answer(event.target.closest && event.target.closest('[data-explore-no]') ? 'n' : 'y');
        });

        listen(document, 'keydown', function (event) {
            if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
            var key = event.key && event.key.toLowerCase();
            if (key !== 'y' && key !== 'n') return;
            if (isTypingTarget(event.target) || document.body.classList.contains('modal-open')) return;
            var box = pill.getBoundingClientRect();
            if (box.bottom < 0 || box.top > window.innerHeight) return;
            answer(key);
        });

        /* ── typing in ───────────────────────────────────────────── */

        function tryBoot() {
            if (started || !delayDone || !onScreen || confirming) return;
            started = true;
            typeAll(function () { setWriting(false); });
        }

        if (reduceMotion) {
            render(total());
        } else {
            setWriting(true);
            render(0);
            afterwards(function () { delayDone = true; tryBoot(); }, Math.max(0, BOOT_AT_MS - performance.now()));
            if ('IntersectionObserver' in window) {
                var seen = new IntersectionObserver(function (entries) {
                    onScreen = entries[entries.length - 1].isIntersecting;
                    tryBoot();
                }, { threshold: 0.6 });
                seen.observe(prompt);
                observers.push(seen);
            }
        }
        /* ── stars: one per project card, drawn on two canvases ───── */

        // Two canvases share the stage: one under the globe icon (stars on the far side of their
        // orbit) and one over it. Stars are drawn on a canvas, not as DOM nodes, so each tail is
        // one continuous tapered stroke at the display's own frame rate, and the colours come
        // straight from the theme palette.
        var orbit = prompt.ownerDocument.querySelector('[data-globe-orbit]');
        var TRAIL_STEPS = 30;
        var BEHIND_ALPHA = 0.07;
        var starState = null;

        function fract(value) {
            return value - Math.floor(value);
        }

        function smooth(value) {
            return value * value * (3 - 2 * value);
        }

        function themeColor(name, fallback) {
            var raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace('#', '');
            if (raw.length === 3) raw = raw.replace(/./g, '$&$&');
            var n = parseInt(raw, 16);
            if (raw.length !== 6 || isNaN(n)) n = fallback;
            return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        }

        function mix(a, b, t) {
            return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        }

        function rgba(c, alpha) {
            return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + alpha.toFixed(3) + ')';
        }

        function rgb(c) {
            return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')';
        }

        // 1 on the near side of the orbit, fading hard to BEHIND_ALPHA on the far side.
        function depthAlpha(depth) {
            return BEHIND_ALPHA + (1 - BEHIND_ALPHA) * smooth(clamp((depth + 0.2) / 0.55, 0, 1));
        }

        // The stops of --rainbow-gradient, in its order (pink, indigo, purple, teal, green), read from the same variables
        function themePalette() {
            return [
                themeColor('--pink', 0xff8ab4), themeColor('--indigo', 0xe18aff), themeColor('--purple', 0xbd8aff),
                themeColor('--teal', 0x57d7ff), themeColor('--green', 0x8aff96)
            ];
        }

        function createStars() {
            var cards = window.DOXXUS_PORTFOLIO;
            var count = Math.min(MAX_STARS, Array.isArray(cards) && cards.length ? cards.length : DEFAULT_STARS);
            var palette = themePalette();
            var stars = [];
            for (var i = 0; i < count; i++) {
                var size = 10 + fract(i * 0.618034 + 0.13) * 12;
                var color = palette[i % palette.length];
                stars.push({
                    size: size,
                    lap: 9 + fract(i * 0.754877 + 0.37) * 23,
                    dir: i % 2 === 0 ? 1 : -1,
                    phase: fract(i * 0.381966 + 0.1),
                    kx: 0.46 + fract(i * 0.56984 + 0.2) * 0.1,
                    ky: 0.07 + fract(i * 0.438 + 0.55) * 0.13,
                    tilt: (-40 + fract(i * 0.381966 + 0.31) * 80) * Math.PI / 180,
                    color: color,
                    tailColor: palette[(i + 1) % palette.length],
                    glow: mix(color, [255, 255, 255], 0.45),
                    head: null,
                    gone: false,        // popped: hidden until it rounds the back of the globe again
                    respawnIn: 0,       // ms left before it may come back
                    bornAt: 0           // when it last (re)appeared
                });
            }
            return stars;
        }

        function startStars() {
            var stage = document.querySelector('[data-globe-stage]');
            var icon = stage && stage.querySelector('.globe-icon');
            if (!orbit || !stage || !icon) return null;

            var stars = createStars();
            var back = document.createElement('canvas');
            var front = document.createElement('canvas');
            [back, front].forEach(function (canvas, index) {
                canvas.className = 'orbit-canvas orbit-canvas--' + (index ? 'front' : 'back');
                canvas.setAttribute('aria-hidden', 'true');
                orbit.appendChild(canvas);
            });
            var bctx = back.getContext('2d');
            var fctx = front.getContext('2d');
            if (!bctx || !fctx) { back.remove(); front.remove(); return null; }

            // The lens flare is drawn like the stars (see drawFlare), on its own canvas inside .flare
            var flareHost = stage.querySelector('.flare');
            var flareCanvas = null;
            var flareCtx = null;
            var flareDrawn = false;
            var flarePalette = themePalette();
            if (flareHost) {
                flareCanvas = document.createElement('canvas');
                flareCanvas.className = 'flare-canvas';
                flareCanvas.setAttribute('aria-hidden', 'true');
                flareHost.appendChild(flareCanvas);
                flareCtx = flareCanvas.getContext('2d');
                if (!flareCtx) { flareCanvas.remove(); flareCanvas = null; }
            }

            var size = 0;      // CSS px, square, centred on the globe
            var dpr = 1;
            var globeD = 0;
            var raf = 0;
            var running = false;
            var clock = 0;
            var lastT = 0;
            var bornAt = performance.now() + 2200;

            function layout() {
                globeD = parseFloat(getComputedStyle(icon).fontSize) * 1.75;
                dpr = Math.min(window.devicePixelRatio || 1, 2);
                var reach = Math.min(globeD * 0.57, window.innerWidth * 0.46) + 16;
                size = Math.ceil(reach * 2);
                [back, front].forEach(function (canvas) {
                    canvas.width = Math.round(size * dpr);
                    canvas.height = Math.round(size * dpr);
                    canvas.style.width = size + 'px';
                    canvas.style.height = size + 'px';
                    canvas.style.left = (-size / 2) + 'px';
                    canvas.style.top = (-size / 2) + 'px';
                });
                if (flareCanvas) {
                    var flareSize = Math.round(globeD * 1.9);
                    flareCanvas.width = Math.round(flareSize * dpr);
                    flareCanvas.height = Math.round(flareSize * dpr);
                }
            }

            function point(star, theta, rx, ry, out) {
                var x = rx * Math.cos(theta);
                var y = ry * Math.sin(theta);
                var c = Math.cos(star.tilt);
                var s = Math.sin(star.tilt);
                out.x = x * c - y * s;
                out.y = x * s + y * c;
                return out;
            }

            // Lens flare: the same construction as a star. Four tapered arms (a cross), each a continuous
            // tail of short strokes in three layers (haze, glow, core) that blends from a pale, white-leaning
            // centre to a palette colour at its tip, plus a glowing halo head with a bright white heart.
            // Timing matches the old CSS: first flare ~3.6s after load, then every 20s; it spins about two
            // turns while the arms stretch out to full length and collapse again.
            var FLARE_FIRST_S = 3.6;
            var FLARE_CYCLE_S = 20;
            var FLARE_WINDOW = 0.12;

            // Each flare lands somewhere new on the globe and is a touch bigger or smaller than the last.
            var flareCycle = -1;
            var flareSpot = { size: 1, rot: 0, x: 0, y: 0 };
            var lastAngle = 0;

            function pickFlareSpot() {
                // Anywhere on the globe's disc, at least ~50 degrees round from the previous spot
                var angle;
                do { angle = Math.random() * Math.PI * 2; } while (Math.abs(Math.atan2(Math.sin(angle - lastAngle), Math.cos(angle - lastAngle))) < 0.9);
                lastAngle = angle;
                var radius = Math.sqrt(0.12 + Math.random() * 0.88) * 0.33 * globeD;
                flareSpot.x = Math.cos(angle) * radius;
                flareSpot.y = Math.sin(angle) * radius;
                flareSpot.size = 0.92 + Math.random() * 0.24;   // only slightly different each time
                flareSpot.rot = Math.random() * 90;
                if (flareHost) {
                    flareHost.style.left = 'calc(50% + ' + flareSpot.x.toFixed(1) + 'px)';
                    flareHost.style.top = 'calc(50% + ' + flareSpot.y.toFixed(1) + 'px)';
                }
            }

            function flareState(now) {
                var t = now / 1000 - FLARE_FIRST_S;
                if (t < 0) return null;
                var cycle = Math.floor(t / FLARE_CYCLE_S);
                var p = (t % FLARE_CYCLE_S) / FLARE_CYCLE_S;
                if (p >= FLARE_WINDOW) return null;
                if (cycle !== flareCycle) {
                    flareCycle = cycle;
                    pickFlareSpot();
                }
                var k;
                var out = {};
                if (p < 0.05) {
                    k = smooth(p / 0.05);
                    out.scale = 0.1 + 0.9 * k;
                    out.angle = -330 * k;
                    out.stretch = k;
                } else {
                    k = smooth((p - 0.05) / 0.07);
                    out.scale = 1 - 0.9 * k;
                    out.angle = -330 - 390 * k;
                    out.stretch = 1 - k;
                }
                out.opacity = p < 0.025 ? smooth(p / 0.025) : p < 0.08 ? 1 : 1 - smooth((p - 0.08) / 0.04);
                return out;
            }

            function flareArm(ctx, ax, ay, length, weight, scale, tip) {
                var white = [255, 255, 255];
                var glow = mix(tip, white, 0.62);
                var prevX = 0;
                var prevY = 0;
                for (var k = 0; k < TRAIL_STEPS; k++) {
                    var u = (k + 0.5) / TRAIL_STEPS;
                    var nx = ax * length * (k + 1) / TRAIL_STEPS;
                    var ny = ay * length * (k + 1) / TRAIL_STEPS;
                    var a = Math.pow(1 - u, 1.4);
                    var width = (weight * 0.46 * Math.pow(1 - u, 0.85) + 0.4) * scale;
                    var tint = mix(glow, tip, Math.pow(u, 0.7));
                    ctx.beginPath();
                    ctx.moveTo(prevX, prevY);
                    ctx.lineTo(nx, ny);
                    ctx.strokeStyle = rgba(tint, a * 0.09);
                    ctx.lineWidth = width * 6;
                    ctx.stroke();
                    ctx.strokeStyle = rgba(tint, a * 0.2);
                    ctx.lineWidth = width * 3.2;
                    ctx.stroke();
                    ctx.strokeStyle = rgba(tint, a * 0.7);
                    ctx.lineWidth = width * 0.85;
                    ctx.stroke();
                    prevX = nx;
                    prevY = ny;
                }
            }

            function drawFlare(now) {
                if (!flareCanvas) return;
                var state = flareState(now);
                if (!state) {
                    if (flareDrawn) {
                        flareCtx.setTransform(1, 0, 0, 1, 0, 0);
                        flareCtx.clearRect(0, 0, flareCanvas.width, flareCanvas.height);
                        flareDrawn = false;
                    }
                    return;
                }
                flareDrawn = true;
                var ctx = flareCtx;
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, flareCanvas.width, flareCanvas.height);
                ctx.setTransform(dpr, 0, 0, dpr, flareCanvas.width / 2, flareCanvas.height / 2);
                ctx.globalAlpha = state.opacity;
                ctx.globalCompositeOperation = 'lighter';
                ctx.lineCap = 'butt';
                ctx.rotate((state.angle + flareSpot.rot) * Math.PI / 180);

                var half = globeD * 0.78 * flareSpot.size;
                var weight = globeD * 0.034 * flareSpot.size;
                var reach = half * state.stretch * state.scale;
                var tall = reach * 0.62;
                var pal = flarePalette;
                flareArm(ctx, -1, 0, reach, weight, state.scale, pal[3]);   // teal
                flareArm(ctx, 1, 0, reach, weight, state.scale, pal[0]);    // pink
                flareArm(ctx, 0, -1, tall, weight, state.scale, pal[1]);    // indigo
                flareArm(ctx, 0, 1, tall, weight, state.scale, pal[4]);     // green

                var head = globeD * 0.062 * flareSpot.size * state.scale;
                var radius = head * 1.7;
                var halo = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
                var glow = mix(pal[2], [255, 255, 255], 0.7);
                halo.addColorStop(0, rgba(glow, 0.95));
                halo.addColorStop(0.18, rgba(glow, 0.55));
                halo.addColorStop(0.45, rgba(pal[2], 0.22));
                halo.addColorStop(0.75, rgba(pal[2], 0.06));
                halo.addColorStop(1, rgba(pal[2], 0));
                ctx.fillStyle = halo;
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(255, 255, 255, 1)';
                ctx.beginPath();
                ctx.arc(0, 0, head * 0.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.globalCompositeOperation = 'source-over';
            }
            function drawFrame(now) {
                raf = 0;
                if (!running) return;
                raf = window.requestAnimationFrame(drawFrame);
                var dt = Math.min(0.05, (now - lastT) / 1000);
                lastT = now;
                clock += dt;
                drawFlare(now);
                var intro = clamp((now - bornAt) / 1400, 0, 1);

                [bctx, fctx].forEach(function (ctx, index) {
                    var canvas = index ? front : back;
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.setTransform(dpr, 0, 0, dpr, canvas.width / 2, canvas.height / 2);
                    ctx.lineCap = 'butt';
                });
                if (!intro) return;

                var p0 = { x: 0, y: 0 };
                var p1 = { x: 0, y: 0 };
                var rxCap = Math.min(globeD * 0.57, window.innerWidth * 0.46);

                stars.forEach(function (star) {
                    var rx = Math.min(globeD * star.kx, rxCap);
                    var ry = globeD * star.ky;
                    var theta = star.dir * Math.PI * 2 * (clock / star.lap + star.phase);
                    if (star.gone) {
                        // Back after a few seconds: re-enter at the far side of the orbit, so it emerges from behind the globe
                        star.respawnIn -= dt * 1000;
                        if (star.respawnIn > 0) { star.head = null; return; }
                        star.phase = -star.dir * 0.25 - clock / star.lap;
                        theta = -Math.PI / 2;
                        star.gone = false;
                        star.bornAt = now;
                    }
                    var appear = smooth(clamp((now - star.bornAt) / 1300, 0, 1));
                    var grow = 0.55 + 0.45 * appear;
                    var span = (90 + star.size * 4) / Math.max(rx, 1);   // tail length as an angle
                    var headDepth = Math.sin(theta);
                    point(star, theta, rx, ry, p0);
                    var tx = p0.x;
                    var ty = p0.y;
                    var prevX = tx;
                    var prevY = ty;

                    for (var k = 0; k < TRAIL_STEPS; k++) {
                        var t1 = theta - star.dir * span * (k + 1) / TRAIL_STEPS;
                        point(star, t1, rx, ry, p1);
                        var u = (k + 0.5) / TRAIL_STEPS;
                        var depth = Math.sin(t1 + star.dir * span / TRAIL_STEPS / 2);
                        var fade = Math.pow(1 - u, 1.9) * depthAlpha(depth) * intro * appear;
                        var width = (star.size * 0.46 * Math.pow(1 - u, 0.85) + 0.4) * grow;
                        var ctx = depth > 0 ? fctx : bctx;
                        var tint = mix(star.color, star.tailColor, u);
                        ctx.beginPath();
                        ctx.moveTo(prevX, prevY);
                        ctx.lineTo(p1.x, p1.y);
                        ctx.strokeStyle = rgba(tint, fade * 0.07);
                        ctx.lineWidth = width * 6;
                        ctx.stroke();
                        ctx.strokeStyle = rgba(tint, fade * 0.16);
                        ctx.lineWidth = width * 3.2;
                        ctx.stroke();
                        ctx.strokeStyle = rgba(tint, fade * 0.6);
                        ctx.lineWidth = width * 0.85;
                        ctx.stroke();
                        prevX = p1.x;
                        prevY = p1.y;
                    }

                    var alpha = depthAlpha(headDepth) * intro * appear;
                    var hctx = headDepth > 0 ? fctx : bctx;
                    var radius = star.size * 1.7 * grow;
                    var halo = hctx.createRadialGradient(tx, ty, 0, tx, ty, radius);
                    halo.addColorStop(0, rgba(star.glow, alpha * 0.9));
                    halo.addColorStop(0.18, rgba(star.glow, alpha * 0.5));
                    halo.addColorStop(0.45, rgba(star.color, alpha * 0.2));
                    halo.addColorStop(0.75, rgba(star.color, alpha * 0.05));
                    halo.addColorStop(1, rgba(star.color, 0));
                    hctx.fillStyle = halo;
                    hctx.beginPath();
                    hctx.arc(tx, ty, radius, 0, Math.PI * 2);
                    hctx.fill();
                    hctx.fillStyle = rgba(star.glow, alpha);
                    hctx.beginPath();
                    hctx.arc(tx, ty, star.size * 0.17 * grow, 0, Math.PI * 2);
                    hctx.fill();

                    star.head = { x: tx, y: ty, alpha: alpha };
                });
            }

            function setRunning(next) {
                if (next === running) return;
                running = next;
                if (running) {
                    lastT = performance.now();
                    raf = window.requestAnimationFrame(drawFrame);
                } else if (raf) {
                    window.cancelAnimationFrame(raf);
                    raf = 0;
                }
            }

            function headAt(event) {
                var box = front.getBoundingClientRect();
                if (!box.width) return null;
                var scale = size / box.width;
                var x = (event.clientX - box.left - box.width / 2) * scale;
                var y = (event.clientY - box.top - box.height / 2) * scale;
                var best = null;
                var bestDistance = Infinity;
                stars.forEach(function (star) {
                    var head = star.head;
                    if (!head || head.alpha < 0.5) return;
                    var distance = Math.hypot(head.x - x, head.y - y);
                    if (distance < Math.max(22, star.size * 1.4) && distance < bestDistance) {
                        best = star;
                        bestDistance = distance;
                    }
                });
                return best;
            }

            layout();
            var resizeFrame = 0;
            function onResize() {
                window.cancelAnimationFrame(resizeFrame);
                resizeFrame = window.requestAnimationFrame(layout);
            }
            listen(window, 'resize', onResize);
            listen(document, 'visibilitychange', function () { setRunning(!document.hidden && !splashHidden()); });

            listen(stage, 'click', function (event) {
                var star = headAt(event);
                if (star) burst(star);
            });
            listen(stage, 'pointermove', function (event) {
                if (event.pointerType === 'mouse') stage.style.cursor = headAt(event) ? 'pointer' : '';
            }, { passive: true });

            setRunning(!document.hidden && !splashHidden());
            cleanups.push(function () {
                setRunning(false);
                window.cancelAnimationFrame(resizeFrame);
                stage.style.cursor = '';
                back.remove();
                front.remove();
                if (flareCanvas) flareCanvas.remove();
            });

            return { setRunning: setRunning };
        }

        function splashHidden() {
            return !!(splash && splash.classList.contains('is-offscreen'));
        }

        // A small lens flare and a burst of sparkles in the star's own colours.
        function burst(star) {
            var now = performance.now();
            if (star.poppedAt && now - star.poppedAt < POP_COOLDOWN_MS) return;
            star.poppedAt = now;
            var x = star.head.x;
            var y = star.head.y;
            // The star itself pops out of existence and returns 3-5.5s later (see drawFrame)
            star.gone = true;
            star.respawnIn = 3000 + Math.random() * 2500;
            star.head = null;

            var pop = document.createElement('span');
            pop.className = 'star-pop';
            pop.style.left = x + 'px';
            pop.style.top = y + 'px';
            pop.style.setProperty('--c', rgb(star.color));
            pop.style.setProperty('--c-glow', rgb(star.glow));
            pop.appendChild(document.createElement('i')).className = 'star-pop-glow';
            pop.appendChild(document.createElement('i')).className = 'star-pop-core';
            orbit.appendChild(pop);
            later(function () { pop.remove(); }, 1200);

            var sparks = 12 + Math.floor(Math.random() * 5);
            for (var n = 0; n < sparks; n++) {
                var spark = document.createElement('i');
                spark.className = 'spark';
                var size = 3 + Math.random() * 5;
                spark.style.width = spark.style.height = size + 'px';
                spark.style.left = x + 'px';
                spark.style.top = y + 'px';
                spark.style.setProperty('--c', rgb(n % 3 ? star.color : star.tailColor));
                spark.style.setProperty('--c-glow', rgb(star.glow));
                orbit.appendChild(spark);

                var angle = Math.random() * Math.PI * 2;
                var distance = 30 + Math.random() * 40;
                var dx = Math.cos(angle) * distance;
                var dy = Math.sin(angle) * distance;
                var motion = spark.animate([
                    { transform: 'translate(-50%, -50%) scale(.2) rotate(0deg)', opacity: 0 },
                    { transform: 'translate(calc(-50% + ' + (dx * 0.6) + 'px), calc(-50% + ' + (dy * 0.6) + 'px)) scale(1) rotate(45deg)', opacity: 0.95, offset: 0.3 },
                    { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(.15) rotate(90deg)', opacity: 0 }
                ], { duration: 1000 + Math.random() * 500, easing: 'cubic-bezier(.25, .6, .35, 1)', fill: 'forwards' });
                motion.onfinish = spark.remove.bind(spark);
            }
        }

        if (orbit && !reduceMotion) starState = startStars();
        /* ── hero: pause off-screen, tilt, hand-off ──────────────── */

        if (splash && 'IntersectionObserver' in window) {
            var visibility = new IntersectionObserver(function (entries) {
                splash.classList.toggle('is-offscreen', !entries[entries.length - 1].isIntersecting);
                if (starState) starState.setRunning(!document.hidden && !splashHidden());
            });
            visibility.observe(splash);
            observers.push(visibility);
            cleanups.push(function () { splash.classList.remove('is-offscreen'); });
        }

        if (stage && splash && !reduceMotion) {
            var frame = 0;
            var pointer = null;

            function paint() {
                frame = 0;
                var rect = splash.getBoundingClientRect();
                var progress = clamp(-rect.top / Math.max(1, rect.height * 0.7), 0, 1);
                stage.style.setProperty('--handoff', progress.toFixed(3));
                if (pointer && canTilt) {
                    var cx = rect.left + rect.width / 2;
                    var cy = rect.top + rect.height / 2;
                    var nx = clamp((pointer.x - cx) / (rect.width / 2), -1, 1);
                    var ny = clamp((pointer.y - cy) / (rect.height / 2), -1, 1);
                    stage.style.setProperty('--tilt-y', (nx * MAX_TILT_Y).toFixed(2) + 'deg');
                    stage.style.setProperty('--tilt-x', (-ny * MAX_TILT_X).toFixed(2) + 'deg');
                }
            }

            function request() {
                if (!frame) frame = window.requestAnimationFrame(paint);
            }

            listen(window, 'scroll', request, { passive: true });
            if (canTilt) {
                listen(document, 'pointermove', function (event) {
                    if (event.pointerType !== 'mouse') return;
                    pointer = { x: event.clientX, y: event.clientY };
                    request();
                }, { passive: true });
                listen(document.documentElement, 'pointerleave', function () {
                    pointer = null;
                    stage.style.setProperty('--tilt-x', '0deg');
                    stage.style.setProperty('--tilt-y', '0deg');
                });
            }
            paint();
            cleanups.push(function () {
                window.cancelAnimationFrame(frame);
                ['--handoff', '--tilt-x', '--tilt-y'].forEach(function (name) { stage.style.removeProperty(name); });
            });
        }

        return {
            root: prompt,
            destroy: function () {
                alive = false;
                timers.forEach(function (id) { window.clearTimeout(id); });
                observers.forEach(function (io) { io.disconnect(); });
                cleanups.forEach(function (fn) { fn(); });
            }
        };
    }

    function init(root) {
        var scope = root || document;
        scope.querySelectorAll('[data-explore-prompt]').forEach(function (prompt) {
            if (instances.some(function (item) { return item.root === prompt; })) return;
            var instance = mount(prompt);
            if (instance) instances.push(instance);
        });
    }

    function destroy(root) {
        instances = instances.filter(function (item) {
            if (root && !root.contains(item.root)) return true;
            item.destroy();
            return false;
        });
    }

    window.DoxxusExplore = { init: init, destroy: destroy };
    init(document);
}());

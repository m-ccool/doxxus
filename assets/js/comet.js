/**
 * comet.js — shooting stars for the background star layer.
 *
 * The comets are drawn on one canvas that lives INSIDE the star layer (#particle, see
 * particle.compiled.css), so they share its stacking, dimming and softness: behind everything on
 * the page, exactly like the stars. Each shooting star has the same shape as the stars that orbit
 * the globe (see explore-prompt.js): a soft glowing head and one continuous tapered tail that blends
 * from its colour to a second palette colour, with a few faint, twinkling specks shed behind it.
 * Every one differs in entry point, angle, speed, size, colours (from the site's rainbow-gradient
 * variables) and the pause before the next, and each path is long enough to cross the whole window.
 *
 * The canvas is re-attached whenever the client-side router swaps in a fresh star layer, and the
 * loop only runs while something is on screen. Reduced motion: no shooting stars.
 */
(function () {
    'use strict';

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var PALETTE_VARS = ['--pink', '--indigo', '--purple', '--teal', '--green'];
    var PALETTE_FALLBACK = [0xff8ab4, 0xe18aff, 0xbd8aff, 0x57d7ff, 0x8aff96];
    var MAX_SPARKS = 70;
    var TRAIL_STEPS = 26;
    var ALPHA = 0.62;           // overall strength: the whole effect is kept light

    var canvas = document.createElement('canvas');
    canvas.className = 'comet-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var W = 0;
    var H = 0;
    var dpr = 1;
    var palette = null;
    var comets = [];
    var sparks = [];
    var raf = 0;
    var lastT = 0;
    var spawnTimer = 0;

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function layer() {
        return document.querySelector('.particle-animation-bg');
    }

    function readPalette() {
        var style = getComputedStyle(document.documentElement);
        return PALETTE_VARS.map(function (name, i) {
            var raw = style.getPropertyValue(name).trim().replace('#', '');
            var n = parseInt(raw, 16);
            if (raw.length !== 6 || isNaN(n)) n = PALETTE_FALLBACK[i];
            return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        });
    }

    function resize() {
        W = window.innerWidth;
        H = window.innerHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
    }

    // The router replaces <main> (and with it the star layer), so re-attach when needed.
    function attach() {
        var host = layer();
        if (!host) return false;
        if (canvas.parentNode !== host) {
            host.appendChild(canvas);
            resize();
        }
        return true;
    }

    function rgba(c, a) {
        return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')';
    }

    function lighten(c, t) {
        return [c[0] + (255 - c[0]) * t, c[1] + (255 - c[1]) * t, c[2] + (255 - c[2]) * t];
    }

    /* ── spawning ────────────────────────────────────────────────── */

    function spawn() {
        if (!attach() || document.hidden) return;
        if (!palette) palette = readPalette();

        // A random line through a random point of the window, long enough to cross all of it.
        // Mostly falling (like real meteors), either direction, and sometimes shallow or rising.
        var falling = Math.random() < 0.86;
        var angle = (falling ? rand(14, 68) : -rand(8, 40)) * Math.PI / 180;
        var dir = Math.random() < 0.5 ? 1 : -1;
        var dx = Math.cos(angle) * dir;
        var dy = Math.sin(angle);
        var cx = rand(0.12, 0.88) * W;
        var cy = rand(0.12, 0.88) * H;
        var reach = Math.hypot(W, H) / 2 + 80;

        var color = palette[Math.floor(Math.random() * palette.length)];
        var tint = palette[Math.floor(Math.random() * palette.length)];
        comets.push({
            x0: cx - dx * reach,
            y0: cy - dy * reach,
            dx: dx,
            dy: dy,
            length: reach * 2,
            duration: rand(3.2, 6.4),
            age: 0,
            travelled: 0,
            size: rand(6, 12),
            color: color,
            tint: tint,
            glow: lighten(color, 0.45),
            tail: rand(110, 230),
            step: rand(16, 30),
            carry: 0,
            x: 0,
            y: 0
        });
        start();
    }

    function scheduleNext(first) {
        window.clearTimeout(spawnTimer);
        spawnTimer = window.setTimeout(function () {
            spawn();
            if (Math.random() < 0.14) window.setTimeout(spawn, rand(350, 1300));   // the odd pair
            scheduleNext(false);
        }, first ? rand(1800, 4200) : rand(4500, 14000));
    }

    /* ── drawing ─────────────────────────────────────────────────── */

    function emit(comet, count) {
        for (var i = 0; i < count && sparks.length < MAX_SPARKS; i++) {
            var life = rand(0.8, 1.8);
            sparks.push({
                x: comet.x - comet.dx * rand(8, comet.tail * 0.55) + rand(-1, 1) * comet.size * 0.5,
                y: comet.y - comet.dy * rand(8, comet.tail * 0.55) + rand(-1, 1) * comet.size * 0.5,
                vx: rand(-6, 6) - comet.dx * rand(0, 8),
                vy: rand(-6, 6) - comet.dy * rand(0, 8) + rand(0, 4),   // a little settling drift
                age: 0,
                life: life,
                size: rand(0.5, 1.3),
                phase: rand(0, Math.PI * 2),
                rate: rand(10, 22),
                color: Math.random() < 0.6 ? comet.color : comet.tint,
                cross: Math.random() < 0.28
            });
        }
    }

    function drawSpark(s) {
        var t = s.age / s.life;
        var twinkle = 0.55 + 0.45 * Math.sin(s.phase + s.age * s.rate);
        var a = Math.pow(1 - t, 1.5) * twinkle * 0.6 * ALPHA;
        if (a < 0.01) return;
        var size = s.size * (1 - t * 0.35);

        ctx.fillStyle = rgba(s.color, a * 0.22);
        ctx.beginPath();
        ctx.arc(s.x, s.y, size * 2.6, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = rgba(lighten(s.color, 0.6), a * 0.9);
        ctx.beginPath();
        ctx.arc(s.x, s.y, size, 0, 6.2832);
        ctx.fill();

        if (s.cross) {
            var arm = size * 4.2;
            ctx.strokeStyle = rgba(lighten(s.color, 0.7), a * 0.55);
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(s.x - arm, s.y);
            ctx.lineTo(s.x + arm, s.y);
            ctx.moveTo(s.x, s.y - arm);
            ctx.lineTo(s.x, s.y + arm);
            ctx.stroke();
        }
    }

    // Same construction as the stars circling the globe: a continuous tail of short tapered strokes
    // (haze, glow, core) blending from the star's colour to a second palette colour, then a glowing head.
    function drawComet(c, fade) {
        var length = c.tail;
        var prevX = c.x;
        var prevY = c.y;
        ctx.lineCap = 'butt';
        for (var k = 0; k < TRAIL_STEPS; k++) {
            var u = (k + 0.5) / TRAIL_STEPS;
            var nx = c.x - c.dx * length * (k + 1) / TRAIL_STEPS;
            var ny = c.y - c.dy * length * (k + 1) / TRAIL_STEPS;
            var a = Math.pow(1 - u, 1.9) * fade * ALPHA;
            var width = c.size * 0.46 * Math.pow(1 - u, 0.85) + 0.4;
            var tint = [
                c.color[0] + (c.tint[0] - c.color[0]) * u,
                c.color[1] + (c.tint[1] - c.color[1]) * u,
                c.color[2] + (c.tint[2] - c.color[2]) * u
            ];
            ctx.beginPath();
            ctx.moveTo(prevX, prevY);
            ctx.lineTo(nx, ny);
            ctx.strokeStyle = rgba(tint, a * 0.07);
            ctx.lineWidth = width * 6;
            ctx.stroke();
            ctx.strokeStyle = rgba(tint, a * 0.16);
            ctx.lineWidth = width * 3.2;
            ctx.stroke();
            ctx.strokeStyle = rgba(tint, a * 0.6);
            ctx.lineWidth = width * 0.85;
            ctx.stroke();
            prevX = nx;
            prevY = ny;
        }

        var alpha = fade * ALPHA;
        var radius = c.size * 1.7;
        var halo = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, radius);
        halo.addColorStop(0, rgba(c.glow, alpha * 0.9));
        halo.addColorStop(0.18, rgba(c.glow, alpha * 0.5));
        halo.addColorStop(0.45, rgba(c.color, alpha * 0.2));
        halo.addColorStop(0.75, rgba(c.color, alpha * 0.05));
        halo.addColorStop(1, rgba(c.color, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(c.x, c.y, radius, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = rgba(c.glow, alpha);
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.size * 0.17, 0, 6.2832);
        ctx.fill();
    }
    function frame(now) {
        raf = 0;
        var dt = Math.min(0.05, (now - lastT) / 1000);
        lastT = now;

        if (!attach()) {
            comets.length = 0;
            sparks.length = 0;
            return;
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';

        for (var i = comets.length - 1; i >= 0; i--) {
            var c = comets[i];
            c.age += dt;
            var u = c.age / c.duration;
            if (u >= 1) {
                comets.splice(i, 1);
                continue;
            }
            // Mostly steady, easing gently in and out
            var eased = 0.55 * u + 0.45 * (u * u * (3 - 2 * u));
            var d = eased * c.length;
            var moved = d - c.travelled;
            c.travelled = d;
            c.x = c.x0 + c.dx * d;
            c.y = c.y0 + c.dy * d;

            // One sparkle every few pixels of travel, so density does not depend on frame rate
            c.carry += moved;
            var n = Math.floor(c.carry / c.step);
            if (n > 0) {
                c.carry -= n * c.step;
                emit(c, Math.min(n, 4));
            }

            var edge = Math.min(u / 0.05, (1 - u) / 0.08, 1);   // fade in and out at the ends of its path
            drawComet(c, edge);
        }

        for (var j = sparks.length - 1; j >= 0; j--) {
            var s = sparks[j];
            s.age += dt;
            if (s.age >= s.life) {
                sparks.splice(j, 1);
                continue;
            }
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            drawSpark(s);
        }

        ctx.globalCompositeOperation = 'source-over';
        if (comets.length || sparks.length) raf = window.requestAnimationFrame(frame);
        else ctx.clearRect(0, 0, W, H);
    }

    function start() {
        if (raf) return;
        lastT = performance.now();
        raf = window.requestAnimationFrame(frame);
    }

    window.addEventListener('resize', function () { if (canvas.parentNode) resize(); });
    window.DoxxusComets = { spawn: spawn };
    scheduleNext(true);
}());

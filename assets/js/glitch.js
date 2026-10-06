/**
 * glitch.js — the "glitch typing" effect: an element's text is replaced by a caret
 * and re-typed one character at a time, occasionally flashing a wrong glyph first.
 *
 * Shared by the home page (word/letter/skill targets) and the contact dialog (labels),
 * so it loads on every page.
 *
 *   var cancel = DoxxusGlitch.run(el, onDone);
 *
 * run() returns a cancel function. Cancelling stops every timer and puts the original
 * text back, so a run that is interrupted (modal closed, route changed) never leaves
 * half-typed or scrambled text behind.
 */
(function () {
    'use strict';

    var GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*+=/\\';

    function randChar() {
        return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    }

    function randomItems(items, count) {
        return items.slice().sort(function () { return Math.random() - 0.5; }).slice(0, count);
    }

    function run(el, onDone) {
        var original = el.textContent.trim();
        var timers = [];
        var finished = false;
        var text = document.createElement('span');
        var caret = document.createElement('span');

        function later(fn, ms) {
            timers.push(window.setTimeout(fn, ms));
        }

        function cancel() {
            if (finished) return;
            finished = true;
            timers.forEach(window.clearTimeout);
            el.textContent = original;
            el.classList.remove('is-glitch-typing');
        }

        function finish() {
            later(function () {
                finished = true;
                el.classList.remove('is-glitch-typing');
                if (onDone) onDone();
            }, 160);
        }

        caret.className = 'glitch-caret';
        caret.setAttribute('aria-hidden', 'true');
        el.textContent = '';
        el.append(text, caret);
        el.classList.add('is-glitch-typing');

        if (original.length === 1) {
            var frames = 3 + Math.floor(Math.random() * 4);
            (function scrambleLetter(frame) {
                if (frame < frames) {
                    text.textContent = randChar();
                    later(function () { scrambleLetter(frame + 1); }, 90 + Math.random() * 100);
                    return;
                }
                text.textContent = original;
                finish();
            }(0));
            return cancel;
        }

        (function type(index, current) {
            if (index < original.length) {
                var character = original[index];
                if (Math.random() < 0.28 && /[A-Za-z0-9]/.test(character)) {
                    text.textContent = current + randChar();
                    later(function () { type(index, current); }, 60 + Math.random() * 100);
                    return;
                }
                text.textContent = current + character;
                later(function () { type(index + 1, current + character); }, 80 + Math.random() * 140);
                return;
            }
            finish();
        }(0, ''));

        return cancel;
    }

    window.DoxxusGlitch = { run: run, randomItems: randomItems };
}());

/**
 * home.js — the homepage's living-terminal behaviour: splash dismissal, wordmark
 * typing, glitch typing, and terminal-title dots.
 *
 * DoxxusHome.start() runs on a hard load of the home page and again whenever the
 * client-side router swaps the home content in; DoxxusHome.stop() ends every timer,
 * observer and listener when the router leaves it. The splash overlay only exists in
 * index.html's body, so it only ever plays on a hard load.
 */
(function () {
    'use strict';

    var generation = 0;
    var observers = [];
    var cleanups = [];

    // setTimeout that silently does nothing once stop() has been called.
    function later(fn, ms) {
        var g = generation;
        return setTimeout(function () { if (g === generation) fn(); }, ms);
    }

    function stop() {
        generation += 1;
        observers.forEach(function (io) { io.disconnect(); });
        cleanups.forEach(function (fn) { fn(); });
        observers = [];
        cleanups = [];
    }

    function start() {
        stop();
        var myGeneration = generation;
        var fill = document.getElementById('splash-bar-fill');
        var overlay = document.getElementById('splash-overlay');
        var startTime = Date.now();
        var typingStarted = false;
        var GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*+=/\\';

        function randChar() {
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }

        function deleteText(textEl, caretEl, current, interval, callback) {
            if (caretEl) caretEl.classList.add('deleting');
            function step() {
                if (current.length > 0) {
                    current = current.slice(0, -1);
                    textEl.textContent = current;
                    later(step, interval);
                } else {
                    if (caretEl) caretEl.classList.remove('deleting');
                    callback();
                }
            }
            step();
        }

        // Terminal-style reveal: type gibberish, delete it, then type + settle on the real word.
        function runScrambleTyping(textEl, caretEl, target, onDone) {
            var scrambleLen = target.length;
            var scramble = '';
            var i = 0;
            if (caretEl) caretEl.classList.add('is-typing');

            function typeScramble() {
                if (i < scrambleLen) {
                    scramble += randChar();
                    textEl.textContent = scramble;
                    i++;
                    later(typeScramble, 150);
                } else {
                    later(function(){
                        deleteText(textEl, caretEl, scramble, 90, function(){
                            later(function(){ typeFinal(0, ''); }, 360);
                        });
                    }, 480);
                }
            }

            function typeFinal(index, current) {
                if (index >= target.length) {
                    if (caretEl) caretEl.classList.remove('is-typing');
                    if (onDone) onDone();
                    return;
                }
                var next = current + target[index];
                textEl.textContent = next;
                var delay = 140 + Math.random() * 110; // natural, human-like keystroke variance
                later(function(){ typeFinal(index + 1, next); }, delay);
            }

            typeScramble();
        }

        // Occasional delete + retype-with-a-few-typos, for a living-terminal feel while the wordmark is visible.
        function runTypoRetype(textEl, caretEl, target, onDone) {
            if (caretEl) caretEl.classList.add('is-typing');
            deleteText(textEl, caretEl, target, 80, function(){
                later(function(){ typeWithTypos(0, ''); }, 320);
            });

            function typeWithTypos(index, current) {
                if (index >= target.length) {
                    if (caretEl) caretEl.classList.remove('is-typing');
                    if (onDone) onDone();
                    return;
                }
                var makeTypo = Math.random() < 0.35;
                if (makeTypo) {
                    textEl.textContent = current + randChar();
                    if (caretEl) caretEl.classList.add('deleting');
                    later(function(){
                        textEl.textContent = current;
                        if (caretEl) caretEl.classList.remove('deleting');
                        later(function(){
                            var next = current + target[index];
                            textEl.textContent = next;
                            later(function(){ typeWithTypos(index + 1, next); }, 250);
                        }, 160);
                    }, 220);
                } else {
                    var next2 = current + target[index];
                    textEl.textContent = next2;
                    later(function(){ typeWithTypos(index + 1, next2); }, 220);
                }
            }
        }

        // Replays the typo-retype every few minutes, only while the wordmark is on screen and the tab is visible.
        function scheduleRetype(el, textEl, caretEl, target) {
            var isVisible = true;
            if ('IntersectionObserver' in window) {
                var io = new IntersectionObserver(function(entries) {
                    entries.forEach(function(entry) { isVisible = entry.isIntersecting; });
                });
                io.observe(el);
                observers.push(io);
            }

            function tick() {
                var delay = 150000 + Math.random() * 150000; // every 2.5-5 minutes
                later(function(){
                    if (isVisible && document.visibilityState === 'visible') {
                        runTypoRetype(textEl, caretEl, target, tick);
                    } else {
                        tick();
                    }
                }, delay);
            }
            tick();
        }

        function randomItems(items, count) {
            return items.sort(function(){ return Math.random() - 0.5; }).slice(0, count);
        }

        // The effect itself lives in glitch.js (shared with the contact dialog).
        // Cancelling restores the element's text, so stop() never strands scrambled text.
        function runGlitchTyping(el, onDone) {
            var cancel = DoxxusGlitch.run(el, function () {
                if (generation === myGeneration) onDone && onDone();
            });
            cleanups.push(cancel);
        }

        function startGlitchTargets(reduceMotion) {
            if (reduceMotion) return;
            var selector = '[data-glitch-word], [data-glitch-letter], #skill-cards .skill-card span';

            function visibleTargets() {
                return Array.from(document.querySelectorAll(selector)).filter(function(el){
                    var rect = el.getBoundingClientRect();
                    return rect.top < window.innerHeight * 0.85 && rect.bottom > window.innerHeight * 0.15 && !el.classList.contains('is-glitch-typing');
                });
            }

            function tick(delay) {
                later(function(){
                    var targets = visibleTargets();
                    if (document.visibilityState === 'visible' && targets.length) {
                        runGlitchTyping(randomItems(targets, 1)[0], function(){ tick(4500 + Math.random() * 5500); });
                    } else {
                        tick(1200);
                    }
                }, delay);
            }

            tick(900 + Math.random() * 1300);
        }

        function startTyping() {
            if (typingStarted) return;
            typingStarted = true;
            var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            startGlitchTargets(reduceMotion);
            document.querySelectorAll('.typed-out').forEach(function(el) {
                var textEl = el.querySelector('.brand-type-text');
                var caretEl = el.querySelector('.brand-caret');
                if (!textEl) return;
                var target = (textEl.getAttribute('data-brand') || textEl.textContent).trim();
                textEl.textContent = '';
                if (reduceMotion) {
                    textEl.textContent = target;
                    return;
                }
                runScrambleTyping(textEl, caretEl, target, function(){
                    scheduleRetype(el, textEl, caretEl, target);
                });
            });
        }

        if (fill) requestAnimationFrame(function(){ fill.style.width = '100%'; });
        function dismiss() {
            var elapsed = Date.now() - startTime;
            var remaining = Math.max(1050 - elapsed, 0);
            later(function(){
                if (!overlay) {
                    startTyping();
                    return;
                }
                overlay.classList.add('splash-done');
                later(function(){
                    overlay.remove();
                    startTyping();
                }, 700);
            }, remaining);
        }
        if (document.readyState === 'complete') { dismiss(); }
        else { window.addEventListener('load', dismiss); }

        // Safety: always start splash typing if overlay timing is interrupted.
        later(startTyping, 4500);
    }

    window.DoxxusHome = { start: start, stop: stop };

    if (document.body.getAttribute('data-page') === 'home') start();
}());

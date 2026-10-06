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

        function runGlitchTyping(el, onDone) {
            if (el.classList.contains('modal-headline')) {
                var lines = Array.from(el.querySelectorAll('.glitch-line'));
                var lineTargets = lines.map(function (line) { return line.textContent; });
                var lineIndex = 0;

                el.classList.add('is-glitch-typing');

                function typeLine() {
                    if (lineIndex >= lines.length) {
                        later(function(){
                            el.classList.remove('is-glitch-typing');
                            if (onDone) onDone();
                        }, 160);
                        return;
                    }

                    var line = lines[lineIndex];
                    var targetLine = lineTargets[lineIndex];
                    var textLine = document.createElement('span');
                    var caretLine = document.createElement('span');
                    var characterIndex = 0;

                    textLine.className = 'glitch-line-text';
                    caretLine.className = 'glitch-caret';
                    caretLine.setAttribute('aria-hidden', 'true');
                    line.replaceChildren(textLine, caretLine);

                    function typeCharacter() {
                        if (characterIndex >= targetLine.length) {
                            caretLine.remove();
                            lineIndex += 1;
                            typeLine();
                            return;
                        }
                        characterIndex += 1;
                        textLine.textContent = targetLine.slice(0, characterIndex);
                        later(typeCharacter, 80 + Math.random() * 140);
                    }

                    typeCharacter();
                }

                typeLine();
                return;
            }

            var target = el.textContent.trim();
            var text = document.createElement('span');
            var caret = document.createElement('span');
            caret.className = 'glitch-caret';
            caret.setAttribute('aria-hidden', 'true');
            el.textContent = '';
            el.append(text, caret);
            el.classList.add('is-glitch-typing');

            function finish() {
                later(function(){
                    el.classList.remove('is-glitch-typing');
                    if (onDone) onDone();
                }, 160);
            }

            if (target.length === 1) {
                var frames = 3 + Math.floor(Math.random() * 4);
                function scrambleLetter(frame) {
                    if (frame < frames) {
                        text.textContent = randChar();
                        later(function(){ scrambleLetter(frame + 1); }, 90 + Math.random() * 100);
                        return;
                    }
                    text.textContent = target;
                    finish();
                }
                scrambleLetter(0);
                return;
            }

            function type(index, current) {
                if (index < target.length) {
                    var character = target[index];
                    if (Math.random() < 0.28 && /[A-Za-z0-9]/.test(character)) {
                        text.textContent = current + randChar();
                        later(function(){ type(index, current); }, 60 + Math.random() * 100);
                        return;
                    }
                    text.textContent = current + character;
                    later(function(){ type(index + 1, current + character); }, 80 + Math.random() * 140);
                    return;
                }
                finish();
            }
            type(0, '');
        }

        function startGlitchTargets(reduceMotion) {
            if (reduceMotion) return;
            var selector = '[data-glitch-word], [data-glitch-letter], [data-glitch-modal], #skill-cards .skill-card span';

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

        function startContactGlitch(reduceMotion) {
            if (reduceMotion) return;
            var contactModal = document.getElementById('contact');
            if (!contactModal) return;
            var onShown = function(){
                var targets = Array.from(contactModal.querySelectorAll('[data-glitch-modal]'));
                if (!targets.length) return;
                later(function(){ runGlitchTyping(randomItems(targets, 1)[0]); }, 450 + Math.random() * 500);
            };
            contactModal.addEventListener('shown.bs.modal', onShown);
            cleanups.push(function(){ contactModal.removeEventListener('shown.bs.modal', onShown); });
        }

        function startTerminalTitleTyping(reduceMotion) {
            var titles = Array.from(document.querySelectorAll('[data-terminal-title]'));
            if (!titles.length || reduceMotion) return;

            titles.forEach(function(title, index) {
                var text = title.querySelector('.section-terminal-text');
                if (!text) return;

                function isVisible() {
                    var rect = title.getBoundingClientRect();
                    return rect.top < window.innerHeight * 0.9 && rect.bottom > window.innerHeight * 0.1;
                }

                function replay() {
                    var delay = 7000 + Math.random() * 7000;
                    later(function(){
                        if (!isVisible()) {
                            replay();
                            return;
                        }

                        title.classList.add('is-typing');
                        text.textContent = '';
                        var dots = 0;

                        function typeDot() {
                            if (dots < 3) {
                                text.textContent += '.';
                                dots++;
                                later(typeDot, 220);
                                return;
                            }
                            title.classList.remove('is-typing');
                            replay();
                        }

                        later(typeDot, 180);
                    }, delay);
                }

                later(replay, 1200 + index * 900);
            });
        }

        function startTyping() {
            if (typingStarted) return;
            typingStarted = true;
            var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            startGlitchTargets(reduceMotion);
            startContactGlitch(reduceMotion);
            startTerminalTitleTyping(reduceMotion);
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

/**
 * code-titles.js — gives every page and section title the same code look and the
 * same typing animation: a "$" prompt in front; on first scroll into view the title
 * text types itself out behind a cursor; then a typed "..." and a blinking caret
 * sit after the last word, and the dots re-type every few seconds while the title
 * is on screen. Now and then the whole title also deletes itself and types again,
 * occasionally fumbling a key first, like someone at a terminal.
 *
 * Titles are found by selector, so the HTML stays plain headings. The prompt, dots
 * and caret are decoration (aria-hidden) and the heading carries its full text as
 * aria-label, so the accessible name never changes mid-animation.
 *
 * Layout never shifts: untyped characters stay in place, hidden, until typed.
 *
 * DoxxusTitles.init(root) / destroy(root) let the client-side router mount and tear
 * titles down as page content is swapped. Reduced motion: titles are shown static.
 */
(function () {
    'use strict';

    var SELECTOR = [
        'main h1',
        '.begin-headline',
        '.ds-section-title',
        '.section-terminal-title',
        '.svc-consult-copy h3',
        '.ds-modal-title',
        '[data-builder-confirm] h2'
    ].join(',');

    var SKIP = '.ct-prompt, .section-terminal-suffix, .visually-hidden';
    var DOT_MS = 220;
    var FIRST_DELAY_MS = 300;
    var TEXT_TOTAL_MS = 1500;
    var REPLAY_MIN_MS = 7000;
    var REPLAY_SPREAD_MS = 7000;
    var RETYPE_MIN_MS = 40000;
    var RETYPE_SPREAD_MS = 40000;
    var TYPO_CHANCE = 0.07;
    var TYPO_GLYPHS = 'abcdefghijklmnopqrstuvwxyz';

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var canAnimate = !reduceMotion && 'IntersectionObserver' in window;
    var entries = [];

    function span(className, attrs) {
        var node = document.createElement('span');
        node.className = className;
        if (attrs) Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
        return node;
    }

    function textNodes(root) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                if (!node.data.trim()) return NodeFilter.FILTER_REJECT;
                var parent = node.parentElement;
                return parent && parent.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
            }
        });
        var list = [];
        while (walker.nextNode()) list.push(walker.currentNode);
        return list;
    }

    // Adds the prompt and wraps the last word with the dots + caret, so the suffix
    // can never wrap onto a line of its own.
    function decorate(heading) {
        if (heading.getAttribute('data-ct')) return null;
        var nodes = textNodes(heading);
        if (!nodes.length) return null;
        heading.setAttribute('data-ct', '1');
        heading.classList.add('ct');
        heading.setAttribute('aria-label', heading.innerText.replace(/\s+/g, ' ').trim());

        heading.insertBefore(span('ct-prompt', { 'aria-hidden': 'true' }), heading.firstChild).textContent = '$';

        var node = nodes[nodes.length - 1];
        var text = node.data;
        var match = /(\S+)\s*$/.exec(text);
        var holder = span('section-terminal-lastword');
        // A closing period is replaced by the typed dots; it stays for screen readers.
        var word = match[1];
        var period = /\.$/.test(word) && word.length > 1;
        holder.textContent = period ? word.slice(0, -1) : word;
        if (period) {
            var spoken = span('visually-hidden');
            spoken.textContent = '.';
            holder.appendChild(spoken);
        }

        var suffix = span('section-terminal-suffix', { 'data-terminal-title': '', 'aria-hidden': 'true' });
        var dots = span('section-terminal-text');
        suffix.appendChild(dots);
        suffix.appendChild(span('section-terminal-caret'));
        holder.appendChild(suffix);

        var parent = node.parentNode;
        parent.insertBefore(document.createTextNode(text.slice(0, match.index)), node);
        parent.insertBefore(holder, node);
        parent.removeChild(node);

        return { heading: heading, suffix: suffix, dots: dots, parts: [] };
    }

    // Hides every character until it is typed. Hidden text keeps its space.
    function splitForTyping(entry) {
        textNodes(entry.heading).forEach(function (node) {
            var full = node.data;
            var rest = span('ct-rest');
            rest.textContent = full;
            node.data = '';
            node.parentNode.insertBefore(rest, node.nextSibling);
            entry.parts.push({ node: node, rest: rest, full: full });
        });
        entry.heading.classList.add('ct-typing');
    }

    function start(entry) {
        var visible = false;
        var alive = true;
        var cursor = span('ct-cursor', { 'aria-hidden': 'true' });
        var retypeTimer = 0;

        function later(fn, ms) {
            entry.timer = window.setTimeout(function () { if (alive) fn(); }, ms);
        }

        // wrong: a stray character shown in place of the next real one (a typo).
        function render(count, wrong) {
            var remaining = count;
            var active = null;
            entry.parts.forEach(function (part) {
                var take = Math.min(remaining, part.full.length);
                part.node.data = part.full.slice(0, take);
                part.rest.textContent = part.full.slice(take);
                remaining -= take;
                if (!active && take < part.full.length) active = part;
            });
            active = active || entry.parts[entry.parts.length - 1];
            if (wrong && active.rest.textContent) {
                active.node.data += wrong;
                active.rest.textContent = active.rest.textContent.slice(1);
            }
            active.node.parentNode.insertBefore(cursor, active.node.nextSibling);
        }

        function finishText() {
            cursor.remove();
            entry.parts.forEach(function (part) {
                part.node.data = part.full;
                part.rest.remove();
            });
            entry.parts = [];
            entry.heading.classList.remove('ct-typing');
        }

        function total() {
            return entry.parts.reduce(function (sum, part) { return sum + part.full.length; }, 0);
        }

        function typeText(done, withTypos) {
            var length = total();
            var base = Math.max(16, Math.min(60, TEXT_TOTAL_MS / Math.max(length, 1)));
            var count = 0;
            (function step() {
                render(count);
                if (count >= length) {
                    finishText();
                    if (done) done();
                    return;
                }
                var next = fullText().charAt(count);
                if (withTypos && /[a-z]/i.test(next) && Math.random() < TYPO_CHANCE) {
                    var wrong = TYPO_GLYPHS.charAt(Math.floor(Math.random() * TYPO_GLYPHS.length));
                    render(count, wrong);
                    later(function () {
                        render(count);
                        later(step, base * 2);
                    }, 240);
                    return;
                }
                count += 1;
                later(step, base * (0.7 + Math.random() * 0.6));
            }());
        }

        function fullText() {
            return entry.parts.map(function (part) { return part.full; }).join('');
        }

        function deleteText(done) {
            var count = total();
            var base = Math.max(10, Math.min(30, 700 / Math.max(count, 1)));
            (function step() {
                render(count);
                if (count <= 0) { if (done) done(); return; }
                count -= 1;
                later(step, base);
            }());
        }

        // Delete the whole title, pause, then type it again (with the odd typo).
        function retypeText(done) {
            splitForTyping(entry);
            deleteText(function () {
                later(function () { typeText(done, true); }, 280);
            });
        }

        function typeDots(done) {
            entry.suffix.classList.add('is-typing');
            entry.dots.textContent = '';
            var count = 0;
            (function step() {
                if (count < 3) {
                    entry.dots.textContent += '.';
                    count += 1;
                    later(step, DOT_MS);
                    return;
                }
                entry.suffix.classList.remove('is-typing');
                if (done) done();
            }());
        }

        function replay() {
            later(function () {
                if (visible && document.visibilityState === 'visible') typeDots(replay);
                else replay();
            }, REPLAY_MIN_MS + Math.random() * REPLAY_SPREAD_MS);
        }

        // The occasional full retype. The dots re-type afterwards, and their own timer resumes.
        function scheduleRetype() {
            retypeTimer = window.setTimeout(function () {
                if (!alive) return;
                if (visible && document.visibilityState === 'visible') {
                    window.clearTimeout(entry.timer);
                    retypeText(function () {
                        typeDots(function () { replay(); scheduleRetype(); });
                    });
                } else {
                    scheduleRetype();
                }
            }, RETYPE_MIN_MS + Math.random() * RETYPE_SPREAD_MS);
        }

        if (!canAnimate) {
            entry.dots.textContent = '...';
            entry.stop = function () { alive = false; };
            return;
        }

        splitForTyping(entry);
        render(0);

        function intro() {
            later(function () { typeText(function () { typeDots(replay); scheduleRetype(); }); }, FIRST_DELAY_MS);
        }

        var seen = false;
        entry.observer = new IntersectionObserver(function (changes) {
            visible = changes[changes.length - 1].isIntersecting;
            if (visible && !seen) {
                seen = true;
                intro();
            }
        }, { threshold: 0.6 });
        entry.observer.observe(entry.heading);

        // Types the title again from the start (the contact dialog does this on every open).
        entry.retypeNow = function () {
            window.clearTimeout(entry.timer);
            window.clearTimeout(retypeTimer);
            cursor.remove();
            if (!entry.parts.length) splitForTyping(entry);
            render(0);
            seen = true;
            intro();
        };

        entry.stop = function () {
            alive = false;
            window.clearTimeout(entry.timer);
            window.clearTimeout(retypeTimer);
            entry.observer.disconnect();
            cursor.remove();
        };
    }

    function init(root) {
        var scope = root || document;
        scope.querySelectorAll(SELECTOR).forEach(function (heading) {
            var entry = decorate(heading);
            if (!entry) return;
            entries.push(entry);
            start(entry);
        });
    }

    function destroy(root) {
        entries = entries.filter(function (entry) {
            if (root && !root.contains(entry.heading)) return true;
            if (entry.stop) entry.stop();
            return false;
        });
    }

    function retype(root) {
        entries.forEach(function (entry) {
            if (entry.retypeNow && (!root || root.contains(entry.heading))) entry.retypeNow();
        });
    }

    window.DoxxusTitles = { init: init, destroy: destroy, retype: retype };
    init(document);
}());

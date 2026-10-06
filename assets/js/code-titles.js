/**
 * code-titles.js — gives every page and section title the same code look and the
 * same periodic typing animation: a "$" prompt in front, and a typed "..." plus a
 * blinking caret after the last word that re-types itself every few seconds while
 * the title is on screen.
 *
 * Titles are found by selector, so the HTML stays plain headings. The prompt, dots
 * and caret are decoration (aria-hidden); the heading's accessible name is untouched.
 *
 * DoxxusTitles.init(root) / destroy(root) let the client-side router mount and tear
 * titles down as page content is swapped. Reduced motion: dots are shown static.
 */
(function () {
    'use strict';

    var SELECTOR = [
        'main h1',
        '.begin-headline',
        '.ds-section-title',
        '.section-terminal-title',
        '.svc-consult-copy h3',
        '[data-builder-confirm] h2'
    ].join(',');

    var DOT_MS = 220;
    var FIRST_DELAY_MS = 350;
    var REPLAY_MIN_MS = 7000;
    var REPLAY_SPREAD_MS = 7000;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var entries = [];

    function span(className, attrs) {
        var node = document.createElement('span');
        node.className = className;
        if (attrs) Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
        return node;
    }

    function lastTextNode(root) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
                return node.parentElement.closest('[aria-hidden="true"]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
            }
        });
        var last = null;
        while (walker.nextNode()) last = walker.currentNode;
        return last;
    }

    // Adds the prompt and wraps the last word with the dots + caret, so the suffix
    // can never wrap onto a line of its own.
    function decorate(heading) {
        if (heading.getAttribute('data-ct')) return null;
        var node = lastTextNode(heading);
        if (!node) return null;
        heading.setAttribute('data-ct', '1');
        heading.classList.add('ct');

        heading.insertBefore(span('ct-prompt', { 'aria-hidden': 'true' }), heading.firstChild).textContent = '$';

        var text = node.textContent;
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

        return { heading: heading, suffix: suffix, dots: dots };
    }

    function start(entry) {
        var visible = false;
        var alive = true;

        function later(fn, ms) {
            entry.timer = window.setTimeout(function () { if (alive) fn(); }, ms);
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

        if (reduceMotion || !('IntersectionObserver' in window)) {
            entry.dots.textContent = '...';
            entry.stop = function () { alive = false; };
            return;
        }

        var seen = false;
        entry.observer = new IntersectionObserver(function (changes) {
            visible = changes[changes.length - 1].isIntersecting;
            if (visible && !seen) {
                seen = true;
                later(function () { typeDots(replay); }, FIRST_DELAY_MS);
            }
        }, { threshold: 0.6 });
        entry.observer.observe(entry.heading);

        entry.stop = function () {
            alive = false;
            window.clearTimeout(entry.timer);
            entry.observer.disconnect();
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

    window.DoxxusTitles = { init: init, destroy: destroy };
    init(document);
}());

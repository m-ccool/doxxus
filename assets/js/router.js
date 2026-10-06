/**
 * router.js — client-side navigation between the site's pages.
 *
 * The navbar, footer, cursor effects and contact modal stay mounted. Clicking an
 * internal link shows a skeleton shimmer in place of <main>, fetches the target page,
 * merges any stylesheets/scripts it needs, swaps <main>, and animates the navbar
 * indicator. The splash and a full page load only happen on the first visit.
 *
 * Fail closed: any fetch, parse or asset error falls back to a normal navigation.
 *
 * Page lifecycles: DoxxusPortfolio.destroy/init, DoxxusHome.stop/start,
 * DoxxusPages.init, SiteShell.setPage/observeSections.
 */
(function () {
    'use strict';

    if (!window.fetch || !window.DOMParser || !window.history || !history.pushState) return;

    var MIN_SKELETON_MS = 350;
    var ASSET_TIMEOUT_MS = 8000;
    var FETCH_TIMEOUT_MS = 10000;
    var PAGE_CLASSES = ['FADE', 'ds-page'];
    var HEAD_SYNC = [
        'meta[name="description"]',
        'link[rel="canonical"]',
        'meta[property="og:url"]',
        'meta[property="og:title"]',
        'meta[property="og:type"]',
        'meta[property="og:image"]'
    ];

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var token = 0;
    var currentPath = normalize(location.pathname);

    history.scrollRestoration = 'manual';

    /* ── url helpers ─────────────────────────────────────────────── */

    function normalize(path) {
        return path.replace(/index\.html$/, '');
    }

    function routable(anchor) {
        if (!anchor || !anchor.getAttribute('href')) return null;
        if (anchor.target && anchor.target !== '_self') return null;
        if (anchor.hasAttribute('download')) return null;
        var toggle = anchor.getAttribute('data-bs-toggle');
        if (toggle && toggle !== 'tooltip') return null;
        var url;
        try { url = new URL(anchor.href, location.href); } catch (e) { return null; }
        if (url.origin !== location.origin) return null;
        if (!/(\.html|\/)$/.test(url.pathname)) return null;
        return url;
    }

    function sleep(ms) {
        return new Promise(function (resolve) { window.setTimeout(resolve, ms); });
    }

    function scrollBehavior() {
        return reduceMotion ? 'auto' : 'smooth';
    }

    /* ── skeleton shimmer ────────────────────────────────────────── */

    function block(className) {
        var node = document.createElement('div');
        node.className = 'sk ' + className;
        return node;
    }

    function skeletonMain() {
        var main = document.createElement('main');
        main.className = 'route-skeleton';
        main.setAttribute('aria-busy', 'true');

        var status = document.createElement('p');
        status.className = 'visually-hidden';
        status.setAttribute('role', 'status');
        status.textContent = 'Loading page';
        main.appendChild(status);

        var wrap = document.createElement('div');
        wrap.className = 'ds-shell sk-wrap';
        wrap.setAttribute('aria-hidden', 'true');

        var hero = document.createElement('div');
        hero.className = 'sk-hero';
        ['sk-title', 'sk-title sk-w60', 'sk-line', 'sk-line sk-w80'].forEach(function (cls) { hero.appendChild(block(cls)); });
        var actions = document.createElement('div');
        actions.className = 'sk-actions';
        actions.appendChild(block('sk-btn'));
        actions.appendChild(block('sk-btn'));
        hero.appendChild(actions);

        var grid = document.createElement('div');
        grid.className = 'sk-grid';
        for (var i = 0; i < 3; i++) grid.appendChild(block('sk-card'));

        wrap.appendChild(hero);
        wrap.appendChild(grid);
        main.appendChild(wrap);
        return main;
    }

    /* ── page lifecycle ──────────────────────────────────────────── */

    function leave(main) {
        if (window.DoxxusHome) window.DoxxusHome.stop();
        if (window.DoxxusTitles) window.DoxxusTitles.destroy(main);
        if (window.DoxxusPortfolio) window.DoxxusPortfolio.destroy(main);
        if (window.bootstrap && window.bootstrap.Tooltip) {
            main.querySelectorAll('[data-bs-toggle="tooltip"], [data-bss-tooltip]').forEach(function (node) {
                var tip = window.bootstrap.Tooltip.getInstance(node);
                if (tip) tip.dispose();
            });
        }
    }

    function enter(main) {
        var page = document.body.getAttribute('data-page') || '';
        if (window.SiteShell) {
            window.SiteShell.setPage(page);
            window.SiteShell.observeSections();
        }
        if (window.DoxxusPortfolio) window.DoxxusPortfolio.init(main);
        if (window.DoxxusTitles) window.DoxxusTitles.init(main);
        if (window.DoxxusPages) window.DoxxusPages.init();
        if (page === 'home' && window.DoxxusHome) window.DoxxusHome.start();

        if (window.bootstrap && window.bootstrap.Tooltip) {
            main.querySelectorAll('[data-bs-toggle="tooltip"], [data-bss-tooltip]').forEach(function (node) {
                new window.bootstrap.Tooltip(node);
            });
        }

        var lastOnline = document.getElementById('last-online-nav');
        if (lastOnline) {
            main.querySelectorAll('.last-online').forEach(function (node) { node.textContent = lastOnline.textContent; });
        }
        if (window.renderContributionCalendars) window.renderContributionCalendars();

        window.requestAnimationFrame(function () {
            if (window.AOS) window.AOS.refreshHard();
            if (window.wow && window.wow.sync) window.wow.sync();
        });
    }

    /* ── fetching and asset merging ──────────────────────────────── */

    function fetchPage(url) {
        var controller = window.AbortController ? new AbortController() : null;
        var timer = controller ? window.setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS) : 0;
        return fetch(url.href, { credentials: 'same-origin', signal: controller ? controller.signal : undefined }).then(function (response) {
            window.clearTimeout(timer);
            var type = response.headers.get('content-type') || '';
            if (!response.ok || type.indexOf('text/html') === -1) throw new Error('not a page: ' + response.status);
            return response.text();
        }).then(function (html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            if (!doc.querySelector('main')) throw new Error('no <main>');
            return doc;
        }).catch(function (error) {
            window.clearTimeout(timer);
            throw error;
        });
    }

    function loaded(selector, attr) {
        var set = {};
        document.querySelectorAll(selector).forEach(function (node) { set[node[attr]] = true; });
        return set;
    }

    function withTimeout(promise) {
        return Promise.race([promise, sleep(ASSET_TIMEOUT_MS)]);
    }

    var MAIN_STYLE = 'assets/css/style.css';

    // Cascade order matters: vendor sheets such as Font Awesome must stay BEFORE the
    // site stylesheet (as in every page's own <head>) or they override its rules.
    // Sheets that the target page lists after style.css go after it.
    function addStyle(href, afterMain) {
        return new Promise(function (resolve) {
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = link.onerror = resolve;
            var main = document.querySelector('link[rel="stylesheet"][href*="' + MAIN_STYLE + '"]');
            if (main && !afterMain) main.parentNode.insertBefore(link, main);
            else document.head.appendChild(link);
        });
    }

    function addScript(src) {
        return new Promise(function (resolve) {
            var script = document.createElement('script');
            script.src = src;
            script.async = false;
            script.onload = script.onerror = resolve;
            document.body.appendChild(script);
        });
    }

    // Loads whatever the target page needs that the current document lacks, in order.
    // Nothing is ever removed, so earlier pages keep working.
    function ensureAssets(doc, base) {
        var haveStyles = loaded('link[rel="stylesheet"]', 'href');
        var haveScripts = loaded('script[src]', 'src');
        var styles = [];
        var scripts = [];

        var afterMain = false;
        doc.querySelectorAll('link[rel="stylesheet"][href]').forEach(function (link) {
            var href = new URL(link.getAttribute('href'), base).href;
            if (href.indexOf(MAIN_STYLE) !== -1) { afterMain = true; return; }
            if (!haveStyles[href]) { haveStyles[href] = true; styles.push({ href: href, after: afterMain }); }
        });
        doc.querySelectorAll('script[src]').forEach(function (script) {
            if (script.closest('main')) return;
            var src = new URL(script.getAttribute('src'), base).href;
            if (!haveScripts[src]) { haveScripts[src] = true; scripts.push(src); }
        });

        var chain = withTimeout(Promise.all(styles.map(function (sheet) { return addStyle(sheet.href, sheet.after); })));
        scripts.forEach(function (src) {
            chain = chain.then(function () { return withTimeout(addScript(src)); });
        });
        return chain;
    }

    /* ── swapping content ────────────────────────────────────────── */

    function syncHead(doc) {
        document.title = doc.title;
        HEAD_SYNC.forEach(function (selector) {
            var next = doc.head.querySelector(selector);
            var now = document.head.querySelector(selector);
            if (next && now) {
                ['content', 'href'].forEach(function (attr) {
                    if (next.hasAttribute(attr)) now.setAttribute(attr, next.getAttribute(attr));
                });
            } else if (next) {
                document.head.appendChild(document.importNode(next, true));
            } else if (now) {
                now.remove();
            }
        });
    }

    function syncBody(doc) {
        PAGE_CLASSES.forEach(function (cls) {
            document.body.classList.toggle(cls, doc.body.classList.contains(cls));
        });
        document.body.setAttribute('data-page', doc.body.getAttribute('data-page') || '');
    }

    // Scripts inserted via importNode do not execute; rebuild them so they do.
    function activateScripts(main) {
        main.querySelectorAll('script').forEach(function (old) {
            var script = document.createElement('script');
            Array.prototype.forEach.call(old.attributes, function (attr) { script.setAttribute(attr.name, attr.value); });
            script.text = old.text;
            old.replaceWith(script);
        });
    }

    function focusMain(main) {
        var target = main.querySelector('h1') || main;
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
    }

    function scrollToHash(hash, smooth) {
        if (hash.length > 1) {
            var target = document.getElementById(decodeURIComponent(hash.slice(1)));
            if (target) {
                target.scrollIntoView({ behavior: smooth ? scrollBehavior() : 'auto' });
                return true;
            }
        }
        return false;
    }

    function swap(doc, url, options) {
        var skeleton = document.querySelector('main');
        var fresh = document.importNode(doc.querySelector('main'), true);

        if (options.push) history.pushState({ y: 0 }, '', url.href);
        currentPath = normalize(url.pathname);

        syncHead(doc);
        syncBody(doc);
        skeleton.replaceWith(fresh);
        activateScripts(fresh);
        enter(fresh);

        if (url.hash === '#contact' && window.SiteShell) window.SiteShell.openLinkedContact();

        window.requestAnimationFrame(function () {
            if (url.hash && url.hash !== '#contact' && scrollToHash(url.hash, false)) { /* anchored */ }
            else window.scrollTo(0, options.scrollY || 0);
            focusMain(fresh);
        });
    }

    function navigate(url, options) {
        var mine = ++token;
        var started = Date.now();
        var main = document.querySelector('main');

        leave(main);
        main.replaceWith(skeletonMain());
        window.scrollTo(0, 0);

        return fetchPage(url)
            .then(function (doc) {
                return ensureAssets(doc, url).then(function () { return doc; });
            })
            .then(function (doc) {
                return sleep(Math.max(0, MIN_SKELETON_MS - (Date.now() - started))).then(function () { return doc; });
            })
            .then(function (doc) {
                if (mine !== token) return; // a newer navigation took over
                swap(doc, url, options);
            })
            .catch(function (error) {
                console.warn('[router] falling back to a full page load:', error);
                window.location.href = url.href;
            });
    }

    /* ── events ──────────────────────────────────────────────────── */

    document.addEventListener('click', function (event) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        var anchor = event.target.closest('a');
        var url = routable(anchor);
        if (!url) return;

        event.preventDefault();

        if (normalize(url.pathname) === currentPath) {
            // Same page: just move to the section (or top).
            history.replaceState({ y: window.scrollY }, '');
            history.pushState({ y: 0 }, '', url.href);
            if (url.hash === '#contact' && window.SiteShell) window.SiteShell.openLinkedContact();
            else if (!scrollToHash(url.hash, true)) window.scrollTo({ top: 0, behavior: scrollBehavior() });
            return;
        }

        history.replaceState({ y: window.scrollY }, '');
        if (anchor.dataset.nav && window.SiteShell) window.SiteShell.setPage(anchor.dataset.nav);
        navigate(url, { push: true });
    });

    window.addEventListener('popstate', function (event) {
        var url = new URL(location.href);
        var y = (event.state && event.state.y) || 0;
        if (normalize(url.pathname) === currentPath) {
            if (!scrollToHash(url.hash, false)) window.scrollTo(0, y);
            return;
        }
        navigate(url, { push: false, scrollY: y });
    });

    window.DoxxusRouter = { navigate: function (href) { navigate(new URL(href, location.href), { push: true }); } };
}());

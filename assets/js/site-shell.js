/**
 * site-shell.js — single source of truth for the shared page chrome.
 * Injects the navbar, footer, and contact modal into every page so the
 * markup can never drift between index / services / build / signin / terms.
 */
(function () {
    'use strict';

    var CONTACT_ENDPOINT = 'https://rnvsrhzxmpanabwmkiaj.supabase.co/functions/v1/contact';

    var NAV_HTML = [
        '<nav class="navbar navbar-expand-md">',
        '  <div class="container-fluid px-3 position-relative">',
        '    <a class="navbar-brand" href="index.html" aria-label="Home">',
        '      <i class="icon-globe" style="font-size: calc(1.05rem + .14vw); color: #ffffff;"></i>',
        '    </a>',
        '    <span class="last-online d-none d-md-block position-absolute start-50 translate-middle-x" id="last-online-nav">last online &mdash;</span>',
        '    <button class="navbar-toggler ms-auto" type="button" data-bs-toggle="collapse" data-bs-target="#navcol-2" aria-label="Toggle navigation" style="border: none; filter: brightness(1000%); box-shadow: none;">',
        '      <span style="color: #f0f9ff; display: flex; align-items: center;">',
        '        <svg xmlns="http://www.w3.org/2000/svg" width="1.4em" height="1.4em" viewBox="0 0 24 24" fill="none" aria-hidden="true">',
        '          <path d="M20 12H4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>',
        '        </svg>',
        '      </span>',
        '    </button>',
        '    <div class="collapse navbar-collapse justify-content-end" id="navcol-2" style="font-family: Dongle, sans-serif;">',
        '      <span class="last-online d-flex d-md-none justify-content-center w-100 py-1" id="last-online-mobile">last online &mdash;</span>',
        '      <ul class="navbar-nav d-flex flex-row justify-content-center align-items-center gap-1">',
        '        <li class="nav-item"><a class="nav-link d-flex justify-content-center align-items-center" data-bs-toggle="tooltip" data-bss-tooltip="" data-bs-placement="bottom" href="index.html#splash" title="Home" data-nav="home"><i class="typcn typcn-home-outline nav-link-icon" style="font-size: 1.2rem;"></i></a></li>',
        '        <li class="nav-item"><a class="nav-link d-flex justify-content-center align-items-center" data-bs-toggle="tooltip" data-bss-tooltip="" data-bs-placement="bottom" href="index.html#projects" title="Projects" data-nav="projects"><i class="typcn typcn-folder-open nav-link-icon"></i></a></li>',
        '        <li class="nav-item nav-account" data-account>',
        '          <a class="nav-link d-flex justify-content-center align-items-center" data-bs-toggle="tooltip" data-bss-tooltip="" data-bs-placement="bottom" href="signin.html" title="Sign in" data-nav="account" data-account-link><i class="typcn typcn-user-outline nav-link-icon"></i></a>',
        '          <button type="button" class="nav-link nav-account-toggle d-flex justify-content-center align-items-center" data-bs-toggle="tooltip" data-bss-tooltip="" data-bs-placement="bottom" title="Account" data-nav="account" data-account-toggle aria-haspopup="menu" aria-expanded="false" aria-label="Account menu" hidden><i class="typcn typcn-user nav-link-icon"></i><span class="nav-account-dot" aria-hidden="true"></span></button>',
        '          <div class="nav-menu" role="menu" aria-label="Account" data-account-menu hidden></div>',
        '        </li>',
        '        <li class="nav-item"><a class="nav-link d-flex justify-content-center align-items-center" data-bs-toggle="tooltip" data-bss-tooltip="" data-bs-placement="bottom" href="services.html" title="Build" data-nav="build"><i class="typcn typcn-spanner nav-link-icon"></i></a></li>',
        '        <li class="nav-item"><a class="nav-link d-flex justify-content-center align-items-center" data-bs-toggle="modal" data-bs-target="#contact" data-bss-tooltip="" data-bs-placement="bottom" href="#contact" title="Contact" data-nav="contact"><i class="typcn typcn-mail nav-link-icon"></i></a></li>',
        '      </ul>',
        '    </div>',
        '  </div>',
        '</nav>'
    ].join('\n');

    var FOOTER_HTML = [
        '<footer class="d-flex flex-fill justify-content-center">',
        '  <div class="footer-inner">',
        '    <div class="footer-cols">',
        '      <div class="footer-col-group">',
        '        <span class="footer-label" data-glitch-word>Services</span>',
        '        <a href="services.html">Build</a>',
        '        <a href="build.html">Build a Package</a>',
        '        <a href="services.html#it-support">IT Consultation</a>',
        '      </div>',
        '      <div class="footer-col-group">',
        '        <span class="footer-label" data-glitch-word>Work</span>',
        '        <a href="index.html#projects">Portfolio</a>',
        '        <a href="index.html#about">About</a>',
        '      </div>',
        '      <div class="footer-col-group">',
        '        <span class="footer-label" data-glitch-word>Legal</span>',
        '        <a href="terms.html">Terms &amp; Conditions</a>',
        '        <a href="privacy.html">Privacy Policy</a>',
        '      </div>',
        '      <div class="footer-col-group">',
        '        <span class="footer-label" data-glitch-word>Contact</span>',
        '        <a href="mailto:dev@doxxus.us">dev@doxxus.us</a>',
        '        <a href="signin.html">Sign in</a>',
        '      </div>',
        '    </div>',
        '    <div class="footer-bottom">',
        '      <span class="footer-copy">',
        '        <i class="icon-globe" style="font-size:.77rem;color:#ffffff;vertical-align:middle;margin-right:.4rem;" aria-hidden="true"></i>',
        '        DOXXUS &copy;2026',
        '      </span>',
        '      <div class="footer-social">',
        '        <a href="https://www.linkedin.com/in/b-m-ccool/" target="_blank" rel="noopener" aria-label="LinkedIn"><i class="typcn typcn-social-linkedin"></i></a>',
        '        <a href="https://github.com/m-ccool" target="_blank" rel="noopener" aria-label="GitHub"><i class="typcn typcn-social-github"></i></a>',
        '        <a href="mailto:dev@doxxus.us" aria-label="Email"><i class="typcn typcn-mail"></i></a>',
        '        <a href="https://cash.app/$doxxus" target="_blank" rel="noopener" aria-label="CashApp"><i class="typcn typcn-credit-card"></i></a>',
        '      </div>',
        '    </div>',
        '  </div>',
        '</footer>'
    ].join('\n');

    // The contact dialog: a macOS-style window (same chrome and close animation as the
    // page windows, see pages.js) holding the form. One definition for every page.
    var MODAL_HTML = [
        '<div class="modal fade scrollbar-hidden" role="dialog" tabindex="-1" id="contact" aria-labelledby="contact-title" aria-modal="true">',
        '  <div class="modal-dialog modal-dialog-centered" role="document">',
        '    <div class="modal-content ds-window ds-modal" data-window data-window-role="dialog" data-window-start="expanded">',
        '      <div class="ds-window-bar">',
        '        <span class="ds-terminal-dots">',
        '          <button type="button" class="ds-dot ds-dot--close" data-terminal-action="close" aria-label="Close the contact form"></button>',
        '          <button type="button" class="ds-dot ds-dot--min" data-terminal-action="minimize" aria-expanded="true" aria-label="Collapse the contact form"></button>',
        '          <button type="button" class="ds-dot ds-dot--zoom" data-dot-inert tabindex="-1" aria-hidden="true"></button>',
        '        </span>',
        '        <button type="button" class="ds-window-title" aria-expanded="true">doxxus@contact &mdash; ~/message</button>',
        '        <span class="ds-window-hint">new message</span>',
        '      </div>',
        '      <div class="ds-window-body ds-window-body--plain">',
        '        <div class="ds-modal-body">',
        '          <div class="ds-modal-head">',
        '            <span class="ds-eyebrow" data-glitch-modal>you found me.</span>',
        '            <h2 class="ds-modal-title" id="contact-title">Leave a message</h2>',
        '          </div>',
        '          <div id="show_message" class="ds-callout ds-callout--success ds-modal-notice" role="status"><i class="typcn typcn-tick" aria-hidden="true"></i><span>Sent! We&rsquo;ll contact you in the next 24 hours.</span></div>',
        '          <div id="error" class="ds-callout ds-callout--attention ds-modal-notice" role="alert"><i class="typcn typcn-warning-outline" aria-hidden="true"></i><span>Something went wrong. Please try again, or email <a href="mailto:dev@doxxus.us">dev@doxxus.us</a>.</span></div>',
        '          <form id="ajax-form" class="cf ds-modal-form" method="post" action="javascript:void(0)">',
        '            <div class="ds-field">',
        '              <label for="type-trigger" data-glitch-modal>Type</label>',
        '              <div class="contact-select" data-contact-select>',
        '                <input type="hidden" id="type" name="type" value="software">',
        '                <input class="ds-hp" type="text" name="hp" tabindex="-1" autocomplete="off" aria-hidden="true">',
        '                <button class="contact-select-trigger ds-input" id="type-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="type-options">',
        '                  <span>Software Development</span><i class="typcn typcn-chevron-down" aria-hidden="true"></i>',
        '                </button>',
        '                <div class="contact-select-options" id="type-options" role="listbox" aria-label="Project type" hidden>',
        '                  <button type="button" role="option" aria-selected="false" data-value="website">Website Development</button>',
        '                  <button type="button" role="option" aria-selected="true" data-value="software">Software Development</button>',
        '                  <button type="button" role="option" aria-selected="false" data-value="repair">IT Support / Repair</button>',
        '                  <button type="button" role="option" aria-selected="false" data-value="other">Other (please specify)</button>',
        '                </div>',
        '              </div>',
        '            </div>',
        '            <div class="ds-field">',
        '              <label for="user-1" data-glitch-modal>Name</label>',
        '              <input class="ds-input" type="text" id="user-1" name="user" required placeholder="john doe" autocomplete="name" maxlength="50">',
        '            </div>',
        '            <div class="ds-field">',
        '              <label for="email" data-glitch-modal>Email</label>',
        '              <input class="ds-input" type="email" id="email" name="email" required placeholder="email@example.com" inputmode="email" autocomplete="email" maxlength="50">',
        '            </div>',
        '            <div class="ds-field">',
        '              <label for="phone" data-glitch-modal>Phone</label>',
        '              <input class="ds-input" type="tel" id="phone" name="phone" required placeholder="1 (123) 567 8910" inputmode="tel" autocomplete="tel" maxlength="20" minlength="10">',
        '            </div>',
        '            <div class="ds-field">',
        '              <label for="websummary" data-glitch-modal>Note</label>',
        '              <textarea class="ds-input" id="websummary" name="websummary" placeholder="Explain your idea here! &#10024;" rows="3" style="overflow-y:hidden;resize:none;" required minlength="10" maxlength="500" spellcheck="true"></textarea>',
        '            </div>',
        '            <div class="ds-modal-actions">',
        '              <button class="ds-btn ds-btn--primary ds-btn--lg cf-btn" type="submit" name="submit" value="submit">Send</button>',
        '            </div>',
        '          </form>',
        '        </div>',
        '      </div>',
        '    </div>',
        '  </div>',
        '</div>'
    ].join('\n');

    var TYPE_LABELS = {
        website: 'Website Development',
        software: 'Software Development',
        repair: 'IT Support / Repair',
        other: 'Other (please specify)'
    };

    function mountChrome() {
        var navMount = document.querySelector('[data-site-nav]');
        if (navMount) navMount.outerHTML = NAV_HTML;

        var footerMount = document.querySelector('[data-site-footer]');
        if (footerMount) footerMount.outerHTML = FOOTER_HTML;

        if (!document.getElementById('contact')) {
            document.body.insertAdjacentHTML('beforeend', MODAL_HTML);
            if (window.DoxxusTitles) window.DoxxusTitles.init(document.getElementById('contact'));
        }

        setupNavIndicator();
        setupAccount();
    }

    /* Sliding gradient marker under the active nav item. Follows body[data-page] and,
       on pages that host them, the #splash / #projects sections. The portal pages (sign in, account,
       admin) all mark the account item. */
    var SECTION_NAV = { splash: 'home', projects: 'projects' };
    var PAGE_NAV = { signin: 'account', account: 'account', admin: 'account' };

    var navApi = null;

    function setupNavIndicator() {
        var list = document.querySelector('.navbar .navbar-nav');
        if (!list) return;

        var indicator = document.createElement('span');
        indicator.className = 'nav-indicator';
        indicator.setAttribute('aria-hidden', 'true');
        list.appendChild(indicator);

        function moveIndicator() {
            var active = list.querySelector('.nav-link.is-current');
            var item = active && active.parentElement;
            var visible = !!(item && item.offsetWidth);
            list.classList.toggle('has-indicator', visible);
            if (!visible) return;
            list.style.setProperty('--nav-ind-x', (item.offsetLeft + item.offsetWidth / 2) + 'px');
        }

        // A page with no navbar item (terms) clears the marker instead of keeping the last one.
        // The account item has two faces (sign-in link, account button), so every match is marked.
        function setCurrent(navKey) {
            navKey = PAGE_NAV[navKey] || navKey;
            var next = list.querySelectorAll('[data-nav="' + navKey + '"]');
            if (next.length && next[0].classList.contains('is-current')) return;
            Array.prototype.forEach.call(list.querySelectorAll('.nav-link.is-current'), function (el) {
                el.classList.remove('is-current');
            });
            Array.prototype.forEach.call(next, function (el) { el.classList.add('is-current'); });
            moveIndicator();
        }

        var page = document.body.getAttribute('data-page');
        if (page) setCurrent(page);
        moveIndicator();

        window.addEventListener('resize', moveIndicator);
        var collapse = document.getElementById('navcol-2');
        if (collapse) {
            collapse.addEventListener('shown.bs.collapse', moveIndicator);
            collapse.addEventListener('transitionend', moveIndicator);
        }

        var observer = null;

        // Re-binds to whichever #splash / #projects sections the current page has.
        function observeSections() {
            if (observer) observer.disconnect();
            observer = null;

            var sections = Object.keys(SECTION_NAV)
                .map(function (id) { return document.getElementById(id); })
                .filter(Boolean);
            if (!sections.length || !('IntersectionObserver' in window)) return;

            var covered = {};
            observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    covered[entry.target.id] = entry.isIntersecting ? entry.intersectionRect.height : 0;
                });
                var best = Object.keys(covered).reduce(function (winner, id) {
                    return covered[id] > 0 && (!winner || covered[id] > covered[winner]) ? id : winner;
                }, null);
                if (best) setCurrent(SECTION_NAV[best]);
            }, { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1], rootMargin: '-20% 0px -45% 0px' });

            sections.forEach(function (section) { observer.observe(section); });
        }

        observeSections();
        navApi = { setCurrent: setCurrent, observeSections: observeSections };
    }

    function resetContactForm() {
        var form = document.getElementById('ajax-form');
        if (!form) return;
        form.reset();
        var select = document.querySelector('[data-contact-select]');
        if (select) {
            select.querySelector('input[name="type"]').value = 'software';
            select.querySelector('.contact-select-trigger span').textContent = TYPE_LABELS.software;
            select.querySelectorAll('[role="option"]').forEach(function (option) {
                option.setAttribute('aria-selected', String(option.dataset.value === 'software'));
            });
        }
        toggleNotice('show_message', false);
        toggleNotice('error', false);
        var note = document.getElementById('websummary');
        if (note) note.style.height = '';
    }

    function toggleNotice(id, visible) {
        var el = document.getElementById(id);
        if (el) el.classList.toggle('is-visible', visible);
    }

    function applyInterest(trigger) {
        if (!trigger || !trigger.dataset) return;
        var note = document.getElementById('websummary');
        var interest = trigger.dataset.contactInterest;
        var type = trigger.dataset.contactType;

        if (type && TYPE_LABELS[type]) {
            var select = document.querySelector('[data-contact-select]');
            if (select) {
                select.querySelector('input[name="type"]').value = type;
                select.querySelector('.contact-select-trigger span').textContent = TYPE_LABELS[type];
                select.querySelectorAll('[role="option"]').forEach(function (option) {
                    option.setAttribute('aria-selected', String(option.dataset.value === type));
                });
            }
        }

        if (interest && note && !note.value.trim()) {
            note.value = 'I am interested in ' + interest + '.';
            note.style.height = 'auto';
            note.style.height = note.scrollHeight + 'px';
        }

        // Portal buttons: a ready-made note, and the signed-in client's details (still editable).
        var starter = trigger.dataset.contactNote;
        if (starter && note && !note.value.trim()) {
            note.value = starter;
            note.style.height = 'auto';
            note.style.height = note.scrollHeight + 'px';
        }

        var client = trigger.hasAttribute('data-contact-prefill') && window.DoxxusPortal ? window.DoxxusPortal.profile() : null;
        if (client) {
            [['user-1', client.name], ['email', client.email], ['phone', client.phone]].forEach(function (pair) {
                var field = document.getElementById(pair[0]);
                if (field && pair[1] && !field.value) field.value = pair[1].slice(0, Number(field.maxLength) > 0 ? field.maxLength : undefined);
            });
        }
    }

    function wireContactForm() {
        var modal = document.getElementById('contact');
        var form = document.getElementById('ajax-form');
        if (!modal || !form) return;

        var win = modal.querySelector('.ds-window');
        var glitchTimer = 0;
        var cancelGlitch = null;
        var dismissing = false;
        var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

        // The red dot plays the window's close animation, then lets Bootstrap hide the dialog
        // (dismiss). Esc and a backdrop click skip the animation and just fade out; a close
        // that is already playing is left alone.
        function dismiss() {
            dismissing = true;
            window.setTimeout(function () {
                var instance = window.bootstrap && window.bootstrap.Modal.getInstance(modal);
                if (instance) instance.hide();
            }, 0);
        }

        modal.addEventListener('ds-window:dismiss', dismiss);
        modal.addEventListener('hide.bs.modal', function (event) {
            if (dismissing) return;
            if (win && win.classList.contains('is-rebooting')) event.preventDefault();
        });

        modal.addEventListener('hidden.bs.modal', function () {
            dismissing = false;
            window.clearTimeout(glitchTimer);
            if (cancelGlitch) cancelGlitch();
            cancelGlitch = null;
            if (win) win.dispatchEvent(new CustomEvent('ds-window:reset'));
            resetContactForm();
            // Hand focus back to whatever opened the dialog (if it is still on the page).
            if (opener && opener !== document.body && document.contains(opener) && opener.focus) {
                opener.focus({ preventScroll: true });
            }
            opener = null;
        });

        var opener = null;
        modal.addEventListener('show.bs.modal', function (event) {
            opener = event.relatedTarget || document.activeElement;
            applyInterest(event.relatedTarget);
        });

        // Glitch one random label each time the dialog opens, and retype the title.
        modal.addEventListener('shown.bs.modal', function () {
            if (window.DoxxusTitles) window.DoxxusTitles.retype(modal);
            if (reduceMotion.matches || !window.DoxxusGlitch) return;
            var targets = Array.prototype.slice.call(modal.querySelectorAll('[data-glitch-modal]'));
            if (!targets.length) return;
            glitchTimer = window.setTimeout(function () {
                cancelGlitch = window.DoxxusGlitch.run(window.DoxxusGlitch.randomItems(targets, 1)[0]);
            }, 450 + Math.random() * 500);
        });

        var note = document.getElementById('websummary');
        if (note) {
            note.addEventListener('input', function () {
                this.style.height = 'auto';
                this.style.height = this.scrollHeight + 'px';
            });
        }

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var submit = form.querySelector('.cf-btn');
            // Guard against duplicate sends while a request is in flight.
            if (submit && submit.disabled) return;
            if (submit) submit.disabled = true;

            toggleNotice('show_message', false);
            toggleNotice('error', false);

            fetch(CONTACT_ENDPOINT, {
                method: 'POST',
                body: new URLSearchParams(new FormData(form))
            })
                .then(function (response) {
                    if (!response.ok) throw new Error('bad status');
                    return response.text();
                })
                .then(function (text) {
                    // Fail closed: only the literal success token counts as sent.
                    if ((text || '').trim() !== 'success') throw new Error('rejected');
                    // Full reset so the visible select label cannot drift from the
                    // hidden type value on a second message.
                    resetContactForm();
                    toggleNotice('show_message', true);
                })
                .catch(function () {
                    toggleNotice('error', true);
                })
                .then(function () {
                    if (submit) submit.disabled = false;
                });
        });
    }

    function wireDeepLinkedContact() {
        // Allows build.html and other pages to link to index.html#contact.
        if (window.location.hash !== '#contact') return;
        var modal = document.getElementById('contact');
        if (!modal || !window.bootstrap) return;
        window.bootstrap.Modal.getOrCreateInstance(modal).show();
    }

    /* ── account button ──────────────────────────────────────────────
       Signed out it is a plain link to the sign-in page. Signed in it opens a small menu: the client portal
       for clients, the admin hub for admins (role = app_metadata.role in the Supabase session).

       Who is signed in is read from the session Supabase keeps in localStorage, so ordinary pages do not
       have to load the Supabase library. That is for display only: the portal pages check the session for
       real, and the database enforces access with row-level security either way. */

    var SUPABASE_REF = new URL(CONTACT_ENDPOINT).hostname.split('.')[0];
    var AUTH_KEY = 'sb-' + SUPABASE_REF + '-auth-token';
    var SUPABASE_SRC = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js';
    var SUPABASE_SRI = 'sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok';

    var MENUS = {
        client: [
            { label: 'Overview', href: 'account.html#overview', icon: 'typcn-th-large-outline' },
            { label: 'Project', href: 'account.html#project', icon: 'typcn-folder-open' },
            { label: 'Files & links', href: 'account.html#files', icon: 'typcn-attachment-outline' },
            { label: 'Account', href: 'account.html#account', icon: 'typcn-user-outline' }
        ],
        admin: [
            { label: 'Clients', href: 'admin.html#clients', icon: 'typcn-group-outline' },
            { label: 'New client', href: 'admin.html#new', icon: 'typcn-user-add-outline' },
            { label: 'Submissions', href: 'admin.html#submissions', icon: 'typcn-mail' }
        ]
    };
    function decodeJwt(token) {
        try {
            var part = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            return JSON.parse(decodeURIComponent(Array.prototype.map.call(atob(part), function (ch) {
                return '%' + ('00' + ch.charCodeAt(0).toString(16)).slice(-2);
            }).join('')));
        } catch (error) {
            return null;
        }
    }

    // { email, role: 'admin' | 'client' } for a stored, still-usable session; otherwise null.
    function storedSession() {
        try {
            var stored = JSON.parse(window.localStorage.getItem(AUTH_KEY) || 'null');
            if (!stored || typeof stored !== 'object') return null;
            var live = stored.refresh_token || (stored.access_token && stored.expires_at * 1000 > Date.now());
            if (!live) return null;
            var user = stored.user || decodeJwt(stored.access_token) || {};
            var role = user.app_metadata && user.app_metadata.role;
            return { email: String(user.email || ''), role: role === 'admin' ? 'admin' : 'client' };
        } catch (error) {
            return null;
        }
    }

    function loadScript(src, integrity) {
        return new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = src;
            if (integrity) {
                script.integrity = integrity;
                script.crossOrigin = 'anonymous';
            }
            script.onload = resolve;
            script.onerror = function () { reject(new Error('could not load ' + src)); };
            document.body.appendChild(script);
        });
    }

    // Sign out from any page: the portal script (and Supabase under it) is only fetched when needed.
    function signOutEverywhere() {
        var ready = Promise.resolve();
        if (!window.supabase) ready = ready.then(function () { return loadScript(SUPABASE_SRC, SUPABASE_SRI); });
        if (!window.DoxxusUI) ready = ready.then(function () { return loadScript('assets/js/portal-ui.js?v=20261010f'); });
        if (!window.DoxxusPortal) ready = ready.then(function () { return loadScript('assets/js/portal.js?v=20261010f'); });
        return ready.then(function () { return window.DoxxusPortal.signOut(); });
    }

    var accountApi = null;

    function setupAccount() {
        var item = document.querySelector('[data-account]');
        if (!item) return;
        var link = item.querySelector('[data-account-link]');
        var toggle = item.querySelector('[data-account-toggle]');
        var menu = item.querySelector('[data-account-menu]');
        var open = false;
        var shown = null;     // the "role:email" the menu was last built for

        function tip(node) {
            return window.bootstrap && window.bootstrap.Tooltip ? window.bootstrap.Tooltip.getInstance(node) : null;
        }

        function setOpen(next) {
            if (next === open) return;
            open = next;
            menu.hidden = !open;
            toggle.setAttribute('aria-expanded', String(open));
            item.classList.toggle('is-open', open);
            var tooltip = tip(toggle);
            if (open && tooltip) tooltip.hide();
        }

        function buildMenu(session) {
            menu.textContent = '';

            var head = document.createElement('div');
            head.className = 'nav-menu-head';
            var label = document.createElement('span');
            label.className = 'nav-menu-label';
            label.textContent = session.role === 'admin' ? 'Admin' : 'Signed in as';
            var email = document.createElement('span');
            email.className = 'nav-menu-email';
            email.textContent = session.email || 'your account';
            head.appendChild(label);
            head.appendChild(email);
            menu.appendChild(head);

            MENUS[session.role].forEach(function (entry) {
                var anchor = document.createElement('a');
                anchor.className = 'nav-menu-item';
                anchor.setAttribute('role', 'menuitem');
                anchor.href = entry.href;
                var icon = document.createElement('i');
                icon.className = 'typcn ' + entry.icon;
                icon.setAttribute('aria-hidden', 'true');
                anchor.appendChild(icon);
                anchor.appendChild(document.createTextNode(entry.label));
                menu.appendChild(anchor);
            });

            var out = document.createElement('button');
            out.type = 'button';
            out.className = 'nav-menu-item nav-menu-item--out';
            out.setAttribute('role', 'menuitem');
            var outIcon = document.createElement('i');
            outIcon.className = 'typcn typcn-power-outline';
            outIcon.setAttribute('aria-hidden', 'true');
            out.appendChild(outIcon);
            out.appendChild(document.createTextNode('Sign out'));
            menu.appendChild(out);

            var note = document.createElement('p');
            note.className = 'nav-menu-note';
            note.setAttribute('role', 'status');
            note.hidden = true;
            menu.appendChild(note);

            out.addEventListener('click', function () {
                if (out.disabled) return;
                out.disabled = true;
                note.hidden = true;
                signOutEverywhere().catch(function () {
                    out.disabled = false;
                    note.textContent = 'Could not sign out. Try again.';
                    note.hidden = false;
                });
            });
        }

        function refresh() {
            var session = storedSession();
            link.hidden = !!session;
            toggle.hidden = !session;
            if (!session) {
                setOpen(false);
                shown = null;
                menu.textContent = '';
                return;
            }
            var key = session.role + ':' + session.email;
            if (key !== shown) {
                shown = key;
                buildMenu(session);
            }
        }

        function items() {
            return Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]:not(:disabled)'));
        }

        toggle.addEventListener('click', function () { setOpen(!open); });

        // Open from the keyboard onto the first item; arrows, Home/End and Escape work inside the menu.
        toggle.addEventListener('keydown', function (event) {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            event.preventDefault();
            setOpen(true);
            var all = items();
            if (all.length) (event.key === 'ArrowUp' ? all[all.length - 1] : all[0]).focus();
        });

        menu.addEventListener('keydown', function (event) {
            var all = items();
            var at = all.indexOf(document.activeElement);
            if (event.key === 'ArrowDown') all[(at + 1) % all.length].focus();
            else if (event.key === 'ArrowUp') all[(at - 1 + all.length) % all.length].focus();
            else if (event.key === 'Home') all[0].focus();
            else if (event.key === 'End') all[all.length - 1].focus();
            else if (event.key === 'Escape' || event.key === 'Tab') {
                setOpen(false);
                if (event.key === 'Escape') toggle.focus();
                return;
            } else return;
            event.preventDefault();
        });

        // Picking a link ends the menu (the router swaps the page without reloading the navbar).
        menu.addEventListener('click', function (event) {
            if (event.target.closest && event.target.closest('a')) setOpen(false);
        });

        document.addEventListener('pointerdown', function (event) {
            if (open && !item.contains(event.target)) setOpen(false);
        });
        document.addEventListener('keydown', function (event) {
            if (open && event.key === 'Escape') setOpen(false);
        });

        // Another tab signing in or out; the portal calls refreshAccount() for this tab.
        window.addEventListener('storage', function (event) {
            if (event.key === AUTH_KEY) refresh();
        });

        refresh();
        accountApi = { refresh: refresh, close: function () { setOpen(false); } };
    }
    // Used by the client-side router: the navbar stays mounted, only the marker moves.
    window.SiteShell = {
        setPage: function (key) { if (navApi) navApi.setCurrent(key); if (accountApi) accountApi.close(); },
        observeSections: function () { if (navApi) navApi.observeSections(); },
        refreshAccount: function () { if (accountApi) accountApi.refresh(); },
        session: storedSession,
        openLinkedContact: wireDeepLinkedContact
    };

    function init() {
        mountChrome();
        wireContactForm();
        wireDeepLinkedContact();
        document.dispatchEvent(new CustomEvent('site-shell:ready'));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

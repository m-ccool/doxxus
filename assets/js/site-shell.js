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
        '        <li class="nav-item"><a class="nav-link d-flex justify-content-center align-items-center" data-bs-toggle="tooltip" data-bss-tooltip="" href="index.html#splash" title="Home" data-nav="home"><i class="typcn typcn-home-outline nav-link-icon" style="font-size: 1.2rem;"></i></a></li>',
        '        <li class="nav-item"><a class="nav-link d-flex justify-content-center align-items-center" data-bs-toggle="tooltip" data-bss-tooltip="" href="index.html#projects" title="Projects" data-nav="projects"><i class="typcn typcn-folder-open nav-link-icon"></i></a></li>',
        '        <li class="nav-item"><a class="nav-link d-flex justify-content-center align-items-center" data-bs-toggle="tooltip" data-bss-tooltip="" href="index.html#about" title="About" data-nav="about"><i class="typcn typcn-business-card nav-link-icon"></i></a></li>',
        '        <li class="nav-item"><a class="nav-link d-flex justify-content-center align-items-center" data-bs-toggle="tooltip" data-bss-tooltip="" href="services.html" title="Build" data-nav="build"><i class="typcn typcn-spanner nav-link-icon"></i></a></li>',
        '        <li class="nav-item"><a class="nav-link d-flex justify-content-center align-items-center" data-bs-toggle="modal" data-bs-target="#contact" href="#contact" title="Contact" data-nav="contact"><i class="typcn typcn-mail nav-link-icon"></i></a></li>',
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
        '        <a href="signin.html">Client Sign In</a>',
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
    }

    /* Sliding gradient marker under the active nav item. Follows body[data-page] and,
       on pages that host them, the #splash / #projects / #about sections. */
    var SECTION_NAV = { splash: 'home', projects: 'projects', about: 'about' };

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

        // A page with no navbar item (sign in, terms) clears the marker instead of keeping the last one.
        function setCurrent(navKey) {
            var next = list.querySelector('[data-nav="' + navKey + '"]');
            if (next && next.classList.contains('is-current')) return;
            Array.prototype.forEach.call(list.querySelectorAll('.nav-link.is-current'), function (el) {
                el.classList.remove('is-current');
            });
            if (next) next.classList.add('is-current');
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

        // Re-binds to whichever #splash / #projects / #about sections the current page has.
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

    // Used by the client-side router: the navbar stays mounted, only the marker moves.
    window.SiteShell = {
        setPage: function (key) { if (navApi) navApi.setCurrent(key); },
        observeSections: function () { if (navApi) navApi.observeSections(); },
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

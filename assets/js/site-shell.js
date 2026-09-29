/**
 * site-shell.js — single source of truth for the shared page chrome.
 * Injects the navbar, footer, and contact modal into every page so the
 * markup can never drift between index / services / build / signin / terms.
 */
(function () {
    'use strict';

    var CONTACT_ENDPOINT = 'https://doxxus.us/ajax-form-store.php';

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
        '        <li class="nav-item"><a class="nav-link d-flex justify-content-center align-items-center" data-bs-toggle="tooltip" data-bss-tooltip="" href="services.html" title="Services" data-nav="services"><i class="typcn typcn-spanner nav-link-icon"></i></a></li>',
        '        <li class="nav-item"><a class="nav-link d-flex justify-content-center align-items-center" data-bs-toggle="tooltip" data-bss-tooltip="" href="index.html#projects" title="Projects" data-nav="projects"><i class="typcn typcn-folder-open nav-link-icon"></i></a></li>',
        '        <li class="nav-item"><a class="nav-link d-flex justify-content-center align-items-center" data-bs-toggle="tooltip" data-bss-tooltip="" href="index.html#about" title="About" data-nav="about"><i class="typcn typcn-business-card nav-link-icon"></i></a></li>',
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
        '        <a href="services.html">Software Services</a>',
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

    var MODAL_HTML = [
        '<div class="modal fade scrollbar-hidden" role="dialog" tabindex="-1" id="contact">',
        '  <div class="modal-dialog modal-dialog-centered" role="document">',
        '    <div class="modal-content">',
        '      <div class="modal-header d-flex justify-content-between align-items-start">',
        '        <div class="d-flex flex-column align-items-start">',
        '          <span class="modal-eyebrow" data-glitch-modal>you found me.</span>',
        '          <h2 class="modal-headline" data-glitch-modal><span class="glitch-line">Leave a</span><span class="glitch-line">Message.</span></h2>',
        '        </div>',
        '        <button class="btn-close" type="button" aria-label="Close" data-bs-dismiss="modal"></button>',
        '      </div>',
        '      <div class="modal-body">',
        '        <p id="show_message" class="p-form-notice">sent! &#128640; we&rsquo;ll contact you in the next 24 hours!</p>',
        '        <p id="error" class="p-form-notice">error! &#128027; please try again or email dev@doxxus.us</p>',
        '        <form id="ajax-form" class="cf" method="post" action="javascript:void(0)">',
        '          <div class="cf-row">',
        '            <label class="cf-label" for="type-trigger" data-glitch-modal>TYPE</label>',
        '            <div class="contact-select" data-contact-select>',
        '              <input type="hidden" id="type" name="type" value="software">',
        '              <button class="contact-select-trigger" id="type-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="type-options">',
        '                <span>Software Development</span><i class="typcn typcn-chevron-down" aria-hidden="true"></i>',
        '              </button>',
        '              <div class="contact-select-options" id="type-options" role="listbox" aria-label="Project type" hidden>',
        '                <button type="button" role="option" aria-selected="false" data-value="website">Website Development</button>',
        '                <button type="button" role="option" aria-selected="true" data-value="software">Software Development</button>',
        '                <button type="button" role="option" aria-selected="false" data-value="repair">IT Support / Repair</button>',
        '                <button type="button" role="option" aria-selected="false" data-value="other">Other (please specify)</button>',
        '              </div>',
        '            </div>',
        '          </div>',
        '          <div class="cf-row">',
        '            <label class="cf-label" for="user-1" data-glitch-modal>NAME</label>',
        '            <input class="form-control" type="text" id="user-1" name="user" required placeholder="john doe" autocomplete="name" maxlength="50">',
        '          </div>',
        '          <div class="cf-row">',
        '            <label class="cf-label" for="email" data-glitch-modal>EMAIL</label>',
        '            <input class="form-control" type="email" id="email" name="email" required placeholder="email@example.com" inputmode="email" autocomplete="email" maxlength="50">',
        '          </div>',
        '          <div class="cf-row">',
        '            <label class="cf-label" for="phone" data-glitch-modal>PHONE</label>',
        '            <input class="form-control" type="tel" id="phone" name="phone" required placeholder="1 (123) 567 8910" inputmode="tel" autocomplete="tel" maxlength="20" minlength="10">',
        '          </div>',
        '          <div class="cf-row cf-row-full">',
        '            <label class="cf-label cf-label-top" for="websummary" data-glitch-modal>NOTE</label>',
        '            <textarea class="form-control" id="websummary" name="websummary" placeholder="Explain your idea here! &#10024;" rows="3" style="overflow-y:hidden;resize:none;" required minlength="10" maxlength="500" spellcheck="true"></textarea>',
        '          </div>',
        '          <div class="cf-submit">',
        '            <button class="neon-btn cf-btn" type="submit" name="submit" value="submit">SEND</button>',
        '          </div>',
        '        </form>',
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
        }

        setupNavIndicator();
    }

    /* Sliding gradient marker under the active nav item. Follows body[data-page] and,
       on pages that host them, the #splash / #projects / #about sections. */
    var SECTION_NAV = { splash: 'home', projects: 'projects', about: 'about' };

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

        function setCurrent(navKey) {
            var next = list.querySelector('[data-nav="' + navKey + '"]');
            if (!next || next.classList.contains('is-current')) return;
            Array.prototype.forEach.call(list.querySelectorAll('.nav-link.is-current'), function (el) {
                el.classList.remove('is-current');
            });
            next.classList.add('is-current');
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

        var sections = Object.keys(SECTION_NAV)
            .map(function (id) { return document.getElementById(id); })
            .filter(Boolean);
        if (!sections.length || !('IntersectionObserver' in window)) return;

        var covered = {};
        var observer = new IntersectionObserver(function (entries) {
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
    }

    function wireContactForm() {
        var modal = document.getElementById('contact');
        var form = document.getElementById('ajax-form');
        if (!modal || !form) return;

        modal.addEventListener('hidden.bs.modal', resetContactForm);
        modal.addEventListener('show.bs.modal', function (event) {
            applyInterest(event.relatedTarget);
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

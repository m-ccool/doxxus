/*
 * Client portal: the sign-in page (signin.html) and the account page (account.html).
 *
 * The site is static, so everything here talks to a separate API (see
 * docs/mvp-outline.md, "Client Journey and Portal UX"). While API_BASE is empty the API is not live: sign-in stays closed, no request is
 * ever made, and account.html sends the visitor to the sign-in page. Nothing is shown unless the
 * API returned it (no placeholder data).
 *
 * Contract used here:
 *   GET  /auth/csrf              -> { csrfToken }
 *   POST /auth/login             { email, password }
 *   POST /auth/logout
 *   POST /auth/forgot            { email }
 *   POST /auth/reset             { token, password }
 *   GET  /auth/invite?token=     -> { email, business }
 *   POST /auth/accept-invite     { token, password }
 *   POST /auth/resend-verification { email }
 *   GET  /me                     -> { name, email, emailVerified, phone, business, meetingUrl, itSupport, passwordChangedAt }
 *   GET  /me/projects            -> { projects: [{ id, name, description, status, liveUrl, updatedAt }] }
 *   GET  /me/billing             -> { subscription, payments: [{ date, reference, status, receiptUrl }] }
 *
 * DoxxusPortal.init(root) / destroy(root) are called by router.js; profile() feeds the contact dialog.
 */
(function () {
    'use strict';

    // Origin of the portal API, for example 'https://api.doxxus.us'. Empty = not live yet.
    var API_BASE = '';

    var SIGNIN_PAGE = 'signin.html';
    var ACCOUNT_PAGE = 'account.html';
    var NEXT_ALLOWED = [ACCOUNT_PAGE];
    var MIN_PASSWORD = 12;
    var CLOSED_NOTICE = 'Sign in is not open yet. The client portal is still being built, and accounts are issued directly when a project starts.';
    var NETWORK_NOTICE = 'Could not reach the server. Nothing was sent. Your details are still here. Try again.';

    var VIEW_TITLES = {
        'signin': '~/sign-in',
        'forgot': '~/reset',
        'forgot-sent': '~/reset',
        'reset': '~/reset',
        'welcome': '~/welcome'
    };

    var NOTICE_ICONS = {
        note: 'typcn-info-large',
        attention: 'typcn-warning-outline',
        success: 'typcn-input-checked-outline'
    };

    var PROJECT_STATUS = {
        live: { label: 'Live', mark: '\u25CF', tone: 'success' },
        in_progress: { label: 'In progress', mark: '\u25D0', tone: 'attention' },
        issue: { label: 'Issue', mark: '\u2715', tone: 'danger' }
    };

    var PAYMENT_STATUS = {
        paid: { label: 'Paid', tone: 'success' },
        pending: { label: 'Pending', tone: 'attention' },
        failed: { label: 'Failed', tone: 'danger' }
    };

    var SUBSCRIPTION_STATUS = {
        active: { label: 'Active', tone: 'success' },
        past_due: { label: 'Past due', tone: 'attention' },
        none: { label: 'None', tone: '' }
    };

    var profile = null;
    var cleanups = [];
    var csrfToken = '';

    /* ── small helpers ───────────────────────────────────────────── */

    function on(target, type, handler) {
        target.addEventListener(type, handler);
        cleanups.push(function () { target.removeEventListener(type, handler); });
    }

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function clear(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
    }

    function safeUrl(value) {
        if (typeof value !== 'string') return '';
        try {
            var url = new URL(value);
            return url.protocol === 'https:' ? url.href : '';
        } catch (error) {
            return '';
        }
    }

    function formatDate(value) {
        // A bare date (2026-09-01) is a calendar day, not a UTC instant, so it must not shift with the time zone.
        var plain = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        var date = plain ? new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3])) : new Date(value);
        if (!value || isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
    }

    function isEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
    }

    function params() {
        return new URLSearchParams(window.location.search);
    }

    // `next` only ever resolves to a known same-origin page (no open redirects).
    function nextPage() {
        var next = params().get('next');
        return NEXT_ALLOWED.indexOf(next) !== -1 ? next : ACCOUNT_PAGE;
    }

    function goTo(page) {
        if (window.DoxxusRouter) window.DoxxusRouter.navigate(page);
        else window.location.href = page;
    }

    function redirectToSignin(reason) {
        var query = '?next=' + ACCOUNT_PAGE + (reason ? '&reason=' + reason : '');
        window.location.replace(SIGNIN_PAGE + query);
    }

    /* ── API ─────────────────────────────────────────────────────── */

    function ensureCsrf() {
        if (csrfToken) return Promise.resolve(csrfToken);
        return fetch(API_BASE + '/auth/csrf', { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } })
            .then(function (response) {
                if (!response.ok) throw new Error('csrf');
                return response.json();
            })
            .then(function (data) {
                if (!data || !data.csrfToken) throw new Error('csrf');
                csrfToken = data.csrfToken;
                return csrfToken;
            });
    }

    // Resolves { status, ok, data, retryAfter } for any HTTP answer; rejects only when nothing was sent or received.
    function request(method, path, body) {
        var headers = { Accept: 'application/json' };
        var options = { method: method, credentials: 'include', cache: 'no-store', headers: headers };
        var ready = Promise.resolve();
        if (method !== 'GET') {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body || {});
            ready = ensureCsrf().then(function (token) { headers['X-CSRF-Token'] = token; });
        }
        return ready
            .then(function () { return fetch(API_BASE + path, options); })
            .then(function (response) {
                return response.text().then(function (text) {
                    var data = null;
                    try { data = text ? JSON.parse(text) : null; } catch (error) { data = null; }
                    return {
                        status: response.status,
                        ok: response.ok,
                        data: data || {},
                        retryAfter: Number(response.headers.get('Retry-After')) || 0
                    };
                });
            });
    }

    /* ── sign-in page ────────────────────────────────────────────── */

    function initSignin(root) {
        var notice = root.querySelector('[data-portal-notice]');
        var noticeText = root.querySelector('[data-portal-notice-text]');
        var noticeAction = root.querySelector('[data-portal-notice-action]');
        var title = root.querySelector('[data-portal-title]');
        var views = Array.prototype.slice.call(root.querySelectorAll('[data-view]'));
        var live = !!API_BASE;
        var noticeHandler = null;
        var gone = false;

        function setNotice(kind, text, action) {
            notice.className = 'ds-callout ds-callout--' + kind;
            notice.querySelector('i').className = 'typcn ' + NOTICE_ICONS[kind];
            noticeText.textContent = text;
            noticeHandler = action ? action.run : null;
            noticeAction.hidden = !action;
            noticeAction.textContent = action ? action.label : '';
            notice.setAttribute('role', kind === 'attention' ? 'alert' : 'status');
            notice.hidden = false;
        }

        function clearNotice() {
            notice.hidden = true;
            noticeHandler = null;
            noticeAction.hidden = true;
        }

        on(noticeAction, 'click', function () { if (noticeHandler) noticeHandler(); });

        function openContact() {
            var modal = document.getElementById('contact');
            if (modal && window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(modal).show();
        }

        function viewFromUrl() {
            var query = params();
            var view = query.get('view') || 'signin';
            if (!VIEW_TITLES[view] || view === 'forgot-sent') return 'signin';
            if ((view === 'reset' || view === 'welcome') && !query.get('token')) return view === 'reset' ? 'forgot' : 'signin';
            return view;
        }

        function urlFor(view) {
            var query = new URLSearchParams();
            if (view !== 'signin' && view !== 'forgot-sent') query.set('view', view);
            var next = params().get('next');
            if (NEXT_ALLOWED.indexOf(next) !== -1) query.set('next', next);
            var token = params().get('token');
            if ((view === 'reset' || view === 'welcome') && token) query.set('token', token);
            var text = query.toString();
            return SIGNIN_PAGE + (text ? '?' + text : '');
        }

        function focusView(view) {
            var target = view.querySelector('[data-portal-focus]');
            if (target && !target.closest('fieldset:disabled')) target.focus({ preventScroll: true });
        }

        function showView(name, options) {
            options = options || {};
            if (options.push) window.history.pushState({ y: 0 }, '', urlFor(name));
            views.forEach(function (view) { view.hidden = view.dataset.view !== name; });
            title.textContent = 'doxxus@portal \u2014 ' + VIEW_TITLES[name];
            clearNotice();
            if (!live) setNotice('note', CLOSED_NOTICE);
            if (options.notice) setNotice(options.notice.kind, options.notice.text, options.notice.action);
            var active = views.filter(function (view) { return !view.hidden; })[0];
            if (active && options.focus !== false) focusView(active);
            if (name === 'welcome') loadInvite();
        }

        function lock(form, locked) {
            var fields = form.querySelector('[data-portal-fields]');
            if (fields) fields.disabled = locked;
        }

        function bindGoButtons() {
            root.querySelectorAll('[data-portal-go]').forEach(function (button) {
                on(button, 'click', function () { showView(button.dataset.portalGo, { push: true }); });
            });
        }

        function bindReveal() {
            root.querySelectorAll('[data-portal-reveal]').forEach(function (button) {
                on(button, 'click', function () {
                    var input = document.getElementById(button.getAttribute('aria-controls'));
                    if (!input) return;
                    var show = input.type === 'password';
                    input.type = show ? 'text' : 'password';
                    button.textContent = show ? 'Hide' : 'Show';
                    button.setAttribute('aria-pressed', String(show));
                });
            });
        }

        function strengthOf(value) {
            if (value.length < MIN_PASSWORD) return { bars: 0, text: value.length + ' / ' + MIN_PASSWORD + ' characters minimum' };
            var points = 1;
            if (value.length >= 16) points++;
            if (/[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value)) points++;
            if (/[^A-Za-z0-9]/.test(value)) points++;
            return { bars: points, text: ['', 'Okay', 'Good', 'Strong', 'Very strong'][points] };
        }

        function bindStrength() {
            root.querySelectorAll('[data-portal-strength]').forEach(function (meter) {
                var input = meter.parentElement.querySelector('input');
                var bars = meter.querySelectorAll('i');
                var label = meter.querySelector('.portal-strength-text');
                on(input, 'input', function () {
                    var result = strengthOf(input.value);
                    bars.forEach(function (bar, index) { bar.classList.toggle('is-on', index < result.bars); });
                    meter.dataset.level = String(result.bars);
                    label.textContent = result.text;
                });
            });
        }

        function submitGuard(form, run) {
            on(form, 'submit', function (event) {
                event.preventDefault();
                var button = form.querySelector('.portal-submit');
                if (!live || !button || button.disabled) return;
                button.disabled = true;
                clearNotice();
                Promise.resolve()
                    .then(run)
                    .catch(function () { if (!gone) setNotice('attention', NETWORK_NOTICE); })
                    .then(function () { button.disabled = false; });
            });
        }

        function invalid(input, text) {
            setNotice('attention', text);
            input.setAttribute('aria-invalid', 'true');
            input.focus();
        }

        function clearInvalid(form) {
            form.querySelectorAll('[aria-invalid]').forEach(function (input) { input.removeAttribute('aria-invalid'); });
        }

        function resend(email) {
            return request('POST', '/auth/resend-verification', { email: email })
                .then(function (result) {
                    if (result.status === 429) setNotice('attention', 'Too many requests. Try again in a few minutes.');
                    else if (result.ok) setNotice('success', 'If that account needs verifying, a new link is on its way to ' + email + '.');
                    else setNotice('attention', NETWORK_NOTICE);
                })
                .catch(function () { setNotice('attention', NETWORK_NOTICE); });
        }

        function bindLogin() {
            var form = root.querySelector('[data-portal-form="login"]');
            var email = form.elements.email;
            var password = form.elements.password;
            submitGuard(form, function () {
                clearInvalid(form);
                var address = email.value.trim();
                if (!isEmail(address)) return invalid(email, 'Enter the email address on your account.');
                if (!password.value) return invalid(password, 'Enter your password.');
                return request('POST', '/auth/login', { email: address, password: password.value }).then(function (result) {
                    var error = result.data && result.data.error;
                    if (result.ok) return goTo(nextPage());
                    password.value = '';
                    if (result.status === 429) {
                        var minutes = result.retryAfter ? Math.max(1, Math.ceil(result.retryAfter / 60)) : 15;
                        return setNotice('attention', 'Too many sign-in attempts. Try again in ' + minutes + ' minute' + (minutes === 1 ? '' : 's') + ', or reset your password.');
                    }
                    if (result.status === 403 && error === 'email_unverified') {
                        return setNotice('note', 'Please verify your email first. We sent a link to ' + address + '.', { label: 'Resend link', run: function () { resend(address); } });
                    }
                    if (result.status === 403 && error === 'account_disabled') {
                        return setNotice('attention', 'This account is not active. Contact the dev if you think this is a mistake.', { label: 'Contact the dev', run: openContact });
                    }
                    if (result.status === 401 || result.status === 400) {
                        password.focus();
                        return setNotice('attention', 'That email and password do not match. Check them and try again.');
                    }
                    return setNotice('attention', NETWORK_NOTICE);
                });
            });
        }

        function bindForgot() {
            var form = root.querySelector('[data-portal-form="forgot"]');
            var email = form.elements.email;
            submitGuard(form, function () {
                clearInvalid(form);
                var address = email.value.trim();
                if (!isEmail(address)) return invalid(email, 'Enter the email address on your account.');
                return request('POST', '/auth/forgot', { email: address }).then(function (result) {
                    if (result.status === 429) return setNotice('attention', 'Too many requests. Try again in a few minutes.');
                    // The same confirmation whether or not the account exists.
                    if (result.ok) return showView('forgot-sent', { push: true });
                    return setNotice('attention', NETWORK_NOTICE);
                });
            });
        }

        function checkNewPassword(form) {
            var password = form.elements.password;
            var confirm = form.elements.confirm;
            if (password.value.length < MIN_PASSWORD) { invalid(password, 'Use at least ' + MIN_PASSWORD + ' characters.'); return false; }
            if (password.value !== confirm.value) { invalid(confirm, 'The two passwords do not match.'); return false; }
            return true;
        }

        function bindReset() {
            var form = root.querySelector('[data-portal-form="reset"]');
            submitGuard(form, function () {
                clearInvalid(form);
                if (!checkNewPassword(form)) return null;
                return request('POST', '/auth/reset', { token: params().get('token'), password: form.elements.password.value }).then(function (result) {
                    if (result.ok) {
                        window.history.replaceState({ y: 0 }, '', SIGNIN_PAGE);
                        form.reset();
                        return showView('signin', { notice: { kind: 'success', text: 'Password updated. Sign in with your new password.' } });
                    }
                    if (result.status === 400 || result.status === 404 || result.status === 410) {
                        return setNotice('attention', 'This link has expired. Request a new one.', { label: 'Request a new link', run: function () { showView('forgot', { push: true }); } });
                    }
                    return setNotice('attention', NETWORK_NOTICE);
                });
            });
        }

        function bindWelcome() {
            var form = root.querySelector('[data-portal-form="welcome"]');
            submitGuard(form, function () {
                clearInvalid(form);
                if (!checkNewPassword(form)) return null;
                return request('POST', '/auth/accept-invite', { token: params().get('token'), password: form.elements.password.value }).then(function (result) {
                    if (result.ok) return goTo(nextPage());
                    if (result.status === 400 || result.status === 404 || result.status === 410) return inviteExpired();
                    return setNotice('attention', NETWORK_NOTICE);
                });
            });
        }

        function inviteExpired() {
            var form = root.querySelector('[data-portal-form="welcome"]');
            lock(form, true);
            setNotice('attention', 'This invite has expired.', { label: 'Contact the dev', run: openContact });
        }

        function loadInvite() {
            var form = root.querySelector('[data-portal-form="welcome"]');
            var identity = root.querySelector('[data-portal-identity]');
            var copy = root.querySelector('[data-portal-welcome-copy]');
            identity.hidden = true;
            if (!live) return;
            lock(form, true);
            request('GET', '/auth/invite?token=' + encodeURIComponent(params().get('token') || '')).then(function (result) {
                if (gone) return;
                if (!result.ok || !result.data.email) {
                    if (result.status >= 500) return setNotice('attention', NETWORK_NOTICE);
                    return inviteExpired();
                }
                root.querySelector('[data-portal-identity-email]').textContent = result.data.email;
                identity.hidden = false;
                copy.textContent = result.data.business
                    ? 'Your account for ' + result.data.business + ' is ready. Set a password to continue.'
                    : 'Your account is ready. Set a password to continue.';
                lock(form, false);
                form.elements.password.focus({ preventScroll: true });
            }).catch(function () {
                if (!gone) setNotice('attention', NETWORK_NOTICE);
            });
        }

        function reasonNotice() {
            var reason = params().get('reason');
            if (reason === 'expired') return { kind: 'note', text: 'You were signed out for security. Sign in again to continue.' };
            if (reason === 'disabled') return { kind: 'attention', text: 'This account is not active. Contact the dev if you think this is a mistake.', action: { label: 'Contact the dev', run: openContact } };
            if (reason === 'signedout') return { kind: 'success', text: 'You are signed out.' };
            return null;
        }

        bindGoButtons();
        bindReveal();
        bindStrength();
        bindLogin();
        bindForgot();
        bindReset();
        bindWelcome();

        if (!live) {
            root.querySelectorAll('[data-portal-fields]').forEach(function (fields) { fields.disabled = true; });
        }

        var first = viewFromUrl();
        showView(first, { focus: false, notice: first === 'signin' ? reasonNotice() : null });

        window.setTimeout(function () {
            var active = document.activeElement;
            var idle = !active || active === document.body || active.tagName === 'MAIN' || active.tagName === 'H1';
            if (idle && !gone) {
                var current = views.filter(function (view) { return !view.hidden; })[0];
                if (current) focusView(current);
            }
        }, 400);

        on(window, 'popstate', function () {
            if (root.isConnected) showView(viewFromUrl(), { focus: false });
        });

        // Already signed in: go straight to the account.
        if (live && first === 'signin') {
            request('GET', '/me').then(function (result) {
                if (!gone && result.ok && root.isConnected) goTo(nextPage());
            }).catch(function () { /* stay on the form */ });
        }

        cleanups.push(function () { gone = true; });
    }

    /* ── account page ────────────────────────────────────────────── */

    function chip(tone, text) {
        return el('span', 'ds-label' + (tone ? ' ds-label--' + tone : ''), text);
    }

    function initAccount(root) {
        if (!API_BASE) {
            redirectToSignin('');
            return;
        }

        var loading = root.querySelector('[data-account-loading]');
        var failed = root.querySelector('[data-account-error]');
        var content = root.querySelector('[data-account-content]');
        var gone = false;

        function expired() { redirectToSignin('expired'); }

        function show(which) {
            loading.hidden = which !== 'loading';
            failed.hidden = which !== 'error';
            content.hidden = which !== 'content';
            loading.setAttribute('aria-busy', String(which === 'loading'));
        }

        function setField(name, value) {
            var node = root.querySelector('[data-account-field="' + name + '"]');
            node.textContent = value || 'Not provided';
            node.classList.toggle('portal-muted', !value);
        }

        function renderProfile(me) {
            profile = { name: me.name || '', email: me.email || '', phone: me.phone || '', business: me.business || '' };
            setField('name', profile.name);
            setField('email', profile.email);
            setField('phone', profile.phone);
            setField('business', profile.business);
            root.querySelector('[data-account-verified]').hidden = !me.emailVerified;
            root.querySelector('[data-account-lede]').textContent = (profile.name ? 'Signed in as ' + profile.name + '. ' : '') + 'Status and billing for your projects.';

            var schedule = root.querySelector('[data-account-schedule]');
            var hint = root.querySelector('[data-account-schedule-hint]');
            var meeting = safeUrl(me.meetingUrl);
            if (meeting) {
                schedule.href = meeting;
                schedule.setAttribute('aria-disabled', 'false');
                hint.hidden = true;
            } else {
                schedule.removeAttribute('href');
                schedule.setAttribute('aria-disabled', 'true');
                hint.hidden = false;
            }

            root.querySelector('[data-account-it]').hidden = !me.itSupport;
            var changed = formatDate(me.passwordChangedAt);
            root.querySelector('[data-account-password-age]').textContent = changed ? 'Last changed ' + changed : '';
        }

        function failBox(container, text, retry) {
            clear(container);
            var box = el('div', 'ds-callout ds-callout--attention');
            box.setAttribute('role', 'alert');
            box.appendChild(el('span', null, text + ' '));
            var button = el('button', 'portal-link', 'Try again');
            button.type = 'button';
            button.addEventListener('click', retry);
            box.lastChild.appendChild(button);
            container.appendChild(box);
        }

        function emptyBox(container, text, withContact) {
            clear(container);
            var box = el('div', 'portal-empty');
            box.appendChild(el('p', null, text));
            if (withContact) {
                var button = el('button', 'ds-btn ds-btn--sm', 'Contact the dev');
                button.type = 'button';
                button.setAttribute('data-bs-toggle', 'modal');
                button.setAttribute('data-bs-target', '#contact');
                button.setAttribute('data-contact-prefill', '');
                box.appendChild(button);
            }
            container.appendChild(box);
        }

        function loadSection(path, container, render, onFail) {
            request('GET', path).then(function (result) {
                if (gone) return;
                if (result.status === 401) return expired();
                if (result.status === 403 && result.data.error === 'account_disabled') return redirectToSignin('disabled');
                if (!result.ok) return onFail();
                render(result.data);
            }).catch(function () { if (!gone) onFail(); });
        }

        function loadProjects() {
            var container = root.querySelector('[data-account-projects]');
            var hint = root.querySelector('[data-account-hint="projects"]');
            clear(container);
            container.appendChild(el('div', 'sk portal-sk-row'));
            loadSection('/me/projects', container, function (data) {
                // Gray (not started) is internal, so only known client-facing statuses are shown.
                var list = (data.projects || []).filter(function (project) { return PROJECT_STATUS[project.status]; });
                hint.textContent = list.length ? list.length + (list.length === 1 ? ' project' : ' projects') : '';
                if (!list.length) return emptyBox(container, 'No active projects yet. Your project will appear here once work starts.', true);
                clear(container);
                var grid = el('div', 'ds-grid portal-projects');
                list.forEach(function (project) { grid.appendChild(projectCard(project)); });
                container.appendChild(grid);
            }, function () {
                hint.textContent = '';
                failBox(container, 'Could not load projects.', loadProjects);
            });
        }

        function projectCard(project) {
            var status = PROJECT_STATUS[project.status];
            var card = el('article', 'portal-card');
            card.appendChild(chip(status.tone, status.mark + ' ' + status.label));
            card.appendChild(el('h3', 'portal-card-title', project.name || 'Untitled project'));
            if (project.description) card.appendChild(el('p', 'portal-card-text', project.description));
            var live = safeUrl(project.liveUrl);
            if (live) {
                var link = el('a', 'portal-card-link', live.replace(/^https:\/\//, '').replace(/\/$/, '') + ' \u2197');
                link.href = live;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                card.appendChild(link);
            } else {
                card.appendChild(el('p', 'portal-card-muted', 'No live URL yet'));
            }
            var foot = el('div', 'portal-card-foot');
            var updated = formatDate(project.updatedAt);
            foot.appendChild(el('span', 'portal-card-muted', updated ? 'Updated ' + updated : ''));
            var report = el('button', 'portal-link', 'Report an issue');
            report.type = 'button';
            report.setAttribute('data-bs-toggle', 'modal');
            report.setAttribute('data-bs-target', '#contact');
            report.setAttribute('data-contact-type', 'other');
            report.setAttribute('data-contact-prefill', '');
            report.setAttribute('data-contact-note', 'Issue with ' + (project.name || 'my project') + ': ');
            foot.appendChild(report);
            card.appendChild(foot);
            return card;
        }

        function loadBilling() {
            var container = root.querySelector('[data-account-billing]');
            var sub = root.querySelector('[data-account-subscription]');
            clear(container);
            container.appendChild(el('div', 'sk portal-sk-row'));
            loadSection('/me/billing', container, function (data) {
                var plan = SUBSCRIPTION_STATUS[data.subscription] || SUBSCRIPTION_STATUS.none;
                sub.className = 'ds-label' + (plan.tone ? ' ds-label--' + plan.tone : '');
                sub.textContent = plan.label;
                var rows = data.payments || [];
                if (!rows.length) return emptyBox(container, 'No payments recorded yet.', false);
                clear(container);
                container.appendChild(billingTable(rows));
            }, function () {
                failBox(container, 'Could not load billing.', loadBilling);
            });
        }

        function billingTable(rows) {
            var wrap = el('div', 'ds-table-wrap portal-table-wrap');
            var table = el('table', 'ds-table portal-table');
            var head = el('thead');
            var headRow = el('tr');
            ['Date', 'Reference', 'Status', 'Receipt'].forEach(function (name) {
                var th = el('th', null, name);
                th.scope = 'col';
                headRow.appendChild(th);
            });
            head.appendChild(headRow);
            table.appendChild(head);
            var body = el('tbody');
            rows.forEach(function (payment) {
                var tr = el('tr');
                var date = el('td', null, formatDate(payment.date) || '\u2014');
                date.setAttribute('data-label', 'Date');
                var ref = el('td', 'portal-mono', payment.reference || '\u2014');
                ref.setAttribute('data-label', 'Reference');
                var state = PAYMENT_STATUS[payment.status];
                var status = el('td');
                status.setAttribute('data-label', 'Status');
                status.appendChild(chip(state ? state.tone : '', state ? state.label : String(payment.status || 'Unknown')));
                var receipt = el('td');
                receipt.setAttribute('data-label', 'Receipt');
                var url = safeUrl(payment.receiptUrl);
                if (url) {
                    var link = el('a', 'ds-btn ds-btn--sm', 'View \u2197');
                    link.href = url;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    receipt.appendChild(link);
                } else {
                    receipt.textContent = '\u2014';
                }
                [date, ref, status, receipt].forEach(function (cell) { tr.appendChild(cell); });
                body.appendChild(tr);
            });
            table.appendChild(body);
            wrap.appendChild(table);
            return wrap;
        }

        function load() {
            show('loading');
            request('GET', '/me').then(function (result) {
                if (gone) return;
                if (result.status === 401) return expired();
                if (result.status === 403 && result.data.error === 'account_disabled') return redirectToSignin('disabled');
                if (!result.ok) return show('error');
                renderProfile(result.data);
                show('content');
                loadProjects();
                loadBilling();
            }).catch(function () { if (!gone) show('error'); });
        }

        function securityNote(kind, text) {
            var note = root.querySelector('[data-account-security-note]');
            note.className = 'ds-callout ds-callout--' + kind;
            note.querySelector('i').className = 'typcn ' + NOTICE_ICONS[kind];
            root.querySelector('[data-account-security-text]').textContent = text;
            note.hidden = false;
        }

        function bindActions() {
            on(root.querySelector('[data-account-retry]'), 'click', load);

            var toggle = root.querySelector('[data-account-contact-toggle]');
            var panel = root.querySelector('[data-account-contact]');
            on(toggle, 'click', function () {
                var open = panel.hidden;
                panel.hidden = !open;
                toggle.setAttribute('aria-expanded', String(open));
            });

            var schedule = root.querySelector('[data-account-schedule]');
            on(schedule, 'click', function (event) {
                if (schedule.getAttribute('aria-disabled') === 'true') event.preventDefault();
            });

            var change = root.querySelector('[data-account-change-password]');
            on(change, 'click', function () {
                if (change.disabled || !profile || !profile.email) return;
                change.disabled = true;
                request('POST', '/auth/forgot', { email: profile.email }).then(function (result) {
                    if (result.status === 401) return expired();
                    if (result.ok) securityNote('success', 'We sent a link to ' + profile.email + '. It expires in 30 minutes.');
                    else securityNote('attention', 'Could not send the link. Try again.');
                }).catch(function () {
                    securityNote('attention', 'Could not reach the server. Nothing was sent.');
                }).then(function () { change.disabled = false; });
            });

            var signout = root.querySelector('[data-account-signout]');
            on(signout, 'click', function () {
                if (signout.disabled) return;
                signout.disabled = true;
                request('POST', '/auth/logout').then(function (result) {
                    if (result.ok || result.status === 401) {
                        profile = null;
                        window.location.replace(SIGNIN_PAGE + '?reason=signedout');
                        return;
                    }
                    securityNote('attention', 'Could not sign out. Try again.');
                    signout.disabled = false;
                }).catch(function () {
                    securityNote('attention', 'Could not reach the server. You are still signed in.');
                    signout.disabled = false;
                });
            });
        }

        bindActions();
        cleanups.push(function () { gone = true; });
        load();
    }

    /* ── lifecycle ───────────────────────────────────────────────── */

    function init(scope) {
        scope = scope || document;
        var node = scope.matches && scope.matches('[data-portal]') ? scope : scope.querySelector('[data-portal]');
        if (!node || node.dataset.portalBound) return;
        node.dataset.portalBound = '1';
        if (node.dataset.portal === 'signin') initSignin(node);
        else if (node.dataset.portal === 'account') initAccount(node);
    }

    function destroy() {
        cleanups.forEach(function (fn) { fn(); });
        cleanups = [];
        profile = null;
    }

    window.DoxxusPortal = {
        init: init,
        destroy: destroy,
        // Name, email and phone of the signed-in client (used to prefill the contact dialog), or null.
        profile: function () { return profile ? { name: profile.name, email: profile.email, phone: profile.phone } : null; }
    };

    init(document);
}());

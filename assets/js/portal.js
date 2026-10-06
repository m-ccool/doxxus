/*
 * Client portal: the sign-in page (signin.html) and the account page (account.html).
 *
 * Sign-in is Google or an emailed one-time code, through Supabase Auth (no passwords). The page talks to Supabase
 * directly with the public publishable key; Row Level Security in the database
 * (supabase/migrations) is what limits a signed-in client to their own rows.
 *
 *   clients   one row per client, matched to the Google account by email
 *   projects  that client's projects ("not_started" rows are never returned to clients)
 *
 * Billing lives on Stripe's hosted customer portal, so only a link is kept here.
 * If SUPABASE_URL or SUPABASE_KEY is empty the portal stays closed and makes no request.
 *
 * DoxxusPortal.init(root) / destroy(root) are called by router.js; profile() feeds the contact dialog.
 */
(function () {
    'use strict';

    var SUPABASE_URL = 'https://rnvsrhzxmpanabwmkiaj.supabase.co';
    // Publishable key: safe in the browser by design. Never put a secret key in this file.
    var SUPABASE_KEY = 'sb_publishable_7JyDWMMD_VmAODhFUNOQAw_GITR_Dn5';
    // Stripe customer portal login link (Dashboard > Settings > Billing > Customer portal). Empty = not set up yet.
    var BILLING_PORTAL_URL = '';

    var SIGNIN_PAGE = 'signin.html';
    var ACCOUNT_PAGE = 'account.html';
    var CLOSED_NOTICE = 'Sign in is not open yet. The client portal is still being built, and accounts are issued directly when a project starts.';
    var FAILED_NOTICE = 'Could not reach the server. Nothing was changed. Try again.';

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

    var profile = null;
    var cleanups = [];
    var client = null;

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

    function params() {
        return new URLSearchParams(window.location.search);
    }

    function configured() {
        return !!(SUPABASE_URL && SUPABASE_KEY && window.supabase && window.supabase.createClient);
    }

    function getClient() {
        if (!client && configured()) {
            client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
                auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
            });
        }
        return client;
    }

    function goTo(page) {
        if (window.DoxxusRouter) window.DoxxusRouter.navigate(page);
        else window.location.href = page;
    }

    function redirectToSignin(reason) {
        window.location.replace(SIGNIN_PAGE + (reason ? '?reason=' + reason : ''));
    }

    // The OAuth round trip leaves ?code= (or an error) in the address bar; remove it once handled.
    function cleanAuthParams() {
        var query = params();
        if (!query.has('code') && !query.has('error') && !query.has('error_code') && !query.has('error_description')) return;
        window.history.replaceState(window.history.state, '', window.location.pathname);
    }

    /* ── sign-in page ────────────────────────────────────────────── */

    function initSignin(root) {
        var notice = root.querySelector('[data-portal-notice]');
        var noticeText = root.querySelector('[data-portal-notice-text]');
        var button = root.querySelector('[data-portal-google]');
        var gone = false;

        function setNotice(kind, text) {
            notice.className = 'ds-callout ds-callout--' + kind;
            notice.querySelector('i').className = 'typcn ' + NOTICE_ICONS[kind];
            noticeText.textContent = text;
            notice.setAttribute('role', kind === 'attention' ? 'alert' : 'status');
            notice.hidden = false;
        }

        cleanups.push(function () { gone = true; });

        if (!configured()) {
            button.disabled = true;
            root.querySelectorAll('[data-portal-email-form] input, [data-portal-email-form] button').forEach(function (node) { node.disabled = true; });
            setNotice('note', CLOSED_NOTICE);
            return;
        }

        var query = params();
        var reason = query.get('reason');
        if (query.has('error') || query.has('error_description')) {
            setNotice('attention', 'Google sign-in did not complete. Try again.');
            cleanAuthParams();
        } else if (reason === 'signedout') {
            setNotice('success', 'You are signed out.');
        } else if (reason === 'expired') {
            setNotice('note', 'You were signed out for security. Sign in again to continue.');
        }

        function bindEmailCode() {
            var sendForm = root.querySelector('[data-portal-email-form]');
            var codeForm = root.querySelector('[data-portal-code-form]');
            var emailInput = sendForm.elements.email;
            var codeInput = codeForm.elements.code;
            var sendButton = sendForm.querySelector('[data-portal-email-send]');
            var verifyButton = codeForm.querySelector('[data-portal-code-verify]');
            var sentTo = '';

            function failure(error, fallback) {
                var limited = error && (error.status === 429 || /rate|seconds|too many/i.test(error.message || ''));
                setNotice('attention', limited ? 'Please wait a minute before asking for another code.' : fallback);
            }

            on(sendForm, 'submit', function (event) {
                event.preventDefault();
                if (sendButton.disabled) return;
                var address = emailInput.value.trim().toLowerCase();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 254) {
                    setNotice('attention', 'Enter the email address you gave me.');
                    emailInput.focus();
                    return;
                }
                sendButton.disabled = true;
                notice.hidden = true;
                getClient().auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } }).then(function (result) {
                    if (gone) return;
                    if (result.error) return failure(result.error, 'Could not send a code. Check the address and try again.');
                    sentTo = address;
                    root.querySelector('[data-portal-code-email]').textContent = address;
                    sendForm.hidden = true;
                    codeForm.hidden = false;
                    codeInput.value = '';
                    codeInput.focus();
                }).catch(function () {
                    if (!gone) setNotice('attention', FAILED_NOTICE);
                }).then(function () { sendButton.disabled = false; });
            });

            on(codeForm, 'submit', function (event) {
                event.preventDefault();
                if (verifyButton.disabled) return;
                var token = codeInput.value.replace(/\s+/g, '');
                if (!/^[0-9]{6,10}$/.test(token)) {
                    setNotice('attention', 'Enter the numeric code from the email.');
                    codeInput.focus();
                    return;
                }
                verifyButton.disabled = true;
                notice.hidden = true;
                getClient().auth.verifyOtp({ email: sentTo, token: token, type: 'email' }).then(function (result) {
                    if (gone) return;
                    if (result.error || !result.data || !result.data.session) {
                        codeInput.value = '';
                        codeInput.focus();
                        return setNotice('attention', 'That code is wrong or has expired. Check it, or ask for a new one.');
                    }
                    goTo(ACCOUNT_PAGE);
                }).catch(function () {
                    if (!gone) setNotice('attention', FAILED_NOTICE);
                }).then(function () { verifyButton.disabled = false; });
            });

            on(root.querySelector('[data-portal-code-back]'), 'click', function () {
                codeForm.hidden = true;
                sendForm.hidden = false;
                notice.hidden = true;
                emailInput.focus();
            });
        }

        on(button, 'click', function () {
            if (button.disabled) return;
            button.disabled = true;
            notice.hidden = true;
            getClient().auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: new URL(ACCOUNT_PAGE, window.location.href).href,
                    queryParams: { prompt: 'select_account' }
                }
            }).then(function (result) {
                if (result.error && !gone) {
                    setNotice('attention', FAILED_NOTICE);
                    button.disabled = false;
                }
            }).catch(function () {
                if (!gone) {
                    setNotice('attention', FAILED_NOTICE);
                    button.disabled = false;
                }
            });
        });

        bindEmailCode();

        // Already signed in: go straight to the account.
        getClient().auth.getSession().then(function (result) {
            if (!gone && result.data && result.data.session && root.isConnected) goTo(ACCOUNT_PAGE);
        }).catch(function () { /* stay on the form */ });
    }

    /* ── account page ────────────────────────────────────────────── */

    function chip(tone, text) {
        return el('span', 'ds-label' + (tone ? ' ds-label--' + tone : ''), text);
    }

    function initAccount(root) {
        if (!configured()) {
            redirectToSignin('');
            return;
        }

        var loading = root.querySelector('[data-account-loading]');
        var failed = root.querySelector('[data-account-error]');
        var unlinked = root.querySelector('[data-account-unlinked]');
        var content = root.querySelector('[data-account-content]');
        var gone = false;
        var signedInEmail = '';

        function show(which) {
            loading.hidden = which !== 'loading';
            failed.hidden = which !== 'error';
            unlinked.hidden = which !== 'unlinked';
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
            root.querySelector('[data-account-lede]').textContent = (profile.name ? 'Signed in as ' + profile.name + '. ' : '') + 'Status and billing for your projects.';

            var schedule = root.querySelector('[data-account-schedule]');
            var hint = root.querySelector('[data-account-schedule-hint]');
            var meeting = safeUrl(me.meeting_url);
            if (meeting) {
                schedule.href = meeting;
                schedule.setAttribute('aria-disabled', 'false');
                hint.hidden = true;
            } else {
                schedule.removeAttribute('href');
                schedule.setAttribute('aria-disabled', 'true');
                hint.hidden = false;
            }

            root.querySelector('[data-account-it]').hidden = !me.it_support;
            root.querySelector('[data-account-security-email]').textContent = profile.email;

            var billing = root.querySelector('[data-account-billing-link]');
            var billingHint = root.querySelector('[data-account-billing-hint]');
            var portal = safeUrl(BILLING_PORTAL_URL);
            if (portal) {
                billing.href = portal + (portal.indexOf('?') === -1 ? '?' : '&') + 'prefilled_email=' + encodeURIComponent(profile.email);
                billing.setAttribute('aria-disabled', 'false');
                billingHint.hidden = true;
            } else {
                billing.removeAttribute('href');
                billing.setAttribute('aria-disabled', 'true');
                billingHint.hidden = false;
            }
        }

        function emptyBox(container, text) {
            clear(container);
            var box = el('div', 'portal-empty');
            box.appendChild(el('p', null, text));
            var button = el('button', 'ds-btn ds-btn--sm', 'Contact the dev');
            button.type = 'button';
            button.setAttribute('data-bs-toggle', 'modal');
            button.setAttribute('data-bs-target', '#contact');
            button.setAttribute('data-contact-prefill', '');
            box.appendChild(button);
            container.appendChild(box);
        }

        function renderProjects(projects) {
            var container = root.querySelector('[data-account-projects]');
            var hint = root.querySelector('[data-account-hint="projects"]');
            // Gray (not started) is internal; the database already withholds it, this is a second guard.
            var list = (projects || []).filter(function (project) { return PROJECT_STATUS[project.status]; });
            hint.textContent = list.length ? list.length + (list.length === 1 ? ' project' : ' projects') : '';
            if (!list.length) return emptyBox(container, 'No active projects yet. Your project will appear here once work starts.');
            clear(container);
            var grid = el('div', 'ds-grid portal-projects');
            list.forEach(function (project) { grid.appendChild(projectCard(project)); });
            container.appendChild(grid);
        }

        function projectCard(project) {
            var status = PROJECT_STATUS[project.status];
            var card = el('article', 'portal-card');
            card.appendChild(chip(status.tone, status.mark + ' ' + status.label));
            card.appendChild(el('h3', 'portal-card-title', project.name || 'Untitled project'));
            if (project.description) card.appendChild(el('p', 'portal-card-text', project.description));
            var live = safeUrl(project.live_url);
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
            var updated = formatDate(project.updated_at);
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

        function load() {
            show('loading');
            getClient().auth.getSession().then(function (result) {
                if (gone) return null;
                var session = result.data && result.data.session;
                var returning = params().has('code');
                cleanAuthParams();
                if (!session) {
                    redirectToSignin(returning ? '' : 'expired');
                    return null;
                }
                signedInEmail = (session.user && session.user.email) || '';
                return getClient()
                    .from('clients')
                    .select('name, email, phone, business, it_support, meeting_url, projects(id, name, description, status, live_url, updated_at)')
                    .maybeSingle();
            }).then(function (result) {
                if (gone || !result) return;
                if (result.error) {
                    if (result.status === 401) return redirectToSignin('expired');
                    return show('error');
                }
                if (!result.data) {
                    root.querySelector('[data-account-unlinked-email]').textContent = signedInEmail;
                    return show('unlinked');
                }
                renderProfile(result.data);
                renderProjects(result.data.projects);
                show('content');
            }).catch(function () { if (!gone) show('error'); });
        }

        function signOut(button) {
            if (button.disabled) return;
            button.disabled = true;
            getClient().auth.signOut().then(function (result) {
                if (result.error) throw result.error;
                profile = null;
                window.location.replace(SIGNIN_PAGE + '?reason=signedout');
            }).catch(function () {
                var note = root.querySelector('[data-account-security-note]');
                if (note) {
                    note.hidden = false;
                    root.querySelector('[data-account-security-text]').textContent = 'Could not sign out. Try again.';
                }
                button.disabled = false;
            });
        }

        on(root.querySelector('[data-account-retry]'), 'click', load);

        root.querySelectorAll('[data-account-signout]').forEach(function (button) {
            on(button, 'click', function () { signOut(button); });
        });

        var toggle = root.querySelector('[data-account-contact-toggle]');
        var panel = root.querySelector('[data-account-contact]');
        on(toggle, 'click', function () {
            var open = panel.hidden;
            panel.hidden = !open;
            toggle.setAttribute('aria-expanded', String(open));
        });

        ['[data-account-schedule]', '[data-account-billing-link]'].forEach(function (selector) {
            var link = root.querySelector(selector);
            on(link, 'click', function (event) {
                if (link.getAttribute('aria-disabled') === 'true') event.preventDefault();
            });
        });

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

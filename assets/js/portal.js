/*
 * Portal core: the sign-in page (signin.html) and the session helpers the client dashboard (account.js), the admin
 * hub (admin*.js) and the navbar menu (site-shell.js) all use.
 *
 * Sign-in is Google or an emailed one-time code, through Supabase Auth (no passwords). Pages talk to Supabase
 * directly with the public publishable key; Row Level Security in the database (supabase/migrations) is what limits
 * a signed-in client to their own rows and what lets the admin see and change everything. The admin is a user whose
 * app_metadata.role is "admin"; after signing in, admins land on admin.html and clients on account.html.
 *
 * If SUPABASE_URL or SUPABASE_KEY is empty the portal stays closed and makes no request.
 *
 * DoxxusPortal.init(root) / destroy() are called by router.js. Shared with the other portal scripts:
 * client(), configured(), roleOf(), signOut(), expire(), setProfile() (feeds the contact dialog), profile().
 */
(function () {
    'use strict';

    var SUPABASE_URL = 'https://rnvsrhzxmpanabwmkiaj.supabase.co';
    // Publishable key: safe in the browser by design. Never put a secret key in this file.
    var SUPABASE_KEY = 'sb_publishable_7JyDWMMD_VmAODhFUNOQAw_GITR_Dn5';
    var SIGNIN_PAGE = 'signin.html';
    var ACCOUNT_PAGE = 'account.html';
    var ADMIN_PAGE = 'admin.html';
    var CLOSED_NOTICE = 'Sign in is not open yet. The client portal is still being built, and accounts are issued directly when a project starts.';
    var FAILED_NOTICE = 'Could not reach the server. Nothing was changed. Try again.';

    var NOTICE_ICONS = {
        note: 'typcn-info-large',
        attention: 'typcn-warning-outline',
        success: 'typcn-input-checked-outline'
    };

    var profile = null;
    var cleanups = [];
    var client = null;

    /* ── small helpers ───────────────────────────────────────────── */

    function on(target, type, handler) {
        target.addEventListener(type, handler);
        cleanups.push(function () { target.removeEventListener(type, handler); });
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

    // 'admin' for a session whose app_metadata.role is admin (set only from the Supabase dashboard / service role).
    function roleOf(session) {
        var meta = session && session.user && session.user.app_metadata;
        return meta && meta.role === 'admin' ? 'admin' : 'client';
    }

    function homeFor(session) {
        return roleOf(session) === 'admin' ? ADMIN_PAGE : ACCOUNT_PAGE;
    }

    // Ends the session, refreshes the navbar menu and lands on the sign-in page.
    function signOut() {
        return getClient().auth.signOut().then(function (result) {
            if (result.error) throw result.error;
            profile = null;
            if (window.SiteShell) window.SiteShell.refreshAccount();
            window.location.replace(SIGNIN_PAGE + '?reason=signedout');
        });
    }

    function redirectToSignin(reason) {
        window.location.replace(SIGNIN_PAGE + (reason ? '?reason=' + reason : ''));
    }

    // The server rejected the stored session (revoked, tampered with, or the token expired for good). Forget it
    // on this device first, otherwise the sign-in page would see it and send the visitor straight back here.
    function expire() {
        var ended = configured() ? getClient().auth.signOut({ scope: 'local' }) : Promise.resolve();
        return Promise.resolve(ended).catch(function () { /* the redirect below still happens */ }).then(function () {
            profile = null;
            if (window.SiteShell) window.SiteShell.refreshAccount();
            redirectToSignin('expired');
        });
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
                    if (window.SiteShell) window.SiteShell.refreshAccount();
                    goTo(homeFor(result.data.session));
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

        // Already signed in (or just back from Google): go straight to the right place for this account.
        getClient().auth.getSession().then(function (result) {
            var session = result.data && result.data.session;
            if (gone || !session || !root.isConnected) return;
            // Just bounced here because the session was rejected: stay and let them sign in again.
            if (reason === 'expired') { expire().then(function () { /* lands back here, clean */ }); return; }
            cleanAuthParams();
            if (window.SiteShell) window.SiteShell.refreshAccount();
            goTo(homeFor(session));
        }).catch(function () { /* stay on the form */ });
    }

    /* ── lifecycle ───────────────────────────────────────────────── */

    function init(scope) {
        scope = scope || document;
        var node = scope.matches && scope.matches('[data-portal]') ? scope : scope.querySelector('[data-portal]');
        if (!node || node.dataset.portalBound) return;
        node.dataset.portalBound = '1';
        if (node.dataset.portal === 'signin') initSignin(node);
    }

    function destroy() {
        cleanups.forEach(function (fn) { fn(); });
        cleanups = [];
        profile = null;
    }

    window.DoxxusPortal = {
        init: init,
        destroy: destroy,
        // Shared with the other portal scripts and the navbar menu: the Supabase client, a session's role, sign out.
        client: getClient,
        configured: configured,
        roleOf: roleOf,
        signOut: signOut,
        expire: expire,
        // The dashboard sets this once the client is loaded; the contact dialog reads it to prefill name, email, phone.
        setProfile: function (me) { profile = me ? { name: me.name || '', email: me.email || '', phone: me.phone || '' } : null; },
        profile: function () { return profile ? { name: profile.name, email: profile.email, phone: profile.phone } : null; }
    };

    init(document);
}());

/*
 * Client dashboard (account.html): one summary header and four tabs.
 *
 *   Overview       progress and the current phase of every project, plus shortcuts
 *   Project        the phase outline (Discovery, Design, Build, Review, Launch) with the milestones under each phase
 *   Files & links  what the admin has shared: links, and documents downloaded through short-lived signed URLs
 *   Account        the contract and contact details (read-only), the additional contact (the one thing a client
 *                  edits), billing and sign out
 *
 * Everything the client sees is filtered by row-level security (supabase/migrations): their own client row, their
 * projects that are not "not_started", and only the links and files marked visible. This page never decides what
 * is allowed, it only shows what the database returned. All text is written with textContent.
 *
 * Uses DoxxusUI (portal-ui.js) and the session helpers in portal.js. DoxxusAccount.init(root) / destroy() are called
 * by router.js.
 */
(function () {
    'use strict';

    var UI = window.DoxxusUI;
    var el = UI.el;
    var clear = UI.clear;

    // Stripe customer portal login link (Dashboard > Settings > Billing > Customer portal). Empty = not set up yet.
    var BILLING_PORTAL_URL = 'https://billing.stripe.com/p/login/test_bJe9AV8fwcKS8NBdhoco000';
    var SIGNIN_PAGE = 'signin.html';
    var ADMIN_PAGE = 'admin.html';
    var DOWNLOAD_SECONDS = 60;
    var FAILED = 'Could not reach the server. Nothing was changed. Try again.';

    // Old section links (bookmarks, emails) land on the nearest tab.
    var ALIASES = { projects: 'project', profile: 'account', billing: 'account', security: 'account', 'it-support': 'overview' };

    var SELECT = [
        'id, name, email, phone, business, it_support, meeting_url,',
        'plan, start_date, agreed_price, billing_terms, contract_url, contract_status, extra_contact,',
        'projects(id, name, description, status, live_url, updated_at,',
        ' project_phases(phase, state),',
        ' project_milestones(id, phase, title, state, due_date, position, created_at)),',
        'client_links(id, project_id, title, url, note, created_at),',
        'client_files(id, project_id, name, size_bytes, content_type, storage_path, created_at)'
    ].join(' ');

    var cleanups = [];

    function mount(root) {
        var portal = window.DoxxusPortal;
        if (!portal || !portal.configured()) {
            window.location.replace(SIGNIN_PAGE);
            return;
        }

        var loading = root.querySelector('[data-account-loading]');
        var failed = root.querySelector('[data-account-error]');
        var unlinked = root.querySelector('[data-account-unlinked]');
        var content = root.querySelector('[data-account-content]');
        var summaryBox = root.querySelector('[data-account-summary]');
        var windowTitle = root.querySelector('[data-account-title]');
        var windowHint = root.querySelector('[data-account-hint]');
        var tabRoot = root.querySelector('[data-tabs]');
        var gone = false;
        var tabsApi = null;
        var me = null;
        var signedInEmail = '';

        cleanups.push(function () {
            gone = true;
            if (tabsApi) tabsApi.destroy();
        });

        function db() {
            return portal.client();
        }

        function listen(target, type, handler) {
            target.addEventListener(type, handler);
            cleanups.push(function () { target.removeEventListener(type, handler); });
        }

        function show(which) {
            loading.hidden = which !== 'loading';
            failed.hidden = which !== 'error';
            unlinked.hidden = which !== 'unlinked';
            content.hidden = which !== 'content';
            summaryBox.hidden = which !== 'content';
            loading.setAttribute('aria-busy', String(which === 'loading'));
        }

        function panel(name) {
            return clear(root.querySelector('[data-tab-panel="' + name + '"]'));
        }

        function projectsOf(client) {
            // "not started" is internal; the database already withholds it, this is a second guard.
            return (client.projects || []).filter(function (p) { return p.status !== 'not_started'; });
        }

        function projectName(client, id) {
            var found = (client.projects || []).filter(function (p) { return p.id === id; })[0];
            return found ? found.name : 'General';
        }

        function empty(container, text) {
            var box = el('div', 'portal-empty');
            box.appendChild(el('p', null, text));
            container.appendChild(box);
        }

        function openTab(name) {
            if (!tabsApi) return;
            tabsApi.select(name);
            tabRoot.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function field(label, value, link) {
            var row = el('div');
            row.appendChild(el('dt', null, label));
            var dd = el('dd');
            if (value && link) {
                var anchor = el('a', null, value);
                anchor.href = link;
                if (link.indexOf('https:') === 0) { anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; }
                dd.appendChild(anchor);
            } else if (value instanceof Node) {
                dd.appendChild(value);
            } else {
                dd.textContent = value || 'Not provided';
                dd.classList.toggle('portal-muted', !value);
            }
            row.appendChild(dd);
            return row;
        }

        /* ── summary header ──────────────────────────────────────── */

        function renderSummary(client) {
            clear(summaryBox);
            var projects = projectsOf(client);
            var average = projects.length
                ? Math.round(projects.reduce(function (sum, p) { return sum + UI.projectProgress(p); }, 0) / projects.length)
                : 0;

            function cell(label) {
                var box = el('div', 'portal-summary-cell');
                box.appendChild(el('span', 'portal-summary-label', label));
                summaryBox.appendChild(box);
                return box;
            }

            var plan = cell('Plan');
            plan.appendChild(el('span', 'portal-summary-value', client.plan || 'Not set'));
            var contract = UI.pick(UI.CONTRACT_STATUS, client.contract_status);
            plan.appendChild(UI.chip(contract.tone, contract.label));

            var progress = cell('Progress');
            if (projects.length) {
                var line = el('div', 'portal-summary-progress');
                line.appendChild(UI.progressBar(average, 'Overall progress'));
                line.appendChild(el('span', 'portal-summary-value', average + '%'));
                progress.appendChild(line);
            } else {
                progress.appendChild(el('span', 'portal-muted', 'No active project yet'));
            }

            var next = cell('Next up');
            var upcoming = null;
            var owner = null;
            projects.forEach(function (p) {
                var m = UI.nextMilestone(p);
                if (m && !upcoming) { upcoming = m; owner = p; }
            });
            if (upcoming) {
                next.appendChild(el('span', 'portal-summary-value', upcoming.title));
                var due = UI.formatDate(upcoming.due_date);
                next.appendChild(el('span', 'portal-muted', (owner.name || 'Project') + (due ? ' \u00b7 ' + due : '')));
            } else {
                next.appendChild(el('span', 'portal-muted', projects.length ? 'Nothing scheduled' : 'Nothing yet'));
            }
        }

        function renderActions(client) {
            var schedule = root.querySelector('[data-account-schedule]');
            var hint = root.querySelector('[data-account-schedule-hint]');
            var meeting = UI.safeUrl(client.meeting_url);
            if (meeting) {
                schedule.href = meeting;
                schedule.setAttribute('aria-disabled', 'false');
                hint.hidden = true;
            } else {
                schedule.removeAttribute('href');
                schedule.setAttribute('aria-disabled', 'true');
                hint.hidden = false;
            }
        }

        /* ── overview ────────────────────────────────────────────── */

        function renderOverview(client) {
            var container = panel('overview');
            var projects = projectsOf(client);

            var head = el('div', 'portal-panel-head');
            head.appendChild(el('h2', 'portal-panel-title', 'Your projects'));
            head.appendChild(el('span', 'portal-muted', projects.length ? projects.length + (projects.length === 1 ? ' project' : ' projects') : ''));
            container.appendChild(head);

            if (!projects.length) {
                empty(container, 'No active projects yet. Your project will appear here once work starts.');
            } else {
                var grid = el('div', 'ds-grid portal-projects');
                projects.forEach(function (project) { grid.appendChild(overviewCard(project)); });
                container.appendChild(grid);
            }

            var shortcuts = el('div', 'portal-shortcuts');
            var fileCount = (client.client_files || []).length + (client.client_links || []).length;
            shortcuts.appendChild(shortcut('Files & links', fileCount ? fileCount + (fileCount === 1 ? ' item shared' : ' items shared') : 'Nothing shared yet', 'files'));
            shortcuts.appendChild(shortcut('Contract & billing', client.plan || 'Plan, price and billing', 'account'));
            container.appendChild(shortcuts);

            if (client.it_support) container.appendChild(itSupportCard());
        }

        function shortcut(title, text, tab) {
            var button = el('button', 'portal-shortcut');
            button.type = 'button';
            button.appendChild(el('strong', 'portal-strong', title));
            button.appendChild(el('span', 'portal-muted', text));
            button.addEventListener('click', function () { openTab(tab); });
            return button;
        }

        function overviewCard(project) {
            var status = UI.pick(UI.PROJECT_STATUS, project.status);
            var card = el('article', 'portal-card');
            var top = el('div', 'portal-card-top');
            top.appendChild(UI.chip(status.tone, status.mark + ' ' + status.label));
            card.appendChild(top);
            card.appendChild(el('h3', 'portal-card-title', project.name || 'Untitled project'));

            var percent = UI.projectProgress(project);
            var bar = el('div', 'portal-progress-row');
            bar.appendChild(UI.progressBar(percent, 'Progress for ' + (project.name || 'project')));
            bar.appendChild(el('span', 'portal-progress-num', percent + '%'));
            card.appendChild(bar);

            var current = UI.currentPhase(project);
            card.appendChild(el('p', 'portal-card-text', current ? 'Now: ' + current.label : 'All phases complete'));
            var next = UI.nextMilestone(project);
            if (next) {
                var due = UI.formatDate(next.due_date);
                card.appendChild(el('p', 'portal-card-muted', 'Next: ' + next.title + (due ? ' \u00b7 ' + due : '')));
            }

            var foot = el('div', 'portal-card-foot');
            var updated = UI.formatDate(project.updated_at);
            foot.appendChild(el('span', 'portal-card-muted', updated ? 'Updated ' + updated : ''));
            var open = el('button', 'portal-link', 'See the outline');
            open.type = 'button';
            open.addEventListener('click', function () { openTab('project'); });
            foot.appendChild(open);
            card.appendChild(foot);
            return card;
        }

        function itSupportCard() {
            var box = el('div', 'portal-callout');
            box.appendChild(el('h3', 'portal-card-title', 'IT support'));
            box.appendChild(el('p', 'portal-card-text', 'Need a machine looked at? Request a diagnostic. Every IT job is quoted individually.'));
            var row = el('div', 'portal-row portal-row--start');
            var request = el('button', 'ds-btn', 'Request IT support');
            request.type = 'button';
            request.setAttribute('data-bs-toggle', 'modal');
            request.setAttribute('data-bs-target', '#contact');
            request.setAttribute('data-contact-type', 'repair');
            request.setAttribute('data-contact-prefill', '');
            request.setAttribute('data-contact-note', 'I would like to request IT support: ');
            var pay = el('a', 'ds-btn ds-btn--primary', 'Pay for the $100 diagnostic \u2197');
            pay.href = 'https://buy.stripe.com/test_cNi7sN2Vc7qye7V0uCco001';
            pay.target = '_blank';
            pay.rel = 'noopener noreferrer';
            row.appendChild(request);
            row.appendChild(pay);
            box.appendChild(row);
            return box;
        }

        /* ── project outline ─────────────────────────────────────── */

        function renderProjects(client) {
            var container = panel('project');
            var projects = projectsOf(client);
            if (!projects.length) {
                empty(container, 'No active projects yet. Your project will appear here once work starts.');
                return;
            }
            projects.forEach(function (project) { container.appendChild(projectDetail(project)); });
        }

        function projectDetail(project) {
            var status = UI.pick(UI.PROJECT_STATUS, project.status);
            var card = el('article', 'portal-card portal-project');

            var head = el('div', 'portal-card-top');
            head.appendChild(el('h3', 'portal-card-title', project.name || 'Untitled project'));
            head.appendChild(UI.chip(status.tone, status.mark + ' ' + status.label));
            card.appendChild(head);
            if (project.description) card.appendChild(el('p', 'portal-card-text', project.description));

            var percent = UI.projectProgress(project);
            var bar = el('div', 'portal-progress-row');
            bar.appendChild(UI.progressBar(percent, 'Progress for ' + (project.name || 'project')));
            bar.appendChild(el('span', 'portal-progress-num', percent + '%'));
            card.appendChild(bar);

            var outline = el('ol', 'portal-phases');
            UI.orderedPhases(project).forEach(function (phase) {
                var state = UI.pick(UI.STATES, phase.state);
                var item = el('li', 'portal-phase portal-phase--' + phase.state);
                var line = el('div', 'portal-phase-line');
                var mark = el('span', 'portal-phase-mark', state.mark);
                mark.setAttribute('aria-hidden', 'true');
                line.appendChild(mark);
                line.appendChild(el('strong', 'portal-phase-name', phase.label));
                line.appendChild(el('span', 'portal-phase-state', state.label));
                item.appendChild(line);

                var milestones = UI.milestonesFor(project, phase.phase);
                if (milestones.length) {
                    var list = el('ul', 'portal-milestones');
                    milestones.forEach(function (m) {
                        var ms = UI.pick(UI.STATES, m.state);
                        var row = el('li', 'portal-milestone portal-milestone--' + m.state);
                        var dot = el('span', 'portal-phase-mark', ms.mark);
                        dot.setAttribute('aria-hidden', 'true');
                        row.appendChild(dot);
                        row.appendChild(el('span', 'portal-milestone-title', m.title));
                        var due = UI.formatDate(m.due_date);
                        row.appendChild(el('span', 'portal-muted portal-milestone-meta', ms.label + (due ? ' \u00b7 ' + due : '')));
                        list.appendChild(row);
                    });
                    item.appendChild(list);
                }
                outline.appendChild(item);
            });
            card.appendChild(outline);

            var foot = el('div', 'portal-card-foot');
            var live = UI.safeUrl(project.live_url);
            if (live) {
                var link = el('a', 'portal-card-link', live.replace(/^https:\/\//, '').replace(/\/$/, '') + ' \u2197');
                link.href = live;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                foot.appendChild(link);
            } else {
                foot.appendChild(el('span', 'portal-card-muted', 'No live URL yet'));
            }
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

        /* ── files and links ─────────────────────────────────────── */

        function byNewest(a, b) {
            return String(b.created_at || '').localeCompare(String(a.created_at || ''));
        }

        function renderFiles(client) {
            var container = panel('files');
            var links = (client.client_links || []).slice().sort(byNewest);
            var files = (client.client_files || []).slice().sort(byNewest);

            if (!links.length && !files.length) {
                empty(container, 'Nothing has been shared with you yet. Links and documents for your project will appear here.');
                return;
            }

            container.appendChild(el('h2', 'portal-panel-title', 'Links'));
            if (!links.length) container.appendChild(el('p', 'portal-muted portal-gap', 'No links yet.'));
            else {
                var linkList = el('div', 'ds-box');
                links.forEach(function (item) {
                    var row = el('div', 'ds-box-row');
                    var body = el('div', 'portal-grow');
                    var url = UI.safeUrl(item.url);
                    if (url) {
                        var anchor = el('a', 'portal-strong', item.title);
                        anchor.href = url;
                        anchor.target = '_blank';
                        anchor.rel = 'noopener noreferrer';
                        body.appendChild(anchor);
                    } else {
                        body.appendChild(el('strong', 'portal-strong', item.title));
                    }
                    if (item.note) body.appendChild(el('span', 'portal-muted portal-sub', item.note));
                    row.appendChild(body);
                    row.appendChild(el('span', 'portal-muted portal-sub', projectName(client, item.project_id)));
                    linkList.appendChild(row);
                });
                container.appendChild(linkList);
            }

            container.appendChild(el('h2', 'portal-panel-title portal-panel-title--spaced', 'Documents'));
            if (!files.length) container.appendChild(el('p', 'portal-muted portal-gap', 'No documents yet.'));
            else {
                var fileList = el('div', 'ds-box');
                files.forEach(function (item) { fileList.appendChild(fileRow(client, item)); });
                container.appendChild(fileList);
            }
        }

        function fileRow(client, item) {
            var row = el('div', 'ds-box-row');
            var body = el('div', 'portal-grow');
            body.appendChild(el('strong', 'portal-strong', item.name));
            var meta = [UI.fileSize(item.size_bytes), UI.formatDate(item.created_at), projectName(client, item.project_id)].filter(Boolean);
            body.appendChild(el('span', 'portal-muted portal-sub', meta.join(' \u00b7 ')));
            row.appendChild(body);

            var state = el('span', 'portal-result');
            var result = UI.status(state);
            var button = el('button', 'ds-btn ds-btn--sm', 'Download');
            button.type = 'button';
            button.addEventListener('click', function () {
                if (button.disabled) return;
                button.disabled = true;
                result.clear();
                // A signed link that expires in a minute and downloads instead of navigating away.
                db().storage.from('client-files').createSignedUrl(item.storage_path, DOWNLOAD_SECONDS, { download: item.name }).then(function (response) {
                    if (gone) return;
                    var url = response.data && response.data.signedUrl;
                    if (response.error || !url) return result.failed('Could not download');
                    window.location.assign(url);
                }).catch(function () {
                    if (!gone) result.failed('Could not download');
                }).then(function () { button.disabled = false; });
            });
            row.appendChild(state);
            row.appendChild(button);
            return row;
        }

        /* ── account ─────────────────────────────────────────────── */

        function renderAccount(client) {
            var container = panel('account');

            container.appendChild(el('h2', 'portal-panel-title', 'Contract'));
            var contract = el('dl', 'portal-kv');
            var cs = UI.pick(UI.CONTRACT_STATUS, client.contract_status);
            contract.appendChild(field('Plan', client.plan));
            contract.appendChild(field('Status', UI.chip(cs.tone, cs.label)));
            contract.appendChild(field('Start date', UI.formatDate(client.start_date)));
            contract.appendChild(field('Agreed price', UI.money(client.agreed_price)));
            contract.appendChild(field('Billing terms', client.billing_terms));
            var doc = UI.safeUrl(client.contract_url);
            contract.appendChild(field('Contract document', doc ? 'Open contract \u2197' : '', doc));
            container.appendChild(contract);

            container.appendChild(el('h2', 'portal-panel-title portal-panel-title--spaced', 'Contact details'));
            var details = el('dl', 'portal-kv');
            details.appendChild(field('Name', client.name));
            details.appendChild(field('Email', client.email));
            details.appendChild(field('Phone', client.phone));
            details.appendChild(field('Business / project', client.business));
            container.appendChild(details);
            var change = el('div', 'portal-row');
            change.appendChild(el('span', 'portal-muted', 'The contract and these details are set by the dev. To change any of them:'));
            var request = el('button', 'ds-btn ds-btn--sm', 'Request a change');
            request.type = 'button';
            request.setAttribute('data-bs-toggle', 'modal');
            request.setAttribute('data-bs-target', '#contact');
            request.setAttribute('data-contact-type', 'other');
            request.setAttribute('data-contact-prefill', '');
            request.setAttribute('data-contact-note', 'I would like to change my details: ');
            change.appendChild(request);
            container.appendChild(change);

            container.appendChild(el('h2', 'portal-panel-title portal-panel-title--spaced', 'Additional contact'));
            container.appendChild(extraContactForm(client));

            container.appendChild(el('h2', 'portal-panel-title portal-panel-title--spaced', 'Billing'));
            container.appendChild(el('p', 'portal-note', "Invoices, receipts and payment methods are on Stripe's secure billing portal. No card details are stored here."));
            var billingRow = el('div', 'portal-row portal-row--start');
            var billing = el('a', 'ds-btn', 'Open billing portal \u2197');
            var portalUrl = UI.safeUrl(BILLING_PORTAL_URL);
            if (portalUrl) {
                billing.href = portalUrl + (portalUrl.indexOf('?') === -1 ? '?' : '&') + 'prefilled_email=' + encodeURIComponent(client.email || '');
                billing.target = '_blank';
                billing.rel = 'noopener noreferrer';
                billing.setAttribute('aria-disabled', 'false');
            } else {
                billing.setAttribute('role', 'link');
                billing.setAttribute('aria-disabled', 'true');
            }
            billingRow.appendChild(billing);
            container.appendChild(billingRow);
            if (!portalUrl) container.appendChild(el('p', 'portal-hint', 'The billing portal is not set up yet. Contact the dev for an invoice.'));

            container.appendChild(el('h2', 'portal-panel-title portal-panel-title--spaced', 'Security'));
            var security = el('div', 'portal-row');
            var who = el('span');
            who.appendChild(el('strong', 'portal-strong', 'Signed in as '));
            who.appendChild(el('span', 'portal-muted', client.email || signedInEmail));
            security.appendChild(who);
            var out = el('button', 'ds-btn ds-btn--sm', 'Sign out');
            out.type = 'button';
            var outState = el('span', 'portal-result');
            var outResult = UI.status(outState);
            out.addEventListener('click', function () {
                if (out.disabled) return;
                out.disabled = true;
                outResult.clear();
                portal.signOut().catch(function () {
                    outResult.failed('Could not sign out. Try again.');
                    out.disabled = false;
                });
            });
            security.appendChild(outState);
            security.appendChild(out);
            container.appendChild(security);
            container.appendChild(el('p', 'portal-note', 'Signing out ends this session only.'));

            container.appendChild(passwordForm());
        }

        // Lets the client set (or change) a password, so next time they can skip the emailed code. The emailed
        // code keeps working either way; this only adds a second way in, it never replaces it.
        function passwordForm() {
            var form = el('form', 'portal-form');
            form.noValidate = true;

            var grid = el('div', 'portal-form-grid');
            var newWrap = el('div', 'ds-field');
            var newLabel = el('label', null, 'New password');
            var newInput = el('input', 'ds-input');
            newInput.type = 'password';
            newInput.id = 'account-password-new';
            newInput.autocomplete = 'new-password';
            newInput.maxLength = 72;
            newLabel.setAttribute('for', newInput.id);
            newWrap.appendChild(newLabel);
            newWrap.appendChild(newInput);

            var confirmWrap = el('div', 'ds-field');
            var confirmLabel = el('label', null, 'Confirm password');
            var confirmInput = el('input', 'ds-input');
            confirmInput.type = 'password';
            confirmInput.id = 'account-password-confirm';
            confirmInput.autocomplete = 'new-password';
            confirmInput.maxLength = 72;
            confirmLabel.setAttribute('for', confirmInput.id);
            confirmWrap.appendChild(confirmLabel);
            confirmWrap.appendChild(confirmInput);

            grid.appendChild(newWrap);
            grid.appendChild(confirmWrap);
            form.appendChild(grid);
            form.appendChild(el('p', 'portal-note', 'Optional: set a password to sign in faster next time. The emailed code still works either way.'));

            var row = el('div', 'portal-row portal-row--end');
            var state = el('span', 'portal-result');
            var result = UI.status(state);
            var save = el('button', 'ds-btn ds-btn--sm ds-btn--primary', 'Set password');
            save.type = 'submit';
            row.appendChild(state);
            row.appendChild(save);
            form.appendChild(row);

            form.addEventListener('submit', function (event) {
                event.preventDefault();
                var value = newInput.value;
                var confirm = confirmInput.value;
                if (value.length < 8) {
                    result.failed('Use at least 8 characters.');
                    newInput.focus();
                    return;
                }
                if (value !== confirm) {
                    result.failed('Passwords do not match.');
                    confirmInput.focus();
                    return;
                }
                save.disabled = true;
                result.saving();
                db().auth.updateUser({ password: value }).then(function (response) {
                    if (gone) return;
                    if (response.error) return result.failed('Not saved. Try again.');
                    newInput.value = '';
                    confirmInput.value = '';
                    result.saved('Password set');
                }).catch(function () {
                    if (!gone) result.failed(FAILED);
                }).then(function () { save.disabled = false; });
            });

            return form;
        }

        // The one thing a client edits. Mirrors valid_extra_contact() in the database, which is what really enforces it.
        function extraContactForm(client) {
            var saved = client.extra_contact || {};
            var form = el('form', 'portal-form');
            form.noValidate = true;

            var fields = [
                { key: 'name', label: 'Name', max: 120, type: 'text', auto: 'off' },
                { key: 'email', label: 'Email', max: 254, type: 'email', auto: 'off' },
                { key: 'phone', label: 'Phone', max: 40, type: 'tel', auto: 'off' },
                { key: 'note', label: 'Role or note', max: 300, type: 'text', auto: 'off' }
            ];
            var inputs = {};
            var grid = el('div', 'portal-form-grid');
            fields.forEach(function (def) {
                var wrap = el('div', 'ds-field');
                var label = el('label', null, def.label);
                var input = el('input', 'ds-input');
                input.type = def.type;
                input.maxLength = def.max;
                input.autocomplete = def.auto;
                input.id = 'extra-' + def.key;
                input.value = saved[def.key] || '';
                label.setAttribute('for', input.id);
                wrap.appendChild(label);
                wrap.appendChild(input);
                grid.appendChild(wrap);
                inputs[def.key] = input;
            });
            form.appendChild(grid);
            form.appendChild(el('p', 'portal-note', 'Someone else the dev can reach about this project, like a colleague or an assistant.'));

            var row = el('div', 'portal-row portal-row--end');
            var state = el('span', 'portal-result');
            var result = UI.status(state);
            var clearButton = el('button', 'ds-btn ds-btn--sm', 'Clear');
            clearButton.type = 'button';
            var save = el('button', 'ds-btn ds-btn--sm ds-btn--primary', 'Save');
            save.type = 'submit';
            row.appendChild(state);
            row.appendChild(clearButton);
            row.appendChild(save);
            form.appendChild(row);

            function write(value) {
                save.disabled = true;
                clearButton.disabled = true;
                result.saving();
                db().from('clients').update({ extra_contact: value }).eq('id', client.id).select('extra_contact').then(function (response) {
                    if (gone) return;
                    if (response.error || !response.data || !response.data.length) return result.failed('Not saved. Try again.');
                    client.extra_contact = response.data[0].extra_contact;
                    var now = client.extra_contact || {};
                    fields.forEach(function (def) { inputs[def.key].value = now[def.key] || ''; });
                    result.saved(value ? 'Saved' : 'Cleared');
                }).catch(function () {
                    if (!gone) result.failed(FAILED);
                }).then(function () {
                    save.disabled = false;
                    clearButton.disabled = false;
                });
            }

            form.addEventListener('submit', function (event) {
                event.preventDefault();
                var value = {};
                fields.forEach(function (def) {
                    var text = inputs[def.key].value.trim();
                    if (text) value[def.key] = text;
                });
                if (value.email && !UI.isEmail(value.email)) {
                    result.failed('Enter a valid email address.');
                    inputs.email.focus();
                    return;
                }
                write(Object.keys(value).length ? value : null);
            });

            clearButton.addEventListener('click', function () {
                fields.forEach(function (def) { inputs[def.key].value = ''; });
                write(null);
            });
            return form;
        }

        /* ── loading ─────────────────────────────────────────────── */

        function render(client) {
            me = client;
            portal.setProfile(client);
            root.querySelector('[data-account-lede]').textContent = (client.name ? 'Signed in as ' + client.name + '. ' : '') + 'Status, files and billing for your projects.';
            windowHint.textContent = client.plan || '';
            renderSummary(client);
            renderActions(client);
            renderOverview(client);
            renderProjects(client);
            renderFiles(client);
            renderAccount(client);
        }

        function load() {
            show('loading');
            db().auth.getSession().then(function (result) {
                if (gone) return null;
                var session = result.data && result.data.session;
                var returning = new URLSearchParams(window.location.search).has('code');
                if (returning) window.history.replaceState(window.history.state, '', window.location.pathname);
                if (!session) {
                    window.location.replace(SIGNIN_PAGE);
                    return null;
                }
                if (portal.roleOf(session) === 'admin') {
                    if (window.DoxxusRouter) window.DoxxusRouter.navigate(ADMIN_PAGE);
                    else window.location.replace(ADMIN_PAGE);
                    return null;
                }
                signedInEmail = (session.user && session.user.email) || '';
                if (window.SiteShell) window.SiteShell.refreshAccount();
                return db().from('clients').select(SELECT).maybeSingle();
            }).then(function (result) {
                if (gone || !result) return;
                if (result.error) {
                    if (result.status === 401) return portal.expire();
                    return show('error');
                }
                if (!result.data) {
                    root.querySelector('[data-account-unlinked-email]').textContent = signedInEmail;
                    return show('unlinked');
                }
                render(result.data);
                show('content');
                if (!tabsApi) {
                    tabsApi = UI.tabs(tabRoot, {
                        hash: true,
                        aliases: ALIASES,
                        onSelect: function (name) {
                            var def = tabRoot.querySelector('[data-tab="' + name + '"]');
                            windowTitle.textContent = 'doxxus@portal \u2014 ~/' + name;
                            if (def) def.setAttribute('data-seen', '1');
                        }
                    });
                }
            }).catch(function () { if (!gone) show('error'); });
        }

        listen(root.querySelector('[data-account-retry]'), 'click', load);
        root.querySelectorAll('[data-account-signout]').forEach(function (button) {
            listen(button, 'click', function () {
                if (button.disabled) return;
                button.disabled = true;
                portal.signOut().catch(function () { button.disabled = false; });
            });
        });
        ['[data-account-schedule]'].forEach(function (selector) {
            var link = root.querySelector(selector);
            listen(link, 'click', function (event) {
                if (link.getAttribute('aria-disabled') === 'true') event.preventDefault();
            });
        });

        load();
    }

    function init(scope) {
        scope = scope || document;
        var node = scope.matches && scope.matches('[data-portal="account"]') ? scope : scope.querySelector('[data-portal="account"]');
        if (!node || node.dataset.accountBound) return;
        node.dataset.accountBound = '1';
        mount(node);
    }

    function destroy() {
        cleanups.forEach(function (fn) { fn(); });
        cleanups = [];
    }

    window.DoxxusAccount = { init: init, destroy: destroy };
    init(document);
}());

/*
 * Admin hub (admin.html), core: the clients list, one client's tabs, the contract form, notes and submissions.
 * The Projects and Files & links tabs are separate scripts (admin-projects.js, admin-files.js) that register
 * themselves on window.DoxxusAdminPanels before this file runs.
 *
 *   Clients        a list (search, filter, New client) beside the selected client:
 *                  Overview, Contract & contact, Projects, Files & links, Notes
 *   Submissions    the latest contact and package requests, each with "Create client"
 *
 * This page is not a security boundary: anyone can open it, but data only loads for a Supabase user whose
 * app_metadata.role is "admin", enforced by row-level security (supabase/migrations). Everyone else gets the
 * "not an admin account" state. All text is written with textContent, never innerHTML.
 *
 * Uses DoxxusUI (portal-ui.js) and the session helpers in portal.js. DoxxusAdmin.init(root) / destroy() are called
 * by router.js.
 */
(function () {
    'use strict';

    var UI = window.DoxxusUI;
    var el = UI.el;
    var clear = UI.clear;
    var panels = window.DoxxusAdminPanels = window.DoxxusAdminPanels || {};

    var SIGNIN_PAGE = 'signin.html';
    var SUBMISSION_LIMIT = 50;
    var NOTE_MAX = 4000;
    var FAILED = 'Could not reach the server. Nothing was changed. Try again.';

    var CLIENT_COLUMNS = [
        'id, email, name, phone, business, it_support, meeting_url, disabled, created_at,',
        'plan, start_date, agreed_price, billing_terms, contract_url, contract_status, extra_contact'
    ].join(' ');

    var CLIENT_SELECT = CLIENT_COLUMNS + ', ' + [
        'projects(id, name, description, status, live_url, created_at, updated_at,',
        ' project_phases(phase, state),',
        ' project_milestones(id, phase, title, state, due_date, position, created_at)),',
        'client_links(id, project_id, title, url, note, visible_to_client, created_at),',
        'client_files(id, project_id, name, size_bytes, content_type, storage_path, visible_to_client, created_at)'
    ].join(' ');

    var DETAIL_TABS = [
        { key: 'overview', label: 'Overview' },
        { key: 'contract', label: 'Contract & contact' },
        { key: 'projects', label: 'Projects' },
        { key: 'files', label: 'Files & links' },
        { key: 'notes', label: 'Notes' }
    ];

    var cleanups = [];

    function mount(root) {
        var portal = window.DoxxusPortal;
        if (!portal || !portal.configured()) {
            window.location.replace(SIGNIN_PAGE);
            return;
        }

        var loading = root.querySelector('[data-admin-loading]');
        var failed = root.querySelector('[data-admin-error]');
        var denied = root.querySelector('[data-admin-denied]');
        var content = root.querySelector('[data-admin-content]');
        var topRoot = root.querySelector('[data-admin-tabs]');
        var windowTitle = root.querySelector('[data-admin-title]');
        var split = root.querySelector('[data-admin-split]');
        var listBox = root.querySelector('[data-admin-clients]');
        var search = root.querySelector('[data-admin-search]');
        var filter = root.querySelector('[data-admin-filter]');
        var detailBox = root.querySelector('[data-admin-detail]');
        var submissionsBox = root.querySelector('[data-admin-submissions]');
        var gone = false;
        var topTabs = null;
        var detailTabs = null;
        var state = { clients: [], selectedId: null, creating: false, prefill: null, tab: 'overview', noteToken: 0 };

        cleanups.push(function () {
            gone = true;
            if (topTabs) topTabs.destroy();
            if (detailTabs) detailTabs.destroy();
        });

        function listen(target, type, handler) {
            target.addEventListener(type, handler);
            cleanups.push(function () { target.removeEventListener(type, handler); });
        }

        function db() {
            return portal.client();
        }

        function show(which) {
            loading.hidden = which !== 'loading';
            failed.hidden = which !== 'error';
            denied.hidden = which !== 'denied';
            content.hidden = which !== 'content';
            loading.setAttribute('aria-busy', String(which === 'loading'));
        }

        function empty(container, text) {
            clear(container);
            var box = el('div', 'portal-empty');
            box.appendChild(el('p', null, text));
            container.appendChild(box);
        }

        function setHint(name, text) {
            var node = root.querySelector('[data-admin-hint="' + name + '"]');
            if (node) node.textContent = text;
        }

        function selected() {
            return state.clients.filter(function (c) { return c.id === state.selectedId; })[0] || null;
        }

        function sortClients() {
            state.clients.sort(function (a, b) {
                return String(a.name || a.email).toLowerCase().localeCompare(String(b.name || b.email).toLowerCase());
            });
        }

        function toNull(value) {
            var text = String(value == null ? '' : value).trim();
            return text === '' ? null : text;
        }

        /* ── clients list ────────────────────────────────────────── */

        function matches(client, query, mode) {
            if (mode === 'active' && client.disabled) return false;
            if (mode === 'disabled' && !client.disabled) return false;
            if (mode === 'it' && !client.it_support) return false;
            if (!query) return true;
            return [client.name, client.email, client.business, client.plan].join(' ').toLowerCase().indexOf(query) !== -1;
        }

        function renderList() {
            var query = search.value.trim().toLowerCase();
            var rows = state.clients.filter(function (client) { return matches(client, query, filter.value); });
            setHint('clients', state.clients.length + (state.clients.length === 1 ? ' client' : ' clients'));
            if (!rows.length) {
                return empty(listBox, state.clients.length ? 'No clients match.' : 'No clients yet. Use New client to add the first one.');
            }
            clear(listBox);
            var box = el('div', 'ds-box');
            rows.forEach(function (client) {
                var on = client.id === state.selectedId && !state.creating;
                var row = el('button', 'ds-box-row admin-client' + (on ? ' is-selected' : ''));
                row.type = 'button';
                row.setAttribute('aria-pressed', String(on));
                var who = el('span', 'portal-grow');
                who.appendChild(el('strong', 'portal-strong', client.name || client.email));
                who.appendChild(el('span', 'portal-muted portal-sub', client.business ? client.business + ' \u00b7 ' + client.email : client.email));
                row.appendChild(who);
                var count = (client.projects || []).length;
                row.appendChild(el('span', 'portal-muted portal-sub admin-count', count + (count === 1 ? ' project' : ' projects')));
                if (client.disabled) row.appendChild(UI.chip('danger', 'Disabled'));
                row.addEventListener('click', function () { openClient(client.id); });
                box.appendChild(row);
            });
            listBox.appendChild(box);
        }

        /* ── client detail ───────────────────────────────────────── */

        function openClient(id) {
            state.selectedId = id;
            state.creating = false;
            state.prefill = null;
            renderList();
            renderDetail();
            split.classList.add('is-detail');
            detailBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function openNew(prefill) {
            state.selectedId = null;
            state.creating = true;
            state.prefill = prefill || null;
            renderList();
            renderDetail();
            split.classList.add('is-detail');
            detailBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function closeDetail() {
            state.selectedId = null;
            state.creating = false;
            split.classList.remove('is-detail');
            renderList();
            renderDetail();
        }

        function backButton() {
            var back = el('button', 'portal-link admin-back', '\u2190 All clients');
            back.type = 'button';
            back.addEventListener('click', closeDetail);
            return back;
        }

        function renderDetail() {
            if (detailTabs) { detailTabs.destroy(); detailTabs = null; }
            clear(detailBox);

            if (state.creating) {
                detailBox.appendChild(backButton());
                var head = el('div', 'portal-panel-head');
                head.appendChild(el('h2', 'portal-panel-title', 'New client'));
                detailBox.appendChild(head);
                detailBox.appendChild(el('p', 'portal-note', 'The client signs in with this email address (Google or an emailed code) and then sees only their own account.'));
                contractForm(detailBox, null, state.prefill);
                return;
            }

            var client = selected();
            if (!client) {
                var hint = el('div', 'portal-empty admin-empty');
                hint.appendChild(el('p', null, 'Select a client to see their projects, files and contract, or create a new client.'));
                detailBox.appendChild(hint);
                return;
            }

            detailBox.appendChild(backButton());
            var top = el('div', 'portal-panel-head');
            var title = el('h2', 'portal-panel-title', client.name || client.email);
            title.setAttribute('data-admin-client-title', '');
            top.appendChild(title);
            var chips = el('span', 'admin-chips');
            chips.setAttribute('data-admin-client-chips', '');
            top.appendChild(chips);
            detailBox.appendChild(top);
            renderChips(client, chips);

            var wrap = el('div', 'admin-client-tabs');
            wrap.setAttribute('data-tabs', '');
            var list = el('div', 'portal-tabs portal-tabs--sub');
            list.setAttribute('role', 'tablist');
            list.setAttribute('aria-label', 'Client sections');
            DETAIL_TABS.forEach(function (def) {
                var tab = el('button', null, def.label);
                tab.type = 'button';
                tab.setAttribute('role', 'tab');
                tab.setAttribute('data-tab', def.key);
                list.appendChild(tab);
            });
            wrap.appendChild(list);

            var holders = {};
            DETAIL_TABS.forEach(function (def) {
                var holder = el('section', 'admin-panel');
                holder.setAttribute('data-tab-panel', def.key);
                holder.hidden = true;
                wrap.appendChild(holder);
                holders[def.key] = holder;
            });
            detailBox.appendChild(wrap);

            var ctx = {
                db: db,
                alive: function () { return !gone; },
                changed: function () { refreshChrome(); },
                openTab: function (name) { if (detailTabs) detailTabs.select(name); }
            };

            renderOverview(holders.overview, client);
            contractForm(holders.contract, client, null);
            renderPanel('projects', holders.projects, client, ctx);
            renderPanel('files', holders.files, client, ctx);
            renderNotes(holders.notes, client);

            detailTabs = UI.tabs(wrap, { initial: state.tab, onSelect: function (name) { state.tab = name; } });
        }

        function renderPanel(name, holder, client, ctx) {
            var panel = panels[name];
            if (!panel) {
                holder.appendChild(el('p', 'portal-muted', 'This section failed to load. Refresh the page.'));
                return;
            }
            panel.render(holder, client, ctx);
        }

        function renderChips(client, chips) {
            clear(chips);
            var cs = UI.pick(UI.CONTRACT_STATUS, client.contract_status);
            chips.appendChild(UI.chip(cs.tone, cs.label));
            if (client.disabled) chips.appendChild(UI.chip('danger', 'Disabled'));
            if (client.it_support) chips.appendChild(UI.chip('accent', 'IT support'));
        }

        // After any change: refresh the list row, the header, and the overview. Other tabs keep their own state.
        function refreshChrome() {
            if (gone) return;
            var client = selected();
            renderList();
            if (!client) return;
            var title = detailBox.querySelector('[data-admin-client-title]');
            var chips = detailBox.querySelector('[data-admin-client-chips]');
            if (title) title.textContent = client.name || client.email;
            if (chips) renderChips(client, chips);
            var overview = detailBox.querySelector('[data-tab-panel="overview"]');
            if (overview) renderOverview(clear(overview), client);
        }

        /* ── overview ────────────────────────────────────────────── */

        function renderOverview(container, client) {
            var facts = el('dl', 'portal-kv');
            function row(label, value) {
                var line = el('div');
                line.appendChild(el('dt', null, label));
                var dd = el('dd');
                dd.textContent = value || 'Not set';
                dd.classList.toggle('portal-muted', !value);
                line.appendChild(dd);
                facts.appendChild(line);
            }
            row('Email', client.email);
            row('Plan', client.plan);
            row('Agreed price', UI.money(client.agreed_price));
            row('Start date', UI.formatDate(client.start_date));
            row('Meeting link', client.meeting_url);
            container.appendChild(facts);

            container.appendChild(el('h3', 'admin-h', 'Projects'));
            var projects = client.projects || [];
            if (!projects.length) {
                container.appendChild(el('p', 'portal-muted', 'No projects yet.'));
            } else {
                projects.forEach(function (project) {
                    var status = UI.pick(UI.PROJECT_STATUS, project.status);
                    var line = el('div', 'admin-overview-project');
                    var name = el('span', 'portal-grow');
                    name.appendChild(el('strong', 'portal-strong', project.name || 'Untitled project'));
                    var phase = UI.currentPhase(project);
                    name.appendChild(el('span', 'portal-muted portal-sub', phase ? 'Now: ' + phase.label : 'All phases complete'));
                    line.appendChild(name);
                    var percent = UI.projectProgress(project);
                    var bar = el('div', 'portal-progress-row admin-overview-bar');
                    bar.appendChild(UI.progressBar(percent, 'Progress for ' + (project.name || 'project')));
                    bar.appendChild(el('span', 'portal-progress-num', percent + '%'));
                    line.appendChild(bar);
                    line.appendChild(UI.chip(status.tone, status.label));
                    container.appendChild(line);
                });
            }

            var shared = (client.client_links || []).length + (client.client_files || []).length;
            container.appendChild(el('p', 'portal-muted admin-gap', shared + (shared === 1 ? ' link or file shared' : ' links and files shared') + ' with this client.'));
        }

        /* ── contract and contact ────────────────────────────────── */

        function contractForm(container, client, prefill) {
            var creating = !client;
            var source = client || prefill || {};
            var form = el('form', 'portal-form');
            form.noValidate = true;

            var f = {
                name: UI.field({ label: 'Name', max: 120, value: source.name }),
                email: UI.field({ label: 'Email (they sign in with this)', type: 'email', max: 254, value: source.email }),
                phone: UI.field({ label: 'Phone', type: 'tel', max: 40, value: source.phone }),
                business: UI.field({ label: 'Business / project', max: 160, value: source.business }),
                plan: UI.field({ label: 'Package / plan', max: 120, value: source.plan }),
                contract_status: UI.field({
                    label: 'Contract status', type: 'select', value: source.contract_status || 'draft',
                    options: UI.CONTRACT_STATUS.map(function (s) { return { value: s.value, label: s.label }; })
                }),
                start_date: UI.field({ label: 'Start date', type: 'date', value: source.start_date }),
                agreed_price: UI.field({ label: 'Agreed price (USD)', type: 'number', min: 0, step: '0.01', value: source.agreed_price }),
                billing_terms: UI.field({ label: 'Billing terms', type: 'textarea', rows: 3, max: 1000, value: source.billing_terms }),
                contract_url: UI.field({ label: 'Contract document link', type: 'url', max: 2000, placeholder: 'https://', value: source.contract_url }),
                meeting_url: UI.field({ label: 'Meeting link', type: 'url', max: 2000, placeholder: 'https://', value: source.meeting_url }),
                it_support: UI.field({ label: 'Show IT support to this client', type: 'checkbox', value: source.it_support }),
                disabled: UI.field({ label: 'Disabled (the client sees nothing and cannot sign in to data)', type: 'checkbox', value: source.disabled })
            };

            var grid = el('div', 'portal-form-grid');
            ['name', 'email', 'phone', 'business', 'plan', 'contract_status', 'start_date', 'agreed_price'].forEach(function (key) { grid.appendChild(f[key].wrap); });
            form.appendChild(grid);
            form.appendChild(f.billing_terms.wrap);
            var links = el('div', 'portal-form-grid');
            links.appendChild(f.contract_url.wrap);
            links.appendChild(f.meeting_url.wrap);
            form.appendChild(links);
            var checks = el('div', 'portal-checks');
            checks.appendChild(f.it_support.wrap);
            if (!creating) checks.appendChild(f.disabled.wrap);
            form.appendChild(checks);

            var row = el('div', 'portal-row portal-row--end');
            var state_ = el('span', 'portal-result');
            var result = UI.status(state_);
            var save = el('button', 'ds-btn ds-btn--primary', creating ? 'Create client' : 'Save changes');
            save.type = 'submit';
            row.appendChild(state_);
            row.appendChild(save);
            form.appendChild(row);
            container.appendChild(form);

            function problem() {
                if (!f.name.get().trim()) { f.name.input.focus(); return 'Enter a name.'; }
                var email = f.email.get().trim().toLowerCase();
                if (!UI.isEmail(email)) { f.email.input.focus(); return 'Enter a valid email address.'; }
                var price = f.agreed_price.get();
                if (price !== '' && !(Number(price) >= 0)) { f.agreed_price.input.focus(); return 'The price must be zero or more.'; }
                var bad = ['contract_url', 'meeting_url'].filter(function (key) {
                    var value = f[key].get().trim();
                    return value && !UI.safeUrl(value);
                })[0];
                if (bad) { f[bad].input.focus(); return 'Links must start with https://'; }
                return '';
            }

            form.addEventListener('submit', function (event) {
                event.preventDefault();
                var message = problem();
                if (message) return result.failed(message);

                var payload = {
                    name: f.name.get().trim(),
                    email: f.email.get().trim().toLowerCase(),
                    phone: toNull(f.phone.get()),
                    business: toNull(f.business.get()),
                    plan: toNull(f.plan.get()),
                    contract_status: f.contract_status.get(),
                    start_date: toNull(f.start_date.get()),
                    agreed_price: f.agreed_price.get() === '' ? null : Number(f.agreed_price.get()),
                    billing_terms: toNull(f.billing_terms.get()),
                    contract_url: toNull(f.contract_url.get()),
                    meeting_url: toNull(f.meeting_url.get()),
                    it_support: !!f.it_support.get(),
                    disabled: creating ? false : !!f.disabled.get()
                };

                save.disabled = true;
                result.saving();
                var request = creating
                    ? db().from('clients').insert(payload).select(CLIENT_COLUMNS)
                    : db().from('clients').update(payload).eq('id', client.id).select(CLIENT_COLUMNS);
                request.then(function (response) {
                    if (gone) return;
                    if (response.error) {
                        var duplicate = response.error.code === '23505';
                        return result.failed(duplicate ? 'A client with that email already exists.' : 'Not saved. Check the details and try again.');
                    }
                    if (!response.data || !response.data.length) return result.failed('Not saved (no permission).');
                    var row_ = response.data[0];
                    if (creating) {
                        row_.projects = [];
                        row_.client_links = [];
                        row_.client_files = [];
                        state.clients.push(row_);
                        sortClients();
                        state.tab = 'projects';
                        openClient(row_.id);
                    } else {
                        Object.assign(client, row_);
                        result.saved();
                        refreshChrome();
                    }
                }).catch(function () {
                    if (!gone) result.failed(FAILED);
                }).then(function () { save.disabled = false; });
            });

            if (creating) return;

            // What the client entered themselves (read-only here; the admin can clear it)
            container.appendChild(el('h3', 'admin-h admin-h--spaced', 'Additional contact (entered by the client)'));
            var extraBox = el('div');
            container.appendChild(extraBox);
            function renderExtra() {
                clear(extraBox);
                var value = client.extra_contact;
                if (!value || !Object.keys(value).length) {
                    extraBox.appendChild(el('p', 'portal-muted', 'None entered.'));
                    return;
                }
                var dl = el('dl', 'portal-kv');
                [['Name', 'name'], ['Email', 'email'], ['Phone', 'phone'], ['Role or note', 'note']].forEach(function (pair) {
                    if (!value[pair[1]]) return;
                    var line = el('div');
                    line.appendChild(el('dt', null, pair[0]));
                    line.appendChild(el('dd', null, value[pair[1]]));
                    dl.appendChild(line);
                });
                extraBox.appendChild(dl);
                var actions = el('div', 'portal-row portal-row--end');
                var s = el('span', 'portal-result');
                var r = UI.status(s);
                var clearButton = el('button', 'ds-btn ds-btn--sm', 'Clear it');
                clearButton.type = 'button';
                clearButton.addEventListener('click', function () {
                    clearButton.disabled = true;
                    r.saving();
                    db().from('clients').update({ extra_contact: null }).eq('id', client.id).select('id').then(function (response) {
                        if (gone) return;
                        if (response.error || !response.data || !response.data.length) return r.failed('Not cleared');
                        client.extra_contact = null;
                        renderExtra();
                    }).catch(function () { if (!gone) r.failed(FAILED); }).then(function () { clearButton.disabled = false; });
                });
                actions.appendChild(s);
                actions.appendChild(clearButton);
                extraBox.appendChild(actions);
            }
            renderExtra();

            container.appendChild(el('h3', 'admin-h admin-h--spaced', 'Danger zone'));
            container.appendChild(el('p', 'portal-note', 'Deleting a client also deletes their projects, milestones, links and uploaded files. To keep the record but cut off access, use Disabled above instead.'));
            var dangerRow = el('div', 'portal-row portal-row--start');
            var del = el('button', 'ds-btn ds-btn--sm ds-btn--danger', 'Delete client');
            del.type = 'button';
            var delState = el('span', 'portal-result');
            var delResult = UI.status(delState);
            UI.confirmButton(del, 'Click again to delete everything', function () {
                del.disabled = true;
                delResult.saving();
                var paths = (client.client_files || []).map(function (file) { return file.storage_path; });
                var cleanup = paths.length ? db().storage.from('client-files').remove(paths) : Promise.resolve({ error: null });
                Promise.resolve(cleanup).then(function (removed) {
                    if (removed && removed.error) throw removed.error;
                    return db().from('clients').delete().eq('id', client.id).select('id');
                }).then(function (response) {
                    if (gone) return;
                    if (response.error || !response.data || !response.data.length) {
                        del.disabled = false;
                        return delResult.failed('Not deleted');
                    }
                    state.clients = state.clients.filter(function (c) { return c.id !== client.id; });
                    closeDetail();
                }).catch(function () {
                    if (gone) return;
                    del.disabled = false;
                    delResult.failed('Not deleted. Files may need removing first.');
                });
            });
            dangerRow.appendChild(delState);
            dangerRow.appendChild(del);
            container.appendChild(dangerRow);
        }

        /* ── notes ───────────────────────────────────────────────── */

        function renderNotes(container, client) {
            var mine = ++state.noteToken;
            container.appendChild(el('p', 'portal-muted', 'Loading notes\u2026'));
            db().from('admin_notes')
                .select('id, project_id, body, author_email, created_at')
                .eq('client_id', client.id)
                .order('created_at', { ascending: false })
                .then(function (response) {
                    if (gone || mine !== state.noteToken) return;
                    clear(container);
                    if (response.error) return container.appendChild(el('p', 'portal-muted', 'Could not load notes. Has the admin migration been applied?'));
                    drawNotes(container, client, response.data || []);
                }).catch(function () {
                    if (gone || mine !== state.noteToken) return;
                    clear(container);
                    container.appendChild(el('p', 'portal-muted', FAILED));
                });
        }

        function drawNotes(container, client, notes) {
            clear(container);
            var form = el('form', 'admin-note-form');
            form.noValidate = true;
            var area = el('textarea', 'ds-input');
            area.rows = 3;
            area.maxLength = NOTE_MAX;
            area.placeholder = 'Private note (only you can see this)';
            area.setAttribute('aria-label', 'New note');
            var row = el('div', 'portal-row portal-row--end');
            var scope = el('select', 'ds-input admin-scope');
            scope.setAttribute('aria-label', 'Note applies to');
            var all = el('option', null, 'Whole client');
            all.value = '';
            scope.appendChild(all);
            (client.projects || []).forEach(function (project) {
                var option = el('option', null, project.name || 'Untitled project');
                option.value = project.id;
                scope.appendChild(option);
            });
            var add = el('button', 'ds-btn ds-btn--sm ds-btn--primary', 'Add note');
            add.type = 'submit';
            var stateNode = el('span', 'portal-result');
            var result = UI.status(stateNode);
            row.appendChild(stateNode);
            row.appendChild(scope);
            row.appendChild(add);
            form.appendChild(area);
            form.appendChild(row);
            container.appendChild(form);

            form.addEventListener('submit', function (event) {
                event.preventDefault();
                var body = area.value.trim();
                if (!body) {
                    result.failed('Write something first');
                    area.focus();
                    return;
                }
                add.disabled = true;
                result.saving();
                db().from('admin_notes')
                    .insert({ client_id: client.id, project_id: scope.value || null, body: body })
                    .select('id, project_id, body, author_email, created_at')
                    .then(function (response) {
                        if (gone) return;
                        if (response.error || !response.data || !response.data.length) {
                            result.failed('Not saved');
                            add.disabled = false;
                            return;
                        }
                        notes.unshift(response.data[0]);
                        drawNotes(container, client, notes);
                    }).catch(function () {
                        if (gone) return;
                        result.failed('Not saved');
                        add.disabled = false;
                    });
            });

            var list = el('div', 'admin-note-list');
            if (!notes.length) list.appendChild(el('p', 'portal-muted', 'No notes yet.'));
            notes.forEach(function (note) {
                var item = el('article', 'portal-card admin-note');
                item.appendChild(el('p', 'portal-card-text admin-note-body', note.body));
                var foot = el('div', 'portal-card-foot');
                var project = (client.projects || []).filter(function (p) { return p.id === note.project_id; })[0];
                var meta = [UI.formatDate(note.created_at, true)];
                if (project) meta.push(project.name || 'Untitled project');
                if (note.author_email) meta.push(note.author_email);
                foot.appendChild(el('span', 'portal-card-muted', meta.join(' \u00b7 ')));
                var remove = el('button', 'portal-link', 'Delete');
                remove.type = 'button';
                remove.addEventListener('click', function () {
                    if (remove.disabled) return;
                    remove.disabled = true;
                    db().from('admin_notes').delete().eq('id', note.id).select('id').then(function (response) {
                        if (gone) return;
                        if (response.error || !response.data || !response.data.length) {
                            remove.disabled = false;
                            remove.textContent = 'Could not delete';
                            return;
                        }
                        notes.splice(notes.indexOf(note), 1);
                        drawNotes(container, client, notes);
                    }).catch(function () {
                        if (!gone) { remove.disabled = false; remove.textContent = 'Could not delete'; }
                    });
                });
                foot.appendChild(remove);
                item.appendChild(foot);
                list.appendChild(item);
            });
            container.appendChild(list);
        }

        /* ── submissions ─────────────────────────────────────────── */

        function renderSubmissions(rows) {
            setHint('submissions', rows.length ? 'latest ' + rows.length : '');
            if (!rows.length) return empty(submissionsBox, 'No submissions yet.');
            clear(submissionsBox);
            var grid = el('div', 'admin-subs');
            rows.forEach(function (row) {
                var card = el('article', 'portal-card');
                var top = el('div', 'admin-sub-top');
                top.appendChild(UI.chip(row.kind === 'package' ? 'accent' : '', row.kind === 'package' ? 'Package' : 'Contact'));
                if (row.type) top.appendChild(el('span', 'portal-muted', row.type));
                top.appendChild(el('span', 'portal-muted admin-when', UI.formatDate(row.created_at, true)));
                card.appendChild(top);
                card.appendChild(el('h3', 'portal-card-title', row.name || row.email || 'Anonymous'));
                var who = [row.email, row.phone].filter(Boolean).join(' \u00b7 ');
                if (who) card.appendChild(el('p', 'portal-card-muted', who));
                if (row.message) card.appendChild(el('p', 'portal-card-text admin-note-body', row.message));

                var email = String(row.email || '').trim().toLowerCase();
                var existing = state.clients.filter(function (c) { return c.email === email; })[0];
                var foot = el('div', 'portal-card-foot');
                var action = el('button', 'portal-link', existing ? 'Open client' : 'Create client');
                action.type = 'button';
                action.addEventListener('click', function () {
                    if (topTabs) topTabs.select('clients');
                    if (existing) openClient(existing.id);
                    else openNew({ name: row.name || '', email: email, phone: row.phone || '' });
                });
                foot.appendChild(el('span'));
                foot.appendChild(action);
                card.appendChild(foot);
                grid.appendChild(card);
            });
            submissionsBox.appendChild(grid);
        }

        /* ── loading ─────────────────────────────────────────────── */

        function load() {
            show('loading');
            db().auth.getSession().then(function (result) {
                if (gone) return null;
                var session = result.data && result.data.session;
                if (!session) {
                    window.location.replace(SIGNIN_PAGE);
                    return null;
                }
                if (window.SiteShell) window.SiteShell.refreshAccount();
                if (portal.roleOf(session) !== 'admin') {
                    show('denied');
                    return null;
                }
                return Promise.all([
                    db().from('clients').select(CLIENT_SELECT).order('name', { ascending: true }),
                    db().from('submissions')
                        .select('id, kind, name, email, phone, type, message, status, created_at')
                        .order('created_at', { ascending: false })
                        .limit(SUBMISSION_LIMIT)
                ]);
            }).then(function (results) {
                if (gone || !results) return;
                var clientsResult = results[0];
                var submissionsResult = results[1];
                if (clientsResult.error) {
                    if (clientsResult.status === 401) return portal.expire();
                    return show('error');
                }
                state.clients = clientsResult.data || [];
                state.clients.forEach(function (client) {
                    client.projects = (client.projects || []).sort(function (a, b) { return String(b.updated_at).localeCompare(String(a.updated_at)); });
                    client.client_links = client.client_links || [];
                    client.client_files = client.client_files || [];
                });
                sortClients();
                renderList();
                renderDetail();
                if (submissionsResult.error) empty(submissionsBox, 'Could not load submissions. Has the admin migration been applied?');
                else renderSubmissions(submissionsResult.data || []);
                show('content');
                if (!topTabs) {
                    topTabs = UI.tabs(topRoot, {
                        hash: true,
                        onSelect: function (name) { windowTitle.textContent = 'doxxus@admin \u2014 ~/' + name; }
                    });
                }
                handleNewHash();
            }).catch(function () { if (!gone) show('error'); });
        }

        // #new (from the navbar menu) opens the new-client form.
        function handleNewHash() {
            if (window.location.hash !== '#new' || !topTabs) return;
            topTabs.select('clients');
            openNew(null);
        }

        listen(window, 'hashchange', handleNewHash);
        listen(search, 'input', renderList);
        listen(filter, 'change', renderList);
        listen(root.querySelector('[data-admin-new]'), 'click', function () { openNew(null); });
        listen(root.querySelector('[data-admin-retry]'), 'click', load);

        root.querySelectorAll('[data-admin-signout]').forEach(function (button) {
            listen(button, 'click', function () {
                if (button.disabled) return;
                button.disabled = true;
                portal.signOut().catch(function () { button.disabled = false; });
            });
        });

        load();
    }

    function init(scope) {
        scope = scope || document;
        var node = scope.matches && scope.matches('[data-portal="admin"]') ? scope : scope.querySelector('[data-portal="admin"]');
        if (!node || node.dataset.adminBound) return;
        node.dataset.adminBound = '1';
        mount(node);
    }

    function destroy() {
        cleanups.forEach(function (fn) { fn(); });
        cleanups = [];
    }

    window.DoxxusAdmin = { init: init, destroy: destroy };
    init(document);
}());

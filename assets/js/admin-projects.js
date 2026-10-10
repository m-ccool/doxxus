/*
 * Admin hub, Projects tab (loaded before admin.js, registers on window.DoxxusAdminPanels).
 *
 * Per client: create, edit and delete projects; set the state of the five fixed phases (Discovery, Design, Build,
 * Review, Launch); add, rename, re-date, reorder and delete the custom milestones under each phase. Every control
 * saves as soon as it changes and shows the result next to it; nothing is assumed saved until the database says so.
 *
 * A new project gets its five phase rows from a database trigger; if that returned nothing (migration not applied
 * yet) the panel says so instead of showing a broken outline.
 */
(function () {
    'use strict';

    var UI = window.DoxxusUI;
    var el = UI.el;
    var clear = UI.clear;
    var FAILED = 'Could not reach the server. Nothing was changed. Try again.';

    var PROJECT_COLUMNS = 'id, name, description, status, live_url, created_at, updated_at';
    var MILESTONE_COLUMNS = 'id, phase, title, state, due_date, position, created_at';

    function stateOptions() {
        return UI.STATES.map(function (s) { return { value: s.value, label: s.label }; });
    }

    function nullable(value) {
        var text = String(value == null ? '' : value).trim();
        return text === '' ? null : text;
    }

    function render(container, client, ctx) {
        var list = el('div', 'admin-projects');

        /* ── header and the new-project form ─────────────────────── */

        var head = el('div', 'portal-panel-head');
        head.appendChild(el('h3', 'admin-h', 'Projects'));
        var addButton = el('button', 'ds-btn ds-btn--sm', 'New project');
        addButton.type = 'button';
        head.appendChild(addButton);
        container.appendChild(head);

        var createBox = el('div', 'admin-create');
        createBox.hidden = true;
        container.appendChild(createBox);
        container.appendChild(list);

        addButton.addEventListener('click', function () {
            createBox.hidden = !createBox.hidden;
            if (!createBox.hidden) {
                clear(createBox);
                createBox.appendChild(newProjectForm());
            }
        });

        function newProjectForm() {
            var form = el('form', 'portal-form');
            form.noValidate = true;
            var name = UI.field({ label: 'Project name', max: 160 });
            var description = UI.field({ label: 'Description (the client sees this)', type: 'textarea', rows: 2, max: 1000 });
            var status = UI.field({ label: 'Status', type: 'select', value: 'not_started', options: UI.PROJECT_STATUS.map(function (s) { return { value: s.value, label: s.label }; }) });
            var live = UI.field({ label: 'Live URL', type: 'url', max: 2000, placeholder: 'https://' });
            var grid = el('div', 'portal-form-grid');
            grid.appendChild(name.wrap);
            grid.appendChild(status.wrap);
            form.appendChild(grid);
            form.appendChild(description.wrap);
            form.appendChild(live.wrap);
            form.appendChild(el('p', 'portal-note', 'A project stays hidden from the client while its status is "Not started".'));
            var row = el('div', 'portal-row portal-row--end');
            var stateNode = el('span');
            var result = UI.status(stateNode);
            var create = el('button', 'ds-btn ds-btn--sm ds-btn--primary', 'Create project');
            create.type = 'submit';
            row.appendChild(stateNode);
            row.appendChild(create);
            form.appendChild(row);

            form.addEventListener('submit', function (event) {
                event.preventDefault();
                var title = name.get().trim();
                if (!title) { name.input.focus(); return result.failed('Enter a project name.'); }
                var url = nullable(live.get());
                if (url && !UI.safeUrl(url)) { live.input.focus(); return result.failed('The live URL must start with https://'); }
                create.disabled = true;
                result.saving();
                ctx.db().from('projects')
                    .insert({ client_id: client.id, name: title, description: nullable(description.get()), status: status.get(), live_url: url })
                    .select(PROJECT_COLUMNS)
                    .then(function (response) {
                        if (!ctx.alive()) return null;
                        if (response.error || !response.data || !response.data.length) { result.failed('Not created.'); return null; }
                        var project = response.data[0];
                        project.project_phases = [];
                        project.project_milestones = [];
                        return loadPhases(project).then(function () {
                            client.projects.unshift(project);
                            createBox.hidden = true;
                            clear(createBox);
                            draw(project.id);
                            ctx.changed();
                        });
                    }).catch(function () {
                        if (ctx.alive()) result.failed(FAILED);
                    }).then(function () { create.disabled = false; });
            });
            return form;
        }

        // The five phase rows come from a trigger. If none came back, try to create them; if that fails too, say so.
        function loadPhases(project) {
            return ctx.db().from('project_phases').select('phase, state').eq('project_id', project.id).then(function (response) {
                if (!response.error && response.data && response.data.length) {
                    project.project_phases = response.data;
                    return null;
                }
                var rows = UI.PHASES.map(function (p) { return { project_id: project.id, phase: p.key, state: 'todo' }; });
                return ctx.db().from('project_phases').upsert(rows, { onConflict: 'project_id,phase' }).select('phase, state').then(function (again) {
                    project.project_phases = !again.error && again.data ? again.data : [];
                });
            });
        }

        /* ── one project ─────────────────────────────────────────── */

        function projectCard(project, open) {
            var card = el('details', 'admin-project-card');
            card.open = !!open;
            var summary = el('summary', 'admin-project-summary');
            var title = el('strong', 'portal-strong', project.name || 'Untitled project');
            summary.appendChild(title);
            var chipBox = el('span', 'admin-chips');
            var barBox = el('span', 'admin-summary-bar');
            summary.appendChild(barBox);
            summary.appendChild(chipBox);
            card.appendChild(summary);

            function refreshSummary() {
                title.textContent = project.name || 'Untitled project';
                clear(chipBox);
                var s = UI.pick(UI.PROJECT_STATUS, project.status);
                chipBox.appendChild(UI.chip(s.tone, s.label));
                clear(barBox);
                var percent = UI.projectProgress(project);
                var row = el('span', 'portal-progress-row');
                row.appendChild(UI.progressBar(percent, 'Progress for ' + (project.name || 'project')));
                row.appendChild(el('span', 'portal-progress-num', percent + '%'));
                barBox.appendChild(row);
            }
            refreshSummary();

            var body = el('div', 'admin-project-body');
            body.appendChild(detailsForm(project, refreshSummary));
            body.appendChild(el('h4', 'admin-h admin-h--sub', 'Outline'));
            body.appendChild(phaseEditor(project, refreshSummary));
            card.appendChild(body);
            return card;
        }

        function detailsForm(project, refreshSummary) {
            var form = el('form', 'portal-form');
            form.noValidate = true;
            var name = UI.field({ label: 'Name', max: 160, value: project.name });
            var status = UI.field({ label: 'Status', type: 'select', value: project.status, options: UI.PROJECT_STATUS.map(function (s) { return { value: s.value, label: s.label }; }) });
            var description = UI.field({ label: 'Description (the client sees this)', type: 'textarea', rows: 2, max: 1000, value: project.description });
            var live = UI.field({ label: 'Live URL', type: 'url', max: 2000, placeholder: 'https://', value: project.live_url });
            var grid = el('div', 'portal-form-grid');
            grid.appendChild(name.wrap);
            grid.appendChild(status.wrap);
            form.appendChild(grid);
            form.appendChild(description.wrap);
            form.appendChild(live.wrap);

            var row = el('div', 'portal-row portal-row--end');
            var stateNode = el('span');
            var result = UI.status(stateNode);
            var del = el('button', 'ds-btn ds-btn--sm ds-btn--danger', 'Delete project');
            del.type = 'button';
            var save = el('button', 'ds-btn ds-btn--sm ds-btn--primary', 'Save project');
            save.type = 'submit';
            row.appendChild(stateNode);
            row.appendChild(del);
            row.appendChild(save);
            form.appendChild(row);

            form.addEventListener('submit', function (event) {
                event.preventDefault();
                var title = name.get().trim();
                if (!title) { name.input.focus(); return result.failed('Enter a project name.'); }
                var url = nullable(live.get());
                if (url && !UI.safeUrl(url)) { live.input.focus(); return result.failed('The live URL must start with https://'); }
                save.disabled = true;
                result.saving();
                ctx.db().from('projects')
                    .update({ name: title, description: nullable(description.get()), status: status.get(), live_url: url })
                    .eq('id', project.id).select(PROJECT_COLUMNS)
                    .then(function (response) {
                        if (!ctx.alive()) return;
                        if (response.error || !response.data || !response.data.length) return result.failed('Not saved.');
                        Object.assign(project, response.data[0]);
                        result.saved();
                        refreshSummary();
                        ctx.changed();
                    }).catch(function () {
                        if (ctx.alive()) result.failed(FAILED);
                    }).then(function () { save.disabled = false; });
            });

            UI.confirmButton(del, 'Click again to delete', function () {
                del.disabled = true;
                result.saving();
                ctx.db().from('projects').delete().eq('id', project.id).select('id').then(function (response) {
                    if (!ctx.alive()) return;
                    if (response.error || !response.data || !response.data.length) {
                        del.disabled = false;
                        return result.failed('Not deleted.');
                    }
                    client.projects = client.projects.filter(function (p) { return p.id !== project.id; });
                    // Links and files that pointed at this project stay, as "General" (the database sets project_id to null).
                    [].concat(client.client_links || [], client.client_files || []).forEach(function (item) {
                        if (item.project_id === project.id) item.project_id = null;
                    });
                    draw();
                    ctx.changed();
                }).catch(function () {
                    if (!ctx.alive()) return;
                    del.disabled = false;
                    result.failed(FAILED);
                });
            });
            return form;
        }

        /* ── phases and milestones ───────────────────────────────── */

        function phaseEditor(project, refreshSummary) {
            var phases = UI.orderedPhases(project);
            if (!(project.project_phases || []).length) {
                var warn = el('div', 'ds-callout ds-callout--attention');
                warn.appendChild(el('span', null, 'This project has no phases yet. Apply the portal v2 migration (it creates them), then reload.'));
                return warn;
            }

            var outline = el('ol', 'portal-phases admin-phases');
            phases.forEach(function (phase) { outline.appendChild(phaseRow(project, phase, refreshSummary)); });
            return outline;
        }

        function phaseRow(project, phase, refreshSummary) {
            var item = el('li', 'portal-phase admin-phase');
            var line = el('div', 'portal-phase-line');
            line.appendChild(el('strong', 'portal-phase-name', phase.label));
            var select = UI.field({ label: phase.label + ' state', type: 'select', value: phase.state, options: stateOptions() });
            select.wrap.classList.add('admin-inline-field');
            var stateNode = el('span');
            var result = UI.status(stateNode);
            line.appendChild(stateNode);
            line.appendChild(select.wrap);
            item.appendChild(line);

            select.input.addEventListener('change', function () {
                var next = select.get();
                var previous = phase.state;
                select.input.disabled = true;
                result.saving();
                ctx.db().from('project_phases').update({ state: next }).eq('project_id', project.id).eq('phase', phase.phase).select('phase, state').then(function (response) {
                    if (!ctx.alive()) return;
                    if (response.error || !response.data || !response.data.length) {
                        select.set(previous);
                        return result.failed('Not saved');
                    }
                    phase.state = response.data[0].state;
                    var row = (project.project_phases || []).filter(function (r) { return r.phase === phase.phase; })[0];
                    if (row) row.state = phase.state;
                    result.saved();
                    refreshSummary();
                    ctx.changed();
                }).catch(function () {
                    if (!ctx.alive()) return;
                    select.set(previous);
                    result.failed(FAILED);
                }).then(function () { select.input.disabled = false; });
            });

            var milestoneBox = el('div', 'admin-milestones');
            item.appendChild(milestoneBox);
            drawMilestones(project, phase, milestoneBox, refreshSummary);
            return item;
        }

        function drawMilestones(project, phase, box, refreshSummary) {
            clear(box);
            var items = UI.milestonesFor(project, phase.phase);
            var ul = el('ul', 'portal-milestones admin-milestone-list');
            items.forEach(function (m, index) {
                ul.appendChild(milestoneRow(project, phase, m, index, items, box, refreshSummary));
            });
            box.appendChild(ul);
            box.appendChild(addMilestoneRow(project, phase, box, refreshSummary));
        }

        function milestoneRow(project, phase, m, index, items, box, refreshSummary) {
            var li = el('li', 'admin-milestone');
            var title = UI.field({ label: 'Milestone title', max: 160, value: m.title });
            var state = UI.field({ label: 'State', type: 'select', value: m.state, options: stateOptions() });
            var due = UI.field({ label: 'Due date', type: 'date', value: m.due_date });
            [title, state, due].forEach(function (f) { f.wrap.classList.add('admin-inline-field'); });
            var stateNode = el('span');
            var result = UI.status(stateNode);

            function patch(values, revert) {
                result.saving();
                ctx.db().from('project_milestones').update(values).eq('id', m.id).select(MILESTONE_COLUMNS).then(function (response) {
                    if (!ctx.alive()) return;
                    if (response.error || !response.data || !response.data.length) {
                        revert();
                        return result.failed('Not saved');
                    }
                    Object.assign(m, response.data[0]);
                    result.saved();
                    refreshSummary();
                    ctx.changed();
                }).catch(function () {
                    if (!ctx.alive()) return;
                    revert();
                    result.failed(FAILED);
                });
            }

            title.input.addEventListener('change', function () {
                var text = title.get().trim();
                if (!text) { title.set(m.title); return result.failed('A milestone needs a title'); }
                patch({ title: text }, function () { title.set(m.title); });
            });
            state.input.addEventListener('change', function () {
                patch({ state: state.get() }, function () { state.set(m.state); });
            });
            due.input.addEventListener('change', function () {
                patch({ due_date: nullable(due.get()) }, function () { due.set(m.due_date); });
            });

            var up = el('button', 'portal-icon-button', '\u25B2');
            up.type = 'button';
            up.setAttribute('aria-label', 'Move up');
            up.disabled = index === 0;
            var down = el('button', 'portal-icon-button', '\u25BC');
            down.type = 'button';
            down.setAttribute('aria-label', 'Move down');
            down.disabled = index === items.length - 1;
            var del = el('button', 'portal-icon-button portal-icon-button--danger', '\u2715');
            del.type = 'button';
            del.setAttribute('aria-label', 'Delete milestone');

            function swap(other) {
                up.disabled = down.disabled = true;
                result.saving();
                var a = m.position;
                var b = other.position;
                // Equal positions cannot be swapped, so nudge them apart first.
                if (a === b) b = a + (other === items[index - 1] ? -1 : 1);
                Promise.all([
                    ctx.db().from('project_milestones').update({ position: b }).eq('id', m.id).select('id, position'),
                    ctx.db().from('project_milestones').update({ position: a }).eq('id', other.id).select('id, position')
                ]).then(function (responses) {
                    if (!ctx.alive()) return;
                    var bad = responses.some(function (r) { return r.error || !r.data || !r.data.length; });
                    if (bad) {
                        drawMilestones(project, phase, box, refreshSummary);
                        return;
                    }
                    m.position = b;
                    other.position = a;
                    drawMilestones(project, phase, box, refreshSummary);
                }).catch(function () {
                    if (ctx.alive()) { up.disabled = down.disabled = false; result.failed(FAILED); }
                });
            }
            up.addEventListener('click', function () { if (index > 0) swap(items[index - 1]); });
            down.addEventListener('click', function () { if (index < items.length - 1) swap(items[index + 1]); });

            UI.confirmButton(del, 'Sure?', function () {
                del.disabled = true;
                result.saving();
                ctx.db().from('project_milestones').delete().eq('id', m.id).select('id').then(function (response) {
                    if (!ctx.alive()) return;
                    if (response.error || !response.data || !response.data.length) {
                        del.disabled = false;
                        return result.failed('Not deleted');
                    }
                    project.project_milestones = project.project_milestones.filter(function (x) { return x.id !== m.id; });
                    drawMilestones(project, phase, box, refreshSummary);
                    refreshSummary();
                    ctx.changed();
                }).catch(function () {
                    if (!ctx.alive()) return;
                    del.disabled = false;
                    result.failed(FAILED);
                });
            });

            var controls = el('span', 'admin-milestone-controls');
            controls.appendChild(up);
            controls.appendChild(down);
            controls.appendChild(del);
            li.appendChild(title.wrap);
            li.appendChild(state.wrap);
            li.appendChild(due.wrap);
            li.appendChild(controls);
            li.appendChild(stateNode);
            return li;
        }

        function addMilestoneRow(project, phase, box, refreshSummary) {
            var form = el('form', 'admin-milestone-add');
            form.noValidate = true;
            var title = UI.field({ label: 'Add a milestone to ' + phase.label, max: 160, placeholder: 'e.g. Homepage wireframes' });
            title.wrap.classList.add('admin-inline-field', 'admin-grow');
            var add = el('button', 'ds-btn ds-btn--sm', 'Add');
            add.type = 'submit';
            var stateNode = el('span');
            var result = UI.status(stateNode);
            form.appendChild(title.wrap);
            form.appendChild(add);
            form.appendChild(stateNode);

            form.addEventListener('submit', function (event) {
                event.preventDefault();
                var text = title.get().trim();
                if (!text) { title.input.focus(); return result.failed('Enter a title'); }
                var existing = UI.milestonesFor(project, phase.phase);
                var position = existing.length ? Math.max.apply(null, existing.map(function (x) { return x.position || 0; })) + 1 : 0;
                add.disabled = true;
                result.saving();
                ctx.db().from('project_milestones')
                    .insert({ project_id: project.id, phase: phase.phase, title: text, state: 'todo', position: position })
                    .select(MILESTONE_COLUMNS)
                    .then(function (response) {
                        if (!ctx.alive()) return;
                        if (response.error || !response.data || !response.data.length) return result.failed('Not added');
                        project.project_milestones = (project.project_milestones || []).concat(response.data[0]);
                        drawMilestones(project, phase, box, refreshSummary);
                        refreshSummary();
                        ctx.changed();
                    }).catch(function () {
                        if (ctx.alive()) result.failed(FAILED);
                    }).then(function () { add.disabled = false; });
            });
            return form;
        }

        /* ── the list ────────────────────────────────────────────── */

        function draw(openId) {
            clear(list);
            if (!client.projects.length) {
                var box = el('div', 'portal-empty');
                box.appendChild(el('p', null, 'No projects yet. Use New project to add the first one.'));
                list.appendChild(box);
                return;
            }
            client.projects.forEach(function (project) { list.appendChild(projectCard(project, project.id === openId)); });
        }

        draw();
    }

    window.DoxxusAdminPanels = window.DoxxusAdminPanels || {};
    window.DoxxusAdminPanels.projects = { render: render };
}());

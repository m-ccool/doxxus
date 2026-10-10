/*
 * portal-ui.js — small helpers shared by the sign-in page, the client dashboard (account.js) and the admin hub
 * (admin*.js): DOM building, formatting, the phase/progress model, tabs, inline save messages and two-step confirms.
 *
 * Everything that puts text on the page goes through el()/textContent, never innerHTML.
 */
(function () {
    'use strict';

    var PHASES = [
        { key: 'discovery', label: 'Discovery' },
        { key: 'design', label: 'Design' },
        { key: 'build', label: 'Build' },
        { key: 'review', label: 'Review' },
        { key: 'launch', label: 'Launch' }
    ];

    var STATES = [
        { value: 'todo', label: 'To do', mark: '\u25CB' },
        { value: 'in_progress', label: 'In progress', mark: '\u25D0' },
        { value: 'done', label: 'Done', mark: '\u2713' }
    ];

    var PROJECT_STATUS = [
        { value: 'not_started', label: 'Not started', tone: '', mark: '\u25CB' },
        { value: 'in_progress', label: 'In progress', tone: 'attention', mark: '\u25D0' },
        { value: 'live', label: 'Live', tone: 'success', mark: '\u25CF' },
        { value: 'issue', label: 'Issue', tone: 'danger', mark: '\u2715' }
    ];

    var CONTRACT_STATUS = [
        { value: 'draft', label: 'Draft', tone: '' },
        { value: 'active', label: 'Active', tone: 'success' },
        { value: 'completed', label: 'Completed', tone: 'accent' },
        { value: 'cancelled', label: 'Cancelled', tone: 'danger' }
    ];

    var tabCounter = 0;
    var fieldCounter = 0;

    /* ── dom ─────────────────────────────────────────────────────── */

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function clear(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
        return node;
    }

    function chip(tone, text) {
        return el('span', 'ds-label' + (tone ? ' ds-label--' + tone : ''), text);
    }

    function pick(list, value) {
        for (var i = 0; i < list.length; i++) if (list[i].value === value) return list[i];
        return list[0];
    }

    /* ── formatting and validation ───────────────────────────────── */

    function safeUrl(value) {
        if (typeof value !== 'string' || !value) return '';
        try {
            var url = new URL(value);
            return url.protocol === 'https:' ? url.href : '';
        } catch (error) {
            return '';
        }
    }

    function formatDate(value, withTime) {
        // A bare date (2026-09-01) is a calendar day, not a UTC instant, so it must not shift with the time zone.
        var plain = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        var date = plain ? new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3])) : new Date(value);
        if (!value || isNaN(date.getTime())) return '';
        var options = withTime && !plain ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' };
        return new Intl.DateTimeFormat(undefined, options).format(date);
    }

    function money(value) {
        if (value == null || value === '') return '';
        var number = Number(value);
        if (isNaN(number)) return '';
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(number);
    }

    function fileSize(bytes) {
        var n = Number(bytes);
        if (isNaN(n) || n < 0) return '';
        if (n < 1024) return n + ' B';
        if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
        return (n / 1024 / 1024).toFixed(1) + ' MB';
    }

    function isEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
    }

    /* ── progress model ──────────────────────────────────────────── */

    // Share of one phase that is done (0-1). Milestones decide it when there are any; otherwise the phase's own state.
    function phaseFraction(phase, milestones) {
        if (phase && phase.state === 'done') return 1;
        var mine = (milestones || []).filter(function (m) { return phase && m.phase === phase.phase; });
        if (mine.length) {
            var score = mine.reduce(function (sum, m) { return sum + (m.state === 'done' ? 1 : m.state === 'in_progress' ? 0.5 : 0); }, 0);
            return score / mine.length;
        }
        return phase && phase.state === 'in_progress' ? 0.5 : 0;
    }

    // phases: project_phases rows; always returned in the fixed order, missing ones as "todo".
    function orderedPhases(project) {
        var rows = project.project_phases || [];
        return PHASES.map(function (def) {
            var row = rows.filter(function (r) { return r.phase === def.key; })[0];
            return { phase: def.key, label: def.label, state: row ? row.state : 'todo' };
        });
    }

    function milestonesFor(project, phaseKey) {
        return (project.project_milestones || [])
            .filter(function (m) { return m.phase === phaseKey; })
            .sort(function (a, b) { return (a.position - b.position) || String(a.created_at || '').localeCompare(String(b.created_at || '')); });
    }

    function projectProgress(project) {
        var phases = orderedPhases(project);
        var total = phases.reduce(function (sum, p) { return sum + phaseFraction(p, project.project_milestones); }, 0);
        return Math.round(total / phases.length * 100);
    }

    function currentPhase(project) {
        var phases = orderedPhases(project);
        var active = phases.filter(function (p) { return p.state === 'in_progress'; })[0];
        if (active) return active;
        var next = phases.filter(function (p) { return p.state !== 'done'; })[0];
        return next || null;
    }

    function nextMilestone(project) {
        var open = (project.project_milestones || []).filter(function (m) { return m.state !== 'done'; });
        open.sort(function (a, b) {
            var pa = PHASES.map(function (p) { return p.key; }).indexOf(a.phase);
            var pb = PHASES.map(function (p) { return p.key; }).indexOf(b.phase);
            return (pa - pb) || (a.position - b.position);
        });
        return open[0] || null;
    }

    function progressBar(percent, label) {
        var wrap = el('div', 'portal-progress');
        wrap.setAttribute('role', 'progressbar');
        wrap.setAttribute('aria-valuemin', '0');
        wrap.setAttribute('aria-valuemax', '100');
        wrap.setAttribute('aria-valuenow', String(percent));
        if (label) wrap.setAttribute('aria-label', label);
        var fill = el('span', 'portal-progress-fill');
        fill.style.width = percent + '%';
        wrap.appendChild(fill);
        return wrap;
    }

    /* ── form fields ─────────────────────────────────────────────── */

    // One labelled control. type: text, email, tel, url, date, number, textarea, select, checkbox.
    // Returns { wrap, input, get(), set(value) }; checkboxes read and write booleans.
    function field(def) {
        var id = def.id || 'f-' + (++fieldCounter);
        var checkbox = def.type === 'checkbox';
        var wrap = el('div', 'ds-field' + (checkbox ? ' portal-check-field' : ''));
        var input;
        if (def.type === 'textarea') {
            input = el('textarea', 'ds-input');
            input.rows = def.rows || 3;
        } else if (def.type === 'select') {
            input = el('select', 'ds-input');
            (def.options || []).forEach(function (option) {
                var node = el('option', null, option.label);
                node.value = option.value;
                input.appendChild(node);
            });
        } else {
            input = el('input', checkbox ? 'portal-check' : 'ds-input');
            input.type = def.type || 'text';
        }
        input.id = id;
        input.name = def.name || id;
        if (def.max) input.maxLength = def.max;
        if (def.min != null) input.min = def.min;
        if (def.step) input.step = def.step;
        if (def.placeholder) input.placeholder = def.placeholder;
        if (!checkbox && def.type !== 'select') input.autocomplete = 'off';
        var label = el('label', null, def.label);
        label.setAttribute('for', id);
        if (checkbox) { wrap.appendChild(input); wrap.appendChild(label); }
        else { wrap.appendChild(label); wrap.appendChild(input); }
        if (def.hint) wrap.appendChild(el('span', 'ds-field-hint', def.hint));

        function get() {
            return checkbox ? input.checked : input.value;
        }
        function set(value) {
            if (checkbox) input.checked = !!value;
            else input.value = value == null ? '' : String(value);
        }
        set(def.value);
        return { wrap: wrap, input: input, get: get, set: set };
    }
    /* ── inline save messages ────────────────────────────────────── */

    // A tiny status line: saving... / saved / not saved, in a live region.
    function status(node) {
        node.classList.add('portal-result');
        node.setAttribute('role', 'status');
        var timer = 0;
        function set(kind, text) {
            window.clearTimeout(timer);
            node.className = 'portal-result' + (kind ? ' portal-result--' + kind : '');
            node.textContent = text || '';
        }
        return {
            saving: function () { set('', 'Saving\u2026'); },
            saved: function (text) {
                set('ok', text || 'Saved');
                timer = window.setTimeout(function () { set('', ''); }, 3500);
            },
            failed: function (text) { set('bad', text || 'Not saved'); },
            clear: function () { set('', ''); }
        };
    }

    // Two-step confirm without a dialog: the first click asks, the second (within 4s) does it.
    function confirmButton(button, askLabel, onConfirm) {
        var original = button.textContent;
        var timer = 0;
        function reset() {
            window.clearTimeout(timer);
            button.textContent = original;
            button.classList.remove('is-confirming');
        }
        button.addEventListener('click', function () {
            if (button.classList.contains('is-confirming')) {
                reset();
                onConfirm();
                return;
            }
            button.classList.add('is-confirming');
            button.textContent = askLabel;
            timer = window.setTimeout(reset, 4000);
        });
        button.addEventListener('blur', function () { window.setTimeout(reset, 150); });
    }

    /* ── tabs ────────────────────────────────────────────────────── */

    // Markup: root carries data-tabs and holds a [role=tablist] of buttons [role=tab][data-tab=name], and panels
    // [data-tab-panel=name]. Tab sets can nest: each only controls the tablist and panels whose nearest [data-tabs] is
    // its own root. Roving tabindex, arrow keys / Home / End, optional URL hash sync. aliases maps old hashes
    // (a bookmarked #billing) onto a current tab.
    function tabs(root, options) {
        options = options || {};
        var id = ++tabCounter;
        var list = Array.prototype.filter.call(root.querySelectorAll('[role="tablist"]'), function (node) { return node.closest('[data-tabs]') === root; })[0];
        var buttons = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
        var panels = {};
        var current = '';
        var aliases = options.aliases || {};

        root.querySelectorAll('[data-tab-panel]').forEach(function (panel) {
            if (panel.closest('[data-tabs]') !== root) return;
            panels[panel.getAttribute('data-tab-panel')] = panel;
        });

        buttons.forEach(function (button) {
            var name = button.getAttribute('data-tab');
            button.id = 'ui-tab-' + id + '-' + name;
            var panel = panels[name];
            if (panel) {
                panel.id = 'ui-panel-' + id + '-' + name;
                panel.setAttribute('role', 'tabpanel');
                panel.setAttribute('aria-labelledby', button.id);
                button.setAttribute('aria-controls', panel.id);
            }
        });

        function names() {
            return buttons.filter(function (b) { return !b.hidden; }).map(function (b) { return b.getAttribute('data-tab'); });
        }

        function select(name, opts) {
            opts = opts || {};
            if (names().indexOf(name) === -1) name = names()[0];
            if (!name) return;
            current = name;
            buttons.forEach(function (button) {
                var on = button.getAttribute('data-tab') === name;
                button.setAttribute('aria-selected', String(on));
                button.tabIndex = on ? 0 : -1;
                button.classList.toggle('is-active', on);
                if (on && opts.focus) button.focus();
            });
            Object.keys(panels).forEach(function (key) { panels[key].hidden = key !== name; });
            if (options.hash && opts.updateHash !== false && window.location.hash.slice(1) !== name) {
                window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search + '#' + name);
            }
            if (options.onSelect) options.onSelect(name);
        }

        function fromHash() {
            var wanted = window.location.hash.slice(1);
            wanted = aliases[wanted] || wanted;
            if (wanted && names().indexOf(wanted) !== -1) select(wanted, { updateHash: false });
        }

        function onKey(event) {
            var all = names();
            var at = all.indexOf(current);
            var next = null;
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = all[(at + 1) % all.length];
            else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = all[(at - 1 + all.length) % all.length];
            else if (event.key === 'Home') next = all[0];
            else if (event.key === 'End') next = all[all.length - 1];
            if (!next) return;
            event.preventDefault();
            select(next, { focus: true });
        }

        buttons.forEach(function (button) {
            button.addEventListener('click', function () { select(button.getAttribute('data-tab')); });
        });
        list.addEventListener('keydown', onKey);
        if (options.hash) window.addEventListener('hashchange', fromHash);

        select(options.initial || names()[0], { updateHash: false });
        if (options.hash) fromHash();

        return {
            select: select,
            current: function () { return current; },
            destroy: function () { if (options.hash) window.removeEventListener('hashchange', fromHash); }
        };
    }

    window.DoxxusUI = {
        PHASES: PHASES,
        STATES: STATES,
        PROJECT_STATUS: PROJECT_STATUS,
        CONTRACT_STATUS: CONTRACT_STATUS,
        el: el,
        clear: clear,
        chip: chip,
        pick: pick,
        safeUrl: safeUrl,
        formatDate: formatDate,
        money: money,
        fileSize: fileSize,
        isEmail: isEmail,
        phaseFraction: phaseFraction,
        orderedPhases: orderedPhases,
        milestonesFor: milestonesFor,
        projectProgress: projectProgress,
        currentPhase: currentPhase,
        nextMilestone: nextMilestone,
        progressBar: progressBar,
        field: field,
        status: status,
        confirmButton: confirmButton,
        tabs: tabs
    };
}());

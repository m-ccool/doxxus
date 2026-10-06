/**
 * pages.js — interactions for the services spec sheet and the package builder.
 * Each initializer is a no-op when its markup is absent, so this file is safe
 * to include on every page.
 */
(function () {
    'use strict';

    var CONTACT_ENDPOINT = 'https://doxxus.us/ajax-form-store.php';
    var NOTE_LIMIT = 500;

    /* ────────────────────────────────────────────────────────────────
       Mac-style windows (capabilities, tiers, add-ons, IT support)
       Each window owns its own traffic lights and collapse state.
       ──────────────────────────────────────────────────────────────── */

    function initWindow(win) {
        var commands = Array.prototype.slice.call(win.querySelectorAll('.ds-terminal-cmd'));
        var body = win.querySelector('.ds-window-body, .ds-terminal-body');
        var startCollapsed = win.dataset.windowStart === 'collapsed';

        function outputFor(command) {
            return document.getElementById(command.getAttribute('aria-controls'));
        }

        function setOpen(command, open) {
            command.setAttribute('aria-expanded', String(open));
            var output = outputFor(command);
            if (output) output.hidden = !open;
        }

        function setMinimized(minimized) {
            win.classList.toggle('is-minimized', minimized);
            if (body) body.setAttribute('aria-hidden', String(minimized));
            var toggle = win.querySelector('[data-terminal-action="minimize"]');
            if (toggle) toggle.setAttribute('aria-expanded', String(!minimized));
            var titleToggle = win.querySelector('.ds-window-title');
            if (titleToggle) titleToggle.setAttribute('aria-expanded', String(!minimized));
        }

        // Only windows that hold a command list get the accordion behaviour.
        commands.forEach(function (command) {
            command.addEventListener('click', function () {
                if (!outputFor(command)) return;
                var isOpen = command.getAttribute('aria-expanded') === 'true';
                if (!win.classList.contains('is-zoomed')) {
                    commands.forEach(function (other) {
                        if (other !== command) setOpen(other, false);
                    });
                }
                setOpen(command, !isOpen);
            });
        });

        if (commands.length) setOpen(commands[0], true);
        setMinimized(startCollapsed);

        var actions = {
            // Red — wobble, vanish, fade back in, reset to the opening state.
            close: function () {
                if (win.classList.contains('is-rebooting')) return;
                win.classList.remove('is-zoomed');
                win.classList.add('is-rebooting');

                var resetAt = window.setTimeout(function () {
                    commands.forEach(function (command, index) {
                        setOpen(command, index === 0);
                    });
                    setMinimized(startCollapsed);
                }, 720);

                win.addEventListener('animationend', function done(event) {
                    if (event.target !== win) return;
                    window.clearTimeout(resetAt);
                    win.classList.remove('is-rebooting');
                    win.removeEventListener('animationend', done);
                });
            },
            // Yellow — collapse the body into the title bar, click again to restore.
            minimize: function () {
                if (win.classList.contains('is-rebooting')) return;
                win.classList.remove('is-zoomed');
                setMinimized(!win.classList.contains('is-minimized'));
            },
            // Green — open everything at once, click again to go back to one.
            zoom: function () {
                if (win.classList.contains('is-rebooting')) return;
                setMinimized(false);
                var zoomed = win.classList.toggle('is-zoomed');
                commands.forEach(function (command, index) {
                    setOpen(command, zoomed ? true : index === 0);
                });
            }
        };

        // Clicking the window title toggles the same as the yellow dot.
        var title = win.querySelector('.ds-window-title');
        if (title) {
            title.addEventListener('click', function () {
                if (win.classList.contains('is-rebooting')) return;
                win.classList.remove('is-zoomed');
                setMinimized(!win.classList.contains('is-minimized'));
            });
        }

        // Scope to this window so nested windows never steal each other's dots.
        win.querySelectorAll('[data-terminal-action]').forEach(function (button) {
            if (button.closest('[data-window]') !== win) return;
            button.addEventListener('click', function () {
                var run = actions[button.dataset.terminalAction];
                if (run) run();
            });
        });
    }

    function initWindows() {
        document.querySelectorAll('[data-window]').forEach(initWindow);
    }

    /* ────────────────────────────────────────────────────────────────
       Build page — package builder
       ──────────────────────────────────────────────────────────────── */

    function initPackageBuilder() {
        var builder = document.querySelector('[data-package-builder]');
        if (!builder) return;

        var steps = Array.prototype.slice.call(builder.querySelectorAll('[data-step]'));
        var navButtons = Array.prototype.slice.call(builder.querySelectorAll('[data-step-target]'));
        var packageInputs = Array.prototype.slice.call(builder.querySelectorAll('input[name="package"]'));
        var addonInputs = Array.prototype.slice.call(builder.querySelectorAll('input[name="addon"]'));
        var summaryList = builder.querySelector('[data-summary-list]');
        var reviewOutput = builder.querySelector('[data-review-output]');
        var budgetOutput = builder.querySelector('[data-review-budget]');
        var statusBox = builder.querySelector('[data-builder-status]');
        var form = builder.querySelector('form');
        var submitButton = builder.querySelector('[data-builder-submit]');
        var confirmPane = document.querySelector('[data-builder-confirm]');
        var current = 0;

        function selectedPackage() {
            return packageInputs.filter(function (input) { return input.checked; })[0] || null;
        }

        function selectedAddons() {
            return addonInputs.filter(function (input) { return input.checked; });
        }

        function renderSummary() {
            var pkg = selectedPackage();
            var addons = selectedAddons();
            var rows = [];

            if (pkg) {
                rows.push('<li><span>' + pkg.dataset.label + '</span></li>');
            }
            addons.forEach(function (input) {
                rows.push('<li><span>' + input.dataset.label + '</span></li>');
            });
            if (!rows.length) {
                rows.push('<li class="ds-summary-empty">Nothing selected yet.</li>');
            }

            summaryList.innerHTML = rows.join('');
        }

        // The exact text sent to the endpoint. Nothing is added or removed on submit,
        // so the review pane always shows precisely what gets emailed.
        function packageSummaryText() {
            var pkg = selectedPackage();
            var addons = selectedAddons();
            var lines = [];

            lines.push('PACKAGE REQUEST');
            lines.push('Base: ' + (pkg ? pkg.dataset.label : 'not selected'));
            lines.push('Add-ons: ' + (addons.length
                ? addons.map(function (input) { return input.dataset.short; }).join(', ')
                : 'none'));

            var project = builder.querySelector('#project-name');
            var goal = builder.querySelector('#project-goal');
            var timeline = builder.querySelector('#project-timeline');
            var references = builder.querySelector('#project-references');

            if (project && project.value.trim()) lines.push('Project: ' + project.value.trim());
            if (timeline && timeline.value) lines.push('Launch: ' + timeline.value);
            if (references && references.value.trim()) lines.push('Refs: ' + references.value.trim());
            if (goal && goal.value.trim()) lines.push('Goal: ' + goal.value.trim());

            return lines.join('\n');
        }

        function renderReview() {
            var summary = packageSummaryText();
            var over = summary.length - NOTE_LIMIT;

            reviewOutput.textContent = summary;
            if (budgetOutput) {
                budgetOutput.textContent = summary.length + ' / ' + NOTE_LIMIT + ' characters';
                budgetOutput.classList.toggle('is-over', over > 0);
            }

            // Fail closed: never silently truncate. Block submission and say exactly
            // how much has to go, so the request that is sent is the request approved.
            if (over > 0) {
                submitButton.disabled = true;
                setStatus('error', 'This summary is ' + over + ' character' + (over === 1 ? '' : 's') +
                    ' too long to send. Shorten your project goal or reference links, then come back to this step.');
            } else {
                submitButton.disabled = false;
                setStatus(null, '');
            }
        }

        function showStep(index, scroll) {
            current = Math.max(0, Math.min(index, steps.length - 1));
            steps.forEach(function (step, i) {
                step.hidden = i !== current;
            });
            navButtons.forEach(function (button, i) {
                button.setAttribute('aria-current', String(i === current));
                button.classList.toggle('is-complete', i < current);
            });
            if (steps[current].hasAttribute('data-step-review')) renderReview();
            if (scroll) {
                builder.scrollIntoView({ block: 'start', behavior: 'smooth' });
                // The pane holding the previously focused button is now hidden,
                // so move focus explicitly instead of letting it fall back to body.
                focusPane(current);
            }
        }

        function focusPane(index) {
            var pane = steps[index];
            var target = pane.querySelector('input:not([type="hidden"]), textarea, select, button') || pane;
            if (!pane.hasAttribute('tabindex')) pane.setAttribute('tabindex', '-1');
            (target === pane ? pane : target).focus({ preventScroll: true });
        }

        function invalidFieldsIn(index) {
            return Array.prototype.slice.call(steps[index].querySelectorAll('input, textarea, select'))
                .filter(function (field) {
                    if (field.type === 'checkbox' || field.type === 'radio') return false;
                    return !field.checkValidity();
                });
        }

        function stepIsValid(index) {
            var invalid = invalidFieldsIn(index);
            if (invalid.length) invalid[0].reportValidity();
            return invalid.length === 0;
        }

        // Jumping forward must clear every step in between, not just the current one.
        function stepsValidUpTo(target) {
            for (var i = 0; i < target; i++) {
                if (invalidFieldsIn(i).length) {
                    showStep(i, true);
                    invalidFieldsIn(i)[0].reportValidity();
                    return false;
                }
            }
            return true;
        }

        function setStatus(kind, message) {
            if (!statusBox) return;
            statusBox.hidden = !message;
            if (!message) return;
            statusBox.className = 'ds-callout builder-status ' + (kind === 'error' ? 'ds-callout--attention' : 'ds-callout--note');
            statusBox.innerHTML = '<i class="typcn ' + (kind === 'error' ? 'typcn-warning-outline' : 'typcn-info-large') + '" aria-hidden="true"></i><span>' + message + '</span>';
        }

        packageInputs.concat(addonInputs).forEach(function (input) {
            input.addEventListener('change', function () {
                renderSummary();
                if (steps[current].hasAttribute('data-step-review')) renderReview();
            });
        });

        navButtons.forEach(function (button, index) {
            button.addEventListener('click', function () {
                if (index > current && !stepsValidUpTo(index)) return;
                showStep(index, true);
            });
        });

        builder.querySelectorAll('[data-step-next]').forEach(function (button) {
            button.addEventListener('click', function () {
                if (!stepIsValid(current)) return;
                showStep(current + 1, true);
            });
        });

        builder.querySelectorAll('[data-step-back]').forEach(function (button) {
            button.addEventListener('click', function () { showStep(current - 1, true); });
        });

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            // Reveal and focus the first invalid step rather than calling
            // reportValidity() on controls the user cannot see.
            if (!stepsValidUpTo(steps.length - 1)) return;
            if (!selectedPackage()) {
                setStatus('error', 'Choose a base package before sending the request.');
                showStep(0, true);
                return;
            }

            var summary = packageSummaryText();
            if (summary.length > NOTE_LIMIT) {
                showStep(steps.length - 1, true);
                renderReview();
                return;
            }

            var payload = new URLSearchParams();
            payload.set('type', 'website');
            payload.set('user', builder.querySelector('#client-name').value.trim());
            payload.set('email', builder.querySelector('#client-email').value.trim());
            payload.set('phone', builder.querySelector('#client-phone').value.trim());
            payload.set('websummary', summary);

            submitButton.disabled = true;
            setStatus('note', 'Sending your package request&hellip;');

            fetch(CONTACT_ENDPOINT, { method: 'POST', body: payload })
                .then(function (response) {
                    if (!response.ok) throw new Error('bad status');
                    return response.text();
                })
                .then(function (text) {
                    // Fail closed: anything other than the literal success token is an error.
                    if ((text || '').trim() !== 'success') throw new Error('rejected');
                    setStatus(null, '');
                    builder.hidden = true;
                    if (confirmPane) {
                        confirmPane.hidden = false;
                        confirmPane.scrollIntoView({ block: 'center', behavior: 'smooth' });
                        var heading = confirmPane.querySelector('h2');
                        if (heading) {
                            heading.setAttribute('tabindex', '-1');
                            heading.focus();
                        }
                    }
                })
                .catch(function () {
                    submitButton.disabled = false;
                    setStatus('error', 'That request could not be delivered. Please try again, or email <a href="mailto:dev@doxxus.us">dev@doxxus.us</a> with your selections.');
                });
        });

        renderSummary();
        showStep(0, false);
    }

    function init() {
        initWindows();
        initPackageBuilder();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

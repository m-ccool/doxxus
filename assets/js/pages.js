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
       Services page — terminal command list
       ──────────────────────────────────────────────────────────────── */

    function initServiceTerminal() {
        var terminal = document.querySelector('[data-service-terminal]');
        if (!terminal) return;

        var commands = Array.prototype.slice.call(terminal.querySelectorAll('.ds-terminal-cmd'));

        commands.forEach(function (command) {
            command.addEventListener('click', function () {
                var output = document.getElementById(command.getAttribute('aria-controls'));
                if (!output) return;
                var isOpen = command.getAttribute('aria-expanded') === 'true';

                commands.forEach(function (other) {
                    if (other === command) return;
                    other.setAttribute('aria-expanded', 'false');
                    var otherOutput = document.getElementById(other.getAttribute('aria-controls'));
                    if (otherOutput) otherOutput.hidden = true;
                });

                command.setAttribute('aria-expanded', String(!isOpen));
                output.hidden = isOpen;
            });
        });

        if (commands.length) commands[0].click();

        var rebootButton = terminal.querySelector('[data-terminal-reboot]');
        if (rebootButton) {
            rebootButton.addEventListener('click', function () {
                if (terminal.classList.contains('is-rebooting')) return;
                terminal.classList.add('is-rebooting');

                // Collapse back to the opening state while the panel is invisible.
                var resetAt = window.setTimeout(function () {
                    commands.forEach(function (command, index) {
                        var output = document.getElementById(command.getAttribute('aria-controls'));
                        command.setAttribute('aria-expanded', String(index === 0));
                        if (output) output.hidden = index !== 0;
                    });
                }, 720);

                terminal.addEventListener('animationend', function done() {
                    window.clearTimeout(resetAt);
                    terminal.classList.remove('is-rebooting');
                    terminal.removeEventListener('animationend', done);
                });
            });
        }
    }

    /* ────────────────────────────────────────────────────────────────
       Build page — package builder
       ──────────────────────────────────────────────────────────────── */

    function currency(value) {
        return '$' + Number(value).toLocaleString('en-US');
    }

    function initPackageBuilder() {
        var builder = document.querySelector('[data-package-builder]');
        if (!builder) return;

        var steps = Array.prototype.slice.call(builder.querySelectorAll('[data-step]'));
        var navButtons = Array.prototype.slice.call(builder.querySelectorAll('[data-step-target]'));
        var packageInputs = Array.prototype.slice.call(builder.querySelectorAll('input[name="package"]'));
        var addonInputs = Array.prototype.slice.call(builder.querySelectorAll('input[name="addon"]'));
        var summaryList = builder.querySelector('[data-summary-list]');
        var summaryTotal = builder.querySelector('[data-summary-total]');
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

        function estimate() {
            var base = selectedPackage() ? Number(selectedPackage().dataset.price) : 0;
            return selectedAddons().reduce(function (total, input) {
                return total + Number(input.dataset.price);
            }, base);
        }

        function renderSummary() {
            var pkg = selectedPackage();
            var addons = selectedAddons();
            var rows = [];

            if (pkg) {
                rows.push('<li><span>' + pkg.dataset.label + '</span><b>' + currency(pkg.dataset.price) + '</b></li>');
            }
            addons.forEach(function (input) {
                rows.push('<li><span>' + input.dataset.label + '</span><b>+' + currency(input.dataset.price) + '</b></li>');
            });
            if (!rows.length) {
                rows.push('<li class="ds-summary-empty">Nothing selected yet.</li>');
            }

            summaryList.innerHTML = rows.join('');
            summaryTotal.textContent = currency(estimate());
        }

        // The exact text sent to the endpoint. Nothing is added or removed on submit,
        // so the review pane always shows precisely what gets emailed.
        function packageSummaryText() {
            var pkg = selectedPackage();
            var addons = selectedAddons();
            var lines = [];

            lines.push('PACKAGE REQUEST');
            lines.push('Base: ' + (pkg ? pkg.dataset.label + ' ' + currency(pkg.dataset.price) : 'not selected'));
            lines.push('Add-ons: ' + (addons.length
                ? addons.map(function (input) { return input.dataset.short + ' ' + currency(input.dataset.price); }).join(', ')
                : 'none'));
            lines.push('Estimate: ' + currency(estimate()) + ' (estimate only)');

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
        initServiceTerminal();
        initPackageBuilder();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

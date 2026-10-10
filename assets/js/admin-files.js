/*
 * Admin hub, Files & links tab (loaded before admin.js, registers on window.DoxxusAdminPanels).
 *
 * Per client: share links (https only) and upload documents to the private "client-files" bucket under
 * <client_id>/. Each item can be shown to or hidden from the client at any time, and tied to a project or left
 * general. A client can read an item only while it is visible (row-level security and the bucket policy enforce
 * that; this page only sets the flag).
 *
 * Upload order matters: the file goes to storage first, then its row is added, and if the row fails the file is
 * removed again so nothing is left behind. Delete is the reverse: file first, then row.
 */
(function () {
    'use strict';

    var UI = window.DoxxusUI;
    var el = UI.el;
    var clear = UI.clear;
    var BUCKET = 'client-files';
    var MAX_BYTES = 25 * 1024 * 1024;
    var DOWNLOAD_SECONDS = 60;
    var FAILED = 'Could not reach the server. Nothing was changed. Try again.';

    // extension -> content type. The bucket only accepts these types; anything else is refused here first.
    var TYPES = {
        pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
        txt: 'text/plain', csv: 'text/csv', md: 'text/markdown', zip: 'application/zip', json: 'application/json',
        doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    };

    function extensionOf(name) {
        var match = /\.([A-Za-z0-9]+)$/.exec(name || '');
        return match ? match[1].toLowerCase() : '';
    }

    function safeName(name) {
        var cleaned = String(name || 'file').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+/, '');
        return (cleaned || 'file').slice(-120);
    }

    function uuid() {
        if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
        return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }

    function newest(a, b) {
        return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    }

    function render(container, client, ctx) {
        function projectOptions() {
            var options = [{ value: '', label: 'General (no project)' }];
            (client.projects || []).forEach(function (p) { options.push({ value: p.id, label: p.name || 'Untitled project' }); });
            return options;
        }

        function projectName(id) {
            var found = (client.projects || []).filter(function (p) { return p.id === id; })[0];
            return found ? (found.name || 'Untitled project') : 'General';
        }

        // The visible-to-client switch, saved on change.
        function visibilityControl(table, item) {
            var f = UI.field({ label: 'Visible to client', type: 'checkbox', value: item.visible_to_client });
            f.wrap.classList.add('admin-inline-field');
            var stateNode = el('span');
            var result = UI.status(stateNode);
            f.input.addEventListener('change', function () {
                var next = !!f.get();
                f.input.disabled = true;
                result.saving();
                ctx.db().from(table).update({ visible_to_client: next }).eq('id', item.id).select('id, visible_to_client').then(function (response) {
                    if (!ctx.alive()) return;
                    if (response.error || !response.data || !response.data.length) {
                        f.set(item.visible_to_client);
                        return result.failed('Not saved');
                    }
                    item.visible_to_client = response.data[0].visible_to_client;
                    result.saved();
                }).catch(function () {
                    if (!ctx.alive()) return;
                    f.set(item.visible_to_client);
                    result.failed(FAILED);
                }).then(function () { f.input.disabled = false; });
            });
            var box = el('span', 'admin-visibility');
            box.appendChild(f.wrap);
            box.appendChild(stateNode);
            return box;
        }

        /* ── links ───────────────────────────────────────────────── */

        var linksHead = el('div', 'portal-panel-head');
        linksHead.appendChild(el('h3', 'admin-h', 'Links'));
        container.appendChild(linksHead);
        container.appendChild(linkForm());
        var linkList = el('div', 'admin-file-list');
        container.appendChild(linkList);

        function linkForm() {
            var form = el('form', 'portal-form admin-add-form');
            form.noValidate = true;
            var title = UI.field({ label: 'Title', max: 160 });
            var url = UI.field({ label: 'Link', type: 'url', max: 2000, placeholder: 'https://' });
            var note = UI.field({ label: 'Note (optional)', max: 500 });
            var project = UI.field({ label: 'Project', type: 'select', options: projectOptions() });
            var visible = UI.field({ label: 'Visible to client', type: 'checkbox', value: true });
            var grid = el('div', 'portal-form-grid');
            grid.appendChild(title.wrap);
            grid.appendChild(url.wrap);
            grid.appendChild(note.wrap);
            grid.appendChild(project.wrap);
            form.appendChild(grid);
            var row = el('div', 'portal-row portal-row--end');
            var stateNode = el('span');
            var result = UI.status(stateNode);
            var add = el('button', 'ds-btn ds-btn--sm ds-btn--primary', 'Add link');
            add.type = 'submit';
            row.appendChild(stateNode);
            row.appendChild(visible.wrap);
            row.appendChild(add);
            form.appendChild(row);

            form.addEventListener('submit', function (event) {
                event.preventDefault();
                var text = title.get().trim();
                var link = url.get().trim();
                if (!text) { title.input.focus(); return result.failed('Enter a title.'); }
                if (!UI.safeUrl(link)) { url.input.focus(); return result.failed('The link must start with https://'); }
                add.disabled = true;
                result.saving();
                ctx.db().from('client_links')
                    .insert({ client_id: client.id, project_id: project.get() || null, title: text, url: link, note: note.get().trim() || null, visible_to_client: !!visible.get() })
                    .select('id, project_id, title, url, note, visible_to_client, created_at')
                    .then(function (response) {
                        if (!ctx.alive()) return;
                        if (response.error || !response.data || !response.data.length) return result.failed('Not added.');
                        client.client_links.unshift(response.data[0]);
                        title.set('');
                        url.set('');
                        note.set('');
                        result.saved('Added');
                        drawLinks();
                        ctx.changed();
                    }).catch(function () {
                        if (ctx.alive()) result.failed(FAILED);
                    }).then(function () { add.disabled = false; });
            });
            return form;
        }

        function drawLinks() {
            clear(linkList);
            var links = client.client_links.slice().sort(newest);
            if (!links.length) {
                linkList.appendChild(el('p', 'portal-muted', 'No links yet.'));
                return;
            }
            var box = el('div', 'ds-box');
            links.forEach(function (item) {
                var row = el('div', 'ds-box-row admin-file-row');
                var body = el('div', 'portal-grow');
                var href = UI.safeUrl(item.url);
                if (href) {
                    var anchor = el('a', 'portal-strong', item.title);
                    anchor.href = href;
                    anchor.target = '_blank';
                    anchor.rel = 'noopener noreferrer';
                    body.appendChild(anchor);
                } else {
                    body.appendChild(el('strong', 'portal-strong', item.title));
                }
                body.appendChild(el('span', 'portal-muted portal-sub', [projectName(item.project_id), item.note].filter(Boolean).join(' \u00b7 ')));
                row.appendChild(body);
                row.appendChild(visibilityControl('client_links', item));

                var del = el('button', 'portal-icon-button portal-icon-button--danger', '\u2715');
                del.type = 'button';
                del.setAttribute('aria-label', 'Delete link');
                var stateNode = el('span');
                var result = UI.status(stateNode);
                UI.confirmButton(del, 'Sure?', function () {
                    del.disabled = true;
                    result.saving();
                    ctx.db().from('client_links').delete().eq('id', item.id).select('id').then(function (response) {
                        if (!ctx.alive()) return;
                        if (response.error || !response.data || !response.data.length) {
                            del.disabled = false;
                            return result.failed('Not deleted');
                        }
                        client.client_links = client.client_links.filter(function (x) { return x.id !== item.id; });
                        drawLinks();
                        ctx.changed();
                    }).catch(function () {
                        if (!ctx.alive()) return;
                        del.disabled = false;
                        result.failed(FAILED);
                    });
                });
                row.appendChild(stateNode);
                row.appendChild(del);
                box.appendChild(row);
            });
            linkList.appendChild(box);
        }

        /* ── documents ───────────────────────────────────────────── */

        var filesHead = el('div', 'portal-panel-head admin-spaced');
        filesHead.appendChild(el('h3', 'admin-h', 'Documents'));
        container.appendChild(filesHead);
        container.appendChild(uploadForm());
        var fileList = el('div', 'admin-file-list');
        container.appendChild(fileList);

        function uploadForm() {
            var form = el('form', 'portal-form admin-add-form');
            form.noValidate = true;
            var pick = UI.field({ label: 'File (up to 25 MB: PDF, images, Office, text, zip)', type: 'file' });
            var project = UI.field({ label: 'Project', type: 'select', options: projectOptions() });
            var visible = UI.field({ label: 'Visible to client', type: 'checkbox', value: true });
            var grid = el('div', 'portal-form-grid');
            grid.appendChild(pick.wrap);
            grid.appendChild(project.wrap);
            form.appendChild(grid);
            var row = el('div', 'portal-row portal-row--end');
            var stateNode = el('span');
            var result = UI.status(stateNode);
            var upload = el('button', 'ds-btn ds-btn--sm ds-btn--primary', 'Upload');
            upload.type = 'submit';
            row.appendChild(stateNode);
            row.appendChild(visible.wrap);
            row.appendChild(upload);
            form.appendChild(row);

            form.addEventListener('submit', function (event) {
                event.preventDefault();
                var file = pick.input.files && pick.input.files[0];
                if (!file) return result.failed('Choose a file first.');
                var ext = extensionOf(file.name);
                if (!TYPES[ext]) return result.failed('That file type is not allowed.');
                if (file.size > MAX_BYTES) return result.failed('Files can be up to 25 MB.');

                var path = client.id + '/' + uuid() + '-' + safeName(file.name);
                upload.disabled = true;
                result.saving();
                var storage = ctx.db().storage.from(BUCKET);
                storage.upload(path, file, { contentType: TYPES[ext], upsert: false }).then(function (stored) {
                    if (!ctx.alive()) return null;
                    if (stored.error) { result.failed('Upload failed.'); return null; }
                    return ctx.db().from('client_files')
                        .insert({
                            client_id: client.id, project_id: project.get() || null, name: file.name, storage_path: path,
                            size_bytes: file.size, content_type: TYPES[ext], visible_to_client: !!visible.get()
                        })
                        .select('id, project_id, name, size_bytes, content_type, storage_path, visible_to_client, created_at')
                        .then(function (response) {
                            if (!ctx.alive()) return;
                            if (response.error || !response.data || !response.data.length) {
                                // Do not leave an orphan in storage.
                                storage.remove([path]);
                                return result.failed('Not saved.');
                            }
                            client.client_files.unshift(response.data[0]);
                            pick.input.value = '';
                            result.saved('Uploaded');
                            drawFiles();
                            ctx.changed();
                        });
                }).catch(function () {
                    if (ctx.alive()) result.failed(FAILED);
                }).then(function () { upload.disabled = false; });
            });
            return form;
        }

        function drawFiles() {
            clear(fileList);
            var files = client.client_files.slice().sort(newest);
            if (!files.length) {
                fileList.appendChild(el('p', 'portal-muted', 'No documents yet.'));
                return;
            }
            var box = el('div', 'ds-box');
            files.forEach(function (item) {
                var row = el('div', 'ds-box-row admin-file-row');
                var body = el('div', 'portal-grow');
                body.appendChild(el('strong', 'portal-strong', item.name));
                body.appendChild(el('span', 'portal-muted portal-sub', [UI.fileSize(item.size_bytes), UI.formatDate(item.created_at), projectName(item.project_id)].filter(Boolean).join(' \u00b7 ')));
                row.appendChild(body);
                row.appendChild(visibilityControl('client_files', item));

                var stateNode = el('span');
                var result = UI.status(stateNode);
                var download = el('button', 'ds-btn ds-btn--sm', 'Download');
                download.type = 'button';
                download.addEventListener('click', function () {
                    if (download.disabled) return;
                    download.disabled = true;
                    result.clear();
                    ctx.db().storage.from(BUCKET).createSignedUrl(item.storage_path, DOWNLOAD_SECONDS, { download: item.name }).then(function (response) {
                        if (!ctx.alive()) return;
                        var url = response.data && response.data.signedUrl;
                        if (response.error || !url) return result.failed('Could not download');
                        window.location.assign(url);
                    }).catch(function () {
                        if (ctx.alive()) result.failed('Could not download');
                    }).then(function () { download.disabled = false; });
                });

                var del = el('button', 'portal-icon-button portal-icon-button--danger', '\u2715');
                del.type = 'button';
                del.setAttribute('aria-label', 'Delete file');
                UI.confirmButton(del, 'Sure?', function () {
                    del.disabled = true;
                    result.saving();
                    ctx.db().storage.from(BUCKET).remove([item.storage_path]).then(function (removed) {
                        if (!ctx.alive()) return null;
                        if (removed.error) throw removed.error;
                        return ctx.db().from('client_files').delete().eq('id', item.id).select('id');
                    }).then(function (response) {
                        if (!ctx.alive() || !response) return;
                        if (response.error || !response.data || !response.data.length) {
                            del.disabled = false;
                            return result.failed('Not deleted');
                        }
                        client.client_files = client.client_files.filter(function (x) { return x.id !== item.id; });
                        drawFiles();
                        ctx.changed();
                    }).catch(function () {
                        if (!ctx.alive()) return;
                        del.disabled = false;
                        result.failed('Not deleted');
                    });
                });
                row.appendChild(stateNode);
                row.appendChild(download);
                row.appendChild(del);
                box.appendChild(row);
            });
            fileList.appendChild(box);
        }

        drawLinks();
        drawFiles();
    }

    window.DoxxusAdminPanels = window.DoxxusAdminPanels || {};
    window.DoxxusAdminPanels.files = { render: render };
}());

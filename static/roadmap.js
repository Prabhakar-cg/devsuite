/**
 * Learning Roadmap — static/roadmap.js
 *
 * M3: read-only fetch + render for the list view (?<no id>) and detail view
 * (?id=<roadmap-id>).
 * M4: checklist toggling — optimistic UI update, PATCH to persist, rollback
 * on failure (spec.md US2 AC1-AC3). M5 adds notes/link editing — those
 * sections still render as plain read-only markup for now.
 *
 * All dynamic content is built via document.createElement/textContent only
 * (Constitution Art. V — no innerHTML with data from the server).
 */
(function () {
    'use strict';

    const listView = document.getElementById('list-view');
    const detailView = document.getElementById('detail-view');
    const notFoundView = document.getElementById('not-found-view');
    const roadmapGrid = document.getElementById('roadmap-grid');
    const listEmptyState = document.getElementById('list-empty-state');

    // The currently-loaded roadmap detail (mutated in place as checklist items
    // are toggled, so completion can be recomputed client-side for instant
    // feedback — mirrors roadmap_utils.compute_completion's rules exactly).
    let currentRoadmap = null;

    // Pure completion math lives in roadmap-utils.js, mirroring roadmap_utils.py
    // (see its module docstring re: round-half-up parity at .5 midpoints).
    const computeStepPct = RoadmapUtils.computeStepPct;
    const computeRoadmapPct = RoadmapUtils.computeRoadmapPct;

    function getRoadmapIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }

    function showView(view) {
        listView.style.display = view === 'list' ? '' : 'none';
        detailView.style.display = view === 'detail' ? '' : 'none';
        notFoundView.style.display = view === 'not-found' ? '' : 'none';
    }

    const isSafeHttpUrl = RoadmapUtils.isSafeHttpUrl;

    const SVG_NS = 'http://www.w3.org/2000/svg';

    /** Build a stroke-based inline SVG icon from path `d` strings (SPEC §9.8 —
     * all icons are SVG, none are emoji/text glyphs). Built via createElementNS,
     * not innerHTML, matching this file's no-innerHTML convention. */
    function createIcon(paths, size) {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('width', String(size));
        svg.setAttribute('height', String(size));
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2.5');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        paths.forEach(function (d) {
            const path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('d', d);
            svg.appendChild(path);
        });
        return svg;
    }

    async function fetchJson(url) {
        const resp = await fetch(url);
        if (!resp.ok) {
            const err = new Error('Request failed: ' + resp.status);
            err.status = resp.status;
            throw err;
        }
        return resp.json();
    }

    /* ── List view ── */

    function renderRoadmapCard(roadmap) {
        const card = document.createElement('a');
        card.className = 'roadmap-card';
        card.href = '/roadmap?id=' + encodeURIComponent(roadmap.id);

        const title = document.createElement('div');
        title.className = 'roadmap-card-title';
        title.textContent = roadmap.title;
        card.appendChild(title);

        if (roadmap.description) {
            const desc = document.createElement('div');
            desc.className = 'roadmap-card-desc';
            desc.textContent = roadmap.description;
            card.appendChild(desc);
        }

        const footer = document.createElement('div');
        footer.className = 'roadmap-card-footer';

        const track = document.createElement('div');
        track.className = 'roadmap-progress-track';
        const fill = document.createElement('div');
        fill.className = 'roadmap-progress-fill';
        fill.style.width = roadmap.completion_pct + '%';
        track.appendChild(fill);
        footer.appendChild(track);

        const pct = document.createElement('span');
        pct.className = 'roadmap-card-pct';
        pct.textContent = roadmap.completion_pct + '%';
        footer.appendChild(pct);

        card.appendChild(footer);
        return card;
    }

    async function loadListView() {
        showView('list');
        let roadmaps;
        try {
            roadmaps = await fetchJson('/api/roadmaps');
        } catch (e) {
            DevSuite.toast('Failed to load roadmaps.', 'error');
            return;
        }

        roadmapGrid.textContent = '';
        if (roadmaps.length === 0) {
            listEmptyState.style.display = '';
            return;
        }
        listEmptyState.style.display = 'none';
        roadmaps.forEach(function (roadmap) {
            roadmapGrid.appendChild(renderRoadmapCard(roadmap));
        });
    }

    /* ── Detail view ── */

    function refreshDetailHeaderPct() {
        if (!currentRoadmap) return;
        const pct = computeRoadmapPct(currentRoadmap.steps);
        document.getElementById('detail-progress-fill').style.width = pct + '%';
        document.getElementById('detail-pct').textContent = pct + '%';
    }

    async function handleChecklistToggle(roadmapId, step, item, checkbox, row, updateStepPct) {
        const previousDone = !!item.done;
        const newDone = checkbox.checked;

        // Optimistic update: flip local state and redraw immediately.
        item.done = newDone;
        row.classList.toggle('done', newDone);
        updateStepPct(computeStepPct(step.checklist));
        refreshDetailHeaderPct();

        checkbox.disabled = true;
        try {
            const resp = await fetch(
                '/api/roadmaps/' + encodeURIComponent(roadmapId) +
                '/steps/' + encodeURIComponent(step.id) +
                '/checklist/' + encodeURIComponent(item.id),
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': DevSuite.csrfToken(),
                    },
                    body: JSON.stringify({ done: newDone }),
                }
            );
            if (!resp.ok) {
                throw new Error('PATCH failed: ' + resp.status);
            }
            const body = await resp.json();
            // Reconcile with the server's authoritative percentages (guards
            // against any client/server rounding drift at exact .5 boundaries).
            step.completion_pct = body.step_completion_pct;
            updateStepPct(body.step_completion_pct);
            document.getElementById('detail-progress-fill').style.width = body.roadmap_completion_pct + '%';
            document.getElementById('detail-pct').textContent = body.roadmap_completion_pct + '%';
        } catch (e) {
            // Roll back — no silent wrong-state display (spec.md US2 AC2).
            item.done = previousDone;
            checkbox.checked = previousDone;
            row.classList.toggle('done', previousDone);
            updateStepPct(computeStepPct(step.checklist));
            refreshDetailHeaderPct();
            DevSuite.toast('Failed to save checklist change — reverted.', 'error');
        } finally {
            checkbox.disabled = false;
        }
    }

    function renderChecklist(step, roadmapId, updateStepPct) {
        const container = document.createElement('div');
        const items = step.checklist || [];
        if (items.length === 0) {
            const hint = document.createElement('div');
            hint.className = 'roadmap-empty-hint';
            hint.textContent = 'No checklist items yet.';
            container.appendChild(hint);
            return container;
        }
        const list = document.createElement('div');
        list.className = 'roadmap-checklist';
        items.forEach(function (item) {
            const row = document.createElement('label');
            row.className = 'roadmap-checklist-item' + (item.done ? ' done' : '');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = !!item.done;
            checkbox.addEventListener('change', function () {
                handleChecklistToggle(roadmapId, step, item, checkbox, row, updateStepPct);
            });
            row.appendChild(checkbox);

            const span = document.createElement('span');
            span.textContent = item.text;
            row.appendChild(span);

            list.appendChild(row);
        });
        container.appendChild(list);
        return container;
    }

    /* Persist a subset of step fields (notes and/or course_links and/or
     * documents) via PATCH /api/roadmaps/{id}/steps/{step_id}. Throws on
     * failure so callers can roll back their optimistic local state. */
    async function patchStep(roadmapId, step, partialBody) {
        const resp = await fetch(
            '/api/roadmaps/' + encodeURIComponent(roadmapId) + '/steps/' + encodeURIComponent(step.id),
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': DevSuite.csrfToken(),
                },
                body: JSON.stringify(partialBody),
            }
        );
        if (!resp.ok) {
            throw new Error('Step PATCH failed: ' + resp.status);
        }
        return resp.json();
    }

    /* Editable course_links / documents list — shared renderer for both fields.
     * Add/remove operate optimistically on step[fieldName], PATCH the full
     * updated array (matches contracts/roadmap-api.md's array-replace shape),
     * and roll back on failure. */
    function renderEditableLinks(step, roadmapId, fieldName, emptyLabel) {
        const container = document.createElement('div');
        const listEl = document.createElement('div');
        container.appendChild(listEl);

        // Add/remove mutations for this field are serialized through this chain so a
        // failed operation's rollback only reverts its own change — without this, an
        // operation queued while an earlier one is still in flight would capture
        // step[fieldName] as its "previous" snapshot, then a later failed rollback could
        // reset the field to that stale snapshot and silently discard the newer edit.
        let mutationChain = Promise.resolve();

        function queueMutation(run) {
            const result = mutationChain.then(run, run);
            mutationChain = result.catch(function () {});
            return result;
        }

        function redrawList() {
            listEl.textContent = '';
            const links = step[fieldName] || [];
            if (links.length === 0) {
                const hint = document.createElement('div');
                hint.className = 'roadmap-empty-hint';
                hint.textContent = emptyLabel;
                listEl.appendChild(hint);
                return;
            }
            const list = document.createElement('div');
            list.className = 'roadmap-link-list';
            links.forEach(function (link, index) {
                const row = document.createElement('div');
                row.className = 'roadmap-link-item';

                if (isSafeHttpUrl(link.url)) {
                    const a = document.createElement('a');
                    a.href = link.url;
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    a.textContent = link.title;
                    row.appendChild(a);
                } else {
                    const span = document.createElement('span');
                    span.className = 'roadmap-link-empty-url';
                    span.textContent = link.title;
                    row.appendChild(span);
                }

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'roadmap-link-remove-btn';
                removeBtn.title = 'Remove';
                removeBtn.setAttribute('aria-label', 'Remove');
                removeBtn.appendChild(createIcon(['M18 6 6 18', 'm6 6 12 12'], 12));
                removeBtn.addEventListener('click', function () {
                    handleRemove(index);
                });
                row.appendChild(removeBtn);

                list.appendChild(row);
            });
            listEl.appendChild(list);
        }

        function handleRemove(index) {
            return queueMutation(async function () {
                const previous = (step[fieldName] || []).slice();
                const next = previous.slice();
                next.splice(index, 1);
                step[fieldName] = next;
                redrawList();
                try {
                    await patchStep(roadmapId, step, wrapField(fieldName, next));
                } catch (e) {
                    step[fieldName] = previous;
                    redrawList();
                    DevSuite.toast('Failed to remove link — reverted.', 'error');
                }
            });
        }

        function handleAdd(title, url) {
            return queueMutation(async function () {
                const previous = (step[fieldName] || []).slice();
                const next = previous.concat([{ title: title, url: url }]);
                step[fieldName] = next;
                redrawList();
                try {
                    await patchStep(roadmapId, step, wrapField(fieldName, next));
                } catch (e) {
                    step[fieldName] = previous;
                    redrawList();
                    DevSuite.toast('Failed to add link — reverted.', 'error');
                }
            });
        }

        redrawList();

        const form = document.createElement('div');
        form.className = 'roadmap-link-add-form';

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.placeholder = 'Title';
        titleInput.className = 'roadmap-link-input';

        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.placeholder = 'URL (optional)';
        urlInput.className = 'roadmap-link-input';

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn btn-ghost';
        addBtn.textContent = 'Add';
        addBtn.addEventListener('click', function () {
            const title = titleInput.value.trim();
            if (!title) {
                DevSuite.toast('A title is required to add a link.', 'error');
                return;
            }
            const url = urlInput.value.trim();
            titleInput.value = '';
            urlInput.value = '';
            handleAdd(title, url);
        });

        form.appendChild(titleInput);
        form.appendChild(urlInput);
        form.appendChild(addBtn);
        container.appendChild(form);

        return container;
    }

    function wrapField(fieldName, value) {
        const body = {};
        body[fieldName] = value;
        return body;
    }

    /* Notes editor: one lazily-created Monaco instance per step, created on
     * that step's first expand (research.md item 3 — plain markdown text,
     * no rendered-HTML view). Saves on editor blur. */
    function renderNotesSection(step, roadmapId) {
        const container = document.createElement('div');
        const host = document.createElement('div');
        host.className = 'roadmap-notes-host';
        container.appendChild(host);

        const status = document.createElement('div');
        status.className = 'roadmap-notes-status';
        container.appendChild(status);

        let editorRequested = false;

        async function saveNotes(value) {
            status.textContent = 'Saving…';
            try {
                await patchStep(roadmapId, step, { notes: value });
                step.notes = value;
                status.textContent = 'Saved';
                setTimeout(function () { status.textContent = ''; }, 1500);
            } catch (e) {
                status.textContent = 'Save failed — your change was not saved.';
                DevSuite.toast('Failed to save notes.', 'error');
            }
        }

        function ensureEditor() {
            if (editorRequested) return;
            editorRequested = true;
            DevSuite.initMonaco(function () {
                const model = monaco.editor.createModel(step.notes || '', 'markdown');
                const editor = monaco.editor.create(host, {
                    model: model,
                    automaticLayout: true,
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', monospace",
                    lineHeight: 20,
                    minimap: { enabled: false },
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    padding: { top: 8, bottom: 8 },
                });
                editor.onDidBlurEditorWidget(function () {
                    const value = editor.getValue();
                    if (value === (step.notes || '')) return;
                    saveNotes(value);
                });
            });
        }

        return { el: container, ensureEditor: ensureEditor };
    }

    function addSection(parent, title, contentEl) {
        const section = document.createElement('div');
        const heading = document.createElement('div');
        heading.className = 'roadmap-section-title';
        heading.textContent = title;
        section.appendChild(heading);
        section.appendChild(contentEl);
        parent.appendChild(section);
    }

    function renderStepCard(step) {
        const card = document.createElement('div');
        card.className = 'roadmap-step-card';

        const notesSection = renderNotesSection(step, currentRoadmap.id);

        const head = document.createElement('div');
        head.className = 'roadmap-step-head';
        head.addEventListener('click', function () {
            const wasExpanded = card.classList.contains('expanded');
            card.classList.toggle('expanded');
            if (!wasExpanded) {
                notesSection.ensureEditor();
            }
        });

        const order = document.createElement('div');
        order.className = 'roadmap-step-order';
        order.textContent = String(step.order);
        head.appendChild(order);

        const headText = document.createElement('div');
        headText.className = 'roadmap-step-head-text';
        const title = document.createElement('div');
        title.className = 'roadmap-step-title';
        title.textContent = step.title;
        headText.appendChild(title);
        if (step.description) {
            const desc = document.createElement('div');
            desc.className = 'roadmap-step-desc';
            desc.textContent = step.description;
            headText.appendChild(desc);
        }
        head.appendChild(headText);

        const pct = document.createElement('div');
        pct.className = 'roadmap-step-pct';
        pct.textContent = step.completion_pct + '%';
        head.appendChild(pct);

        const chevron = document.createElement('div');
        chevron.className = 'roadmap-step-chevron';
        chevron.appendChild(createIcon(['m9 18 6-6-6-6'], 16));
        head.appendChild(chevron);

        card.appendChild(head);

        const body = document.createElement('div');
        body.className = 'roadmap-step-body';
        addSection(body, 'Notes', notesSection.el);
        addSection(body, 'Checklist', renderChecklist(step, currentRoadmap.id, function (newPct) {
            pct.textContent = newPct + '%';
        }));
        addSection(body, 'Course Links', renderEditableLinks(step, currentRoadmap.id, 'course_links', 'No course links yet.'));
        addSection(body, 'Documents', renderEditableLinks(step, currentRoadmap.id, 'documents', 'No documents yet.'));
        card.appendChild(body);

        return card;
    }

    async function loadDetailView(id) {
        let roadmap;
        try {
            roadmap = await fetchJson('/api/roadmaps/' + encodeURIComponent(id));
        } catch (e) {
            if (e.status === 404) {
                showView('not-found');
            } else {
                DevSuite.toast('Failed to load roadmap.', 'error');
            }
            return;
        }

        currentRoadmap = roadmap;

        showView('detail');
        document.getElementById('detail-title').textContent = roadmap.title;
        document.getElementById('detail-desc').textContent = roadmap.description || '';
        document.getElementById('detail-progress-fill').style.width = roadmap.completion_pct + '%';
        document.getElementById('detail-pct').textContent = roadmap.completion_pct + '%';

        const stepsContainer = document.getElementById('steps-container');
        stepsContainer.textContent = '';
        (roadmap.steps || []).forEach(function (step) {
            stepsContainer.appendChild(renderStepCard(step));
        });
    }

    /* ── Entry point ── */

    function init() {
        const id = getRoadmapIdFromUrl();
        if (id) {
            loadDetailView(id);
        } else {
            loadListView();
        }
    }

    init();
})();

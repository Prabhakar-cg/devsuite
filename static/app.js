/**
 * DevSuite — Application Logic v3.0
 * -----------------------------------------
 * Features:
 *  - Text Diff with Monaco Editor (side-by-side + inline)
 *  - Folder Diff with file tree sidebar + filter chips
 *  - Live diff stats (additions / deletions / hunks)
 *  - Keyboard shortcut: Ctrl/Cmd+Enter to compare, Escape to edit
 *  - Paste from clipboard per panel
 *  - Copy panel content to clipboard
 *  - Line count badges updated on input
 *  - Export unified patch (.patch download or clipboard copy)
 *  - Multi-type toast notifications (success, error, warning, info)
 *  - Drag-and-drop + click-to-upload file loading (client-side, privacy-first)
 *  - Merge arrows (glyph margin decorations) + Merge All buttons
 *  - Language auto-detection via highlight.js + file extension
 */

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // AUTO-SELECT TAB FROM URL PARAM (?tab=folder)
    // ==========================================
    (function applyTabFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab) {
            const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
            if (btn) btn.click();
        }
    })();

    // ==========================================
    // DOM REFERENCES
    // ==========================================
    const originalInput = document.getElementById('original-input');
    const modifiedInput = document.getElementById('modified-input');
    const compareBtn = document.getElementById('compare-btn');
    const textDiffContainer = document.getElementById('diff-container');
    const inputPanels = document.getElementById('input-panels');
    const actionBarText = document.getElementById('action-bar-text');
    const toggleInlineBtn = document.getElementById('toggle-inline-btn');
    const editBtn = document.getElementById('edit-btn');
    const editorHost = document.getElementById('monaco-diff-editor');
    const langLabelContainer = document.getElementById('detected-language-label');
    const langNameSpan = document.getElementById('lang-name');
    const statsBar = document.getElementById('stats-bar');

    // Stats chips
    const statAdditionsCount = document.getElementById('stat-additions-count');
    const statDeletionsCount = document.getElementById('stat-deletions-count');
    const statChangesCount = document.getElementById('stat-changes-count');

    // Shared controls
    const languageSelect = document.getElementById('language-select');
    const themeSelect = document.getElementById('theme-select');

    // Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // File Upload
    const dropOriginal = document.getElementById('drop-original');
    const dropModified = document.getElementById('drop-modified');
    const fileOriginal = document.getElementById('file-original');
    const fileModified = document.getElementById('file-modified');
    const labelOriginal = document.getElementById('label-original');
    const labelModified = document.getElementById('label-modified');

    // Merge
    const mergeAllRightBtn = document.getElementById('merge-all-right-btn');
    const mergeAllLeftBtn = document.getElementById('merge-all-left-btn');

    // Export
    const exportBtn = document.getElementById('export-btn');
    const exportMenu = document.getElementById('export-menu');
    const exportPatchBtn = document.getElementById('export-patch-btn');
    const exportCopyBtn = document.getElementById('export-copy-btn');

    // Line count badges
    const linesOriginal = document.getElementById('lines-original');
    const linesModified = document.getElementById('lines-modified');

    // Paste buttons
    const pasteOriginalBtn = document.getElementById('paste-original-btn');
    const pasteModifiedBtn = document.getElementById('paste-modified-btn');

    // Copy panel buttons
    const copyPanelBtns = document.querySelectorAll('.copy-panel-btn');

    // Clear buttons
    const clearBtns = document.querySelectorAll('.clear-btn');

    // Folder Diff
    const origFolderInput = document.getElementById('original-folder-input');
    const modFolderInput = document.getElementById('modified-folder-input');
    const origFolderName = document.getElementById('original-folder-name');
    const modFolderName = document.getElementById('modified-folder-name');
    const compareFoldersBtn = document.getElementById('compare-folders-btn');
    const folderSetupPanelsWrap = document.getElementById('folder-setup-panels-wrapper');
    const actionBarFolder = document.getElementById('action-bar-folder');
    const folderResultsContainer = document.getElementById('folder-results-container');
    const fileTreeEl = document.getElementById('file-tree');
    const folderEditorHost = document.getElementById('folder-editor-wrapper');
    const changedFilesCount = document.getElementById('changed-files-count');

    // ==========================================
    // STATE
    // ==========================================
    let textDiffEditor = null;
    let textOriginalModel = null;
    let textModifiedModel = null;

    let folderDiffEditor = null;
    let folderOriginalModel = null;
    let folderModifiedModel = null;

    let originalFiles = new Map();
    let modifiedFiles = new Map();
    let fileDiffStatusMap = new Map();
    let currentFolderFilter = 'all';


    // ==========================================
    // TOAST NOTIFICATION SYSTEM
    // ==========================================
    const toastContainer = document.getElementById('toast-container');

    const TOAST_ICONS = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    function showToast(message, type = 'info', durationMs = 4500) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const iconSpan = document.createElement('span');
        iconSpan.className = 'toast-icon';
        iconSpan.textContent = TOAST_ICONS[type] || 'ℹ️';

        const bodySpan = document.createElement('span');
        bodySpan.className = 'toast-body';
        bodySpan.textContent = message;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.setAttribute('aria-label', 'Dismiss');
        closeBtn.textContent = '✕';

        toast.appendChild(iconSpan);
        toast.appendChild(bodySpan);
        toast.appendChild(closeBtn);

        toastContainer.appendChild(toast);

        const dismiss = () => {
            toast.classList.add('hide');
            toast.addEventListener('animationend', () => toast.remove(), { once: true });
        };

        toast.querySelector('.toast-close').addEventListener('click', dismiss);
        setTimeout(dismiss, durationMs);
    }

    // Backward compat helper
    function showError(message) { showToast(message, 'error'); }


    // ==========================================
    // LINE COUNT BADGES
    // ==========================================
    function countLines(text) {
        if (!text) return 0;
        return text.split('\n').length;
    }

    function updateLineCounts() {
        const ol = countLines(originalInput.value);
        const ml = countLines(modifiedInput.value);
        linesOriginal.textContent = `${ol} line${ol !== 1 ? 's' : ''}`;
        linesModified.textContent = `${ml} line${ml !== 1 ? 's' : ''}`;
    }

    originalInput.addEventListener('input', updateLineCounts);
    modifiedInput.addEventListener('input', updateLineCounts);
    updateLineCounts();


    // ==========================================
    // DIFF STATS BAR
    // ==========================================
    function updateDiffStats(diffEditor) {
        const changes = diffEditor.getLineChanges() || [];
        let additions = 0, deletions = 0;

        changes.forEach(c => {
            const origLines = (c.originalEndLineNumber - c.originalStartLineNumber + 1) || 0;
            const modLines = (c.modifiedEndLineNumber - c.modifiedStartLineNumber + 1) || 0;
            additions += modLines > 0 ? modLines : 0;
            deletions += origLines > 0 ? origLines : 0;
        });

        statAdditionsCount.textContent = additions;
        statDeletionsCount.textContent = deletions;
        statChangesCount.textContent = changes.length;
    }


    // ==========================================
    // MONACO INITIALIZATION
    // ==========================================
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
    window.MonacoEnvironment = { getWorkerUrl: () => proxy };
    let proxy = URL.createObjectURL(new Blob([`
        self.MonacoEnvironment = { baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/' };
        importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/base/worker/workerMain.js');
    `], { type: 'text/javascript' }));

    require(['vs/editor/editor.main'], () => {
        console.log('[DevSuite] Monaco loaded.');
        URL.revokeObjectURL(proxy);
    }, (err) => {
        console.error('[DevSuite] Monaco failed to load from CDN', err);
        showError('Warning: Failed to load Monaco Editor from CDN. Check your connection or disable tracking blockers.');
    });


    // ==========================================
    // FILE UPLOAD — BINARY CHECK + CLIENT-SIDE
    // ==========================================
    function isBinaryFile(file, bytes) {
        const binaryMimes = ['image/', 'video/', 'audio/', 'application/pdf',
            'application/zip', 'application/octet-stream'];
        if (binaryMimes.some(m => file.type.startsWith(m))) return true;
        const arr = new Uint8Array(bytes.slice(0, 512));
        for (let i = 0; i < arr.length; i++) { if (arr[i] === 0) return true; }
        return false;
    }

    function handleFileUpload(file, labelEl, textareaEl) {
        if (!file) return;
        const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
        if (file.size > MAX_FILE_SIZE_BYTES) {
            showError(`"${file.name}" is too large (max 50MB).`);
            return;
        }
        const arrayReader = new FileReader();
        arrayReader.onload = (e) => {
            if (isBinaryFile(file, e.target.result)) {
                showError(`"${file.name}" is a binary file — only text files are supported.`);
                return;
            }
            const textReader = new FileReader();
            textReader.onload = (ev) => {
                textareaEl.value = ev.target.result;
                labelEl.textContent = `${file.name}`;
                updateLineCounts();
                showToast(`Loaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'success', 3000);
            };
            textReader.onerror = () => showError(`Failed to read "${file.name}".`);
            textReader.readAsText(file, 'UTF-8');
        };
        arrayReader.onerror = () => showError(`Failed to inspect "${file.name}".`);
        arrayReader.readAsArrayBuffer(file);
    }

    function setupDropzone(dropEl, inputEl, labelEl, textareaEl) {
        inputEl.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleFileUpload(e.target.files[0], labelEl, textareaEl);
        });
        dropEl.addEventListener('dragover', (e) => { e.preventDefault(); dropEl.classList.add('drag-active'); });
        dropEl.addEventListener('dragleave', () => dropEl.classList.remove('drag-active'));
        dropEl.addEventListener('drop', (e) => {
            e.preventDefault();
            dropEl.classList.remove('drag-active');
            if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files[0], labelEl, textareaEl);
        });
    }

    setupDropzone(dropOriginal, fileOriginal, labelOriginal, originalInput);
    setupDropzone(dropModified, fileModified, labelModified, modifiedInput);


    // ==========================================
    // PASTE FROM CLIPBOARD
    // ==========================================
    async function pasteToTextarea(textarea) {
        try {
            const text = await navigator.clipboard.readText();
            textarea.value = text;
            textarea.focus();
            updateLineCounts();
            showToast('Pasted from clipboard.', 'success', 2500);
        } catch {
            showToast('Clipboard access denied. Please paste manually (Ctrl+V).', 'warning');
        }
    }

    pasteOriginalBtn.addEventListener('click', () => pasteToTextarea(originalInput));
    pasteModifiedBtn.addEventListener('click', () => pasteToTextarea(modifiedInput));


    // ==========================================
    // COPY PANEL CONTENT
    // ==========================================
    copyPanelBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const targetId = btn.getAttribute('data-target');
            const target = document.getElementById(targetId);
            if (!target || !target.value) {
                showToast('Nothing to copy — panel is empty.', 'warning', 2500);
                return;
            }
            try {
                await navigator.clipboard.writeText(target.value);
                showToast('Copied to clipboard!', 'success', 2000);
            } catch {
                showToast('Failed to copy to clipboard.', 'error');
            }
        });
    });


    // ==========================================
    // CLEAR BUTTONS
    // ==========================================
    clearBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = document.getElementById(btn.getAttribute('data-target'));
            if (target) { target.value = ''; updateLineCounts(); }
        });
    });


    // ==========================================
    // TAB SWITCHING
    // ==========================================
    for (const btn of tabBtns) {
        btn.addEventListener('click', () => {
            for (const b of tabBtns) b.classList.remove('active');
            for (const c of tabContents) c.classList.remove('active');
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');

            setTimeout(() => {
                const id = btn.dataset.tab;
                if (id === 'text-diff' && textDiffEditor && !textDiffContainer.classList.contains('hidden')) textDiffEditor.layout();
                if (id === 'folder-diff' && folderDiffEditor) folderDiffEditor.layout();
            }, 60);
        });
    }


    // ==========================================
    // TEXT DIFF LOGIC
    // ==========================================
    function triggerCompare() {
        const originalText = originalInput.value;
        const modifiedText = modifiedInput.value;
        if (!originalText.trim() && !modifiedText.trim()) {
            showToast('Both panels are empty — paste or upload some content first.', 'warning');
            return;
        }

        // Show loading state
        compareBtn.classList.add('loading');
        compareBtn.disabled = true;

        inputPanels.style.display = 'none';
        actionBarText.style.display = 'none';
        textDiffContainer.classList.remove('hidden');
        textDiffContainer.style.display = 'flex';
        textDiffContainer.style.flexDirection = 'column';
        textDiffContainer.style.flex = '1';
        textDiffContainer.style.overflow = 'hidden';

        if (!textDiffEditor) {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    initTextDiffEditor(originalText, modifiedText);
                    compareBtn.classList.remove('loading');
                    compareBtn.disabled = false;
                }, 30);
            });
        } else {
            textOriginalModel.setValue(originalText);
            textModifiedModel.setValue(modifiedText);
            updateEditorLanguage(textOriginalModel, textModifiedModel, originalText);
            compareBtn.classList.remove('loading');
            compareBtn.disabled = false;
        }
    }

    compareBtn.addEventListener('click', triggerCompare);

    // Keyboard shortcut: Ctrl/Cmd + Enter
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab;
            if (activeTab === 'text-diff') triggerCompare();
        }
        if (e.key === 'Escape' && !textDiffContainer.classList.contains('hidden')) {
            editBtn.click();
        }
    });

    editBtn.addEventListener('click', () => {
        if (textOriginalModel && textModifiedModel) {
            originalInput.value = textOriginalModel.getValue();
            modifiedInput.value = textModifiedModel.getValue();
            updateLineCounts();
        }
        textDiffContainer.style.display = 'none';
        textDiffContainer.classList.add('hidden');
        inputPanels.style.display = 'flex';
        inputPanels.style.flex = '1';
        inputPanels.style.overflow = 'hidden';
        actionBarText.style.display = 'flex';
    });

    toggleInlineBtn.addEventListener('click', () => {
        if (!textDiffEditor) return;
        const nowInline = toggleInlineBtn.classList.contains('active');
        textDiffEditor.updateOptions({ renderSideBySide: nowInline });
        toggleInlineBtn.classList.toggle('active', !nowInline);
        toggleInlineBtn.textContent = nowInline ? 'Inline View' : 'Side‑by‑Side';
        setTimeout(() => textDiffEditor.layout(), 50);
    });

    function initTextDiffEditor(originalTxt, modifiedTxt) {
        if (!window.monaco) {
            showError('Editor is still loading — please try again in a moment.');
            compareBtn.classList.remove('loading');
            compareBtn.disabled = false;
            return;
        }

        textDiffEditor = monaco.editor.createDiffEditor(editorHost, {
            theme: themeSelect.value,
            renderSideBySide: true,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', monospace",
            lineHeight: 22,
            minimap: { enabled: false },
            padding: { top: 16, bottom: 16 },
            originalEditable: true,
            enableSplitViewResizing: true,
            ignoreTrimWhitespace: false,
            glyphMargin: true,
            renderMarginRevertIcon: false
        });

        textOriginalModel = monaco.editor.createModel(originalTxt, 'plaintext');
        textModifiedModel = monaco.editor.createModel(modifiedTxt, 'plaintext');
        textDiffEditor.setModel({ original: textOriginalModel, modified: textModifiedModel });
        updateEditorLanguage(textOriginalModel, textModifiedModel, originalTxt);
        setupFloatingMergeIcons(textDiffEditor);

        textDiffEditor.onDidUpdateDiff(() => updateDiffStats(textDiffEditor));
    }


    // ==========================================
    // MERGE ARROWS — Glyph Margin Decorations
    // ==========================================
    function setupFloatingMergeIcons(diffEditor) {
        const origEditor = diffEditor.getOriginalEditor();
        const modEditor = diffEditor.getModifiedEditor();

        origEditor.updateOptions({ glyphMargin: true });
        modEditor.updateOptions({ glyphMargin: true });

        const origCollection = origEditor.createDecorationsCollection();
        const modCollection = modEditor.createDecorationsCollection();

        function applyDecorations() {
            origEditor.updateOptions({ glyphMargin: true });
            modEditor.updateOptions({ glyphMargin: true });

            const changes = diffEditor.getLineChanges() || [];
            const oNew = [], mNew = [];

            changes.forEach(change => {
                const oLine = change.originalStartLineNumber > 0
                    ? change.originalStartLineNumber : change.modifiedStartLineNumber;
                if (oLine > 0) {
                    oNew.push({
                        range: new monaco.Range(oLine, 1, oLine, 1),
                        options: {
                            glyphMarginClassName: 'merge-glyph-arrow-right',
                            glyphMarginHoverMessage: { value: '**Copy →** to Modified' },
                            description: 'merge-right'
                        }
                    });
                }
                const mLine = change.modifiedStartLineNumber > 0
                    ? change.modifiedStartLineNumber : change.originalStartLineNumber;
                if (mLine > 0) {
                    mNew.push({
                        range: new monaco.Range(mLine, 1, mLine, 1),
                        options: {
                            glyphMarginClassName: 'merge-glyph-arrow-left',
                            glyphMarginHoverMessage: { value: '**Copy ←** to Original' },
                            description: 'merge-left'
                        }
                    });
                }
            });

            origCollection.set(oNew);
            modCollection.set(mNew);
        }

        origEditor.onMouseDown(e => {
            if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) return;
            const line = e.target.position.lineNumber;
            const changes = diffEditor.getLineChanges() || [];
            const change = changes.find(c => {
                const s = c.originalStartLineNumber, end = c.originalEndLineNumber || s;
                return line >= s && line <= end;
            });
            if (change) { handleMergeClick(diffEditor, change, 'to-right'); showToast('Merged hunk to Modified.', 'success', 2000); }
        });

        modEditor.onMouseDown(e => {
            if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) return;
            const line = e.target.position.lineNumber;
            const changes = diffEditor.getLineChanges() || [];
            const change = changes.find(c => {
                const s = c.modifiedStartLineNumber, end = c.modifiedEndLineNumber || s;
                return line >= s && line <= end;
            });
            if (change) { handleMergeClick(diffEditor, change, 'to-left'); showToast('Merged hunk to Original.', 'success', 2000); }
        });

        diffEditor.onDidUpdateDiff(applyDecorations);
    }

    function handleMergeClick(diffEditor, change, direction) {
        if (!change) return;
        const origModel = diffEditor.getModel().original;
        const modModel = diffEditor.getModel().modified;

        if (direction === 'to-right') {
            const oStart = change.originalStartLineNumber, oEnd = change.originalEndLineNumber;
            const mStart = change.modifiedStartLineNumber, mEnd = change.modifiedEndLineNumber;
            let text, range;

            if (oEnd === 0) {
                // Pure deletion: orig has nothing here → delete the modified lines entirely.
                // Extend range to include the trailing newline (to line mEnd+1 col 1) so no
                // blank line ghost remains.
                if (mEnd < modModel.getLineCount()) {
                    range = new monaco.Range(mStart, 1, mEnd + 1, 1);
                } else {
                    // Last line(s) — delete from end of preceding line to avoid orphan newline
                    const prevEndCol = mStart > 1 ? modModel.getLineMaxColumn(mStart - 1) : 1;
                    range = new monaco.Range(Math.max(mStart - 1, 1), prevEndCol,
                        mEnd, modModel.getLineMaxColumn(mEnd));
                }
                text = '';

            } else if (mEnd === 0) {
                // Pure insertion: orig has lines oStart..oEnd that don't exist in modified.
                // Monaco sets mStart = the line in modified AFTER WHICH to insert.
                //   → insert at the END of line mStart (append \n + source text).
                // Special edge case: mStart === 0 means insert before the very first line.
                const srcText = origModel.getValueInRange(
                    new monaco.Range(oStart, 1, oEnd, origModel.getLineMaxColumn(oEnd)));
                if (mStart === 0) {
                    // Prepend to start of file
                    text = srcText + '\n';
                    range = new monaco.Range(1, 1, 1, 1);
                } else {
                    // Append AFTER line mStart
                    const endCol = modModel.getLineMaxColumn(mStart);
                    text = '\n' + srcText;
                    range = new monaco.Range(mStart, endCol, mStart, endCol);
                }

            } else {
                // Modification: replace the modified range with the original text.
                text = origModel.getValueInRange(
                    new monaco.Range(oStart, 1, oEnd, origModel.getLineMaxColumn(oEnd)));
                range = new monaco.Range(mStart, 1, mEnd, modModel.getLineMaxColumn(mEnd));
            }
            modModel.pushEditOperations([], [{ range, text }], () => null);

        } else { // to-left
            const mStart = change.modifiedStartLineNumber, mEnd = change.modifiedEndLineNumber;
            const oStart = change.originalStartLineNumber, oEnd = change.originalEndLineNumber;
            let text, range;

            if (mEnd === 0) {
                // Pure deletion: modified has nothing here → delete the original lines entirely.
                if (oEnd < origModel.getLineCount()) {
                    range = new monaco.Range(oStart, 1, oEnd + 1, 1);
                } else {
                    const prevEndCol = oStart > 1 ? origModel.getLineMaxColumn(oStart - 1) : 1;
                    range = new monaco.Range(Math.max(oStart - 1, 1), prevEndCol,
                        oEnd, origModel.getLineMaxColumn(oEnd));
                }
                text = '';

            } else if (oEnd === 0) {
                // Pure insertion: modified has lines mStart..mEnd that don't exist in original.
                // Monaco sets oStart = the line in original AFTER WHICH to insert.
                const srcText = modModel.getValueInRange(
                    new monaco.Range(mStart, 1, mEnd, modModel.getLineMaxColumn(mEnd)));
                if (oStart === 0) {
                    text = srcText + '\n';
                    range = new monaco.Range(1, 1, 1, 1);
                } else {
                    const endCol = origModel.getLineMaxColumn(oStart);
                    text = '\n' + srcText;
                    range = new monaco.Range(oStart, endCol, oStart, endCol);
                }

            } else {
                // Modification: replace the original range with the modified text.
                text = modModel.getValueInRange(
                    new monaco.Range(mStart, 1, mEnd, modModel.getLineMaxColumn(mEnd)));
                range = new monaco.Range(oStart, 1, oEnd, origModel.getLineMaxColumn(oEnd));
            }
            origModel.pushEditOperations([], [{ range, text }], () => null);
        }
    }

    function applyMergeAll(direction) {
        const editor = !folderResultsContainer.classList.contains('hidden') ? folderDiffEditor : textDiffEditor;
        if (!editor || !editor.getModel()) return showToast('No active diff editor.', 'warning');
        const changes = editor.getLineChanges() || [];
        if (changes.length === 0) return showToast('No differences detected — nothing to merge.', 'info');
        const origModel = editor.getModel().original;
        const modModel = editor.getModel().modified;
        if (direction === 'to-right') {
            modModel.setValue(origModel.getValue());
            showToast('Merged all changes → Modified.', 'success');
        } else {
            origModel.setValue(modModel.getValue());
            showToast('Merged all changes ← Original.', 'success');
        }
    }

    if (mergeAllRightBtn) mergeAllRightBtn.addEventListener('click', () => applyMergeAll('to-right'));
    if (mergeAllLeftBtn) mergeAllLeftBtn.addEventListener('click', () => applyMergeAll('to-left'));


    // ==========================================
    // EXPORT PATCH
    // ==========================================
    exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', () => exportMenu.classList.add('hidden'));

    function buildUnifiedDiff(origText, modText) {
        const origLines = origText.split('\n');
        const modLines = modText.split('\n');
        let patch = `--- Original\n+++ Modified\n`;
        // Simple unified diff — group using Monaco's changes for accuracy
        const editor = !folderResultsContainer.classList.contains('hidden') ? folderDiffEditor : textDiffEditor;
        if (!editor || !editor.getModel()) return patch + origLines.map(l => `-${l}`).join('\n') + '\n';
        const changes = editor.getLineChanges() || [];
        if (changes.length === 0) return patch + '(no differences)\n';

        changes.forEach(c => {
            const oS = c.originalStartLineNumber, oE = c.originalEndLineNumber || 0;
            const mS = c.modifiedStartLineNumber, mE = c.modifiedEndLineNumber || 0;
            patch += `@@ -${oS},${Math.max(oE - oS + 1, 0)} +${mS},${Math.max(mE - mS + 1, 0)} @@\n`;
            for (let i = oS; i <= oE && oE > 0; i++) patch += `-${origLines[i - 1] ?? ''}\n`;
            for (let i = mS; i <= mE && mE > 0; i++) patch += `+${modLines[i - 1] ?? ''}\n`;
        });
        return patch;
    }

    exportPatchBtn.addEventListener('click', () => {
        if (!textOriginalModel || !textModifiedModel) {
            showToast('Run a comparison first before exporting.', 'warning');
            return;
        }
        const patch = buildUnifiedDiff(textOriginalModel.getValue(), textModifiedModel.getValue());
        const blob = new Blob([patch], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'diff.patch'; a.click();
        URL.revokeObjectURL(url);
        showToast('Patch file downloaded.', 'success');
        exportMenu.classList.add('hidden');
    });

    exportCopyBtn.addEventListener('click', async () => {
        if (!textOriginalModel || !textModifiedModel) {
            showToast('Run a comparison first before exporting.', 'warning');
            return;
        }
        const patch = buildUnifiedDiff(textOriginalModel.getValue(), textModifiedModel.getValue());
        try {
            await navigator.clipboard.writeText(patch);
            showToast('Unified diff copied to clipboard!', 'success');
        } catch {
            showToast('Failed to copy to clipboard.', 'error');
        }
        exportMenu.classList.add('hidden');
    });


    // ==========================================
    // FOLDER DIFF
    // ==========================================
    origFolderInput.addEventListener('change', (e) => {
        originalFiles.clear();
        if (e.target.files.length > 0) {
            const root = e.target.files[0].webkitRelativePath.split('/')[0];
            origFolderName.textContent = `${root}/ (${e.target.files.length} files)`;
            origFolderName.classList.add('selected');
            Array.from(e.target.files).forEach(f => {
                const rel = f.webkitRelativePath.substring(f.webkitRelativePath.indexOf('/') + 1);
                originalFiles.set(rel, f);
            });
        }
        checkFoldersReady();
    });

    modFolderInput.addEventListener('change', (e) => {
        modifiedFiles.clear();
        if (e.target.files.length > 0) {
            const root = e.target.files[0].webkitRelativePath.split('/')[0];
            modFolderName.textContent = `${root}/ (${e.target.files.length} files)`;
            modFolderName.classList.add('selected');
            Array.from(e.target.files).forEach(f => {
                const rel = f.webkitRelativePath.substring(f.webkitRelativePath.indexOf('/') + 1);
                modifiedFiles.set(rel, f);
            });
        }
        checkFoldersReady();
    });

    function checkFoldersReady() {
        compareFoldersBtn.disabled = !(originalFiles.size > 0 && modifiedFiles.size > 0);
    }

    compareFoldersBtn.addEventListener('click', async () => {
        folderSetupPanelsWrap.classList.add('hidden');
        actionBarFolder.classList.add('hidden');
        folderResultsContainer.classList.remove('hidden');
        fileDiffStatusMap.clear();

        showToast('Comparing folders (analyzing metadata and small file hashes)...', 'info', 3000);

        const allPaths = new Set([...originalFiles.keys(), ...modifiedFiles.keys()]);
        for (const path of allPaths) {
            const inOrig = originalFiles.has(path);
            const inMod = modifiedFiles.has(path);
            if (inOrig && !inMod) {
                fileDiffStatusMap.set(path, { status: 'removed' });
            } else if (!inOrig && inMod) {
                fileDiffStatusMap.set(path, { status: 'added' });
            } else {
                const o = originalFiles.get(path), m = modifiedFiles.get(path);
                let changed = o.size !== m.size || o.lastModified !== m.lastModified;

                // If metadata matches, fallback to hashing for files < 5MB
                if (!changed && o.size < 5 * 1024 * 1024) {
                    try {
                        const [bufO, bufM] = await Promise.all([o.arrayBuffer(), m.arrayBuffer()]);
                        const [hashO, hashM] = await Promise.all([
                            crypto.subtle.digest('SHA-256', bufO),
                            crypto.subtle.digest('SHA-256', bufM)
                        ]);
                        const strO = Array.from(new Uint8Array(hashO)).join(',');
                        const strM = Array.from(new Uint8Array(hashM)).join(',');
                        changed = strO !== strM;
                    } catch (e) {
                        console.warn("Failed to hash " + path, e);
                    }
                }

                fileDiffStatusMap.set(path, {
                    status: changed ? 'modified' : 'unchanged'
                });
            }
        }
        renderFileTree();
    });

    // Filter chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active-filter'));
            chip.classList.add('active-filter');
            currentFolderFilter = chip.dataset.filter;
            renderFileTree();
        });
    });

    function renderFileTree() {
        fileTreeEl.innerHTML = '';
        const paths = Array.from(fileDiffStatusMap.keys()).sort();
        let visibleCount = 0;

        paths.forEach(path => {
            const meta = fileDiffStatusMap.get(path);
            if (meta.status === 'unchanged') return;
            if (currentFolderFilter !== 'all' && meta.status !== currentFolderFilter) return;
            visibleCount++;

            const li = document.createElement('li');
            li.className = 'tree-item';

            const dot = document.createElement('div');
            dot.className = `status-indicator status-${meta.status}`;

            const txt = document.createElement('span');
            txt.className = 'file-path-text';
            txt.textContent = path;
            txt.title = path;

            li.appendChild(dot);
            li.appendChild(txt);
            li.addEventListener('click', () => {
                document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
                openFileDiff(path, meta.status);
            });
            fileTreeEl.appendChild(li);
        });

        if (changedFilesCount) changedFilesCount.textContent = visibleCount;

        if (visibleCount === 0) {
            const li = document.createElement('li');
            li.style.cssText = 'padding:1rem 0.85rem; font-size:0.8rem; color:var(--text-muted);';
            li.textContent = currentFolderFilter === 'all'
                ? 'No differences detected between the two folders.'
                : `No ${currentFolderFilter} files.`;
            fileTreeEl.appendChild(li);
        }
    }

    async function openFileDiff(path, status) {
        const emptyState = folderEditorHost.querySelector('.empty-state');
        if (emptyState) emptyState.style.display = 'none';
        let origTxt = '', modTxt = '';
        try {
            if (status === 'modified' || status === 'removed') origTxt = await originalFiles.get(path).text();
            if (status === 'modified' || status === 'added') modTxt = await modifiedFiles.get(path).text();
        } catch (e) {
            showError("Failed to open diff for " + path + ": " + e.message);
            origTxt = 'Error reading original file.';
            modTxt = 'Error reading modified file.';
        }
        if (!folderDiffEditor) {
            initFolderDiffEditor(origTxt, modTxt, path);
        } else {
            folderOriginalModel.setValue(origTxt);
            folderModifiedModel.setValue(modTxt);
            updateEditorLanguage(folderOriginalModel, folderModifiedModel, origTxt || modTxt, path);
        }
    }

    function initFolderDiffEditor(origTxt, modTxt, path) {
        const emptyState = folderEditorHost.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        folderDiffEditor = monaco.editor.createDiffEditor(folderEditorHost, {
            theme: themeSelect.value,
            renderSideBySide: true,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', monospace",
            lineHeight: 22,
            minimap: { enabled: false },
            padding: { top: 16, bottom: 16 },
            originalEditable: true,
            glyphMargin: true,
            renderMarginRevertIcon: false
        });

        folderOriginalModel = monaco.editor.createModel(origTxt, 'plaintext');
        folderModifiedModel = monaco.editor.createModel(modTxt, 'plaintext');
        folderDiffEditor.setModel({ original: folderOriginalModel, modified: folderModifiedModel });
        updateEditorLanguage(folderOriginalModel, folderModifiedModel, origTxt || modTxt, path);
        setupFloatingMergeIcons(folderDiffEditor);
    }


    // ==========================================
    // LANGUAGE DETECTION + SELECTION
    // ==========================================
    languageSelect.addEventListener('change', (e) => {
        const lang = e.target.value;
        if (lang !== 'auto') {
            if (textOriginalModel) monaco.editor.setModelLanguage(textOriginalModel, lang);
            if (textModifiedModel) monaco.editor.setModelLanguage(textModifiedModel, lang);
            if (folderOriginalModel) monaco.editor.setModelLanguage(folderOriginalModel, lang);
            if (folderModifiedModel) monaco.editor.setModelLanguage(folderModifiedModel, lang);
        } else {
            if (textOriginalModel) updateEditorLanguage(textOriginalModel, textModifiedModel, textOriginalModel.getValue());
            if (folderOriginalModel) {
                const active = document.querySelector('.tree-item.active .file-path-text');
                updateEditorLanguage(folderOriginalModel, folderModifiedModel, folderOriginalModel.getValue(), active?.textContent);
            }
        }
    });

    themeSelect.addEventListener('change', (e) => {
        const theme = e.target.value;

        // Always clear previous overrides first
        document.documentElement.removeAttribute('data-theme');
        document.body.style.background = '';
        document.body.style.color = '';

        if (theme === 'ios-glass') {
            if (window.monaco) monaco.editor.setTheme('vs-dark');
            document.documentElement.setAttribute('data-theme', 'ios-glass');
            document.body.style.background = '#dce8ff';
            document.body.style.color = '#1c1c1e';
        } else if (theme === 'hc-black') {
            if (window.monaco) monaco.editor.setTheme('hc-black');
            document.documentElement.setAttribute('data-theme', 'high-contrast');
            document.body.style.background = '#000000';
            document.body.style.color = '#ffffff';
        } else if (theme === 'vs') {
            if (window.monaco) monaco.editor.setTheme('vs');
            document.body.style.background = '#ffffff';
            document.body.style.color = '#111827';
        } else {
            if (window.monaco) monaco.editor.setTheme(theme);
        }
    });

    function getLanguageFromPath(path) {
        if (!path) return null;
        const filename = path.split('/').pop().toLowerCase();
        if (filename === 'dockerfile') return 'dockerfile';
        if (filename === 'jenkinsfile') return 'groovy';
        const ext = filename.split('.').pop();
        const map = {
            'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
            'py': 'python', 'html': 'html', 'htm': 'html', 'css': 'css', 'scss': 'scss', 'less': 'less',
            'json': 'json', 'md': 'markdown', 'xml': 'xml', 'svg': 'xml', 'yml': 'yaml', 'yaml': 'yaml',
            'sh': 'shell', 'bash': 'shell', 'c': 'c', 'cpp': 'cpp', 'h': 'c', 'hpp': 'cpp',
            'cs': 'csharp', 'go': 'go', 'rs': 'rust', 'php': 'php', 'rb': 'ruby', 'java': 'java',
            'swift': 'swift', 'kt': 'kotlin', 'sql': 'sql', 'tf': 'terraform', 'tfvars': 'terraform',
            'log': 'plaintext', 'txt': 'plaintext', 'gitignore': 'plaintext', 'env': 'plaintext'
        };
        return map[ext] || null;
    }

    function detectLanguage(text) {
        if (!text || !window.hljs) return null;
        try {
            const result = hljs.highlightAuto(text.substring(0, 1200));
            let detected = result.language || (result.secondBest && result.secondBest.language);
            if (!detected) return 'plaintext';
            const map = {
                'js': 'javascript', 'ts': 'typescript', 'bash': 'shell', 'sh': 'shell',
                'xml': 'html', 'py': 'python', 'yml': 'yaml', 'yaml': 'yaml', 'groovy': 'groovy',
                'java': 'java', 'cpp': 'cpp', 'c': 'c', 'cs': 'csharp', 'go': 'go', 'rust': 'rust',
                'php': 'php', 'ruby': 'ruby', 'swift': 'swift', 'kotlin': 'kotlin', 'sql': 'sql',
                'dockerfile': 'dockerfile', 'json': 'json', 'markdown': 'markdown', 'md': 'markdown'
            };
            return map[detected] || detected;
        } catch {
            return null;
        }
    }

    function updateEditorLanguage(origModel, modModel, textHint, pathHint = null) {
        let lang = languageSelect.value;
        if (lang === 'auto') {
            lang = getLanguageFromPath(pathHint) || detectLanguage(textHint) || 'plaintext';
            if (langLabelContainer && langNameSpan) {
                langNameSpan.textContent = lang;
                langLabelContainer.classList.remove('hidden');
            }
        } else {
            if (langLabelContainer) langLabelContainer.classList.add('hidden');
        }
        if (origModel) monaco.editor.setModelLanguage(origModel, lang);
        if (modModel) monaco.editor.setModelLanguage(modModel, lang);
    }


    // ==========================================
    // WINDOW RESIZE
    // ==========================================
    window.addEventListener('resize', () => {
        if (textDiffEditor) textDiffEditor.layout();
        if (folderDiffEditor) folderDiffEditor.layout();
    });

});

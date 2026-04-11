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
    // AUTO-SELECT TAB FROM URL PARAM (MOVED TO BOTTOM)
    // ==========================================
    // The immediate invocation of applyTabFromUrl was moved 
    // to the end of DOMContentLoaded to fix a race condition
    // where tabs weren't switching correctly because listeners 
    // hadn't been attached yet.

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
    
    // Updated references for Folder Editor Host
    const folderEditorWrapper = document.getElementById('folder-editor-wrapper');
    const folderEditorHost = document.getElementById('folder-monaco-diff-editor');
    const dualTreeLayer = document.getElementById('dual-tree-layer');
    const backToFoldersBtn = document.getElementById('back-to-folders-btn');
    const activeDiffFileName = document.getElementById('active-diff-file-name');
    const folderDiffTitles = document.getElementById('folder-diff-titles');
    const folderTitleLeft = document.getElementById('folder-title-left');
    const folderTitleRight = document.getElementById('folder-title-right');
    
    const changedFilesCount = document.getElementById('changed-files-count');

    // New folder table layout elements
    const folderTableLeft = document.getElementById('folder-table-left');
    const folderTableRight = document.getElementById('folder-table-right');
    const folderPanelNameLeft = document.getElementById('folder-panel-name-left');
    const folderPanelNameRight = document.getElementById('folder-panel-name-right');
    const folderPanelSizeLeft = document.getElementById('folder-panel-size-left');
    const folderPanelSizeRight = document.getElementById('folder-panel-size-right');
    const reselectLeftBtn = document.getElementById('reselect-left-btn');
    const reselectRightBtn = document.getElementById('reselect-right-btn');
    const countRemovedEl = document.getElementById('count-removed');
    const countAddedEl = document.getElementById('count-added');
    const countChangedEl = document.getElementById('count-changed');
    const countUnchangedEl = document.getElementById('count-unchanged');
    const expandAllBtn = document.getElementById('expand-all-btn');
    const collapseAllBtn = document.getElementById('collapse-all-btn');

    // Folder Stats Bar
    const folderStatsBar = document.getElementById('folder-stats-bar');
    const folderStatAdditionsCount = document.getElementById('folder-stat-additions-count');
    const folderStatDeletionsCount = document.getElementById('folder-stat-deletions-count');
    const folderStatChangesCount = document.getElementById('folder-stat-changes-count');
    const folderLangLabelContainer = document.getElementById('folder-detected-language-label');
    const folderLangNameSpan = document.getElementById('folder-lang-name');
    const folderMergeAllRightBtn = document.getElementById('folder-merge-all-right-btn');
    const folderMergeAllLeftBtn = document.getElementById('folder-merge-all-left-btn');
    const folderToggleInlineBtn = document.getElementById('folder-toggle-inline-btn');

    // Header dynamic elements
    const toolHeaderIcon = document.getElementById('tool-header-icon');
    const toolHeaderName = document.getElementById('tool-header-name');
    const toolIdentity = document.getElementById('tool-identity');

    const FEATURE_ICONS = {
        'text-diff': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9" />
        </svg>`,
        'folder-diff': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>`
    };

    const FEATURE_NAMES = {
        'text-diff': `Text <span class="tool-accent">Diff</span>`,
        'folder-diff': `Folder <span class="tool-accent">Diff</span>`
    };

    if (toolIdentity) {
        toolIdentity.style.cursor = 'pointer';
        toolIdentity.title = 'Reset to setup screen';
        toolIdentity.style.transition = 'opacity 0.15s ease';
        toolIdentity.addEventListener('mouseenter', () => toolIdentity.style.opacity = '0.8');
        toolIdentity.addEventListener('mouseleave', () => toolIdentity.style.opacity = '1');
        toolIdentity.addEventListener('click', () => {
            const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab;
            if (activeTab === 'folder-diff') {
                folderResultsContainer.classList.add('hidden');
                folderSetupPanelsWrap.classList.remove('hidden');
                actionBarFolder.classList.remove('hidden');
            } else if (activeTab === 'text-diff') {
                textDiffContainer.style.display = 'none';
                textDiffContainer.classList.add('hidden');
                inputPanels.style.display = 'flex';
                inputPanels.style.flex = '1';
                inputPanels.style.overflow = 'hidden';
                actionBarText.style.display = 'flex';
            }
        });
    }

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
    let origFolderRootName = 'Folder 1';
    let modFolderRootName = 'Folder 2';
    let origFolderTotalSize = 0;
    let modFolderTotalSize = 0;
    let collapsedFolderPaths = new Set(); // tracks which folder paths are collapsed


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
    /**
     * Update the UI's diff statistics (additions, deletions, and number of changes) from a Monaco diff editor.
     * @param {object} diffEditor - Monaco diff editor instance used to derive line changes.
     * @param {boolean} [isFolder=false] - When true, update the folder-specific stats elements; otherwise update the text-mode stats elements.
     */
    function updateDiffStats(diffEditor, isFolder = false) {
        const changes = diffEditor.getLineChanges() || [];
        let additions = 0, deletions = 0;

        changes.forEach(c => {
            const origLines = (c.originalEndLineNumber - c.originalStartLineNumber + 1) || 0;
            const modLines = (c.modifiedEndLineNumber - c.modifiedStartLineNumber + 1) || 0;
            additions += modLines > 0 ? modLines : 0;
            deletions += origLines > 0 ? origLines : 0;
        });

        if (isFolder) {
            folderStatAdditionsCount.textContent = additions;
            folderStatDeletionsCount.textContent = deletions;
            folderStatChangesCount.textContent = changes.length;
        } else {
            statAdditionsCount.textContent = additions;
            statDeletionsCount.textContent = deletions;
            statChangesCount.textContent = changes.length;
        }
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
            const id = btn.dataset.tab;
            for (const b of tabBtns) b.classList.remove('active');
            for (const c of tabContents) c.classList.remove('active');
            btn.classList.add('active');
            document.getElementById(id).classList.add('active');

            // Update Header Icon and Name
            if (toolHeaderIcon) {
                toolHeaderIcon.innerHTML = FEATURE_ICONS[id] || '';
                toolHeaderIcon.className = `tool-icon tool-icon-${id === 'folder-diff' ? 'amber' : 'indigo'}`;
            }
            if (toolHeaderName) {
                toolHeaderName.innerHTML = FEATURE_NAMES[id] || 'Diff Tool';
            }

            setTimeout(() => {
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

    if (backToFoldersBtn) {
        backToFoldersBtn.addEventListener('click', () => {
            folderEditorWrapper.classList.add('hidden');
            if (dualTreeLayer) dualTreeLayer.classList.remove('hidden');
        });
    }

    // Reselect buttons — re-open OS folder picker for each side
    if (reselectLeftBtn) reselectLeftBtn.addEventListener('click', () => origFolderInput.click());
    if (reselectRightBtn) reselectRightBtn.addEventListener('click', () => modFolderInput.click());

    // Expand All / Collapse All
    if (expandAllBtn) expandAllBtn.addEventListener('click', () => {
        collapsedFolderPaths.clear();
        renderFileTree();
    });
    if (collapseAllBtn) collapseAllBtn.addEventListener('click', () => {
        const allPaths = new Set([...originalFiles.keys(), ...modifiedFiles.keys()]);
        allPaths.forEach(filePath => {
            const parts = filePath.split('/');
            for (let depth = 1; depth < parts.length; depth++) {
                const folderPath = parts.slice(0, depth).join('/');
                collapsedFolderPaths.add(folderPath + '|left');
                collapsedFolderPaths.add(folderPath + '|right');
            }
        });
        renderFileTree();
    });

    if (folderToggleInlineBtn) {
        folderToggleInlineBtn.addEventListener('click', () => {
            if (!folderDiffEditor) return;
            const nowInline = folderToggleInlineBtn.classList.contains('active');
            folderDiffEditor.updateOptions({ renderSideBySide: nowInline });
            folderToggleInlineBtn.classList.toggle('active', !nowInline);
            folderToggleInlineBtn.textContent = nowInline ? 'Inline View' : 'Side‑by‑Side';
            setTimeout(() => folderDiffEditor.layout(), 50);
        });
    }

    /**
     * Initialize the text diff Monaco editor and its models, set the editor language, wire merge controls, and start diff statistics updates.
     *
     * If the Monaco environment is not available, shows an error toast and re-enables the compare button instead of initializing.
     *
     * @param {string} originalTxt - Initial content for the original (left) side model.
     * @param {string} modifiedTxt - Initial content for the modified (right) side model.
     */
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
            renderMarginRevertIcon: false,
            folding: false,
            showFoldingControls: 'never',
            lineDecorationsWidth: 0
        });

        textOriginalModel = monaco.editor.createModel(originalTxt, 'plaintext');
        textModifiedModel = monaco.editor.createModel(modifiedTxt, 'plaintext');
        textDiffEditor.setModel({ original: textOriginalModel, modified: textModifiedModel });
        updateEditorLanguage(textOriginalModel, textModifiedModel, originalTxt);
        setupFloatingMergeIcons(textDiffEditor);

        textDiffEditor.onDidUpdateDiff(() => updateDiffStats(textDiffEditor, false));
    }


    // ==========================================
    // MERGE ARROWS — Glyph Margin Decorations
    /**
     * Adds clickable merge glyphs to a Monaco diff editor and wires handlers to copy individual hunks between sides.
     *
     * Sets glyph-margin-related editor options on both original and modified sub-editors, creates and updates glyph decorations
     * for each line change, and registers mouse handlers that invoke the merge action when a glyph is clicked. Also subscribes
     * to diff updates to refresh decorations.
     *
     * @param {import('monaco-editor').editor.IStandaloneDiffEditor} diffEditor - The Monaco diff editor to augment.
     */
    function setupFloatingMergeIcons(diffEditor) {
        const origEditor = diffEditor.getOriginalEditor();
        const modEditor = diffEditor.getModifiedEditor();

        origEditor.updateOptions({ glyphMargin: true, folding: false, showFoldingControls: 'never', lineDecorationsWidth: 0, renderMarginRevertIcon: false });
        modEditor.updateOptions({ glyphMargin: true, folding: false, showFoldingControls: 'never', lineDecorationsWidth: 0, renderMarginRevertIcon: false });

        const origCollection = origEditor.createDecorationsCollection();
        const modCollection = modEditor.createDecorationsCollection();

        /**
         * Add glyph-margin merge arrow decorations to the diff editor's original and modified panes.
         *
         * Scans the current line changes and places a right-arrow glyph on original-side change start lines
         * and a left-arrow glyph on modified-side change start lines; also ensures the underlying editors'
         * options support the glyph margin before applying the decorations.
         */
        function applyDecorations() {
            origEditor.updateOptions({ glyphMargin: true, folding: false, showFoldingControls: 'never', lineDecorationsWidth: 0, renderMarginRevertIcon: false });
            modEditor.updateOptions({ glyphMargin: true, folding: false, showFoldingControls: 'never', lineDecorationsWidth: 0, renderMarginRevertIcon: false });

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
    
    if (folderMergeAllRightBtn) folderMergeAllRightBtn.addEventListener('click', () => applyMergeAll('to-right'));
    if (folderMergeAllLeftBtn) folderMergeAllLeftBtn.addEventListener('click', () => applyMergeAll('to-left'));


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
        origFolderTotalSize = 0;
        if (e.target.files.length > 0) {
            const root = e.target.files[0].webkitRelativePath.split('/')[0];
            origFolderRootName = root;
            Array.from(e.target.files).forEach(f => {
                const rel = f.webkitRelativePath.substring(f.webkitRelativePath.indexOf('/') + 1);
                originalFiles.set(rel, f);
                origFolderTotalSize += f.size;
            });
            origFolderName.textContent = `${root}/ (${e.target.files.length} files)`;
            origFolderName.classList.add('selected');
        }
        checkFoldersReady();
        if (!folderResultsContainer.classList.contains('hidden')) compareFoldersBtn.click();
    });

    modFolderInput.addEventListener('change', (e) => {
        modifiedFiles.clear();
        modFolderTotalSize = 0;
        if (e.target.files.length > 0) {
            const root = e.target.files[0].webkitRelativePath.split('/')[0];
            modFolderRootName = root;
            Array.from(e.target.files).forEach(f => {
                const rel = f.webkitRelativePath.substring(f.webkitRelativePath.indexOf('/') + 1);
                modifiedFiles.set(rel, f);
                modFolderTotalSize += f.size;
            });
            modFolderName.textContent = `${root}/ (${e.target.files.length} files)`;
            modFolderName.classList.add('selected');
        }
        checkFoldersReady();
        if (!folderResultsContainer.classList.contains('hidden')) compareFoldersBtn.click();
    });

    function checkFoldersReady() {
        compareFoldersBtn.disabled = !(originalFiles.size > 0 && modifiedFiles.size > 0);
    }

    compareFoldersBtn.addEventListener('click', async () => {
        folderSetupPanelsWrap.classList.add('hidden');
        actionBarFolder.classList.add('hidden');
        folderResultsContainer.classList.remove('hidden');
        
        // Reset Master-Detail state to ensure Dual Tree is always visible on new compare
        if (dualTreeLayer) dualTreeLayer.classList.remove('hidden');
        if (folderEditorWrapper) folderEditorWrapper.classList.add('hidden');

        fileDiffStatusMap.clear();

        // Populate panel headers
        if (folderPanelNameLeft) folderPanelNameLeft.textContent = origFolderRootName;
        if (folderPanelSizeLeft) folderPanelSizeLeft.textContent = formatFolderSize(origFolderTotalSize);
        if (folderPanelNameRight) folderPanelNameRight.textContent = modFolderRootName;
        if (folderPanelSizeRight) folderPanelSizeRight.textContent = formatFolderSize(modFolderTotalSize);

        // Also populate legacy title bar (used in Monaco editor view)
        if (folderTitleLeft) folderTitleLeft.textContent = origFolderRootName + ' (Original)';
        if (folderTitleRight) folderTitleRight.textContent = modFolderRootName + ' (Modified)';

        showToast('Comparing folders…', 'info', 2500);
        await rerunComparison();
    });

    /**
     * (Re-)compute fileDiffStatusMap from the current originalFiles / modifiedFiles
     * and refresh the tree UI. Called by the compare button and by move operations.
     */
    async function rerunComparison() {
        fileDiffStatusMap.clear();
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
                fileDiffStatusMap.set(path, { status: changed ? 'modified' : 'unchanged' });
            }
        }
        renderFileTree();
    }

    // Filter chips
    document.querySelectorAll('.folder-filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.folder-filter-chip').forEach(c => c.classList.remove('active-filter'));
            chip.classList.add('active-filter');
            currentFolderFilter = chip.dataset.filter;
            renderFileTree();
        });
    });

    /**
     * Rebuild both hierarchical tree panels from the current file maps and diff status.
     * Updates summary chips and renders each panel as an expand/collapse folder tree.
     */
    function renderFileTree() {
        if (!folderTableLeft || !folderTableRight) return;

        // --- Summary counts (always full, ignoring filter) ---
        let countRemoved = 0, countAdded = 0, countChanged = 0, countUnchanged = 0;
        fileDiffStatusMap.forEach(m => {
            if (m.status === 'removed') countRemoved++;
            else if (m.status === 'added') countAdded++;
            else if (m.status === 'modified') countChanged++;
            else countUnchanged++;
        });
        if (countRemovedEl)   countRemovedEl.textContent   = countRemoved;
        if (countAddedEl)     countAddedEl.textContent     = countAdded;
        if (countChangedEl)   countChangedEl.textContent   = countChanged;
        if (countUnchangedEl) countUnchangedEl.textContent = countUnchanged;

        // --- Build & render trees ---
        const leftTree  = buildFileTree(originalFiles, fileDiffStatusMap);
        const rightTree = buildFileTree(modifiedFiles, fileDiffStatusMap);

        folderTableLeft.innerHTML  = '';
        folderTableRight.innerHTML = '';

        renderTreeNodes(leftTree,  folderTableLeft,  'left');
        renderTreeNodes(rightTree, folderTableRight, 'right');

        if (!folderTableLeft.children.length)
            folderTableLeft.innerHTML  = '<div class="folder-table-empty">No files to show</div>';
        if (!folderTableRight.children.length)
            folderTableRight.innerHTML = '<div class="folder-table-empty">No files to show</div>';
    }

    // ─── Tree building ────────────────────────────────────────────────────────

    /**
     * Convert a flat Map<relPath, File> into a sorted hierarchical node array.
     * Each node: { isFolder, name, path, children?, status, file? }
     */
    function buildFileTree(fileMap, statusMap) {
        const root = [];
        const nodeByPath = new Map();

        Array.from(fileMap.keys()).sort().forEach(filePath => {
            const parts = filePath.split('/');
            const status = statusMap.get(filePath)?.status || 'unchanged';

            // Ensure all ancestor folder nodes exist
            for (let depth = 0; depth < parts.length - 1; depth++) {
                const folderPath = parts.slice(0, depth + 1).join('/');
                if (!nodeByPath.has(folderPath)) {
                    const node = { isFolder: true, name: parts[depth], path: folderPath, children: [], status: 'unchanged' };
                    nodeByPath.set(folderPath, node);
                    const parentPath = parts.slice(0, depth).join('/');
                    (depth === 0 ? root : nodeByPath.get(parentPath).children).push(node);
                }
            }

            // Leaf file node
            const fileNode = { isFolder: false, name: parts.at(-1), path: filePath, status, file: fileMap.get(filePath) };
            const parentPath = parts.slice(0, -1).join('/');
            (parts.length === 1 ? root : nodeByPath.get(parentPath).children).push(fileNode);
        });

        // Propagate status up to folders
        const propagate = nodes => nodes.forEach(n => {
            if (!n.isFolder) return;
            propagate(n.children);
            const statuses = allFileStatuses(n);
            if (statuses.every(s => s === 'unchanged')) n.status = 'unchanged';
            else if (statuses.every(s => s === 'removed')) n.status = 'removed';
            else if (statuses.every(s => s === 'added'))   n.status = 'added';
            else if (statuses.every(s => s === 'modified')) n.status = 'modified';
            else n.status = 'mixed';
        });
        propagate(root);
        return root;
    }

    function allFileStatuses(node) {
        if (!node.isFolder) return [node.status];
        return node.children.flatMap(c => allFileStatuses(c));
    }

    // ─── Tree rendering ───────────────────────────────────────────────────────

    function renderTreeNodes(nodes, container, side) {
        nodes.forEach(node => {
            if (!treeNodePassesFilter(node, side)) return;
            if (node.isFolder) {
                const wrap = document.createElement('div');
                wrap.className = 'tree-node-wrap';

                const row = buildFolderRow(node, side);
                wrap.appendChild(row);

                const childrenEl = document.createElement('div');
                childrenEl.className = 'tree-children';
                if (collapsedFolderPaths.has(node.path + '|' + side)) childrenEl.classList.add('collapsed');

                renderTreeNodes(node.children, childrenEl, side);
                wrap.appendChild(childrenEl);

                // Toggle wires the caret and children visibility
                const toggle = row.querySelector('.tree-toggle');
                toggle.addEventListener('click', e => {
                    e.stopPropagation();
                    const key = node.path + '|' + side;
                    const nowCollapsed = collapsedFolderPaths.has(key);
                    if (nowCollapsed) collapsedFolderPaths.delete(key);
                    else collapsedFolderPaths.add(key);
                    childrenEl.classList.toggle('collapsed', !nowCollapsed);
                    toggle.classList.toggle('rotated', !nowCollapsed);
                });

                container.appendChild(wrap);
            } else {
                container.appendChild(buildTreeFileRow(node, side));
            }
        });
    }

    /** Returns true if the node (or any descendant) should be visible for the current filter + side. */
    function treeNodePassesFilter(node, side) {
        const f = currentFolderFilter;
        if (f === 'all') return true;
        // 'added' files only appear on right; 'removed' files only on left
        if (f === 'added'   && side === 'left')  return false;
        if (f === 'removed' && side === 'right') return false;
        if (!node.isFolder) return node.status === f;
        return node.children.some(c => treeNodePassesFilter(c, side));
    }

    // ─── Row builders ─────────────────────────────────────────────────────────

    function buildFolderRow(node, side) {
        const row = document.createElement('div');
        const collapsed = collapsedFolderPaths.has(node.path + '|' + side);
        const statusClass = (node.status !== 'unchanged' && node.status !== 'mixed')
            ? `folder-status-${node.status}` : '';
        row.className = `tree-row tree-folder-row ${statusClass}`;
        row.dataset.depth = (node.path.split('/').length - 1);
        row.style.paddingLeft = `${(node.path.split('/').length - 1) * 16 + 8}px`;

        // Caret toggle
        const toggle = document.createElement('span');
        toggle.className = `tree-toggle${collapsed ? ' rotated' : ''}`;
        toggle.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

        // Folder icon
        const icon = document.createElement('span');
        icon.className = 'tree-icon';
        icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>`;

        const name = document.createElement('span');
        name.className = 'tree-name';
        name.textContent = node.name;

        // Status badge for non-unchanged folders
        const badge = document.createElement('span');
        badge.className = 'tree-folder-badge';
        if (node.status === 'removed') badge.textContent = 'removed';
        else if (node.status === 'added') badge.textContent = 'added';
        else if (node.status === 'modified') badge.textContent = 'modified';
        else if (node.status === 'mixed') badge.textContent = 'mixed';

        const spacer = document.createElement('span');
        spacer.style.flex = '1';

        // Move actions
        const actions = buildMoveActions(node, side, true);

        row.appendChild(toggle);
        row.appendChild(icon);
        row.appendChild(name);
        row.appendChild(badge);
        row.appendChild(spacer);
        row.appendChild(actions);

        // Clicking the row (not the toggle) also expands/collapses
        row.addEventListener('click', () => toggle.dispatchEvent(new Event('click', { bubbles: false })));

        return row;
    }

    function buildTreeFileRow(node, side) {
        const rowStatus = node.status === 'modified' ? 'changed' : node.status;
        const row = document.createElement('div');
        row.className = `tree-row tree-file-row folder-row-${rowStatus}`;
        // indent = parent depth × 16 + 8 (panel padding) + 20 (caret placeholder)
        const depth = node.path.split('/').length - 1;
        row.style.paddingLeft = `${depth * 16 + 28}px`;

        // File icon
        const icon = document.createElement('span');
        icon.className = 'tree-icon';
        icon.innerHTML = `<svg width="11" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

        const name = document.createElement('span');
        name.className = 'tree-name';
        name.title = node.path;
        name.textContent = node.name;

        const date = document.createElement('span');
        date.className = 'ftcol-date';
        date.textContent = node.file ? formatFileDate(node.file.lastModified) : '—';

        const size = document.createElement('span');
        size.className = 'ftcol-size';
        size.textContent = node.file ? formatFileSize(node.file.size) : '—';

        const actions = buildMoveActions(node, side, false);

        row.appendChild(icon);
        row.appendChild(name);
        row.appendChild(date);
        row.appendChild(size);
        row.appendChild(actions);

        if (node.status === 'modified') {
            row.classList.add('clickable');
            row.addEventListener('click', () => openFileDiff(node.path, node.status, node.name));
        }
        return row;
    }

    /** Build the move-arrow action buttons for a file or folder row. */
    function buildMoveActions(node, side, isFolder) {
        const wrap = document.createElement('div');
        wrap.className = 'tree-actions';

        const canMoveRight = side === 'left' && node.status !== 'unchanged' && node.status !== 'added';
        const canMoveLeft  = side === 'right' && node.status !== 'unchanged' && node.status !== 'removed';

        if (canMoveRight) {
            const btn = makeMoveBtn('→', 'move-right', isFolder ? `Copy folder to right` : `Copy to right`);
            btn.addEventListener('click', e => {
                e.stopPropagation();
                isFolder ? moveFolderToSide(node, 'right') : moveFileToSide(node.path, 'right');
            });
            wrap.appendChild(btn);
        }
        if (canMoveLeft) {
            const btn = makeMoveBtn('←', 'move-left', isFolder ? `Copy folder to left` : `Copy to left`);
            btn.addEventListener('click', e => {
                e.stopPropagation();
                isFolder ? moveFolderToSide(node, 'left') : moveFileToSide(node.path, 'left');
            });
            wrap.appendChild(btn);
        }
        return wrap;
    }

    function makeMoveBtn(label, cls, title) {
        const btn = document.createElement('button');
        btn.className = `tree-move-btn ${cls}`;
        btn.title = title;
        btn.textContent = label;
        return btn;
    }

    // ─── Move operations ──────────────────────────────────────────────────────

    async function moveFileToSide(path, targetSide) {
        if (targetSide === 'right') {
            const file = originalFiles.get(path);
            if (file) modifiedFiles.set(path, file);
        } else {
            const file = modifiedFiles.get(path);
            if (file) originalFiles.set(path, file);
        }
        await rerunComparison();
        showToast(`Copied "${path.split('/').pop()}" to ${targetSide}.`, 'success');
    }

    function collectFilePaths(node) {
        if (!node.isFolder) return [node.path];
        return node.children.flatMap(c => collectFilePaths(c));
    }

    async function moveFolderToSide(node, targetSide) {
        const paths = collectFilePaths(node);
        paths.forEach(path => {
            if (targetSide === 'right') {
                const f = originalFiles.get(path); if (f) modifiedFiles.set(path, f);
            } else {
                const f = modifiedFiles.get(path); if (f) originalFiles.set(path, f);
            }
        });
        await rerunComparison();
        showToast(`Copied folder "${node.name}" to ${targetSide}.`, 'success');
    }

    /** Format a file's lastModified timestamp as "28 Feb 2024 14:30" */
    function formatFileDate(timestamp) {
        const d = new Date(timestamp);
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${hh}:${mm}`;
    }

    /** Format a file size in bytes as a human-readable string */
    function formatFileSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    /** Format total folder size for panel header */
    function formatFolderSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    /**
     * Open and display a file pair in the folder diff editor and switch the UI to the folder editor view.
     *
     * Loads the original and/or modified file contents according to `status`, updates the active filename shown
     * in the folder UI, and either initializes the folder diff editor or updates its existing models and language.
     *
     * @param {string} path - Relative path of the file within the compared folders.
     * @param {'added'|'removed'|'modified'|'unchanged'} status - Diff status that determines which side(s) to load.
     * @param {string} [fileName] - Optional display name for the active file; if omitted, the basename of `path` is used.
     */
    async function openFileDiff(path, status, fileName = '') {
        if (dualTreeLayer) dualTreeLayer.classList.add('hidden'); // switch layout
        if (folderEditorWrapper) folderEditorWrapper.classList.remove('hidden');
        if (folderEditorHost) folderEditorHost.classList.remove('hidden');
        if (folderStatsBar) folderStatsBar.classList.remove('hidden');
        if (folderDiffTitles) folderDiffTitles.classList.remove('hidden');

        if (activeDiffFileName) activeDiffFileName.textContent = fileName || path.split('/').pop();

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

    /**
     * Initialize and display the folder-mode Monaco diff editor for a given file path.
     *
     * Creates and shows folder editor UI elements, constructs original and modified Monaco models
     * from the provided texts, attaches them to a diff editor, applies language detection based
     * on the text and path, enables merge glyphs, and registers a diff-update hook to refresh
     * folder diff statistics.
     *
     * @param {string} origTxt - The original file contents (may be empty or null).
     * @param {string} modTxt - The modified file contents (may be empty or null).
     * @param {string} path - The file path or name used as a hint for language detection.
     */
    function initFolderDiffEditor(origTxt, modTxt, path) {
        if (folderEditorWrapper) folderEditorWrapper.classList.remove('hidden');
        if (folderEditorHost) folderEditorHost.classList.remove('hidden');
        if (folderStatsBar) folderStatsBar.classList.remove('hidden');
        if (folderDiffTitles) folderDiffTitles.classList.remove('hidden');

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
            renderMarginRevertIcon: false,
            folding: false,
            showFoldingControls: 'never',
            lineDecorationsWidth: 0
        });

        folderOriginalModel = monaco.editor.createModel(origTxt, 'plaintext');
        folderModifiedModel = monaco.editor.createModel(modTxt, 'plaintext');
        folderDiffEditor.setModel({ original: folderOriginalModel, modified: folderModifiedModel });
        updateEditorLanguage(folderOriginalModel, folderModifiedModel, origTxt || modTxt, path);
        setupFloatingMergeIcons(folderDiffEditor);
        
        // Wire up stats dynamically
        folderDiffEditor.onDidUpdateDiff(() => updateDiffStats(folderDiffEditor, true));
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
    /**
     * Activates the tab specified by the page URL's `tab` query parameter, if present.
     *
     * Reads the `tab` value from the current URL (e.g. `?tab=text-diff`), finds the corresponding
     * element matching `.tab-btn[data-tab="<value>"]`, and triggers a click on it to switch tabs.
     */
    function applyTabFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab) {
            const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
            if (btn) btn.click();
        }
    }
    applyTabFromUrl();

});

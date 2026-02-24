/**
 * DiffChecker.io — Application Logic
 * ------------------------------------
 * Handles: Text Diff, Folder Diff, Monaco Editor Init, Merge Arrows,
 * Drag-and-Drop File Upload, Binary File Validation, Language Auto-detection.
 *
 * Architecture:
 *  - 100% client-side file reading via FileReader API (maximum privacy).
 *  - Falls back to `/upload` FastAPI endpoint only if explicitly needed.
 *  - Monaco Diff Editor renders both Text and Folder diffs.
 */

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // DOM ELEMENT REFERENCES
    // ==========================================
    const originalInput      = document.getElementById('original-input');
    const modifiedInput      = document.getElementById('modified-input');
    const compareBtn         = document.getElementById('compare-btn');
    const textDiffContainer  = document.getElementById('diff-container');
    const inputPanels        = document.getElementById('input-panels');
    const actionBarText      = document.getElementById('action-bar-text');
    const toggleInlineBtn    = document.getElementById('toggle-inline-btn');
    const editBtn            = document.getElementById('edit-btn');
    const editorHost         = document.getElementById('monaco-diff-editor');
    const langLabelContainer = document.getElementById('detected-language-label');
    const langNameSpan       = document.getElementById('lang-name');

    // Shared Settings
    const languageSelect     = document.getElementById('language-select');
    const themeSelect        = document.getElementById('theme-select');
    const clearBtns          = document.querySelectorAll('.clear-btn');

    // Tabs
    const tabBtns            = document.querySelectorAll('.tab-btn');
    const tabContents        = document.querySelectorAll('.tab-content');

    // File Upload (new)
    const dropOriginal       = document.getElementById('drop-original');
    const dropModified       = document.getElementById('drop-modified');
    const fileOriginal       = document.getElementById('file-original');
    const fileModified       = document.getElementById('file-modified');
    const labelOriginal      = document.getElementById('label-original');
    const labelModified      = document.getElementById('label-modified');

    // Error Toast
    const errorToast         = document.getElementById('error-toast');
    const errorMessage       = document.getElementById('error-message');

    // Merge Buttons
    const mergeAllRightBtn   = document.getElementById('merge-all-right-btn');
    const mergeAllLeftBtn    = document.getElementById('merge-all-left-btn');

    // Folder Diff
    const origFolderInput        = document.getElementById('original-folder-input');
    const modFolderInput         = document.getElementById('modified-folder-input');
    const origFolderName         = document.getElementById('original-folder-name');
    const modFolderName          = document.getElementById('modified-folder-name');
    const compareFoldersBtn      = document.getElementById('compare-folders-btn');
    const folderSetupPanelsWrap  = document.getElementById('folder-setup-panels-wrapper');
    const actionBarFolder        = document.getElementById('action-bar-folder');
    const folderResultsContainer = document.getElementById('folder-results-container');
    const fileTreeEl             = document.getElementById('file-tree');
    const folderEditorHost       = document.getElementById('folder-editor-wrapper');
    const folderEmptyState       = folderEditorHost.querySelector('.empty-state');

    // ==========================================
    // STATE
    // ==========================================
    let textDiffEditor     = null;
    let textOriginalModel  = null;
    let textModifiedModel  = null;

    let folderDiffEditor   = null;
    let folderOriginalModel = null;
    let folderModifiedModel = null;

    let originalFiles    = new Map();
    let modifiedFiles    = new Map();
    let fileDiffStatusMap = new Map();


    // ==========================================
    // UTILITY: Error Toast
    // ==========================================
    function showError(message, durationMs = 5000) {
        errorMessage.textContent = message;
        errorToast.classList.remove('hidden');
        clearTimeout(showError._timer);
        showError._timer = setTimeout(() => {
            errorToast.classList.add('hidden');
        }, durationMs);
    }


    // ==========================================
    // MONACO INITIALIZATION
    // ==========================================
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
    // Web worker proxy for syntax highlighting performance
    window.MonacoEnvironment = { getWorkerUrl: () => proxy };
    let proxy = URL.createObjectURL(new Blob([`
        self.MonacoEnvironment = { baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/' };
        importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/base/worker/workerMain.js');
    `], { type: 'text/javascript' }));

    require(['vs/editor/editor.main'], () => {
        console.log('[DiffChecker] Monaco Editor loaded successfully.');
    });


    // ==========================================
    // FILE UPLOAD (DRAG-AND-DROP + CLICK)
    // ==========================================

    /**
     * BINARY FILE DETECTION
     * Checks based on MIME type and also by scanning the first 512 bytes for null-bytes.
     */
    function isBinaryFile(file, bytes) {
        const binaryMimes = ['image/', 'video/', 'audio/', 'application/pdf',
                             'application/zip', 'application/octet-stream'];
        if (binaryMimes.some(m => file.type.startsWith(m))) return true;

        // Scan first 512 bytes for null bytes (strong indicator of binary)
        const arr = new Uint8Array(bytes.slice(0, 512));
        for (let i = 0; i < arr.length; i++) {
            if (arr[i] === 0) return true;
        }
        return false;
    }

    /**
     * Reads a File object on the client side (no server upload).
     * Validates it's not binary. Populates the given textarea on success.
     */
    function handleFileUpload(file, labelEl, textareaEl) {
        if (!file) return;

        const arrayReader = new FileReader();
        arrayReader.onload = function (e) {
            if (isBinaryFile(file, e.target.result)) {
                showError(`"${file.name}" appears to be a binary file. Only text-based files are supported.`);
                return;
            }

            // Good file — now read as text
            const textReader = new FileReader();
            textReader.onload = (ev) => {
                textareaEl.value = ev.target.result;
                labelEl.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
            };
            textReader.onerror = () => showError(`Failed to read "${file.name}".`);
            textReader.readAsText(file, 'UTF-8');
        };
        arrayReader.onerror = () => showError(`Failed to inspect "${file.name}".`);
        arrayReader.readAsArrayBuffer(file);
    }

    /**
     * Wires up click-to-upload and drag-and-drop for a dropzone.
     */
    function setupDropzone(dropEl, inputEl, labelEl, textareaEl) {
        inputEl.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleFileUpload(e.target.files[0], labelEl, textareaEl);
        });

        dropEl.addEventListener('dragover',  (e) => { e.preventDefault(); dropEl.classList.add('drag-active'); });
        dropEl.addEventListener('dragleave', ()  => dropEl.classList.remove('drag-active'));
        dropEl.addEventListener('drop', (e) => {
            e.preventDefault();
            dropEl.classList.remove('drag-active');
            if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files[0], labelEl, textareaEl);
        });
    }

    setupDropzone(dropOriginal, fileOriginal, labelOriginal, originalInput);
    setupDropzone(dropModified, fileModified, labelModified, modifiedInput);


    // ==========================================
    // TAB SWITCHING
    // ==========================================
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => { c.classList.remove('active'); });

            btn.classList.add('active');
            const target = document.getElementById(btn.dataset.tab);
            target.classList.add('active');

            // Refresh editor layout when switching back
            setTimeout(() => {
                const id = btn.dataset.tab;
                if (id === 'text-diff' && textDiffEditor && !textDiffContainer.classList.contains('hidden')) {
                    textDiffEditor.layout();
                } else if (id === 'folder-diff' && folderDiffEditor) {
                    folderDiffEditor.layout();
                }
            }, 50);
        });
    });


    // ==========================================
    // TEXT DIFF LOGIC
    // ==========================================
    compareBtn.addEventListener('click', () => {
        const originalText = originalInput.value;
        const modifiedText = modifiedInput.value;

        // Use direct style toggling — more reliable than Tailwind's `hidden` class
        // because CSS specificity between generated utility classes can be unpredictable.
        inputPanels.style.display    = 'none';
        actionBarText.style.display  = 'none';
        textDiffContainer.style.display = 'flex';
        textDiffContainer.style.flexDirection = 'column';
        textDiffContainer.style.flex = '1';
        textDiffContainer.style.overflow = 'hidden';
        // Remove the initial Tailwind hidden class if still present
        textDiffContainer.classList.remove('hidden');

        if (!textDiffEditor) {
            // Defer Monaco creation by one animation frame so the browser has
            // painted the container with real non-zero pixel dimensions first.
            // Without this, Monaco may initialize into a 0x0 box and never recover.
            requestAnimationFrame(() => {
                setTimeout(() => initTextDiffEditor(originalText, modifiedText), 30);
            });
        } else {
            textOriginalModel.setValue(originalText);
            textModifiedModel.setValue(modifiedText);
            updateEditorLanguage(textOriginalModel, textModifiedModel, originalText);
        }
    });

    editBtn.addEventListener('click', () => {
        if (textOriginalModel && textModifiedModel) {
            originalInput.value = textOriginalModel.getValue();
            modifiedInput.value = textModifiedModel.getValue();
        }
        textDiffContainer.style.display   = 'none';
        inputPanels.style.display         = 'flex';
        inputPanels.style.flex            = '1';
        inputPanels.style.overflow        = 'hidden';
        actionBarText.style.display       = 'flex';
    });

    toggleInlineBtn.addEventListener('click', () => {
        if (!textDiffEditor) return;
        const nowInline = toggleInlineBtn.classList.contains('active');
        textDiffEditor.updateOptions({ renderSideBySide: nowInline });
        if (nowInline) {
            toggleInlineBtn.classList.remove('active');
            toggleInlineBtn.textContent = 'Inline View';
        } else {
            toggleInlineBtn.classList.add('active');
            toggleInlineBtn.textContent = 'Side-by-Side View';
        }
        // Re-render merge buttons after layout change
        setTimeout(() => textDiffEditor.layout(), 50);
    });

    function initTextDiffEditor(originalTxt, modifiedTxt) {
        if (!window.monaco) return showError('Editor is still loading. Please try again in a moment.');

        textDiffEditor = monaco.editor.createDiffEditor(editorHost, {
            theme:               themeSelect.value,
            renderSideBySide:    true,
            automaticLayout:     true,
            scrollBeyondLastLine:false,
            fontSize:            14,
            minimap:             { enabled: false },
            padding:             { top: 16, bottom: 16 },
            originalEditable:    true,
            enableSplitViewResizing: true,
            ignoreTrimWhitespace: false,
            glyphMargin:            true,    // required for merge arrow decorations
            renderMarginRevertIcon: false     // suppress built-in arrow so both gutters look identical
        });

        textOriginalModel = monaco.editor.createModel(originalTxt, 'plaintext');
        textModifiedModel = monaco.editor.createModel(modifiedTxt, 'plaintext');
        textDiffEditor.setModel({ original: textOriginalModel, modified: textModifiedModel });
        updateEditorLanguage(textOriginalModel, textModifiedModel, originalTxt);
        setupFloatingMergeIcons(textDiffEditor);
    }


    // ==========================================
    // MERGE ARROWS — Monaco Glyph Margin Decorations
    // ==========================================
    // This uses Monaco's native API: delta-decorations on the glyph margin
    // of each sub-editor. Monaco handles scroll sync and positioning.
    // Right arrow (→) in original editor = copy original → modified.
    // Left  arrow (←) in modified editor = copy modified → original.

    function setupFloatingMergeIcons(diffEditor) {
        const origEditor = diffEditor.getOriginalEditor();
        const modEditor  = diffEditor.getModifiedEditor();

        // Enable glyph margin on both editors
        origEditor.updateOptions({ glyphMargin: true });
        modEditor.updateOptions({ glyphMargin: true });

        let origDecs = [];
        let modDecs  = [];

        function applyDecorations() {
            // Re-assert glyphMargin on every call — Monaco can reset these during re-layout
            origEditor.updateOptions({ glyphMargin: true });
            modEditor.updateOptions({ glyphMargin: true });

            const changes = diffEditor.getLineChanges() || [];
            const oNew = [];
            const mNew = [];

            changes.forEach(change => {
                // → arrow on the ORIGINAL editor start line
                const oLine = change.originalStartLineNumber > 0
                    ? change.originalStartLineNumber
                    : change.modifiedStartLineNumber;
                if (oLine > 0) {
                    oNew.push({
                        range: new monaco.Range(oLine, 1, oLine, 1),
                        options: {
                            glyphMarginClassName:    'merge-glyph-arrow-right',
                            glyphMarginHoverMessage: { value: '**Copy →** to File 2' },
                            description:             'merge-right'
                        }
                    });
                }

                // ← arrow on the MODIFIED editor start line
                const mLine = change.modifiedStartLineNumber > 0
                    ? change.modifiedStartLineNumber
                    : change.originalStartLineNumber;
                if (mLine > 0) {
                    mNew.push({
                        range: new monaco.Range(mLine, 1, mLine, 1),
                        options: {
                            glyphMarginClassName:    'merge-glyph-arrow-left',
                            glyphMarginHoverMessage: { value: '**Copy ←** to File 1' },
                            description:             'merge-left'
                        }
                    });
                }
            });

            origDecs = origEditor.deltaDecorations(origDecs, oNew);
            modDecs  = modEditor.deltaDecorations(modDecs,  mNew);
        }

        // Click → right (in original editor gutter)
        origEditor.onMouseDown(e => {
            if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) return;
            const line    = e.target.position.lineNumber;
            const changes = diffEditor.getLineChanges() || [];
            const change  = changes.find(c => {
                const start = c.originalStartLineNumber;
                const end   = c.originalEndLineNumber || start;
                return line >= start && line <= end;
            });
            if (change) handleMergeClick(diffEditor, change, 'to-right');
        });

        // Click ← left (in modified editor gutter)
        modEditor.onMouseDown(e => {
            if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) return;
            const line    = e.target.position.lineNumber;
            const changes = diffEditor.getLineChanges() || [];
            const change  = changes.find(c => {
                const start = c.modifiedStartLineNumber;
                const end   = c.modifiedEndLineNumber || start;
                return line >= start && line <= end;
            });
            if (change) handleMergeClick(diffEditor, change, 'to-left');
        });

        diffEditor.onDidUpdateDiff(applyDecorations);
    }

    function handleMergeClick(diffEditor, change, direction) {
        if (!change) return;
        const origModel = diffEditor.getModel().original;
        const modModel  = diffEditor.getModel().modified;

        if (direction === 'to-right') {
            const oStart = change.originalStartLineNumber;
            const oEnd   = change.originalEndLineNumber;
            const text   = oEnd !== 0
                ? origModel.getValueInRange(new monaco.Range(oStart, 1, oEnd, origModel.getLineMaxColumn(oEnd)))
                : '';
            const mStart = change.modifiedStartLineNumber;
            const mEnd   = change.modifiedEndLineNumber;
            const range  = new monaco.Range(mStart, 1, mEnd === 0 ? mStart : mEnd, mEnd === 0 ? 1 : modModel.getLineMaxColumn(mEnd));
            modModel.pushEditOperations([], [{ range, text }], () => null);
        } else {
            const mStart = change.modifiedStartLineNumber;
            const mEnd   = change.modifiedEndLineNumber;
            const text   = mEnd !== 0
                ? modModel.getValueInRange(new monaco.Range(mStart, 1, mEnd, modModel.getLineMaxColumn(mEnd)))
                : '';
            const oStart = change.originalStartLineNumber;
            const oEnd   = change.originalEndLineNumber;
            const range  = new monaco.Range(oStart, 1, oEnd === 0 ? oStart : oEnd, oEnd === 0 ? 1 : origModel.getLineMaxColumn(oEnd));
            origModel.pushEditOperations([], [{ range, text }], () => null);
        }
    }

    function applyMergeAll(direction) {
        const editor = folderResultsContainer.classList.contains('hidden') ? textDiffEditor : folderDiffEditor;
        if (!editor || !editor.getModel()) return showError('No active editor to merge.');
        const changes = editor.getLineChanges() || [];
        if (changes.length === 0) return showError('No differences detected.');
        const origModel = editor.getModel().original;
        const modModel  = editor.getModel().modified;
        direction === 'to-right' ? modModel.setValue(origModel.getValue()) : origModel.setValue(modModel.getValue());
    }

    if (mergeAllRightBtn) mergeAllRightBtn.addEventListener('click', () => applyMergeAll('to-right'));
    if (mergeAllLeftBtn)  mergeAllLeftBtn.addEventListener('click',  () => applyMergeAll('to-left'));


    // ==========================================
    // FOLDER DIFF LOGIC
    // ==========================================
    origFolderInput.addEventListener('change', (e) => {
        originalFiles.clear();
        if (e.target.files.length > 0) {
            const root = e.target.files[0].webkitRelativePath.split('/')[0];
            origFolderName.textContent = `${root}/ (${e.target.files.length} files)`;
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
            Array.from(e.target.files).forEach(f => {
                const rel = f.webkitRelativePath.substring(f.webkitRelativePath.indexOf('/') + 1);
                modifiedFiles.set(rel, f);
            });
        }
        checkFoldersReady();
    });

    function checkFoldersReady() {
        if (originalFiles.size > 0 && modifiedFiles.size > 0) {
            compareFoldersBtn.removeAttribute('disabled');
        } else {
            compareFoldersBtn.setAttribute('disabled', 'true');
        }
    }

    compareFoldersBtn.addEventListener('click', async () => {
        folderSetupPanelsWrap.classList.add('hidden');
        actionBarFolder.classList.add('hidden');
        folderResultsContainer.classList.remove('hidden');
        fileDiffStatusMap.clear();

        const allPaths = new Set([...originalFiles.keys(), ...modifiedFiles.keys()]);
        for (const path of allPaths) {
            const inOrig = originalFiles.has(path);
            const inMod  = modifiedFiles.has(path);
            if (inOrig && !inMod) {
                fileDiffStatusMap.set(path, { status: 'removed' });
            } else if (!inOrig && inMod) {
                fileDiffStatusMap.set(path, { status: 'added' });
            } else {
                const o = originalFiles.get(path);
                const m = modifiedFiles.get(path);
                fileDiffStatusMap.set(path, {
                    status: (o.size !== m.size || o.lastModified !== m.lastModified) ? 'modified' : 'unchanged'
                });
            }
        }
        renderFileTree();
    });

    function renderFileTree() {
        fileTreeEl.innerHTML = '';
        const paths = Array.from(fileDiffStatusMap.keys()).sort();
        let hasChanges = false;

        paths.forEach(path => {
            const meta = fileDiffStatusMap.get(path);
            if (meta.status === 'unchanged') return;
            hasChanges = true;

            const li = document.createElement('li');
            li.className = 'tree-item';

            const dot = document.createElement('div');
            dot.className = `status-indicator status-${meta.status}`;

            const txt = document.createElement('span');
            txt.className   = 'file-path-text';
            txt.textContent = path;
            txt.title       = path;

            li.appendChild(dot);
            li.appendChild(txt);
            li.addEventListener('click', () => {
                document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
                openFileDiff(path, meta.status);
            });
            fileTreeEl.appendChild(li);
        });

        if (!hasChanges) {
            const li = document.createElement('li');
            li.className = 'px-4 py-3 text-sm text-slate-400';
            li.textContent = 'No differences detected between the two folders.';
            fileTreeEl.appendChild(li);
        }
    }

    async function openFileDiff(path, status) {
        if (folderEmptyState) folderEmptyState.style.display = 'none';
        let origTxt = '', modTxt = '';
        try {
            if (status === 'modified' || status === 'removed') origTxt = await originalFiles.get(path).text();
            if (status === 'modified' || status === 'added')   modTxt  = await modifiedFiles.get(path).text();
        } catch (e) {
            origTxt = 'Error reading original file.';
            modTxt  = 'Error reading modified file.';
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
        if (folderEmptyState) folderEmptyState.remove();

        folderDiffEditor = monaco.editor.createDiffEditor(folderEditorHost, {
            theme:               themeSelect.value,
            renderSideBySide:    true,
            automaticLayout:     true,
            scrollBeyondLastLine:false,
            fontSize:            14,
            minimap:             { enabled: false },
            padding:             { top: 16, bottom: 16 },
            originalEditable:    true
        });

        folderOriginalModel = monaco.editor.createModel(origTxt, 'plaintext');
        folderModifiedModel = monaco.editor.createModel(modTxt,  'plaintext');
        folderDiffEditor.setModel({ original: folderOriginalModel, modified: folderModifiedModel });
        updateEditorLanguage(folderOriginalModel, folderModifiedModel, origTxt || modTxt, path);
        setupFloatingMergeIcons(folderDiffEditor, folderEditorHost);
    }


    // ==========================================
    // SHARED UTILITIES
    // ==========================================

    // Clear textarea buttons
    clearBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.currentTarget.getAttribute('data-target');
            const target = document.getElementById(targetId);
            if (target) target.value = '';
        });
    });

    // Language selector
    languageSelect.addEventListener('change', (e) => {
        const lang = e.target.value;
        if (lang !== 'auto') {
            if (textOriginalModel)   monaco.editor.setModelLanguage(textOriginalModel, lang);
            if (textModifiedModel)   monaco.editor.setModelLanguage(textModifiedModel, lang);
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

    // Theme selector — also toggles CSS variables for light theme
    themeSelect.addEventListener('change', (e) => {
        const theme = e.target.value;
        if (window.monaco) monaco.editor.setTheme(theme);
        if (theme === 'vs') {
            document.body.classList.remove('bg-slate-900');
            document.body.classList.add('bg-white', 'text-slate-900');
        } else {
            document.body.classList.remove('bg-white', 'text-slate-900');
            document.body.classList.add('bg-slate-900');
        }
    });

    // Language detection from file extension
    function getLanguageFromPath(path) {
        if (!path) return null;
        const filename = path.split('/').pop().toLowerCase();
        if (filename === 'dockerfile') return 'dockerfile';
        if (filename === 'jenkinsfile') return 'groovy';
        const ext = filename.split('.').pop();
        const map = {
            'js':'javascript','jsx':'javascript','ts':'typescript','tsx':'typescript',
            'py':'python','html':'html','htm':'html','css':'css','scss':'scss','less':'less',
            'json':'json','md':'markdown','xml':'xml','svg':'xml','yml':'yaml','yaml':'yaml',
            'sh':'shell','bash':'shell','c':'c','cpp':'cpp','h':'c','hpp':'cpp',
            'cs':'csharp','go':'go','rs':'rust','php':'php','rb':'ruby','java':'java',
            'swift':'swift','kt':'kotlin','sql':'sql','tf':'terraform','tfvars':'terraform',
            'log':'plaintext','txt':'plaintext'
        };
        return map[ext] || null;
    }

    // Auto-detect via highlight.js, fallback to plaintext
    function detectLanguage(text) {
        if (!text || !window.hljs) return null;
        try {
            const result = hljs.highlightAuto(text.substring(0, 1200));
            let detected = result.language || (result.secondBest && result.secondBest.language);
            if (!detected) return 'plaintext';
            const map = {
                'js':'javascript','ts':'typescript','bash':'shell','sh':'shell',
                'xml':'html','py':'python','yml':'yaml','yaml':'yaml','groovy':'groovy',
                'java':'java','cpp':'cpp','c':'c','cs':'csharp','go':'go','rust':'rust',
                'php':'php','ruby':'ruby','swift':'swift','kotlin':'kotlin','sql':'sql',
                'dockerfile':'dockerfile','json':'json','markdown':'markdown','md':'markdown'
            };
            return map[detected] || detected;
        } catch {
            return null;
        }
    }

    // Apply language to both models, optionally from path hint
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
        if (modModel)  monaco.editor.setModelLanguage(modModel,  lang);
    }

    // Window resize — ensure both editors relayout
    window.addEventListener('resize', () => {
        if (textDiffEditor)   textDiffEditor.layout();
        if (folderDiffEditor) folderDiffEditor.layout();
    });

});

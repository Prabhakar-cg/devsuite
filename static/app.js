document.addEventListener('DOMContentLoaded', () => {
    // ---- DOM Elements: Text Diff ----
    const originalInput = document.getElementById('original-input');
    const modifiedInput = document.getElementById('modified-input');
    const compareBtn = document.getElementById('compare-btn');
    const textDiffContainer = document.getElementById('diff-container');
    const inputPanels = document.getElementById('input-panels');
    const toggleInlineBtn = document.getElementById('toggle-inline-btn');
    const editBtn = document.getElementById('edit-btn');
    const editorHost = document.getElementById('monaco-diff-editor');
    const langLabelContainer = document.getElementById('detected-language-label');
    const langNameSpan = document.getElementById('lang-name');

    // ---- DOM Elements: Shared Settings ----
    const languageSelect = document.getElementById('language-select');
    const themeSelect = document.getElementById('theme-select');
    const clearBtns = document.querySelectorAll('.clear-btn');

    // ---- DOM Elements: Tabs ----
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // ---- DOM Elements: Folder Diff ----
    const origFolderInput = document.getElementById('original-folder-input');
    const modFolderInput = document.getElementById('modified-folder-input');
    const origFolderName = document.getElementById('original-folder-name');
    const modFolderName = document.getElementById('modified-folder-name');
    const compareFoldersBtn = document.getElementById('compare-folders-btn');
    const folderSetupPanels = document.querySelector('.folder-setup-panels');
    const folderResultsContainer = document.getElementById('folder-results-container');
    const fileTreeEl = document.getElementById('file-tree');
    const folderEditorHost = document.getElementById('folder-editor-wrapper');
    const folderEmptyState = folderEditorHost.querySelector('.empty-state');

    // ---- State variables ----
    let textDiffEditor = null;
    let textOriginalModel = null;
    let textModifiedModel = null;

    let folderDiffEditor = null;
    let folderOriginalModel = null;
    let folderModifiedModel = null;

    // ---- DOM Elements: Merge Buttons ----
    const mergeAllRightBtn = document.getElementById('merge-all-right-btn');
    const mergeAllLeftBtn = document.getElementById('merge-all-left-btn');

    let originalFiles = new Map(); // key: path, value: File object
    let modifiedFiles = new Map(); // key: path, value: File object
    let fileDiffStatusMap = new Map(); // key: path, value: {status: 'added'|'removed'|'modified'}

    // ==========================================
    // INITIALIZATION (Monaco)
    // ==========================================
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
    window.MonacoEnvironment = { getWorkerUrl: () => proxy };
    let proxy = URL.createObjectURL(new Blob([`
        self.MonacoEnvironment = { baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/' };
        importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/base/worker/workerMain.js');
    `], { type: 'text/javascript' }));

    require(['vs/editor/editor.main'], function () {
        console.log("Monaco Editor loaded successfully.");
    });


    // ==========================================
    // TAB SWITCHING LOGIC
    // ==========================================
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => {
                c.classList.remove('active');
                c.classList.add('hidden');
            });

            // Add active class to clicked
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            const targetContent = document.getElementById(targetId);
            targetContent.classList.remove('hidden');
            targetContent.classList.add('active');

            // Force editor layout refresh if switching to a tab with an active editor
            setTimeout(() => {
                if(targetId === 'text-diff' && textDiffEditor && !textDiffContainer.classList.contains('hidden')) {
                    textDiffEditor.layout();
                } else if (targetId === 'folder-diff' && folderDiffEditor && !folderResultsContainer.classList.contains('hidden')) {
                    folderDiffEditor.layout();
                }
            }, 50);
        });
    });


    // ==========================================
    // TEXT DIFF LOGIC (Existing)
    // ==========================================
    compareBtn.addEventListener('click', () => {
        const originalText = originalInput.value;
        const modifiedText = modifiedInput.value;

        inputPanels.classList.add('hidden');
        textDiffContainer.classList.remove('hidden');
        compareBtn.parentElement.classList.add('hidden');

        if (!textDiffEditor) {
            initTextDiffEditor(originalText, modifiedText);
        } else {
            if (textOriginalModel && textModifiedModel) {
                textOriginalModel.setValue(originalText);
                textModifiedModel.setValue(modifiedText);
                updateEditorLanguage(textOriginalModel, textModifiedModel, originalText);
            }
        }
    });

    editBtn.addEventListener('click', () => {
        if (textOriginalModel && textModifiedModel) {
            originalInput.value = textOriginalModel.getValue();
            modifiedInput.value = textModifiedModel.getValue();
        }
        textDiffContainer.classList.add('hidden');
        inputPanels.classList.remove('hidden');
        compareBtn.parentElement.classList.remove('hidden');
    });

    toggleInlineBtn.addEventListener('click', () => {
        if (!textDiffEditor) return;
        const isInline = toggleInlineBtn.classList.contains('active');
        textDiffEditor.updateOptions({ renderSideBySide: isInline });

        if (isInline) {
            toggleInlineBtn.classList.remove('active');
            toggleInlineBtn.textContent = 'Inline View';
        } else {
            toggleInlineBtn.classList.add('active');
            toggleInlineBtn.textContent = 'Side-by-Side View';
        }
    });

    function initTextDiffEditor(originalTxt, modifiedTxt) {
        if (!window.monaco) return alert('Editor is still loading. Please try again in a moment.');
        const theme = themeSelect.value;
        const isInline = toggleInlineBtn.classList.contains('active');

        textDiffEditor = monaco.editor.createDiffEditor(editorHost, {
            theme: theme, renderSideBySide: !isInline, automaticLayout: true,
            scrollBeyondLastLine: false, fontSize: 14, minimap: { enabled: false }, padding: { top: 16, bottom: 16 },
            originalEditable: true,
            renderMarginRevertIcon: true
        });

        textOriginalModel = monaco.editor.createModel(originalTxt, 'plaintext');
        textModifiedModel = monaco.editor.createModel(modifiedTxt, 'plaintext');
        textDiffEditor.setModel({ original: textOriginalModel, modified: textModifiedModel });
        updateEditorLanguage(textOriginalModel, textModifiedModel, originalTxt);
        setupInlineMergeIcons(textDiffEditor);
    }
    
    // ==========================================
    // INLINE MERGE LOGIC
    // ==========================================
    function setupInlineMergeIcons(diffEditor) {
        let currentOrigDecorations = [];
        let currentModDecorations = [];

        diffEditor.onDidUpdateDiff(() => {
            const changes = diffEditor.getLineChanges() || [];
            const origEditor = diffEditor.getOriginalEditor();
            const modEditor = diffEditor.getModifiedEditor();

            origEditor.updateOptions({ glyphMargin: true });
            modEditor.updateOptions({ glyphMargin: true });

            let newOrigDecs = [];
            let newModDecs = [];

            changes.forEach(change => {
                let origLine = change.originalStartLineNumber === 0 ? Math.max(1, change.originalEndLineNumber) : change.originalStartLineNumber;
                if (origLine > 0) {
                    newOrigDecs.push({
                        range: new monaco.Range(origLine, 1, origLine, 1),
                        options: {
                            glyphMarginClassName: 'merge-right-icon',
                            glyphMarginHoverMessage: { value: 'Copy to Right' }
                        }
                    });
                }
                
                let modLine = change.modifiedStartLineNumber === 0 ? Math.max(1, change.modifiedEndLineNumber) : change.modifiedStartLineNumber;
                if (modLine > 0) {
                    newModDecs.push({
                        range: new monaco.Range(modLine, 1, modLine, 1),
                        options: {
                            glyphMarginClassName: 'merge-left-icon',
                            glyphMarginHoverMessage: { value: 'Copy to Left' }
                        }
                    });
                }
            });

            currentOrigDecorations = origEditor.deltaDecorations(currentOrigDecorations, newOrigDecs);
            currentModDecorations = modEditor.deltaDecorations(currentModDecorations, newModDecs);
        });

        const origEditor = diffEditor.getOriginalEditor();
        origEditor.onMouseDown((e) => {
            if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN && e.target.element && e.target.element.classList.contains('merge-right-icon')) {
                handleInlineMergeClick(diffEditor, origEditor, e.target.position.lineNumber, 'to-right');
            }
        });

        const modEditor = diffEditor.getModifiedEditor();
        modEditor.onMouseDown((e) => {
            if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN && e.target.element && e.target.element.classList.contains('merge-left-icon')) {
                handleInlineMergeClick(diffEditor, modEditor, e.target.position.lineNumber, 'to-left');
            }
        });
    }

    function handleInlineMergeClick(diffEditor, activeEditor, lineNumber, direction) {
        const changes = diffEditor.getLineChanges() || [];
        const origEditor = diffEditor.getOriginalEditor();
        const modEditor = diffEditor.getModifiedEditor();
        
        let targetChange = null;
        for (const c of changes) {
            const start = activeEditor === modEditor ? c.modifiedStartLineNumber : c.originalStartLineNumber;
            const end = activeEditor === modEditor ? (c.modifiedEndLineNumber || c.modifiedStartLineNumber) : (c.originalEndLineNumber || c.originalStartLineNumber);
            let effectiveStart = start === 0 ? Math.max(1, end) : start;
            if (effectiveStart === lineNumber) {
                 targetChange = c;
                 break;
            }
        }
        
        if (!targetChange) return;

        const origModel = diffEditor.getModel().original;
        const modModel = diffEditor.getModel().modified;

        if (direction === 'to-right') {
            const origStart = targetChange.originalStartLineNumber;
            const origEnd = targetChange.originalEndLineNumber;
            let textToInsert = '';
            if (origEnd !== 0) {
                textToInsert = origModel.getValueInRange(new monaco.Range(origStart, 1, origEnd, origModel.getLineMaxColumn(origEnd)));
            }
            const modStart = targetChange.modifiedStartLineNumber;
            const modEnd = targetChange.modifiedEndLineNumber;
            const modRange = new monaco.Range(modStart, 1, modEnd === 0 ? modStart : modEnd, modEnd === 0 ? 1 : modModel.getLineMaxColumn(modEnd));
            
            modModel.pushEditOperations([], [{range: modRange, text: textToInsert}], () => null);
        } else {
            const modStart = targetChange.modifiedStartLineNumber;
            const modEnd = targetChange.modifiedEndLineNumber;
            let textToInsert = '';
            if (modEnd !== 0) {
                textToInsert = modModel.getValueInRange(new monaco.Range(modStart, 1, modEnd, modModel.getLineMaxColumn(modEnd)));
            }
            const origStart = targetChange.originalStartLineNumber;
            const origEnd = targetChange.originalEndLineNumber;
            const origRange = new monaco.Range(origStart, 1, origEnd === 0 ? origStart : origEnd, origEnd === 0 ? 1 : origModel.getLineMaxColumn(origEnd));
            
            origModel.pushEditOperations([], [{range: origRange, text: textToInsert}], () => null);
        }
    }

    function applyMergeAll(direction) {
        const editor = folderResultsContainer.classList.contains('hidden') ? textDiffEditor : folderDiffEditor;
        if (!editor || !editor.getModel()) return alert("No active editor.");
        const changes = editor.getLineChanges() || [];
        if (changes.length === 0) return alert("No differences to merge.");

        const origModel = editor.getModel().original;
        const modModel = editor.getModel().modified;

        if (direction === 'to-right') {
            modModel.setValue(origModel.getValue());
        } else {
            origModel.setValue(modModel.getValue());
        }
    }

    if (mergeAllRightBtn) mergeAllRightBtn.addEventListener('click', () => applyMergeAll('to-right'));
    if (mergeAllLeftBtn) mergeAllLeftBtn.addEventListener('click', () => applyMergeAll('to-left'));


    // ==========================================
    // FOLDER DIFF LOGIC (New)
    // ==========================================
    
    // Read folder inputs
    origFolderInput.addEventListener('change', (e) => {
        originalFiles.clear();
        if (e.target.files.length > 0) {
            const rootPathName = e.target.files[0].webkitRelativePath.split('/')[0];
            origFolderName.textContent = `${rootPathName}/ (${e.target.files.length} files)`;
            Array.from(e.target.files).forEach(f => {
                // Remove the top-level directory name so we can match relatively
                const relativePath = f.webkitRelativePath.substring(f.webkitRelativePath.indexOf('/') + 1);
                originalFiles.set(relativePath, f);
            });
        }
        checkFoldersReady();
    });

    modFolderInput.addEventListener('change', (e) => {
        modifiedFiles.clear();
        if (e.target.files.length > 0) {
            const rootPathName = e.target.files[0].webkitRelativePath.split('/')[0];
            modFolderName.textContent = `${rootPathName}/ (${e.target.files.length} files)`;
            Array.from(e.target.files).forEach(f => {
                const relativePath = f.webkitRelativePath.substring(f.webkitRelativePath.indexOf('/') + 1);
                modifiedFiles.set(relativePath, f);
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
        // Transition UI
        folderSetupPanels.classList.add('hidden');
        compareFoldersBtn.parentElement.classList.add('hidden');
        folderResultsContainer.classList.remove('hidden');
        
        // Compute structural diff first (fast)
        fileDiffStatusMap.clear();
        
        // Gather all unique paths
        const allPaths = new Set([...originalFiles.keys(), ...modifiedFiles.keys()]);
        
        for (const path of allPaths) {
            const inOrig = originalFiles.has(path);
            const inMod = modifiedFiles.has(path);
            
            if (inOrig && !inMod) {
                fileDiffStatusMap.set(path, { status: 'removed' });
            } else if (!inOrig && inMod) {
                fileDiffStatusMap.set(path, { status: 'added' });
            } else {
                // File exists in both. To know if it's strictly modified or identical, 
                // we technically need to compare contents or size/last modified.
                // For a fast initial pass, we'll mark size diffs.
                // Full content diff will be verified when clicked.
                const origFile = originalFiles.get(path);
                const modFile = modifiedFiles.get(path);
                if (origFile.size !== modFile.size || origFile.lastModified !== modFile.lastModified) {
                    fileDiffStatusMap.set(path, { status: 'modified' });
                } else {
                    fileDiffStatusMap.set(path, { status: 'unchanged' });
                }
            }
        }

        renderFileTree();
    });

    // Render Sidebar File Tree
    function renderFileTree() {
        fileTreeEl.innerHTML = '';
        
        // Sort paths alphabetically
        const sortedPaths = Array.from(fileDiffStatusMap.keys()).sort();

        let hasChanges = false;

        sortedPaths.forEach(path => {
            const metadata = fileDiffStatusMap.get(path);
            
            // Only show changed files by default to keep it clean, unless you want all
            if (metadata.status === 'unchanged') return;
            hasChanges = true;

            const li = document.createElement('li');
            li.className = 'tree-item';
            
            // Status Icon
            const statusIndicator = document.createElement('div');
            statusIndicator.className = `status-indicator status-${metadata.status}`;
            
            // Text
            const textSpan = document.createElement('span');
            textSpan.className = 'file-path-text';
            textSpan.textContent = path;
            textSpan.title = path; // Tooltip for long paths

            li.appendChild(statusIndicator);
            li.appendChild(textSpan);

            // On Click
            li.addEventListener('click', () => {
                document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
                openFileDiff(path, metadata.status);
            });

            fileTreeEl.appendChild(li);
        });

        if (!hasChanges) {
            const li = document.createElement('li');
            li.style.padding = '1rem';
            li.style.color = 'var(--text-secondary)';
            li.textContent = 'No modifications found between folders.';
            fileTreeEl.appendChild(li);
        }
    }

    async function openFileDiff(path, status) {
        if (folderEmptyState) folderEmptyState.style.display = 'none';

        // Read files asynchronously
        let originalTxt = '';
        let modifiedTxt = '';

        try {
            if (status === 'modified' || status === 'removed') {
                originalTxt = await originalFiles.get(path).text();
            }
            if (status === 'modified' || status === 'added') {
                modifiedTxt = await modifiedFiles.get(path).text();
            }
        } catch (e) {
            console.error("Failed to read file contents", e);
            originalTxt = "Error reading original file.";
            modifiedTxt = "Error reading modified file.";
        }

        if (!folderDiffEditor) {
            initFolderDiffEditor(originalTxt, modifiedTxt, path);
        } else {
            folderOriginalModel.setValue(originalTxt);
            folderModifiedModel.setValue(modifiedTxt);
            updateEditorLanguage(folderOriginalModel, folderModifiedModel, originalTxt || modifiedTxt, path);
        }
    }

    function initFolderDiffEditor(originalTxt, modifiedTxt, path) {
        // Remove empty state and ensure host takes full height
        if (folderEmptyState) folderEmptyState.remove();
        
        folderDiffEditor = monaco.editor.createDiffEditor(folderEditorHost, {
            theme: themeSelect.value, renderSideBySide: true, automaticLayout: true,
            scrollBeyondLastLine: false, fontSize: 14, minimap: { enabled: false }, padding: { top: 16, bottom: 16 },
            originalEditable: true,
            renderMarginRevertIcon: true
        });

        folderOriginalModel = monaco.editor.createModel(originalTxt, 'plaintext');
        folderModifiedModel = monaco.editor.createModel(modifiedTxt, 'plaintext');
        folderDiffEditor.setModel({ original: folderOriginalModel, modified: folderModifiedModel });
        updateEditorLanguage(folderOriginalModel, folderModifiedModel, originalTxt || modifiedTxt, path);
        setupInlineMergeIcons(folderDiffEditor);
    }

    // ==========================================
    // SHARED UTILITIES
    // ==========================================
    clearBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.getAttribute('data-target');
            document.getElementById(targetId).value = '';
        });
    });

    languageSelect.addEventListener('change', (e) => {
        const lang = e.target.value;
        if (lang !== 'auto') {
            if (textOriginalModel) monaco.editor.setModelLanguage(textOriginalModel, lang);
            if (textModifiedModel) monaco.editor.setModelLanguage(textModifiedModel, lang);
            if (folderOriginalModel) monaco.editor.setModelLanguage(folderOriginalModel, lang);
            if (folderModifiedModel) monaco.editor.setModelLanguage(folderModifiedModel, lang);
        } else {
            // If they switch back to auto, refresh current active editors
            if (textOriginalModel) {
                updateEditorLanguage(textOriginalModel, textModifiedModel, textOriginalModel.getValue());
            }
            if (folderOriginalModel) {
                let activeFolderFile = document.querySelector('.tree-item.active .file-path-text');
                let pathHint = activeFolderFile ? activeFolderFile.textContent : null;
                updateEditorLanguage(folderOriginalModel, folderModifiedModel, folderOriginalModel.getValue(), pathHint);
            }
        }
    });

    themeSelect.addEventListener('change', (e) => {
        const theme = e.target.value;
        if (window.monaco) monaco.editor.setTheme(theme);
        if(theme === 'vs') {
            document.documentElement.style.setProperty('--bg-main', '#f8f9fa');
            document.documentElement.style.setProperty('--bg-secondary', '#ffffff');
            document.documentElement.style.setProperty('--bg-panel', '#e9ecef');
            document.documentElement.style.setProperty('--text-primary', '#212529');
            document.documentElement.style.setProperty('--text-secondary', '#6c757d');
            document.documentElement.style.setProperty('--border-color', '#dee2e6');
        } else {
            document.documentElement.style = '';
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
            'log': 'plaintext', 'txt': 'plaintext'
        };
        return map[ext] || null;
    }

    function updateEditorLanguage(origModel, modModel, textHint, pathHint = null) {
        let lang = languageSelect.value;
        if (lang === 'auto') {
            lang = getLanguageFromPath(pathHint) || detectLanguage(textHint) || 'plaintext';
            // Show auto-detect label
            if (langLabelContainer && langNameSpan) {
                langNameSpan.textContent = lang;
                langLabelContainer.classList.remove('hidden');
            }
        } else {
            // Hide if manually selected
            if (langLabelContainer) {
                langLabelContainer.classList.add('hidden');
            }
        }
        
        if (origModel) monaco.editor.setModelLanguage(origModel, lang);
        if (modModel) monaco.editor.setModelLanguage(modModel, lang);
    }

    function detectLanguage(text) {
        if (!text || !window.hljs) return null;
        try {
            const textToAnalyze = text.substring(0, 1000); 
            const result = hljs.highlightAuto(textToAnalyze);
            
            // `highlightAuto` can return `.language` or if uncertain, rely on `.secondBest.language`
            let detected = result.language;
            if (!detected && result.secondBest) {
                detected = result.secondBest.language;
            }
            if (!detected) return 'plaintext';

            const languageMap = {
                'js': 'javascript', 'ts': 'typescript', 'bash': 'shell', 'sh': 'shell',
                'xml': 'html', 'py': 'python', 'yml': 'yaml', 'yaml': 'yaml',
                'groovy': 'groovy', 'java': 'java', 'cpp': 'cpp', 'c': 'c',
                'cs': 'csharp', 'go': 'go', 'rust': 'rust', 'php': 'php', 'ruby': 'ruby',
                'swift': 'swift', 'kotlin': 'kotlin', 'sql': 'sql', 'dockerfile': 'dockerfile',
                'json': 'json', 'markdown': 'markdown', 'md': 'markdown'
            };
            return languageMap[detected] || detected;
        } catch (e) {
            console.error("Auto detect failed:", e);
            return null;
        }
    }

    window.addEventListener('resize', () => {
        if (textDiffEditor) textDiffEditor.layout();
        if (folderDiffEditor) folderDiffEditor.layout();
    });
});

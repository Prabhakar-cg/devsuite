document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const originalInput = document.getElementById('original-input');
    const modifiedInput = document.getElementById('modified-input');
    const compareBtn = document.getElementById('compare-btn');
    const diffContainer = document.getElementById('diff-container');
    const inputPanels = document.getElementById('input-panels');
    const toggleInlineBtn = document.getElementById('toggle-inline-btn');
    const editBtn = document.getElementById('edit-btn');
    const languageSelect = document.getElementById('language-select');
    const themeSelect = document.getElementById('theme-select');
    const clearBtns = document.querySelectorAll('.clear-btn');
    const editorHost = document.getElementById('monaco-diff-editor');

    let diffEditor = null;
    let originalModel = null;
    let modifiedModel = null;

    // Initialize Monaco Editor via AMD loader (RequireJS)
    // Configure paths since we are loading via CDN
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
    
    // Fallback UI to show loading state if preferred, but we'll init quietly
    window.MonacoEnvironment = { getWorkerUrl: () => proxy };
    let proxy = URL.createObjectURL(new Blob([`
        self.MonacoEnvironment = {
            baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/'
        };
        importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/base/worker/workerMain.js');
    `], { type: 'text/javascript' }));

    // Load Monaco Editor
    require(['vs/editor/editor.main'], function () {
        // Monaco is loaded and ready!
        console.log("Monaco Editor loaded successfully.");
        
        // Initial setup for the models 
        // Note: we don't create the DiffEditor immediately until 'Compare' is clicked
        // to keep memory usage low and the initial UI clean.
    });

    // Handle Compare Button Click
    compareBtn.addEventListener('click', () => {
        const originalText = originalInput.value;
        const modifiedText = modifiedInput.value;

        // Animate UI transition
        inputPanels.classList.add('hidden');
        diffContainer.classList.remove('hidden');
        
        // Change button layout slightly
        compareBtn.parentElement.classList.add('hidden');

        // Create or update Diff Editor
        if (!diffEditor) {
            initDiffEditor(originalText, modifiedText);
        } else {
            updateDiffEditor(originalText, modifiedText);
        }
    });

    // Handle Edit Button Click (back to text areas)
    editBtn.addEventListener('click', () => {
        // Retrieve current values from models back to text areas in case they were modified
        if (originalModel && modifiedModel) {
            originalInput.value = originalModel.getValue();
            modifiedInput.value = modifiedModel.getValue();
        }

        diffContainer.classList.add('hidden');
        inputPanels.classList.remove('hidden');
        compareBtn.parentElement.classList.remove('hidden');
    });

    // Handle Clear Buttons
    clearBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.getAttribute('data-target');
            document.getElementById(targetId).value = '';
        });
    });

    // Handle Inline View Toggle
    toggleInlineBtn.addEventListener('click', () => {
        if (!diffEditor) return;

        const isInline = toggleInlineBtn.classList.contains('active');
        
        // Update Monaco Diff Editor options
        diffEditor.updateOptions({
            renderSideBySide: isInline // If currently inline, switch to Side-by-Side (not inline)
        });

        if (isInline) {
            toggleInlineBtn.classList.remove('active');
            toggleInlineBtn.textContent = 'Inline View';
        } else {
            toggleInlineBtn.classList.add('active');
            toggleInlineBtn.textContent = 'Side-by-Side View';
        }
    });

    // Handle Language Change
    languageSelect.addEventListener('change', (e) => {
        let lang = e.target.value;
        if (lang === 'auto') {
            const originalText = originalInput.value;
            lang = detectLanguage(originalText) || 'plaintext';
        }
        
        if (originalModel && modifiedModel) {
            monaco.editor.setModelLanguage(originalModel, lang);
            monaco.editor.setModelLanguage(modifiedModel, lang);
        }
    });

    // Handle Theme Change
    themeSelect.addEventListener('change', (e) => {
        const theme = e.target.value;
        if (window.monaco) {
            monaco.editor.setTheme(theme);
            
            // Adjust custom CSS vars slightly based on theme if needed
            if(theme === 'vs') {
                document.documentElement.style.setProperty('--bg-main', '#f8f9fa');
                document.documentElement.style.setProperty('--bg-secondary', '#ffffff');
                document.documentElement.style.setProperty('--bg-panel', '#e9ecef');
                document.documentElement.style.setProperty('--text-primary', '#212529');
                document.documentElement.style.setProperty('--text-secondary', '#6c757d');
                document.documentElement.style.setProperty('--border-color', '#dee2e6');
            } else {
                // Reset to default dark style
                document.documentElement.style = '';
            }
        }
    });

    // Function to initialize the Diff Editor
    function initDiffEditor(originalTxt, modifiedTxt) {
        if (!window.monaco) {
            alert('Editor is still loading. Please try again in a moment.');
            return;
        }

        let lang = languageSelect.value;
        if (lang === 'auto') {
            lang = detectLanguage(originalTxt) || 'plaintext';
        }
        const theme = themeSelect.value;
        const isInline = toggleInlineBtn.classList.contains('active');

        diffEditor = monaco.editor.createDiffEditor(editorHost, {
            theme: theme,
            renderSideBySide: !isInline,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', monospace",
            fontSize: 14,
            minimap: {
                enabled: false
            },
            padding: { top: 16, bottom: 16 }
        });

        originalModel = monaco.editor.createModel(originalTxt, lang);
        modifiedModel = monaco.editor.createModel(modifiedTxt, lang);

        diffEditor.setModel({
            original: originalModel,
            modified: modifiedModel
        });
    }

    // Function to update existing Diff Editor models
    function updateDiffEditor(originalTxt, modifiedTxt) {
        if (originalModel && modifiedModel) {
            originalModel.setValue(originalTxt);
            modifiedModel.setValue(modifiedTxt);
            
            // Re-detect language if set to auto
            let lang = languageSelect.value;
            if (lang === 'auto') {
                lang = detectLanguage(originalTxt) || 'plaintext';
                monaco.editor.setModelLanguage(originalModel, lang);
                monaco.editor.setModelLanguage(modifiedModel, lang);
            }
        }
    }

    // Function to detect language
    function detectLanguage(text) {
        if (!text || !window.hljs) return null;
        try {
            // Speed optimization: highlightAuto performs better on smaller snippets
            const textToAnalyze = text.substring(0, 1000); 
            const result = hljs.highlightAuto(textToAnalyze);
            const detected = result.language;
            
            // Map highlight.js IDs to Monaco IDs
            const languageMap = {
                'js': 'javascript',
                'ts': 'typescript',
                'bash': 'shell',
                'sh': 'shell',
                'xml': 'html',
                'py': 'python',
                'yml': 'yaml',
                'yaml': 'yaml',
                'groovy': 'groovy',
                'java': 'java',
                'cpp': 'cpp',
                'c': 'c',
                'cs': 'csharp',
                'go': 'go',
                'rust': 'rust',
                'php': 'php',
                'ruby': 'ruby',
                'swift': 'swift',
                'kotlin': 'kotlin',
                'sql': 'sql',
                'dockerfile': 'dockerfile',
                'json': 'json',
                'markdown': 'markdown',
                'md': 'markdown'
            };
            
            return languageMap[detected] || detected;
        } catch (e) {
            console.error("Auto detect failed:", e);
            return null;
        }
    }

    // Handle window resize for input panels
    window.addEventListener('resize', () => {
        if (diffEditor) {
            diffEditor.layout();
        }
    });
});

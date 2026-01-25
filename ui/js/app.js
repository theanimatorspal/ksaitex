import * as api from './modules/api.js';
import * as ui from './modules/ui.js';
import * as editor from './modules/editor.js';

// DOM Elements
const convertBtn = document.getElementById('convertBtn');
const markdownEditor = document.getElementById('markdownEditor');
const templateSelect = document.getElementById('templateSelect');
const pdfPreview = document.getElementById('pdfPreview');
const tabsHeader = document.getElementById('tabsHeader');
const tabsContent = document.getElementById('tabsContent');
const loadingOverlay = document.getElementById('loadingOverlay');
const errorOverlay = document.getElementById('errorOverlay');
const errorLog = document.getElementById('errorLog');
const closeErrorBtn = document.getElementById('closeErrorBtn');
const emptyState = document.getElementById('emptyState');
const uploadBtn = document.getElementById('uploadBtn');
const mdUploadInput = document.getElementById('mdUploadInput');

let availableTemplates = {};

// Bootstrap
document.addEventListener('DOMContentLoaded', async () => {
    // Initial Setup
    editor.initEditor(markdownEditor);
    editor.setInitialMarkdown(markdownEditor);

    // Load Data
    await loadTemplates();

    // Event Listeners
    templateSelect.addEventListener('change', (e) => {
        ui.renderTabs(e.target.value, availableTemplates, {
            tabsHeader,
            tabsContent,
            onMagicClick: (label) => editor.insertMagicCommand(label, markdownEditor)
        });
    });

    convertBtn.addEventListener('click', compile);

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            compile();
        }
    });

    if (closeErrorBtn) {
        closeErrorBtn.addEventListener('click', () => {
            errorOverlay.classList.add('hidden');
        });
    }

    // Upload Logic
    if (uploadBtn && mdUploadInput) {
        uploadBtn.addEventListener('click', () => mdUploadInput.click());
        mdUploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target.result;
                editor.loadContent(text, markdownEditor);
                // Reset input so the same file can be uploaded again
                mdUploadInput.value = '';
            };
            reader.onerror = () => ui.showError("Failed to read file", errorLog, errorOverlay);
            reader.readAsText(file);
        });
    }
});

async function loadTemplates() {
    try {
        availableTemplates = await api.fetchTemplates();

        templateSelect.innerHTML = '';
        Object.keys(availableTemplates).sort().forEach(t => {
            const option = document.createElement('option');
            option.value = t;
            option.textContent = ui.formatTemplateName(t);
            templateSelect.appendChild(option);
        });

        if (availableTemplates['base']) templateSelect.value = 'base';

        ui.renderTabs(templateSelect.value, availableTemplates, {
            tabsHeader,
            tabsContent,
            onMagicClick: (label) => editor.insertMagicCommand(label, markdownEditor)
        });
    } catch (e) {
        ui.showError("Failed to fetch templates: " + e.message, errorLog, errorOverlay);
    }
}

async function compile() {
    const markdown = editor.getMarkdownContent(markdownEditor);
    if (!markdown.trim()) return;

    ui.setLoading(true, convertBtn, loadingOverlay);
    errorOverlay.classList.add('hidden');
    emptyState.classList.add('hidden');

    try {
        const variables = {};
        document.querySelectorAll('.dynamic-input').forEach(input => {
            const val = input.value.trim();
            if (val !== "") {
                variables[input.id] = val;
            }
        });

        const blob = await api.compileLatex(markdown, templateSelect.value, variables);
        const url = URL.createObjectURL(blob);

        pdfPreview.src = url;
        pdfPreview.classList.remove('hidden');
    } catch (error) {
        ui.showError(error.message, errorLog, errorOverlay);
    } finally {
        ui.setLoading(false, convertBtn, loadingOverlay);
    }
}

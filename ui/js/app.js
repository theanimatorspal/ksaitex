const convertBtn = document.getElementById('convertBtn');
const markdownInput = document.getElementById('markdownInput');
const templateSelect = document.getElementById('templateSelect');
const pdfPreview = document.getElementById('pdfPreview');
const tabsHeader = document.getElementById('tabsHeader');
const tabsContent = document.getElementById('tabsContent');
const loadingOverlay = document.getElementById('loadingOverlay');
const errorOverlay = document.getElementById('errorOverlay');
const errorLog = document.getElementById('errorLog');
const closeErrorBtn = document.getElementById('closeErrorBtn');
const emptyState = document.getElementById('emptyState');

let availableTemplates = {};

// Initial Setup
document.addEventListener('DOMContentLoaded', async () => {
    await fetchTemplates();
    setInitialMarkdown();

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            compile();
        }
    });
});

async function fetchTemplates() {
    try {
        const res = await fetch('/api/templates');
        const data = await res.json();
        availableTemplates = data.templates;

        templateSelect.innerHTML = '';
        Object.keys(availableTemplates).sort().forEach(t => {
            const option = document.createElement('option');
            option.value = t;
            option.textContent = formatTemplateName(t);
            templateSelect.appendChild(option);
        });

        if (availableTemplates['base']) templateSelect.value = 'base';

        renderTabs(templateSelect.value);

    } catch (e) {
        console.error("Failed to fetch templates", e);
    }
}

templateSelect.addEventListener('change', (e) => {
    renderTabs(e.target.value);
});

function renderTabs(templateName) {
    const metadata = availableTemplates[templateName] || { variables: {}, magic_commands: [] };
    const vars = metadata.variables || {};
    const magicCommands = metadata.magic_commands || [];

    // Group variables by tab
    const tabs = {};
    const DEFAULT_TAB = 'General';

    Object.values(vars).forEach(meta => {
        const tabName = meta.tab || DEFAULT_TAB;
        if (!tabs[tabName]) tabs[tabName] = [];
        tabs[tabName].push(meta);
    });

    // Clear existing
    tabsHeader.innerHTML = '';
    tabsContent.innerHTML = '';

    // Create Tabs
    const tabNames = Object.keys(tabs).sort((a, b) => {
        if (a === 'General') return -1;
        if (b === 'General') return 1;
        if (a === 'Advanced') return 1;
        if (b === 'Advanced') return -1;
        return a.localeCompare(b);
    });

    // Add "Magic" tab if commands exist
    if (magicCommands.length > 0) {
        tabNames.push('Magic');
    }

    if (tabNames.length === 0) {
        tabsHeader.innerHTML = '<span class="text-muted" style="padding:1rem">No Options</span>';
        return;
    }

    tabNames.forEach((name, index) => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${index === 0 ? 'active' : ''}`;
        btn.textContent = name;
        btn.onclick = () => switchTab(name);
        tabsHeader.appendChild(btn);

        const pane = document.createElement('div');
        pane.className = `tab-pane ${index === 0 ? 'active' : ''}`;
        pane.id = `tab-${name}`;

        if (name === 'Magic') {
            // Render magic command buttons
            magicCommands.forEach(cmd => {
                const cmdBtn = document.createElement('button');
                cmdBtn.className = 'magic-btn';
                cmdBtn.textContent = cmd.label;
                cmdBtn.onclick = () => insertMagicCommand(cmd.label);
                pane.appendChild(cmdBtn);
            });
        } else {
            // Render inputs for this tab
            tabs[name].forEach(meta => {
                const group = document.createElement('div');
                group.className = 'form-group';

                const label = document.createElement('label');
                label.textContent = meta.label || formatLabel(meta.name);
                label.htmlFor = meta.name;

                let input;
                if (meta.type === 'select' && meta.options) {
                    input = document.createElement('select');
                    input.id = meta.name;
                    input.className = 'dynamic-input';
                    meta.options.forEach(opt => {
                        const option = document.createElement('option');
                        option.value = opt;
                        option.textContent = opt;
                        input.appendChild(option);
                    });
                    input.value = meta.default;
                } else {
                    input = document.createElement('input');
                    input.type = 'text';
                    input.id = meta.name;
                    input.value = meta.default;
                    input.className = 'dynamic-input';
                }

                group.appendChild(label);
                group.appendChild(input);
                pane.appendChild(group);
            });
        }

        tabsContent.appendChild(pane);
    });
}

function insertMagicCommand(label) {
    const magicString = `[${label}]`;
    const start = markdownInput.selectionStart;
    const end = markdownInput.selectionEnd;
    const text = markdownInput.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    markdownInput.value = before + magicString + after;
    markdownInput.selectionStart = markdownInput.selectionEnd = start + magicString.length;
    markdownInput.focus();
}

function switchTab(name) {
    // Update Buttons
    const buttons = tabsHeader.querySelectorAll('.tab-btn');
    buttons.forEach(b => {
        if (b.textContent === name) b.classList.add('active');
        else b.classList.remove('active');
    });

    // Update Panes
    const panes = tabsContent.querySelectorAll('.tab-pane');
    panes.forEach(p => {
        if (p.id === `tab-${name}`) p.classList.add('active');
        else p.classList.remove('active');
    });
}

function formatLabel(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatTemplateName(name) {
    return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Convert
convertBtn.addEventListener('click', compile);

async function compile() {
    const markdown = markdownInput.value;
    if (!markdown.trim()) return;

    setLoading(true);
    errorOverlay.classList.add('hidden');
    emptyState.classList.add('hidden');

    try {
        const variables = {};
        const inputs = document.querySelectorAll('.dynamic-input');
        inputs.forEach(input => {
            variables[input.id] = input.value;
        });

        const response = await fetch('/api/compile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                markdown: markdown,
                template: templateSelect.value,
                variables: variables
            })
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            pdfPreview.src = url;
            pdfPreview.classList.remove('hidden');
        } else {
            const errorText = await response.json();
            showError(errorText.detail || "Unknown error occurred");
        }
    } catch (error) {
        showError("Network error: " + error.message);
    } finally {
        setLoading(false);
    }
}

function setLoading(isLoading) {
    if (isLoading) {
        loadingOverlay.classList.remove('hidden');
        convertBtn.disabled = true;
    } else {
        loadingOverlay.classList.add('hidden');
        convertBtn.disabled = false;
    }
}

function showError(msg) {
    if (errorLog) errorLog.textContent = msg;
    if (errorOverlay) errorOverlay.classList.remove('hidden');
}

if (closeErrorBtn) {
    closeErrorBtn.addEventListener('click', () => {
        errorOverlay.classList.add('hidden');
    });
}

function setInitialMarkdown() {
    markdownInput.value = `# Hello, Ksaitex!

This is a **sophisticated** markdown editor.

## Features
- Tabbed Controls
- Dynamic Forms
- Instant Preview

Type something to generate a PDF.
`;
}

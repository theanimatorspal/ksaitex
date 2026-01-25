console.error("DIAGNOSTIC: app.js loaded at " + new Date().toLocaleTimeString());

import * as api from './modules/api.js';
import * as ui from './modules/ui.js';
import * as editor from './modules/editor.js';

console.error("DIAGNOSTIC: Modules imported");

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
const projectTitleInput = document.getElementById('projectTitle');
const saveStatus = document.getElementById('saveStatus');
const openProjectBtn = document.getElementById('openProjectBtn');
const projectList = document.getElementById('projectList');
const newProjectBtn = document.getElementById('newProjectBtn');
const saveProjectBtn = document.getElementById('saveProjectBtn');

// Modal Elements
const newProjectModal = document.getElementById('newProjectModal');
const newProjectTitleInput = document.getElementById('newProjectTitle');
const titleError = document.getElementById('titleError');
const cancelProjectBtn = document.getElementById('cancelProjectBtn');
const createProjectBtn = document.getElementById('createProjectBtn');

let availableTemplates = {};
let projectsListCache = []; // Cache for validation

// Bootstrap
async function init() {
    console.error("DIAGNOSTIC: init() started");
    try {
        if (!markdownEditor || !saveStatus) {
            throw new Error("Critical UI elements missing! Check index.html ids.");
        }

        editor.initEditor(markdownEditor);
        editor.setInitialMarkdown(markdownEditor);

        // Timer
        setInterval(() => {
            autoSave().catch(e => console.error("Interval autoSave failed:", e));
        }, 5000);

        // Load Data
        refreshProjects().catch(e => console.error("Initial refreshProjects failed:", e));
        loadTemplates().catch(e => console.error("Initial loadTemplates failed:", e));

        // Listeners
        templateSelect.addEventListener('change', (e) => {
            ui.renderTabs(e.target.value, availableTemplates, {
                tabsHeader, tabsContent,
                onMagicClick: (label) => editor.insertMagicCommand(label, markdownEditor)
            });
        });

        convertBtn.addEventListener('click', compile);

        if (newProjectBtn) {
            newProjectBtn.addEventListener('click', () => {
                showNewProjectModal();
            });
        }

        if (saveProjectBtn) {
            saveProjectBtn.addEventListener('click', () => {
                autoSave();
            });
        }

        // Modal Listeners
        if (cancelProjectBtn) cancelProjectBtn.onclick = hideNewProjectModal;
        if (createProjectBtn) createProjectBtn.onclick = handleCreateProject;
        if (newProjectTitleInput) {
            newProjectTitleInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleCreateProject();
                if (e.key === 'Escape') hideNewProjectModal();
            });
            // Clear error on type
            newProjectTitleInput.addEventListener('input', () => {
                titleError.classList.add('hidden');
            });
        }

        if (openProjectBtn) openProjectBtn.onclick = (e) => {
            e.stopPropagation();
            projectList.classList.toggle('show');
            refreshProjects();
        };

        window.onclick = (e) => {
            projectList.classList.remove('show');
            // Close modal if clicked outside
            if (e.target === newProjectModal) hideNewProjectModal();
        };

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') compile();
            if (e.ctrlKey && e.key === 's') { e.preventDefault(); autoSave(); }
            if (e.key === 'Escape' && !newProjectModal.classList.contains('hidden')) hideNewProjectModal();
        });

        console.error("DIAGNOSTIC: init() success");
        saveStatus.textContent = "Editor Ready";
    } catch (err) {
        console.error("DIAGNOSTIC: init() CRASH:", err);
        if (saveStatus) saveStatus.textContent = "INIT ERROR: " + err.message;
    }
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function showNewProjectModal() {
    newProjectTitleInput.value = '';
    titleError.classList.add('hidden');
    newProjectModal.classList.remove('hidden');
    newProjectTitleInput.focus();
}

function hideNewProjectModal() {
    newProjectModal.classList.add('hidden');
}

function handleCreateProject() {
    const title = newProjectTitleInput.value.trim();

    // Validation
    if (!title) {
        titleError.textContent = "Title cannot be empty";
        titleError.classList.remove('hidden');
        return;
    }

    const exists = projectsListCache.some(p => p.title.toLowerCase() === title.toLowerCase());
    if (exists) {
        titleError.textContent = "A project with this name already exists";
        titleError.classList.remove('hidden');
        return;
    }

    // Valid - Create Logic
    resetProject(title);
    hideNewProjectModal();
}

function resetProject(newTitle = "Untitled Project") {
    console.error("DIAGNOSTIC: Resetting project to", newTitle);
    projectTitleInput.value = newTitle;

    // Clear editor to blank slate
    console.error("DIAGNOSTIC: Clearing editor content now");
    markdownEditor.innerHTML = '<div><br></div>';
    console.error("DIAGNOSTIC: Editor content cleared");

    // Reset status
    saveStatus.textContent = "New Project";

    // Reset template selection
    if (availableTemplates['base']) {
        templateSelect.value = 'base';
        // Re-render tabs for base template
        ui.renderTabs('base', availableTemplates, {
            tabsHeader, tabsContent,
            onMagicClick: (label) => editor.insertMagicCommand(label, markdownEditor)
        });
    }

    // Clear any dynamic inputs
    document.querySelectorAll('.dynamic-input').forEach(input => {
        if (input.tagName === 'SELECT') {
            input.selectedIndex = 0;
        } else {
            input.value = '';
        }
    });
}

async function loadTemplates() {
    try {
        availableTemplates = await api.fetchTemplates();
        templateSelect.innerHTML = '';
        Object.keys(availableTemplates).sort().forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = ui.formatTemplateName(t);
            templateSelect.appendChild(opt);
        });
        if (availableTemplates['base']) templateSelect.value = 'base';
        ui.renderTabs(templateSelect.value, availableTemplates, {
            tabsHeader, tabsContent,
            onMagicClick: (label) => editor.insertMagicCommand(label, markdownEditor)
        });
    } catch (e) {
        console.error("loadTemplates failed:", e);
    }
}

async function compile() {
    const markdown = editor.getMarkdownContent(markdownEditor);
    if (!markdown.trim()) return;
    ui.setLoading(true, convertBtn, loadingOverlay);
    try {
        const variables = {};
        document.querySelectorAll('.dynamic-input').forEach(input => {
            if (input.value.trim()) variables[input.id] = input.value.trim();
        });
        const blob = await api.compileLatex(markdown, templateSelect.value, variables);
        pdfPreview.src = URL.createObjectURL(blob);
        pdfPreview.classList.remove('hidden');
        emptyState.classList.add('hidden');
    } catch (error) {
        ui.showError(error.message, errorLog, errorOverlay);
    } finally {
        ui.setLoading(false, convertBtn, loadingOverlay);
    }
}

async function autoSave() {
    console.error("DIAGNOSTIC: autoSave() tick");
    const title = projectTitleInput.value.trim() || "Untitled Project";
    const markdown = editor.getMarkdownContent(markdownEditor);
    const template = templateSelect.value;
    const variables = {};
    document.querySelectorAll('.dynamic-input').forEach(input => {
        if (input.value.trim()) variables[input.id] = input.value.trim();
    });

    saveStatus.textContent = "Saving...";
    try {
        const res = await api.saveProject(title, markdown, template, variables);
        console.error("DIAGNOSTIC: Save response:", res);
        saveStatus.textContent = "Saved at " + new Date().toLocaleTimeString();
    } catch (e) {
        console.error("DIAGNOSTIC: Save FAILED:", e);
        saveStatus.textContent = "Save Failed: " + e.message;
    }
}

async function refreshProjects() {
    try {
        const projects = await api.fetchProjects();
        projectsListCache = projects; // Update cache
        projectList.innerHTML = '';
        if (projects.length === 0) {
            projectList.innerHTML = '<div class="dropdown-item">No projects</div>';
        } else {
            projects.forEach(p => {
                const item = document.createElement('div');
                item.className = 'dropdown-item';
                item.textContent = p.title;
                item.onclick = (e) => {
                    e.stopPropagation();
                    loadProject(p.id);
                    projectList.classList.remove('show');
                };
                projectList.appendChild(item);
            });
        }
    } catch (e) {
        console.error("refreshProjects failed:", e);
    }
}

async function loadProject(id) {
    try {
        const data = await api.fetchProject(id);
        projectTitleInput.value = data.title;
        editor.loadContent(data.markdown, markdownEditor);
        if (data.template) {
            templateSelect.value = data.template;
            await ui.renderTabs(data.template, availableTemplates, {
                tabsHeader, tabsContent,
                onMagicClick: (label) => editor.insertMagicCommand(label, markdownEditor)
            });
        }
        if (data.variables) {
            setTimeout(() => {
                Object.entries(data.variables).forEach(([k, v]) => {
                    const el = document.getElementById(k);
                    if (el) el.value = v;
                });
            }, 100);
        }
        saveStatus.textContent = "Project Loaded";
    } catch (e) {
        ui.showError("Load Failed: " + e.message, errorLog, errorOverlay);
    }
}

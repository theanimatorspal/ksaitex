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

// Rename Modal Elements
const renameProjectModal = document.getElementById('renameProjectModal');
const renameProjectTitleInput = document.getElementById('renameProjectTitle');
const renameTitleError = document.getElementById('renameTitleError');
const cancelRenameBtn = document.getElementById('cancelRenameBtn');
const confirmRenameBtn = document.getElementById('confirmRenameBtn');

// Welcome Screen Elements
const welcomeScreen = document.getElementById('welcomeScreen');
const welcomeProjectList = document.getElementById('welcomeProjectList');
const welcomeNewBtn = document.getElementById('welcomeNewBtn');

let availableTemplates = {};
let projectsListCache = []; // Cache for validation
let currentProjectId = null; // Track active project ID

// Bootstrap
async function init() {
    console.error("DIAGNOSTIC: init() started");
    try {
        if (!markdownEditor || !saveStatus) {
            throw new Error("Critical UI elements missing! Check index.html ids.");
        }

        editor.initEditor(markdownEditor);
        // Do NOT set initial markdown here. Wait for project selection.

        // Timer
        setInterval(() => {
            if (currentProjectId) {
                autoSave().catch(e => console.error("Interval autoSave failed:", e));
            }
        }, 5000);

        // Load Data
        await refreshProjects(); // Load projects first for welcome screen
        loadTemplates().catch(e => console.error("Initial loadTemplates failed:", e));

        // Show Welcome Screen
        showWelcomeScreen();

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

        // Welcome Screen specifics
        if (welcomeNewBtn) {
            welcomeNewBtn.onclick = () => {
                hideWelcomeScreen();
                showNewProjectModal();
            };
        }

        if (saveProjectBtn) {
            saveProjectBtn.addEventListener('click', () => {
                if (currentProjectId) autoSave();
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
            newProjectTitleInput.addEventListener('input', () => titleError.classList.add('hidden'));
        }

        // Rename Listeners
        if (projectTitleInput) {
            projectTitleInput.onclick = () => {
                if (currentProjectId) showRenameModal();
            };
        }
        if (cancelRenameBtn) cancelRenameBtn.onclick = hideRenameModal;
        if (confirmRenameBtn) confirmRenameBtn.onclick = handleRenameProject;
        if (renameProjectTitleInput) {
            renameProjectTitleInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleRenameProject();
                if (e.key === 'Escape') hideRenameModal();
            });
            renameProjectTitleInput.addEventListener('input', () => renameTitleError.classList.add('hidden'));
        }

        if (openProjectBtn) openProjectBtn.onclick = (e) => {
            e.stopPropagation();
            projectList.classList.toggle('show');
            // refreshProjects already ran, but we can re-run
            refreshProjects();
        };

        window.onclick = (e) => {
            projectList.classList.remove('show');
            if (e.target === newProjectModal) hideNewProjectModal();
            if (e.target === renameProjectModal) hideRenameModal();
        };

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') compile();
            if (e.ctrlKey && e.key === 's') { e.preventDefault(); if (currentProjectId) autoSave(); }
            if (e.key === 'Escape') {
                if (!newProjectModal.classList.contains('hidden')) hideNewProjectModal();
                if (!renameProjectModal.classList.contains('hidden')) hideRenameModal();
            }
        });

        console.error("DIAGNOSTIC: init() success");
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

function showWelcomeScreen() {
    welcomeScreen.classList.remove('hidden');
    refreshWelcomeList();
}

function hideWelcomeScreen() {
    welcomeScreen.classList.add('hidden');
}

function refreshWelcomeList() {
    welcomeProjectList.innerHTML = '';
    if (projectsListCache.length === 0) {
        welcomeProjectList.innerHTML = '<div style="padding:10px; color:var(--fg3); font-style:italic;">No projects yet. Create one!</div>';
        return;
    }

    projectsListCache.forEach(p => {
        const row = document.createElement('div');
        row.style.cssText = "padding: 10px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; cursor: pointer;";

        const titleSpan = document.createElement('span');
        titleSpan.textContent = p.title;
        titleSpan.style.fontWeight = "600";

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        delBtn.className = "icon-btn";
        delBtn.title = "Delete Project";
        delBtn.style.color = "var(--red)";
        delBtn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm(`Delete project "${p.title}" permanently?`)) {
                await api.deleteProject(p.id);
                await refreshProjects();
                refreshWelcomeList();
            }
        };

        row.appendChild(titleSpan);
        row.appendChild(delBtn);

        row.onclick = () => {
            loadProject(p.id);
            hideWelcomeScreen();
        };

        row.onmouseover = () => row.style.backgroundColor = "var(--bg1)";
        row.onmouseout = () => row.style.backgroundColor = "transparent";

        welcomeProjectList.appendChild(row);
    });
}


function showNewProjectModal() {
    newProjectTitleInput.value = '';
    titleError.classList.add('hidden');
    newProjectModal.classList.remove('hidden');
    newProjectTitleInput.focus();
}

function hideNewProjectModal() {
    newProjectModal.classList.add('hidden');
    // If we are canceling and no project is loaded, go back to welcome screen
    if (!currentProjectId) {
        showWelcomeScreen();
    }
}

function handleCreateProject() {
    const title = newProjectTitleInput.value.trim();
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
    // Create new
    resetProject(title);
    hideNewProjectModal();
    hideWelcomeScreen();
}

// Rename Logic
function showRenameModal() {
    renameProjectTitleInput.value = projectTitleInput.value;
    renameTitleError.classList.add('hidden');
    renameProjectModal.classList.remove('hidden');
    renameProjectTitleInput.focus();
}

function hideRenameModal() {
    renameProjectModal.classList.add('hidden');
}

async function handleRenameProject() {
    const newTitle = renameProjectTitleInput.value.trim();
    if (!newTitle) {
        renameTitleError.textContent = "Title cannot be empty";
        renameTitleError.classList.remove('hidden');
        return;
    }
    // Check if changed
    if (newTitle === projectTitleInput.value) {
        hideRenameModal();
        return;
    }

    // Check uniqueness
    const exists = projectsListCache.some(p => p.title.toLowerCase() === newTitle.toLowerCase());
    if (exists) {
        renameTitleError.textContent = "Project name already exists";
        renameTitleError.classList.remove('hidden');
        return;
    }

    try {
        const res = await api.renameProject(currentProjectId, newTitle);
        // Success
        currentProjectId = res.new_id;
        projectTitleInput.value = newTitle;
        await refreshProjects();
        hideRenameModal();
        saveStatus.textContent = "Project Renamed";
    } catch (e) {
        renameTitleError.textContent = e.message;
        renameTitleError.classList.remove('hidden');
    }
}

function resetProject(newTitle = "Untitled Project") {
    console.error("DIAGNOSTIC: Resetting project to", newTitle);
    projectTitleInput.value = newTitle;

    // Fake ID for now until saved, OR we allow saving immediately?
    // User wants it to essentially be a new project. 
    // We will let autoSave create the folder structure shortly.
    // BUT we need an ID for rename to work. 
    // Best practice: Save immediately?
    // Let's clear editor first.

    editor.clearContent(markdownEditor);
    saveStatus.textContent = "New Project";

    // Use the sanitized default ID logic locally just for UI state?
    // Actually, let's just trigger a Save immediately to establish the project on disk.
    // This aligns with user request "I have to press ok to trigger it".

    // We need to set currentProjectId temporarily to facilitate the first save,
    // or we can just call saveProject directly.
    currentProjectId = null; // It's new.

    // Reset Template
    if (availableTemplates['base']) {
        templateSelect.value = 'base';
        ui.renderTabs('base', availableTemplates, {
            tabsHeader, tabsContent,
            onMagicClick: (label) => editor.insertMagicCommand(label, markdownEditor)
        });
    }
    // Clear Inputs
    document.querySelectorAll('.dynamic-input').forEach(input => {
        if (input.tagName === 'SELECT') input.selectedIndex = 0;
        else input.value = '';
    });

    // FORCE SAVE NOW to create the project on disk
    api.saveProject(newTitle, "", "base", {}).then(res => {
        // extract ID from path ?? Path is "data/Title/project.json"
        // We can infer it from the title for now or wait for refresh.
        refreshProjects().then(() => {
            // Find the project we just made
            const p = projectsListCache.find(x => x.title === newTitle);
            if (p) currentProjectId = p.id;
        });
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
    const title = projectTitleInput.value.trim();
    if (!title) return; // Should not happen with validation but safety first

    const markdown = editor.getMarkdownContent(markdownEditor);
    const html = editor.getHTMLContent(markdownEditor);
    const template = templateSelect.value;
    const variables = {};
    document.querySelectorAll('.dynamic-input').forEach(input => {
        if (input.value.trim()) variables[input.id] = input.value.trim();
    });

    saveStatus.textContent = "Saving...";
    saveStatus.classList.add('saving');
    try {
        // We always pass HTML now for persistence
        const res = await api.saveProject(title, markdown, template, variables, html);
        saveStatus.textContent = "Saved at " + new Date().toLocaleTimeString();
        saveStatus.classList.remove('saving');
    } catch (e) {
        console.error("DIAGNOSTIC: Save FAILED:", e);
        saveStatus.textContent = "Save Failed";
    }
}

async function refreshProjects() {
    try {
        const projects = await api.fetchProjects();
        projectsListCache = projects; // Update cache

        // Also update the dropdown list just in case
        projectList.innerHTML = '';
        if (projects.length === 0) {
            projectList.innerHTML = '<div class="dropdown-item">No projects</div>';
        } else {
            projects.forEach(p => {
                const item = document.createElement('div');
                item.className = 'dropdown-item';
                item.textContent = p.title;
                item.style.display = "flex";
                item.style.justifyContent = "space-between";

                // Add Delete Btn to dropdown too
                const trash = document.createElement('i');
                trash.className = "fa-solid fa-trash";
                trash.style.color = "var(--red)";
                trash.style.marginLeft = "10px";
                trash.onclick = async (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete project "${p.title}" permanently?`)) {
                        await api.deleteProject(p.id);
                        await refreshProjects();
                        refreshWelcomeList();
                        if (currentProjectId === p.id) {
                            showWelcomeScreen(); // Kick user out if they delete active project
                        }
                    }
                };

                item.appendChild(trash);

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
        currentProjectId = id; // Set active ID
        projectTitleInput.value = data.title;

        // Prefer HTML if available (preserves magic blocks), else Markdown (legacy)
        if (data.html) {
            editor.setHTMLContent(data.html, markdownEditor);
        } else {
            editor.loadContent(data.markdown, markdownEditor);
        }

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

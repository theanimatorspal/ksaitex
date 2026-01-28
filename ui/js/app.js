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
const newProjectBtn = document.getElementById('newProjectBtn');
const saveProjectBtn = document.getElementById('saveProjectBtn');
const syncStatus = document.getElementById('syncStatus'); // New

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
                onMagicClick: (cmd) => editor.insertMagicCommand(cmd, markdownEditor)
            });
        });

        convertBtn.addEventListener('click', compile);

        // Sync Logic
        let syncDebounceTimer = null;
        const lineStatus = document.getElementById('lineStatus'); // Get Element

        function triggerSync() {
            // Only sync if editor is focused or selection is inside it
            // We want to update Line/Page status.

            const sel = window.getSelection();
            if (!sel.anchorNode && !window.pendingSync) return; // Allow manual trigger

            // For now, let's just proceed.

            if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
            syncDebounceTimer = setTimeout(async () => {
                if (!currentProjectId) return;

                const lineIndex = editor.getCursorLine(markdownEditor);
                // Convert to 1-based
                const line = lineIndex + 1;

                try {
                    const res = await api.syncPosition(currentProjectId, line);
                    if (res.status === 'success') {
                        syncStatus.textContent = `Page: ${res.page}`;
                        syncStatus.dataset.page = res.page;
                        syncStatus.classList.remove('hidden');

                        // Use the page to reverse sync and get the "start line" of the page
                        try {
                            const revRes = await api.reverseSync(currentProjectId, res.page);
                            if (revRes.status === 'success') {
                                lineStatus.textContent = `Line: ${revRes.line}`;
                                lineStatus.dataset.line = revRes.line;
                                lineStatus.classList.remove('hidden');
                            }
                        } catch (e) { console.error("Reverse sync failed", e); }
                    }
                } catch (e) {
                    console.error("Sync error", e);
                }
            }, 500); // 500ms debounce
        }

        document.addEventListener('selectionchange', triggerSync);
        // Also trigger on keyup to be responsive
        markdownEditor.addEventListener('keyup', triggerSync);
        markdownEditor.addEventListener('click', triggerSync);

        if (syncStatus) {
            syncStatus.addEventListener('click', () => {
                const p = syncStatus.dataset.page;
                if (p && pdfPreview.src) {
                    // Reload iframe with #page param
                    // Note: Replacing src completely might flicker.
                    const cleanSrc = pdfPreview.src.split('#')[0];
                    pdfPreview.src = cleanSrc + "#page=" + p;
                }
            });
        }

        if (lineStatus) {
            lineStatus.addEventListener('click', () => {
                const l = parseInt(lineStatus.dataset.line);
                if (l) {
                    editor.scrollToLine(l, markdownEditor);
                }
            });
        }

        if (newProjectBtn) {
            newProjectBtn.addEventListener('click', () => {
                showNewProjectModal();
            });
        }

        // Undo/Redo
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');

        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                editor.focusAndRestore(markdownEditor);
                document.execCommand('undo');
            });
        }

        if (redoBtn) {
            redoBtn.addEventListener('click', () => {
                editor.focusAndRestore(markdownEditor);
                document.execCommand('redo');
            });
        }

        // Upload Logic
        const uploadChoiceModal = document.getElementById('uploadChoiceModal');
        const uploadReplaceBtn = document.getElementById('uploadReplaceBtn');
        const uploadNewBtn = document.getElementById('uploadNewBtn');
        const uploadCancelBtn = document.getElementById('uploadCancelBtn');
        let pendingUploadContent = "";
        let pendingUploadFilename = "";

        if (uploadBtn && mdUploadInput) {
            uploadBtn.addEventListener('click', () => {
                mdUploadInput.value = ''; // Reset
                mdUploadInput.click();
            });

            mdUploadInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (ev) => {
                    pendingUploadContent = ev.target.result;
                    pendingUploadFilename = file.name.replace(/\.[^/.]+$/, ""); // Remove extension

                    // Show choice modal
                    uploadChoiceModal.classList.remove('hidden');
                };
                reader.readAsText(file);
            });
        }

        if (uploadReplaceBtn) {
            uploadReplaceBtn.addEventListener('click', () => {
                if (!currentProjectId) {
                    alert("No active project to replace. Please create a new project.");
                    return;
                }

                if (confirm("This will overwrite your current editor content. Are you sure?")) {
                    editor.loadContent(pendingUploadContent, markdownEditor);
                    autoSave(); // Save immediately
                    uploadChoiceModal.classList.add('hidden');
                }
            });
        }

        if (uploadNewBtn) {
            uploadNewBtn.addEventListener('click', () => {
                uploadChoiceModal.classList.add('hidden');

                // Pre-fill new project modal
                newProjectTitleInput.value = pendingUploadFilename;
                showNewProjectModal();

                // We need to inject content after project creation.
                // Hack: store it in a global or pass it?
                // Let's modify handleCreateProject to check for pending content.
                // Or better: We can set a flag.
                window.pendingNewProjectContent = pendingUploadContent;
            });
        }

        if (uploadCancelBtn) {
            uploadCancelBtn.addEventListener('click', () => {
                uploadChoiceModal.classList.add('hidden');
                pendingUploadContent = "";
                window.pendingNewProjectContent = null;
            });
        }

        // Welcome Screen specifics
        if (welcomeNewBtn) {
            welcomeNewBtn.onclick = () => {
                hideWelcomeScreen();
                showNewProjectModal();
            };
        }

        const brandBtn = document.getElementById('brandBtn');
        if (brandBtn) {
            brandBtn.onclick = () => {
                showWelcomeScreen();
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

        // Global Magic Command Interaction
        // We use a global listener to guarantee we catch clicks even inside contenteditable
        document.body.addEventListener('mousedown', (e) => {
            const btn = e.target.closest('.magic-arg-btn');
            if (btn) {
                // Prevent editor from stealing focus or moving caret weirdly
                e.preventDefault();
                e.stopPropagation();

                const block = btn.closest('.magic-block');
                if (block) {
                    const argName = btn.dataset.name;
                    openCommandModalWithTab(block, argName);
                }
            }
        }, true); // Capture phase

        // Unified Command Edit Modal
        const editCommandModal = document.getElementById('editCommandModal');
        const editCommandLabel = document.getElementById('editCommandLabel');
        const commandFields = document.getElementById('commandFields');
        const saveCommandBtn = document.getElementById('saveCommandBtn');
        const cancelCommandBtn = document.getElementById('cancelCommandBtn');

        let currentEditingBlock = null;

        function openCommandModal(block) {
            currentEditingBlock = block;
            const label = block.dataset.label;
            const schema = block.dataset.argsSchema || "";

            editCommandLabel.textContent = `Edit ${label}`;
            commandFields.innerHTML = '';
            editCommandModal.classList.remove('hidden');

            // Determine which arg was clicked to auto-select it
            // We can find this by checking which button triggered the event? 
            // Actually, the global mousedown handler passed 'block', but we can check the event target if we had it but we don't here.
            // Wait, we need to know the 'active arg'.
            // Let's modify openCommandModal to accept 'activeArgName'
        }

        // Helper to switch tabs
        function activateArgTab(name) {
            const tabs = commandFields.querySelectorAll('.arg-tab');
            const panels = commandFields.querySelectorAll('.arg-panel');

            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));

            const activeTab = commandFields.querySelector(`.arg-tab[data-target="${name}"]`);
            const activePanel = document.getElementById(`panel-${name}`);

            if (activeTab) activeTab.classList.add('active');
            if (activePanel) {
                activePanel.classList.add('active');
                // Focus input
                const input = activePanel.querySelector('.dynamic-arg-input');
                if (input) setTimeout(() => input.focus(), 50);
            }
        }

        function openCommandModalWithTab(block, targetArgName) {
            console.log("Opening Modal for:", block.dataset.label, "Target:", targetArgName);
            openCommandModal(block); // Reset

            // Build Tab Layout
            const container = document.createElement('div');
            container.className = 'arg-tabs-container';

            const sidebar = document.createElement('div');
            sidebar.className = 'arg-tabs-sidebar';

            const content = document.createElement('div');
            content.className = 'arg-tabs-content';

            container.appendChild(sidebar);
            container.appendChild(content);
            commandFields.appendChild(container);

            const schema = block.dataset.argsSchema || "";
            if (!schema) return;

            const schemaItems = schema.split('|');
            let firstArg = null;

            schemaItems.forEach(item => {
                const parts = item.split(':');
                const name = parts[0].trim();
                const typeDef = (parts[1] || 'text').trim();

                if (!firstArg) firstArg = name;
                console.log("Processing Arg:", name, "Type:", typeDef);

                // 1. Sidebar Tab
                const tab = document.createElement('button');
                tab.className = 'arg-tab';
                tab.textContent = ui.formatLabel(name);
                tab.dataset.target = name;
                tab.onclick = () => activateArgTab(name);
                sidebar.appendChild(tab);

                // 2. Content Panel
                const panel = document.createElement('div');
                panel.className = 'arg-panel';
                panel.id = `panel-${name}`;

                // Current Value
                const existingBtn = block.querySelector(`.magic-arg-btn[data-name="${name}"]`);
                const currentVal = existingBtn ? existingBtn.dataset.fullValue : (parts[2] || "");

                // Input Field
                let input;
                if (typeDef.startsWith('select')) {
                    input = document.createElement('select');
                    input.className = 'dynamic-arg-input';
                    const opts = typeDef.split(',');
                    // opts[0] is 'select'
                    for (let i = 1; i < opts.length; i++) {
                        const opt = document.createElement('option');
                        opt.value = opts[i].trim();
                        opt.textContent = opts[i].trim();
                        input.appendChild(opt);
                    }
                    input.value = currentVal;
                } else if (typeDef === 'textarea') {
                    console.log("Creating Textarea for", name);
                    input = document.createElement('textarea');
                    input.className = 'dynamic-arg-input';
                    // Force inline styles for safety
                    input.style.width = "100%";
                    input.style.height = "100%";
                    input.style.display = "block";
                    input.style.minHeight = "200px"; // Guarantee visible height
                    input.value = currentVal;
                } else {
                    // Default to Textarea for everything else as requested
                    input = document.createElement('textarea');
                    input.className = 'dynamic-arg-input';
                    input.style.width = "100%";
                    input.style.height = "100%";
                    input.style.display = "block";
                    input.style.minHeight = "150px";
                    input.style.resize = "vertical";
                    input.value = currentVal;
                }

                input.dataset.fieldName = name;
                panel.appendChild(input);
                content.appendChild(panel);
            });

            // Activate initial tab
            const finalTarget = targetArgName || firstArg;
            console.log("Activating Tab:", finalTarget);
            activateArgTab(finalTarget);
        }

        function closeCommandModal() {
            editCommandModal.classList.add('hidden');
            currentEditingBlock = null;
        }

        // Context Menu Logic
        const contextMenu = document.getElementById('editorContextMenu');

        // Hide context menu on any click
        document.addEventListener('click', () => {
            if (contextMenu) contextMenu.classList.add('hidden');
        });

        if (markdownEditor && contextMenu) {
            markdownEditor.addEventListener('contextmenu', (e) => {
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();
                const targetBlock = e.target.closest('.magic-block');

                // Save range immediately
                let savedRange = null;
                if (selection.rangeCount > 0) {
                    savedRange = selection.getRangeAt(0).cloneRange();
                }

                // Case 1: Swapping an existing block
                // Case 2: Standard text selection insertion
                // Case 3: Empty space (allow menu always)

                e.preventDefault();

                // Get commands from current template
                const currentTemplate = templateSelect.value;
                const metadata = availableTemplates[currentTemplate];
                const commands = (metadata && metadata.magic_commands)
                    ? metadata.magic_commands.filter(cmd => cmd.tab === 'ढाँचा' || cmd.tab === 'Formatting')
                    : [];

                // Capture Swap State
                let swapValue = null;
                if (targetBlock) {
                    const firstBtn = targetBlock.querySelector('.magic-arg-btn');
                    if (firstBtn) swapValue = firstBtn.dataset.fullValue;
                }

                // Populate Menu
                contextMenu.innerHTML = '';

                // -- Standard Actions --
                const createItem = (label, icon, onClick) => {
                    const item = document.createElement('div');
                    item.className = 'context-menu-item';
                    item.innerHTML = `<i class="${icon}"></i> <span>${label}</span>`;
                    item.onclick = (ev) => {
                        ev.stopPropagation();
                        onClick();
                        contextMenu.classList.add('hidden');
                    };
                    return item;
                };

                // कपी (Copy) - Mock Ctrl+C
                if (selectedText) {
                    contextMenu.appendChild(createItem('कपी', 'fa-solid fa-copy', () => {
                        editor.focusAndRestore(markdownEditor);
                        document.execCommand('copy');
                    }));
                }

                // पेस्ट (Paste) - Mock Ctrl+V
                contextMenu.appendChild(createItem('पेस्ट', 'fa-solid fa-paste', async () => {
                    // Check if Clipboard API is available
                    if (navigator.clipboard && navigator.clipboard.readText) {
                        try {
                            const text = await navigator.clipboard.readText();
                            if (text) {
                                editor.focusAndRestore(markdownEditor);
                                document.execCommand('insertText', false, text);
                            }
                        } catch (err) {
                            console.error('Clipboard read failed:', err);
                            alert('कृपया Ctrl+V प्रयोग गर्नुहोस् (Please use Ctrl+V to paste)');
                        }
                    } else {
                        // Clipboard API not available - inform user to use Ctrl+V
                        alert('कृपया Ctrl+V प्रयोग गर्नुहोस् (Please use Ctrl+V to paste)');
                    }
                }));

                if (commands.length > 0) {
                    const divider = document.createElement('div');
                    divider.className = 'context-menu-divider';
                    contextMenu.appendChild(divider);
                }

                // MAGIC COMMANDS
                commands.forEach(cmd => {
                    const item = document.createElement('div');
                    item.className = 'context-menu-item';
                    item.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> <span>${cmd.label}</span>`;

                    item.onclick = (ev) => {
                        ev.stopPropagation();
                        let finalOverrides = {};
                        const valToInject = targetBlock ? swapValue : selectedText;

                        if (cmd.args && valToInject !== null && valToInject !== "") {
                            const firstArgName = cmd.args.split('|')[0].split(':')[0].trim();
                            if (firstArgName) finalOverrides[firstArgName] = valToInject;
                        }

                        // Execute Replacement
                        if (targetBlock) {
                            const range = document.createRange();
                            range.selectNode(targetBlock);
                            selection.removeAllRanges();
                            selection.addRange(range);
                        } else if (savedRange) {
                            selection.removeAllRanges();
                            selection.addRange(savedRange);
                        }

                        editor.insertMagicCommand(cmd, markdownEditor, finalOverrides);
                        contextMenu.classList.add('hidden');
                    };

                    contextMenu.appendChild(item);
                });

                // Position Menu
                contextMenu.style.left = `${e.clientX}px`;
                contextMenu.style.top = `${e.clientY}px`;
                contextMenu.classList.remove('hidden');

                // Adjust position if it overflows height
                const menuRect = contextMenu.getBoundingClientRect();
                if (menuRect.bottom > window.innerHeight) {
                    contextMenu.style.top = `${window.innerHeight - menuRect.height - 10}px`;
                }
                if (menuRect.right > window.innerWidth) {
                    contextMenu.style.left = `${window.innerWidth - menuRect.width - 10}px`;
                }
            });
        }

        if (saveCommandBtn) {
            saveCommandBtn.onclick = () => {
                if (!currentEditingBlock) return;

                // Update DOM elements based on inputs
                const inputs = commandFields.querySelectorAll('.dynamic-arg-input');
                inputs.forEach(input => {
                    const name = input.dataset.fieldName;
                    const val = input.value;

                    const btn = currentEditingBlock.querySelector(`.magic-arg-btn[data-name="${name}"]`);
                    if (btn) {
                        editor.updateArgButton(btn, val);
                    }
                });

                closeCommandModal();
            };
        }

        if (cancelCommandBtn) cancelCommandBtn.onclick = closeCommandModal;

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') compile();
            if (e.ctrlKey && e.key === 's') { e.preventDefault(); if (currentProjectId) autoSave(); }
            if (e.key === 'Escape') {
                if (!newProjectModal.classList.contains('hidden')) hideNewProjectModal();
                if (!renameProjectModal.classList.contains('hidden')) hideRenameModal();
                if (editCommandModal && !editCommandModal.classList.contains('hidden')) closeCommandModal();
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

async function showWelcomeScreen() {
    welcomeScreen.classList.remove('hidden');
    await refreshProjects();
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
    resetProject(title, window.pendingNewProjectContent || "");
    window.pendingNewProjectContent = null; // Consume
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

function resetProject(newTitle = "Untitled Project", initialContent = "") {
    console.error("DIAGNOSTIC: Resetting project to", newTitle);
    projectTitleInput.value = newTitle;

    // Fake ID for now until saved, OR we allow saving immediately?
    // User wants it to essentially be a new project. 
    // We will let autoSave create the folder structure shortly.
    // BUT we need an ID for rename to work. 
    // Best practice: Save immediately?
    // Let's clear editor first.

    editor.loadContent(initialContent, markdownEditor); // Load provided content or empty
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
    api.saveProject(newTitle, initialContent, "base", {}).then(res => {
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
        const title = projectTitleInput.value || "Untitled";
        console.log("DEBUG: Compiling with title:", title);
        const blob = await api.compileLatex(markdown, templateSelect.value, variables, title);

        const blobUrl = URL.createObjectURL(blob);
        let finalSrc = blobUrl;

        // Auto-sync to current cursor position
        if (currentProjectId) {
            const lineIndex = editor.getCursorLine(markdownEditor);
            try {
                // We utilize the just-updated mapping on the server
                const res = await api.syncPosition(currentProjectId, lineIndex + 1);
                if (res.status === 'success') {
                    finalSrc += "#page=" + res.page;
                    if (syncStatus) {
                        syncStatus.textContent = `Page: ${res.page}`;
                        syncStatus.dataset.page = res.page;
                        syncStatus.classList.remove('hidden');
                    }
                }
            } catch (ignore) { }
        }

        pdfPreview.src = finalSrc;
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

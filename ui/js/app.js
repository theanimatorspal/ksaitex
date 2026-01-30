console.error("DIAGNOSTIC: app.js loaded at " + new Date().toLocaleTimeString());
import * as api from './modules/api.js';
import * as ui from './modules/ui.js';
import * as editor from './modules/editor.js';
console.error("DIAGNOSTIC: Modules imported");
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
const syncStatus = document.getElementById('syncStatus');
const newProjectModal = document.getElementById('newProjectModal');
const newProjectTitleInput = document.getElementById('newProjectTitle');
const titleError = document.getElementById('titleError');
const cancelProjectBtn = document.getElementById('cancelProjectBtn');
const createProjectBtn = document.getElementById('createProjectBtn');
const renameProjectModal = document.getElementById('renameProjectModal');
const renameProjectTitleInput = document.getElementById('renameProjectTitle');
const renameTitleError = document.getElementById('renameTitleError');
const cancelRenameBtn = document.getElementById('cancelRenameBtn');
const confirmRenameBtn = document.getElementById('confirmRenameBtn');
const welcomeScreen = document.getElementById('welcomeScreen');
const welcomeProjectList = document.getElementById('welcomeProjectList');
const welcomeNewBtn = document.getElementById('welcomeNewBtn');
let availableTemplates = {};
let projectsListCache = [];
let currentProjectId = null;
let isDirty = false;
async function init() {
    console.error("DIAGNOSTIC: init() started");
    try {
        if (!markdownEditor || !saveStatus) {
            throw new Error("Critical UI elements missing! Check index.html ids.");
        }
        editor.initEditor(markdownEditor);
        setInterval(() => {
            if (currentProjectId && isDirty) {
                autoSave().catch(e => console.error("Interval autoSave failed:", e));
            }
        }, 5000);
        markdownEditor.addEventListener('input', () => { isDirty = true; });
        tabsContent.addEventListener('input', (e) => {
            if (e.target.classList.contains('dynamic-input')) isDirty = true;
        });
        tabsContent.addEventListener('change', (e) => {
            if (e.target.classList.contains('dynamic-input')) isDirty = true;
        });
        await refreshProjects();
        loadTemplates().catch(e => console.error("Initial loadTemplates failed:", e));
        showWelcomeScreen();
        function updateEditorMetadata(templateName) {
            const metadata = availableTemplates[templateName];
            const cmds = metadata ? metadata.magic_commands : [];
            editor.setMagicCommands(cmds);
            return cmds;
        }
        templateSelect.addEventListener('change', (e) => {
            const templateName = e.target.value;
            const cmds = updateEditorMetadata(templateName);
            isDirty = true;
            ui.renderTabs(templateName, availableTemplates, {
                tabsHeader, tabsContent,
                onMagicClick: (cmd) => {
                    if (cmd.pairing === 'end' && cmd.group) {
                        const textBefore = editor.findUnmatchedBegin(markdownEditor, cmd.group);
                        const group = cmd.group;
                        const beginLabels = cmds
                            .filter(c => c.group === group && c.pairing === 'begin')
                            .map(c => c.label);
                        const endLabels = cmds
                            .filter(c => c.group === group && c.pairing === 'end')
                            .map(c => c.label);
                        const lines = textBefore.split('\n');
                        let stackCount = 0;
                        const markerPattern = /--\[\[--\[\[--\[\[#{7}-\[\[MAGIC:([^|\]]+)(?:\|.*?)?\]\]-#{7}\]\]--\]\]--\]\]--/g;
                        let match;
                        while ((match = markerPattern.exec(textBefore)) !== null) {
                            const label = match[1];
                            if (beginLabels.includes(label)) stackCount++;
                            if (endLabels.includes(label)) stackCount--;
                        }
                        if (stackCount <= 0) {
                            if (!confirm(`Warning: No matching 'Begin' found for '${cmd.label}'. Insert anyway?`)) {
                                return;
                            }
                        }
                    }
                    editor.insertMagicCommand(cmd, markdownEditor);
                    isDirty = true;
                }
            });
        });
        convertBtn.addEventListener('click', compile);
        if (closeErrorBtn) {
            closeErrorBtn.addEventListener('click', () => {
                errorOverlay.classList.add('hidden');
            });
        }
        let syncDebounceTimer = null;
        function triggerSync() {
            const sel = window.getSelection();
            if (!sel.anchorNode && !window.pendingSync) return;
            if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
            syncDebounceTimer = setTimeout(async () => {
                if (!currentProjectId) return;
                const lineIndex = editor.getCursorLine(markdownEditor);
                const line = lineIndex + 1;
                try {
                    const res = await api.syncPosition(currentProjectId, line);
                    if (res.status === 'success') {
                        syncStatus.textContent = `Page: ${res.page}`;
                        syncStatus.dataset.page = res.page;
                        syncStatus.classList.remove('hidden');
                        try {
                            const revRes = await api.reverseSync(currentProjectId, res.page);
                        } catch (e) { console.error("Reverse sync failed", e); }
                    }
                } catch (e) {
                    console.error("Sync error", e);
                }
            }, 500);
        }
        document.addEventListener('selectionchange', triggerSync);
        markdownEditor.addEventListener('keyup', triggerSync);
        markdownEditor.addEventListener('click', triggerSync);
        if (syncStatus) {
            syncStatus.addEventListener('click', () => {
                const p = syncStatus.dataset.page;
                if (p && pdfPreview.src) {
                    const cleanSrc = pdfPreview.src.split('#')[0];
                    pdfPreview.src = cleanSrc + "#page=" + p;
                }
            });
        }
        if (newProjectBtn) {
            newProjectBtn.addEventListener('click', () => {
                showNewProjectModal();
            });
        }
        const toggleControlsBtn = document.getElementById('toggleControlsBtn');
        const controlsSection = document.querySelector('.controls-section');
        if (toggleControlsBtn && controlsSection) {
            toggleControlsBtn.addEventListener('click', () => {
                controlsSection.classList.toggle('collapsed');
            });
        }
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
        const uploadChoiceModal = document.getElementById('uploadChoiceModal');
        const uploadReplaceBtn = document.getElementById('uploadReplaceBtn');
        const uploadNewBtn = document.getElementById('uploadNewBtn');
        const uploadCancelBtn = document.getElementById('uploadCancelBtn');
        let pendingUploadContent = "";
        let pendingUploadFilename = "";
        if (uploadBtn && mdUploadInput) {
            uploadBtn.addEventListener('click', () => {
                mdUploadInput.value = '';
                mdUploadInput.click();
            });
            mdUploadInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    pendingUploadContent = ev.target.result;
                    pendingUploadFilename = file.name.replace(/\.[^/.]+$/, "");
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
                    autoSave();
                    uploadChoiceModal.classList.add('hidden');
                }
            });
        }
        if (uploadNewBtn) {
            uploadNewBtn.addEventListener('click', () => {
                uploadChoiceModal.classList.add('hidden');
                newProjectTitleInput.value = pendingUploadFilename;
                showNewProjectModal();
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
        if (cancelProjectBtn) cancelProjectBtn.onclick = hideNewProjectModal;
        if (createProjectBtn) createProjectBtn.onclick = handleCreateProject;
        if (newProjectTitleInput) {
            newProjectTitleInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleCreateProject();
                if (e.key === 'Escape') hideNewProjectModal();
            });
            newProjectTitleInput.addEventListener('input', () => titleError.classList.add('hidden'));
        }
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
        document.body.addEventListener('mousedown', (e) => {
            const btn = e.target.closest('.magic-arg-btn');
            if (btn) {
                e.preventDefault();
                e.stopPropagation();
                const block = btn.closest('.magic-block');
                if (block) {
                    const argName = btn.dataset.name;
                    openCommandModalWithTab(block, argName);
                }
            }
        }, true);
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
        }
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
                const input = activePanel.querySelector('.dynamic-arg-input');
                if (input) setTimeout(() => input.focus(), 50);
            }
        }
        function openCommandModalWithTab(block, targetArgName) {
            console.log("Opening Modal for:", block.dataset.label, "Target:", targetArgName);
            openCommandModal(block);
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
                const tab = document.createElement('button');
                tab.className = 'arg-tab';
                tab.textContent = ui.formatLabel(name);
                tab.dataset.target = name;
                tab.onclick = () => activateArgTab(name);
                sidebar.appendChild(tab);
                const panel = document.createElement('div');
                panel.className = 'arg-panel';
                panel.id = `panel-${name}`;
                const existingBtn = block.querySelector(`.magic-arg-btn[data-name="${name}"]`);
                const currentVal = existingBtn ? existingBtn.dataset.fullValue : (parts[2] || "");
                let input;
                if (typeDef.startsWith('select')) {
                    input = document.createElement('select');
                    input.className = 'dynamic-arg-input';
                    const opts = typeDef.split(',');
                    for (let i = 1; i < opts.length; i++) {
                        const opt = document.createElement('option');
                        opt.value = opts[i].trim();
                        opt.textContent = opts[i].trim();
                        input.appendChild(opt);
                    }
                    input.value = currentVal;
                } else if (typeDef === 'image') {
                    const container = document.createElement('div');
                    container.className = 'image-upload-wrapper';

                    const fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.accept = 'image/*';
                    fileInput.style.marginBottom = '10px';

                    const hiddenInput = document.createElement('input');
                    hiddenInput.className = 'dynamic-arg-input'; // Ensure this class is present for value retrieval
                    hiddenInput.type = 'text';
                    hiddenInput.readOnly = true;
                    hiddenInput.style.width = '100%';
                    hiddenInput.style.marginBottom = '10px';
                    hiddenInput.style.backgroundColor = '#333';
                    hiddenInput.style.border = '1px solid #555';
                    hiddenInput.style.color = '#fff';
                    hiddenInput.style.padding = '5px';
                    hiddenInput.value = currentVal;
                    hiddenInput.dataset.fieldName = name;

                    const preview = document.createElement('div');
                    preview.style.border = '1px dashed #555';
                    preview.style.padding = '10px';
                    preview.style.minHeight = '100px';
                    preview.style.display = 'flex';
                    preview.style.alignItems = 'center';
                    preview.style.justifyContent = 'center';

                    const defaultVal = parts[2] || "";
                    if (currentVal && currentVal !== defaultVal) {
                        const imgUrl = `/project_files/${currentProjectId}/${currentVal}`;
                        preview.innerHTML = `<img src="${imgUrl}" style="max-width:100%; max-height:200px;">`;
                    } else {
                        preview.textContent = "No image selected";
                    }

                    fileInput.onchange = async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            preview.textContent = "Uploading...";
                            try {
                                const result = await api.uploadImage(currentProjectId, file);
                                hiddenInput.value = result.path;
                                const imgUrl = `/project_files/${currentProjectId}/${result.path}`;
                                preview.innerHTML = `<img src="${imgUrl}" style="max-width:100%; max-height:200px;">`;

                                // Also update the block immediately for better UX
                                const btn = currentEditingBlock.querySelector(`.magic-arg-btn[data-name="${name}"]`);
                                if (btn) {
                                    editor.updateArgButton(btn, result.path);
                                }
                            } catch (err) {
                                console.error(err);
                                preview.textContent = "Upload failed: " + err.message;
                            }
                        }
                    };

                    container.appendChild(fileInput);
                    container.appendChild(hiddenInput);
                    container.appendChild(preview);
                    input = container;

                } else if (typeDef === 'textarea') {
                    console.log("Creating Textarea for", name);
                    input = document.createElement('textarea');
                    input.className = 'dynamic-arg-input';
                    input.style.width = "100%";
                    input.style.height = "100%";
                    input.style.display = "block";
                    input.style.minHeight = "200px";
                    input.value = currentVal;
                } else {
                    input = document.createElement('textarea');
                    input.className = 'dynamic-arg-input';
                    input.style.width = "100%";
                    input.style.height = "100%";
                    input.style.display = "block";
                    input.style.minHeight = "150px";
                    input.style.resize = "vertical";
                    input.value = currentVal;
                }
                if (input.dataset) input.dataset.fieldName = name;
                panel.appendChild(input);
                content.appendChild(panel);
            });
            const finalTarget = targetArgName || firstArg;
            console.log("Activating Tab:", finalTarget);
            activateArgTab(finalTarget);
        }
        function closeCommandModal() {
            editCommandModal.classList.add('hidden');
            currentEditingBlock = null;
        }
        const contextMenu = document.getElementById('editorContextMenu');
        document.addEventListener('click', () => {
            if (contextMenu) contextMenu.classList.add('hidden');
        });
        if (markdownEditor && contextMenu) {
            markdownEditor.addEventListener('contextmenu', (e) => {
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();
                const targetBlock = e.target.closest('.magic-block');
                let savedRange = null;
                if (selection.rangeCount > 0) {
                    savedRange = selection.getRangeAt(0).cloneRange();
                }
                e.preventDefault();
                const currentTemplate = templateSelect.value;
                const metadata = availableTemplates[currentTemplate];
                const allCommands = (metadata && metadata.magic_commands)
                    ? metadata.magic_commands.filter(cmd => cmd.tab === 'ढाँचा' || cmd.tab === 'Formatting')
                    : [];
                const generalCommands = allCommands.filter(c => !c.pairing);
                const pairedCommands = allCommands.filter(c => c.pairing === 'begin');
                contextMenu.innerHTML = '';
                const layout = document.createElement('div');
                layout.className = 'context-menu-layout';
                const tabsContainer = document.createElement('div');
                tabsContainer.className = 'context-menu-tabs';
                const contentContainer = document.createElement('div');
                contentContainer.className = 'context-menu-content';
                const tabs = [
                    { id: 'general', label: 'General' },
                    { id: 'beginend', label: 'Begin/End' }
                ];
                let activeTabId = 'general';
                function renderContent(tabId) {
                    contentContainer.innerHTML = '';
                    if (tabId === 'general') {
                        if (selectedText) {
                            contentContainer.appendChild(createItem('कपी (Copy)', 'fa-solid fa-copy', async () => {
                                try {
                                    await navigator.clipboard.writeText(selectedText);
                                    saveStatus.textContent = "Copied";
                                } catch (err) { document.execCommand('copy'); }
                            }));
                        }
                        contentContainer.appendChild(createItem('पेस्ट (Paste)', 'fa-solid fa-paste', async () => {
                            if (navigator.clipboard) {
                                try {
                                    const text = await navigator.clipboard.readText();
                                    if (text) {
                                        editor.focusAndRestore(markdownEditor);
                                        document.execCommand('insertText', false, text);
                                    }
                                } catch (err) { alert('Use Ctrl+V'); }
                            } else { alert('Use Ctrl+V'); }
                        }));
                        const divider = document.createElement('div');
                        divider.style.height = "1px";
                        divider.style.background = "var(--border-color)";
                        divider.style.margin = "4px 0";
                        contentContainer.appendChild(divider);
                        generalCommands.forEach(cmd => {
                            contentContainer.appendChild(createMagicItem(cmd));
                        });
                    } else if (tabId === 'beginend') {
                        pairedCommands.forEach(cmd => {
                            contentContainer.appendChild(createMagicItem(cmd));
                        });
                    }
                }
                function createMagicItem(cmd) {
                    const item = document.createElement('div');
                    item.className = 'context-menu-item';
                    item.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> <span>${cmd.label}</span>`;
                    item.onclick = (ev) => {
                        ev.stopPropagation();
                        let finalOverrides = {};
                        const valToInject = targetBlock ?
                            (targetBlock.querySelector('.magic-arg-btn') ? targetBlock.querySelector('.magic-arg-btn').dataset.fullValue : null)
                            : selectedText;
                        if (cmd.args && valToInject) {
                            const firstArgName = cmd.args.split('|')[0].split(':')[0].trim();
                            if (firstArgName) finalOverrides[firstArgName] = valToInject;
                        }
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
                    return item;
                }
                function createItem(label, icon, onClick) {
                    const item = document.createElement('div');
                    item.className = 'context-menu-item';
                    item.innerHTML = `<i class="${icon}"></i> <span>${label}</span>`;
                    item.onclick = (ev) => {
                        ev.stopPropagation();
                        onClick();
                        contextMenu.classList.add('hidden');
                    };
                    return item;
                }
                tabs.forEach(t => {
                    const tab = document.createElement('div');
                    tab.className = 'context-menu-tab';
                    if (t.id === activeTabId) tab.classList.add('active');
                    tab.textContent = t.label;
                    tab.onclick = (ev) => {
                        ev.stopPropagation();
                        activeTabId = t.id;
                        tabsContainer.querySelectorAll('.context-menu-tab').forEach(el => el.classList.remove('active'));
                        tab.classList.add('active');
                        renderContent(t.id);
                    };
                    tabsContainer.appendChild(tab);
                });
                layout.appendChild(tabsContainer);
                layout.appendChild(contentContainer);
                contextMenu.appendChild(layout);
                renderContent(activeTabId);
                contextMenu.style.left = `${e.clientX}px`;
                contextMenu.style.top = `${e.clientY}px`;
                contextMenu.classList.remove('hidden');
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
                const inputs = commandFields.querySelectorAll('.dynamic-arg-input');
                inputs.forEach(input => {
                    const name = input.dataset.fieldName;
                    const val = input.value;
                    const btn = currentEditingBlock.querySelector(`.magic-arg-btn[data-name="${name}"]`);
                    if (btn) {
                        editor.updateArgButton(btn, val);
                        isDirty = true;
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
    resetProject(title, window.pendingNewProjectContent || "");
    window.pendingNewProjectContent = null;
    hideNewProjectModal();
    hideWelcomeScreen();
}
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
    if (newTitle === projectTitleInput.value) {
        hideRenameModal();
        return;
    }
    const exists = projectsListCache.some(p => p.title.toLowerCase() === newTitle.toLowerCase());
    if (exists) {
        renameTitleError.textContent = "Project name already exists";
        renameTitleError.classList.remove('hidden');
        return;
    }
    try {
        const renamed = await api.renameProject(currentProjectId, newTitle);
        currentProjectId = renamed.new_id;
        projectTitleInput.value = newTitle;
        await refreshProjects();
        saveStatus.textContent = "Renamed and Saved";
        hideRenameModal();
        isDirty = false;
    } catch (e) {
        renameTitleError.textContent = e.message;
        renameTitleError.classList.remove('hidden');
    }
}
function resetProject(newTitle = "Untitled Project", initialContent = "") {
    console.error("DIAGNOSTIC: Resetting project to", newTitle);
    projectTitleInput.value = newTitle;
    editor.loadContent(initialContent, markdownEditor);
    saveStatus.textContent = "New Project";
    currentProjectId = null;
    if (availableTemplates['base']) {
        templateSelect.value = 'base';
        ui.renderTabs('base', availableTemplates, {
            tabsHeader, tabsContent,
            onMagicClick: (label) => editor.insertMagicCommand(label, markdownEditor)
        });
    }
    document.querySelectorAll('.dynamic-input').forEach(input => {
        if (input.tagName === 'SELECT') input.selectedIndex = 0;
        else input.value = '';
    });
    api.saveProject(newTitle, initialContent, "base", {}).then(res => {
        refreshProjects().then(() => {
            const p = projectsListCache.find(x => x.title === newTitle);
            if (p) currentProjectId = p.id;
            isDirty = false;
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
        if (availableTemplates['base']) {
            templateSelect.value = 'base';
            editor.setMagicCommands(availableTemplates['base'].magic_commands);
        }
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
        if (currentProjectId) {
            const lineIndex = editor.getCursorLine(markdownEditor);
            try {
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
    if (!isDirty) return;
    console.error("DIAGNOSTIC: autoSave() tick");
    const title = projectTitleInput.value.trim();
    if (!title) return;
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
        const res = await api.saveProject(title, markdown, template, variables, html);
        saveStatus.textContent = "Saved at " + new Date().toLocaleTimeString();
        saveStatus.classList.remove('saving');
        isDirty = false;
    } catch (e) {
        console.error("DIAGNOSTIC: Save FAILED:", e);
        saveStatus.textContent = "Save Failed";
    }
}
async function refreshProjects() {
    try {
        const projects = await api.fetchProjects();
        projectsListCache = projects;
    } catch (e) {
        console.error("refreshProjects failed:", e);
    }
}
async function loadProject(id) {
    try {
        const data = await api.fetchProject(id);
        currentProjectId = id;
        projectTitleInput.value = data.title;
        if (data.html) {
            editor.setHTMLContent(data.html, markdownEditor);
        } else {
            editor.loadContent(data.markdown, markdownEditor);
        }
        if (data.template) {
            templateSelect.value = data.template;
            if (availableTemplates[data.template]) {
                editor.setMagicCommands(availableTemplates[data.template].magic_commands);
            }
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
        isDirty = false;
    } catch (e) {
        ui.showError("Load Failed: " + e.message, errorLog, errorOverlay);
    }
}
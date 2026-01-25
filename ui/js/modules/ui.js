/**
 * Handles UI components, tabs, buttons, and state displays.
 */

export function setLoading(isLoading, convertBtn, loadingOverlay) {
    if (isLoading) {
        loadingOverlay.classList.remove('hidden');
        convertBtn.disabled = true;
    } else {
        loadingOverlay.classList.add('hidden');
        convertBtn.disabled = false;
    }
}

export function showError(msg, errorLog, errorOverlay) {
    if (errorLog) errorLog.textContent = msg;
    if (errorOverlay) errorOverlay.classList.remove('hidden');
}

export function formatLabel(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function formatTemplateName(name) {
    return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function renderTabs(templateName, availableTemplates, { tabsHeader, tabsContent, onMagicClick }) {
    const metadata = availableTemplates[templateName] || { variables: {}, magic_commands: [] };
    const vars = metadata.variables || {};
    const magicCommands = metadata.magic_commands || [];

    const tabs = {};
    const DEFAULT_TAB = 'General';

    Object.values(vars).forEach(meta => {
        const tabName = meta.tab || DEFAULT_TAB;
        if (!tabs[tabName]) tabs[tabName] = [];
        tabs[tabName].push(meta);
    });

    tabsHeader.innerHTML = '';
    tabsContent.innerHTML = '';

    const tabNames = Object.keys(tabs).sort((a, b) => {
        if (a === 'General') return -1;
        if (b === 'General') return 1;
        if (a === 'Advanced') return 1;
        if (b === 'Advanced') return -1;
        return a.localeCompare(b);
    });

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
        btn.onclick = () => switchTab(name, tabsHeader, tabsContent);
        tabsHeader.appendChild(btn);

        const pane = document.createElement('div');
        pane.className = `tab-pane ${index === 0 ? 'active' : ''}`;
        pane.id = `tab-${name}`;

        if (name === 'Magic') {
            magicCommands.forEach(cmd => {
                const cmdBtn = document.createElement('button');
                cmdBtn.className = 'magic-btn';
                cmdBtn.textContent = cmd.label;
                cmdBtn.onclick = () => onMagicClick(cmd.label);
                pane.appendChild(cmdBtn);
            });
        } else {
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

function switchTab(name, tabsHeader, tabsContent) {
    const buttons = tabsHeader.querySelectorAll('.tab-btn');
    buttons.forEach(b => {
        if (b.textContent === name) b.classList.add('active');
        else b.classList.remove('active');
    });

    const panes = tabsContent.querySelectorAll('.tab-pane');
    panes.forEach(p => {
        if (p.id === `tab-${name}`) p.classList.add('active');
        else p.classList.remove('active');
    });
}

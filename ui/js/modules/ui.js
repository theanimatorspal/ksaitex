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

    // Group Variables
    Object.values(vars).forEach(meta => {
        const tabName = meta.tab || DEFAULT_TAB;
        if (!tabs[tabName]) tabs[tabName] = [];
        // Add type marker
        meta._type = 'var';
        tabs[tabName].push(meta);
    });

    // Group Magic Commands
    magicCommands.forEach(cmd => {
        const tabName = cmd.tab || 'Magic'; // Default if not specified
        if (!tabs[tabName]) tabs[tabName] = [];
        cmd._type = 'magic';
        tabs[tabName].push(cmd);
    });

    tabsHeader.innerHTML = '';
    tabsContent.innerHTML = '';

    const tabNames = Object.keys(tabs).sort((a, b) => {
        // Force order preferences
        const order = ['General', 'Layout', 'Script and Language', 'Page Numbering', 'Font', 'Advanced'];
        // Mapping for localized names if needed
        const localizedMapping = {
            'लेआउट': 'Layout',
            'लिपि र भाषा': 'Script and Language',
            'पृष्ठ संख्या': 'Page Numbering',
            'फन्ट': 'Font',
            'उन्नत': 'Advanced'
        };

        // This is a rough sort heuristic
        const idxA = order.indexOf(localizedMapping[a] || a);
        const idxB = order.indexOf(localizedMapping[b] || b);

        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;

        return a.localeCompare(b);
    });

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

        tabs[name].forEach(item => {
            if (item._type === 'magic') {
                const cmdBtn = document.createElement('button');
                cmdBtn.className = 'magic-btn';
                cmdBtn.textContent = item.label;
                cmdBtn.onclick = () => onMagicClick(item);
                cmdBtn.style.width = '100%'; // Full width in grid cell
                pane.appendChild(cmdBtn);
            } else {
                // Variable Input
                const group = document.createElement('div');
                group.className = 'form-group';

                const label = document.createElement('label');
                label.textContent = item.label || formatLabel(item.name);
                label.htmlFor = item.name;

                let input;
                if (item.type === 'select' && item.options) {
                    input = document.createElement('select');
                    input.id = item.name;
                    input.className = 'dynamic-input';
                    item.options.forEach(opt => {
                        const option = document.createElement('option');
                        option.value = opt;
                        option.textContent = opt;
                        input.appendChild(option);
                    });
                    input.value = item.default;
                } else {
                    input = document.createElement('input');
                    input.type = 'text';
                    input.id = item.name;
                    input.value = item.default;
                    input.className = 'dynamic-input';
                }

                group.appendChild(label);
                group.appendChild(input);
                pane.appendChild(group);
            }
        });

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

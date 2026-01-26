/**
 * Core editor logic and DOM-to-Markdown serialization.
 */

export function initEditor(editor) {
    // Ensure all new lines are wrapped in DIVs for consistency
    document.execCommand('defaultParagraphSeparator', false, 'div');

    // Ensure the editor has at least one DIV so typing starts correctly
    if (editor.innerHTML.trim() === "") {
        editor.innerHTML = '<div><br></div>';
    }

    // Ensure the editor is never empty so typing starts in a DIV
    editor.addEventListener('focus', () => {
        if (editor.innerHTML.trim() === "") {
            editor.innerHTML = '<div><br></div>';
        }
    });

    // Prevent bold/italic formatting if the user pastes rich text
    editor.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    });
}

export function updateArgButton(btn, newValue) {
    btn.dataset.fullValue = newValue;
    // Display: collapses newlines to space for single-line pill
    let display = newValue.replace(/\n/g, ' ');
    if (display.length > 15) {
        display = display.substring(0, 12) + "...";
    }
    btn.textContent = display;
}

export function loadContent(text, editor) {
    if (!text) {
        editor.innerHTML = '<div><br></div>';
        return;
    }

    // Split into lines and wrap each in a DIV
    const html = text.split('\n').map(line => {
        const trimmed = line.trim();
        return `<div>${trimmed === "" ? '<br>' : trimmed}</div>`;
    }).join('');

    editor.innerHTML = html;
}

export function clearContent(editor) {
    editor.innerHTML = '<div><br></div>';
}

export function setInitialMarkdown(editor) {
    const raw = [
        '# Hello, Ksaitex!',
        'This is a sophisticated markdown editor.',
        '',
        '## Features',
        '- Atomic Magic Commands',
        '- Gruvbox Dark Theme',
        '- Instant Preview',
        '',
        'Insert a magic command from the tab below!'
    ].join('\n');

    loadContent(raw, editor);
}

export function insertMagicCommand(cmd, editor, overrides = {}) {
    const label = cmd.label;
    const argsSchema = cmd.args || ""; // "title:text:Default Title|size:number:10"

    // Construct initial magic string for data attribute
    let magicString = `[${label}]`;
    let argsHtml = "";

    if (argsSchema) {
        // Parse schema and build buttons
        const schemaItems = argsSchema.split('|');
        const kvPairs = [];

        schemaItems.forEach(item => {
            const parts = item.split(':');
            const name = parts[0].trim();
            // const type = parts[1]; 
            const schemaDefault = parts[2] || "";

            // Check for override
            const val = (overrides && overrides[name] !== undefined) ? overrides[name] : schemaDefault;

            // Render Button
            // Truncate long text
            let displayVal = val;
            if (displayVal.length > 15) {
                // Collapse newlines for display
                displayVal = displayVal.replace(/\n/g, ' ');
                if (displayVal.length > 15) displayVal = displayVal.substring(0, 12) + "...";
            }

            argsHtml += `<button class="magic-arg-btn" data-name="${name}" data-full-value="${val}" title="Edit ${name}">${displayVal}</button>`;

            // Escape newlines for magic string persistence
            const safeVal = val.replace(/\n/g, "\\n");
            kvPairs.push(`${name}=${safeVal}`);
        });

        if (kvPairs.length > 0) {
            magicString = `[${label}|${kvPairs.join(';')}]`;
        }
    }

    // Minimal HTML structure
    // We include a following div to ensure the user can click/type after
    const html = `<div class="magic-block" contenteditable="false" data-command="${magicString}" data-label="${label}" data-args-schema="${argsSchema}">
        <span class="magic-label">${label}</span>
        <div class="magic-args-container" style="display:inline-flex; gap:4px; margin-left:8px;">${argsHtml}</div>
        <button class="delete-btn" title="Remove Command" onclick="this.closest('.magic-block').remove();"><i class="fa-solid fa-xmark"></i></button>
    </div><div><br></div>`;

    editor.focus();
    document.execCommand('insertHTML', false, html);

    console.log("DEBUG: Inserted magic command:", label);
}

export function getMarkdownContent(editor) {
    let result = "";

    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            result += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toUpperCase();

            // 1. Magic Blocks - Reconstruct command string from current state
            if (node.classList.contains('magic-block')) {
                const label = node.dataset.label || "Command";

                // Re-serialize arguments from the buttons
                const argBtns = node.querySelectorAll('.magic-arg-btn');
                if (argBtns.length > 0) {
                    const pairs = [];
                    argBtns.forEach(btn => {
                        const k = btn.dataset.name;
                        let v = btn.dataset.fullValue || "";
                        // Escape newlines for single-line persistence
                        v = v.replace(/\n/g, "\\n");
                        pairs.push(`${k}=${v}`);
                    });
                    result += `\n[${label}|${pairs.join(';')}]\n\n`;
                } else {
                    // Fallback to simple label or original command string if no buttons found (legacy blocks)
                    const cmd = node.dataset.command || `[${label}]`;
                    if (result !== "" && !result.endsWith('\n')) result += '\n';
                    result += "\n" + cmd + "\n\n";
                }
                return;
            }

            // 2. Handle block-level elements (DIV, P, LI)
            const isParagraph = ['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'BLOCKQUOTE'].includes(tagName);

            if (isParagraph && result !== "" && !result.endsWith('\n')) {
                result += '\n';
            }

            if (tagName === 'BR') {
                result += '\n';
            } else {
                for (let child of node.childNodes) {
                    walk(child);
                }
            }

            // End Paragraph with double newline for MD safety
            if (isParagraph && !result.endsWith('\n\n')) {
                result = result.trimEnd() + '\n\n';
            }
        }
    }

    walk(editor);

    return result
        .replace(/\u00a0/g, ' ')
        .split('\n')
        .map(l => l.trim())
        .filter((l, i, arr) => {
            if (l !== "") return true;
            return i > 0 && arr[i - 1] !== "";
        })
        .join('\n')
        .trim();
}

export function getHTMLContent(editor) {
    return editor.innerHTML;
}

export function setHTMLContent(html, editor) {
    editor.innerHTML = html;
}

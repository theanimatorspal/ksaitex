/**
 * Core editor logic and DOM-to-Markdown serialization.
 */

const MARKER_START = '--[[--[[--[[#######-';
const MARKER_END = '-#######]]--]]--]]--';

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

    // ATOMIC DELETION LOGIC
    editor.addEventListener('keydown', (e) => {
        if (e.key !== 'Backspace' && e.key !== 'Delete') return;

        const selection = window.getSelection();
        if (!selection.rangeCount || !selection.isCollapsed) return; // Don't interfere with range selections
        const range = selection.getRangeAt(0);

        let targetNode = null;

        if (e.key === 'Backspace') {
            // Only trigger if we are at the literal start of a text node or container
            if (range.startOffset === 0) {
                // Check previous sibling
                let prev = range.startContainer.previousSibling;

                // If container is text node, check parent's previous sibling
                if (!prev && range.startContainer.nodeType === Node.TEXT_NODE) {
                    prev = range.startContainer.parentNode.previousSibling;
                }

                if (prev && prev.classList && prev.classList.contains('magic-block')) {
                    targetNode = prev;
                }
            }
        } else if (e.key === 'Delete') {
            // Check if we are at the end of the node
            const atEnd = (range.startContainer.nodeType === Node.TEXT_NODE)
                ? (range.startOffset === range.startContainer.textContent.length)
                : (range.startOffset === range.startContainer.childNodes.length);

            if (atEnd) {
                let next = range.startContainer.nextSibling;
                if (!next && range.startContainer.nodeType === Node.TEXT_NODE) {
                    next = range.startContainer.parentNode.nextSibling;
                }

                if (next && next.classList && next.classList.contains('magic-block')) {
                    targetNode = next;
                }
            }
        }

        if (targetNode) {
            e.preventDefault();

            // SELECT the node and use execCommand to preserve undo history
            const deleteRange = document.createRange();
            deleteRange.selectNode(targetNode);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(deleteRange);

            document.execCommand('delete', false, null);
        }
    });
}

// Helper to generate the HTML for a magic block
function createMagicHtml(label, argsPairs = [], schema = "") {
    let argsHtml = "";
    argsPairs.forEach(pair => {
        let displayVal = pair.value;
        if (displayVal.length > 15) {
            displayVal = displayVal.replace(/\n/g, ' ');
            if (displayVal.length > 15) displayVal = displayVal.substring(0, 12) + "...";
        }
        argsHtml += `<button class="magic-arg-btn" data-name="${pair.key}" data-full-value="${pair.value}" title="Edit ${pair.key}">${displayVal}</button>`;
    });

    const serializedArgs = argsPairs.map(p => {
        return `${p.key}=${p.value.replace(/\n/g, "\\n")}`;
    }).join(';');

    // Final robust marker
    const magicString = argsPairs.length > 0
        ? `${MARKER_START}[[MAGIC:${label}|${serializedArgs}]]${MARKER_END}`
        : `${MARKER_START}[[MAGIC:${label}]]${MARKER_END}`;

    return `<div class="magic-block" contenteditable="false" data-command="${magicString}" data-label="${label}" data-args-schema="${schema}"> <span class="magic-label">${label}</span> <div class="magic-args-container" style="display:inline-flex; gap:4px; margin-left:8px;">${argsHtml}</div> <button class="delete-btn" title="Remove Command" onclick="this.closest('.magic-block').remove();"><i class="fa-solid fa-xmark"></i></button> </div>`;
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

    const lines = text.split('\n');
    let html = "";

    // Robust Regex: --[[--[[--[[#######-[[MAGIC:Label|args]]-#######]]--]]--]]--
    const magicRegex = /^--\[\[--\[\[--\[\[#######-\[\[MAGIC:([^|\]]+)(?:\|(.*?))?\]\]-#######\]\]--\]\]--\]\]--$/;

    html = lines.map(line => {
        const trimmed = line.trim();
        const match = trimmed.match(magicRegex);

        if (match) {
            const label = match[1];
            const argsStr = match[2] || "";
            const argsPairs = [];

            if (argsStr) {
                argsStr.split(';').forEach(pair => {
                    const idx = pair.indexOf('=');
                    if (idx !== -1) {
                        const key = pair.substring(0, idx).trim();
                        const val = pair.substring(idx + 1).replace(/\\n/g, '\n');
                        argsPairs.push({ key, value: val });
                    }
                });
            }
            return createMagicHtml(label, argsPairs, "");
        } else {
            return `<div>${trimmed === "" ? '<br>' : line}</div>`;
        }
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
    const argsSchema = cmd.args || "";

    const argsPairs = [];
    if (argsSchema) {
        const schemaItems = argsSchema.split('|');
        schemaItems.forEach(item => {
            const parts = item.split(':');
            const name = parts[0].trim();
            const schemaDefault = parts[2] || "";
            const val = (overrides && overrides[name] !== undefined) ? overrides[name] : schemaDefault;
            argsPairs.push({ key: name, value: val });
        });
    }

    const html = createMagicHtml(label, argsPairs, argsSchema);
    const withBreak = html + '<div><br></div>';

    editor.focus();
    document.execCommand('insertHTML', false, withBreak);
}

export function getMarkdownContent(editor) {
    let result = "";

    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            result += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toUpperCase();

            // 1. Magic Blocks
            if (node.classList.contains('magic-block')) {
                const label = node.dataset.label || "Command";
                const argBtns = node.querySelectorAll('.magic-arg-btn');
                if (argBtns.length > 0) {
                    const pairs = [];
                    argBtns.forEach(btn => {
                        const k = btn.dataset.name;
                        let v = btn.dataset.fullValue || "";
                        v = v.replace(/\n/g, "\\n");
                        pairs.push(`${k}=${v}`);
                    });
                    const serializedArgs = pairs.join(';');
                    result += `\n${MARKER_START}[[MAGIC:${label}|${serializedArgs}]]${MARKER_END}\n\n`;
                } else {
                    const cmd = node.dataset.command || `${MARKER_START}[[MAGIC:${label}]]${MARKER_END}`;
                    if (result !== "" && !result.endsWith('\n')) result += '\n';
                    result += "\n" + cmd + "\n\n";
                }
                return; // Atomic
            }

            // 2. Block-level elements
            const isBlock = ['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'BLOCKQUOTE'].includes(tagName);
            if (isBlock && result !== "" && !result.endsWith('\n')) {
                result += '\n';
            }

            if (tagName === 'BR') {
                result += '\n';
            } else {
                for (let child of node.childNodes) {
                    walk(child);
                }
            }

            if (isBlock && !result.endsWith('\n\n')) {
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

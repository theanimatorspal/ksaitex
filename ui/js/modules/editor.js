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

    // Enforce DIV wrapping for the first line (text node fix)
    editor.addEventListener('input', () => {
        const first = editor.firstChild;
        if (first && first.nodeType === Node.TEXT_NODE && first.textContent.trim() !== '') {
            // Wrap orphaned text node in a div using execCommand to preserve history/cursor
            document.execCommand('formatBlock', false, 'div');
        }
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

// Global helper for undoable deletion of magic blocks
window.deleteMagicBlock = function (event, btn) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const block = btn.closest('.magic-block');
    if (!block) return;

    const editorNode = block.closest('[contenteditable="true"]');
    if (editorNode) editorNode.focus();

    // Explicitly set range to surround the block
    const range = document.createRange();
    range.setStartBefore(block);
    range.setEndAfter(block);

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    // Use delete command. This is generally the most robust for removal.
    document.execCommand('delete', false, null);

    // To prevent the line from disappearing (user's request),
    // we check if the cursor is now in an empty parent that needs a <br>
    // However, execCommand 'delete' often handles this.
};

// Helper to generate the HTML for a magic block
function createMagicHtml(label, argsPairs = [], schema = "") {
    let argsHtml = "";
    argsPairs.forEach(pair => {
        let displayVal = pair.value;
        if (displayVal.length > 15) {
            displayVal = displayVal.replace(/\n/g, ' ');
            if (displayVal.length > 15) displayVal = displayVal.substring(0, 12) + "...";
        }
        // Escape quotes for HTML attribute
        const safeValue = pair.value.replace(/"/g, '&quot;');
        argsHtml += `<button class="magic-arg-btn" data-name="${pair.key}" data-full-value="${safeValue}" title="Edit ${pair.key}">${displayVal}</button>`;
    });

    const serializedArgs = argsPairs.map(p => {
        return `${p.key}=${p.value.replace(/\n/g, "\\n")}`;
    }).join(';');

    // Final robust marker
    const magicString = argsPairs.length > 0
        ? `${MARKER_START}[[MAGIC:${label}|${serializedArgs}]]${MARKER_END}`
        : `${MARKER_START}[[MAGIC:${label}]]${MARKER_END}`;

    return `<div class="magic-block" contenteditable="false" data-command="${magicString}" data-label="${label}" data-args-schema="${schema}"> <span class="magic-label">${label}</span> <div class="magic-args-container" style="display:inline-flex; gap:4px; margin-left:8px;">${argsHtml}</div> <button class="delete-btn" title="Remove Command" onclick="window.deleteMagicBlock(event, this);"><i class="fa-solid fa-xmark"></i></button> </div>`;
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
    // Wrap with padding lines to prevent collision (2 before, 2 after)
    const withBreak = `<div><br></div><div><br></div>${html}<div><br></div><div><br></div>`;

    editor.focus();

    // SMART INSERTION: If we are in an empty line, replace the whole line to avoid nesting/extra lines
    const sel = window.getSelection();
    if (sel.rangeCount && sel.isCollapsed) {
        let node = sel.anchorNode;
        // Walk up to find direct child of editor
        while (node && node.parentNode && node.parentNode !== editor) {
            node = node.parentNode;
        }

        // Only replace if it's a PLAIN empty div (not a magic block, and no text content)
        if (node && node.tagName === 'DIV' && !node.classList.contains('magic-block')) {
            const isPlainEmpty = (node.innerHTML === '<br>' || node.textContent.trim() === '');
            if (isPlainEmpty) {
                const range = document.createRange();
                range.selectNode(node);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
    }

    document.execCommand('insertHTML', false, withBreak);
}

export function getMarkdownContent(editor, stopBeforeNode = null) {
    let result = "";
    let stopped = false;

    function walk(node) {
        if (stopped) return;
        if (stopBeforeNode && node === stopBeforeNode) {
            stopped = true;
            return;
        }

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
                    if (stopped) return;
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

export function getCursorLine(editor) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return 0;

    let node = sel.anchorNode;
    // Walk up to find direct child of editor
    while (node && node.parentNode !== editor) {
        node = node.parentNode;
    }

    if (!node) return 0; // Should not happen if inside editor

    // Get content BEFORE this block
    const textBefore = getMarkdownContent(editor, node);

    // If textBefore is empty, line is 0.
    if (!textBefore) return 0;

    // Count lines. split('\n') gives lines.
    // If textBefore is "A", 1 line. Next is line 1 (0-based).
    // If textBefore is "A\nB", 2 lines. Next is line 2.
    // Correct.
    return textBefore.split('\n').length;
}

export function getHTMLContent(editor) {
    return editor.innerHTML;
}

export function setHTMLContent(html, editor) {
    editor.innerHTML = html;
}

export function scrollToLine(line, editor) {
    // line is 1-based
    if (line < 1) return;

    const lines = editor.childNodes;
    let currentLine = 0;
    let targetNode = null;

    for (const node of lines) {
        // We count every child as a line roughly, or use similar logic to getCursorLine?
        // getCursorLine uses getMarkdownContent logic which is robust.
        // However, for scrolling we assume visual lines (divs).
        // Let's assume 1 child = 1 line for simplicity as we force divs.

        // Actually, getMarkdownContent collapses text nodes.
        // If the editor structure is strictly <div>line</div>, then childNodes index matches line-1.
        // Let's try direct index access first as it matches the CSS counter logic.

        // Skip non-element nodes?
        // editor.innerHTML usually contains text nodes if empty? No, we force <div><br></div>.
        // But let's be safe.
        // CSS counters increment on 'div'.
        if (node.nodeName === 'DIV') {
            currentLine++;
            if (currentLine === line) {
                targetNode = node;
                break;
            }
        }
    }

    if (targetNode) {
        targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Set Cursor
        const range = document.createRange();
        range.selectNodeContents(targetNode);
        range.collapse(true); // Start of line
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        // Highlight briefly?
        targetNode.style.backgroundColor = 'var(--bg2)';
        setTimeout(() => targetNode.style.backgroundColor = '', 1000);
    }
}

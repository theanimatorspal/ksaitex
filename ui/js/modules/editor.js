/**
 * Core editor logic and DOM-to-Markdown serialization.
 */

const MARKER_START = '--[[--[[--[[#######-';
const MARKER_END = '-#######]]--]]--]]--';

// SELECTION MEMORY (SHARED WITHIN MODULE)
let lastSavedRange = null;
let isRestoring = false;
let cursorEl = null;

function saveSelection(editor) {
    if (isRestoring) return; // Mutex: Don't save if we are currently forcing a restore
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        // Only save if the selection is actually inside the editor
        if (editor.contains(range.commonAncestorContainer)) {
            lastSavedRange = range.cloneRange();
        }
    }
}

function restoreSelection(editor) {
    const sel = window.getSelection();
    if (!lastSavedRange) {
        // Default: End of editor text content if no history exists
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
    }
    sel.removeAllRanges();
    sel.addRange(lastSavedRange);
}

/**
 * Public API for other modules.
 * Strictly enforces focus and cursor continuity.
 */
export function focusAndRestore(editor) {
    if (!editor) return;

    // 1. Lock selection tracking
    isRestoring = true;

    // 2. Save scroll position (browsers often reset this on focus)
    const top = editor.scrollTop;

    // 3. Force Focus
    editor.focus();

    // 4. Force Cursor Restore
    restoreSelection(editor);

    // 5. Restore scroll
    editor.scrollTop = top;

    // 6. Release Lock (Increased delay to handle async clipboard/input stability)
    setTimeout(() => { isRestoring = false; }, 150);
}

export function initEditor(editor) {
    // 1. Selection Tracking (Hardened)
    const track = () => saveSelection(editor);

    // Track on interaction
    editor.addEventListener('mouseup', track);
    editor.addEventListener('keyup', track);

    // Global tracking ensures we catch range changes even during complex DOM updates
    document.addEventListener('selectionchange', () => {
        if (document.activeElement === editor) {
            track();
            updateCustomCursor(editor);
        } else {
            if (cursorEl) cursorEl.classList.remove('active');
        }
    });

    // Create custom cursor element if it doesn't exist
    if (!cursorEl) {
        cursorEl = document.createElement('div');
        cursorEl.className = 'custom-cursor';
        document.body.appendChild(cursorEl);
    }

    // 2. REFOCUS JUMP PREVENTION (Mousedown Guard)
    // browsers often jump the cursor to the click location *before* letting JS intervene.
    // We catch this at the very beginning and force our memory back.
    editor.addEventListener('mousedown', (e) => {
        if (document.activeElement !== editor) {
            // Prevent standard click-to-focus behavior from moving the caret
            setTimeout(() => focusAndRestore(editor), 0);
        }
    });

    // Maintain "default" paragraph DIV wrapping
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
        updateCustomCursor(editor);
    });

    editor.addEventListener('blur', () => {
        if (cursorEl) cursorEl.classList.remove('active');
    });

    editor.addEventListener('scroll', () => updateCustomCursor(editor));
    window.addEventListener('resize', () => updateCustomCursor(editor));


    // Prevent bold/italic formatting if the user pastes rich text
    editor.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');

        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));

        // Move cursor to end of inserted text
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    });

    // Enforce DIV wrapping for the first line (text node fix)
    editor.addEventListener('input', () => {
        const first = editor.firstChild;
        if (first && first.nodeType === Node.TEXT_NODE && first.textContent.trim() !== '') {
            // We use formatBlock if absolutely necessary, but try to avoid execCommand if we can
            // However, formatBlock is still one of the few ways to trigger native wrapping correctly.
            // For now, we'll keep it as it's less likely to cause the specific warnings the user mentioned
            // unless they are specifically against all execCommand.
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
    if (!editorNode) return;

    // 1. Save scroll position to prevent jumping
    const savedScrollTop = editorNode.scrollTop;

    // 2. Explicitly set range to surround the block
    const range = document.createRange();
    range.setStartBefore(block);
    range.setEndAfter(block);

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    // 3. Use delete command.
    document.execCommand('delete', false, null);

    // 4. Restore scroll and focus
    editorNode.scrollTop = savedScrollTop;
    editorNode.focus();
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

    focusAndRestore(editor);

    // SMART INSERTION: If we are in an empty line, replace the whole line to avoid nesting/extra lines
    // BUT: Don't do this if there's a magic block adjacent (would cause replacement)
    const sel = window.getSelection();
    if (sel.rangeCount && sel.isCollapsed) {
        let node = sel.anchorNode;
        // Walk up to find direct child of editor
        while (node && node.parentNode && node.parentNode !== editor) {
            node = node.parentNode;
        }

        // Only replace if it's a PLAIN empty div (not a magic block, and no text content)
        // AND there's no magic block as next sibling
        if (node && node.tagName === 'DIV' && !node.classList.contains('magic-block')) {
            const isPlainEmpty = (node.innerHTML === '<br>' || node.textContent.trim() === '');
            const nextSibling = node.nextSibling;
            const hasAdjacentMagicBlock = nextSibling && nextSibling.classList && nextSibling.classList.contains('magic-block');

            if (isPlainEmpty && !hasAdjacentMagicBlock) {
                const range = document.createRange();
                range.selectNode(node);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
    }

    // Use execCommand to preserve undo history and handle cursor placement natively
    document.execCommand('insertHTML', false, withBreak);

    // Force update of internal selection state
    // We clear isRestoring (if it was set by the previous focusAndRestore) 
    // to allow the new cursor position to be saved immediately
    isRestoring = false;
    saveSelection(editor);
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
    // Walk up to find direct child of editor (which should be a DIV)
    while (node && node.parentNode && node.parentNode !== editor) {
        node = node.parentNode;
    }

    if (!node) return 0;

    // To match CSS counter which increments on every child DIV
    let lineCount = 0;
    let curr = editor.firstChild;
    while (curr) {
        if (curr.nodeName === 'DIV') {
            lineCount++;
        }
        if (curr === node) break;
        curr = curr.nextSibling;
    }

    // Return 0-indexed count to maintain compatibility with app.js (which adds 1)
    return Math.max(0, lineCount - 1);
}

export function findUnmatchedBegin(editor, targetGroup) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return false;

    // Get Markdown from start of editor to cursor
    let node = sel.anchorNode;
    while (node && node.parentNode && node.parentNode !== editor) {
        node = node.parentNode;
    }

    // getMarkdownContent(editor, stopAtNode) implementation:
    const textBefore = getMarkdownContent(editor, node);

    // Basic scanner for MAGIC patterns
    // --[[--[[--[[#######-[[MAGIC:Label|args]]-#######]]--]]--]]--
    const magicRegex = /--\[\[--\[\[--\[\[#{7}-\[\[MAGIC:([^|\]]+)(?:\|.*?)?\]\]-#{7}\]\]--\]\]--\]\]--/g;

    // We need to know which label maps to which group/pairing
    // Since this info is in availableTemplates (app.js), we might need to pass a map
    // OR: Just look for labels that start with "बक्स सुरु" (Begin) and "बक्स अन्त्य" (End)
    // Actually, better to pass the metadata from app.js.
    return textBefore; // Just return text for now, app.js will handle the logic
}

export function getHTMLContent(editor) {
    return editor.innerHTML;
}

export function setHTMLContent(html, editor) {
    editor.innerHTML = html;
}


function updateCustomCursor(editor) {
    if (!cursorEl) return;

    if (document.activeElement !== editor) {
        cursorEl.classList.remove('active');
        return;
    }

    const sel = window.getSelection();
    if (!sel.rangeCount) {
        cursorEl.classList.remove('active');
        return;
    }

    const range = sel.getRangeAt(0);

    // Only show if selection is within editor
    if (!editor.contains(range.commonAncestorContainer)) {
        cursorEl.classList.remove('active');
        return;
    }

    const rects = range.getClientRects();
    let rect = null;

    if (rects.length > 0) {
        // Use the first rect for the caret position
        rect = rects[0];
    } else {
        // Fallback for empty lines (e.g. <div><br></div>)
        let node = range.startContainer;

        // Walk up to find the block (div) or the parent if it's a br
        while (node && node !== editor && node.nodeType !== Node.ELEMENT_NODE) {
            node = node.parentNode;
        }

        if (node) {
            const nodeRect = node.getBoundingClientRect();
            const style = window.getComputedStyle(node);
            const paddingLeft = parseFloat(style.paddingLeft);

            const height = parseFloat(style.lineHeight) || 24;
            rect = {
                left: nodeRect.left + (isNaN(paddingLeft) ? 0 : paddingLeft),
                top: nodeRect.top,
                height: height,
                bottom: nodeRect.top + height,
                width: 0
            };
        }
    }

    if (rect) {
        // Adjust left if selection is collapsed
        const left = sel.isCollapsed ? rect.left : rect.right;

        // Clipping: check if it's within the editor's visible rect
        const editorRect = editor.getBoundingClientRect();
        const isVisible = (
            rect.top >= editorRect.top &&
            rect.bottom <= editorRect.bottom &&
            left >= editorRect.left &&
            left <= editorRect.right
        );

        if (isVisible) {
            // Taller cursor: add 4px total (2px top, 2px bottom)
            const tallerHeight = rect.height + 4;
            const centeredTop = rect.top - 2;

            cursorEl.style.left = `${left}px`;
            cursorEl.style.top = `${centeredTop}px`;
            cursorEl.style.height = `${tallerHeight}px`;
            cursorEl.classList.add('active');

            // Restart animation
            cursorEl.style.animation = 'none';
            void cursorEl.offsetWidth; // Trigger reflow
            cursorEl.style.animation = null;
        } else {
            cursorEl.classList.remove('active');
        }
    }
}

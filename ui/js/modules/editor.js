

const MARKER_START = '--[[--[[--[[#######-';
const MARKER_END = '-#######]]--]]--]]--';
let currentMagicCommands = []; 


let lastSavedRange = null;
let isRestoring = false;
let cursorEl = null;

function saveSelection(editor) {
    if (isRestoring) return; 
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        
        if (editor.contains(range.commonAncestorContainer)) {
            lastSavedRange = range.cloneRange();
        }
    }
}

function restoreSelection(editor) {
    const sel = window.getSelection();
    if (!lastSavedRange) {
        
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


export function focusAndRestore(editor) {
    if (!editor) return;

    
    isRestoring = true;

    
    const top = editor.scrollTop;

    
    editor.focus();

    
    restoreSelection(editor);

    
    editor.scrollTop = top;

    
    setTimeout(() => { isRestoring = false; }, 150);
}

export function setMagicCommands(cmds) {
    currentMagicCommands = cmds;
}

export function initEditor(editor) {
    
    const track = () => saveSelection(editor);

    
    editor.addEventListener('mouseup', track);
    editor.addEventListener('keyup', track);

    
    document.addEventListener('selectionchange', () => {
        if (document.activeElement === editor) {
            track();
            updateCustomCursor(editor);
        } else {
            if (cursorEl) cursorEl.classList.remove('active');
        }
    });

    
    if (!cursorEl) {
        cursorEl = document.createElement('div');
        cursorEl.className = 'custom-cursor';
        document.body.appendChild(cursorEl);
    }

    
    
    
    editor.addEventListener('mousedown', (e) => {
        if (document.activeElement !== editor) {
            
            setTimeout(() => focusAndRestore(editor), 0);
        }
    });

    
    document.execCommand('defaultParagraphSeparator', false, 'div');

    
    if (editor.innerHTML.trim() === "") {
        editor.innerHTML = '<div><br></div>';
    }

    
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


    
    editor.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');

        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));

        
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    });

    
    editor.addEventListener('input', () => {
        const first = editor.firstChild;
        if (first && first.nodeType === Node.TEXT_NODE && first.textContent.trim() !== '') {
            
            
            
            
            document.execCommand('formatBlock', false, 'div');
        }
    });

    
    editor.addEventListener('keydown', (e) => {
        if (e.key !== 'Backspace' && e.key !== 'Delete') return;

        const selection = window.getSelection();
        if (!selection.rangeCount || !selection.isCollapsed) return; 
        const range = selection.getRangeAt(0);

        let targetNode = null;

        if (e.key === 'Backspace') {
            
            if (range.startOffset === 0) {
                
                let prev = range.startContainer.previousSibling;

                
                if (!prev && range.startContainer.nodeType === Node.TEXT_NODE) {
                    prev = range.startContainer.parentNode.previousSibling;
                }

                if (prev && prev.classList && prev.classList.contains('magic-block')) {
                    targetNode = prev;
                }
            }
        } else if (e.key === 'Delete') {
            
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
            
            deletePairedBlock(targetNode, editor);
        }
    });
}

function deletePairedBlock(block, editor) {
    const pairing = block.dataset.pairing;
    const group = block.dataset.group;
    let partner = null;

    if (pairing && group) {
        if (pairing === 'begin') {
            
            let curr = block.nextElementSibling;
            let depth = 0;
            while (curr) {
                if (curr.classList.contains('magic-block') && curr.dataset.group === group) {
                    if (curr.dataset.pairing === 'begin') depth++;
                    else if (curr.dataset.pairing === 'end') {
                        if (depth === 0) { partner = curr; break; }
                        depth--;
                    }
                }
                curr = curr.nextElementSibling;
            }
        } else if (pairing === 'end') {
            
            let curr = block.previousElementSibling;
            let depth = 0;
            while (curr) {
                if (curr.classList.contains('magic-block') && curr.dataset.group === group) {
                    if (curr.dataset.pairing === 'end') depth++;
                    else if (curr.dataset.pairing === 'begin') {
                        if (depth === 0) { partner = curr; break; }
                        depth--;
                    }
                }
                curr = curr.previousElementSibling;
            }
        }
    }

    
    const savedRange = window.getSelection().rangeCount > 0 ? window.getSelection().getRangeAt(0).cloneRange() : null;

    
    const range = document.createRange();
    range.selectNode(block);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('delete', false, null);

    
    
    
    
    if (partner) {
        const range2 = document.createRange();
        range2.selectNode(partner);
        sel.removeAllRanges();
        sel.addRange(range2);
        document.execCommand('delete', false, null);
    }
}


window.deleteMagicBlock = function (event, btn) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const block = btn.closest('.magic-block');
    if (!block) return;

    const editorNode = block.closest('[contenteditable="true"]');
    if (!editorNode) return;

    const savedScrollTop = editorNode.scrollTop;

    
    deletePairedBlock(block, editorNode);

    
    editorNode.scrollTop = savedScrollTop;
    editorNode.focus();
};


function createMagicHtml(label, argsPairs = [], schema = "") {
    
    const cmd = currentMagicCommands.find(c => c.label === label);

    let extraClass = "";
    let icon = "";
    let pairingAttr = "";
    let groupAttr = "";

    if (cmd) {
        if (cmd.pairing) pairingAttr = `data-pairing="${cmd.pairing}"`;
        if (cmd.group) groupAttr = `data-group="${cmd.group}"`;

        if (cmd.pairing === 'begin') {
            extraClass = " magic-block-begin";
            icon = '<i class="fa-solid fa-arrow-down" style="font-size:10px; opacity:0.5; margin-right:4px;"></i>';
        } else if (cmd.pairing === 'end') {
            extraClass = " magic-block-end";
            icon = '<i class="fa-solid fa-arrow-up" style="font-size:10px; opacity:0.5; margin-right:4px;"></i>';
        }
    }

    let argsHtml = "";
    argsPairs.forEach(pair => {
        let displayVal = pair.value;
        if (displayVal.length > 15) {
            displayVal = displayVal.replace(/\n/g, ' ');
            if (displayVal.length > 15) displayVal = displayVal.substring(0, 12) + "...";
        }
        
        const safeValue = pair.value.replace(/"/g, '&quot;');
        argsHtml += `<button class="magic-arg-btn" data-name="${pair.key}" data-full-value="${safeValue}" title="Edit ${pair.key}">${displayVal}</button>`;
    });

    const serializedArgs = argsPairs.map(p => {
        return `${p.key}=${p.value.replace(/\n/g, "\\n")}`;
    }).join(';');

    
    const magicString = argsPairs.length > 0
        ? `${MARKER_START}[[MAGIC:${label}|${serializedArgs}]]${MARKER_END}`
        : `${MARKER_START}[[MAGIC:${label}]]${MARKER_END}`;

    return `<div class="magic-block${extraClass}" contenteditable="false" data-command="${magicString}" data-label="${label}" data-args-schema="${schema}" ${pairingAttr} ${groupAttr}> ${icon}<span class="magic-label">${label}</span> <div class="magic-args-container" style="display:inline-flex; gap:4px; margin-left:8px;">${argsHtml}</div> <button class="delete-btn" title="Remove Command" onclick="window.deleteMagicBlock(event, this);"><i class="fa-solid fa-xmark"></i></button> </div>`;
}

export function updateArgButton(btn, newValue) {
    btn.dataset.fullValue = newValue;
    
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

    
    let finalHtml = html;
    let autoPairing = false;

    if (cmd.pairing === 'begin' && cmd.group) {
        
        const partner = currentMagicCommands.find(c => c.group === cmd.group && c.pairing === 'end');
        if (partner) {
            autoPairing = true;
            const endHtml = createMagicHtml(partner.label, [], partner.args || "");
            const content = '<div><br></div>'; 
            
            finalHtml = `<div><br></div>${html}${content}${endHtml}<div><br></div>`;
        }
    }

    if (!autoPairing) {
        
        finalHtml = `<div><br></div><div><br></div>${html}<div><br></div><div><br></div>`;
    }

    focusAndRestore(editor);

    
    
    const sel = window.getSelection();
    if (sel.rangeCount && sel.isCollapsed) {
        let node = sel.anchorNode;
        while (node && node.parentNode && node.parentNode !== editor) {
            node = node.parentNode;
        }

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

    
    document.execCommand('insertHTML', false, finalHtml);

    
    if (autoPairing) {
        
        
        
        
        
        
        
        
        
        
        

        
        
        
    }

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
                return; 
            }

            
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
    let range = null;
    const sel = window.getSelection();

    
    if (sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        if (editor.contains(r.commonAncestorContainer)) {
            range = r;
        }
    }

    
    if (!range && lastSavedRange) {
        range = lastSavedRange;
    }

    if (!range) return 0;

    let node = range.startContainer;
    
    while (node && node.parentNode && node.parentNode !== editor) {
        node = node.parentNode;
    }

    if (!node) return 0;

    
    
    
    
    

    
    const textBefore = getMarkdownContent(editor, node);

    
    const linesBefore = textBefore === "" ? 0 : textBefore.split('\n').length;

    
    
    

    
    
    
    

    return linesBefore;
}

export function findUnmatchedBegin(editor, targetGroup) {
    let range = null;
    const sel = window.getSelection();

    
    if (sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        if (editor.contains(r.commonAncestorContainer)) {
            range = r;
        }
    }

    
    if (!range && lastSavedRange) {
        range = lastSavedRange;
    }

    if (!range) return "";

    
    let node = range.startContainer;
    while (node && node.parentNode && node.parentNode !== editor) {
        node = node.parentNode;
    }

    if (!node) return "";

    
    const textBefore = getMarkdownContent(editor, node);

    
    
    

    return textBefore; 
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

    
    if (!editor.contains(range.commonAncestorContainer)) {
        cursorEl.classList.remove('active');
        return;
    }

    const rects = range.getClientRects();
    let rect = null;

    if (rects.length > 0) {
        
        rect = rects[0];
    } else {
        
        let node = range.startContainer;

        
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
        
        const left = sel.isCollapsed ? rect.left : rect.right;

        
        const editorRect = editor.getBoundingClientRect();
        const isVisible = (
            rect.top >= editorRect.top &&
            rect.bottom <= editorRect.bottom &&
            left >= editorRect.left &&
            left <= editorRect.right
        );

        if (isVisible) {
            
            const tallerHeight = rect.height + 4;
            const centeredTop = rect.top - 2;

            cursorEl.style.left = `${left}px`;
            cursorEl.style.top = `${centeredTop}px`;
            cursorEl.style.height = `${tallerHeight}px`;
            cursorEl.classList.add('active');

            
            cursorEl.style.animation = 'none';
            void cursorEl.offsetWidth; 
            cursorEl.style.animation = null;
        } else {
            cursorEl.classList.remove('active');
        }
    }
}

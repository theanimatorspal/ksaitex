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

export function insertMagicCommand(label, editor) {
    const magicString = `[${label}]`;

    // Minimal HTML structure to avoid browser confusion
    // Note: No extra spaces or newlines inside the string!
    const html = `<div class="magic-block" contenteditable="false" data-command="${magicString}"><span class="magic-label">${label}</span><button class="delete-btn" title="Remove Command" onclick="this.closest('.magic-block').remove();"><i class="fa-solid fa-xmark"></i></button></div>`;

    editor.focus();
    document.execCommand('insertHTML', false, html);

    // Add a trailing line to ensure the user can keep typing below it
    const br = document.createElement('div');
    br.innerHTML = '<br>';
    editor.appendChild(br);

    console.log("DEBUG: Inserted magic command:", label);
}

export function getMarkdownContent(editor) {
    let result = "";

    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            result += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toUpperCase();

            // 1. Magic Blocks are atomic - grab command and STOP
            if (node.classList.contains('magic-block')) {
                const cmd = node.dataset.command || "";
                // Force command onto its own line with gaps for MD paragraphing
                if (result !== "" && !result.endsWith('\n')) result += '\n';
                result += "\n" + cmd + "\n\n";
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

    // Normalization: 
    // Convert to lines, trim, and rebuild to ensure exact double-newline separation for paragraphs
    return result
        .replace(/\u00a0/g, ' ')
        .split('\n')
        .map(l => l.trim())
        .filter((l, i, arr) => {
            if (l !== "") return true;
            // Allow max 1 empty line (standard MD paragraph gap)
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

class TemplateRegistry {
    constructor() {
        this.templates = new Map();
        this.styleTag = document.createElement('style');
        this.styleTag.id = 'yaml-dynamic-templates-css';
        document.head.appendChild(this.styleTag);
    }

    async loadTemplates() {
        try {
            const res = await fetch('/api/yamltemplates');
            const data = await res.json();
            const configMap = data.templates || data;
            let accumulatedCSS = '';

            Object.entries(configMap).forEach(([key, tplDef]) => {
                this.templates.set(key, tplDef);
                if (tplDef.css) accumulatedCSS += tplDef.css + '\n';
            });

            this.styleTag.textContent = accumulatedCSS;
        } catch (err) {
            console.error(err);
        }
    }

    get(name) { return this.templates.get(name); }
    has(name) { return this.templates.has(name); }
}

class FormatUtils {
    static htmlToLatex(str) {
        if (!str) return '';
        return str
            .replace(/<b>(.*?)<\/b>/gi, '\\textbf{$1}')
            .replace(/<strong>(.*?)<\/strong>/gi, '\\textbf{$1}')
            .replace(/<i>(.*?)<\/i>/gi, '\\textit{$1}')
            .replace(/<em>(.*?)<\/em>/gi, '\\textit{$1}')
            .replace(/<u>(.*?)<\/u>/gi, '\\underline{$1}');
    }
}

class BlockNode {
    constructor(type, templateKey) {
        this.id = 'block_' + Math.random().toString(36).substr(2, 9);
        this.type = type;
        this.templateKey = templateKey;
    }

    isContainer() { return false; }
    getSubTargets() { return ['main']; }
    navigateNextSub() { return null; }
    navigatePrevSub() { return null; }
    navigateLeftSub() { return null; }
    navigateRightSub() { return null; }
    getFirstSubTarget() { return 'main'; }
    getLastSubTarget() { return 'main'; }
    getValue() { return ''; }
    setValue() {}
    getTextContent() { return ''; }
    toLatex() { return ''; }
    clone() { return new BlockNode(this.type, this.templateKey); }
}

class ParagraphBlock extends BlockNode {
    constructor(content = '', templateKey = 'p') {
        super('paragraph', templateKey);
        this.content = content;
    }

    getValue() { return this.content; }
    setValue(_, value) { this.content = value; }
    getTextContent() { return this.content; }

    toLatex(tplDef) {
        const tpl = tplDef?.latex || '{content}';
        return tpl.replace('{content}', FormatUtils.htmlToLatex(this.content));
    }

    clone() { return new ParagraphBlock(this.content, this.templateKey); }
}

class MathBlock extends BlockNode {
    constructor(content = 'e^{i\\pi} + 1 = 0', templateKey = 'math') {
        super('math', templateKey);
        this.content = content;
    }

    getValue() { return this.content; }
    setValue(_, value) { this.content = value; }
    getTextContent() { return this.content; }

    toLatex(tplDef) {
        const tpl = tplDef?.latex || '{content}';
        return tpl.replace('{content}', this.content);
    }

    clone() { return new MathBlock(this.content, this.templateKey); }
}

class ListBlock extends BlockNode {
    constructor(items = null, templateKey = 'itemize', tplDef = null) {
        super('list', templateKey);
        if (items && items.length > 0) {
            this.items = [...items];
        } else if (tplDef && tplDef.defaultItems) {
            this.items = [...tplDef.defaultItems];
        } else {
            this.items = ['Item 1'];
        }
    }

    isContainer() { return true; }
    getSubTargets() { return this.items.map((_, idx) => idx); }

    navigateNextSub(currentSub) {
        const idx = Number(currentSub);
        return idx < this.items.length - 1 ? idx + 1 : null;
    }

    navigatePrevSub(currentSub) {
        const idx = Number(currentSub);
        return idx > 0 ? idx - 1 : null;
    }

    getFirstSubTarget() { return 0; }
    getLastSubTarget() { return Math.max(0, this.items.length - 1); }

    getValue(subTarget) { return this.items[Number(subTarget)] || ''; }
    setValue(subTarget, value) { this.items[Number(subTarget)] = value; }
    getTextContent() { return this.items.join('\n'); }

    insertItemAfter(idx, val = '', tplDef = null) {
        if (tplDef && tplDef.maxItems && this.items.length >= tplDef.maxItems) return idx;
        const insertIdx = idx + 1;
        this.items.splice(insertIdx, 0, val);
        return insertIdx;
    }

    insertItemBefore(idx, val = '', tplDef = null) {
        if (tplDef && tplDef.maxItems && this.items.length >= tplDef.maxItems) return idx;
        this.items.splice(idx, 0, val);
        return idx;
    }

    removeItem(idx) {
        if (this.items.length > 1) {
            this.items.splice(idx, 1);
            return Math.max(0, idx - 1);
        }
        return null;
    }

    toLatex(tplDef) {
        if (!tplDef) return this.items.join('\n');

        if (tplDef.maxItems) {
            let res = tplDef.latex || '';
            this.items.forEach((item, idx) => {
                res = res.replaceAll(`{item_${idx}}`, FormatUtils.htmlToLatex(item));
            });
            return res;
        }

        const formattedItems = this.items.map(item => {
            if (tplDef.itemSplit) {
                const parts = item.split(tplDef.itemSplit);
                let itemStr = tplDef.itemLatex || '{item}';
                parts.forEach((p, i) => {
                    itemStr = itemStr.replaceAll(`{item_${i}}`, FormatUtils.htmlToLatex(p.trim()));
                });
                return itemStr;
            }
            return (tplDef.itemLatex || '{item}').replace('{item}', FormatUtils.htmlToLatex(item));
        });

        return (tplDef.latex || '{items}').replace('{items}', formattedItems.join('\n'));
    }

    clone() { return new ListBlock([...this.items], this.templateKey); }
}

class GridBlock extends BlockNode {
    constructor(rows = 2, cols = 2, grid = null, templateKey = 'table') {
        super('grid', templateKey);
        this.rows = rows;
        this.cols = cols;
        this.grid = grid || Array.from({ length: rows }, () => Array(cols).fill(''));
    }

    isContainer() { return true; }

    getSubTargets() {
        const targets = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) targets.push(`${r}_${c}`);
        }
        return targets;
    }

    parseSub(sub) {
        if (typeof sub === 'string' && sub.includes('_')) {
            const parts = sub.split('_');
            return { r: Number(parts[0]), c: Number(parts[1]) };
        }
        return { r: 0, c: 0 };
    }

    formatSub(r, c) { return `${r}_${c}`; }

    navigateNextSub(currentSub) {
        const { r, c } = this.parseSub(currentSub);
        return r < this.rows - 1 ? this.formatSub(r + 1, c) : null;
    }

    navigatePrevSub(currentSub) {
        const { r, c } = this.parseSub(currentSub);
        return r > 0 ? this.formatSub(r - 1, c) : null;
    }

    navigateLeftSub(currentSub) {
        const { r, c } = this.parseSub(currentSub);
        return c > 0 ? this.formatSub(r, c - 1) : null;
    }

    navigateRightSub(currentSub) {
        const { r, c } = this.parseSub(currentSub);
        return c < this.cols - 1 ? this.formatSub(r, c + 1) : null;
    }

    getFirstSubTarget() { return '0_0'; }
    getLastSubTarget() { return `${this.rows - 1}_${this.cols - 1}`; }

    getValue(subTarget) {
        const { r, c } = this.parseSub(subTarget);
        return (this.grid[r] && this.grid[r][c]) || '';
    }

    setValue(subTarget, value) {
        const { r, c } = this.parseSub(subTarget);
        if (this.grid[r]) this.grid[r][c] = value;
    }

    getTextContent() { return this.grid.flat().filter(Boolean).join(' '); }

    insertRowAfter(r) {
        this.grid.splice(r + 1, 0, Array(this.cols).fill(''));
        this.rows++;
        return `${r + 1}_0`;
    }

    insertRowBefore(r) {
        this.grid.splice(r, 0, Array(this.cols).fill(''));
        this.rows++;
        return `${r}_0`;
    }

    removeRow(r) {
        if (this.rows > 1) {
            this.grid.splice(r, 1);
            this.rows--;
            return `${Math.max(0, r - 1)}_0`;
        }
        return null;
    }

    toLatex(tplDef) {
        if (!tplDef) return '';
        const colSpec = (tplDef.colSpecPrefix || '') + (tplDef.colSpecUnit || 'c').repeat(this.cols);
        const colSep = tplDef.colSeparator || ' ';
        const rowsTex = this.grid.map(row => {
            const colsStr = row.map(cell => FormatUtils.htmlToLatex(cell)).join(colSep);
            return (tplDef.rowLatex || '{cols}').replace('{cols}', colsStr);
        }).join('\n');

        return (tplDef.latex || '{rows}')
            .replace('{col_spec}', colSpec)
            .replace('{rows}', rowsTex);
    }

    clone() {
        return new GridBlock(this.rows, this.cols, this.grid.map(r => [...r]), this.templateKey);
    }
}

class DocumentModel {
    constructor() {
        this.blocks = [new ParagraphBlock('Welcome!', 'p')];
        this.activeIndex = 0;
        this.activeSubTarget = 'main';
        this.navLevel = 'ROOT';
    }

    getActiveBlock() { return this.blocks[this.activeIndex]; }

    setActiveBlock(index, subTarget = null) {
        if (index >= 0 && index < this.blocks.length) {
            this.activeIndex = index;
            this.activeSubTarget = subTarget !== null ? subTarget : this.blocks[index].getFirstSubTarget();
        }
    }

    enterNested() {
        const block = this.getActiveBlock();
        if (block.isContainer()) {
            this.navLevel = 'NESTED';
            this.activeSubTarget = block.getFirstSubTarget();
            return true;
        }
        return false;
    }

    exitNested() {
        if (this.navLevel === 'NESTED') {
            this.navLevel = 'ROOT';
            return true;
        }
        return false;
    }

    insertBlockBelow(block) {
        this.blocks.splice(this.activeIndex + 1, 0, block);
        this.activeIndex++;
        this.navLevel = block.isContainer() ? 'NESTED' : 'ROOT';
        this.activeSubTarget = block.getFirstSubTarget();
    }

    insertBlockAbove(block) {
        this.blocks.splice(this.activeIndex, 0, block);
        this.navLevel = block.isContainer() ? 'NESTED' : 'ROOT';
        this.activeSubTarget = block.getFirstSubTarget();
    }

    deleteActiveBlock() {
        if (this.blocks.length <= 1) {
            this.blocks = [new ParagraphBlock('', 'p')];
            this.activeIndex = 0;
            this.activeSubTarget = 'main';
            this.navLevel = 'ROOT';
            return;
        }
        this.blocks.splice(this.activeIndex, 1);
        if (this.activeIndex >= this.blocks.length) {
            this.activeIndex = this.blocks.length - 1;
        }
        this.activeSubTarget = this.getActiveBlock().getFirstSubTarget();
        this.navLevel = 'ROOT';
    }

    navigateDown() {
        if (this.navLevel === 'NESTED') {
            const nextSub = this.getActiveBlock().navigateNextSub(this.activeSubTarget);
            if (nextSub !== null) this.activeSubTarget = nextSub;
        } else if (this.activeIndex < this.blocks.length - 1) {
            this.activeIndex++;
            this.activeSubTarget = this.getActiveBlock().getFirstSubTarget();
        }
    }

    navigateUp() {
        if (this.navLevel === 'NESTED') {
            const prevSub = this.getActiveBlock().navigatePrevSub(this.activeSubTarget);
            if (prevSub !== null) this.activeSubTarget = prevSub;
        } else if (this.activeIndex > 0) {
            this.activeIndex--;
            this.activeSubTarget = this.getActiveBlock().getFirstSubTarget();
        }
    }

    navigateLeft() {
        if (this.navLevel === 'NESTED') {
            const leftSub = this.getActiveBlock().navigateLeftSub(this.activeSubTarget);
            if (leftSub !== null) this.activeSubTarget = leftSub;
        } else {
            this.navigateUp();
        }
    }

    navigateRight() {
        if (this.navLevel === 'NESTED') {
            const rightSub = this.getActiveBlock().navigateRightSub(this.activeSubTarget);
            if (rightSub !== null) this.activeSubTarget = rightSub;
        } else {
            this.navigateDown();
        }
    }

    jumpToTop() {
        this.activeIndex = 0;
        this.navLevel = 'ROOT';
        this.activeSubTarget = this.blocks[0].getFirstSubTarget();
    }

    jumpToBottom() {
        this.activeIndex = this.blocks.length - 1;
        this.navLevel = 'ROOT';
        this.activeSubTarget = this.getActiveBlock().getFirstSubTarget();
    }

    cloneState() {
        return {
            blocks: this.blocks.map(b => b.clone()),
            activeIndex: this.activeIndex,
            activeSubTarget: this.activeSubTarget,
            navLevel: this.navLevel
        };
    }

    restoreState(state) {
        this.blocks = state.blocks.map(b => b.clone());
        this.activeIndex = state.activeIndex;
        this.activeSubTarget = state.activeSubTarget;
        this.navLevel = state.navLevel;
    }
}

class HistoryManager {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
    }

    pushState(doc) {
        this.undoStack.push(doc.cloneState());
        if (this.undoStack.length > 50) this.undoStack.shift();
        this.redoStack = [];
    }

    undo(doc) {
        if (this.undoStack.length > 0) {
            this.redoStack.push(doc.cloneState());
            doc.restoreState(this.undoStack.pop());
            return true;
        }
        return false;
    }

    redo(doc) {
        if (this.redoStack.length > 0) {
            this.undoStack.push(doc.cloneState());
            doc.restoreState(this.redoStack.pop());
            return true;
        }
        return false;
    }
}

class LatexExporter {
    static generateLatex(doc, registry) {
        const bodyTex = doc.blocks.map(b => {
            const tplDef = registry ? registry.get(b.templateKey) : null;
            return b.toLatex(tplDef);
        }).join('\n\n');
        return `\\documentclass{article}\n\\usepackage{amsmath, amssymb, tcolorbox, enumitem}\n\n\\begin{document}\n\n${bodyTex}\n\n\\end{document}`;
    }
}

class VimEngine {
    constructor(templateRegistry = null) {
        this.doc = new DocumentModel();
        this.history = new HistoryManager();
        this.templateRegistry = templateRegistry;
        this.mode = 'NORMAL';
        this.keyBuffer = '';
        this.clipboard = null;
        this.visualStart = null;
        this.visualType = null;

        this.paperContainer = document.getElementById('paper-container');
        this.modeBadge = document.getElementById('mode-badge');
        this.commandPrefix = document.getElementById('command-prefix');
        this.commandInput = document.getElementById('command-input');
        this.statusInfo = document.getElementById('status-info');
        this.exportBtn = document.getElementById('export-btn');

        this.modalOverlay = document.getElementById('modal-overlay');
        this.modalClose = document.getElementById('modal-close');
        this.latexOutput = document.getElementById('latex-output');
        this.copyTexBtn = document.getElementById('copy-tex-btn');
        this.downloadTexBtn = document.getElementById('download-tex-btn');

        this.initEventListeners();
        this.render();
    }

    initEventListeners() {
        document.addEventListener('keydown', e => this.handleGlobalKeyDown(e));
        if (this.exportBtn) this.exportBtn.addEventListener('click', () => this.openExportModal());
        if (this.modalClose) this.modalClose.addEventListener('click', () => this.closeExportModal());
        if (this.copyTexBtn) this.copyTexBtn.addEventListener('click', () => this.copyTexToClipboard());
        if (this.downloadTexBtn) this.downloadTexBtn.addEventListener('click', () => this.downloadTexFile());
    }

    openExportModal() {
        this.latexOutput.value = LatexExporter.generateLatex(this.doc, this.templateRegistry);
        this.modalOverlay.style.display = 'flex';
    }

    closeExportModal() {
        this.modalOverlay.style.display = 'none';
    }

    copyTexToClipboard() {
        this.latexOutput.select();
        document.execCommand('copy');
    }

    downloadTexFile() {
        const blob = new Blob([this.latexOutput.value], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'document.tex';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    setMode(newMode) {
        this.mode = newMode;
        let displayLabel = newMode;
        if (newMode === 'NORMAL' && this.doc.navLevel === 'NESTED') displayLabel = 'NORMAL (NESTED)';
        if (this.modeBadge) {
            this.modeBadge.textContent = `-- ${displayLabel} --`;
            this.modeBadge.className = 'mode-badge mode-badge-' + newMode.toLowerCase().replace(' ', '');
        }

        if (newMode === 'COMMAND') {
            if (this.commandPrefix) this.commandPrefix.style.display = 'inline';
            if (this.commandInput) {
                this.commandInput.readOnly = false;
                this.commandInput.value = '';
                this.commandInput.focus();
            }
        } else {
            if (this.commandPrefix) this.commandPrefix.style.display = 'none';
            if (this.commandInput) {
                this.commandInput.readOnly = true;
                this.commandInput.value = '';
                this.commandInput.blur();
            }
        }

        if (newMode !== 'VISUAL' && newMode !== 'VISUAL LINE') {
            this.visualStart = null;
            this.visualType = null;
        }

        this.render();
    }

    handleGlobalKeyDown(e) {
        if (this.modalOverlay && this.modalOverlay.style.display === 'flex') {
            if (e.key === 'Escape') this.closeExportModal();
            return;
        }

        if (this.mode === 'COMMAND') {
            this.handleCommandKeyDown(e);
            return;
        }

        if (this.mode === 'INSERT') {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.history.pushState(this.doc);
                this.setMode('NORMAL');
            }
            return;
        }

        if (this.mode === 'NORMAL' || this.mode === 'VISUAL' || this.mode === 'VISUAL LINE') {
            this.handleNormalKeyDown(e);
        }
    }

    handleCommandKeyDown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            this.setMode('NORMAL');
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.executeCommand(this.commandInput.value.trim());
        }
    }

    executeCommand(cmdStr) {
        if (!cmdStr) {
            this.setMode('NORMAL');
            return;
        }

        const parts = cmdStr.trim().split(/\s+/);
        const cmdName = parts[0];
        const cmdArgs = parts.slice(1);

        if (cmdStr === 'w' || cmdStr === 'export') {
            this.openExportModal();
            this.setMode('NORMAL');
            return;
        }

        if (this.templateRegistry && this.templateRegistry.has(cmdName)) {
            this.history.pushState(this.doc);
            this.transformActiveBlockTo(cmdName, cmdArgs);
            this.setMode('NORMAL');
            return;
        }

        this.setMode('NORMAL');
    }

    transformActiveBlockTo(templateKey, args = []) {
        const activeBlock = this.doc.getActiveBlock();
        if (!activeBlock) return;

        const tplDef = this.templateRegistry.get(templateKey);
        if (!tplDef) return;

        const primitive = tplDef.primitive;
        const rawText = activeBlock.getTextContent().trim();
        let newBlock = null;

        if (primitive === 'paragraph') {
            newBlock = new ParagraphBlock(rawText, templateKey);
        } else if (primitive === 'math') {
            newBlock = new MathBlock(rawText || 'e^{i\\pi} + 1 = 0', templateKey);
        } else if (primitive === 'list') {
            let items = rawText ? rawText.split('\n').filter(l => l.trim().length > 0) : null;
            newBlock = new ListBlock(items, templateKey, tplDef);
        } else if (primitive === 'grid') {
            const r = parseInt(args[0], 10) || 2;
            const c = parseInt(args[1], 10) || 2;
            newBlock = new GridBlock(r, c, null, templateKey);
        }

        if (newBlock) {
            this.doc.blocks[this.doc.activeIndex] = newBlock;
            this.doc.activeSubTarget = newBlock.getFirstSubTarget();
            this.doc.navLevel = 'ROOT';
            this.render();
        }
    }

    handleNormalKeyDown(e) {
        const key = e.key;

        if (e.ctrlKey && (key === 'r' || key === 'R')) {
            e.preventDefault();
            if (this.history.redo(this.doc)) this.render();
            return;
        }

        if (key === ':') {
            e.preventDefault();
            this.setMode('COMMAND');
            return;
        }

        if (key === 'Escape') {
            this.keyBuffer = '';
            if (this.doc.navLevel === 'NESTED') this.doc.exitNested();
            this.setMode('NORMAL');
            return;
        }

        if (key === 'Enter') {
            e.preventDefault();
            if (this.doc.navLevel === 'ROOT') {
                if (this.doc.getActiveBlock().isContainer()) {
                    this.doc.enterNested();
                    this.setMode('NORMAL');
                } else {
                    this.setMode('INSERT');
                }
            } else {
                this.setMode('INSERT');
            }
            return;
        }

        if (key === 'v') {
            if (this.mode === 'VISUAL') this.setMode('NORMAL');
            else {
                this.visualStart = this.doc.activeIndex;
                this.visualType = 'CHAR';
                this.setMode('VISUAL');
            }
            return;
        }

        if (key === 'V') {
            if (this.mode === 'VISUAL LINE') this.setMode('NORMAL');
            else {
                this.visualStart = this.doc.activeIndex;
                this.visualType = 'LINE';
                this.setMode('VISUAL LINE');
            }
            return;
        }

        if (key === 'j' || key === 'ArrowDown') {
            e.preventDefault();
            this.doc.navigateDown();
            this.render();
            return;
        }

        if (key === 'k' || key === 'ArrowUp') {
            e.preventDefault();
            this.doc.navigateUp();
            this.render();
            return;
        }

        if (key === 'h' || key === 'ArrowLeft') {
            e.preventDefault();
            this.doc.navigateLeft();
            this.render();
            return;
        }

        if (key === 'l' || key === 'ArrowRight') {
            e.preventDefault();
            this.doc.navigateRight();
            this.render();
            return;
        }

        if (key === 'u') {
            e.preventDefault();
            if (this.history.undo(this.doc)) this.render();
            return;
        }

        if (key === 'i') {
            e.preventDefault();
            this.setMode('INSERT');
            return;
        }

        if (key === 'o') {
            e.preventDefault();
            this.history.pushState(this.doc);
            const active = this.doc.getActiveBlock();
            if (this.doc.navLevel === 'NESTED') {
                const tplDef = this.templateRegistry.get(active.templateKey);
                if (active.type === 'list') {
                    this.doc.activeSubTarget = active.insertItemAfter(Number(this.doc.activeSubTarget), '', tplDef);
                } else if (active.type === 'grid') {
                    this.doc.activeSubTarget = active.insertRowAfter(active.parseSub(this.doc.activeSubTarget).r);
                }
            } else {
                this.doc.insertBlockBelow(new ParagraphBlock('', 'p'));
            }
            this.setMode('INSERT');
            return;
        }

        if (key === 'O') {
            e.preventDefault();
            this.history.pushState(this.doc);
            const active = this.doc.getActiveBlock();
            if (this.doc.navLevel === 'NESTED') {
                const tplDef = this.templateRegistry.get(active.templateKey);
                if (active.type === 'list') {
                    this.doc.activeSubTarget = active.insertItemBefore(Number(this.doc.activeSubTarget), '', tplDef);
                } else if (active.type === 'grid') {
                    this.doc.activeSubTarget = active.insertRowBefore(active.parseSub(this.doc.activeSubTarget).r);
                }
            } else {
                this.doc.insertBlockAbove(new ParagraphBlock('', 'p'));
            }
            this.setMode('INSERT');
            return;
        }

        if (key === 'g') {
            if (this.keyBuffer === 'g') {
                this.doc.jumpToTop();
                this.keyBuffer = '';
                this.render();
            } else {
                this.keyBuffer = 'g';
            }
            return;
        }

        if (key === 'G') {
            this.doc.jumpToBottom();
            this.keyBuffer = '';
            this.render();
            return;
        }

        if (key === 'd') {
            if (this.mode === 'VISUAL' || this.mode === 'VISUAL LINE') {
                this.history.pushState(this.doc);
                const start = Math.min(this.visualStart, this.doc.activeIndex);
                const count = Math.max(this.visualStart, this.doc.activeIndex) - start + 1;
                this.doc.blocks.splice(start, count);
                if (this.doc.blocks.length === 0) {
                    this.doc.blocks = [new ParagraphBlock('', 'p')];
                }
                this.doc.setActiveBlock(Math.min(start, this.doc.blocks.length - 1));
                this.setMode('NORMAL');
                return;
            }
            if (this.keyBuffer === 'd') {
                this.history.pushState(this.doc);
                const active = this.doc.getActiveBlock();
                if (this.doc.navLevel === 'NESTED') {
                    if (active.type === 'list') {
                        const res = active.removeItem(Number(this.doc.activeSubTarget));
                        if (res === null) this.doc.deleteActiveBlock();
                        else this.doc.activeSubTarget = res;
                    } else if (active.type === 'grid') {
                        const res = active.removeRow(active.parseSub(this.doc.activeSubTarget).r);
                        if (res === null) this.doc.deleteActiveBlock();
                        else this.doc.activeSubTarget = res;
                    }
                } else {
                    this.doc.deleteActiveBlock();
                }
                this.keyBuffer = '';
                this.render();
            } else {
                this.keyBuffer = 'd';
            }
            return;
        }

        if (key === 'y') {
            if (this.mode === 'VISUAL' || this.mode === 'VISUAL LINE') {
                const start = Math.min(this.visualStart, this.doc.activeIndex);
                const end = Math.max(this.visualStart, this.doc.activeIndex);
                this.clipboard = { type: 'blocks', blocks: this.doc.blocks.slice(start, end + 1).map(b => b.clone()) };
                this.setMode('NORMAL');
                return;
            }
            if (this.keyBuffer === 'y') {
                const active = this.doc.getActiveBlock();
                if (this.doc.navLevel === 'NESTED' && active.type === 'list') {
                    this.clipboard = { type: 'item', text: active.getValue(this.doc.activeSubTarget) };
                } else {
                    this.clipboard = { type: 'block', block: active.clone() };
                }
                this.keyBuffer = '';
            } else {
                this.keyBuffer = 'y';
            }
            return;
        }

        if (key === 'p') {
            if (this.clipboard) {
                this.history.pushState(this.doc);
                if (this.clipboard.type === 'item') {
                    const active = this.doc.getActiveBlock();
                    const tplDef = this.templateRegistry.get(active.templateKey);
                    if (active.type === 'list') {
                        this.doc.activeSubTarget = active.insertItemAfter(Number(this.doc.activeSubTarget), this.clipboard.text, tplDef);
                    } else {
                        this.doc.insertBlockBelow(new ParagraphBlock(this.clipboard.text, 'p'));
                    }
                } else if (this.clipboard.type === 'block') {
                    this.doc.insertBlockBelow(this.clipboard.block.clone());
                } else if (this.clipboard.type === 'blocks') {
                    this.clipboard.blocks.forEach(b => this.doc.insertBlockBelow(b.clone()));
                }
                this.render();
            }
            return;
        }

        this.keyBuffer = '';
    }

    render() {
        if (!this.paperContainer) return;

        this.paperContainer.innerHTML = '';
        if (this.statusInfo) {
            this.statusInfo.textContent = `Block ${this.doc.activeIndex + 1}/${this.doc.blocks.length}${this.doc.navLevel === 'NESTED' ? ' [NESTED]' : ''}`;
        }

        let vMin = -1, vMax = -1;
        if ((this.mode === 'VISUAL' || this.mode === 'VISUAL LINE') && this.visualStart !== null) {
            vMin = Math.min(this.visualStart, this.doc.activeIndex);
            vMax = Math.max(this.visualStart, this.doc.activeIndex);
        }

        let activeTargetElement = null;

        this.doc.blocks.forEach((block, index) => {
            const isActiveBlock = index === this.doc.activeIndex;
            const blockDiv = document.createElement('div');
            blockDiv.className = 'block-node' + (isActiveBlock && this.doc.navLevel === 'ROOT' ? ' block-active-root' : '');

            if (index >= vMin && index <= vMax) {
                blockDiv.classList.add(this.visualType === 'LINE' ? 'block-visual-line-selected' : 'block-visual-selected');
            }

            blockDiv.addEventListener('click', () => {
                if (this.mode !== 'INSERT') {
                    this.doc.setActiveBlock(index);
                    this.render();
                }
            });

            const renderedElem = this.renderBlockPrimitive(block, isActiveBlock);
            blockDiv.appendChild(renderedElem);
            this.paperContainer.appendChild(blockDiv);

            if (isActiveBlock) {
                activeTargetElement = blockDiv.querySelector('.sub-target-active') || blockDiv;
            }
        });

        if (window.renderMathInElement) {
            renderMathInElement(this.paperContainer, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\[', right: '\\]', display: true },
                    { left: '\\(', right: '\\)', display: false }
                ],
                throwOnError: false
            });
        }

        if (activeTargetElement) {
            activeTargetElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            if (this.mode === 'INSERT' && activeTargetElement.tagName === 'TEXTAREA') {
                activeTargetElement.focus();
            }
        }
    }

    renderBlockPrimitive(block, isActiveBlock) {
        const wrapper = document.createElement('div');
        const tplDef = this.templateRegistry ? this.templateRegistry.get(block.templateKey) : null;

        if (block.type === 'paragraph') {
            if (isActiveBlock && this.mode === 'INSERT') {
                const textarea = this.createInput(block, 'main');
                textarea.classList.add('sub-target-active');
                wrapper.appendChild(textarea);
            } else {
                const rawHtml = tplDef ? tplDef.html.replace('{content}', block.content || '<span class="empty-placeholder">Empty paragraph</span>') : block.content;
                const div = document.createElement('div');
                div.innerHTML = rawHtml;
                if (isActiveBlock && this.doc.navLevel === 'NESTED') div.classList.add('sub-target-active');
                wrapper.appendChild(div);
            }
        } else if (block.type === 'math') {
            if (isActiveBlock && this.mode === 'INSERT') {
                const textarea = this.createInput(block, 'main');
                textarea.classList.add('sub-target-active');
                wrapper.appendChild(textarea);
            } else {
                const div = document.createElement('div');
                div.className = 'tpl-math';
                div.innerHTML = `\\[${block.content || 'e^{i\\pi} + 1 = 0'}\\]`;
                if (isActiveBlock && this.doc.navLevel === 'NESTED') div.classList.add('sub-target-active');
                wrapper.appendChild(div);
            }
        } else if (block.type === 'list') {
            if (tplDef && tplDef.maxItems) {
                let htmlTpl = tplDef.html || '<div>{items}</div>';
                block.items.forEach((item, idx) => {
                    const isSubActive = isActiveBlock && this.doc.navLevel === 'NESTED' && Number(this.doc.activeSubTarget) === idx;
                    if (isSubActive && this.mode === 'INSERT') {
                        htmlTpl = htmlTpl.replace(`{item_${idx}}`, `<span id="slot-active-${idx}"></span>`);
                    } else {
                        htmlTpl = htmlTpl.replace(`{item_${idx}}`, `<span class="${isSubActive ? 'sub-target-active' : ''}">${item || 'Empty'}</span>`);
                    }
                });

                wrapper.innerHTML = htmlTpl;
                block.items.forEach((_, idx) => {
                    const slot = wrapper.querySelector(`#slot-active-${idx}`);
                    if (slot) {
                        const input = this.createInput(block, idx);
                        input.classList.add('sub-target-active');
                        slot.replaceWith(input);
                    }
                });
            } else {
                const listWrapper = document.createElement('div');
                let renderedItemsHtml = '';

                block.items.forEach((itemText, idx) => {
                    const isSubActive = isActiveBlock && this.doc.navLevel === 'NESTED' && Number(this.doc.activeSubTarget) === idx;

                    if (isSubActive && this.mode === 'INSERT') {
                        renderedItemsHtml += `<div data-item-input="${idx}"></div>`;
                    } else {
                        let itemHtml = tplDef ? tplDef.itemHtml : '<li>{item}</li>';

                        if (tplDef && tplDef.itemSplit) {
                            const parts = itemText.split(tplDef.itemSplit);
                            parts.forEach((p, i) => {
                                itemHtml = itemHtml.replaceAll(`{item_${i}}`, p.trim());
                            });
                        } else {
                            itemHtml = itemHtml.replace('{item}', itemText || '<span class="empty-placeholder">Empty item</span>');
                        }

                        if (isSubActive) {
                            itemHtml = itemHtml.replace('>', ' class="sub-target-active">');
                        }
                        renderedItemsHtml += itemHtml;
                    }
                });

                const listContainerHtml = (tplDef ? tplDef.html : '<ul>{items}</ul>').replace('{items}', renderedItemsHtml);
                listWrapper.innerHTML = listContainerHtml;

                block.items.forEach((_, idx) => {
                    const placeholder = listWrapper.querySelector(`[data-item-input="${idx}"]`);
                    if (placeholder) {
                        const input = this.createInput(block, idx);
                        input.classList.add('sub-target-active');
                        placeholder.replaceWith(input);
                    }
                });

                wrapper.appendChild(listWrapper.firstElementChild || listWrapper);
            }
        } else if (block.type === 'grid') {
            const table = document.createElement('table');
            table.className = 'tpl-table';

            for (let r = 0; r < block.rows; r++) {
                const tr = document.createElement('tr');
                for (let c = 0; c < block.cols; c++) {
                    const td = document.createElement('td');
                    const cellKey = `${r}_${c}`;
                    const isSubActive = isActiveBlock && this.doc.navLevel === 'NESTED' && this.doc.activeSubTarget === cellKey;

                    if (isSubActive && this.mode === 'INSERT') {
                        const input = this.createInput(block, cellKey);
                        input.classList.add('sub-target-active');
                        td.appendChild(input);
                    } else {
                        const cellDiv = document.createElement('div');
                        cellDiv.innerHTML = block.grid[r][c] || '&nbsp;';
                        if (isSubActive) cellDiv.classList.add('sub-target-active');
                        td.appendChild(cellDiv);
                    }
                    tr.appendChild(td);
                }
                table.appendChild(tr);
            }
            wrapper.appendChild(table);
        }

        return wrapper;
    }

    createInput(block, subTarget) {
        const textarea = document.createElement('textarea');
        textarea.className = 'block-editor-input';
        textarea.value = block.getValue(subTarget);

        textarea.addEventListener('input', e => {
            block.setValue(subTarget, e.target.value);
        });

        textarea.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey && block.type === 'list') {
                const tplDef = this.templateRegistry.get(block.templateKey);
                if (!tplDef || !tplDef.maxItems) {
                    e.preventDefault();
                    this.history.pushState(this.doc);
                    this.doc.activeSubTarget = block.insertItemAfter(Number(subTarget), '', tplDef);
                    this.render();
                }
            }
        });

        setTimeout(() => {
            textarea.focus();
            textarea.selectionStart = textarea.value.length;
            textarea.selectionEnd = textarea.value.length;
        }, 0);

        return textarea;
    }
}

window.onload = async function () {
    const templateRegistry = new TemplateRegistry();
    await templateRegistry.loadTemplates();
    new VimEngine(templateRegistry);
};
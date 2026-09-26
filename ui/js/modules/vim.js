class TemplateRegistry {
    constructor() {
        this.templates = new Map();
        this.styleTag = document.createElement('style');
        this.styleTag.id = 'dynamic-template-styles';
        document.head.appendChild(this.styleTag);
        console.log(this.templates);
    }

    async loadTemplates() {
        try {
            const res = await fetch('/api/yamltemplates');
            const data = await res.json();
            let accumulatedCSS = '';

            Object.entries(data).forEach(([key, tpl]) => {
                this.templates.set(key, tpl);
                if (tpl.css) {
                    accumulatedCSS += tpl.css + '\n';
                }
            });

            this.styleTag.textContent = accumulatedCSS;
        } catch (err) {
            console.error(err);
        }
    }

    get(name) {
        return this.templates.get(name);
    }

    has(name) {
        return this.templates.has(name);
    }
}

class FormatUtils {
    static htmlToLatex(str) {
        if (!str) return '';
        let result = str;
        result = result.replace(/<b>(.*?)<\/b>/gi, '\\textbf{$1}');
        result = result.replace(/<strong>(.*?)<\/strong>/gi, '\\textbf{$1}');
        result = result.replace(/<i>(.*?)<\/i>/gi, '\\textit{$1}');
        result = result.replace(/<em>(.*?)<\/em>/gi, '\\textit{$1}');
        result = result.replace(/<u>(.*?)<\/u>/gi, '\\underline{$1}');
        return result;
    }
}


class BlockNode {
    constructor(type) {
        this.id = 'block_' + Math.random().toString(36).substr(2, 9);
        this.type = type;
    }
    isContainer() {
        return false;
    }
    getSubTargets() {
        return ['main'];
    }
    navigateNextSub(currentSub) {
        return null;
    }
    navigatePrevSub(currentSub) {
        return null;
    }
    navigateLeftSub(currentSub) {
        return null;
    }
    navigateRightSub(currentSub) {
        return null;
    }
    getFirstSubTarget() {
        return 'main';
    }
    getLastSubTarget() {
        return 'main';
    }
    getValue(subTarget) {
        return '';
    }
    setValue(subTarget, value) { }
    getTextContent() {
        return '';
    }
    getTextContentAsList() {
        return [];
    }
    toLatex() {
        return '';
    }
    clone() {
        return new BlockNode(this.type);
    }
}

class ParagraphBlock extends BlockNode {
    constructor(content = '') {
        super('paragraph');
        this.content = content;
    }
    getValue(subTarget) {
        return this.content;
    }
    setValue(subTarget, value) {
        this.content = value;
    }
    getTextContent() {
        return this.content;
    }
    toLatex() {
        return FormatUtils.htmlToLatex(this.content);
    }
    clone() {
        return new ParagraphBlock(this.content);
    }
}

class HeaderBlock extends BlockNode {
    constructor(level = 1, content = '') {
        super('header');
        this.level = level;
        this.content = content;
    }
    getValue(subTarget) {
        return this.content;
    }
    setValue(subTarget, value) {
        this.content = value;
    }
    getTextContent() {
        return this.content;
    }
    toLatex() {
        const texVal = FormatUtils.htmlToLatex(this.content);
        if (this.level === 1) return `\\section{${texVal}}`;
        if (this.level === 2) return `\\subsection{${texVal}}`;
        if (this.level === 3) return `\\subsubsection{${texVal}}`;
        return `\\paragraph{${texVal}}`;
    }
    clone() {
        return new HeaderBlock(this.level, this.content);
    }
}

class BoxBlock extends BlockNode {
    constructor(content = '') {
        super('box');
        this.content = content;
    }
    getValue(subTarget) {
        return this.content;
    }
    setValue(subTarget, value) {
        this.content = value;
    }
    getTextContent() {
        return this.content;
    }
    toLatex() {
        return `\\begin{tcolorbox}\n${FormatUtils.htmlToLatex(this.content)}\n\\end{tcolorbox}`;
    }
    clone() {
        return new BoxBlock(this.content);
    }
}

class Box1Block extends BlockNode {
    constructor(title = '', content = '') {
        super('box1');
        this.title = title;
        this.content = content;
    }
    isContainer() {
        return true;
    }
    getSubTargets() {
        return ['title', 'content'];
    }
    navigateNextSub(currentSub) {
        return currentSub === 'title' ? 'content' : null;
    }
    navigatePrevSub(currentSub) {
        return currentSub === 'content' ? 'title' : null;
    }
    getFirstSubTarget() {
        return 'title';
    }
    getLastSubTarget() {
        return 'content';
    }
    getValue(subTarget) {
        return subTarget === 'title' ? this.title : this.content;
    }
    setValue(subTarget, value) {
        if (subTarget === 'title') this.title = value;
        else this.content = value;
    }
    getTextContent() {
        return this.content || this.title;
    }
    toLatex() {
        return `\\begin{tcolorbox}[title=${FormatUtils.htmlToLatex(this.title)}]\n${FormatUtils.htmlToLatex(this.content)}\n\\end{tcolorbox}`;
    }
    clone() {
        return new Box1Block(this.title, this.content);
    }
}

class RightBlock extends BlockNode {
    constructor(content = '') {
        super('right');
        this.content = content;
    }
    getValue(subTarget) {
        return this.content;
    }
    setValue(subTarget, value) {
        this.content = value;
    }
    getTextContent() {
        return this.content;
    }
    toLatex() {
        return `\\begin{flushright}\n${FormatUtils.htmlToLatex(this.content)}\n\\end{flushright}`;
    }
    clone() {
        return new RightBlock(this.content);
    }
}

class CenterBlock extends BlockNode {
    constructor(content = '') {
        super('center');
        this.content = content;
    }
    getValue(subTarget) {
        return this.content;
    }
    setValue(subTarget, value) {
        this.content = value;
    }
    getTextContent() {
        return this.content;
    }
    toLatex() {
        return `\\begin{center}\n${FormatUtils.htmlToLatex(this.content)}\n\\end{center}`;
    }
    clone() {
        return new CenterBlock(this.content);
    }
}

class MathBlock extends BlockNode {
    constructor(content = '') {
        super('math');
        this.content = content;
    }
    getValue(subTarget) {
        return this.content;
    }
    setValue(subTarget, value) {
        this.content = value;
    }
    getTextContent() {
        return this.content;
    }
    toLatex() {
        return `\\[\n${this.content}\n\\]`;
    }
    clone() {
        return new MathBlock(this.content);
    }
}

class AlignBlock extends BlockNode {
    constructor(content = '') {
        super('align');
        this.content = content;
    }
    getValue(subTarget) {
        return this.content;
    }
    setValue(subTarget, value) {
        this.content = value;
    }
    getTextContent() {
        return this.content;
    }
    toLatex() {
        return `\\begin{align*}\n${this.content}\n\\end{align*}`;
    }
    clone() {
        return new AlignBlock(this.content);
    }
}

class ItemizeBlock extends BlockNode {
    constructor(items = ['First item']) {
        super('itemize');
        this.items = items;
    }
    isContainer() {
        return true;
    }
    getSubTargets() {
        return this.items.map((_, idx) => idx);
    }
    navigateNextSub(currentSub) {
        const idx = Number(currentSub);
        return idx < this.items.length - 1 ? idx + 1 : null;
    }
    navigatePrevSub(currentSub) {
        const idx = Number(currentSub);
        return idx > 0 ? idx - 1 : null;
    }
    getFirstSubTarget() {
        return 0;
    }
    getLastSubTarget() {
        return Math.max(0, this.items.length - 1);
    }
    getValue(subTarget) {
        return this.items[Number(subTarget)] || '';
    }
    setValue(subTarget, value) {
        this.items[Number(subTarget)] = value;
    }
    getTextContent() {
        return this.items.join(' ');
    }
    getTextContentAsList() {
        return this.items || [];
    }
    insertItemAfter(idx, val = '') {
        const insertIdx = idx + 1;
        this.items.splice(insertIdx, 0, val);
        return insertIdx;
    }
    insertItemBefore(idx, val = '') {
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
    toLatex() {
        const itemsTex = this.items.map(i => `  \\item ${FormatUtils.htmlToLatex(i)}`).join('\n');
        return `\\begin{itemize}\n${itemsTex}\n\\end{itemize}`;
    }
    clone() {
        return new ItemizeBlock([...this.items]);
    }
}

class EnumerateBlock extends BlockNode {
    constructor(items = ['First item']) {
        super('enumerate');
        this.items = items;
    }
    isContainer() {
        return true;
    }
    getSubTargets() {
        return this.items.map((_, idx) => idx);
    }
    navigateNextSub(currentSub) {
        const idx = Number(currentSub);
        return idx < this.items.length - 1 ? idx + 1 : null;
    }
    navigatePrevSub(currentSub) {
        const idx = Number(currentSub);
        return idx > 0 ? idx - 1 : null;
    }
    getFirstSubTarget() {
        return 0;
    }
    getLastSubTarget() {
        return Math.max(0, this.items.length - 1);
    }
    getValue(subTarget) {
        return this.items[Number(subTarget)] || '';
    }
    setValue(subTarget, value) {
        this.items[Number(subTarget)] = value;
    }
    getTextContent() {
        return this.items.join(' ');
    }
    getTextContentAsList() {
        return this.items || [];
    }
    insertItemAfter(idx, val = '') {
        const insertIdx = idx + 1;
        this.items.splice(insertIdx, 0, val);
        return insertIdx;
    }
    insertItemBefore(idx, val = '') {
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
    toLatex() {
        const itemsTex = this.items.map(i => `  \\item ${FormatUtils.htmlToLatex(i)}`).join('\n');
        return `\\begin{enumerate}\n${itemsTex}\n\\end{enumerate}`;
    }
    clone() {
        return new EnumerateBlock([...this.items]);
    }
}

class TableBlock extends BlockNode {
    constructor(rows = 2, cols = 2, grid = null) {
        super('table');
        this.rows = rows;
        this.cols = cols;
        if (grid) {
            this.grid = grid;
        } else {
            this.grid = Array.from({ length: rows }, () => Array(cols).fill(''));
        }
    }
    isContainer() {
        return true;
    }
    getSubTargets() {
        const targets = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                targets.push(`${r}_${c}`);
            }
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
    formatSub(r, c) {
        return `${r}_${c}`;
    }
    navigateNextSub(currentSub) {
        const { r, c } = this.parseSub(currentSub);
        if (r < this.rows - 1) return this.formatSub(r + 1, c);
        return null;
    }
    navigatePrevSub(currentSub) {
        const { r, c } = this.parseSub(currentSub);
        if (r > 0) return this.formatSub(r - 1, c);
        return null;
    }
    navigateLeftSub(currentSub) {
        const { r, c } = this.parseSub(currentSub);
        if (c > 0) return this.formatSub(r, c - 1);
        return null;
    }
    navigateRightSub(currentSub) {
        const { r, c } = this.parseSub(currentSub);
        if (c < this.cols - 1) return this.formatSub(r, c + 1);
        return null;
    }
    getFirstSubTarget() {
        return '0_0';
    }
    getLastSubTarget() {
        return `${this.rows - 1}_${this.cols - 1}`;
    }
    getValue(subTarget) {
        const { r, c } = this.parseSub(subTarget);
        return (this.grid[r] && this.grid[r][c]) || '';
    }
    setValue(subTarget, value) {
        const { r, c } = this.parseSub(subTarget);
        if (this.grid[r]) {
            this.grid[r][c] = value;
        }
    }
    getTextContent() {
        return this.grid.flat().filter(Boolean).join(' ');
    }
    insertRowAfter(r) {
        const newRow = Array(this.cols).fill('');
        this.grid.splice(r + 1, 0, newRow);
        this.rows++;
        return `${r + 1}_0`;
    }
    insertRowBefore(r) {
        const newRow = Array(this.cols).fill('');
        this.grid.splice(r, 0, newRow);
        this.rows++;
        return `${r}_0`;
    }
    removeRow(r) {
        if (this.rows > 1) {
            this.grid.splice(r, 1);
            this.rows--;
            const targetR = Math.max(0, r - 1);
            return `${targetR}_0`;
        }
        return null;
    }
    toLatex() {
        const colSpec = '|' + 'c|'.repeat(this.cols);
        const rowsTex = this.grid.map(row => row.map(cell => FormatUtils.htmlToLatex(cell)).join(' & ') + ' \\\\ \\hline').join('\n');
        return `\\begin{tabular}{${colSpec}}\n\\hline\n${rowsTex}\n\\end{tabular}`;
    }
    clone() {
        const clonedGrid = this.grid.map(r => [...r]);
        return new TableBlock(this.rows, this.cols, clonedGrid);
    }
}

class TemplateBlock extends BlockNode {
    constructor(templateDef, passedArgs = [], rawContent = '') {
        super('template');
        this.templateDef = templateDef;
        this.content = rawContent;
        this.argValues = {};

        const argsList = templateDef.args || [];
        argsList.forEach((argDef, idx) => {
            const passed = passedArgs[idx];
            this.argValues[argDef.name] = passed !== undefined ? passed : argDef.default;
            this.argValues[`${argDef.name}_css`] = passed !== undefined ? passed : (argDef.cssDefault || argDef.default);
        });
    }

    getSubTargets() {
        if (this.templateDef.subTargets && Array.isArray(this.templateDef.subTargets)) {
            return this.templateDef.subTargets;
        }
        const args = (this.templateDef.args || []).map(a => a.name);
        return [...args, 'content'];
    }

    isContainer() {
        return this.getSubTargets().length > 1;
    }

    getFirstSubTarget() {
        const subs = this.getSubTargets();
        return subs[0] || 'content';
    }

    getLastSubTarget() {
        const subs = this.getSubTargets();
        return subs[subs.length - 1] || 'content';
    }

    navigateNextSub(currentSub) {
        const subs = this.getSubTargets();
        const idx = subs.indexOf(currentSub);
        return (idx >= 0 && idx < subs.length - 1) ? subs[idx + 1] : null;
    }

    navigatePrevSub(currentSub) {
        const subs = this.getSubTargets();
        const idx = subs.indexOf(currentSub);
        return (idx > 0) ? subs[idx - 1] : null;
    }

    getValue(subTarget) {
        if (subTarget === 'content' || subTarget === 'main') {
            return this.content;
        }
        return this.argValues[subTarget] !== undefined ? this.argValues[subTarget] : '';
    }

    setValue(subTarget, value) {
        if (subTarget === 'content' || subTarget === 'main') {
            this.content = value;
        } else {
            this.argValues[subTarget] = value;
        }
    }

    getTextContent() {
        return this.content;
    }

    renderHTML() {
        let outputHTML = this.templateDef.html || '';

        Object.entries(this.argValues).forEach(([key, val]) => {
            outputHTML = outputHTML.replaceAll(`{${key}}`, val);
        });

        return outputHTML.replaceAll('{content}', this.content || '<span class="empty-placeholder">Empty Template Block</span>');
    }

    toLatex() {
        let outputLaTeX = this.templateDef.latex || '';

        Object.entries(this.argValues).forEach(([key, val]) => {
            if (!key.endsWith('_css')) {
                outputLaTeX = outputLaTeX.replaceAll(`{${key}}`, val);
            }
        });

        return outputLaTeX.replaceAll('{content}', FormatUtils.htmlToLatex(this.content));
    }

    clone() {
        const rawArgs = this.templateDef.args ? this.templateDef.args.map(a => this.argValues[a.name]) : [];
        return new TemplateBlock(this.templateDef, rawArgs, this.content);
    }
}

class DocumentModel {
    constructor() {
        this.blocks = [new ParagraphBlock('Welcome to Vim LaTeX Block Editor. Press Enter to edit or navigate containers, and Esc to return.')];
        this.activeIndex = 0;
        this.activeSubTarget = 'main';
        this.navLevel = 'ROOT';
    }

    getActiveBlock() {
        return this.blocks[this.activeIndex];
    }

    setActiveBlock(index, subTarget = null) {
        if (index >= 0 && index < this.blocks.length) {
            this.activeIndex = index;
            const block = this.blocks[index];
            this.activeSubTarget = subTarget !== null ? subTarget : block.getFirstSubTarget();
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
            this.blocks = [new ParagraphBlock('')];
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
            const block = this.getActiveBlock();
            const nextSub = block.navigateNextSub(this.activeSubTarget);
            if (nextSub !== null) {
                this.activeSubTarget = nextSub;
            }
        } else {
            if (this.activeIndex < this.blocks.length - 1) {
                this.activeIndex++;
                this.activeSubTarget = this.getActiveBlock().getFirstSubTarget();
            }
        }
    }

    navigateUp() {
        if (this.navLevel === 'NESTED') {
            const block = this.getActiveBlock();
            const prevSub = block.navigatePrevSub(this.activeSubTarget);
            if (prevSub !== null) {
                this.activeSubTarget = prevSub;
            }
        } else {
            if (this.activeIndex > 0) {
                this.activeIndex--;
                this.activeSubTarget = this.getActiveBlock().getFirstSubTarget();
            }
        }
    }

    navigateLeft() {
        if (this.navLevel === 'NESTED') {
            const block = this.getActiveBlock();
            const leftSub = block.navigateLeftSub(this.activeSubTarget);
            if (leftSub !== null) {
                this.activeSubTarget = leftSub;
            }
        } else {
            this.navigateUp();
        }
    }

    navigateRight() {
        if (this.navLevel === 'NESTED') {
            const block = this.getActiveBlock();
            const rightSub = block.navigateRightSub(this.activeSubTarget);
            if (rightSub !== null) {
                this.activeSubTarget = rightSub;
            }
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
            const prevState = this.undoStack.pop();
            doc.restoreState(prevState);
            return true;
        }
        return false;
    }

    redo(doc) {
        if (this.redoStack.length > 0) {
            this.undoStack.push(doc.cloneState());
            const nextState = this.redoStack.pop();
            doc.restoreState(nextState);
            return true;
        }
        return false;
    }
}

class LatexExporter {
    static generateLatex(doc) {
        const bodyTex = doc.blocks.map(b => b.toLatex()).join('\n\n');
        return `\\documentclass{article}
\\usepackage{amsmath, amssymb, tcolorbox, enumitem}
\\usepackage{fontspec}
\\setmainfont{Tiro Devanagari Sanskrit}

\\begin{document}

${bodyTex}

\\end{document}`;
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
        document.addEventListener('keydown', (e) => this.handleGlobalKeyDown(e));
        this.exportBtn.addEventListener('click', () => this.openExportModal());
        this.modalClose.addEventListener('click', () => this.closeExportModal());
        this.copyTexBtn.addEventListener('click', () => this.copyTexToClipboard());
        this.downloadTexBtn.addEventListener('click', () => this.downloadTexFile());
    }

    openExportModal() {
        const tex = LatexExporter.generateLatex(this.doc);
        this.latexOutput.value = tex;
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
        if (newMode === 'NORMAL' && this.doc.navLevel === 'NESTED') {
            displayLabel = 'NORMAL (NESTED)';
        }
        this.modeBadge.textContent = `-- ${displayLabel} --`;
        this.modeBadge.className = 'mode-badge mode-badge-' + newMode.toLowerCase().replace(' ', '');

        if (newMode === 'COMMAND') {
            this.commandPrefix.style.display = 'inline';
            this.commandInput.readOnly = false;
            this.commandInput.value = '';
            this.commandInput.focus();
        } else {
            this.commandPrefix.style.display = 'none';
            this.commandInput.readOnly = true;
            this.commandInput.value = '';
            this.commandInput.blur();
        }

        if (newMode !== 'VISUAL' && newMode !== 'VISUAL LINE') {
            this.visualStart = null;
            this.visualType = null;
        }

        this.render();
    }

    handleGlobalKeyDown(e) {
        if (this.modalOverlay.style.display === 'flex') {
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
            const cmd = this.commandInput.value.trim();
            this.executeCommand(cmd);
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

        this.history.pushState(this.doc);

        if (this.templateRegistry && this.templateRegistry.has(cmdName)) {
            const templateDef = this.templateRegistry.get(cmdName);
            this.transformToTemplateBlock(templateDef, cmdArgs);
            this.setMode('NORMAL');
            return;
        }

        if (cmdStr === 'w' || cmdStr === 'export') {
            this.openExportModal();
            this.setMode('NORMAL');
            return;
        }

        if (cmdStr === 'p') {
            this.transformActiveBlock('paragraph');
        } else if (cmdStr === 'h1') {
            this.transformActiveBlock('header', 1);
        } else if (cmdStr === 'h2') {
            this.transformActiveBlock('header', 2);
        } else if (cmdStr === 'h3') {
            this.transformActiveBlock('header', 3);
        } else if (cmdStr === 'h4') {
            this.transformActiveBlock('header', 4);
        } else if (cmdStr === 'box') {
            this.transformActiveBlock('box');
        } else if (cmdStr === 'box1') {
            this.transformActiveBlock('box1');
        } else if (cmdStr === 'right') {
            this.transformActiveBlock('right');
        } else if (cmdStr === 'center') {
            this.transformActiveBlock('center');
        } else if (cmdStr === 'math') {
            this.transformActiveBlock('math');
        } else if (cmdStr === 'align') {
            this.transformActiveBlock('align');
        } else if (cmdStr === 'itemize') {
            this.transformActiveBlock('itemize');
        } else if (cmdStr === 'enumerate') {
            this.transformActiveBlock('enumerate');
        } else if (cmdStr.startsWith('table')) {
            const parts = cmdStr.split(/\s+/);
            const r = parseInt(parts[1], 10) || 2;
            const c = parseInt(parts[2], 10) || 2;
            this.transformActiveBlock('table', { r, c });
        }

        this.setMode('NORMAL');
    }

    transformActiveBlock(targetType, extra = null) {
        const activeBlock = this.doc.getActiveBlock();
        if (!activeBlock) return;

        let rawText = activeBlock.getTextContent();
        if (targetType === 'itemize' || targetType === 'enumerate') {
            if (typeof activeBlock.getTextContentAsList === 'function') {
                const extracted = activeBlock.getTextContentAsList();
                if (Array.isArray(extracted)) {
                    rawText = extracted.join('\n');
                } else {
                    rawText = String(extracted || '');
                }
            } else if (activeBlock.items && Array.isArray(activeBlock.items)) {
                rawText = activeBlock.items.join('\n');
            } else if (activeBlock.text) {
                rawText = activeBlock.text;
            }
        }

        rawText = rawText.trim();

        let items = rawText ? rawText.split('\n').filter(line => line.trim().length > 0) : [rawText];
        if (items.length === 0) items = [rawText];

        let newBlock = null;

        if (targetType === 'paragraph') {
            newBlock = new ParagraphBlock(rawText);
        } else if (targetType === 'header') {
            newBlock = new HeaderBlock(extra || 1, rawText);
        } else if (targetType === 'box') {
            newBlock = new BoxBlock(rawText);
        } else if (targetType === 'box1') {
            newBlock = new Box1Block('Title', rawText);
        } else if (targetType === 'right') {
            newBlock = new RightBlock(rawText);
        } else if (targetType === 'center') {
            newBlock = new CenterBlock(rawText);
        } else if (targetType === 'math') {
            newBlock = new MathBlock(rawText || 'x^2 + y^2 = z^2');
        } else if (targetType === 'align') {
            newBlock = new AlignBlock(rawText || 'a &= b + c \\\\\n&= d');
        } else if (targetType === 'itemize') {
            newBlock = new ItemizeBlock(items);
        } else if (targetType === 'enumerate') {
            newBlock = new EnumerateBlock(items);
        } else if (targetType === 'table') {
            const r = (extra && extra.r) || 2;
            const c = (extra && extra.c) || 2;
            newBlock = new TableBlock(r, c);
        }

        if (newBlock) {
            this.doc.blocks[this.doc.activeIndex] = newBlock;
            this.doc.activeSubTarget = typeof newBlock.getFirstSubTarget === 'function' ? newBlock.getFirstSubTarget() : null;
            this.doc.navLevel = 'ROOT';
            if (typeof this.renderDocument === 'function') {
                this.renderDocument();
            } else if (typeof this.render === 'function') {
                this.render();
            }
        }
    }

    transformToTemplateBlock(templateDef, cmdArgs) {
        const activeBlock = this.doc.getActiveBlock();
        if (!activeBlock) return;

        const rawText = activeBlock.getTextContent();
        const newBlock = new TemplateBlock(templateDef, cmdArgs, rawText);

        this.doc.blocks[this.doc.activeIndex] = newBlock;
        this.doc.activeSubTarget = newBlock.getFirstSubTarget();
        this.doc.navLevel = 'ROOT';
        this.render();
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
            if (this.doc.navLevel === 'NESTED') {
                this.doc.exitNested();
                this.setMode('NORMAL');
            } else {
                this.setMode('NORMAL');
            }
            return;
        }

        if (key === 'Enter') {
            e.preventDefault();
            const activeBlock = this.doc.getActiveBlock();
            if (this.doc.navLevel === 'ROOT') {
                if (activeBlock.isContainer()) {
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

        if (key === 'R') {
            e.preventDefault();
            if (this.history.redo(this.doc)) this.render();
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
                if (active.type === 'itemize' || active.type === 'enumerate') {
                    const nextIdx = active.insertItemAfter(Number(this.doc.activeSubTarget));
                    this.doc.activeSubTarget = nextIdx;
                } else if (active.type === 'table') {
                    const { r } = active.parseSub(this.doc.activeSubTarget);
                    const nextSub = active.insertRowAfter(r);
                    this.doc.activeSubTarget = nextSub;
                }
            } else {
                this.doc.insertBlockBelow(new ParagraphBlock(''));
            }
            this.setMode('INSERT');
            return;
        }

        if (key === 'O') {
            e.preventDefault();
            this.history.pushState(this.doc);
            const active = this.doc.getActiveBlock();
            if (this.doc.navLevel === 'NESTED') {
                if (active.type === 'itemize' || active.type === 'enumerate') {
                    const nextIdx = active.insertItemBefore(Number(this.doc.activeSubTarget));
                    this.doc.activeSubTarget = nextIdx;
                } else if (active.type === 'table') {
                    const { r } = active.parseSub(this.doc.activeSubTarget);
                    const nextSub = active.insertRowBefore(r);
                    this.doc.activeSubTarget = nextSub;
                }
            } else {
                this.doc.insertBlockAbove(new ParagraphBlock(''));
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
                const end = Math.max(this.visualStart, this.doc.activeIndex);
                const count = end - start + 1;
                this.doc.blocks.splice(start, count);
                if (this.doc.blocks.length === 0) {
                    this.doc.blocks = [new ParagraphBlock('')];
                }
                this.doc.setActiveBlock(Math.min(start, this.doc.blocks.length - 1));
                this.setMode('NORMAL');
                return;
            }
            if (this.keyBuffer === 'd') {
                this.history.pushState(this.doc);
                const active = this.doc.getActiveBlock();
                if (this.doc.navLevel === 'NESTED') {
                    if (active.type === 'itemize' || active.type === 'enumerate') {
                        const res = active.removeItem(Number(this.doc.activeSubTarget));
                        if (res === null) {
                            this.doc.deleteActiveBlock();
                        } else {
                            this.doc.activeSubTarget = res;
                        }
                    } else if (active.type === 'table') {
                        const { r } = active.parseSub(this.doc.activeSubTarget);
                        const res = active.removeRow(r);
                        if (res === null) {
                            this.doc.deleteActiveBlock();
                        } else {
                            this.doc.activeSubTarget = res;
                        }
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
                if (this.doc.navLevel === 'NESTED' && (active.type === 'itemize' || active.type === 'enumerate')) {
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
                    if (active.type === 'itemize' || active.type === 'enumerate') {
                        const nextIdx = active.insertItemAfter(Number(this.doc.activeSubTarget), this.clipboard.text);
                        this.doc.activeSubTarget = nextIdx;
                    } else {
                        this.doc.insertBlockBelow(new ParagraphBlock(this.clipboard.text));
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
        this.paperContainer.innerHTML = '';
        this.statusInfo.textContent = `Block ${this.doc.activeIndex + 1}/${this.doc.blocks.length}${this.doc.navLevel === 'NESTED' ? ' [NESTED]' : ''}`;

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

            blockDiv.addEventListener('click', (e) => {
                if (this.mode !== 'INSERT') {
                    this.doc.setActiveBlock(index);
                    this.render();
                }
            });

            const renderedElem = this.renderBlockContent(block, isActiveBlock);
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

    renderBlockContent(block, isActiveBlock) {
        const wrapper = document.createElement('div');

        if (block instanceof TemplateBlock) {
            let rawHtml = block.templateDef.html || '<div>{content}</div>';
            const subs = block.getSubTargets();

            subs.forEach(subKey => {
                rawHtml = rawHtml.replaceAll(`{${subKey}}`, `<span data-template-slot="${subKey}"></span>`);
            });

            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = rawHtml;

            subs.forEach(subKey => {
                const slotEls = tempContainer.querySelectorAll(`[data-template-slot="${subKey}"]`);

                slotEls.forEach(slotEl => {
                    const isSubActive = isActiveBlock &&
                        this.doc.navLevel === 'NESTED' &&
                        this.doc.activeSubTarget === subKey;

                    if (isSubActive && this.mode === 'INSERT') {
                        const input = this.createInput(block, subKey);
                        input.classList.add('sub-target-active');
                        slotEl.replaceWith(input);
                    } else {
                        const val = block.getValue(subKey);
                        const slotSpan = document.createElement('span');
                        slotSpan.className = `template-slot template-slot-${subKey}`;
                        slotSpan.innerHTML = val || `<span class="empty-placeholder">${subKey}</span>`;

                        if (isSubActive) {
                            slotSpan.classList.add('sub-target-active');
                        }
                        slotEl.replaceWith(slotSpan);
                    }
                });
            });

            while (tempContainer.firstChild) {
                wrapper.appendChild(tempContainer.firstChild);
            }

            return wrapper;
        }


        if (block.type === 'paragraph') {
            if (isActiveBlock && this.mode === 'INSERT') {
                const textarea = this.createInput(block, 'main');
                textarea.classList.add('sub-target-active');
                wrapper.appendChild(textarea);
            } else {
                const p = document.createElement('div');
                p.className = 'paragraph-text text-left';
                p.innerHTML = block.content || '<span class="empty-placeholder">Empty paragraph</span>';
                if (isActiveBlock && this.doc.navLevel === 'NESTED') p.classList.add('sub-target-active');
                wrapper.appendChild(p);
            }
        } else if (block.type === 'header') {
            if (isActiveBlock && this.mode === 'INSERT') {
                const textarea = this.createInput(block, 'main');
                textarea.classList.add('sub-target-active');
                wrapper.appendChild(textarea);
            } else {
                const h = document.createElement('div');
                h.className = 'header-' + block.level;
                h.innerHTML = block.content || '<span class="empty-placeholder">Empty Header</span>';
                if (isActiveBlock && this.doc.navLevel === 'NESTED') h.classList.add('sub-target-active');
                wrapper.appendChild(h);
            }
        } else if (block.type === 'right') {
            if (isActiveBlock && this.mode === 'INSERT') {
                const textarea = this.createInput(block, 'main');
                textarea.classList.add('sub-target-active');
                wrapper.appendChild(textarea);
            } else {
                const p = document.createElement('div');
                p.className = 'paragraph-text text-right';
                p.innerHTML = block.content || '<span class="empty-placeholder">Right Aligned</span>';
                if (isActiveBlock && this.doc.navLevel === 'NESTED') p.classList.add('sub-target-active');
                wrapper.appendChild(p);
            }
        } else if (block.type === 'center') {
            if (isActiveBlock && this.mode === 'INSERT') {
                const textarea = this.createInput(block, 'main');
                textarea.classList.add('sub-target-active');
                wrapper.appendChild(textarea);
            } else {
                const p = document.createElement('div');
                p.className = 'paragraph-text text-center';
                p.innerHTML = block.content || '<span class="empty-placeholder">Centered Text</span>';
                if (isActiveBlock && this.doc.navLevel === 'NESTED') p.classList.add('sub-target-active');
                wrapper.appendChild(p);
            }
        } else if (block.type === 'box') {
            const boxFrame = document.createElement('div');
            boxFrame.className = 'box-frame';
            if (isActiveBlock && this.mode === 'INSERT') {
                const textarea = this.createInput(block, 'main');
                textarea.classList.add('sub-target-active');
                boxFrame.appendChild(textarea);
            } else {
                const div = document.createElement('div');
                div.className = 'paragraph-text';
                div.innerHTML = block.content || '<span class="empty-placeholder">Empty Box</span>';
                if (isActiveBlock && this.doc.navLevel === 'NESTED') div.classList.add('sub-target-active');
                boxFrame.appendChild(div);
            }
            wrapper.appendChild(boxFrame);
        } else if (block.type === 'box1') {
            const boxFrame = document.createElement('div');
            boxFrame.className = 'box1-frame';

            const titleDiv = document.createElement('div');
            titleDiv.className = 'box1-title';
            const isTitleActive = isActiveBlock && this.doc.navLevel === 'NESTED' && this.doc.activeSubTarget === 'title';

            if (isTitleActive && this.mode === 'INSERT') {
                const input = this.createInput(block, 'title');
                input.classList.add('sub-target-active');
                titleDiv.appendChild(input);
            } else {
                titleDiv.innerHTML = block.title || '<span class="empty-placeholder">Title</span>';
                if (isTitleActive) titleDiv.classList.add('sub-target-active');
            }

            const contentDiv = document.createElement('div');
            contentDiv.className = 'box1-content';
            const isContentActive = isActiveBlock && this.doc.navLevel === 'NESTED' && this.doc.activeSubTarget === 'content';

            if (isContentActive && this.mode === 'INSERT') {
                const textarea = this.createInput(block, 'content');
                textarea.classList.add('sub-target-active');
                contentDiv.appendChild(textarea);
            } else {
                contentDiv.innerHTML = block.content || '<span class="empty-placeholder">Content</span>';
                if (isContentActive) contentDiv.classList.add('sub-target-active');
            }

            boxFrame.appendChild(titleDiv);
            boxFrame.appendChild(contentDiv);
            wrapper.appendChild(boxFrame);
        } else if (block.type === 'math') {
            if (isActiveBlock && this.mode === 'INSERT') {
                const textarea = this.createInput(block, 'main');
                textarea.classList.add('sub-target-active');
                wrapper.appendChild(textarea);
            } else {
                const mathDiv = document.createElement('div');
                mathDiv.className = 'math-display-block';
                if (isActiveBlock && this.doc.navLevel === 'NESTED') mathDiv.classList.add('sub-target-active');
                try {
                    katex.render(block.content || ' ', mathDiv, { displayMode: true, throwOnError: false });
                } catch (err) {
                    mathDiv.textContent = block.content;
                }
                wrapper.appendChild(mathDiv);
            }
        } else if (block.type === 'align') {
            if (isActiveBlock && this.mode === 'INSERT') {
                const textarea = this.createInput(block, 'main');
                textarea.classList.add('sub-target-active');
                wrapper.appendChild(textarea);
            } else {
                const alignDiv = document.createElement('div');
                alignDiv.className = 'align-display-block';
                if (isActiveBlock && this.doc.navLevel === 'NESTED') alignDiv.classList.add('sub-target-active');
                try {
                    katex.render('\\begin{aligned}' + (block.content || '') + '\\end{aligned}', alignDiv, { displayMode: true, throwOnError: false });
                } catch (err) {
                    alignDiv.textContent = block.content;
                }
                wrapper.appendChild(alignDiv);
            }
        } else if (block.type === 'itemize' || block.type === 'enumerate') {
            const listContainer = document.createElement(block.type === 'itemize' ? 'ul' : 'ol');
            listContainer.className = 'list-block-container';

            block.items.forEach((itemText, idx) => {
                const li = document.createElement('li');
                li.className = 'list-item-row';
                const isSubActive = isActiveBlock && this.doc.navLevel === 'NESTED' && Number(this.doc.activeSubTarget) === idx;

                if (isSubActive && this.mode === 'INSERT') {
                    const input = this.createInput(block, idx);
                    input.classList.add('sub-target-active');
                    li.appendChild(input);
                } else {
                    const span = document.createElement('span');
                    span.innerHTML = itemText || '<span class="empty-placeholder">Empty item</span>';
                    if (isSubActive) span.classList.add('sub-target-active');
                    li.appendChild(span);
                }
                listContainer.appendChild(li);
            });
            wrapper.appendChild(listContainer);
        } else if (block.type === 'table') {
            const table = document.createElement('table');
            table.className = 'editor-table';

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

        textarea.addEventListener('input', (e) => {
            block.setValue(subTarget, e.target.value);
        });

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && (block.type === 'itemize' || block.type === 'enumerate')) {
                e.preventDefault();
                this.history.pushState(this.doc);
                const nextIdx = block.insertItemAfter(Number(subTarget));
                this.doc.activeSubTarget = nextIdx;
                this.render();
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
    await templateRegistry.loadTemplates()
    new VimEngine(templateRegistry);
};
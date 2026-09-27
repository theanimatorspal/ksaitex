class TemplateRegistry {
    constructor() {
        this.templates = new Map();
        this.styleTag = document.createElement('style');
        this.styleTag.id = 'yaml-dynamic-templates-css';
        this.primitiveTemplates = new Map()
        document.head.appendChild(this.styleTag);
    }

    async loadTemplates() {
        try {
            const res = await fetch('/api/yamltemplates');
            const data = await res.json();
            const configMap = data.templates || data;
            let accumulatedCSS = '';

            console.log(configMap)

            Object.entries(configMap).forEach(([key, tplDef]) => {
                this.templates.set(key, tplDef);
                if (tplDef.css) accumulatedCSS += tplDef.css + '\n';
            });

            this.styleTag.textContent = accumulatedCSS;
        } catch (err) {
            console.error(err);
        }
        try {
            const res = await fetch('/api/primitivetemplates');
            const data = await res.json();
            const configMap = data.templates || data;
            console.log(configMap)
            Object.entries(configMap).forEach(([key, tplDef]) => {
                this.primitiveTemplates.set(key, tplDef);
            });

        } catch (err) {
            console.error(err);
        }
    }

    getPrimitiveTemplates() { return this.primitiveTemplates; }

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
    setValue() { }
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

class PictureBlock extends BlockNode {
    constructor(svg = '', templateKey = 'picture') {
        super('picture', templateKey);
        this.svg = svg;
    }

    getValue() { return this.svg; }
    setValue(_, value) { this.svg = value; }
    getTextContent() { return this.svg; }

    toLatex(tplDef) {
        if (!this.svg) return '';
        if (tplDef && tplDef.latex) {
            return tplDef.latex
                .replaceAll('{svg}', this.svg)
                .replaceAll('{content}', FormatUtils.htmlToLatex(this.svg));
        }
        return `\\begin{figure}[htbp]\n\\centering\n${this.svg}\n\\end{figure}`;
    }

    clone() { return new PictureBlock(this.svg, this.templateKey); }
}

class VectorEngine {
    constructor(templateRegistry = null, onExport = null) {
        this.onExport = onExport;
        this.templateRegistry = templateRegistry;
        this.viewport = document.getElementById('cad-viewport');
        this.sidebar = document.getElementById('cad-sidebar');
        this.status = document.getElementById('cad-status');
        this.cmdInput = document.getElementById('cmd-input') || document.getElementById('command-input');
        this.width = 1200;
        this.height = 800;
        this.gridSize = 40;
        this.zoomLevel = 1;
        this.maxZoom = 4;
        this.cursor = { x: 0, y: 0 };
        this.elements = [];
        this.history = [];
        this.clipboard = [];
        this.selected = -1;
        this.inVisual = false;
        this.visualStart = -1;
        this.pendingKey = '';
        this.mode = 'NORMAL';
        this.panel = 'VIEWPORT';
        this.creation = null;
        this.transformState = null;
        this.rotateState = null;
        this.scaleState = null;
        this.replaceIndex = -1;
        this.lastEnter = 0;
        this.snapCursor();

        window.addEventListener('keydown', e => this.handleKey(e));
        if (this.cmdInput) {
            this.cmdInput.addEventListener('keydown', e => this.handleCmdKey(e));
        }
        this.render();
    }

    saveState() {
        this.history.push(JSON.stringify(this.elements));
        if (this.history.length > 50) this.history.shift();
    }

    undo() {
        if (this.history.length > 0) {
            this.elements = JSON.parse(this.history.pop());
            if (this.selected >= this.elements.length) this.selected = this.elements.length - 1;
            this.inVisual = false;
            this.render();
        }
    }

    getVisualRange() {
        if (this.selected < 0) return [];
        if (!this.inVisual || this.visualStart < 0) return [this.selected, this.selected];
        return [Math.min(this.visualStart, this.selected), Math.max(this.visualStart, this.selected)];
    }

    isSelected(i) {
        const r = this.getVisualRange();
        if (r.length === 0) return false;
        return i >= r[0] && i <= r[1];
    }

    getStep() { return this.gridSize / Math.pow(2, this.zoomLevel - 1); }

    snapCursor() {
        const s = this.getStep();
        this.cursor.x = Math.round(this.cursor.x / s) * s;
        this.cursor.y = Math.round(this.cursor.y / s) * s;
    }

    zoomIn() {
        if (this.zoomLevel < this.maxZoom) {
            this.zoomLevel++;
            this.snapCursor();
        }
    }

    zoomOut() {
        if (this.zoomLevel > 1) {
            this.zoomLevel--;
            this.snapCursor();
        }
    }

    getViewBox() {
        const factor = Math.pow(2, this.zoomLevel - 1);
        const w = this.width / factor;
        const h = this.height / factor;
        const x = this.cursor.x - w / 2;
        const y = this.cursor.y - h / 2;
        return { x, y, w, h, factor };
    }

    moveCursor(dx, dy) {
        const s = this.getStep();
        this.cursor.x = Math.round((this.cursor.x + dx * s) / s) * s;
        this.cursor.y = Math.round((this.cursor.y + dy * s) / s) * s;
    }

    getCenter(el) {
        if (!el) return { x: 0, y: 0 };
        if (el.type === 'rect') {
            return { x: el.attrs.x + el.attrs.width / 2, y: el.attrs.y + el.attrs.height / 2 };
        } else if (el.type === 'circle') {
            return { x: el.attrs.cx, y: el.attrs.cy };
        } else if (el.type === 'arrow') {
            const m = el.attrs.d ? el.attrs.d.match(/M\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+L\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/) : null;
            if (m) return { x: (parseFloat(m[1]) + parseFloat(m[3])) / 2, y: (parseFloat(m[2]) + parseFloat(m[4])) / 2 };
        } else if (el.type === 'polygon' || el.type === 'tri' || (el.attrs && el.attrs.points)) {
            const pts = el.attrs.points.split(' ').map(p => p.split(',').map(Number));
            const sx = pts.reduce((a, b) => a + b[0], 0) / pts.length;
            const sy = pts.reduce((a, b) => a + b[1], 0) / pts.length;
            return { x: sx, y: sy };
        }
        return { x: 0, y: 0 };
    }

    rotatePoint(p, origin, angleRad) {
        const cos = Math.cos(angleRad), sin = Math.sin(angleRad);
        const dx = p.x - origin.x, dy = p.y - origin.y;
        return {
            x: Math.round((origin.x + dx * cos - dy * sin) * 100) / 100,
            y: Math.round((origin.y + dx * sin + dy * cos) * 100) / 100
        };
    }

    scalePoint(p, origin, factor) {
        const dx = p.x - origin.x, dy = p.y - origin.y;
        return {
            x: Math.round((origin.x + dx * factor) * 100) / 100,
            y: Math.round((origin.y + dy * factor) * 100) / 100
        };
    }

    applyTransform(el, dx, dy) {
        if (!el) return;
        if (el.type === 'rect') {
            el.attrs.x += dx; el.attrs.y += dy;
        } else if (el.type === 'circle') {
            el.attrs.cx += dx; el.attrs.cy += dy;
        } else if (el.type === 'arrow') {
            const m = el.attrs.d.match(/M\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+L\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/);
            if (m) {
                const x1 = parseFloat(m[1]) + dx, y1 = parseFloat(m[2]) + dy;
                const x2 = parseFloat(m[3]) + dx, y2 = parseFloat(m[4]) + dy;
                el.attrs.d = `M ${x1} ${y1} L ${x2} ${y2}`;
            }
        } else if (el.attrs && el.attrs.points) {
            const pts = el.attrs.points.split(' ').map(p => p.split(',').map(Number));
            el.attrs.points = pts.map(([px, py]) => `${px + dx},${py + dy}`).join(' ');
        }
    }

    applyRotate(el, origin, angleRad) {
        if (!el) return;
        if (el.type === 'rect') {
            const x = el.attrs.x, y = el.attrs.y, w = el.attrs.width, h = el.attrs.height;
            const pts = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
            const rotPts = pts.map(p => this.rotatePoint(p, origin, angleRad));
            el.type = 'polygon';
            delete el.attrs.x; delete el.attrs.y; delete el.attrs.width; delete el.attrs.height;
            el.attrs.points = rotPts.map(p => `${p.x},${p.y}`).join(' ');
        } else if (el.type === 'circle') {
            const c = this.rotatePoint({ x: el.attrs.cx, y: el.attrs.cy }, origin, angleRad);
            el.attrs.cx = c.x; el.attrs.cy = c.y;
        } else if (el.type === 'arrow') {
            const m = el.attrs.d.match(/M\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+L\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/);
            if (m) {
                const p1 = this.rotatePoint({ x: parseFloat(m[1]), y: parseFloat(m[2]) }, origin, angleRad);
                const p2 = this.rotatePoint({ x: parseFloat(m[3]), y: parseFloat(m[4]) }, origin, angleRad);
                el.attrs.d = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
            }
        } else if (el.attrs && el.attrs.points) {
            const pts = el.attrs.points.split(' ').map(p => p.split(',').map(Number));
            const rotPts = pts.map(([px, py]) => this.rotatePoint({ x: px, y: py }, origin, angleRad));
            el.attrs.points = rotPts.map(p => `${p.x},${p.y}`).join(' ');
        }
    }

    applyScale(el, origin, factor) {
        if (!el || factor === 0) return;
        if (el.type === 'rect') {
            const x = el.attrs.x, y = el.attrs.y, w = el.attrs.width, h = el.attrs.height;
            const pts = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
            const scPts = pts.map(p => this.scalePoint(p, origin, factor));
            const minX = Math.min(...scPts.map(p => p.x)), minY = Math.min(...scPts.map(p => p.y));
            const maxX = Math.max(...scPts.map(p => p.x)), maxY = Math.max(...scPts.map(p => p.y));
            el.attrs = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        } else if (el.type === 'circle') {
            const c = this.scalePoint({ x: el.attrs.cx, y: el.attrs.cy }, origin, factor);
            el.attrs.cx = c.x; el.attrs.cy = c.y;
            el.attrs.r = Math.round(Math.abs(el.attrs.r * factor) * 100) / 100;
        } else if (el.type === 'arrow') {
            const m = el.attrs.d.match(/M\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+L\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/);
            if (m) {
                const p1 = this.scalePoint({ x: parseFloat(m[1]), y: parseFloat(m[2]) }, origin, factor);
                const p2 = this.scalePoint({ x: parseFloat(m[3]), y: parseFloat(m[4]) }, origin, factor);
                el.attrs.d = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
            }
        } else if (el.attrs && el.attrs.points) {
            const pts = el.attrs.points.split(' ').map(p => p.split(',').map(Number));
            const scPts = pts.map(([px, py]) => this.scalePoint({ x: px, y: py }, origin, factor));
            el.attrs.points = scPts.map(p => `${p.x},${p.y}`).join(' ');
        }
    }

    commitPoint() {
        if (!this.creation) return;
        this.creation.points.push({ x: this.cursor.x, y: this.cursor.y });
        if (this.creation.points.length === this.creation.total) {
            this.buildElement();
            this.creation = null;
            this.mode = 'NORMAL';
        }
    }

    commitTransformPoint() {
        if (!this.transformState) return;
        const target = { x: this.cursor.x, y: this.cursor.y };
        const dx = target.x - this.transformState.origin.x;
        const dy = target.y - this.transformState.origin.y;
        this.saveState();
        this.applyTransform(this.elements[this.transformState.index], dx, dy);
        this.transformState = null;
        this.mode = 'NORMAL';
    }

    commitRotatePoint() {
        if (!this.rotateState) return;
        if (this.rotateState.stage === 1) {
            this.rotateState.origin = { x: this.cursor.x, y: this.cursor.y };
            this.rotateState.stage = 2;
        } else if (this.rotateState.stage === 2) {
            const origin = this.rotateState.origin;
            const angleRad = Math.atan2(this.cursor.y - origin.y, this.cursor.x - origin.x);
            this.saveState();
            this.applyRotate(this.elements[this.rotateState.index], origin, angleRad);
            this.rotateState = null;
            this.mode = 'NORMAL';
        }
    }

    commitScalePoint() {
        if (!this.scaleState) return;
        if (this.scaleState.stage === 1) {
            this.scaleState.origin = { x: this.cursor.x, y: this.cursor.y };
            this.scaleState.stage = 2;
        } else if (this.scaleState.stage === 2) {
            const origin = this.scaleState.origin;
            const dist = Math.hypot(this.cursor.x - origin.x, this.cursor.y - origin.y);
            let factor = dist / this.gridSize;
            if (factor === 0) factor = 1;
            this.saveState();
            this.applyScale(this.elements[this.scaleState.index], origin, factor);
            this.scaleState = null;
            this.mode = 'NORMAL';
        }
    }

    buildElement() {
        const { type, stroke, fill, points, config } = this.creation;
        const el = { type, stroke, fill, attrs: {} };
        if (config.transform === 'bbox') {
            const [p1, p2] = points;
            el.attrs = { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), width: Math.abs(p1.x - p2.x), height: Math.abs(p1.y - p2.y) };
        } else if (config.transform === 'radius') {
            const [c, e] = points;
            el.attrs = { cx: c.x, cy: c.y, r: Math.round(Math.hypot(e.x - c.x, e.y - c.y)) };
        } else if (config.transform === 'line') {
            const [p1, p2] = points;
            el.attrs = { d: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}` };
        } else if (config.transform === 'points_list') {
            el.attrs = { points: points.map(p => `${p.x},${p.y}`).join(' ') };
        }
        this.saveState();
        if (this.replaceIndex >= 0 && this.replaceIndex < this.elements.length) {
            this.elements[this.replaceIndex] = el;
            this.selected = this.replaceIndex;
            this.replaceIndex = -1;
        } else {
            this.elements.push(el);
            this.selected = this.elements.length - 1;
        }
    }

    exportSVG() {
        if (this.elements.length === 0) {
            if (this.status) this.status.textContent = "No elements to export!";
            return;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        this.elements.forEach(el => {
            if (el.type === 'rect') {
                minX = Math.min(minX, el.attrs.x); minY = Math.min(minY, el.attrs.y);
                maxX = Math.max(maxX, el.attrs.x + el.attrs.width); maxY = Math.max(maxY, el.attrs.y + el.attrs.height);
            } else if (el.type === 'circle') {
                minX = Math.min(minX, el.attrs.cx - el.attrs.r); minY = Math.min(minY, el.attrs.cy - el.attrs.r);
                maxX = Math.max(maxX, el.attrs.cx + el.attrs.r); maxY = Math.max(maxY, el.attrs.cy + el.attrs.r);
            } else if (el.type === 'arrow') {
                const m = el.attrs.d ? el.attrs.d.match(/M\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+L\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/) : null;
                if (m) {
                    minX = Math.min(minX, parseFloat(m[1]), parseFloat(m[3]));
                    minY = Math.min(minY, parseFloat(m[2]), parseFloat(m[4]));
                    maxX = Math.max(maxX, parseFloat(m[1]), parseFloat(m[3]));
                    maxY = Math.max(maxY, parseFloat(m[2]), parseFloat(m[4]));
                }
            } else if (el.attrs && el.attrs.points) {
                const pts = el.attrs.points.split(' ').map(p => p.split(',').map(Number));
                pts.forEach(([px, py]) => {
                    minX = Math.min(minX, px); minY = Math.min(minY, py);
                    maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
                });
            }
        });

        const pad = 20;
        minX -= pad; minY -= pad; maxX += pad; maxY += pad;
        const w = maxX - minX, h = maxY - minY;

        let hasArrow = this.elements.some(e => e.type === 'arrow');
        let defs = hasArrow ? `<defs>\n    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">\n      <path d="M 0 0 L 10 5 L 0 10 z" fill="#000"/>\n    </marker>\n  </defs>` : '';

        let body = '';
        this.elements.forEach(el => {
            let tag = el.type === 'rect' ? 'rect' : el.type === 'circle' ? 'circle' : el.type === 'arrow' ? 'path' : 'polygon';
            let a = { ...el.attrs, fill: el.fill, stroke: el.stroke, "stroke-width": 2 };
            if (el.type === 'arrow') a["marker-end"] = "url(#arrow)";
            let attrStr = Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ');
            body += `  <${tag} ${attrStr}/>\n`;
        });

        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}">\n${defs}\n${body}</svg>`;

        if (typeof this.onExport === 'function') {
            this.onExport(svgContent);
        }

        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'drawing.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    execCommand(str) {
        const parts = str.trim().split(/\s+/);
        if (!parts[0]) return;
        let cmd = parts[0].replace(/^:/, '');
        let arg1 = parts[1] || '#000';
        let arg2 = parts[2] || 'none';

        if (cmd === 'svg' || cmd === 'export') {
            this.exportSVG();
            this.mode = 'NORMAL';
            return;
        }

        if (cmd === 'transform') {
            if (this.elements.length === 0) return;
            if (this.selected < 0 || this.selected >= this.elements.length) this.selected = this.elements.length - 1;
            const el = this.elements[this.selected];
            const c = this.getCenter(el);
            this.cursor = { x: c.x, y: c.y };
            this.snapCursor();
            this.transformState = { index: this.selected, origin: { x: this.cursor.x, y: this.cursor.y } };
            this.mode = 'TRANSFORM';
            this.panel = 'VIEWPORT';
            return;
        }

        if (cmd === 'rotate') {
            if (this.elements.length === 0) return;
            if (this.selected < 0 || this.selected >= this.elements.length) this.selected = this.elements.length - 1;
            const el = this.elements[this.selected];
            const c = this.getCenter(el);
            this.cursor = { x: c.x, y: c.y };
            this.snapCursor();
            this.rotateState = { index: this.selected, stage: 1, origin: null };
            this.mode = 'ROTATE';
            this.panel = 'VIEWPORT';
            return;
        }

        if (cmd === 'scale') {
            if (this.elements.length === 0) return;
            if (this.selected < 0 || this.selected >= this.elements.length) this.selected = this.elements.length - 1;
            const el = this.elements[this.selected];
            const c = this.getCenter(el);
            this.cursor = { x: c.x, y: c.y };
            this.snapCursor();
            this.scaleState = { index: this.selected, stage: 1, origin: null };
            this.mode = 'SCALE';
            this.panel = 'VIEWPORT';
            return;
        }

        const schema = this.templateRegistry.getPrimitiveTemplates();
        console.log(schema)
        if(this.selected>=0&&this.selected<this.elements.length&&!schema.has(cmd)){
            this.saveState();
            this.elements[this.selected].stroke=cmd;
            if(parts[1])this.elements[this.selected].fill=parts[1];
            return;
        }

        if(schema.has(cmd)){
            if(this.selected>=0&&this.selected<this.elements.length){
                this.replaceIndex=this.selected;
            }else{
                this.replaceIndex=-1;
            }
            this.creation={type:cmd,config:schema.get(cmd),stroke:arg1,fill:arg2,total:schema.get(cmd).points,points:[]};
            this.mode='INSERT';
            this.panel='VIEWPORT';
        }

    }

    yank() {
        const r = this.getVisualRange();
        if (r.length === 0) return;
        this.clipboard = JSON.parse(JSON.stringify(this.elements.slice(r[0], r[1] + 1)));
        this.inVisual = false;
        this.pendingKey = '';
        this.render();
    }

    deleteSelected() {
        const r = this.getVisualRange();
        if (r.length === 0) return;
        this.saveState();
        const count = r[1] - r[0] + 1;
        this.clipboard = JSON.parse(JSON.stringify(this.elements.slice(r[0], r[1] + 1)));
        this.elements.splice(r[0], count);
        this.inVisual = false;
        this.pendingKey = '';
        this.selected = Math.min(r[0], this.elements.length - 1);
        this.render();
    }

    paste(after = true) {
        if (this.clipboard.length === 0) return;
        this.saveState();
        const copies = JSON.parse(JSON.stringify(this.clipboard));
        let idx = this.selected < 0 ? this.elements.length - 1 : this.selected;
        let insertAt = after ? idx + 1 : Math.max(0, idx);
        this.elements.splice(insertAt, 0, ...copies);
        this.selected = insertAt + copies.length - 1;
        this.inVisual = false;
        this.render();
    }

    handleCmdKey(e) {
        e.stopPropagation();
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = this.cmdInput.value;
            this.cmdInput.value = '';
            this.cmdInput.style.display = 'none';
            this.cmdInput.blur();
            if (this.status) this.status.style.display = 'inline';
            this.execCommand(val);
            this.render();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.cmdInput.value = '';
            this.cmdInput.style.display = 'none';
            this.cmdInput.blur();
            if (this.status) this.status.style.display = 'inline';
            this.mode = 'NORMAL';
            this.render();
        }
    }

    handleKey(e) {
        if (this.cmdInput && document.activeElement === this.cmdInput) return;

        const k = e.key;
        if (k === ':') {
            if (!this.cmdInput) return;
            e.preventDefault();
            this.mode = 'COMMAND';
            if (this.status) this.status.style.display = 'none';
            this.cmdInput.style.display = 'inline';
            this.cmdInput.value = ':';
            this.cmdInput.focus();
            return;
        }

        if (k === 'H') { this.panel = 'VIEWPORT'; this.selected = -1; this.inVisual = false; this.render(); return; }
        if (k === 'L') { this.panel = 'SIDEBAR'; if (this.selected < 0 && this.elements.length > 0) this.selected = 0; this.render(); return; }

        if (this.mode === 'TRANSFORM') {
            if (k === 'h') { this.moveCursor(-1, 0); this.render(); return; }
            if (k === 'l') { this.moveCursor(1, 0); this.render(); return; }
            if (k === 'k') { this.moveCursor(0, -1); this.render(); return; }
            if (k === 'j') { this.moveCursor(0, 1); this.render(); return; }
            if (k === ' ' || k === 'Space' || k === 'Enter') {
                e.preventDefault();
                this.commitTransformPoint();
                this.render();
                return;
            }
            if (k === 'Escape') {
                e.preventDefault();
                this.transformState = null;
                this.mode = 'NORMAL';
                this.render();
                return;
            }
            return;
        }

        if (this.mode === 'ROTATE') {
            if (k === 'h') { this.moveCursor(-1, 0); this.render(); return; }
            if (k === 'l') { this.moveCursor(1, 0); this.render(); return; }
            if (k === 'k') { this.moveCursor(0, -1); this.render(); return; }
            if (k === 'j') { this.moveCursor(0, 1); this.render(); return; }
            if (k === ' ' || k === 'Space' || k === 'Enter') {
                e.preventDefault();
                this.commitRotatePoint();
                this.render();
                return;
            }
            if (k === 'Escape') {
                e.preventDefault();
                this.rotateState = null;
                this.mode = 'NORMAL';
                this.render();
                return;
            }
            return;
        }

        if (this.mode === 'SCALE') {
            if (k === 'h') { this.moveCursor(-1, 0); this.render(); return; }
            if (k === 'l') { this.moveCursor(1, 0); this.render(); return; }
            if (k === 'k') { this.moveCursor(0, -1); this.render(); return; }
            if (k === 'j') { this.moveCursor(0, 1); this.render(); return; }
            if (k === ' ' || k === 'Space' || k === 'Enter') {
                e.preventDefault();
                this.commitScalePoint();
                this.render();
                return;
            }
            if (k === 'Escape') {
                e.preventDefault();
                this.scaleState = null;
                this.mode = 'NORMAL';
                this.render();
                return;
            }
            return;
        }

        if (this.mode === 'INSERT') {
            if (k === 'h') { this.moveCursor(-1, 0); this.render(); return; }
            if (k === 'l') { this.moveCursor(1, 0); this.render(); return; }
            if (k === 'k') { this.moveCursor(0, -1); this.render(); return; }
            if (k === 'j') { this.moveCursor(0, 1); this.render(); return; }
            if (k === ' ' || k === 'Space' || k === 'Enter') {
                e.preventDefault();
                this.commitPoint();
                this.render();
                return;
            }
            if (k === 'Escape') {
                e.preventDefault();
                this.creation = null;
                this.replaceIndex = -1;
                this.mode = 'NORMAL';
                this.render();
                return;
            }
            return;
        }

        if (this.panel === 'SIDEBAR') {
            if (k === 'G') {
                if (this.elements.length > 0) this.selected = this.elements.length - 1;
                this.pendingKey = '';
                this.render();
                return;
            }
            if (k === 'g') {
                if (this.pendingKey === 'g') {
                    if (this.elements.length > 0) this.selected = 0;
                    this.pendingKey = '';
                } else {
                    this.pendingKey = 'g';
                }
                this.render();
                return;
            }
            if (k === 'j' && this.elements.length > 0) {
                if (this.selected < 0) this.selected = 0;
                else this.selected = Math.min(this.elements.length - 1, this.selected + 1);
                this.pendingKey = '';
                this.render();
                return;
            }
            if (k === 'k' && this.elements.length > 0) {
                if (this.selected < 0) this.selected = this.elements.length - 1;
                else this.selected = Math.max(0, this.selected - 1);
                this.pendingKey = '';
                this.render();
                return;
            }
            if (k === 'v') {
                this.inVisual = !this.inVisual;
                if (this.inVisual) this.visualStart = this.selected >= 0 ? this.selected : 0;
                this.pendingKey = '';
                this.render();
                return;
            }
            if (k === 'd') {
                if (this.inVisual) { this.deleteSelected(); return; }
                if (this.pendingKey === 'd') { this.deleteSelected(); }
                else { this.pendingKey = 'd'; }
                return;
            }
            if (k === 'y') {
                if (this.inVisual) { this.yank(); return; }
                if (this.pendingKey === 'y') { this.yank(); }
                else { this.pendingKey = 'y'; }
                return;
            }
            if (k === 'p') { this.paste(true); return; }
            if (k === 'P') { this.paste(false); return; }
            if (k === 'x') { this.deleteSelected(); return; }
            if (k === 'u') { this.undo(); return; }
            if (k === 'Escape') {
                if (this.inVisual) this.inVisual = false;
                else this.selected = -1;
                this.pendingKey = '';
                this.render();
                return;
            }
        }

        if (k === 'u') { this.undo(); return; }
        if (k === '0') { this.cursor = { x: 0, y: 0 }; this.snapCursor(); this.render(); return; }
        if (k === 'h') { this.moveCursor(-1, 0); this.render(); return; }
        if (k === 'l') { this.moveCursor(1, 0); this.render(); return; }
        if (k === 'k') { this.moveCursor(0, -1); this.render(); return; }
        if (k === 'j') { this.moveCursor(0, 1); this.render(); return; }
        if (k === 'Enter') {
            e.preventDefault();
            const now = Date.now();
            if (this.lastEnter && (now - this.lastEnter) < 300) {
                this.zoomIn();
                this.lastEnter = 0;
                this.render();
                return;
            }
            this.lastEnter = now;
        }
        if (k === 'Escape') {
            e.preventDefault();
            if (this.mode !== 'NORMAL') {
                this.mode = 'NORMAL';
            } else if (this.zoomLevel > 1) {
                this.zoomOut();
            } else if (window.vimEngine) {
                window.vimEngine.closeVectorEditor();
                return;
            }
            this.render();
        }
    }

    renderSidebar() {
        if (!this.sidebar) return;
        this.sidebar.className = this.panel === 'SIDEBAR' ? 'active' : '';
        this.sidebar.style.display = 'block'; 
        this.sidebar.innerHTML = '';
        const r = this.getVisualRange();
        this.elements.forEach((el, i) => {
            const div = document.createElement('div');
            let isSel = i === this.selected;
            let isVis = this.inVisual && r.length > 0 && i >= r[0] && i <= r[1];
            div.className = `item ${isSel ? 'selected' : isVis ? 'visual' : ''}`;
            div.textContent = `[${i}] ${el.type} (${el.stroke})`;
            div.onclick = () => { this.selected = i; this.panel = 'SIDEBAR'; this.render(); };
            this.sidebar.appendChild(div);
        });
    }

    getTransformedGhostSVG(el, dx, dy, factor) {
        let clone = JSON.parse(JSON.stringify(el));
        this.applyTransform(clone, dx, dy);
        let tag = clone.type === 'rect' ? 'rect' : clone.type === 'circle' ? 'circle' : clone.type === 'arrow' ? 'path' : 'polygon';
        let a = { ...clone.attrs, fill: "rgba(0,102,255,0.15)", stroke: "#0066ff", "stroke-width": 1.5 / factor, "stroke-dasharray": 4 / factor };
        let attrStr = Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ');
        return `<${tag} ${attrStr}/>`;
    }

    getRotatedGhostSVG(el, origin, angleRad, factor) {
        let clone = JSON.parse(JSON.stringify(el));
        this.applyRotate(clone, origin, angleRad);
        let tag = clone.type === 'rect' ? 'rect' : clone.type === 'circle' ? 'circle' : clone.type === 'arrow' ? 'path' : 'polygon';
        let a = { ...clone.attrs, fill: "rgba(0,102,255,0.15)", stroke: "#0066ff", "stroke-width": 1.5 / factor, "stroke-dasharray": 4 / factor };
        let attrStr = Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ');
        return `<${tag} ${attrStr}/>`;
    }

    getScaledGhostSVG(el, origin, scaleFactor, factor) {
        let clone = JSON.parse(JSON.stringify(el));
        this.applyScale(clone, origin, scaleFactor);
        let tag = clone.type === 'rect' ? 'rect' : clone.type === 'circle' ? 'circle' : clone.type === 'arrow' ? 'path' : 'polygon';
        let a = { ...clone.attrs, fill: "rgba(0,102,255,0.15)", stroke: "#0066ff", "stroke-width": 1.5 / factor, "stroke-dasharray": 4 / factor };
        let attrStr = Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ');
        return `<${tag} ${attrStr}/>`;
    }

    getHighlightSVG(el, factor) {
        let hl = "";
        const sw = 2 / factor;
        const handleR = 4 / factor;
        if (el.type === 'rect') {
            const { x, y, width, height } = el.attrs;
            hl += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="rgba(0,102,255,0.08)" stroke="#0066ff" stroke-width="${sw}" stroke-dasharray="${4 / factor}"/>`;
            [[x, y], [x + width, y], [x, y + height], [x + width, y + height]].forEach(([px, py]) => {
                hl += `<rect x="${px - handleR / 2}" y="${py - handleR / 2}" width="${handleR}" height="${handleR}" fill="#0066ff"/>`;
            });
        } else if (el.type === 'circle') {
            const { cx, cy, r } = el.attrs;
            hl += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(0,102,255,0.08)" stroke="#0066ff" stroke-width="${sw}" stroke-dasharray="${4 / factor}"/>`;
            [[cx, cy], [cx - r, cy], [cx + r, cy], [cx, cy - r], [cx, cy + r]].forEach(([px, py]) => {
                hl += `<circle cx="${px}" cy="${py}" r="${handleR / 1.5}" fill="#0066ff"/>`;
            });
        } else if (el.type === 'arrow') {
            const m = el.attrs.d ? el.attrs.d.match(/M\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+L\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/) : null;
            if (m) {
                const [, x1, y1, x2, y2] = [...m].map(Number);
                hl += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#0066ff" stroke-width="${sw * 1.5}" stroke-dasharray="${4 / factor}"/>`;
                [[x1, y1], [x2, y2]].forEach(([px, py]) => {
                    hl += `<circle cx="${px}" cy="${py}" r="${handleR}" fill="#0066ff"/>`;
                });
            }
        } else if (el.type === 'polygon' || el.type === 'tri' || (el.attrs && el.attrs.points)) {
            const pts = el.attrs.points.split(' ').map(p => p.split(',').map(Number));
            hl += `<polygon points="${el.attrs.points}" fill="rgba(0,102,255,0.08)" stroke="#0066ff" stroke-width="${sw}" stroke-dasharray="${4 / factor}"/>`;
            pts.forEach(([px, py]) => {
                hl += `<circle cx="${px}" cy="${py}" r="${handleR}" fill="#0066ff"/>`;
            });
        }
        return hl;
    }

    render() {
        const vb = this.getViewBox();
        const step = this.getStep();
        let statusMsg = `MODE: ${this.mode} | FOCUS: ${this.panel} | Zoom: ${this.zoomLevel}x | Pos: (${this.cursor.x}, ${this.cursor.y})`;

        if (this.creation) statusMsg += ` | Drawing ${this.creation.type} (${this.creation.points.length}/${this.creation.total})`;
        if (this.transformState) {
            const dx = this.cursor.x - this.transformState.origin.x;
            const dy = this.cursor.y - this.transformState.origin.y;
            statusMsg += ` | TRANSFORM: Move cursor & press Space/Enter | Delta: (${dx}, ${dy})`;
        }
        if (this.rotateState) {
            if (this.rotateState.stage === 1) {
                statusMsg += ` | ROTATE (Step 1/2): Set Origin Point (Space/Enter)`;
            } else {
                const o = this.rotateState.origin;
                const rad = Math.atan2(this.cursor.y - o.y, this.cursor.x - o.x);
                const deg = (rad * 180 / Math.PI).toFixed(1);
                statusMsg += ` | ROTATE (Step 2/2): Set Target Point | Angle: ${deg}°`;
            }
        }
        if (this.scaleState) {
            if (this.scaleState.stage === 1) {
                statusMsg += ` | SCALE (Step 1/2): Set Origin Point (Space/Enter)`;
            } else {
                const o = this.scaleState.origin;
                const dist = Math.hypot(this.cursor.x - o.x, this.cursor.y - o.y);
                const fac = (dist / this.gridSize).toFixed(2);
                statusMsg += ` | SCALE (Step 2/2): Set Distance Point | Factor: ${fac}x`;
            }
        }

        if (this.status) this.status.textContent = statusMsg;

        let inner = `<defs>
            <pattern id="g" width="${step}" height="${step}" patternUnits="userSpaceOnUse" x="0" y="0">
                <path d="M ${step} 0 L 0 0 0 ${step}" fill="none" stroke="#eee" stroke-width="${1 / vb.factor}"/>
            </pattern>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#000"/>
            </marker>
        </defs>
        <rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="url(#g)"/>
        <line x1="-10000" y1="0" x2="10000" y2="0" stroke="#ddd" stroke-width="${1 / vb.factor}"/>
        <line x1="0" y1="-10000" x2="0" y2="10000" stroke="#ddd" stroke-width="${1 / vb.factor}"/>`;

        this.elements.forEach((el, i) => {
            let tag = el.type === 'rect' ? 'rect' : el.type === 'circle' ? 'circle' : el.type === 'arrow' ? 'path' : 'polygon';
            let a = { ...el.attrs, fill: el.fill, stroke: el.stroke, "stroke-width": 1.5 / vb.factor };
            if (el.type === 'arrow') a["marker-end"] = "url(#arrow)";
            let attrStr = Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ');
            inner += `<${tag} ${attrStr}/>`;
            if (this.isSelected(i)) {
                inner += this.getHighlightSVG(el, vb.factor);
            }
        });

        if (this.transformState) {
            const o = this.transformState.origin;
            const dx = this.cursor.x - o.x;
            const dy = this.cursor.y - o.y;
            const el = this.elements[this.transformState.index];

            if (el) inner += this.getTransformedGhostSVG(el, dx, dy, vb.factor);
            inner += `<circle cx="${o.x}" cy="${o.y}" r="${5 / vb.factor}" fill="#f00"/>`;
            inner += `<circle cx="${this.cursor.x}" cy="${this.cursor.y}" r="${5 / vb.factor}" fill="#0066ff"/>`;
            inner += `<line x1="${o.x}" y1="${o.y}" x2="${this.cursor.x}" y2="${this.cursor.y}" stroke="#0066ff" stroke-width="${1.5 / vb.factor}" stroke-dasharray="${4 / vb.factor}"/>`;
        }

        if (this.rotateState) {
            const el = this.elements[this.rotateState.index];
            if (this.rotateState.stage === 1) {
                inner += `<circle cx="${this.cursor.x}" cy="${this.cursor.y}" r="${5 / vb.factor}" fill="#f00"/>`;
            } else if (this.rotateState.stage === 2) {
                const o = this.rotateState.origin;
                const rad = Math.atan2(this.cursor.y - o.y, this.cursor.x - o.x);
                if (el) inner += this.getRotatedGhostSVG(el, o, rad, vb.factor);
                inner += `<circle cx="${o.x}" cy="${o.y}" r="${5 / vb.factor}" fill="#f00"/>`;
                inner += `<circle cx="${this.cursor.x}" cy="${this.cursor.y}" r="${5 / vb.factor}" fill="#0066ff"/>`;
                inner += `<line x1="${o.x}" y1="${o.y}" x2="${this.cursor.x}" y2="${this.cursor.y}" stroke="#0066ff" stroke-width="${1.5 / vb.factor}" stroke-dasharray="${4 / vb.factor}"/>`;
            }
        }

        if (this.scaleState) {
            const el = this.elements[this.scaleState.index];
            if (this.scaleState.stage === 1) {
                inner += `<circle cx="${this.cursor.x}" cy="${this.cursor.y}" r="${5 / vb.factor}" fill="#f00"/>`;
            } else if (this.scaleState.stage === 2) {
                const o = this.scaleState.origin;
                const dist = Math.hypot(this.cursor.x - o.x, this.cursor.y - o.y);
                const fac = dist / this.gridSize;
                if (el) inner += this.getScaledGhostSVG(el, o, fac, vb.factor);
                inner += `<circle cx="${o.x}" cy="${o.y}" r="${5 / vb.factor}" fill="#f00"/>`;
                inner += `<circle cx="${this.cursor.x}" cy="${this.cursor.y}" r="${5 / vb.factor}" fill="#0066ff"/>`;
                inner += `<line x1="${o.x}" y1="${o.y}" x2="${this.cursor.x}" y2="${this.cursor.y}" stroke="#0066ff" stroke-width="${1.5 / vb.factor}" stroke-dasharray="${4 / vb.factor}"/>`;
            }
        }

        if (this.creation) {
            this.creation.points.forEach(p => {
                inner += `<circle cx="${p.x}" cy="${p.y}" r="${4 / vb.factor}" fill="#f00"/>`;
            });
            if (this.creation.points.length > 0) {
                const l = this.creation.points[this.creation.points.length - 1];
                inner += `<line x1="${l.x}" y1="${l.y}" x2="${this.cursor.x}" y2="${this.cursor.y}" stroke="#f00" stroke-width="${1 / vb.factor}" stroke-dasharray="${3 / vb.factor}"/>`;
            }
        }

        const c = this.cursor, sz = 8 / vb.factor;
        inner += `<g><line x1="${c.x - sz}" y1="${c.y}" x2="${c.x + sz}" y2="${c.y}" stroke="#f00" stroke-width="${1.5 / vb.factor}"/><line x1="${c.x}" y1="${c.y - sz}" x2="${c.x}" y2="${c.y + sz}" stroke="#f00" stroke-width="${1.5 / vb.factor}"/></g>`;
        if (this.viewport) {
            this.viewport.innerHTML = `<svg viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" style="width:100%;height:100%;">${inner}</svg>`;
        }
        this.renderSidebar();
    }
}

class DocumentModel {
    constructor() {
        this.blocks = [new ParagraphBlock('Welcome!', 'p')];
        this.activeIndex = 0;
        this.activeSubTarget = 'main';
        this.navLevel = 'ROOT';
    }

    PAGE_SIZE = 20;

    getCurrentPage() {
        return Math.floor(this.activeIndex / this.PAGE_SIZE);
    }

    getTotalPages() {
        return Math.ceil(this.blocks.length / this.PAGE_SIZE) || 1;
    }

    nextPage() {
        const currentPage = this.getCurrentPage();
        const totalPages = this.getTotalPages();
        if (currentPage < totalPages - 1) {
            const targetIndex = (currentPage + 1) * this.PAGE_SIZE;
            this.setActiveBlock(targetIndex);
            return true;
        }
        return false;
    }

    prevPage() {
        const currentPage = this.getCurrentPage();
        if (currentPage > 0) {
            const targetIndex = (currentPage - 1) * this.PAGE_SIZE;
            this.setActiveBlock(targetIndex);
            return true;
        }
        return false;
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

    jumpToPageTop() {
        const currentPage = this.getCurrentPage();
        this.activeIndex = currentPage * this.PAGE_SIZE;
        this.navLevel = 'ROOT';
        this.activeSubTarget = this.getActiveBlock().getFirstSubTarget();
    }

    jumpToPageBottom() {
        const currentPage = this.getCurrentPage();
        const pageEnd = Math.min((currentPage + 1) * this.PAGE_SIZE - 1, this.blocks.length - 1);
        this.activeIndex = pageEnd;
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
        return `\\documentclass{article}\n\\usepackage{amsmath, amssymb, tcolorbox, enumitem, graphicx}\n\n\\begin{document}\n\n${bodyTex}\n\n\\end{document}`;
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

    openVectorEditor() {
        if (!this.vectorEngine) return;
        const vectorContainer = document.getElementById('vector-container');
        const paperContainer = document.getElementById('paper-container');
        if (vectorContainer) vectorContainer.style.display = 'flex';
        if (paperContainer) paperContainer.style.display = 'none';

        this.vectorEngine.viewport = document.getElementById('cad-viewport');
        this.vectorEngine.sidebar = document.getElementById('cad-sidebar');
        this.vectorEngine.status = document.getElementById('cad-status');
        this.vectorEngine.cmdInput = document.getElementById('cmd-input');
        this.vectorEngine.render();
    }

    closeVectorEditor() {
        const vectorContainer = document.getElementById('vector-container');
        const paperContainer = document.getElementById('paper-container');
        if (vectorContainer) vectorContainer.style.display = 'none';
        if (paperContainer) paperContainer.style.display = 'block';
        this.render();
    }

    importSVGToActivePictureBlock(svgContent) {
        let activeBlock = this.doc.getActiveBlock();
        if (!activeBlock || activeBlock.type !== 'picture') {
            if (activeBlock && activeBlock.type === 'paragraph' && !activeBlock.getValue().trim()) {
                activeBlock = new PictureBlock(svgContent, 'picture');
                this.doc.blocks[this.doc.activeIndex] = activeBlock;
            } else {
                activeBlock = new PictureBlock(svgContent, 'picture');
                this.doc.insertBlockBelow(activeBlock);
            }
        } else {
            this.history.pushState(this.doc);
            activeBlock.setValue('main', svgContent);
        }
        this.closeVectorEditor();
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
        const vectorContainer = document.getElementById('vector-container');
        if (vectorContainer && vectorContainer.style.display !== 'none') {
            return;
        }

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

        if (cmdName === 'picture') {
            this.history.pushState(this.doc);
            const activeBlock = this.doc.getActiveBlock();
            const rawText = activeBlock ? activeBlock.getTextContent().trim() : '';
            const newBlock = new PictureBlock(rawText, cmdName);
            this.doc.blocks[this.doc.activeIndex] = newBlock;
            this.doc.activeSubTarget = newBlock.getFirstSubTarget();
            this.doc.navLevel = 'ROOT';
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
        } else if (primitive === 'picture') {
            newBlock = new PictureBlock(rawText, templateKey);
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
            if (this.doc.getActiveBlock()?.type === 'picture') {
                this.openVectorEditor();
                return;
            }
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
                this.doc.jumpToPageTop();
                this.keyBuffer = '';
                this.render();
            } else {
                this.keyBuffer = 'g';
            }
            return;
        }

        if (key === 'G') {
            this.doc.jumpToPageBottom();
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

        if (key === '>' || key === 'L') {
            e.preventDefault();
            if (this.doc.nextPage()) {
                this.triggerPageAnimation('next');
            }
            return;
        }

        if (key === '<' || key === 'H') {
            e.preventDefault();
            if (this.doc.prevPage()) {
                this.triggerPageAnimation('prev');
            }
            return;
        }

        this.keyBuffer = '';
    }

    triggerPageAnimation(direction) {
        if (!this.paperContainer) return;

        const animClass = direction === 'next' ? 'page-anim-next' : 'page-anim-prev';

        this.paperContainer.classList.remove('page-anim-next', 'page-anim-prev');
        void this.paperContainer.offsetWidth;

        this.paperContainer.classList.add(animClass);
        this.render();

        setTimeout(() => {
            this.paperContainer.classList.remove(animClass);
        }, 220);
    }

    render() {
        if (!this.paperContainer) return;

        this.paperContainer.innerHTML = '';

        const currentPage = this.doc.getCurrentPage();
        const totalPages = this.doc.getTotalPages();

        if (this.statusInfo) {
            this.statusInfo.textContent = `Page ${currentPage + 1}/${totalPages} | Block ${this.doc.activeIndex + 1}/${this.doc.blocks.length}${this.doc.navLevel === 'NESTED' ? ' [NESTED]' : ''}`;
        }

        let vMin = -1, vMax = -1;
        if ((this.mode === 'VISUAL' || this.mode === 'VISUAL LINE') && this.visualStart !== null) {
            vMin = Math.min(this.visualStart, this.doc.activeIndex);
            vMax = Math.max(this.visualStart, this.doc.activeIndex);
        }

        let activeTargetElement = null;

        const startIdx = currentPage * this.doc.PAGE_SIZE;
        const endIdx = Math.min(startIdx + this.doc.PAGE_SIZE, this.doc.blocks.length);
        const visibleBlocks = this.doc.blocks.slice(startIdx, endIdx);

        visibleBlocks.forEach((block, localIndex) => {
            const globalIndex = startIdx + localIndex;
            const isActiveBlock = globalIndex === this.doc.activeIndex;
            const blockDiv = document.createElement('div');
            blockDiv.className = 'block-node' + (isActiveBlock && this.doc.navLevel === 'ROOT' ? ' block-active-root' : '');

            if (globalIndex >= vMin && globalIndex <= vMax) {
                blockDiv.classList.add(this.visualType === 'LINE' ? 'block-visual-line-selected' : 'block-visual-selected');
            }

            blockDiv.addEventListener('click', () => {
                if (this.mode !== 'INSERT') {
                    this.doc.setActiveBlock(globalIndex);
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
            activeTargetElement.scrollIntoView({ block: 'nearest', behavior: 'auto' });
            if (this.mode === 'INSERT' && activeTargetElement.tagName === 'TEXTAREA') {
                activeTargetElement.focus();
            }
        }
    }

    renderBlockPrimitive(block, isActiveBlock) {
        const wrapper = document.createElement('div');
        const tplDef = this.templateRegistry ? this.templateRegistry.get(block.templateKey) : null;
        const templateClass = block.templateKey ? `tpl-${block.templateKey}` : '';

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
                div.className = templateClass || 'tpl-math';
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
            table.className = templateClass || 'tpl-table';

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
        } else if (block.type === 'picture') {
            if (isActiveBlock && this.mode === 'INSERT') {
                const textarea = this.createInput(block, 'main');
                textarea.classList.add('sub-target-active');
                textarea.placeholder = '<svg>...</svg> or export drawing from Vector Engine';
                wrapper.appendChild(textarea);
            } else {
                const div = document.createElement('div');
                div.className = templateClass || 'tpl-picture';
                if (block.svg && block.svg.trim()) {
                    const rawHtml = tplDef ? tplDef.html.replaceAll('{content}', block.svg).replaceAll('{svg}', block.svg) : block.svg;
                    div.innerHTML = rawHtml;
                } else {
                    div.innerHTML = '<div class="picture-placeholder" style="border: 1px dashed #ccc; padding: 15px; text-align: center; color: #888;">[ Empty Picture Block - Edit SVG text or export from VectorEngine ]</div>';
                }
                if (isActiveBlock && this.doc.navLevel === 'NESTED') div.classList.add('sub-target-active');
                wrapper.appendChild(div);
            }
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
    const vimEngine = new VimEngine(templateRegistry);
    window.vimEngine = vimEngine;

    if (document.getElementById('cad-viewport')) {
        const vectorEngine = new VectorEngine(templateRegistry, (svgContent) => {
            vimEngine.importSVGToActivePictureBlock(svgContent);
        });
        vimEngine.vectorEngine = vectorEngine;
    }
};
# Architecture & Vibe Coding Guide

This document explains the mental model of **Ksaitex** so you can stay in the flow ("vibe coding") when adding features.

## Data Flow

1.  **Input**: Markdown Text (`str`)
    ↓
2.  **Parser**: `src/ksaitex/parsing/markdown.py`
    *   Converts Markdown → LaTeX Fragments (String)
    *   *Tip:* Edit `LatexRenderer` class here to add new Markdown features (e.g., tables, blockquotes).
    ↓
3.  **Templating**: `src/ksaitex/templating/`
    *   Wraps Fragments → Full `.tex` Document
    *   `engine.py`: Jinja2 Configuration (uses `\VAR{}` delimiters).
    *   `latex/base.tex`: The master LaTeX template.
    *   *Tip:* Add packages (e.g., `\usepackage{tikz}`) in `base.tex`.
    ↓
4.  **Compilation**: `src/ksaitex/compilation/compiler.py`
    *   Runs `lualatex` on the temporary `.tex` file.
    *   Injects `fonts/` directory into `OSFONTDIR`.
    ↓
5.  **Output**: PDF Bytes (`bytes`)

## Key Design Decisions

### Why Vanilla JS?
To minimize "build step fatigue." The `ui/` folder is served directly by FastAPI.
- **Edit** `ui/index.html` → **Refresh** Browser. No webpack/vite waiting.

### Why `\VAR{}` delimiters?
Standard Jinja `{{ }}` conflicts with LaTeX `{ }`.
- We use `\VAR{ var }` for printing.
- We use `\BLOCK{ if cond }` for logic.
- We use `\#{ comment }` for comments.

### Why `uv`?
It's instant. No virtualenv activation rituals.
- Just run `uv run ksaitex serve`.

## Common Tasks

### "I want to add support for Tables"
1.  Open `src/ksaitex/parsing/markdown.py`.
2.  In `LatexRenderer.render`, handle `table_open`, `tr_open`, etc., tokens from `markdown-it-py`.
3.  Return LaTeX tabular syntax strings.

### "I want to change the paper size"
1.  Open `src/ksaitex/templating/latex/base.tex`.
2.  Change `\documentclass{\VAR{document_class}}` to pass options, or hardcode it.

### "I want a new font"
1.  Download `.ttf`.
2.  Put in `fonts/`.
3.  Update the UI dropdown in `ui/index.html`.

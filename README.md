# Ksaitex v2

A frictionless, strictly-typed Markdown-to-PDF converter built with Python, LuaLaTeX, and React-like Vanilla JS.

Designed for high-performance "vibe coding" with instant feedback.

## Features

- **Strictly Typed**: Built with `mypy` strict mode. No inline comments. Clean code.
- **Markdown-First**: Uses `markdown-it-py` for robust parsing.
- **LaTeX Backend**: LuaLaTeX compilation with Jinja2 templating (using `\VAR{}` delimiters to avoid conflicts).
- **Live Preview UI**: Vanilla JS frontend with instant compilation feedback.
- **Devanagari Support**: First-class support for Sanskrit/Hindi via `fontspec`.

## Quick Start

### 1. Install Dependencies
This project handles dependencies with `uv` for speed.

```bash
# Install dependencies
uv sync
```

### 2. Run the Server
Start the backend and UI with a single command:

```bash
uv run ksaitex serve
```
> Open **http://localhost:8000** to see the UI.

### 3. CLI Usage
You can also use the CLI for batch conversion:

```bash
uv run ksaitex convert input.md --output result.pdf --template DEVANAGARI
```

## Fonts Setup
To use custom fonts (like *Tiro Devanagari Sanskrit*), simply drop the `.ttf` or `.otf` files into the `fonts/` directory at the project root.

```
ksaitex/
├── fonts/
│   ├── TiroDevanagariSanskrit-Regular.ttf
│   └── ...
```
The compiler automatically registers this directory.

## Development

- **Backend**: `src/ksaitex/` (FastAPI + Business Logic)
- **Frontend**: `ui/` (Vanilla HTML/CSS/JS)
- **Templates**: `src/ksaitex/templating/latex/` (Jinja2 `.tex` files)

### Adding a New Template
1. Create a `.tex` file in `src/ksaitex/templating/latex/`.
2. Use `\VAR{variable}` for dynamic content and `\BLOCK{ if }` for logic.
3. Pass variables via the `config` dictionary in `engine.py`.

## License
MIT

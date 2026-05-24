<h1 align="center">🕉️ ksai_TEX</h1>
<p align="center"><i>A Frictionless, Strictly-Typed Markdown-to-PDF Engine for the Typographically Obsessed</i></p>
<p align="center"><b> Powered by Python, LuaLaTeX, and pure "Vibe Coding" energy </b></p>

<p align="center">
  <img src="https://img.shields.io/badge/build-chaotic-orange?style=flat-square&logo=github" />
  <img src="https://img.shields.io/badge/types-strict-green?style=flat-square&logo=python" />
  <img src="https://img.shields.io/badge/latex-lua-blue?style=flat-square&logo=latex" />
  <img src="https://img.shields.io/badge/ui-gruvbox-d65d0e?style=flat-square&logo=css3" />
  <img src="https://img.shields.io/badge/vibe-high-yellow?style=flat-square&logo=electricity" />
</p>

---

## 📜 What is ksai_TEX?

A document generation engine where Markdown enters and pristine PDFs exit... eventually.  
Built in **Python 3.12+**, enforced by **mypy**, and rendered with the sheer power of **LuaLaTeX**. 

Designed for people who want the power of LaTeX but refuse to write backslashes manually.

You get:

| Feature                  | Description                                                                 |
|--------------------------|-----------------------------------------------------------------------------|
| 🪄 Magic Commands        | `[[MAGIC:Box|title=Chaos]]` -> Beautiful Typeset Box. Like Hogwarts.       |
| 🕉️ Devanagari First      | Sanskrit & Nepali support so good it feels native.                         |
| 🐍 Python Backend        | Strictly typed. No inline comments. No mercy.                              |
| 🎨 Gruvbox UI            | Because staring at white screens is a crime against humanity.              |
| ⚡ Instant Preview       | See your layout break in real-time!                                        |
| 🧩 Template Engine       | Jinja2 inside LaTeX. It’s unholy, but it works correctly.                  |
| 🔒 Atomic Editing        | We track your cursor like a hawk to ensure perfect sync.                   |

> 💸 Whether you’re writing a thesis, a novel, or essentially just generating PDFs to feel productive — `ksai_TEX` supports your delusion.

---

## 🛠️ Constructing the Machinery

### Step 1: Install Dependencies

We use `uv` because `pip` is too slow for our vibes.

```bash
# Install the chaos manager
pip install uv

# Sync the universe (and dependencies)
uv sync
```

### Step 2: The Font Ritual

Drop your fancy `.ttf` or `.otf` files into the `fonts/` directory.  
If you don't have *Tiro Devanagari Sanskrit*, are you even typing?

```
ksaitex/
├── fonts/
│   ├── TiroDevanagariSanskrit-Regular.ttf
│   └── ...
```

---

## 🚀 Summoning the Daemon

### Option A: The GUI Experience (Recommended)

Fire up the server and the reactive editor.

```bash
uv run ksaitex serve
```

> Open **http://localhost:8000**. Do not look directly at the logs.

### Option B: The CLI (For Robots)

Convert files in the shadows.

```bash
uv run ksaitex convert input.md --output masterpiece.pdf --template base
```

---

## 🧩 Python + LaTeX + JS = ♥️?

Yes. 
*   **Javascript** handles the frontend editor.
*   **Python (FastAPI)** orchestrates the madness and handles the heavy logic.
*   **LuaLaTeX** does the actual rendering, because we care about typography.

> ☕ Write markdown, compile PDF, refuse to elaborate.

---

## 📸 Visual Proof

> Because if you can't see the kerning, does it even matter?


<img width="1917" height="1009" alt="image" src="https://github.com/user-attachments/assets/878859a5-585c-48cf-8d3c-312cc9761311" />

<img width="1920" height="1009" alt="image" src="https://github.com/user-attachments/assets/2c09bc20-6580-4e2c-ac38-cff256a27c61" />


---

## ✨ Want to Contribute?

Fork the repo. Add a new magic command.  
Fix a regex that parses nested brackets.  
We’ll probably merge it, unless `mypy` yells at us.

---

> 🧠 Still reading? You either really need to generate a PDF or you just like reading badges.

<h3 align="center">🚀 Write fast. Typeset faster. Ignore warnings.</h3>
<p align="center"><i>*overfull \hbox (badness 10000) not guaranteed to be fixed.</i></p>

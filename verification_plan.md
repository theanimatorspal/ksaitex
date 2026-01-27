
# Verification Plan

## 1. Verify Source Map Generation
- Run `parse()` on sample Markdown.
- Check if it returns a dictionary mapping Markdown lines to LaTeX lines.

## 2. Verify Template Offset
- Run `render_latex` with a sample template.
- Check if it detects the correct line number for `\VAR{content}`.

## 3. Verify Sync Endpoint
- Create a dummy project directory `data/test_sync`.
- Create `source_map.json` mapping md line 1 -> tex line 10.
- Ensure `main.pdf` and `main.tex` (dummy) exist and `synctex` is installed (mock if needed, but we have real environment).
- Call `/api/sync` with line 1.
- Expect `{"page": ...}`.
- Since we can't easily run full synctex without a real compilation, we might rely on unit tests or just code inspection + running the app.

## 4. Manual UI Verification
- Open app.
- Create project.
- Type content.
- Compile.
- Move cursor.
- Check "Page: X" update in top bar.
- Click "Page: X".
- Check PDF iframe src has `#page=X`.

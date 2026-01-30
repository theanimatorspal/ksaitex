
from ksaitex.parsing.markdown import parse
from ksaitex.templating.engine import render_latex

md_text = """# Section 1
This is a paragraph.

## Subsection
* Item 1
* Item 2
"""

print(f"--- MARKDOWN ---")
latex_content, source_map = parse(md_text)
print(f"Content Length: {len(latex_content)}")
print(f"Mapping: {source_map}")

print(f"\n--- TEMPLATE ---")
template_name = "base.tex" # assuming base exists
config = {"title": "Test"}
try:
    full_latex, offset = render_latex(latex_content, config, template_name=template_name)
    print(f"Offset: {offset}")
    print(f"Full Latex Length: {len(full_latex)}")
    
    # Check if offset makes sense
    lines = full_latex.split('\n')
    print(f"Line at offset ({offset}): '{lines[offset]}'") # Should contain or be near content start
except Exception as e:
    print(f"Template Error: {e}")

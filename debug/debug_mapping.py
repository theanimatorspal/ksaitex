from markdown_it import MarkdownIt

md_text = """# Section 1
This is a paragraph.

## Subsection
* Item 1
* Item 2

Some code:
```python
print("Hello")
```
"""

md = MarkdownIt()
tokens = md.parse(md_text)

for t in tokens:
    print(f"Type: {t.type}, Map: {t.map}, Content: {t.content[:20]}")

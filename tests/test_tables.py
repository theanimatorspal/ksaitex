import pytest
from ksaitex.parsing.markdown import parse
from ksaitex.templating.engine import render_latex

def test_table_structure():
    md = """
| Col 1 | Col 2 |
| :--- | :--- |
| Val 1 | Val 2 |
"""
    latex, _ = parse(md)
    assert "\\begin{xltabular}{\\textwidth}{|K|K|}" in latex
    assert "\\toprule" in latex
    assert "Col 1 & Col 2 \\\\" in latex
    assert "\\midrule" in latex
    assert "\\endhead" in latex
    assert "Val 1 & Val 2 \\\\" in latex
    assert "\\bottomrule" in latex
    assert "\\end{xltabular}" in latex

def test_table_alignment_magic():
    md = """
--[[--[[--[[#######-[[MAGIC:table_align|align=Right]]-#######]]--]]--]]--

| A | B |
|---|---|
| 1 | 2 |
"""
    latex, _ = parse(md)
    # The parser generates the marker, the engine replaces it.
    config = {"script": "LATIN", "font_file": "Arial"}
    full_latex, _ = render_latex(latex, config)
    
    assert "\\settablealign{Right}" in full_latex
    assert "\\begin{xltabular}{\\textwidth}{|K|K|}" in full_latex

def test_special_character_escaping_in_cells():
    md = """
| Name | Formula |
| :--- | :--- |
| Salt & Water | H2O $ 100 |
"""
    latex, _ = parse(md)
    # & should be escaped as \&, $ as \$, etc.
    assert "Salt \\& Water & H2O \\$ 100 \\\\" in latex

def test_multiple_tables_different_columns():
    md = """
| C1 | C2 |
|---|---|
| D1 | D2 |

| X1 | X2 | X3 |
|---|---|---|
| Y1 | Y2 | Y3 |
"""
    latex, _ = parse(md)
    assert "\\begin{xltabular}{\\textwidth}{|K|K|}" in latex
    assert "\\begin{xltabular}{\\textwidth}{|K|K|K|}" in latex

def test_empty_cells():
    md = """
| A | B |
|---|---|
|   | 2 |
| 1 |   |
"""
    latex, _ = parse(md)
    assert " & 2 \\\\" in latex
    assert "1 &  \\\\" in latex # Note: spacing depends on markdown-it output

def test_long_table_paging_support():
    # Verify that \endhead is present for paging support
    md = """
| Header |
| :--- |
| Row 1 |
"""
    latex, _ = parse(md)
    assert "\\midrule" in latex
    assert "\\endhead" in latex

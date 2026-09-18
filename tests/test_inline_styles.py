import pytest
from ksaitex.parsing.markdown import parse

def test_bold_italic():
    latex, _ = parse("***TEXT***")
    assert "\\textit{\\textbf{TEXT}}" in latex or "\\textbf{\\textit{TEXT}}" in latex

def test_underline():
    latex, _ = parse("_TEXT_")
    assert "\\underline{TEXT}" in latex

def test_italic_underline():
    latex, _ = parse("_*TEXT*_")
    assert "\\underline{\\textit{TEXT}}" in latex or "\\textit{\\underline{TEXT}}" in latex

def test_bold_underline():
    latex, _ = parse("_**TEXT**_")
    assert "\\underline{\\textbf{TEXT}}" in latex or "\\textbf{\\underline{TEXT}}" in latex

def test_bold_italic_underline():
    latex1, _ = parse("_***TEXT***_")
    assert "\\underline{\\textit{\\textbf{TEXT}}}" in latex1 or "\\underline{\\textbf{\\textit{TEXT}}}" in latex1

    latex2, _ = parse("_***TEXT***__")
    assert "\\underline{\\textit{\\textbf{TEXT}}}" in latex2 or "\\underline{\\textbf{\\textit{TEXT}}}" in latex2

def test_bold_patch_preserved():
    latex, _ = parse("**'quoted bold'**")
    assert "\\textbf{`quoted bold'}" in latex

def test_intra_word_underline():
    latex, _ = parse("अ_TEXT_आ")
    assert "अ\\underline{TEXT}आ" in latex

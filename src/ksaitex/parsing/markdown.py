from markdown_it import MarkdownIt
from markdown_it.token import Token
from markdown_it.renderer import RendererProtocol
from typing import List, Dict, Any, Optional

class LatexRenderer:
    def __init__(self, parser: Optional[MarkdownIt] = None):
        self.output = ""
        self.parser = parser

    def render(self, tokens: List[Token], options: Dict[str, Any], env: Dict[str, Any]) -> str:
        result = ""
        for i, token in enumerate(tokens):
            if token.type == "inline":
                result += self.render_inline(token.children or [])
            elif token.type == "heading_open":
                level = int(token.tag[1:])
                # Map h1->section, h2->subsection, etc.
                cmd = "section"
                if level == 2: cmd = "subsection"
                elif level == 3: cmd = "subsubsection"
                elif level == 4: cmd = "paragraph"
                elif level == 5: cmd = "subparagraph"
                result += f"\\{cmd}{{"
            elif token.type == "heading_close":
                result += "}\n\n"
            elif token.type == "paragraph_open":
                pass # Latex handles paragraphs with newlines
            elif token.type == "paragraph_close":
                result += "\n\n"
            elif token.type == "bullet_list_open":
                result += "\\begin{itemize}\n"
            elif token.type == "bullet_list_close":
                result += "\\end{itemize}\n"
            elif token.type == "ordered_list_open":
                result += "\\begin{enumerate}\n"
            elif token.type == "ordered_list_close":
                result += "\\end{enumerate}\n"
            elif token.type == "list_item_open":
                result += "\\item "
            elif token.type == "list_item_close":
                result += "\n"
            elif token.type == "fence": # Code block
                result += f"\\begin{{lstlisting}}\n{token.content}\\end{{lstlisting}}\n\n"
            elif token.type == "image":
                 # Simple image handling: \includegraphics{src}
                 src = token.attrGet("src") or ""
                 alt = token.content
                 result += f"\\begin{{figure}}[h]\\centering\\includegraphics[width=0.8\\linewidth]{{{src}}}\\caption{{{alt}}}\\end{{figure}}\n"
        
        return result

    def render_inline(self, tokens: List[Token]) -> str:
        result = ""
        for token in tokens:
            if token.type == "text":
                # Escape latex special chars
                text = token.content.replace("_", "\\_").replace("%", "\\%").replace("$", "\\$").replace("#", "\\#") # Incomplete escaping, good enough for now
                result += text
            elif token.type == "strong_open":
                result += "\\textbf{"
            elif token.type == "strong_close":
                result += "}"
            elif token.type == "em_open":
                result += "\\textit{"
            elif token.type == "em_close":
                result += "}"
            elif token.type == "code_inline":
                result += f"\\texttt{{{token.content}}}"
            elif token.type == "link_open":
                href = token.attrGet("href")
                result += f"\\href{{{href}}}{{"
            elif token.type == "link_close":
                result += "}"
            
        return result

def parse(text: str) -> str:
    md = MarkdownIt()
    tokens = md.parse(text)
    renderer = LatexRenderer(md)
    return renderer.render(tokens, {}, {})

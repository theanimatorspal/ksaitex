from markdown_it import MarkdownIt
from markdown_it.token import Token
from markdown_it.renderer import RendererProtocol
from typing import List, Dict, Any, Optional, Tuple

class LatexRenderer:
    def __init__(self, parser: Optional[MarkdownIt] = None):
        self.output = ""          # Not really used in render method style, but kept for compat
        self.parser = parser
        self.current_tex_line = 1 # 1-based indexing for LaTeX
        self.source_map = {}      # dict mapping md_line -> tex_line

    def render(self, tokens: List[Token], options: Dict[str, Any], env: Dict[str, Any]) -> Tuple[str, Dict[int, int]]:
        result = ""
        self.current_tex_line = 1
        self.source_map = {}

        for i, token in enumerate(tokens):
            term = ""
            
            # Map source line to current tex line
            if token.map:
                start_line = token.map[0] + 1 # 0-based to 1-based
                # Record the mapping for the starting line of this token
                if start_line not in self.source_map:
                    self.source_map[start_line] = self.current_tex_line

            if token.type == "inline":
                term = self.render_inline(token.children or [])
            elif token.type == "heading_open":
                level = int(token.tag[1:])
                # Map h1->section, h2->subsection, etc.
                cmd = "section"
                if level == 2: cmd = "subsection"
                elif level == 3: cmd = "subsubsection"
                elif level == 4: cmd = "paragraph"
                elif level == 5: cmd = "subparagraph"
                term = f"\\{cmd}{{"
            elif token.type == "heading_close":
                term = "}\n\n"
            elif token.type == "paragraph_open":
                pass # Latex handles paragraphs with newlines
            elif token.type == "paragraph_close":
                term = "\n\n"
            elif token.type == "bullet_list_open":
                term = "\\begin{itemize}\n"
            elif token.type == "bullet_list_close":
                term = "\\end{itemize}\n"
            elif token.type == "ordered_list_open":
                term = "\\begin{enumerate}\n"
            elif token.type == "ordered_list_close":
                term = "\\end{enumerate}\n"
            elif token.type == "list_item_open":
                term = "\\item "
            elif token.type == "list_item_close":
                term = "\n"
            elif token.type == "fence": # Code block
                term = f"\\begin{{lstlisting}}\n{token.content}\\end{{lstlisting}}\n\n"
            elif token.type == "image":
                 # Simple image handling: \includegraphics{src}
                 src = token.attrGet("src") or ""
                 alt = token.content
                 term = f"\\begin{{figure}}[h]\\centering\\includegraphics[width=0.8\\linewidth]{{{src}}}\\caption{{{alt}}}\\end{{figure}}\n"
            
            result += term
            self.current_tex_line += term.count('\n')
        
        return result, self.source_map

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

def parse(text: str) -> Tuple[str, Dict[int, int]]:
    md = MarkdownIt()
    tokens = md.parse(text)
    renderer = LatexRenderer(md)
    return renderer.render(tokens, {}, {})

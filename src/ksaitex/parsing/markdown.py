from markdown_it import MarkdownIt
from markdown_it.token import Token
from markdown_it.renderer import RendererProtocol
from typing import List, Dict, Any, Optional, Tuple
class LatexRenderer:
    def __init__(self, parser: Optional[MarkdownIt] = None):
        self.output = ""
        self.parser = parser
        self.current_tex_line = 1
        self.source_map = {}
        self.in_double_quote = False
    def render(self, tokens: List[Token], options: Dict[str, Any], env: Dict[str, Any]) -> Tuple[str, Dict[int, int]]:
        result = ""
        self.current_tex_line = 1
        self.source_map = {}
        self.in_double_quote = False
        for i, token in enumerate(tokens):
            term = ""
            if token.map:
                start_line = token.map[0] + 1
                if start_line not in self.source_map:
                    self.source_map[start_line] = self.current_tex_line
            if token.type == "inline":
                term = self.render_inline(token.children or [])
            elif token.type == "heading_open":
                level = int(token.tag[1:])
                cmd = "section"
                if level == 2: cmd = "subsection"
                elif level == 3: cmd = "subsubsection"
                elif level == 4: cmd = "paragraph"
                elif level == 5: cmd = "subparagraph"
                term = f"\\{cmd}{{"
            elif token.type == "heading_close":
                term = "}\n\n"
            elif token.type == "paragraph_open":
                pass
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
            elif token.type == "fence":
                term = f"\\begin{{lstlisting}}\n{token.content}\\end{{lstlisting}}\n\n"
            elif token.type == "image":
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
                content = token.content
                output_segment = ""
                for i, char in enumerate(content):
                    if char == '"':
                        if not self.in_double_quote:
                            output_segment += "``"
                            self.in_double_quote = True
                        else:
                            output_segment += "''"
                            self.in_double_quote = False
                    elif char == "'":
                        is_start = (i == 0)
                        prev_char = content[i-1] if i > 0 else " "
                        if is_start or prev_char.isspace() or prev_char in ['(', '[', '{', '-', '"', '`']:
                            output_segment += "`"
                        else:
                            output_segment += "'"
                    elif char in ["_", "%", "$", "#"]:
                        output_segment += "\\" + char
                    else:
                        output_segment += char
                result += output_segment
            elif token.type == "softbreak":
                result += "\n"
            elif token.type == "hardbreak":
                result += "\\\\\n"
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
    def old_render_inline(self, tokens: List[Token]) -> str:
        pass
def parse(text: str) -> Tuple[str, Dict[int, int]]:
    md = MarkdownIt().disable("code")
    tokens = md.parse(text)
    renderer = LatexRenderer(md)
    return renderer.render(tokens, {}, {})
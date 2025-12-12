# Okay so I want a program that converts markdown file into tex (Latex, LuaLaTeX specifically) file
# should have a Run() function that will do the job (text or file path input, and text output)

import re
import os
from pathlib import Path
from typing import Union, List, Pattern, Optional, Dict, Match

InputSource = Union[str, Path]
TexContent = str
LineList = List[str]
RegexPattern = Pattern[str]

class LuaLatexFragmentConverter:
    """
    Converts Markdown syntax to a LuaLaTeX body fragment (no preamble).
    """

    def __init__(self) -> None:
        self.header_pattern: RegexPattern = re.compile(r"^(#{1,6})\s+(.*)")
        self.bold_pattern: RegexPattern = re.compile(r"\*\*(.*?)\*\*")
        self.italic_pattern: RegexPattern = re.compile(r"\*(.*?)\*")
        self.inline_code_pattern: RegexPattern = re.compile(r"`([^`]+)`")
        self.link_pattern: RegexPattern = re.compile(r"\[(.*?)\]\((.*?)\)")
        self.image_pattern: RegexPattern = re.compile(r"!\[(.*?)\]\((.*?)\)")

    def _read_input(self, source: InputSource) -> str:
        """
        Validates and reads the input source.
        """
        content: str = ""
        if isinstance(source, Path) or (isinstance(source, str) and os.path.exists(source) and os.path.isfile(source)):
            file_path: Path = Path(source) if isinstance(source, str) else source
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        else:
            content = str(source)
        return content

    def _process_inline_formatting(self, text: str) -> str:
        """
        Applies inline regex substitutions for formatting.
        """
        processed_text: str = text
        processed_text = self.image_pattern.sub(r"\\begin{figure}[h]\\centering\\includegraphics[width=0.8\\linewidth]{\2}\\caption{\1}\\end{figure}", processed_text)
        processed_text = self.bold_pattern.sub(r"\\textbf{\1}", processed_text)
        processed_text = self.italic_pattern.sub(r"\\textit{\1}", processed_text)
        processed_text = self.inline_code_pattern.sub(r"\\texttt{\1}", processed_text)
        processed_text = self.link_pattern.sub(r"\\href{\2}{\1}", processed_text)
        processed_text = processed_text + "\n\n"
        return processed_text

    def _get_header_latex(self, level: int, title: str) -> str:
        """
        Maps markdown header levels to LaTeX commands.
        """
        commands: Dict[int, str] = {
            1: r"\section",
            2: r"\subsection",
            3: r"\subsubsection",
            4: r"\paragraph",
            5: r"\subparagraph",
            6: r"\textbf"
        }
        command: str = commands.get(level, r"\textbf")
        return f"{command}{{{title}}}"

    def convert(self, source: InputSource) -> TexContent:
        """
        Main conversion logic implementing a state-machine for blocks.
        """
        raw_text: str = self._read_input(source)
        lines: LineList = raw_text.split('\n')
        output_lines: LineList = []
        
        in_code_block: bool = False
        in_itemize: bool = False
        in_enumerate: bool = False

        for line in lines:
            stripped_line: str = line.strip()

            if stripped_line.startswith("```"):
                if in_code_block:
                    output_lines.append(r"\end{lstlisting}")
                    in_code_block = False
                else:
                    output_lines.append(r"\begin{lstlisting}")
                    in_code_block = True
                continue

            if in_code_block:
                output_lines.append(line)
                continue

            is_itemize: bool = stripped_line.startswith("- ") or stripped_line.startswith("* ")
            is_enumerate: bool = re.match(r"^\d+\.", stripped_line) is not None

            if in_itemize and not is_itemize and stripped_line:
                output_lines.append(r"\end{itemize}")
                in_itemize = False
            
            if in_enumerate and not is_enumerate and stripped_line:
                output_lines.append(r"\end{enumerate}")
                in_enumerate = False

            if is_itemize:
                if not in_itemize:
                    output_lines.append(r"\begin{itemize}")
                    in_itemize = True
                content: str = stripped_line[2:]
                output_lines.append(f"    \\item {self._process_inline_formatting(content)}")
                continue

            if is_enumerate:
                if not in_enumerate:
                    output_lines.append(r"\begin{enumerate}")
                    in_enumerate = True
                content_match: Optional[Match[str]] = re.match(r"^\d+\.\s+(.*)", stripped_line)
                if content_match:
                    enum_content: str = content_match.group(1)
                    output_lines.append(f"    \\item {self._process_inline_formatting(enum_content)}")
                continue

            header_match: Optional[Match[str]] = self.header_pattern.match(line)
            if header_match:
                level: int = len(header_match.group(1))
                title: str = header_match.group(2)
                output_lines.append(self._get_header_latex(level, title))
                continue

            if stripped_line == "":
                if in_itemize: 
                    output_lines.append(r"\end{itemize}")
                    in_itemize = False
                if in_enumerate:
                    output_lines.append(r"\end{enumerate}")
                    in_enumerate = False
                output_lines.append("")
                continue

            output_lines.append(self._process_inline_formatting(line))

        if in_itemize:
            output_lines.append(r"\end{itemize}")
        if in_enumerate:
            output_lines.append(r"\end{enumerate}")
        if in_code_block:
            output_lines.append(r"\end{lstlisting}")

        return "\n".join(output_lines)

def Run(input_data: InputSource) -> TexContent:
    """
    Executes the conversion process and returns LaTeX body code string.
    """
    converter: LuaLatexFragmentConverter = LuaLatexFragmentConverter()
    result: TexContent = converter.convert(input_data)
    result = f"""\\begin{{document}}

{result}

\\end{{document}}
"""
    return result

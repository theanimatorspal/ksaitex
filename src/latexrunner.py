# this file should run any latex file (input as Text Only), using the lua latex engine
import subprocess
import tempfile
import os
from pathlib import Path
from typing import Union, Optional, Tuple, List

# --- Type Aliases ---
LatexCode = str
PdfData = Optional[bytes]
CompilationResult = Tuple[int, str]

class LuaLatexCompiler:
    """
    Compiles LaTeX code fragments or full documents using the LuaLaTeX engine
    within a temporary directory to manage file output.
    """

    def __init__(self, engine_command: str = "lualatex") -> None:
        self.engine_command: str = engine_command

    def _compile_document(self, temp_dir: Path, source_path: Path) -> CompilationResult:
        """
        Executes the LuaLaTeX command in the specified directory.
        Returns the exit code and the compilation log output.
        """
        process: Optional[subprocess.CompletedProcess[str]] = None
        log_output: str = ""
        exit_code: int = -1
        
        try:
            # Command structure: lualatex -output-directory=<temp_dir> <input_file>
            command: List[str] = [
                self.engine_command,
                "-interaction=nonstopmode",
                f"-output-directory={temp_dir}",
                str(source_path)
            ]
            
            # Execute the command
            process = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=False,
                cwd=temp_dir # Set the working directory to the temp dir (redundant with -output-directory, but robust)
            )
            
            log_output = process.stdout
            exit_code = process.returncode
            
        except FileNotFoundError:
            log_output = f"Error: The LaTeX engine '{self.engine_command}' was not found. Ensure LuaLaTeX is installed and in your system PATH."
            exit_code = 127
        except Exception as e:
            log_output = f"An unexpected error occurred during compilation: {e}"
            exit_code = 1
            
        return exit_code, log_output

    def compile_latex(self, latex_code: LatexCode) -> Tuple[PdfData, str]:
        """
        Takes LaTeX code as text, compiles it, and returns the PDF binary data
        and the full compilation log.
        """
        pdf_data: PdfData = None
        log_message: str = ""
        
        # 1. Create a temporary directory structure
        with tempfile.TemporaryDirectory() as temp_dir_str:
            temp_dir: Path = Path(temp_dir_str)
            source_file_name: str = "input.tex"
            source_path: Path = temp_dir / source_file_name
            pdf_path: Path = temp_dir / "input.pdf"

            # 2. Write the input LaTeX code to the temporary .tex file
            try:
                with open(source_path, 'w', encoding='utf-8') as f:
                    f.write(latex_code)
            except IOError as e:
                log_message = f"Failed to write temporary .tex file: {e}"
                return None, log_message

            # 3. Execute compilation
            exit_code, log_output = self._compile_document(temp_dir, source_path)
            log_message = log_output
            
            if exit_code != 0:
                log_message = f"LuaLaTeX compilation failed (Exit Code: {exit_code}).\n\n{log_output}"
                return None, log_message

            # 4. Read the resulting PDF binary data
            if pdf_path.exists():
                try:
                    with open(pdf_path, 'rb') as f:
                        pdf_data = f.read()
                except IOError as e:
                    log_message += f"\nFailed to read compiled PDF file: {e}"
                    pdf_data = None
            else:
                log_message += "\nCompilation succeeded, but output PDF file was not found."
                pdf_data = None

        return pdf_data, log_message

def Run(latex_code: LatexCode) -> Tuple[PdfData, str]:
    """
    Main entry point function to compile LaTeX code using LuaLaTeX.
    Returns a tuple: (PDF binary data, compilation log/message).
    """
    compiler: LuaLatexCompiler = LuaLatexCompiler()
    return compiler.compile_latex(latex_code)

if __name__ == "__main__":
    # Ensure you have a working LuaLaTeX installation for this test to succeed.
    
    sample_latex: LatexCode = r"""
\documentclass{article}
\usepackage{fontspec} % Required for LuaLaTeX
\usepackage{luacode}
\begin{document}
\section*{Hello, LuaLaTeX!}
This document was compiled successfully using the \textbf{LuaLaTeX} engine.
\end{document}
    """
    
    print("--- Attempting Compilation ---")
    pdf_output, log = Run(sample_latex)
    
    if pdf_output:
        output_path: Path = Path("output.pdf")
        
        try:
            with open(output_path, 'wb') as f:
                f.write(pdf_output)
            print(f"\nSUCCESS: PDF file saved to {output_path.resolve()}")
        except Exception as e:
            print(f"\nSUCCESS (but could not save file): {e}")

    else:
        print("\nFAILURE: PDF could not be generated.")

    print("\n--- Compilation Log ---")
    print(log)
import asyncio
import shutil
import tempfile
from pathlib import Path
from typing import Tuple, Optional

class LatexCompiler:
    def __init__(self, build_dir: Optional[Path] = None):
        self.build_dir = build_dir

    async def compile(self, latex_content: str, output_filename: str = "main.pdf", working_dir: Optional[Path] = None) -> Tuple[Optional[bytes], str]:
        """
        Compiles LaTeX content to PDF using lualatex.
        Returns (pdf_bytes, log_output).
        """

        if not shutil.which("lualatex"):
            return None, "Error: lualatex not found in PATH."


        async def run_compilation(cwd: Path, tex_filename: str):
            tex_file = cwd / tex_filename


            with open(tex_file, "w", encoding="utf-8") as f:
                f.write(latex_content)


            cmd = ["lualatex", "-interaction=nonstopmode", "-synctex=1", str(tex_filename)]


            env = shutil.os.environ.copy()
            fonts_dir = Path("fonts").resolve()
            current_osfontdir = env.get("OSFONTDIR", "")
            env["OSFONTDIR"] = f"{fonts_dir}:{current_osfontdir}" if current_osfontdir else str(fonts_dir)

            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(cwd),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env
            )
            stdout, stderr = await process.communicate()
            log_output = stdout.decode("utf-8", errors="replace") + "\n" + stderr.decode("utf-8", errors="replace")


            pdf_name = Path(tex_filename).with_suffix('.pdf').name
            pdf_file = cwd / pdf_name
            pdf_bytes = None

            if pdf_file.exists():
                with open(pdf_file, "rb") as f:
                    pdf_bytes = f.read()


                if self.build_dir and self.build_dir != cwd:
                    self.build_dir.mkdir(parents=True, exist_ok=True)
                    target_pdf = self.build_dir / output_filename
                    with open(target_pdf, "wb") as f:
                        f.write(pdf_bytes)

            return pdf_bytes, log_output

        if working_dir:

            print(f"DEBUG: Compiling in specific directory: {working_dir.resolve()}")
            working_dir.mkdir(parents=True, exist_ok=True)
            return await run_compilation(working_dir, "main.tex")
        else:

            print("DEBUG: Compiling in temp directory")
            with tempfile.TemporaryDirectory() as temp_dir_str:
                return await run_compilation(Path(temp_dir_str), "document.tex")

async def compile_latex(latex_content: str, output_path: Optional[Path] = None, working_dir: Optional[Path] = None) -> Tuple[Optional[bytes], str]:
    build_dir = output_path.parent if output_path else None
    filename = output_path.name if output_path else "output.pdf"
    compiler = LatexCompiler(build_dir)
    return await compiler.compile(latex_content, filename, working_dir=working_dir)
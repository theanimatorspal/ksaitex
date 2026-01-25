import asyncio
import shutil
import tempfile
from pathlib import Path
from typing import Tuple, Optional

class LatexCompiler:
    def __init__(self, build_dir: Optional[Path] = None):
        self.build_dir = build_dir

    async def compile(self, latex_content: str, output_filename: str = "output.pdf") -> Tuple[Optional[bytes], str]:
        """
        Compiles LaTeX content to PDF using lualatex.
        Returns (pdf_bytes, log_output).
        """
        # Ensure lualatex is installed
        if not shutil.which("lualatex"):
            return None, "Error: lualatex not found in PATH."

        with tempfile.TemporaryDirectory() as temp_dir_str:
            temp_dir = Path(temp_dir_str)
            tex_file = temp_dir / "document.tex"
            
            # Write LaTeX content
            with open(tex_file, "w", encoding="utf-8") as f:
                f.write(latex_content)

            # Run lualatex
            # Run twice for references/page numbers if needed (usually good practice)
            # -interaction=nonstopmode prevents hanging on errors
            cmd = ["lualatex", "-interaction=nonstopmode", "-output-directory", str(temp_dir), str(tex_file)]
            
            # Prepare environment with local fonts directory
            env = shutil.os.environ.copy()
            fonts_dir = Path("fonts").resolve()
            # Append local fonts dir to OSFONTDIR (used by lualatex)
            current_osfontdir = env.get("OSFONTDIR", "")
            # Different OS separators, but colon usually works on Linux/Mac
            env["OSFONTDIR"] = f"{fonts_dir}:{current_osfontdir}" if current_osfontdir else str(fonts_dir)

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env
            )
            stdout, stderr = await process.communicate()
            log_output = stdout.decode("utf-8", errors="replace") + "\n" + stderr.decode("utf-8", errors="replace")

            pdf_file = temp_dir / "document.pdf"
            if pdf_file.exists():
                with open(pdf_file, "rb") as f:
                    pdf_bytes = f.read()
                
                # If build_dir is set, save artifacts there
                if self.build_dir:
                    self.build_dir.mkdir(parents=True, exist_ok=True)
                    target_pdf = self.build_dir / output_filename
                    with open(target_pdf, "wb") as f:
                        f.write(pdf_bytes)
                    
                return pdf_bytes, log_output
            else:
                return None, log_output

async def compile_latex(latex_content: str, output_path: Optional[Path] = None) -> Tuple[Optional[bytes], str]:
    build_dir = output_path.parent if output_path else None
    filename = output_path.name if output_path else "output.pdf"
    compiler = LatexCompiler(build_dir)
    return await compiler.compile(latex_content, filename)

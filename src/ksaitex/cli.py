import typer
import asyncio
from pathlib import Path
from typing import Optional
from ksaitex.parsing.markdown import parse
from ksaitex.templating.engine import render_latex
from ksaitex.compilation.compiler import compile_latex

app = typer.Typer(help="Ksaitex Markdown to PDF Converter")

@app.command()
def convert(
    input_file: Path = typer.Argument(..., help="Path to input Markdown file"),
    output_file: Path = typer.Option(Path("output.pdf"), "--output", "-o", help="Path to output PDF file"),
    template: str = typer.Option("DEVANAGARI", help="Template to use (LATIN or DEVANAGARI)"),
    font: str = typer.Option("Tiro Devanagari Sanskrit", help="Font family to use")
):
    """
    Convert a Markdown file to PDF.
    """
    if not input_file.exists():
        typer.echo(f"Error: File {input_file} not found.", err=True)
        raise typer.Exit(code=1)

    # 1. Read Markdown
    with open(input_file, "r", encoding="utf-8") as f:
        md_content = f.read()

    # 2. Parse Markdown to LaTeX fragments
    typer.echo("Parsing Markdown...")
    latex_fragment = parse(md_content)

    # 3. Generate Full LaTeX Document
    typer.echo("Generating LaTeX...")
    config = {
        "script": template,
        "font_file": font,
        # Detect document class or allow override? For now, default.
    }
    full_latex = render_latex(latex_fragment, config)

    # 4. Compile to PDF
    typer.echo("Compiling to PDF (this may take a moment)...")
    
    async def run_compile():
        pdf_bytes, log = await compile_latex(full_latex, output_file)
        return pdf_bytes, log

    pdf_bytes, log = asyncio.run(run_compile())

    if pdf_bytes:
        typer.echo(f"Success! PDF saved to {output_file}")
    else:
        typer.echo("Error: Compilation failed.")
        typer.echo("--- Log Output ---")
        typer.echo(log)
        raise typer.Exit(code=1)

@app.command()
def serve(
    host: str = typer.Option("127.0.0.1", help="Host to bind to"),
    port: int = typer.Option(8000, help="Port to bind to"),
    reload: bool = typer.Option(True, help="Enable auto-reload")
):
    """
    Start the web server and UI.
    """
    import uvicorn
    typer.echo(f"Starting server at http://{host}:{port}")
    uvicorn.run("ksaitex.api.main:app", host=host, port=port, reload=reload)

if __name__ == "__main__":
    app()

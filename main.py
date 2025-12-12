import src
from pathlib import Path
from src import mdtex
from src import fontdownload
from src import doctemplates
from src import latexrunner

if __name__ == "__main__":
    latex = mdtex.Run(Path("test.md"))
    final_latex = doctemplates.Run(latex, doctemplates.TemplateConfig(
        template_id="DEVANAGARI_BASE",
        fonts_directory="fonts",
        document_class="article"
    ))

    print(final_latex)
    pdf_output, log = latexrunner.Run(final_latex)

    print(log)
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
    # print(final_latex)
    
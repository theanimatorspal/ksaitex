# this file should take a string \begin{document} to \end{document} will be there, alright, just the thing is that you have to make proper templates

# templates = [
#     "TEMPLATE1" : {
#         "SCRIPT" : "DEVANAGARI",
#         "FONT" : "TiroDevanagariSanskrit" # automatically search for this ttf folder and put regular one.ttf like search for that contains tiro and devangari and sanskrit in this case (separate wrods) in the fonts/ folder filename, and then search for regular, and then use that
#         "PREAMBLE" : """ 
# THIS SHOULD be the complete PREAMBLE for that particular template
# also keep in mind that these templates do not begin \document class, 

# only things after it are just appended with this preamble text, 
# so I can and should also be able to apply template 1's title/section etc and template 2's page number, and template 3's font, so you have to keep that in mind and there can be numerous of these, you can create a config class that is going to be put in the Run() function so that it works
# """
#     }
# ]

import os
from pathlib import Path
from typing import Dict, Any, List, Optional, Union

# --- Type Aliases ---
TemplateID = str
LatexBody = str
LatexPreamble = str
LatexDocument = str

class TemplateConfig:
    """
    Configuration structure for assembling the final LaTeX document.
    """
    def __init__(self,
                 template_id: TemplateID,
                 fonts_directory: str = "fonts",
                 document_class: str = "article") -> None:
        self.template_id: TemplateID = template_id
        self.fonts_directory: Path = Path(fonts_directory)
        self.document_class: str = document_class

class LatexTemplater:
    """
    Manages template definitions and dynamic font file location.
    """

    def __init__(self) -> None:
        self.templates: Dict[TemplateID, Dict[str, str]] = {
            "DEVANAGARI_BASE": {
                "SCRIPT": "DEVANAGARI",
                "FONT": "Tiro Devanagari Sanskrit regular ttf",
                "PREAMBLE": r"""
\usepackage{fontspec}
\usepackage{polyglossia}
\setmainfont[Script=Devanagari]{%FONT_FILE_PLACEHOLDER%}
\pagestyle{plain}
"""
            },
            "STANDARD_MONO": {
                "SCRIPT": "LATIN",
                "FONT": "Source Code Pro",
                "PREAMBLE": r"""
\usepackage{fontspec}
\setmonofont[Scale=MatchLowercase]{%FONT_FILE_PLACEHOLDER%}
\pagestyle{empty}
"""
            }
        }

    def _find_font_file(self, font_name: str, fonts_dir: Path) -> Optional[str]:
        """
        Searches the fonts directory for a file matching the font_name keywords
        and prioritizing "regular" if possible.
        """
        if not fonts_dir.is_dir():
            return None

        # 1. Prepare search keywords
        # Splits font name into unique, lowercase keywords for robust searching
        keywords: List[str] = [word.lower() for word in set(font_name.split())]
        
        found_file: Optional[str] = None
        
        # 2. Search for the most specific file
        path: Path
        for path in fonts_dir.iterdir():
            file_name: str = path.name.lower()
            
            # Check if all keywords are present in the filename
            if all(k in file_name for k in keywords):
                # Prioritize files explicitly containing "regular"
                if "regular" in file_name:
                    return path.name # Found the best match, return immediately
                
                # Keep the current file as a backup if no 'regular' is found
                found_file = path.name

        return found_file

    def assemble_document(self, config: TemplateConfig, body_code: LatexBody) -> LatexDocument:
        """
        Combines the document class, selected template preamble, and body code.
        """
        template_data: Optional[Dict[str, str]] = self.templates.get(config.template_id)
        
        if template_data is None:
            raise ValueError(f"Template ID '{config.template_id}' not found.")

        # 1. Locate the font file dynamically
        font_name: str = template_data["FONT"]
        font_file: Optional[str] = self._find_font_file(font_name, config.fonts_directory)
        
        if font_file is None:
            # Fallback for compilation if the font isn't found
            print(f"WARNING: Font '{font_name}' not found in {config.fonts_directory}. Using a system font fallback.")
            font_placeholder: str = "Dejavu Sans" # A common default font
        else:
            font_placeholder = font_file

        # 2. Build Preamble
        preamble_template: str = template_data["PREAMBLE"]
        
        # Replace the placeholder in the preamble with the actual font file name/fallback
        final_preamble: str = preamble_template.replace("%FONT_FILE_PLACEHOLDER%", font_placeholder)

        # 3. Assemble the final document
        # The body is assumed to contain \begin{document} and \end{document}
        
        # Split the body to insert the preamble content correctly
        body_parts: List[str] = body_code.split(r'\begin{document}', 1)
        
        if len(body_parts) != 2:
            raise ValueError(r"Input body must contain '\begin{document}' exactly once.")
            
        document_class_line: str = f"\\documentclass{{{config.document_class}}}\n"
        
        # Assemble order: \documentclass -> Final Preamble -> \begin{document} -> Rest of Body
        full_document: str = (
            document_class_line +
            final_preamble +
            r"\begin{document}" +
            body_parts[1]
        )
        
        return full_document

def Run(latex_body: LatexBody, config: TemplateConfig) -> LatexDocument:
    """
    Main entry point to apply a configuration template to a LaTeX document body.
    """
    templater: LatexTemplater = LatexTemplater()
    result: LatexDocument = templater.assemble_document(config, latex_body)
    return result

if __name__ == "__main__":
    # --- Example Setup (Ensure you have a 'fonts' directory with some TTF files) ---
    
    # 1. Define the input body (must contain \begin{document} and \end{document})
    devanagari_body: LatexBody = r"""
\begin{document}
\section*{नमस्ते जगत्}
अहं एकः संस्कृतलेखः अस्मि।
\end{document}
"""

    # 2. Define the configuration object
    # This configuration tries to use the "DEVANAGARI_BASE" template
    # and search for a file related to "TiroDevanagariSanskrit" in the "fonts/" folder.
    devanagari_config: TemplateConfig = TemplateConfig(
        template_id="DEVANAGARI_BASE",
        fonts_directory="fonts", 
        document_class="scrartcl" # Using a KOMA-script class as an example
    )

    # 3. Run the templating engine
    try:
        final_devanagari_latex: LatexDocument = Run(devanagari_body, devanagari_config)
        print("--- Final Assembled LaTeX Document ---")
        print(final_devanagari_latex)
    except ValueError as e:
        print(f"Error: {e}")
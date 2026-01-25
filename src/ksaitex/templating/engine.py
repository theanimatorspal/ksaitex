from jinja2 import Environment, FileSystemLoader, select_autoescape
from pathlib import Path
from typing import Dict, Any

TEMPLATE_DIR = Path(__file__).parent / "latex"

class TemplateEngine:
    def __init__(self):
        self.env = Environment(
            loader=FileSystemLoader(TEMPLATE_DIR),
            variable_start_string="{{",
            variable_end_string="}}",
            block_start_string="{%",
            block_end_string="%}",
        )

    def render(self, template_name: str, context: Dict[str, Any]) -> str:
        template = self.env.get_template(template_name)
        return template.render(**context)

def render_latex(content: str, config: Dict[str, Any]) -> str:
    engine = TemplateEngine()
    # Default context
    context = {
        "document_class": "article",
        "script": "LATIN",
        "font_file": "Latin Modern Roman", # Default
        "extra_preamble": "",
        "content": content
    }
    context.update(config)
    return engine.render("base.tex", context)

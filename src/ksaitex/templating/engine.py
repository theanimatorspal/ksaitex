from jinja2 import Environment, FileSystemLoader, select_autoescape
from pathlib import Path
from typing import Dict, Any

TEMPLATE_DIR = Path(__file__).parent / "latex"

import re

class TemplateEngine:
    def __init__(self):
        self.env = Environment(
            loader=FileSystemLoader(TEMPLATE_DIR),
            variable_start_string="\\VAR{",
            variable_end_string="}",
            block_start_string="\\BLOCK{",
            block_end_string="}",
            comment_start_string="\\#{",
            comment_end_string="}",
        )

    def render(self, template_name: str, context: Dict[str, Any]) -> str:
        template = self.env.get_template(template_name)
        return template.render(**context)
    
    def get_variables(self, template_name: str) -> Dict[str, Any]:
        """
        Parses the template file for \\VAR{ name, meta... } patterns.
        Returns a dictionary of { variable_name: { default, tab, label, type, options } }.
        """
        template_path = TEMPLATE_DIR / template_name
        if not template_path.exists():
            return {}
            
        with open(template_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Regex to capture kwargs inside \VAR{...}
        # Matches: \VAR{ name, key1='val1', key2='val2' ... }
        # Strategy: Find \VAR{...} blocks, then manual parse the inside content
        block_pattern = re.compile(r"\\VAR\{\s*([^{}]+)\s*\}")
        
        variables = {}
        known_vars = {"content", "extra_preamble"}
        
        for match in block_pattern.finditer(content):
            inner = match.group(1)
            parts = [p.strip() for p in inner.split(',')]
            var_name = parts[0]
            
            if var_name in known_vars:
                continue
                
            # Initialize metadata structure
            if var_name not in variables:
                variables[var_name] = {
                    "name": var_name,
                    "default": "",
                    "tab": "General",
                    "label": var_name.replace("_", " ").title(),
                    "type": "text",
                    "options": []
                }
            
            # Parse kwargs: default='val', tab='Layout'
            # Limitation: simple string extraction, doesn't handle escaped quotes perfectly
            kwarg_pattern = re.compile(r"([a-zA-Z0-9_]+)\s*=\s*(['\"])(.*?)\2")
            
            # Python's ast.literal_eval is safer but might fail on partial strings.
            # Let's simple scan the string for key='val' patterns
            for kp in kwarg_pattern.finditer(inner):
                key = kp.group(1)
                val = kp.group(2) # quote type
                value = kp.group(3)
                
                if key == "options":
                    # Simple pipe-delimited parsing: "A|B" -> ["A", "B"]
                    variables[var_name]["options"] = [o.strip() for o in value.split("|") if o.strip()]
                    variables[var_name]["type"] = "select" # Auto-infer select type if options present
                else:
                    variables[var_name][key] = value
                    
        return variables

def render_latex(content: str, config: Dict[str, Any], template_name: str = "base.tex") -> str:
    engine = TemplateEngine()
    
    # Get defaults from template first
    template_vars = engine.get_variables(template_name)
    
    # Overlay context
    # Flatten metadata to simple key-value for Jinja rendering
    flat_defaults = { k: v["default"] for k, v in template_vars.items() }
    
    # Overlay context
    context = flat_defaults
    context.update({
        "content": content,
        "extra_preamble": ""
    })
    
    # Apply user config over defaults
    context.update(config)
    
    # Read template content
    template_path = TEMPLATE_DIR / template_name
    if not template_path.exists():
        return ""
        
    with open(template_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Preprocess: Strip metadata from \VAR{...} tags to make them valid Jinja
    # \VAR{ var, meta... } -> \VAR{ var }
    # Regex: match \VAR{ followed by capture group until }
    def strip_meta(match):
        inner = match.group(1)
        # Split by comma via regex to handle quotes safely-ish, 
        # or just take the first token? 
        # "var, default='...'" -> "var"
        parts = inner.split(',', 1)
        var_name = parts[0].strip()
        return f"\\VAR{{{var_name}}}"
    
    clean_content = re.sub(r"\\VAR\{\s*([^{}]+)\s*\}", strip_meta, content)
    
    # Render from string
    template = engine.env.from_string(clean_content)
    return template.render(**context)

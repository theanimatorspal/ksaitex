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
    
    def get_metadata(self, template_name: str) -> Dict[str, Any]:
        """
        Parses the template file for \\VAR{...} and \\MAGIC{...} patterns.
        Returns a dictionary with 'variables' and 'magic_commands'.
        Only considers lines starting with '%' (LaTeX comments).
        """
        template_path = TEMPLATE_DIR / template_name
        if not template_path.exists():
            return {"variables": {}, "magic_commands": []}
            
        with open(template_path, "r", encoding="utf-8") as f:
            full_content = f.read()

        # Extract only comment lines for metadata parsing
        metadata_lines = [l.strip() for l in full_content.splitlines() if l.strip().startswith("%")]
        metadata_content = "\n".join(metadata_lines)

        # Parse \VAR{...} - Use greedy match for inner content to allow nested braces in kwargs
        var_block_pattern = re.compile(r"\\VAR\{\s*(.*)\s*\}")
        variables = {}
        known_vars = {"content", "extra_preamble"}
        
        for match in var_block_pattern.finditer(metadata_content):
            inner = match.group(1)
            parts = [p.strip() for p in inner.split(',')]
            var_name = parts[0]
            
            if var_name in known_vars:
                continue
                
            if var_name not in variables:
                variables[var_name] = {
                    "name": var_name,
                    "default": "",
                    "tab": "General",
                    "label": var_name.replace("_", " ").title(),
                    "type": "text",
                    "options": []
                }
            
            kwarg_pattern = re.compile(r"([a-zA-Z0-9_]+)\s*=\s*(['\"])(.*?)\2")
            for kp in kwarg_pattern.finditer(inner):
                key = kp.group(1)
                value = kp.group(3)
                
                if key == "options":
                    variables[var_name]["options"] = [o.strip() for o in value.split("|") if o.strip()]
                    variables[var_name]["type"] = "select"
                else:
                    variables[var_name][key] = value

        # Parse \MAGIC{...} - Greedy inner match to handle nested LaTeX braces in command=''
        magic_block_pattern = re.compile(r"\\MAGIC\{\s*(.*)\s*\}")
        magic_commands = []
        
        for match in magic_block_pattern.finditer(metadata_content):
            inner = match.group(1)
            parts = [p.strip() for p in inner.split(',')]
            name = parts[0]
            
            cmd_info = {"name": name, "label": name.replace("_", " ").title(), "command": ""}
            
            kwarg_pattern = re.compile(r"([a-zA-Z0-9_]+)\s*=\s*(['\"])(.*?)\2")
            for kp in kwarg_pattern.finditer(inner):
                key = kp.group(1)
                value = kp.group(3)
                cmd_info[key] = value
            
            magic_commands.append(cmd_info)
                    
        return {"variables": variables, "magic_commands": magic_commands}

    def get_variables(self, template_name: str) -> Dict[str, Any]:
        """Legacy support for variables only."""
        return self.get_metadata(template_name)["variables"]

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
    
    # Apply user config over defaults, skipping empty values
    clean_config = { k: v for k, v in config.items() if v is not None and str(v).strip() != "" }
    context.update(clean_config)
    
    # Process Magic Commands replacement on content
    metadata = engine.get_metadata(template_name)
    magic_commands = metadata.get("magic_commands", [])
    
    print(f"--- DEBUG: TEMPLATE METADATA ({template_name}) ---")
    print(f"Magic Commands Found: {[c['label'] for c in magic_commands]}")
    
    for cmd in magic_commands:
        magic_string = f"[{cmd['label']}]"
        actual_command = cmd['command']
        count = context["content"].count(magic_string)
        if count > 0:
            print(f"Replacing {count} occurrences of '{magic_string}' with '{actual_command}'")
            context["content"] = context["content"].replace(magic_string, actual_command)
        else:
            print(f"No occurrences of '{magic_string}' found in content.")

    # Read template content
    template_path = TEMPLATE_DIR / template_name
    if not template_path.exists():
        return ""
        
    with open(template_path, "r", encoding="utf-8") as f:
        template_text = f.read()
        
    # Preprocess: Cleanly remove metadata DEFINITION lines
    # These are usually comments: % \VAR{ name, meta... }
    filtered_lines = []
    for line in template_text.splitlines():
        s = line.strip()
        # Skip if it's a metadata definition line
        if s.startswith("%") and ("\\VAR{" in s or "\\MAGIC{" in s) and "," in s:
            continue
        filtered_lines.append(line)
    
    clean_text = "\n".join(filtered_lines)
    
    # Preprocess: Strip metadata from remaining \VAR{...} tags (usages)
    # \VAR{ var, meta... } -> \VAR{ var }
    def strip_meta(match):
        inner = match.group(1)
        # If it's a leftover defined variable in usage position but with metadata
        parts = inner.split(',', 1)
        var_name = parts[0].strip()
        return f"\\VAR{{{var_name}}}"
    
    # Non-greedy match for usages
    clean_content = re.sub(r"\\VAR\{\s*(.+?)\s*\}", strip_meta, clean_text)
    # Ensure MAGIC tags are gone even if they weren't in comments (unlikely but safe)
    clean_content = re.sub(r"\\MAGIC\{\s*?(.+?)\s*?\}", "", clean_content)
    
    # Render from string
    template = engine.env.from_string(clean_content)
    final_output = template.render(**context)
    
    print("--- DEBUG: FINAL LATEX DOCUMENT ---")
    print(final_output)
    print("--- END DEBUG ---")
    
    return final_output

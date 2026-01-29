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
            
            # Ensure pairing and group are present if defined
            if 'pairing' not in cmd_info: cmd_info['pairing'] = None
            if 'group' not in cmd_info: cmd_info['group'] = None
            
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

    # --- VALIDATION PASS (NEW) ---
    # We scan the original content for paired markers before any substitutions
    paired_groups = {} # group -> {begin_label, end_label}
    for m_cmd in magic_commands:
        if m_cmd.get('pairing') and m_cmd.get('group'):
            g = m_cmd['group']
            if g not in paired_groups: paired_groups[g] = {}
            paired_groups[g][m_cmd['pairing']] = m_cmd['label']

    for group, pair in paired_groups.items():
        begin_label = pair.get('begin')
        end_label = pair.get('end')
        
        if begin_label and end_label:
            # Robust Marker Regex for scanning
            begin_pattern = re.compile(rf"--\[\[--\[\[--\[\[(?:#|\\#){{7}}-\[\[MAGIC:{re.escape(begin_label)}(?:\|(.*?))?\]\]-(?:#|\\#){{7}}\]\]--\]\]--\]\]--")
            end_pattern = re.compile(rf"--\[\[--\[\[--\[\[(?:#|\\#){{7}}-\[\[MAGIC:{re.escape(end_label)}(?:\|(.*?))?\]\]-(?:#|\\#){{7}}\]\]--\]\]--\]\]--")
            
            # Find all occurrences with positions
            lines = content.splitlines()
            stack = [] # Store (line_number)
            
            for line_no, line_text in enumerate(lines, 1):
                if begin_pattern.search(line_text):
                    stack.append(line_no)
                elif end_pattern.search(line_text):
                    if not stack:
                        raise ValueError(f"Error: Found '{end_label}' without a preceding '{begin_label}' at Line {line_no}.")
                    stack.pop()
            
            if stack:
                first_unclosed = stack[0]
                raise ValueError(f"Error: Found '{begin_label}' without a closing '{end_label}' starting at Line {first_unclosed}.")
    # --- END VALIDATION ---

    print(f"--- DEBUG: TEMPLATE METADATA ({template_name}) ---")
    print(f"Magic Commands Found: {[c['label'] for c in magic_commands]}")
    
    for cmd in magic_commands:
        label = cmd['label']
        # Escape label for regex in case it has special chars
        escaped_label = re.escape(label)
        
        # Robust Marker Regex: accounts for possible escaping of '#' by the markdown renderer
        # Matches both ####### and \#\#\#\#\#\#\#
        pattern = re.compile(rf"--\[\[--\[\[--\[\[(?:#|\\#){{7}}-\[\[MAGIC:{escaped_label}(?:\|(.*?))?\]\]-(?:#|\\#){{7}}\]\]--\]\]--\]\]--")
        
        # Validation Pass (NEW)
        # If this is a paired command, we should ideally check order before actual replacement.
        # But for simpler implementation, let's just count them globally for now.
        # For a truly robust system, we would scan the content and track a stack.
        
        def replacer(match):
            args_str = match.group(1) or ""
            
            # Parse provided arguments: title=Foo; author=Bar
            provided_args = {}
            if args_str:
                for pair in args_str.split(';'):
                    if '=' in pair:
                        k, v = pair.split('=', 1)
                        # Unescape \\n back to \n
                        provided_args[k.strip()] = v.strip().replace(r'\n', '\n')
            
            # Parse default arguments from metadata definition
            final_cmd = cmd['command']
            
            # 1. Apply defaults from metadata if defined
            if 'args' in cmd:
                # schema format: "title:text:Default Title|size:number:10"
                schema_items = cmd['args'].split('|')
                for item in schema_items:
                    parts = item.split(':')
                    if len(parts) >= 1:
                        var_name = parts[0].strip()
                        default_val = parts[2].strip() if len(parts) >= 3 else ""
                        
                        # Use provided value or default
                        val_to_use = provided_args.get(var_name, default_val)
                        
                        # Replace VAR_varname in the command string
                        final_cmd = final_cmd.replace(f"VAR_{var_name}", val_to_use)
            
            return final_cmd
        
        # Perform substitution
        if pattern.search(context["content"]):
            print(f"Processing magic command: {label}")
            context["content"] = pattern.sub(replacer, context["content"])

    # --- VALIDATION PASS (NEW) ---
    # Now check for any leftover markers that might indicate unclosed environments
    # or general syntax errors that were not matched by the labels in metadata.
    # Also, we can specifically check for Begin/End balance here.
    
    # Simple stack-based validation for all paired commands defined in metadata
    paired_groups = {} # group -> {begin_label, end_label}
    for cmd in magic_commands:
        if 'pairing' in cmd and 'group' in cmd:
            g = cmd['group']
            if g not in paired_groups: paired_groups[g] = {}
            paired_groups[g][cmd['pairing']] = cmd['label']

    for group, labels in paired_groups.items():
        begin_label = labels.get('begin')
        end_label = labels.get('end')
        if begin_label and end_label:
            # Re-scan content (which might have had substitutions already, 
            # but substitutions remove markers, so we should have scanned BEFORE)
            # WAIT: If we scan AFTER, we only see UNMATCHED labels if we didn't replace them?
            # No, we replaced BOTH. 
            
            # Let's re-think: We should scan the ORIGINAL content before substitution
            pass

    # Actually, let's do the validation pass at the VERY START of render_latex
    # using the original content.

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
    
    # 1. Calculate Offset
    # We render the template with a unique marker to find where the content starts
    # This accounts for any preamble lines generated by loops/conditionals
    marker = "%%%CONTENT_MARKER%%%"
    # We copy context but replace content
    offset_context = context.copy()
    offset_context["content"] = marker
    offset_output = template.render(**offset_context)
    
    offset_lines = 0
    for i, line in enumerate(offset_output.split('\n')):
        if marker in line:
            offset_lines = i
            break
            
    # 2. Final Render
    final_output = template.render(**context)
    
    print(f"--- DEBUG: TEMPLATE_OFFSET = {offset_lines}")
    print("--- DEBUG: FINAL LATEX DOCUMENT ---")
    print(final_output)
    print("--- END DEBUG ---")
    
    return final_output, offset_lines # Return offset as well

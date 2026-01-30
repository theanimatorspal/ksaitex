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
        metadata_lines = [l.strip() for l in full_content.splitlines() if l.strip().startswith("%")]
        metadata_content = "\n".join(metadata_lines)
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
            if 'pairing' not in cmd_info: cmd_info['pairing'] = None
            if 'group' not in cmd_info: cmd_info['group'] = None
            magic_commands.append(cmd_info)
        return {"variables": variables, "magic_commands": magic_commands}
    def get_variables(self, template_name: str) -> Dict[str, Any]:
        """Legacy support for variables only."""
        return self.get_metadata(template_name)["variables"]
def render_latex(content: str, config: Dict[str, Any], template_name: str = "base.tex") -> str:
    engine = TemplateEngine()
    template_vars = engine.get_variables(template_name)
    flat_defaults = { k: v["default"] for k, v in template_vars.items() }
    context = flat_defaults
    context.update({
        "content": content,
        "extra_preamble": ""
    })
    clean_config = { k: v for k, v in config.items() if v is not None and str(v).strip() != "" }
    context.update(clean_config)
    metadata = engine.get_metadata(template_name)
    magic_commands = metadata.get("magic_commands", [])
    paired_groups = {}
    for m_cmd in magic_commands:
        if m_cmd.get('pairing') and m_cmd.get('group'):
            g = m_cmd['group']
            if g not in paired_groups: paired_groups[g] = {}
            paired_groups[g][m_cmd['pairing']] = m_cmd['label']
    for group, pair in paired_groups.items():
        begin_label = pair.get('begin')
        end_label = pair.get('end')
        if begin_label and end_label:
            begin_pattern = re.compile(rf"--\[\[--\[\[--\[\[(?:#|\\#){{7}}-\[\[MAGIC:{re.escape(begin_label)}(?:\|(.*?))?\]\]-(?:#|\\#){{7}}\]\]--\]\]--\]\]--")
            end_pattern = re.compile(rf"--\[\[--\[\[--\[\[(?:#|\\#){{7}}-\[\[MAGIC:{re.escape(end_label)}(?:\|(.*?))?\]\]-(?:#|\\#){{7}}\]\]--\]\]--\]\]--")
            lines = content.splitlines()
            stack = []
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
    print(f"--- DEBUG: TEMPLATE METADATA ({template_name}) ---")
    print(f"Magic Commands Found: {[c['label'] for c in magic_commands]}")
    for cmd in magic_commands:
        label = cmd['label']
        escaped_label = re.escape(label)
        pattern = re.compile(rf"--\[\[--\[\[--\[\[(?:#|\\#){{7}}-\[\[MAGIC:{escaped_label}(?:\|(.*?))?\]\]-(?:#|\\#){{7}}\]\]--\]\]--\]\]--")
        def replacer(match):
            args_str = match.group(1) or ""
            provided_args = {}
            if args_str:
                for pair in args_str.split(';'):
                    if '=' in pair:
                        k, v = pair.split('=', 1)
                        provided_args[k.strip()] = v.strip().replace(r'\n', '\n')
            final_cmd = cmd['command']
            if 'args' in cmd:
                schema_items = cmd['args'].split('|')
                for item in schema_items:
                    parts = item.split(':')
                    if len(parts) >= 1:
                        var_name = parts[0].strip()
                        default_val = parts[2].strip() if len(parts) >= 3 else ""
                        val_to_use = provided_args.get(var_name, default_val)
                        final_cmd = final_cmd.replace(f"VAR_{var_name}", val_to_use)
            return final_cmd
        if pattern.search(context["content"]):
            print(f"Processing magic command: {label}")
            context["content"] = pattern.sub(replacer, context["content"])
    paired_groups = {}
    for cmd in magic_commands:
        if 'pairing' in cmd and 'group' in cmd:
            g = cmd['group']
            if g not in paired_groups: paired_groups[g] = {}
            paired_groups[g][cmd['pairing']] = cmd['label']
    for group, labels in paired_groups.items():
        begin_label = labels.get('begin')
        end_label = labels.get('end')
        if begin_label and end_label:
            pass
    template_path = TEMPLATE_DIR / template_name
    if not template_path.exists():
        return ""
    with open(template_path, "r", encoding="utf-8") as f:
        template_text = f.read()
    filtered_lines = []
    for line in template_text.splitlines():
        s = line.strip()
        if s.startswith("%") and ("\\VAR{" in s or "\\MAGIC{" in s) and "," in s:
            continue
        filtered_lines.append(line)
    clean_text = "\n".join(filtered_lines)
    def strip_meta(match):
        inner = match.group(1)
        parts = inner.split(',', 1)
        var_name = parts[0].strip()
        return f"\\VAR{{{var_name}}}"
    clean_content = re.sub(r"\\VAR\{\s*(.+?)\s*\}", strip_meta, clean_text)
    clean_content = re.sub(r"\\MAGIC\{\s*?(.+?)\s*?\}", "", clean_content)
    template = engine.env.from_string(clean_content)
    marker = "%%%CONTENT_MARKER%%%"
    offset_context = context.copy()
    offset_context["content"] = marker
    offset_output = template.render(**offset_context)
    offset_lines = 0
    for i, line in enumerate(offset_output.split('\n')):
        if marker in line:
            offset_lines = i
            break
    final_output = template.render(**context)
    print(f"--- DEBUG: TEMPLATE_OFFSET = {offset_lines}")
    print("--- DEBUG: FINAL LATEX DOCUMENT ---")
    print(final_output)
    print("--- END DEBUG ---")
    return final_output, offset_lines
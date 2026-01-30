import os
import re
import tokenize
import io
from pathlib import Path

def strip_python_comments(content):
    result = []
    g = tokenize.generate_tokens(io.StringIO(content).readline)
    last_lineno = -1
    last_col = 0
    
    for toktype, tokval, (srow, scol), (erow, ecol), line in g:
        if toktype == tokenize.COMMENT:
            continue
        
        # We try to preserve whitespace by checking start col vs last end col
        # but for a "strictly typed/clean" look, we just care about the tokens.
        # Actually, simpler to just filter tokens and use untokenize, 
        # but untokenize is messy.
        pass

    # Simpler regex approach for hashtag comments that are NOT in strings
    # (Handling strings properly in regex is hard, so we'll use a better one-liner logic 
    # but in Python)
    out = []
    # Regex to catch hashtag comments not inside quotes
    # This is a classic "ignore strings then find #" pattern
    pattern = r'(\"(?:\\.|[^\"\\])*\"|\'(?:\\.|[^\'\\])*\'|#.*)'
    
    for line in content.splitlines():
        def replace(match):
            m = match.group(0)
            if m.startswith('#'):
                return ""
            return m
        cleaned = re.sub(pattern, replace, line)
        out.append(cleaned.rstrip())
    
    return "\n".join(out)

def strip_js_comments(content):
    # Strip /* */ and //
    # Avoid stripping // inside strings/urls
    # Pattern: Strings | Block Comments | Single-Line Comments
    pattern = r'(\"(?:\\.|[^\"\\])*\"|\'(?:\\.|[^\'\\])*\'|`[\s\S]*?`|/\*[\s\S]*?\*/|(?<!:)\/\/.*)'
    
    def replace(match):
        m = match.group(0)
        if m.startswith('/') or m.startswith('/*'):
            return ""
        return m
    
    return re.sub(pattern, replace, content)

def collapse_lines(content):
    # Max two line gaps == max two consecutive newlines? 
    # Or max two empty lines between code (3 newlines)?
    # "No line gaps more than two" -> max 2 empty lines.
    # We'll use a regex for 3 or more newlines.
    return re.sub(r'\n{4,}', '\n\n\n', content)

def process_file(path):
    print(f"Processing {path}...")
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if path.suffix == '.py':
        content = strip_python_comments(content)
    elif path.suffix == '.js':
        content = strip_js_comments(content)
        
    content = collapse_lines(content)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def main():
    root = Path(".")
    targets = list(root.glob("src/**/*.py")) + list(root.glob("ui/**/*.js"))
    for t in targets:
        if "__init__" in t.name: continue # Skip init
        process_file(t)

if __name__ == "__main__":
    main()

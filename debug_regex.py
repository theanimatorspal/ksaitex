import re

content = r"\VAR{ script, default='DEVANAGARI', tab='Script & Language', label='Script System', type='select', options='[\'DEVANAGARI\', \'LATIN\']' }"

print(f"Content: {content}")

block_pattern = re.compile(r"\\VAR\{\s*([^{}]+)\s*\}")
kwarg_pattern = re.compile(r"([a-zA-Z0-9_]+)\s*=\s*(['\"])(.*?)\2")

for match in block_pattern.finditer(content):
    inner = match.group(1)
    print(f"Inner: {inner}")
    
    for kp in kwarg_pattern.finditer(inner):
        key = kp.group(1)
        val = kp.group(3)
        print(f"Key: {key}, Value: {val}")

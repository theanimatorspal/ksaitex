from fastapi import FastAPI, HTTPException
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pathlib import Path
from ksaitex.parsing.markdown import parse
from ksaitex.templating.engine import render_latex
from ksaitex.compilation.compiler import compile_latex

app = FastAPI()

from fastapi import Request
@app.middleware("http")
async def disable_cache(request: Request, call_next):
    # Deeply strip conditional headers from the ASGI scope to force 200 OK
    new_headers = []
    for name, value in request.scope.get("headers", []):
        if name.lower() not in (b"if-none-match", b"if-modified-since"):
            new_headers.append((name, value))
    request.scope["headers"] = new_headers
    
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# Mount API routes
class CompileRequest(BaseModel):
    markdown: str
    template: str = "base"
    variables: dict = {}
    title: str = "Untitled Project" # Added title

class SaveRequest(BaseModel):
    title: str
    markdown: str
    html: str = ""  # New field for persistence
    template: str = "base"
    variables: dict = {}

class RenameRequest(BaseModel):
    old_id: str
    new_title: str

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

@app.get("/api/templates")
async def list_templates():
    """List available .tex templates and their variable defaults."""
    from ksaitex.templating.engine import TEMPLATE_DIR, TemplateEngine
    engine = TemplateEngine()
    
    templates_data = {}
    if TEMPLATE_DIR.exists():
        for f in TEMPLATE_DIR.glob("*.tex"):
             name = f.stem
             metadata = engine.get_metadata(f.name)
             templates_data[name] = metadata
             
    return {"templates": templates_data}

class SyncRequest(BaseModel):
    project_id: str
    line: int
    column: int = 1

@app.post("/api/compile")
async def compile_endpoint(request: CompileRequest):
    import re
    import json
    
    print(f"DEBUG: Endpoint received title: '{request.title}'") # Log received title
    # 1. Determine Project Directory
    safe_title = re.sub(r'[^\w\s-]', '', request.title).strip().replace(' ', '_')
    if not safe_title: safe_title = "unnamed_project"
    
    project_dir = DATA_DIR / safe_title
    project_dir.mkdir(parents=True, exist_ok=True) # Ensure dir exists

    # 2. Parse (Now returns tuple)
    try:
        latex_fragment, source_map = parse(request.markdown)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Parsing error: {str(e)}")

    # 3. Template (Now returns tuple)
    try:
        template_filename = f"{request.template}.tex"
        # Combine variables
        config = request.variables.copy()
        
        full_latex, offset = render_latex(latex_fragment, config, template_name=template_filename)
        
        # Adjust mapping
        final_map = {}
        for md_line, tex_line in source_map.items():
             final_map[str(md_line)] = tex_line + offset
        
        # Save mapping
        with open(project_dir / "source_map.json", "w") as f:
            json.dump(final_map, f)
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Templating error: {str(e)}")

    # 4. Compile in Project Directory
    # Ensure source file name is consistent 'main.tex' so synctex works predictably
    
    # We need to ensure compile_latex writes to 'main.tex'
    # The default output_filename passed to compile is "main.pdf"
    # Inside compile_latex -> LatexCompiler.compile -> writes to tex_filename derived from output_filename?
    # No, compile takes (latex_content, output_filename).
    # Inside compile: pdf_name = output_filename.
    # tex_name = pdf_name.with_suffix('.tex').
    
    # We pass filename="main.pdf" by default in compile_latex if output_path is None?
    # No, await compiler.compile(..., filename, ...)
    # Let's check compiler.py logic again.
    # compile() takes `output_filename` as 2nd arg.
    # It writes to `tex_filename`? No internal logic: `pdf_name = Path(tex_filename).with_suffix('.pdf').name`
    # Wait, compiled function signature: `async def compile(self, latex_content: str, output_filename: str = "main.pdf", working_dir: Optional[Path] = None)`
    # Inside: `tex_filename = Path(output_filename).with_suffix(".tex").name` NO, checking compiler.py content:
    # `async def run_compilation(cwd: Path, tex_filename: str):`
    # It calls run_compilation with "main.tex" if working_dir is set?
    # Line 71: `return await run_compilation(working_dir, "main.tex")`
    # So it ALWAYS uses main.tex if working_dir is provided. Good.

    pdf_bytes, log = await compile_latex(full_latex, working_dir=project_dir)

    if not pdf_bytes:
        # Return log as error detail
        raise HTTPException(status_code=500, detail=f"Compilation failed:\n{log}")

    return Response(content=pdf_bytes, media_type="application/pdf")

@app.post("/api/sync")
async def sync_position(request: SyncRequest):
    """
    Given a markdown line number, return the corresponding PDF page and line (approx).
    Uses synctex.
    """
    import json
    import subprocess
    import shutil
    
    project_dir = DATA_DIR / request.project_id
    if not project_dir.exists():
        raise HTTPException(status_code=404, detail="Project not found")

    map_file = project_dir / "source_map.json"
    if not map_file.exists():
        return {"status": "no_map"} # No mapping available yet

    try:
        with open(map_file, "r") as f:
            mapping = json.load(f)
    except:
        return {"status": "error", "detail": "Invalid map file"}

    # Find closest known line
    # Mapping keys are strings "10", "15" etc.
    # Find key <= request.line
    
    target_tex_line = None
    
    # Convert keys to int
    int_map = {int(k): v for k, v in mapping.items()}
    sorted_keys = sorted(int_map.keys())
    
    # Simple binary search or scan for closest preceding line
    closest_md = -1
    for k in sorted_keys:
        if k <= request.line:
            closest_md = k
        else:
            break
            
    if closest_md != -1:
        target_tex_line = int_map[closest_md]
    else:
        # If before first mapped line, try first
        if sorted_keys:
            target_tex_line = int_map[sorted_keys[0]]
    
    if target_tex_line is None:
        return {"status": "no_match"}

    # Run synctex view
    # synctex view -i <line>:<col>:<file> -o <pdf>
    # file should be relative or absolute? synctex is picky.
    # Because we compile in project_dir, 'main.tex' is the file.
    # PDF is 'main.pdf'.
    
    # Check if synctex tool exists
    if not shutil.which("synctex"):
        return {"status": "error", "detail": "synctex tool not found"}

    try:
        cmd = ["synctex", "view", "-i", f"{target_tex_line}:1:main.tex", "-o", "main.pdf"]
        # Exec in project dir
        result = subprocess.run(cmd, cwd=str(project_dir), capture_output=True, text=True)
        
        # Parse output
        # Output format:
        # This is SyncTeX command line utility, version 1.5
        # Page:1
        # x:172.936081
        # y:679.167847
        # h:100.957016
        # v:679.167847
        # W:364.195312
        # H:10.909912
        # ...
        
        output = result.stdout
        page = None
        
        for line in output.splitlines():
            if line.startswith("Page:"):
                page = int(line.split(":")[1])
                break
        
        if page:
             return {"status": "success", "page": page, "tex_line": target_tex_line}
        else:
             return {"status": "no_synctex_match", "detail": output}

    except Exception as e:
        return {"status": "error", "detail": str(e)}

class ReverseSyncRequest(BaseModel):
    project_id: str
    page: int

@app.post("/api/sync/reverse")
async def reverse_sync_position(request: ReverseSyncRequest):
    """
    Given a PDF page number, return the corresponding Markdown line number (approx).
    Uses synctex edit.
    """
    import json
    import subprocess
    import shutil
    
    project_dir = DATA_DIR / request.project_id
    if not project_dir.exists():
        raise HTTPException(status_code=404, detail="Project not found")

    map_file = project_dir / "source_map.json"
    if not map_file.exists():
        return {"status": "no_map"}

    try:
        with open(map_file, "r") as f:
            mapping = json.load(f)
    except:
        return {"status": "error", "detail": "Invalid map file"}

    # Run synctex edit
    # synctex edit -o <page>:50:50:main.pdf
    # This asks "where in the source is the content at (50,50) on this page?"
    # We use (50,50) generic offset to catch something near the top.
    
    if not shutil.which("synctex"):
        return {"status": "error", "detail": "synctex tool not found"}

    try:
        # synctex edit -o page:x:y:file
        # Note: synctex edit output is different from view.
        # It usually outputs:
        # Line:42
        # Column:0
        # Input:/path/to/main.tex
        
        cmd = ["synctex", "edit", "-o", f"{request.page}:100:100:main.pdf"]
        result = subprocess.run(cmd, cwd=str(project_dir), capture_output=True, text=True)
        
        output = result.stdout
        tex_line = None
        
        for line in output.splitlines():
            if line.startswith("Line:"):
                tex_line = int(line.split(":")[1])
                break
        
        if tex_line is None:
             return {"status": "no_synctex_match", "detail": output}
             
        # Map TeX Line -> MD Line
        # Mapping is MD -> TeX. We need to invert it or search it.
        # Inversion might be ambiguous (multiple MD lines map to same TeX block), 
        # but we want the *first* MD line that maps to/near this TeX line.
        
        # Create inverted map: TeX -> MD (keep minimum MD for each TeX)
        tex_to_md = {}
        for md_line_str, tex_line_val in mapping.items():
            md_line = int(md_line_str)
            current = tex_to_md.get(tex_line_val, float('inf'))
            if md_line < current:
                tex_to_md[tex_line_val] = md_line
                
        # Find closest MD line
        # We look for a TeX line <= our target
        sorted_tex = sorted(tex_to_md.keys())
        found_md = None
        
        # If exact match
        if tex_line in tex_to_md:
            found_md = tex_to_md[tex_line]
        else:
            # Find closest preceding
            closest_tex = -1
            for t in sorted_tex:
                if t <= tex_line:
                    closest_tex = t
                else:
                    break
            
            if closest_tex != -1:
                found_md = tex_to_md[closest_tex]
            else:
                 # If target is before any mapped line, return first mapped
                 if sorted_tex:
                     found_md = tex_to_md[sorted_tex[0]]

        if found_md is not None:
            return {"status": "success", "line": found_md, "tex_line": tex_line}
        else:
            return {"status": "no_map_match", "tex_line": tex_line}

    except Exception as e:
        return {"status": "error", "detail": str(e)}

@app.post("/api/save")
async def save_project(request: SaveRequest):
    """Save project data to data/{title}/project.json"""
    import json
    import re
    
    # Sanitize title for directory name
    safe_title = re.sub(r'[^\w\s-]', '', request.title).strip().replace(' ', '_')
    if not safe_title:
        safe_title = "unnamed_project"
    
    project_dir = DATA_DIR / safe_title
    project_dir.mkdir(parents=True, exist_ok=True)
    
    project_file = project_dir / "project.json"
    with open(project_file, "w") as f:
        json.dump({
            "title": request.title,
            "markdown": request.markdown,
            "html": request.html, # Persist HTML
            "template": request.template,
            "variables": request.variables
        }, f, indent=4)
    
    print(f"DEBUG: Saved project '{request.title}' to {project_file}")
    return {"status": "success", "path": str(project_file)}

@app.post("/api/rename")
async def rename_project(request: RenameRequest):
    """Rename a project by moving its directory."""
    import re
    import shutil
    import json

    old_path = DATA_DIR / request.old_id
    if not old_path.exists():
        raise HTTPException(status_code=404, detail="Project not found")

    safe_new_title = re.sub(r'[^\w\s-]', '', request.new_title).strip().replace(' ', '_')
    if not safe_new_title:
        raise HTTPException(status_code=400, detail="Invalid title")
        
    new_path = DATA_DIR / safe_new_title
    
    if new_path.exists() and new_path != old_path:
         raise HTTPException(status_code=400, detail="Project with this name already exists")

    if new_path != old_path:
        shutil.move(str(old_path), str(new_path))

    # Update the internal JSON with new title
    project_file = new_path / "project.json"
    if project_file.exists():
        with open(project_file, "r") as f:
            data = json.load(f)
        
        data["title"] = request.new_title
        
        with open(project_file, "w") as f:
            json.dump(data, f, indent=4)

    return {"status": "success", "new_id": safe_new_title}

@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete a project directory."""
    import shutil
    project_dir = DATA_DIR / project_id
    if not project_dir.exists():
        raise HTTPException(status_code=404, detail="Project not found")
        
    shutil.rmtree(project_dir)
    return {"status": "success"}

@app.get("/api/projects")
async def list_projects():
    """List all saved projects."""
    projects = []
    if DATA_DIR.exists():
        for d in DATA_DIR.iterdir():
            if d.is_dir():
                project_file = d / "project.json"
                if project_file.exists():
                    import json
                    try:
                        with open(project_file, "r") as f:
                            data = json.load(f)
                            projects.append({"title": data.get("title", d.name), "id": d.name})
                    except:
                        pass
    return {"projects": projects}

@app.get("/api/projects/{project_id}")
async def get_project(project_id: str):
    """Get content of a specific project."""
    import json
    project_file = DATA_DIR / project_id / "project.json"
    if not project_file.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    
    with open(project_file, "r") as f:
        return json.load(f)

# Mount Static Files (Frontend)
# We mount this at the root so visiting / serves index.html
# Ensure 'ui' directory exists relative to execution or absolute
UI_DIR = Path("ui")
if UI_DIR.exists():
    app.mount("/", StaticFiles(directory=UI_DIR, html=True), name="ui")
else:
    print("Warning: 'ui' directory not found. Frontend will not be served.")

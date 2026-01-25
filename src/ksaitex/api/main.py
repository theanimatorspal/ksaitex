from fastapi import FastAPI, HTTPException
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pathlib import Path
from ksaitex.parsing.markdown import parse
from ksaitex.templating.engine import render_latex
from ksaitex.compilation.compiler import compile_latex

app = FastAPI()

# Mount API routes
class CompileRequest(BaseModel):
    markdown: str
    template: str = "base"
    variables: dict = {}

class SaveRequest(BaseModel):
    title: str
    markdown: str
    template: str = "base"
    variables: dict = {}

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
             
    # Return as list for easier frontend consumption, or dict? 
    # Let's return dict { "template_name": { "var1": "default" } }
    return {"templates": templates_data}

@app.post("/api/compile")
async def compile_endpoint(request: CompileRequest):
    # 1. Parse
    try:
        latex_fragment = parse(request.markdown)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Parsing error: {str(e)}")

    # 2. Template
    try:
        template_filename = f"{request.template}.tex"
        # Combine variables
        config = request.variables.copy()
        
        full_latex = render_latex(latex_fragment, config, template_name=template_filename)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Templating error: {str(e)}")

    # 3. Compile
    pdf_bytes, log = await compile_latex(full_latex)

    if not pdf_bytes:
        # Return log as error detail
        raise HTTPException(status_code=500, detail=f"Compilation failed:\n{log}")

    return Response(content=pdf_bytes, media_type="application/pdf")

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
            "template": request.template,
            "variables": request.variables
        }, f, indent=4)
    
    print(f"DEBUG: Saved project '{request.title}' to {project_file}")
    return {"status": "success", "path": str(project_file)}

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

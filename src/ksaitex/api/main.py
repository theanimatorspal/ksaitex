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

@app.get("/api/templates")
async def list_templates():
    """List available .tex templates and their variable defaults."""
    from ksaitex.templating.engine import TEMPLATE_DIR, TemplateEngine
    engine = TemplateEngine()
    
    templates_data = {}
    if TEMPLATE_DIR.exists():
        for f in TEMPLATE_DIR.glob("*.tex"):
             name = f.stem
             # Parse variables for this template
             # We append .tex because get_variables expects filename
             vars = engine.get_variables(f.name)
             templates_data[name] = vars
             
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

# Mount Static Files (Frontend)
# We mount this at the root so visiting / serves index.html
# Ensure 'ui' directory exists relative to execution or absolute
UI_DIR = Path("ui")
if UI_DIR.exists():
    app.mount("/", StaticFiles(directory=UI_DIR, html=True), name="ui")
else:
    print("Warning: 'ui' directory not found. Frontend will not be served.")

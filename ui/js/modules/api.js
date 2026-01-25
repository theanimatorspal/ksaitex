/**
 * Handles all backend communication.
 */

export async function fetchTemplates() {
    try {
        const res = await fetch('/api/templates');
        const data = await res.json();
        return data.templates;
    } catch (e) {
        console.error("Failed to fetch templates", e);
        throw e;
    }
}

export async function compileLatex(markdown, template, variables) {
    const response = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            markdown,
            template,
            variables
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Compilation failed");
    }

    return await response.blob();
}

export async function saveProject(title, markdown, template, variables) {
    const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, markdown, template, variables })
    });
    return await res.json();
}

export async function fetchProjects() {
    const res = await fetch('/api/projects');
    const data = await res.json();
    return data.projects;
}

export async function fetchProject(id) {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) throw new Error("Project not found");
    return await res.json();
}

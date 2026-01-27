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

export async function compileLatex(markdown, template, variables, title) {
    const response = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            markdown,
            template,
            variables,
            title
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Compilation failed");
    }

    return await response.blob();
}

export async function saveProject(title, markdown, template, variables, html = "") {
    const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, markdown, template, variables, html })
    });
    return await res.json();
}

export async function renameProject(old_id, new_title) {
    const res = await fetch('/api/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_id, new_title })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Rename failed");
    }
    return await res.json();
}

export async function deleteProject(id) {
    const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error("Delete failed");
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

export async function syncPosition(project_id, line) {
    const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id, line })
    });
    return await res.json();
}

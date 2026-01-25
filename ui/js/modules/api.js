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

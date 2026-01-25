const convertBtn = document.getElementById('convertBtn');
const markdownInput = document.getElementById('markdownInput');
const templateSelect = document.getElementById('templateSelect');
const fontInput = document.getElementById('fontInput');
const pdfPreview = document.getElementById('pdfPreview');
const loading = document.getElementById('loading');
const errorLog = document.getElementById('errorLog');

convertBtn.addEventListener('click', async () => {
    const markdown = markdownInput.value;
    if (!markdown) return;

    // UI Updates
    convertBtn.disabled = true;
    loading.classList.remove('hidden');
    errorLog.classList.add('hidden');
    pdfPreview.classList.add('hidden');

    try {
        const response = await fetch('/api/compile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                markdown: markdown,
                template: templateSelect.value,
                font: fontInput.value
            })
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            pdfPreview.src = url;
            pdfPreview.classList.remove('hidden');
        } else {
            const errorText = await response.json();
            errorLog.textContent = errorText.detail || "Unknown error occurred";
            errorLog.classList.remove('hidden');
        }
    } catch (error) {
        errorLog.textContent = "Network error: " + error.message;
        errorLog.classList.remove('hidden');
    } finally {
        convertBtn.disabled = false;
        loading.classList.add('hidden');
    }
});

// Initial placeholder text
markdownInput.value = `# My Document

This is a test document.

- Item 1
- Item 2

**Bold Text** and *Italic Text*
`;


# Verification Plan - Upload Functionality

## 1. Verify UI Elements
- Check if `#uploadChoiceModal` exists in DOM.
- Check if buttons have correct IDs and listeners.

## 2. Verify File Reading
- Mock `FileReader` and trigger `change` event on `mdUploadInput`.
- Ensure `pendingUploadContent` is set.
- Ensure modal is shown.

## 3. Verify Replace Flow
- Mock `currentProjectId` = "test".
- Click "Replace".
- Ensure `editor.loadContent` is called with new content.
- Ensure `autoSave` is triggered.

## 4. Verify New Project Flow
- Click "Create New".
- Ensure `newProjectTitleInput` is set to filename.
- Click "Create" in new project modal.
- Ensure `resetProject` is called with content.

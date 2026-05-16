/**
 * fileSystem.js
 * All import / export functionality (single file, folder, ZIP).
 */

import JSZip from 'jszip';
import * as state from './state.js';
import * as dom from './dom.js';
import { escapeRegExp } from './utils.js';
import { closeMenuDropdownUI, updatePreview, renderUI } from './ui.js';
import { get } from './registry.js';

// ─── Save to file ────────────────────────────────────────────────────────────

/**
 * Downloads the active note as a .md file.
 */
export function saveNote() {
    if (!state.activeNoteId) { alert('Please select a note to save.'); return; }
    const findNoteById = get('findNoteById');
    const setUnsavedChanges = get('setUnsavedChanges');
    const saveStateToLocalStorage = get('saveStateToLocalStorage');

    const note = findNoteById(state.activeNoteId);
    if (!note) return;
    note.content = dom.editor.value;
    note.updatedAt = Date.now();

    let filename = note.name;
    if (!/\.(md|txt)$/i.test(filename)) filename += '.md';

    const blob = new Blob([note.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);

    setUnsavedChanges(false);
    closeMenuDropdownUI();
    saveStateToLocalStorage();
}

// ─── Import files ────────────────────────────────────────────────────────────

export function importFiles() {
    dom.fileInput.value = null;
    dom.fileInput.setAttribute('multiple', '');
    dom.fileInput.click();
    closeMenuDropdownUI();
}

export function openSingleFile() {
    dom.fileInput.removeAttribute('multiple');
    dom.fileInput.value = null;
    dom.fileInput.click();
    closeMenuDropdownUI();
}

/**
 * Handles the hidden <input type="file"> change event.
 * @param {Event} event
 */
export function handleFileOpen(event) {
    const addNote = get('addNote');
    const findNoteById = get('findNoteById');
    const switchTab = get('switchTab');
    const saveStateToLocalStorage = get('saveStateToLocalStorage');
    const setUnsavedChanges = get('setUnsavedChanges');

    const files = event.target.files;
    if (!files || files.length === 0) {
        dom.fileInput.setAttribute('multiple', '');
        return;
    }
    state.setFirstAddedNoteIdDuringImport(null);
    let notesProcessed = 0;
    setUnsavedChanges(true);

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        const fileCreationTime = file.lastModified;
        reader.onload = (e) => {
            const content = e.target.result;
            const name = file.name;
            const existingNote = state.notes.find(n => n.name === name);
            let addedNoteId = null;

            if (existingNote) {
                if (files.length === 1 && confirm(`A note named "${name}" is already open. Replace its content?\n(Cancel to import as copy)`)) {
                    existingNote.content = content;
                    existingNote.updatedAt = fileCreationTime || Date.now();
                    if (existingNote.id === state.activeNoteId) {
                        dom.editor.value = content;
                        updatePreview();
                    } else {
                        renderUI();
                    }
                } else {
                    addedNoteId = addNote(name.replace(/(\.[^.]*)?$/i, ' (copy)$1'), content);
                    const newNote = findNoteById(addedNoteId);
                    if (newNote) { newNote.createdAt = fileCreationTime || newNote.createdAt; newNote.updatedAt = fileCreationTime || newNote.updatedAt; }
                }
            } else {
                addedNoteId = addNote(name, content);
                const newNote = findNoteById(addedNoteId);
                if (newNote) { newNote.createdAt = fileCreationTime || newNote.createdAt; newNote.updatedAt = fileCreationTime || newNote.updatedAt; }
            }

            if (addedNoteId !== null && state.firstAddedNoteIdDuringImport === null) {
                state.setFirstAddedNoteIdDuringImport(addedNoteId);
            }
            notesProcessed++;
            if (notesProcessed === files.length) {
                if (state.firstAddedNoteIdDuringImport !== null && findNoteById(state.firstAddedNoteIdDuringImport)) {
                    switchTab(state.firstAddedNoteIdDuringImport);
                } else {
                    renderUI();
                    saveStateToLocalStorage();
                }
            }
        };
        reader.onerror = () => {
            console.error('Error reading file:', file.name);
            alert('Error reading file: ' + file.name);
            notesProcessed++;
            if (notesProcessed === files.length) { renderUI(); saveStateToLocalStorage(); }
        };
        reader.readAsText(file);
    });
    dom.fileInput.setAttribute('multiple', '');
}

// ─── Import folder ────────────────────────────────────────────────────────────

async function processDirectory(directoryHandle) {
    const addNote = get('addNote');
    const findNoteById = get('findNoteById');
    try {
        for await (const entry of directoryHandle.values()) {
            if (entry.kind === 'file' && /\.(md|txt)$/i.test(entry.name)) {
                try {
                    const fileHandle = await entry.getFile();
                    const content = await fileHandle.text();
                    const name = entry.name;
                    const fileCreationTime = fileHandle.lastModified;
                    const existingNote = state.notes.find(n => n.name === name);
                    let addedNoteId;
                    if (existingNote) {
                        addedNoteId = addNote(name.replace(/(\.[^.]*)?$/i, ' (copy)$1'), content);
                    } else {
                        addedNoteId = addNote(name, content);
                    }
                    if (addedNoteId) {
                        const newNote = findNoteById(addedNoteId);
                        if (newNote) { newNote.createdAt = fileCreationTime || newNote.createdAt; newNote.updatedAt = fileCreationTime || newNote.updatedAt; }
                    }
                    if (addedNoteId !== null && state.firstAddedNoteIdDuringImport === null) {
                        state.setFirstAddedNoteIdDuringImport(addedNoteId);
                    }
                } catch (fileError) {
                    console.error(`Error reading file ${entry.name}:`, fileError);
                }
            } else if (entry.kind === 'directory') {
                await processDirectory(entry);
            }
        }
    } catch (dirError) {
        console.error(`Error reading directory ${directoryHandle.name}:`, dirError);
        alert(`Could not read directory: ${directoryHandle.name}\n${dirError.message}`);
    }
}

export async function importFolder() {
    closeMenuDropdownUI();
    if (typeof window.showDirectoryPicker !== 'function') {
        alert('Folder import is not supported by your browser. Please try Chrome or Edge.');
        return;
    }
    try {
        const directoryHandle = await window.showDirectoryPicker();
        if (!directoryHandle) return;
        state.setFirstAddedNoteIdDuringImport(null);
        const setUnsavedChanges = get('setUnsavedChanges');
        const switchTab = get('switchTab');
        const findNoteById = get('findNoteById');
        const saveStateToLocalStorage = get('saveStateToLocalStorage');
        setUnsavedChanges(true);
        await processDirectory(directoryHandle);
        if (state.firstAddedNoteIdDuringImport !== null && findNoteById(state.firstAddedNoteIdDuringImport)) {
            switchTab(state.firstAddedNoteIdDuringImport);
        } else {
            renderUI();
            saveStateToLocalStorage();
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Error importing folder:', err);
            alert(`Error importing folder: ${err.message}`);
        }
    }
}

// ─── Export ZIP ───────────────────────────────────────────────────────────────

export function exportAllNotes() {
    if (state.notes.length === 0) { alert('No notes to export.'); return; }
    closeMenuDropdownUI();
    const findNoteById = get('findNoteById');
    const currentNote = findNoteById(state.activeNoteId);
    if (currentNote) currentNote.content = dom.editor.value;

    const zip = new JSZip();
    const nameCounts = {};
    state.notes.forEach(note => {
        let filename = note.name;
        if (!/\.(md|txt)$/i.test(filename)) filename += '.md';
        const baseName  = filename.replace(/\.(md|txt)$/i, '');
        const extension = (filename.match(/\.(md|txt)$/i) || ['.md'])[0];
        let counter = nameCounts[filename] || 0;
        let uniqueFilename = filename;
        while (zip.file(uniqueFilename)) { counter++; uniqueFilename = `${baseName} (${counter})${extension}`; }
        nameCounts[filename] = counter;
        zip.file(uniqueFilename, note.content, { date: new Date(note.updatedAt || Date.now()) });
    });

    zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
        .then(content => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = 'markdown_notes.zip';
            document.body.appendChild(link); link.click();
            document.body.removeChild(link); URL.revokeObjectURL(link.href);
        })
        .catch(err => { console.error('Error generating zip:', err); alert('Error creating zip archive: ' + err.message); });
}

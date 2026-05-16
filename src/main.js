import './style.css';
import { marked } from 'marked';
import * as state from './state.js';
import * as dom from './dom.js';
import { sortNotes, escapeRegExp, debounce } from './utils.js';
import {
    renderUI, renderSidebarNoteList, renderSidebarVirtualWindow,
    updatePreview, updateStatusBar, applyTheme,
    showFindReplaceBar, hideFindReplaceBar,
    closeSearchResultsUI, toggleMenuDropdownUI, closeMenuDropdownUI,
    updateFindMatchCountUI, extractAndRenderTags
} from './ui.js';
import {
    saveNote, importFiles, openSingleFile, handleFileOpen,
    importFolder, exportAllNotes
} from './fileSystem.js';

marked.setOptions({ breaks: true, gfm: true, pedantic: false, smartLists: true, smartypants: false });

// ── Exported helpers (used by fileSystem.js via dynamic import) ──
export function findNoteById(id) { return state.notes.find(n => n.id === Number(id)); }
export function findNoteIndexById(id) { return state.notes.findIndex(n => n.id === Number(id)); }

export function setUnsavedChanges(hasUnsaved, updateTimestamp = true) {
    state.setUnsavedChangesState(hasUnsaved);
    if (hasUnsaved && updateTimestamp && state.activeNoteId) {
        const note = findNoteById(state.activeNoteId);
        if (note && (!note.updatedAt || Date.now() - note.updatedAt > 500)) note.updatedAt = Date.now();
    }
}

export { renderUI, renderSidebarNoteList };

// ── localStorage ──────────────────────────────────────────────────────────────
const LS_KEY = 'browserMarkdownEditorState_v5';

export function saveStateToLocalStorage() {
    const currentNote = findNoteById(state.activeNoteId);
    if (currentNote && dom.editor.value !== currentNote.content) currentNote.content = dom.editor.value;
    try {
        localStorage.setItem(LS_KEY, JSON.stringify({
            notes: state.notes,
            activeNoteId: state.activeNoteId,
            isSidebarCollapsed: state.isSidebarCollapsed,
            untitledCounter: state.untitledCounter,
            editorPanePercent: parseFloat(dom.editorContainer.style.flexBasis) || 50,
            currentSortOrder: state.currentSortOrder,
            currentTheme: state.currentTheme,
        }));
    } catch (e) { console.error('Error saving state:', e); }
}

function loadStateFromLocalStorage() {
    try {
        const saved = localStorage.getItem(LS_KEY);
        if (saved) {
            const s = JSON.parse(saved);
            state.setNotes((s.notes || []).map(n => ({
                ...n,
                isPinned: n.isPinned || false,
                createdAt: n.createdAt || Date.now(),
                updatedAt: n.updatedAt || Date.now(),
            })));
            state.setActiveNoteId(s.activeNoteId ?? null);
            state.setIsSidebarCollapsed(s.isSidebarCollapsed || false);
            state.setUntitledCounter(s.untitledCounter || 1);
            state.setCurrentSortOrder(s.currentSortOrder || 'modified-desc');
            dom.sortOrderSelect.value = state.currentSortOrder;
            applyTheme(s.currentTheme || 'light');

            dom.sidebar.classList.toggle('collapsed', state.isSidebarCollapsed);
            dom.sidebarToggleBtn.textContent = state.isSidebarCollapsed ? '>' : '<';
            dom.sidebarToggleBtn.title = state.isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar';

            const ep = s.editorPanePercent || 50;
            dom.editorContainer.style.flexBasis = `${ep}%`;
            const rw = (dom.resizer.offsetWidth / dom.container.offsetWidth) * 100 || 0.5;
            dom.preview.style.flexBasis = `${100 - ep - rw}%`;

            if (state.notes.length > 0) {
                let id = state.activeNoteId;
                if (!id || !findNoteById(id)) {
                    id = sortNotes(state.notes, state.currentSortOrder)[0]?.id ?? null;
                    state.setActiveNoteId(id);
                }
                const active = findNoteById(id);
                dom.editor.value = active ? active.content : '';
            } else {
                dom.editor.value = '';
                state.setActiveNoteId(null);
            }
            renderUI(); updatePreview(); setUnsavedChanges(false);
        } else {
            applyTheme('light');
            addNote('Welcome!', '# Welcome to Browser Markdown Editor!\n\n- Use the sidebar to manage notes.\n- Use the toolbar to format text.\n- Notes are saved in your browser automatically.');
            setUnsavedChanges(false);
        }
    } catch (e) {
        console.error('Error loading state:', e);
        state.setNotes([]); state.setActiveNoteId(null);
        applyTheme('light');
        addNote('Error!', `# Error Loading Session\n\n\`\`\`\n${e.message}\n\`\`\``);
        setUnsavedChanges(false); renderUI(); updatePreview();
    }
}

// ── Note Management ───────────────────────────────────────────────────────────
export function addNote(name = null, content = '') {
    const now = Date.now();
    let noteName = name;
    if (!noteName) {
        let nextNum = 1;
        state.notes.forEach(n => {
            const m = n.name.match(/^Untitled\s*(\d+)$/i);
            if (m && parseInt(m[1], 10) >= nextNum) nextNum = parseInt(m[1], 10) + 1;
        });
        state.setUntitledCounter(Math.max(state.untitledCounter, nextNum));
        noteName = `Untitled ${state.untitledCounter}`;
        state.setUntitledCounter(state.untitledCounter + 1);
    }
    const newNote = { id: now, name: noteName, content, isPinned: false, createdAt: now, updatedAt: now };
    state.notes.push(newNote);
    setUnsavedChanges(true, false);
    hideFindReplaceBar();
    switchTab(now);
    return now;
}

export function switchTab(id) {
    const numericId = Number(id);
    if (state.activeNoteId === numericId && findNoteById(numericId)) return;
    const prev = findNoteById(state.activeNoteId);
    if (prev && prev.content !== dom.editor.value) {
        prev.content = dom.editor.value; prev.updatedAt = Date.now(); setUnsavedChanges(true, false);
    }
    state.setActiveNoteId(numericId);
    const note = findNoteById(numericId);
    if (note) {
        dom.editor.value = note.content;
        updatePreview(); renderUI(); dom.editor.focus();
        setUnsavedChanges(false); hideFindReplaceBar();
    } else {
        state.setActiveNoteId(null);
        if (state.notes.length > 0) { switchTab(state.notes[0].id); return; }
        dom.editor.value = ''; updatePreview(); renderUI(); setUnsavedChanges(false); hideFindReplaceBar();
    }
    closeMenuDropdownUI(); saveStateToLocalStorage();
}

function closeNoteById(idToClose) {
    const numId = Number(idToClose);
    if (state.notes.length === 0) return;
    const idx = findNoteIndexById(numId);
    if (idx === -1) return;
    const wasActive = numId === state.activeNoteId;
    state.notes.splice(idx, 1);
    setUnsavedChanges(true);
    if (state.notes.length === 0) {
        dom.editor.value = ''; dom.preview.innerHTML = '';
        state.setActiveNoteId(null); state.setUntitledCounter(1);
        renderUI(); saveStateToLocalStorage(); setUnsavedChanges(false); hideFindReplaceBar();
    } else if (wasActive) {
        const nextId = state.notes[Math.max(0, idx - 1)]?.id ?? state.notes[0].id;
        state.setActiveNoteId(null); switchTab(nextId);
    } else {
        renderUI(); saveStateToLocalStorage();
    }
    closeSearchResultsUI(); closeMenuDropdownUI();
}

function closeNote() {
    if (state.activeNoteId !== null) closeNoteById(state.activeNoteId);
    else if (state.notes.length > 0) closeNoteById(state.notes[0].id);
}

function renameNote() {
    if (!state.activeNoteId) { alert('Please select a note to rename.'); return; }
    const note = findNoteById(state.activeNoteId);
    if (!note) return;
    const newName = prompt('Enter the new name for the note:', note.name);
    if (!newName || newName.trim() === '' || newName.trim() === note.name) { closeMenuDropdownUI(); return; }
    note.name = newName.trim(); note.updatedAt = Date.now();
    setUnsavedChanges(true, false); renderUI(); closeMenuDropdownUI(); saveStateToLocalStorage();
}

function togglePinNote(noteId) {
    const note = findNoteById(noteId);
    if (!note) return;
    note.isPinned = !note.isPinned; note.updatedAt = Date.now();
    setUnsavedChanges(true, false); saveStateToLocalStorage(); renderSidebarNoteList();
}

// ── Tag filters ───────────────────────────────────────────────────────────────
export function setTagFilter(tag) {
    state.setActiveFilterTag(tag);
    renderSidebarNoteList(); extractAndRenderTags();
}
export function clearTagFilter() {
    state.setActiveFilterTag(null);
    renderSidebarNoteList(); extractAndRenderTags();
}

// ── Theme ─────────────────────────────────────────────────────────────────────
function toggleTheme() {
    applyTheme(state.currentTheme === 'light' ? 'dark' : 'light');
    saveStateToLocalStorage();
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function toggleSidebar() {
    state.setIsSidebarCollapsed(!state.isSidebarCollapsed);
    dom.sidebar.classList.toggle('collapsed', state.isSidebarCollapsed);
    dom.sidebarToggleBtn.textContent = state.isSidebarCollapsed ? '>' : '<';
    dom.sidebarToggleBtn.title = state.isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar';
    closeMenuDropdownUI(); saveStateToLocalStorage();
}

// ── Search ────────────────────────────────────────────────────────────────────
const debouncedSearch = debounce(performSearch, 150);

function performSearch() {
    const query = dom.searchInput.value.trim();
    if (!query) {
        dom.searchResultsContent.innerHTML = '<p>Please enter a search term.</p>';
        dom.searchResults.style.display = 'block'; return;
    }
    const active = findNoteById(state.activeNoteId);
    if (active) active.content = dom.editor.value;
    const queryLower = query.toLowerCase();
    const queryRegex = new RegExp(escapeRegExp(query), 'gi');
    const snippetLen = 80;
    let html = ''; let count = 0;
    state.notes.forEach(note => {
        const contentLower = note.content.toLowerCase();
        const mi = contentLower.indexOf(queryLower);
        if (mi !== -1) {
            count++;
            const si = Math.max(0, mi - snippetLen);
            const ei = Math.min(note.content.length, mi + query.length + snippetLen);
            let snippet = note.content.substring(si, ei);
            if (si > 0) snippet = '...' + snippet;
            if (ei < note.content.length) snippet += '...';
            html += `<div class="search-result-item" data-note-id="${note.id}"><div class="search-result-name">${note.name}</div><div class="search-result-snippet">${snippet.replace(queryRegex, m => `<mark>${m}</mark>`)}</div></div>`;
        }
    });
    dom.searchResultsContent.innerHTML = count > 0 ? html : '<p>No results found.</p>';
    dom.searchResults.style.display = 'block';
    closeMenuDropdownUI();
}

// ── Find & Replace ────────────────────────────────────────────────────────────
function findAllMatches() {
    const query = dom.findInput.value;
    if (!query) {
        state.setFindState({ query: '', matches: [], currentIndex: -1 });
        dom.findMatchCount.textContent = '';
        dom.editor.setSelectionRange(dom.editor.selectionStart, dom.editor.selectionStart);
        return;
    }
    const regex = new RegExp(escapeRegExp(query), 'gi');
    const matches = []; let m;
    while ((m = regex.exec(dom.editor.value)) !== null) matches.push({ index: m.index, length: m[0].length });
    state.setFindState({ query, matches, currentIndex: -1 });
    updateFindMatchCountUI();
}

function selectMatch(index) {
    const { matches } = state.findState;
    if (index >= 0 && index < matches.length) {
        const match = matches[index];
        dom.editor.focus();
        dom.editor.setSelectionRange(match.index, match.index + match.length);
        try {
            const lineNum = dom.editor.value.substring(0, match.index).split('\n').length;
            dom.editor.scrollTop = Math.max(0, (lineNum - 5) * 20);
        } catch (e) {}
        updateFindMatchCountUI();
    }
}

function findNext() {
    if (!state.findState.matches.length) { findAllMatches(); if (!state.findState.matches.length) return; }
    const next = (state.findState.currentIndex + 1) % state.findState.matches.length;
    state.setFindState({ ...state.findState, currentIndex: next });
    selectMatch(next);
}
function findPrev() {
    if (!state.findState.matches.length) { findAllMatches(); if (!state.findState.matches.length) return; }
    const prev = state.findState.currentIndex <= 0 ? state.findState.matches.length - 1 : state.findState.currentIndex - 1;
    state.setFindState({ ...state.findState, currentIndex: prev });
    selectMatch(prev);
}
function replaceCurrent() {
    if (state.findState.currentIndex === -1 || !state.findState.matches.length) return;
    const match = state.findState.matches[state.findState.currentIndex];
    const replacement = dom.replaceInput.value;
    dom.editor.setSelectionRange(match.index, match.index + match.length);
    dom.editor.setRangeText(replacement);
    const scrollPos = dom.editor.scrollTop;
    findAllMatches();
    let nextIdx = state.findState.matches.findIndex(m => m.index >= match.index + replacement.length);
    if (nextIdx !== -1) { state.setFindState({ ...state.findState, currentIndex: nextIdx - 1 }); findNext(); }
    else { state.setFindState({ ...state.findState, currentIndex: -1 }); updateFindMatchCountUI(); }
    dom.editor.scrollTop = scrollPos;
    updatePreview(); setUnsavedChanges(true, true); updateStatusBar();
}
function replaceAll() {
    const query = dom.findInput.value;
    if (!query) return;
    const newVal = dom.editor.value.replace(new RegExp(escapeRegExp(query), 'gi'), dom.replaceInput.value);
    if (newVal !== dom.editor.value) {
        const scrollPos = dom.editor.scrollTop;
        dom.editor.value = newVal; dom.editor.scrollTop = scrollPos;
        updatePreview(); setUnsavedChanges(true, true); updateStatusBar(); findAllMatches();
    }
}
function showFindReplace() { showFindReplaceBar(); closeMenuDropdownUI(); findAllMatches(); }
function hideFindReplace() { hideFindReplaceBar(); state.setFindState({ query: '', matches: [], currentIndex: -1 }); dom.findMatchCount.textContent = ''; }

// ── Markdown Toolbar ──────────────────────────────────────────────────────────
function applyMarkdownFormatting(syntaxStart, syntaxEnd = null, placeholder = 'text', isBlock = false) {
    const start = dom.editor.selectionStart, end = dom.editor.selectionEnd;
    const selected = dom.editor.value.substring(start, end);
    syntaxEnd = syntaxEnd ?? syntaxStart;
    let prefix = (isBlock && start !== 0 && dom.editor.value[start - 1] !== '\n') ? '\n' : '';
    let textToInsert, fss, fse;
    if (syntaxStart === '---') {
        prefix = start !== 0 ? (dom.editor.value[start-1] !== '\n' ? '\n\n' : '\n') : '';
        textToInsert = `${prefix}---\n`; fss = fse = start + textToInsert.length;
    } else if (selected) {
        textToInsert = `${prefix}${syntaxStart}${selected}${syntaxEnd}`;
        fss = start + prefix.length + syntaxStart.length; fse = fss + selected.length;
    } else {
        textToInsert = `${prefix}${syntaxStart}${placeholder}${syntaxEnd}`;
        fss = start + prefix.length + syntaxStart.length; fse = fss + placeholder.length;
    }
    dom.editor.setRangeText(textToInsert, start, end, 'end');
    dom.editor.setSelectionRange(fss, fse);
    dom.editor.focus(); updatePreview(); setUnsavedChanges(true, true); updateStatusBar();
}

// ── Resizer ───────────────────────────────────────────────────────────────────
let startX, startWidthEditorPercent;
function startDrag(e) {
    state.setIsResizing(true); startX = e.clientX;
    startWidthEditorPercent = (dom.editorContainer.offsetWidth / dom.container.offsetWidth) * 100;
    document.addEventListener('mousemove', handleDrag); document.addEventListener('mouseup', stopDrag);
    document.body.style.userSelect = 'none';
}
function handleDrag(e) {
    if (!state.isResizing) return;
    const dx = e.clientX - startX, cw = dom.container.offsetWidth, rw = dom.resizer.offsetWidth;
    let ep = Math.max((100 / cw), startWidthEditorPercent + dx / cw * 100);
    let pp = 100 - ep - rw / cw * 100;
    if (pp < 100 / cw) { pp = 100 / cw; ep = 100 - pp - rw / cw * 100; }
    dom.editorContainer.style.flexBasis = `${ep}%`; dom.preview.style.flexBasis = `${pp}%`;
    e.preventDefault();
}
function stopDrag() {
    if (!state.isResizing) return;
    state.setIsResizing(false);
    document.removeEventListener('mousemove', handleDrag); document.removeEventListener('mouseup', stopDrag);
    document.body.style.userSelect = ''; saveStateToLocalStorage();
}

// ── Editor auto-behaviours ────────────────────────────────────────────────────
const pairMap = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
const listMarkers = ['- ', '* ', '+ '];
function handleEditorKeyDown(e) {
    const key = e.key, start = dom.editor.selectionStart, end = dom.editor.selectionEnd;
    if (Object.keys(pairMap).includes(key)) {
        e.preventDefault();
        const sel = dom.editor.value.substring(start, end);
        dom.editor.setRangeText(`${key}${sel}${pairMap[key]}`, start, end, 'end');
        dom.editor.setSelectionRange(start + 1, start + 1 + (sel ? sel.length : 0));
        updatePreview(); setUnsavedChanges(true); updateStatusBar(); return;
    }
    if (key === 'Enter') {
        const lineStart = dom.editor.value.lastIndexOf('\n', start - 1) + 1;
        const currentLine = dom.editor.value.substring(lineStart, start);
        const trimmed = currentLine.trimStart();
        let prefix = null, isEmpty = false;
        for (const m of listMarkers) {
            if (trimmed.startsWith(m)) { prefix = currentLine.match(/^\s*/)[0] + m; isEmpty = trimmed.length === m.length; break; }
        }
        if (!prefix) {
            const om = trimmed.match(/^(\d+)\.\s+/);
            if (om) { const n = parseInt(om[1],10); prefix = `${currentLine.match(/^\s*/)[0]}${n+1}. `; isEmpty = trimmed.length === om[0].length; }
        }
        if (!prefix) {
            const tm = trimmed.match(/^(-|\*|\+)\s+\[( |x)\]\s+/i);
            if (tm) { prefix = `${currentLine.match(/^\s*/)[0]}${tm[1]} [ ] `; isEmpty = trimmed.length === tm[0].length; }
        }
        if (prefix) {
            e.preventDefault();
            if (isEmpty) { dom.editor.setRangeText('', lineStart, start, 'end'); dom.editor.setRangeText('\n', dom.editor.selectionStart, dom.editor.selectionStart, 'end'); }
            else { dom.editor.setRangeText(`\n${prefix}`, start, end, 'end'); }
            updatePreview(); setUnsavedChanges(true); updateStatusBar();
        }
    }
}

// ── Global keyboard shortcuts ─────────────────────────────────────────────────
function handleGlobalKeyDown(e) {
    const mod = navigator.platform.toUpperCase().includes('MAC') ? e.metaKey : e.ctrlKey;
    let handled = false;
    if (mod) {
        switch (e.key.toLowerCase()) {
            case 's': saveNote(); handled = true; break;
            case 'n': addNote(); handled = true; break;
            case 'f': showFindReplace(); handled = true; break;
            case 'b': if (document.activeElement === dom.editor) { applyMarkdownFormatting('**'); handled = true; } break;
            case 'i': if (document.activeElement === dom.editor) { applyMarkdownFormatting('*'); handled = true; } break;
        }
    }
    if (e.key === 'Escape' && dom.findReplaceBar.style.display !== 'none') { hideFindReplace(); handled = true; }
    if (handled) e.preventDefault();
}

// ── Event Listeners ───────────────────────────────────────────────────────────
dom.editor.addEventListener('input', () => {
    updatePreview(); updateStatusBar(); setUnsavedChanges(true, true); extractAndRenderTags();
    clearTimeout(state.autoSaveTimer);
    state.setAutoSaveTimer(setTimeout(() => saveStateToLocalStorage(), 2000));
});
dom.editor.addEventListener('keydown', handleEditorKeyDown);

dom.editorToolbar.addEventListener('click', e => {
    if (e.target.tagName !== 'BUTTON') return;
    const id = e.target.id;
    const map = {
        toolbarH1: ['# ', '', 'Heading 1', true], toolbarH2: ['## ', '', 'Heading 2', true],
        toolbarH3: ['### ', '', 'Heading 3', true], toolbarBold: ['**'],
        toolbarItalic: ['*'], toolbarStrikethrough: ['~~'], toolbarBlockquote: ['> ', '', 'Quote text', true],
        toolbarLink: ['[', '](url)', 'link text'], toolbarCode: ['`'],
        toolbarListUl: ['- ', '', 'List item', true], toolbarListOl: ['1. ', '', 'List item', true],
        toolbarTaskList: ['- [ ] ', '', 'Task item', true], toolbarHr: ['---', '', '', true],
    };
    if (map[id]) applyMarkdownFormatting(...map[id]);
});

dom.findReplaceToggleBtn.addEventListener('click', showFindReplace);
dom.findReplaceCloseBtn.addEventListener('click', hideFindReplace);
dom.findInput.addEventListener('input', findAllMatches);
dom.findInput.addEventListener('keydown', e => { if (e.key === 'Enter') findNext(); });
dom.findNextBtn.addEventListener('click', findNext);
dom.findPrevBtn.addEventListener('click', findPrev);
dom.replaceBtn.addEventListener('click', replaceCurrent);
dom.replaceAllBtn.addEventListener('click', replaceAll);

dom.openBtn.addEventListener('click', openSingleFile);
dom.addTabBtn.addEventListener('click', () => addNote());
dom.closeNoteBtn.addEventListener('click', closeNote);
dom.fileInput.addEventListener('change', handleFileOpen);
dom.noteSwitcher.addEventListener('change', e => { const id = Number(e.target.value); if (id && id !== state.activeNoteId) switchTab(id); });
dom.searchBtn.addEventListener('click', performSearch);
dom.searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') { performSearch(); e.preventDefault(); } });
dom.searchInput.addEventListener('input', debouncedSearch);
dom.searchInput.addEventListener('click', closeMenuDropdownUI);
dom.searchCloseBtn.addEventListener('click', closeSearchResultsUI);
dom.searchResultsContent.addEventListener('click', e => {
    const item = e.target.closest('.search-result-item');
    if (item?.dataset.noteId) { switchTab(Number(item.dataset.noteId)); closeSearchResultsUI(); }
});
dom.tabsContainer.addEventListener('click', e => {
    const closeBtn = e.target.closest('.close-tab-btn');
    if (closeBtn) { e.stopPropagation(); closeNoteById(Number(closeBtn.dataset.id)); return; }
    const tab = e.target.closest('.tab');
    if (tab && tab !== dom.addTabBtn) switchTab(Number(tab.dataset.id));
});
dom.sidebarNoteList.addEventListener('scroll', () => {
    if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
    state.setAnimationFrameId(requestAnimationFrame(renderSidebarVirtualWindow));
});
dom.sidebarNoteList.addEventListener('click', e => {
    const pinBtn = e.target.closest('.pin-note-btn');
    if (pinBtn) { e.stopPropagation(); togglePinNote(Number(pinBtn.dataset.id)); return; }
    const item = e.target.closest('.sidebar-note-item');
    if (item) switchTab(Number(item.dataset.id));
});
dom.sidebarToggleBtn.addEventListener('click', toggleSidebar);
dom.sortOrderSelect.addEventListener('change', e => { state.setCurrentSortOrder(e.target.value); saveStateToLocalStorage(); renderSidebarNoteList(); });
dom.clearTagFilterBtn.addEventListener('click', clearTagFilter);
dom.menuToggleBtn.addEventListener('click', e => { e.stopPropagation(); toggleMenuDropdownUI(); });
dom.saveBtn.addEventListener('click', saveNote);
dom.newNoteBtn.addEventListener('click', () => addNote());
dom.renameBtn.addEventListener('click', renameNote);
dom.exportAllBtn.addEventListener('click', exportAllNotes);
dom.importBtn.addEventListener('click', importFiles);
dom.importFolderBtn.addEventListener('click', importFolder);
dom.themeToggleBtnMenu.addEventListener('click', toggleTheme);
dom.themeToggleBtn.addEventListener('click', toggleTheme);
document.addEventListener('click', e => { if (!dom.menuToggleBtn.contains(e.target) && !dom.menuDropdown.contains(e.target)) closeMenuDropdownUI(); });
dom.resizer.addEventListener('mousedown', startDrag);
window.addEventListener('beforeunload', e => {
    if (state.notes.length > 0) { clearTimeout(state.autoSaveTimer); saveStateToLocalStorage(); }
    if (state.unsavedChanges) { e.preventDefault(); e.returnValue = 'You have unsaved changes.'; }
});
document.addEventListener('keydown', handleGlobalKeyDown);

// ── Bootstrap ─────────────────────────────────────────────────────────────────
loadStateFromLocalStorage();
console.log('Browser Markdown Editor Initialized.');

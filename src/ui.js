/**
 * ui.js
 * All rendering / UI update functions.
 * Functions here read from state and write to the DOM.
 */

import { marked } from 'marked';
import * as state from './state.js';
import * as dom from './dom.js';
import { sortNotes, escapeRegExp } from './utils.js';
import * as reg from './registry.js';

// Item height for sidebar virtualization (must match CSS)
export const VIRTUAL_ITEM_HEIGHT = 36;

// Local cache of the sorted list used by the virtual window
let virtualizedNotes = [];

// ─── Preview ────────────────────────────────────────────────────────────────

/**
 * Parses the editor's content with marked and writes it to the preview pane.
 */
export function updatePreview() {
    if (state.activeNoteId !== null) {
        try {
            dom.preview.innerHTML = marked.parse(dom.editor.value);
        } catch (e) {
            console.error('Markdown Parsing Error:', e);
            dom.preview.innerHTML = '<p>Error parsing Markdown.</p>';
        }
    } else {
        dom.preview.innerHTML = '';
    }
}

// ─── Status Bar ─────────────────────────────────────────────────────────────

/**
 * Updates word / character count in the status bar.
 */
export function updateStatusBar() {
    const content = dom.editor.value;
    const charCount = content.length;
    const wordCount = content.trim().split(/\s+/).filter(w => w.length > 0).length;
    const charSpan = document.getElementById('charCount');
    const wordSpan = document.getElementById('wordCount');
    if (charSpan) charSpan.textContent = `Chars: ${charCount}`;
    if (wordSpan) wordSpan.textContent = `Words: ${wordCount}`;
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

/**
 * Renders all note tabs using a DocumentFragment (single reflow).
 */
export function renderTabs() {
    try {
        dom.tabsContainer.querySelectorAll('.tab').forEach(t => t.remove());
        const sortedForTabs = state.notes.slice().sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
        const fragment = document.createDocumentFragment();
        sortedForTabs.forEach(note => {
            const tab = document.createElement('button');
            tab.className = 'tab';
            tab.dataset.id = note.id;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'tab-name';
            nameSpan.textContent = note.name;
            nameSpan.title = note.name;

            const closeSpan = document.createElement('span');
            closeSpan.className = 'close-tab-btn';
            closeSpan.innerHTML = '&times;';
            closeSpan.title = 'Close Note';
            closeSpan.dataset.id = note.id;

            tab.appendChild(nameSpan);
            tab.appendChild(closeSpan);
            if (note.id === state.activeNoteId) tab.classList.add('active');
            fragment.appendChild(tab);
        });
        dom.tabsContainer.insertBefore(fragment, dom.addTabBtn);

        const activeTab = dom.tabsContainer.querySelector('.tab.active');
        if (activeTab) activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    } catch (e) {
        console.error('Error rendering tabs:', e);
    }
}

// ─── Note Switcher ───────────────────────────────────────────────────────────

/**
 * Renders the note switcher <select> options.
 */
export function renderSwitcher() {
    try {
        dom.noteSwitcher.innerHTML = '';
        const fragment = document.createDocumentFragment();
        state.notes.forEach(note => {
            const option = document.createElement('option');
            option.value = note.id;
            option.textContent = note.name;
            if (note.id === state.activeNoteId) option.selected = true;
            fragment.appendChild(option);
        });
        dom.noteSwitcher.appendChild(fragment);
        dom.noteSwitcher.disabled = state.notes.length === 0;
    } catch (e) {
        console.error('Error rendering switcher:', e);
    }
}

// ─── Sidebar Note List (Virtualized) ─────────────────────────────────────────

/**
 * Applies filters/sorts, stores the result in `virtualizedNotes`, then calls
 * `renderSidebarVirtualWindow` to paint only the visible slice.
 */
export function renderSidebarNoteList() {
    try {
        let notesToDisplay = state.notes;
        if (state.activeFilterTag) {
            const filterRegex = new RegExp(`#${escapeRegExp(state.activeFilterTag)}(?:\\s|$)`, 'i');
            notesToDisplay = state.notes.filter(note => {
                const content = (note.id === state.activeNoteId && dom.editor) ? dom.editor.value : note.content;
                return typeof content === 'string' && filterRegex.test(content);
            });
        }
        const pinnedNotes   = notesToDisplay.filter(n => n.isPinned);
        const unpinnedNotes = notesToDisplay.filter(n => !n.isPinned);
        virtualizedNotes = [
            ...sortNotes(pinnedNotes, state.currentSortOrder),
            ...sortNotes(unpinnedNotes, state.currentSortOrder),
        ];
        renderSidebarVirtualWindow();
    } catch (e) {
        console.error('Error rendering sidebar note list:', e);
        dom.sidebarNoteList.innerHTML = '<li>Error loading notes list.</li>';
    }
}

/**
 * Renders only the items currently visible in the sidebar scroll container.
 * Uses absolute positioning to keep a stable total scroll height.
 */
export function renderSidebarVirtualWindow() {
    try {
        const containerHeight = dom.sidebarNoteList.clientHeight || 300;
        const scrollTop  = dom.sidebarNoteList.scrollTop;
        const totalItems = virtualizedNotes.length;
        const totalHeight = totalItems * VIRTUAL_ITEM_HEIGHT;

        dom.sidebarNoteList.innerHTML = '';
        if (totalItems === 0) return;

        const fragment = document.createDocumentFragment();

        // Invisible spacer that forces the correct scrollable height
        const spacer = document.createElement('li');
        spacer.className = 'virtual-scroll-spacer';
        spacer.style.height = `${totalHeight}px`;
        fragment.appendChild(spacer);

        // Render visible items + a buffer of 5 above/below for smooth scrolling
        const startIndex = Math.max(0, Math.floor(scrollTop / VIRTUAL_ITEM_HEIGHT) - 5);
        const endIndex   = Math.min(totalItems - 1, Math.ceil((scrollTop + containerHeight) / VIRTUAL_ITEM_HEIGHT) + 5);

        for (let i = startIndex; i <= endIndex; i++) {
            const note = virtualizedNotes[i];
            const li = document.createElement('li');
            li.className = 'sidebar-note-item';
            li.dataset.id = note.id;
            li.style.top = `${i * VIRTUAL_ITEM_HEIGHT}px`;
            if (note.id === state.activeNoteId) li.classList.add('active-note-sidebar');

            const nameSpan = document.createElement('span');
            nameSpan.className = 'note-name-sidebar';
            nameSpan.textContent = note.name;
            nameSpan.title = note.name;

            const pinBtn = document.createElement('button');
            pinBtn.className = 'pin-note-btn';
            pinBtn.innerHTML = '📌';
            pinBtn.title = note.isPinned ? 'Unpin Note' : 'Pin Note';
            pinBtn.dataset.id = note.id;
            if (note.isPinned) pinBtn.classList.add('pinned');

            li.appendChild(nameSpan);
            li.appendChild(pinBtn);
            fragment.appendChild(li);
        }

        dom.sidebarNoteList.appendChild(fragment);
    } catch (e) {
        console.error('Error rendering virtual window:', e);
    }
}

// ─── Tags ────────────────────────────────────────────────────────────────────

/**
 * Extracts #tags from content string.
 * @param {string} content
 * @returns {string[]}
 */
function extractTags(content) {
    const tagRegex = /#([a-zA-Z0-9_\-\/]+)/g;
    const tags = new Set();
    for (const match of content.matchAll(tagRegex)) tags.add(match[1].toLowerCase());
    return Array.from(tags);
}

/**
 * Scans all notes for tags and renders the tag buttons in the sidebar.
 * Imports setTagFilter / clearTagFilter via a lazy import to avoid circular deps.
 */
export function extractAndRenderTags() {
    try {
        const allTags = new Set();
        state.notes.forEach(note => {
            const content = (note.id === state.activeNoteId && dom.editor) ? dom.editor.value : note.content;
            if (typeof content === 'string') extractTags(content).forEach(t => allTags.add(t));
        });
        const sortedTags = Array.from(allTags).sort((a, b) => a.localeCompare(b));
        dom.tagList.innerHTML = '';
        if (sortedTags.length === 0) {
            dom.tagList.innerHTML = '<span style="font-size:11px;color:#666;">No tags found.</span>';
        } else {
            sortedTags.forEach(tag => {
                const btn = document.createElement('button');
                btn.className = 'tag-button';
                btn.textContent = `#${tag}`;
                btn.dataset.tag = tag;
                if (tag === state.activeFilterTag) btn.classList.add('active-tag');
                btn.addEventListener('click', () => {
                    const setTagFilter = reg.get('setTagFilter');
                    const clearTagFilter = reg.get('clearTagFilter');
                    if (state.activeFilterTag === tag) clearTagFilter();
                    else setTagFilter(tag);
                });
                dom.tagList.appendChild(btn);
            });
        }
        dom.clearTagFilterBtn.style.display = state.activeFilterTag ? 'inline' : 'none';
    } catch (e) {
        console.error('Error rendering tags:', e);
        dom.tagList.innerHTML = '<span style="font-size:11px;color:red;">Error loading tags.</span>';
    }
}

// ─── Full UI Refresh ──────────────────────────────────────────────────────────

/**
 * Re-renders every UI component (tabs, switcher, sidebar, tags, status bar).
 * Does NOT re-render the preview; that is done separately.
 */
export function renderUI() {
    try { renderTabs(); }              catch (e) { console.error('renderTabs:', e); }
    try { renderSwitcher(); }          catch (e) { console.error('renderSwitcher:', e); }
    try { renderSidebarNoteList(); }   catch (e) { console.error('renderSidebarNoteList:', e); }
    try { extractAndRenderTags(); }    catch (e) { console.error('extractAndRenderTags:', e); }
    try { updateStatusBar(); }         catch (e) { console.error('updateStatusBar:', e); }
}

// ─── Theme ───────────────────────────────────────────────────────────────────

/**
 * Applies the specified theme by toggling the `dark-mode` class on <body>.
 * @param {'light'|'dark'} theme
 */
export function applyTheme(theme) {
    state.setCurrentTheme(theme);
    document.body.classList.toggle('dark-mode', theme === 'dark');
    // Derive --preview-bg-rgb for the search overlay background
    try {
        const previewBg = getComputedStyle(document.body).getPropertyValue('--preview-bg').trim();
        if (previewBg.startsWith('#')) {
            const r = parseInt(previewBg.slice(1, 3), 16);
            const g = parseInt(previewBg.slice(3, 5), 16);
            const b = parseInt(previewBg.slice(5, 7), 16);
            document.documentElement.style.setProperty('--preview-bg-rgb', `${r}, ${g}, ${b}`);
        } else if (previewBg.startsWith('rgb')) {
            const vals = previewBg.match(/\d+/g);
            if (vals && vals.length >= 3) {
                document.documentElement.style.setProperty('--preview-bg-rgb', `${vals[0]}, ${vals[1]}, ${vals[2]}`);
            }
        } else {
            document.documentElement.style.setProperty('--preview-bg-rgb', theme === 'dark' ? '43, 43, 43' : '255, 255, 255');
        }
    } catch (e) {
        document.documentElement.style.setProperty('--preview-bg-rgb', theme === 'dark' ? '43, 43, 43' : '255, 255, 255');
    }
}

// ─── Find/Replace bar visibility ─────────────────────────────────────────────

export function showFindReplaceBar() {
    dom.findReplaceBar.style.display = 'flex';
    dom.findInput.focus();
    dom.findInput.select();
}

export function hideFindReplaceBar() {
    dom.findReplaceBar.style.display = 'none';
}

// ─── Search Results Overlay ───────────────────────────────────────────────────

export function closeSearchResultsUI() {
    dom.searchResults.style.display = 'none';
    dom.searchResultsContent.innerHTML = '';
}

// ─── Menu Dropdown ────────────────────────────────────────────────────────────

export function toggleMenuDropdownUI() {
    dom.menuDropdown.classList.toggle('visible');
}

export function closeMenuDropdownUI() {
    dom.menuDropdown.classList.remove('visible');
}

// ─── Find Match Count ─────────────────────────────────────────────────────────

export function updateFindMatchCountUI() {
    const { matches, currentIndex } = state.findState;
    if (matches.length > 0) {
        const current = currentIndex === -1 ? 0 : currentIndex + 1;
        dom.findMatchCount.textContent = `${current} / ${matches.length}`;
    } else {
        dom.findMatchCount.textContent = '0 / 0';
    }
}

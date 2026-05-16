/**
 * state.js
 * Central store for all application state variables.
 * Import these in any module that needs to read or write state.
 */

// --- Core Data ---
/** @type {Array<{id: number, name: string, content: string, isPinned: boolean, createdAt: number, updatedAt: number}>} */
export let notes = [];

/** @type {number|null} ID of the currently active note */
export let activeNoteId = null;

/** @type {number} Auto-incrementing counter for "Untitled" note names */
export let untitledCounter = 1;

/** @type {number|null} ID of the first note added during an import session */
export let firstAddedNoteIdDuringImport = null;

// --- UI State ---
/** @type {boolean} Whether the sidebar is currently collapsed */
export let isSidebarCollapsed = false;

/** @type {boolean} Whether there are unsaved (to file) changes */
export let unsavedChanges = false;

/** @type {boolean} Whether the resizer is actively being dragged */
export let isResizing = false;

/** @type {'light'|'dark'} Current color theme */
export let currentTheme = 'light';

/** @type {string} Current sort order for the sidebar note list */
export let currentSortOrder = 'modified-desc';

/** @type {string|null} The tag currently being used to filter notes */
export let activeFilterTag = null;

// --- Timers & RAF ---
/** @type {number|null} Timer ID for the auto-save debounce */
export let autoSaveTimer = null;

/** @type {number|null} requestAnimationFrame ID for sidebar virtualization */
export let animationFrameId = null;

// --- Find State ---
/** @type {{query: string, matches: Array<{index: number, length: number}>, currentIndex: number}} */
export let findState = { query: '', matches: [], currentIndex: -1 };

// --- Setters ---
// Using explicit setter functions keeps the interface clean and predictable.

export function setNotes(newNotes) { notes = newNotes; }
export function setActiveNoteId(id) { activeNoteId = id; }
export function setUntitledCounter(val) { untitledCounter = val; }
export function setFirstAddedNoteIdDuringImport(id) { firstAddedNoteIdDuringImport = id; }
export function setIsSidebarCollapsed(val) { isSidebarCollapsed = val; }
export function setUnsavedChangesState(val) { unsavedChanges = val; }
export function setIsResizing(val) { isResizing = val; }
export function setCurrentTheme(val) { currentTheme = val; }
export function setCurrentSortOrder(val) { currentSortOrder = val; }
export function setActiveFilterTag(val) { activeFilterTag = val; }
export function setAutoSaveTimer(id) { autoSaveTimer = id; }
export function setAnimationFrameId(id) { animationFrameId = id; }
export function setFindState(val) { findState = val; }

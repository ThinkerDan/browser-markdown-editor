/**
 * dom.js
 * Single source of truth for all DOM element references.
 * Import this module anywhere you need to interact with the DOM.
 */

export const editor        = document.getElementById('editor');
export const preview       = document.getElementById('preview');
export const tabsContainer = document.getElementById('tabs');
export const addTabBtn     = document.getElementById('addTabBtn');
export const sidebar       = document.getElementById('sidebar');
export const sidebarNoteList = document.getElementById('sidebarNoteList');
export const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
export const sortOrderSelect  = document.getElementById('sortOrder');
export const tagList          = document.getElementById('tagList');
export const tagSection       = document.getElementById('tagSection');
export const clearTagFilterBtn = document.getElementById('clearTagFilterBtn');
export const noteSwitcher     = document.getElementById('noteSwitcher');
export const container        = document.querySelector('.container');
export const editorContainer  = document.getElementById('editorContainer');
export const resizer          = document.getElementById('resizer');
export const statusBar        = document.getElementById('statusBar');
export const editorToolbar    = document.getElementById('editorToolbar');

// Top controls
export const openBtn      = document.getElementById('openBtn');
export const closeNoteBtn = document.getElementById('closeNoteBtn');
export const searchInput  = document.getElementById('searchInput');
export const searchBtn    = document.getElementById('searchBtn');
export const themeToggleBtn = document.getElementById('themeToggleBtn');
export const fileInput    = document.getElementById('fileInput');

// Menu
export const menuToggleBtn    = document.getElementById('menuToggleBtn');
export const menuDropdown     = document.getElementById('menuDropdown');
export const saveBtn          = document.getElementById('saveBtn');
export const newNoteBtn       = document.getElementById('newNoteBtn');
export const renameBtn        = document.getElementById('renameBtn');
export const exportAllBtn     = document.getElementById('exportAllBtn');
export const importBtn        = document.getElementById('importBtn');
export const importFolderBtn  = document.getElementById('importFolderBtn');
export const themeToggleBtnMenu = document.getElementById('themeToggleBtnMenu');
export const findReplaceToggleBtn = document.getElementById('findReplaceToggleBtn');

// Search results overlay
export const searchResults        = document.getElementById('searchResults');
export const searchResultsContent = document.getElementById('searchResultsContent');
export const searchCloseBtn       = document.getElementById('searchCloseBtn');

// Find/Replace bar
export const findReplaceBar      = document.getElementById('findReplaceBar');
export const findReplaceCloseBtn = document.getElementById('findReplaceCloseBtn');
export const findInput           = document.getElementById('findInput');
export const replaceInput        = document.getElementById('replaceInput');
export const findNextBtn         = document.getElementById('findNextBtn');
export const findPrevBtn         = document.getElementById('findPrevBtn');
export const replaceBtn          = document.getElementById('replaceBtn');
export const replaceAllBtn       = document.getElementById('replaceAllBtn');
export const findMatchCount      = document.getElementById('findMatchCount');

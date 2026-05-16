/**
 * utils.js
 * Pure, side-effect-free helper functions.
 */

/**
 * Escapes special regular expression characters in a string.
 * @param {string} string - The string to escape.
 * @returns {string} The escaped string, safe for use in a RegExp constructor.
 */
export function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generates a simple unique integer ID based on the current timestamp + random offset.
 * @returns {number}
 */
export function generateId() {
    return Date.now() + Math.floor(Math.random() * 1000);
}

/**
 * Sorts a copy of the notes array according to the specified order.
 * @param {Array} notesArr - The notes array to sort.
 * @param {string} order - One of 'modified-desc', 'modified-asc', 'name-asc', 'name-desc', 'created-desc', 'created-asc'.
 * @returns {Array} A new sorted array (does not mutate the original).
 */
export function sortNotes(notesArr, order) {
    const arr = [...notesArr];
    // Pinned notes always sort first
    arr.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        switch (order) {
            case 'modified-desc': return (b.updatedAt || 0) - (a.updatedAt || 0);
            case 'modified-asc':  return (a.updatedAt || 0) - (b.updatedAt || 0);
            case 'name-asc':      return (a.name || '').localeCompare(b.name || '');
            case 'name-desc':     return (b.name || '').localeCompare(a.name || '');
            case 'created-desc':  return (b.createdAt || 0) - (a.createdAt || 0);
            case 'created-asc':   return (a.createdAt || 0) - (b.createdAt || 0);
            default:              return (b.updatedAt || 0) - (a.updatedAt || 0);
        }
    });
    return arr;
}

/**
 * Debounce helper. Returns a debounced version of the given function.
 * @param {Function} fn - The function to debounce.
 * @param {number} delay - Delay in milliseconds.
 * @returns {Function}
 */
export function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * registry.js
 * Breaks circular dependencies by providing a late-binding registry.
 * main.js registers its exported helpers here at boot time;
 * fileSystem.js and ui.js call them through the registry instead of
 * dynamically importing main.js.
 */

/** @type {Record<string, Function>} */
const _reg = {};

/**
 * Register a set of functions so other modules can call them.
 * @param {Record<string, Function>} fns
 */
export function register(fns) {
    Object.assign(_reg, fns);
}

/**
 * Retrieve a registered function by name.
 * Throws if the function hasn't been registered yet.
 * @param {string} name
 * @returns {Function}
 */
export function get(name) {
    if (!_reg[name]) throw new Error(`registry: "${name}" has not been registered yet.`);
    return _reg[name];
}

/**
 * DevSuite API Tester — collection sidebar management logic (SPEC §4.7.4)
 *
 * Pure module: folder path normalization, rename cascades, deletes, and
 * reorder/move semantics for the flat `collections` array whose display
 * order defines sidebar order. No DOM access, no state.
 *
 * Loaded in the browser as globalThis.CollectionUtils; require()-able in node
 * for the unit suite in tests/javascript/.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; }
    else { root.CollectionUtils = api; }
})(globalThis, function () {
    'use strict';

    /** 'a / b //c ' → 'a/b/c'; empty/whitespace → undefined (= top level). */
    function normalizeFolderPath(raw) {
        const p = String(raw || '').split('/').map(s => s.trim()).filter(Boolean).join('/');
        return p || undefined;
    }

    /** True when itemFolder is `path` itself or nested anywhere below it. */
    function isInFolder(itemFolder, path) {
        return itemFolder === path || String(itemFolder || '').startsWith(path + '/');
    }

    /** Requests inside `path`, including nested subfolders. */
    function countInFolder(items, path) {
        return items.filter(it => isInFolder(it.folder, path)).length;
    }

    /**
     * Rename a folder path: cascades the prefix change to every descendant
     * request (in place) and every matching folderAuths key. Renaming onto an
     * existing path merges into it (auth entries at the target are overwritten
     * by the moved ones). Returns the number of requests updated.
     */
    function renameFolder(items, folderAuths, oldPath, newPath) {
        let count = 0;
        items.forEach(it => {
            if (it.folder === oldPath) {
                it.folder = newPath;
                count++;
            } else if (isInFolder(it.folder, oldPath)) {
                it.folder = newPath + it.folder.slice(oldPath.length);
                count++;
            }
        });
        Object.keys(folderAuths).forEach(k => {
            if (k === oldPath || k.startsWith(oldPath + '/')) {
                folderAuths[newPath + k.slice(oldPath.length)] = folderAuths[k];
                delete folderAuths[k];
            }
        });
        return count;
    }

    /**
     * Remove a folder, all nested requests, and their folderAuths entries.
     * Returns { items: <new filtered array>, removed: <request count> };
     * folderAuths is mutated in place.
     */
    function deleteFolder(items, folderAuths, path) {
        const kept = items.filter(it => !isInFolder(it.folder, path));
        Object.keys(folderAuths).forEach(k => {
            if (k === path || k.startsWith(path + '/')) delete folderAuths[k];
        });
        return { items: kept, removed: items.length - kept.length };
    }

    /**
     * Move items[fromIdx] to sit before items[toIdx] (toIdx === items.length
     * appends to the end), assigning newFolder (undefined = top level).
     * Mutates in place; returns false on an invalid fromIdx.
     */
    function moveItem(items, fromIdx, toIdx, newFolder) {
        if (!Number.isInteger(fromIdx) || fromIdx < 0 || fromIdx >= items.length) return false;
        const [it] = items.splice(fromIdx, 1);
        if (newFolder === undefined) { delete it.folder; } else { it.folder = newFolder; }
        const insertAt = Math.max(0, Math.min(fromIdx < toIdx ? toIdx - 1 : toIdx, items.length));
        items.splice(insertAt, 0, it);
        return true;
    }

    return { normalizeFolderPath, isInFolder, countInFolder, renameFolder, deleteFolder, moveItem };
});

/** Quita `sb-*` del portal sin revocar tokens en servidor (tras handoff las cookies viven en Next). */
export function clearSupabaseBrowserStorageOnly() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('sb-')) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* noop */
  }
}

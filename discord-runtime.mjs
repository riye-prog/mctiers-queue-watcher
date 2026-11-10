export function resolveDiscordTransport() {
  const chunks = globalThis.webpackChunkdiscord_app;
  if (!Array.isArray(chunks) || chunks.push === Array.prototype.push) return;

  const runtimes = new Set();
  try {
    chunks.push([[`mctiers-queue-${Date.now()}`], {}, runtime => { runtimes.add(runtime); }]);
  } catch {
    return;
  }

  const isDispatcher = value => typeof value?.dispatch === 'function' &&
    typeof value?.subscribe === 'function' && typeof value?.unsubscribe === 'function' &&
    typeof value?.register === 'function' && typeof value?.wait === 'function';

  for (const runtime of runtimes) {
    const cache = runtime.c || {};
    for (const [id, factory] of Object.entries(runtime.m || {})) {
      if (!cache[id]?.exports) continue;
      const source = String(factory);
      if (!source.includes('canQueueInteraction') || !source.includes('component_type:') ||
          !source.includes('message_flags:')) continue;
      let submit;
      try {
        submit = Object.values(cache[id].exports).find(value => {
          if (typeof value !== 'function') return false;
          const code = String(value);
          return code.includes('canQueueInteraction') && code.includes('component_type:') && code.includes('message_flags:');
        });
      } catch {}
      if (!submit) continue;

      for (const [, dependency] of source.matchAll(/\b[\w$]+\s*=\s*[\w$]+\((\d+)\)/g)) {
        const exported = cache[dependency]?.exports;
        try {
          const dispatcher = isDispatcher(exported) ? exported : Object.values(exported || {}).find(isDispatcher);
          if (dispatcher) return { dispatcher, submit };
        } catch {}
      }
    }
  }
}

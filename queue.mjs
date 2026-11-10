import { pathToFileURL } from 'node:url';
import { showQueuePanel } from './panel.mjs';

export function watchQueue({ channel, live, tryVisible = false, onWaiting }) {
  const startedAt = performance.now();
  const appId = '1124128173609713734';
  const listSelector = '[data-list-id="chat-messages"]';
  const rowSelector = '[id^="chat-messages-"]';
  const countPattern = /(?:^|[^a-z])Queue[^a-z\d]*\((\d+)\s*\/\s*(\d+)\)/i;
  const channelId = channel.split('/')[3];
  const firstNewId = BigInt(Date.now() - 1420070400000) << 22n;
  const seen = new Map();
  const identities = new WeakMap();
  const currentChannel = () => location.pathname.split('/').slice(0, 4).join('/');
  if (currentChannel() !== channel) throw new Error('Discord is no longer on the specified channel.');
  globalThis.stopMctiersQueue?.();

  function joinComponentId(components) {
    if (!Array.isArray(components)) return;
    for (const component of components) {
      if (component.type === 2 && component.label === 'Join Queue' && !component.disabled) {
        return component.custom_id ?? component.customId;
      }
      if (component.components) {
        const nested = joinComponentId(component.components);
        if (nested) return nested;
      }
    }
  }

  function buttonIdentity(button, messageId) {
    const known = identities.get(button);
    if (known?.messageId === messageId) return known;
    const fiberKey = Object.keys(button).find(key => key.startsWith('__reactFiber$'));
    for (let fiber = button[fiberKey]; fiber; fiber = fiber.return) {
      const message = fiber.memoizedProps?.message;
      if (message?.id === messageId) {
        const matches = message.author?.id === appId || message.applicationId === appId || message.application_id === appId;
        const identity = { messageId, matches, componentId: matches && joinComponentId(message.components) };
        identities.set(button, identity);
        return identity;
      }
    }
  }

  function check(row, baseline) {
    const messageId = row.id.match(/^chat-messages-(?:\d+-)?(\d+)$/)?.[1];
    if (!messageId) return;
    let button;
    for (const candidate of row.getElementsByTagName('button')) {
      if (candidate.textContent.trim() === 'Join Queue') {
        button = candidate;
        break;
      }
    }
    const prior = seen.get(messageId);
    const identity = button && buttonIdentity(button, messageId);
    if (!identity?.matches) {
      if (baseline || prior) seen.set(messageId, { enabled: false, full: prior?.full });
      return;
    }

    const enabled = !button.disabled && button.getAttribute('aria-disabled') !== 'true';
    const count = row.textContent.match(countPattern);
    const full = count ? Number(count[1]) >= Number(count[2]) : undefined;
    seen.set(messageId, { enabled, full, button, componentId: identity.componentId });
    if (baseline) return { button, messageId, enabled, full, displayedCount: count?.[0].trim() };
    if (!enabled) return;

    const fresh = !prior && BigInt(messageId) >= firstNewId;
    const enabledNow = prior?.enabled === false;
    const slotShown = prior?.full === true && full === false;
    if (fresh || enabledNow || slotShown) return { button, messageId, displayedCount: count?.[0].trim() };
  }

  const rows = root => root.querySelectorAll(rowSelector);
  let list = document.querySelector(listSelector);
  let current;
  for (const row of rows(list || document)) {
    const match = check(row, true);
    if (match) current = match;
  }

  if (current?.enabled && (tryVisible || current.full === false)) {
    const detectMs = performance.now() - startedAt;
    if (live) current.button.click();
    return Promise.resolve({
      outcome: live ? 'click dispatched' : 'opening detected in preview',
      messageId: current.messageId,
      displayedCount: current.displayedCount,
      detectMs,
      source: 'visible button'
    });
  }
  if (tryVisible) return Promise.resolve({ outcome: 'no enabled button' });

  function findDispatcher() {
    const chunks = globalThis.webpackChunkdiscord_app;
    if (!chunks || chunks.push === Array.prototype.push) return;
    try {
      let cache;
      chunks.push([[`mctiers-queue-${Date.now()}`], {}, require => { cache = require.c; }]);
      const isDispatcher = value => typeof value?.dispatch === 'function' &&
        typeof value?.subscribe === 'function' && typeof value?.unsubscribe === 'function';
      for (const module of Object.values(cache || {})) {
        if (isDispatcher(module?.exports)) return module.exports;
        for (const key of Object.keys(module?.exports || {})) {
          const value = module.exports[key];
          if (isDispatcher(value)) return value;
        }
      }
    } catch {}
  }

  return new Promise(resolve => {
    let active = true;
    let dispatcher = findDispatcher();

    function finish(result) {
      active = false;
      observer.disconnect();
      clearTimeout(timeout);
      delete globalThis.stopMctiersQueue;
      resolve(result);
      if (dispatcher) queueMicrotask(() => dispatcher.unsubscribe('MESSAGE_UPDATE', onMessageUpdate));
    }

    function attempt(button, messageId, displayedCount, observedAt, source) {
      active = false;
      const detectMs = performance.now() - observedAt;
      if (live) button.click();
      finish({
        outcome: live ? 'click dispatched' : 'opening detected in preview',
        messageId, displayedCount, detectMs, source
      });
    }

    function onMessageUpdate({ message } = {}) {
      if (!active || !message || (message.channel_id ?? message.channelId) !== channelId) return;
      const prior = seen.get(message.id);
      if (!prior?.full || !prior.enabled || !prior.componentId || !prior.button.isConnected) return;
      const observedAt = performance.now();
      if (message.components && joinComponentId(message.components) !== prior.componentId) return;
      for (const embed of message.embeds || []) {
        const count = (embed.rawDescription ?? embed.description)?.match(countPattern);
        if (!count || Number(count[1]) >= Number(count[2])) continue;
        queueMicrotask(() => {
          const { button } = prior;
          if (active && currentChannel() === channel && button.isConnected && !button.disabled &&
              button.getAttribute('aria-disabled') !== 'true') {
            attempt(button, message.id, count[0], observedAt, 'message update');
          }
        });
        break;
      }
    }

    const options = {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['disabled', 'aria-disabled']
    };

    function observe() {
      observer.disconnect();
      observer.observe(list || document.body, options);
      for (let parent = list?.parentElement; parent; parent = parent.parentElement) {
        observer.observe(parent, { childList: true });
      }
    }

    const observer = new MutationObserver(records => {
      const observedAt = performance.now();
      if (currentChannel() !== channel) return finish({ outcome: 'channel changed' });
      const visited = new Set();

      function tryRow(row) {
        if (!row.isConnected || visited.has(row)) return false;
        visited.add(row);
        const match = check(row, false);
        if (!match) return false;
        attempt(match.button, match.messageId, match.displayedCount, observedAt, 'rendered button');
        return true;
      }

      if (!list?.isConnected) {
        const next = document.querySelector(listSelector);
        if (next !== list) {
          list = next;
          observe();
          if (list) for (const row of rows(list)) if (tryRow(row)) return;
        }
      }

      for (const record of records) {
        const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
        const row = target?.closest(rowSelector);
        if (row) {
          if (tryRow(row)) return;
          continue;
        }
        for (const node of record.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE || (list && !list.contains(node))) continue;
          if (node.matches(rowSelector) && tryRow(node)) return;
          for (const child of rows(node)) if (tryRow(child)) return;
        }
      }
    });

    const timeout = setTimeout(() => finish({ outcome: 'arming expired' }), 8 * 60 * 60 * 1000);
    globalThis.stopMctiersQueue = () => finish({ outcome: 'stopped' });
    observe();
    try {
      dispatcher?.subscribe('MESSAGE_UPDATE', onMessageUpdate);
    } catch {
      dispatcher = undefined;
    }
    onWaiting?.(current);
  });
}

async function run() {
  const [channelUrl, ...options] = process.argv.slice(2);
  const panel = !channelUrl || channelUrl === '--panel';
  const channel = channelUrl?.match(/^https:\/\/discord\.com(\/channels\/\d+\/\d+)(?:\/\d+)?\/?$/)?.[1];
  const port = Number(process.env.MCTIERS_CDP_PORT || 9223);
  if ((!panel && !channel) || options.some(option => panel || option !== '--live') || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Usage: node queue.mjs [--panel | CHANNEL_URL [--live]]');
  }

  const targets = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(3000) })
    .then(response => response.json());
  const target = targets.find(item => item.type === 'page' && (
    panel ? item.url.startsWith('https://discord.com/channels/') : (
      item.url === `https://discord.com${channel}` || item.url.startsWith(`https://discord.com${channel}/`)
    )
  ));
  if (!target) throw new Error('Open the specified channel in the desktop Discord window first.');
  const socketUrl = new URL(target.webSocketDebuggerUrl);
  if (socketUrl.protocol !== 'ws:' || socketUrl.hostname !== '127.0.0.1' || Number(socketUrl.port) !== port) {
    throw new Error('Expected a local Discord debugging socket.');
  }

  const socket = new WebSocket(socketUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('Could not connect to Discord DevTools.')), { once: true });
  });

  const live = options.includes('--live');
  const expression = panel
    ? `(${showQueuePanel})(${watchQueue})`
    : `(${watchQueue})(${JSON.stringify({ channel, live })})`;
  const stop = () => socket.send(JSON.stringify({ id: 2, method: 'Runtime.evaluate', params: {
    expression: 'globalThis.stopMctiersQueue?.()'
  } }));

  try {
    const result = await new Promise((resolve, reject) => {
      socket.addEventListener('close', () => reject(new Error('Discord DevTools disconnected.')), { once: true });
      socket.addEventListener('message', event => {
        const response = JSON.parse(event.data);
        if (response.id !== 1) return;
        const error = response.error?.message || response.result?.exceptionDetails?.exception?.description;
        if (error) return reject(new Error(error));
        resolve(response.result.result.value);
      });
      process.once('SIGINT', stop);
      socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: {
        expression, awaitPromise: true, returnByValue: true
      } }));
      if (!panel) console.log(live ? 'Arming one live attempt.' : 'Arming preview.');
    });
    console.log(result);
  } finally {
    process.off('SIGINT', stop);
    socket.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(error => {
    console.error(error.message);
    if (error.cause?.code === 'ECONNREFUSED') console.error('Start Discord with --remote-debugging-port=9223.');
    process.exitCode = 1;
  });
}

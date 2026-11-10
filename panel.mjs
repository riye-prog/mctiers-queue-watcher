export function showQueuePanel(watchQueue) {
  const panelId = 'mctiers-queue-control';
  if (document.getElementById(panelId)) return 'Queue panel is already open in Discord.';

  function element(tag, attributes, text) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    if (text) node.textContent = text;
    return node;
  }

  const host = element('div', { id: panelId });
  const root = host.attachShadow({ mode: 'open' });
  const styles = new CSSStyleSheet();
  styles.replaceSync(`
    :host {
      color-scheme: light;
      position: fixed;
      z-index: 1000;
      inset: auto 18px 82px auto;
      width: min(304px, calc(100vw - 36px));
      color: #17253a;
      font: 13px/1.45 -apple-system, BlinkMacSystemFont, sans-serif;
    }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    button { font: inherit; cursor: pointer; }
    button:focus-visible, input:focus-visible + span { outline: 2px solid #2355bb; outline-offset: 3px; }
    .panel {
      background: #eaf1ff;
      border: 1px solid #97add4;
      border-radius: 15px 15px 6px 6px;
      box-shadow: 0 12px 35px #101b2a50;
      overflow: hidden;
    }
    header { display: flex; align-items: center; gap: 10px; padding: 11px 13px; border-bottom: 1px solid #b5c7e6; }
    h2 { margin: 0; flex: 1; font-size: 14px; font-weight: 720; letter-spacing: -.015em; }
    .flag { width: 18px; height: 14px; background: #2355bb; clip-path: polygon(0 0,100% 0,72% 48%,100% 100%,0 100%); }
    .collapse { background: transparent; border: 0; border-radius: 4px; color: #25456e; width: 27px; height: 26px; font-size: 19px; }
    .collapse:hover { background: #cfdef8; }
    .body { padding: 14px; }
    .readout { border-left: 3px solid #7d94bc; min-height: 68px; padding: 1px 0 2px 10px; }
    .readout[data-state="armed"] { border-color: #2355bb; }
    .readout[data-state="live"] { border-color: #b74b28; }
    .readout[data-state="complete"] { border-color: #267468; }
    .state { display: block; font-size: 22px; font-weight: 680; letter-spacing: -.035em; line-height: 1.16; }
    .detail { margin: 5px 0 0; color: #3c5172; line-height: 1.35; }
    fieldset { display: flex; gap: 5px; padding: 4px; margin: 10px 0; min-width: 0; border: 1px solid #b5c7e6; border-radius: 7px; }
    legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
    label { position: relative; flex: 1; text-align: center; cursor: pointer; }
    label input { position: absolute; opacity: 0; }
    label span { display: block; border-radius: 4px; padding: 5px; color: #3c5172; }
    label input:checked + span { background: #fff; color: #17253a; font-weight: 680; box-shadow: 0 1px 3px #29486f28; }
    fieldset:disabled { opacity: .68; }
    .arm { width: 100%; min-height: 35px; padding: 6px 12px; border: 0; border-radius: 6px; background: #2355bb; color: #fff; font-weight: 680; }
    .arm:hover, .restore:hover { filter: brightness(.92); }
    .arm[data-mode="live"] { background: #a34024; }
    .arm[data-mode="stop"] { background: #17253a; }
    .try { width: 100%; margin-top: 6px; padding: 6px 10px; border: 1px solid #a9bde0; border-radius: 6px; background: transparent; color: #25456e; }
    .try:hover { background: #dce8fc; }
    .restore { float: right; border: 1px solid #97add4; border-radius: 7px; padding: 7px 12px; background: #eaf1ff; color: #17253a; font-weight: 680; }
  `);
  root.adoptedStyleSheets = [styles];

  const panel = element('section', { class: 'panel', 'aria-labelledby': 'title' });
  const header = element('header', {});
  const collapse = element('button', { class: 'collapse', type: 'button', 'aria-label': 'Minimize queue controls' }, '−');
  header.append(element('span', { class: 'flag', 'aria-hidden': 'true' }), element('h2', { id: 'title' }, 'MCTiers queue'), collapse);
  const body = element('div', { class: 'body' });
  const readout = element('div', { class: 'readout', role: 'status', 'aria-atomic': 'true' });
  const state = element('strong', { class: 'state' }, 'Standby');
  const detail = element('p', { class: 'detail' }, 'Open your MCTiers channel and arm the watcher.');
  readout.append(state, detail);

  const modes = element('fieldset', {});
  modes.append(element('legend', {}, 'Watch mode'));
  for (const mode of ['Preview', 'Live']) {
    const label = element('label', {});
    const radio = element('input', { type: 'radio', name: 'mode', value: mode.toLowerCase() });
    radio.checked = mode === 'Preview';
    label.append(radio, element('span', {}, mode));
    modes.append(label);
  }

  const action = element('button', { class: 'arm', type: 'button' }, 'Arm preview');
  const tryButton = element('button', { class: 'try', type: 'button', hidden: '' }, 'Try visible button now');
  const restore = element('button', { class: 'restore', type: 'button', hidden: '' }, 'MCTiers queue');
  body.append(readout, modes, action, tryButton);
  panel.append(header, body);
  root.append(panel, restore);

  let armed = false;
  const liveMode = () => modes.querySelector('input:checked').value === 'live';

  function updateAction() {
    const live = liveMode();
    action.dataset.mode = armed ? 'stop' : live ? 'live' : 'preview';
    action.textContent = armed ? 'Disarm' : live ? 'Arm for an opening' : 'Arm preview';
    modes.disabled = armed;
    tryButton.hidden = armed || !live;
  }

  function report(kind, title, message) {
    readout.dataset.state = kind;
    state.textContent = title;
    detail.textContent = message;
  }

  modes.addEventListener('change', () => {
    updateAction();
    report('idle', 'Standby', liveMode() ? 'Arm for an opening, or try the visible button now.' : 'Preview detects an opening without clicking.');
  });
  collapse.addEventListener('click', () => {
    panel.hidden = true;
    restore.hidden = false;
    restore.focus();
  });
  restore.addEventListener('click', () => {
    restore.hidden = true;
    panel.hidden = false;
    action.focus();
  });
  async function start(tryVisible = false) {
    if (armed) {
      globalThis.stopMctiersQueue?.();
      return;
    }
    const channel = location.pathname.match(/^\/channels\/\d+\/\d+(?=\/|$)/)?.[0];
    if (!channel) {
      report('idle', 'Choose a channel', 'Open your MCTiers server channel, then arm again.');
      return;
    }

    const live = liveMode();
    armed = true;
    updateAction();
    report(live ? 'live' : 'armed', live ? 'Live armed' : 'Preview armed', 'Looking for the queue in this channel.');
    restore.textContent = live ? 'Queue live' : 'Queue preview';

    try {
      const result = await watchQueue({
        channel, live, tryVisible,
        onWaiting(current) {
          const message = current?.full && current.displayedCount
            ? `${current.displayedCount} is full. Watching for a slot.`
            : 'Watching this channel for the next opening.';
          report(live ? 'live' : 'armed', live ? 'Live armed' : 'Preview armed', message);
        }
      });
      if (typeof result.detectMs === 'number') {
        const timing = result.detectMs < 0.1 ? '<0.1' : result.detectMs.toFixed(1);
        report('complete', live ? 'Click sent' : 'Opening detected', `${timing} ms local detection. ${live ? 'Check Discord for the queue reply.' : 'Preview complete.'}`);
      } else if (result.outcome === 'no enabled button') {
        report('idle', 'No join button', 'Open the MCTiers queue message and try again.');
      } else {
        report('idle', result.outcome === 'channel changed' ? 'Channel changed' : 'Disarmed', 'Arm again when you’re ready.');
      }
    } catch (error) {
      report('idle', 'Couldn’t arm', error.message);
    } finally {
      armed = false;
      restore.textContent = 'MCTiers queue';
      updateAction();
    }
  }
  action.addEventListener('click', () => start());
  tryButton.addEventListener('click', () => start(true));

  document.body.append(host);
  return 'Queue panel opened in Discord.';
}

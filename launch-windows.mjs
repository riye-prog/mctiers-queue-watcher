import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { access, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const port = '9223';
const debuggerUrl = `http://127.0.0.1:${port}`;

async function readDebugger(endpoint) {
  try {
    const response = await fetch(`${debuggerUrl}/${endpoint}`, { signal: AbortSignal.timeout(1000) });
    if (response.ok) return await response.json();
  } catch {}
}

async function findDiscord() {
  const directory = join(process.env.LOCALAPPDATA, 'Discord');
  const versions = (await readdir(directory, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  })).filter(entry => entry.isDirectory() && /^app-\d+(?:\.\d+)*$/.test(entry.name));
  versions.sort((left, right) => right.name.localeCompare(left.name, 'en', { numeric: true }));
  for (const { name } of versions) {
    const executable = join(directory, name, 'Discord.exe');
    if (await access(executable).then(() => true, () => false)) return executable;
  }
  throw new Error('Install the standard Discord Desktop client from discord.com/download and try again.');
}

async function stopDiscord() {
  const system = join(process.env.SystemRoot || 'C:\\Windows', 'System32');
  const options = { windowsHide: true, timeout: 6000 };
  async function running() {
    const { stdout } = await execute(join(system, 'tasklist.exe'), [
      '/FI', 'IMAGENAME eq Discord.exe', '/FO', 'CSV', '/NH'
    ], options);
    return /^"Discord\.exe",/im.test(stdout);
  }

  if (!await running()) return;
  console.log('Restarting Discord with the queue panel enabled…');
  try {
    await execute(join(system, 'taskkill.exe'), ['/F', '/IM', 'Discord.exe'], options);
  } catch (error) {
    if (await running()) throw new Error('Could not stop Discord. Quit it from the system tray and try again.', { cause: error });
  }
  for (let attempt = 0; attempt < 15; attempt++) {
    if (!await running()) return;
    await wait(200);
  }
  throw new Error('Discord is still running. Quit it completely and try again.');
}

async function launch() {
  if (process.platform !== 'win32') throw new Error('This launcher is for Windows.');
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Install Node.js 22 or newer.');

  const debuggerInfo = await readDebugger('json/version');
  if (debuggerInfo) {
    if (!/\b(?:Discord|Electron)\//i.test(debuggerInfo['User-Agent'] || '')) {
      throw new Error(`Port ${port} is already used by another debugger. Close it and try again.`);
    }
  } else {
    if (!process.env.LOCALAPPDATA) throw new Error('Windows could not locate your Discord installation.');
    const discord = await findDiscord();
    await stopDiscord();
    const child = spawn(discord, [`--remote-debugging-port=${port}`], {
      cwd: dirname(discord), detached: true, stdio: 'ignore'
    });
    await once(child, 'spawn');
    child.unref();
  }

  console.log('Waiting for a Discord channel to open…');
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const targets = await readDebugger('json/list');
    if (Array.isArray(targets) && targets.some(target => target.type === 'page' &&
        target.url.startsWith('https://discord.com/channels/'))) {
      const { stdout } = await execute(process.execPath, [fileURLToPath(new URL('./queue.mjs', import.meta.url))], {
        env: { ...process.env, MCTIERS_CDP_PORT: port }, timeout: 10000, windowsHide: true
      });
      process.stdout.write(stdout);
      return;
    }
    await wait(500);
  }
  throw new Error('Could not open the queue panel. Sign in, open a Discord channel, and try again.');
}

launch().catch(error => {
  console.error(error.stderr?.trim() || error.message);
  process.exitCode = 1;
});

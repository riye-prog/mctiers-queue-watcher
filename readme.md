# MCTiers Queue Watcher

## Requirements

- [Discord Desktop](https://discord.com/download) on macOS or Windows.
- [Node.js](https://nodejs.org/en/download) 22 or newer. No npm dependencies.

## Setup

1. Clone the repo and enter its folder, or download the ZIP and open its extracted folder in Terminal or PowerShell.

   ```sh
   git clone https://github.com/riye-prog/mctiers-queue-watcher.git
   cd mctiers-queue-watcher
   ```

2. On Windows, double-click **Launch Queue.cmd** in the project folder. It opens Discord and loads the panel. If Discord is already running without debugging, the launcher restarts it.

   On macOS, quit Discord with **⌘Q**, then run this in Terminal.

   ```sh
   open -a /Applications/Discord.app --args --remote-debugging-port=9223
   ```

   Open a Discord channel, then load the panel from the project folder.

   ```sh
   node ./queue.mjs
   ```

3. Open your MCTiers queue channel. Choose **Arm preview** to test detection, or switch to **Live** and choose **Arm for an opening**. **Try visible button now** sends one immediate click. **Disarm** stops watching.

   You can switch channels while armed if the panel says so. If it says to keep the channel open, leave the queue channel open.

<details>
<summary>Manual Windows setup</summary>

Quit Discord from the system tray. In PowerShell, run this block from the project folder.

```powershell
Get-Process -Name Discord -ErrorAction SilentlyContinue |
  Stop-Process -Force -PassThru |
  Wait-Process -Timeout 5 -ErrorAction SilentlyContinue
if (Get-Process -Name Discord -ErrorAction SilentlyContinue) {
  throw 'Discord is still running. Quit it completely before relaunching.'
}

$discord = Get-ChildItem "$env:LOCALAPPDATA\Discord\app-*\Discord.exe" -File |
  Sort-Object { [version]($_.Directory.Name -replace '^app-', '') } -Descending |
  Select-Object -First 1
Start-Process -FilePath $discord.FullName -WorkingDirectory $discord.DirectoryName -ArgumentList '--remote-debugging-port=9223'
```

Open a Discord channel, then run `node ./queue.mjs`.

</details>

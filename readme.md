# MCTiers Queue Watcher

## Requirements

- macOS with [Discord Desktop](https://discord.com/download) installed in `/Applications`.
- [Node.js](https://nodejs.org/en/download) 22 or newer. No npm dependencies.

## Setup

1. Clone the repo and enter its folder, or download the ZIP and open its extracted folder in Terminal.

   ```sh
   git clone https://github.com/riye-prog/mctiers-queue-watcher.git
   cd mctiers-queue-watcher
   ```

2. Quit Discord with **⌘Q**, then relaunch it with local debugging enabled.

   ```sh
   open -a /Applications/Discord.app --args --remote-debugging-port=9223
   ```

3. Open your MCTiers queue channel in Discord, then load the panel.

   ```sh
   node ./queue.mjs
   ```

4. Choose **Arm preview** to test detection, or switch to **Live** and choose **Arm for an opening**. **Try visible button now** sends one immediate click. **Disarm** stops watching.

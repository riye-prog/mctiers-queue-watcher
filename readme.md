# mctiers queue watcher

an unofficial queue panel for discord desktop. it watches the mctiers channel you arm it in and can send one click when it sees an opening.

## what you need

- macos with [discord desktop](https://discord.com/download) installed in `/Applications`.
- [node.js](https://nodejs.org/en/download) 22 or newer. check with `node --version`.
- access to the mctiers queue channel you want to watch.

## install

clone the repo in terminal:

```sh
git clone https://github.com/riye-prog/mctiers-queue-watcher.git
cd mctiers-queue-watcher
```

you can also download the zip from github's **code** menu, unzip it, and open terminal in the extracted folder. keep `queue.mjs` and `panel.mjs` together. there are no packages to install.

## open the panel

1. quit discord completely with **⌘q**.
2. paste this command into terminal to reopen discord with local debugging enabled:

   ```sh
   open -a /Applications/Discord.app --args --remote-debugging-port=9223
   ```

3. open your mctiers queue channel in discord. in terminal, from the folder you cloned or unzipped, run:

   ```sh
   node ./queue.mjs
   ```

4. the panel appears above the discord message box. choose **preview** and **arm preview** to check detection without joining.

## use the panel

- **arm for an opening** in live mode. if the current queue already shows room, the panel clicks immediately. otherwise it waits for discord to show an opening and makes one attempt.
- **try visible button now** in live mode. this sends one immediate click on the enabled mctiers button, even if the displayed queue is full.
- **disarm** stops watching. minimizing the panel keeps it armed. switching channels disarms it.

check the reply in discord to see whether mctiers accepted the join. a click can reach mctiers while its queue is full, and a slot can fill before discord shows it. discord prohibits automation of regular user accounts outside its official bot api. [discord's account automation policy](https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots)

## if the panel doesn't appear

- if terminal says it can't find `queue.mjs`, run the command from the folder containing the file.
- if it can't connect, quit discord with **⌘q**, run the launch command above, and wait until the channel opens before running `node ./queue.mjs`.
- if discord reloads, run `node ./queue.mjs` again. when you're done, quit discord and reopen it normally to close the local debugging port.

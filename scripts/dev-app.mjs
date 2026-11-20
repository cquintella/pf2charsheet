import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const URL = 'http://127.0.0.1:5173';
const viteBin = path.resolve('node_modules/.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');

const viteProc = spawn(viteBin, ['--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

function waitForServer(retries = 60) {
  return new Promise((resolve, reject) => {
    const attempt = (left) => {
      const req = http.get(URL, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (left <= 0) reject(new Error('Vite dev server did not start in time'));
        else setTimeout(() => attempt(left - 1), 250);
      });
    };
    attempt(retries);
  });
}

function launchAppWindow() {
  if (process.platform === 'darwin') {
    const browsers = [
      '/Applications/Google Chrome.app',
      '/Applications/Brave Browser.app',
      '/Applications/Microsoft Edge.app',
      '/Applications/Chromium.app',
    ];
    const found = browsers.find((appPath) => fs.existsSync(appPath));
    if (found) {
      spawn('open', ['-na', found, '--args', `--app=${URL}`], { detached: true, stdio: 'ignore' }).unref();
      return;
    }
    spawn('open', [URL], { detached: true, stdio: 'ignore' }).unref();
    return;
  }

  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', 'msedge', `--app=${URL}`], { detached: true, stdio: 'ignore' }).unref();
    return;
  }

  spawn('google-chrome', [`--app=${URL}`], { detached: true, stdio: 'ignore' }).unref();
}

const shutdown = () => {
  viteProc.kill('SIGINT');
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

viteProc.on('exit', (code) => process.exit(code ?? 0));

waitForServer()
  .then(launchAppWindow)
  .catch((err) => {
    console.error(err.message);
  });

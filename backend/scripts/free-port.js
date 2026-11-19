const { execSync } = require('child_process');

function freePort(port) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano -p tcp | findstr :${port}`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      const lines = output.trim().split('\n');
      const pids = new Set();
      for (const line of lines) {
        if (!line.includes('LISTENING')) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && pid !== String(process.pid)) {
          pids.add(pid);
        }
      }
      for (const pid of pids) {
        try {
          console.log(`[Auto-Free Port] Freeing port ${port} by terminating PID ${pid}...`);
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        } catch {}
      }
    } else {
      execSync(`lsof -ti :${port} | xargs -r kill -9`, { stdio: 'ignore' });
    }
  } catch {
    // Port was already free
  }
}

const targetPort = process.env.PORT || 5000;
freePort(targetPort);

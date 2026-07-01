const fs = require('fs');
const path = require('path');
const os = require('os');

const API_BASE = process.env.CC_PUNCH_API || 'http://localhost:3366';

function main() {
  let input = '';
  try {
    const fd = process.stdin.fd;
    const buf = Buffer.alloc(65536);
    const bytesRead = fs.readSync(fd, buf, 0, buf.length);
    if (bytesRead > 0) {
      input = buf.toString('utf8', 0, bytesRead);
    }
  } catch { return; }

  if (!input.trim()) return;

  let payload;
  try {
    payload = JSON.parse(input);
  } catch { return; }

  const eventName = payload.hook_event_name || payload.eventName;
  if (!eventName) return;

  const sessionId = payload.session_id || payload.sessionId || '';
  if (!sessionId) return;

  const data = {
    sessionId,
    prompt: payload.prompt || '',
    response: payload.last_assistant_message || payload.lastAssistantMessage || '',
    promptAt: Date.now(),
    responseAt: Date.now()
  };

  const url = `${API_BASE}/api/conversations`;
  
  const http = url.startsWith('https') ? require('https') : require('http');
  
  const postData = JSON.stringify(data);
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length
    },
    timeout: 5000
  };

  const req = http.request(url, options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {});
  });

  req.on('error', () => {});
  req.on('timeout', () => {
    req.destroy();
  });

  req.write(postData);
  req.end();
}

try {
  main();
} catch {
  // 忽略所有错误
}

process.exit(0);

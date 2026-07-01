const fs = require('fs');
const path = require('path');

const HOOK_SCRIPT_PATH = path.resolve(__dirname, 'hook.js');
const TRAE_CONFIG_DIR = path.join(process.env.USERPROFILE || process.env.HOME || '', '.trae-cn');
const HOOKS_FILE = path.join(TRAE_CONFIG_DIR, 'hooks.json');

function main() {
  console.log('\n');
  console.log('=========================================');
  console.log('   CC Punch CLI - Hook 安装脚本');
  console.log('=========================================');
  console.log('');

  if (!fs.existsSync(TRAE_CONFIG_DIR)) {
    fs.mkdirSync(TRAE_CONFIG_DIR, { recursive: true });
    console.log(`创建配置目录: ${TRAE_CONFIG_DIR}`);
  }

  let hooks = {};
  if (fs.existsSync(HOOKS_FILE)) {
    try {
      hooks = JSON.parse(fs.readFileSync(HOOKS_FILE, 'utf8'));
      console.log('读取现有配置');
    } catch {
      hooks = {};
    }
  } else {
    console.log('未找到现有配置，将创建新配置');
  }

  if (!hooks.hooks) hooks.hooks = {};

  const events = ['SessionStart', 'UserPromptSubmit', 'Stop', 'StopFailure', 'SessionEnd'];

  for (const event of events) {
    if (!hooks.hooks[event]) hooks.hooks[event] = [];
    if (!Array.isArray(hooks.hooks[event])) hooks.hooks[event] = [];

    hooks.hooks[event].push({
      hooks: [{
        type: 'command',
        command: 'node',
        args: [HOOK_SCRIPT_PATH],
        timeout: 5,
        async: true
      }]
    });

    console.log(`已添加 ${event} Hook`);
  }

  if (!hooks.env) hooks.env = {};
  hooks.env.CC_PUNCH_API = 'http://localhost:3366';

  const tmpPath = HOOKS_FILE + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(hooks, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, HOOKS_FILE);

  console.log('');
  console.log('安装完成！');
  console.log('');
  console.log('下一步：');
  console.log('  1. 启动 CC Punch 服务器: npm start');
  console.log('  2. 重启 TRAE CLI');
  console.log('  3. 在 TRAE CLI 中聊天，对话会自动捕获');
  console.log('');
  console.log('Hook 文件路径: ' + HOOKS_FILE);
  console.log('=========================================');
}

try {
  main();
} catch (e) {
  console.error('安装失败:', e.message);
  process.exit(1);
}

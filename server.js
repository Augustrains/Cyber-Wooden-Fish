const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3366;

app.use(express.static(path.join(__dirname)));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// SQLite 数据库
const sqlite3 = require('sqlite3').verbose();
const dbPath = path.join(__dirname, 'wisdom.db');
const db = new sqlite3.Database(dbPath);

// 初始化数据库
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS wisdom (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'joke',
    source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // 检查是否为空，如果为空则添加默认数据
  db.get("SELECT COUNT(*) as count FROM wisdom", (err, row) => {
    if (row.count === 0) {
      insertDefaultWisdom();
    }
  });
});

// 默认鸡汤和笑话
const defaultWisdom = [
  { type: 'wisdom', content: '生活不是等待风暴过去，而是学会在雨中起舞。' },
  { type: 'wisdom', content: '每一个不曾起舞的日子，都是对生命的辜负。' },
  { type: 'wisdom', content: '成功不是终点，失败也不是终结，唯有勇气才是永恒。' },
  { type: 'wisdom', content: '今天的不开心就到此为止吧，明天依然要光芒万丈。' },
  { type: 'wisdom', content: '温柔半两，从容一生。' },
  { type: 'wisdom', content: '慢慢来，谁还没有一个努力的过程。' },
  { type: 'wisdom', content: '把烦心事丢掉，腾出地方装鲜花。' },
  { type: 'wisdom', content: '生活总会难过，但好运也会如期而至。' },
  { type: 'wisdom', content: '认真生活，才能找到被偷藏起来的糖果。' },
  { type: 'wisdom', content: '愿你眼里全是星光，笑里全是坦荡。' },
  { type: 'joke', content: '程序员的两大谎言：1. 代码写好了我就去改bug。2. 注释晚点再加。' },
  { type: 'joke', content: '为什么程序员喜欢暗色主题？因为 bugs 都怕光。' },
  { type: 'joke', content: '程序员的一天：写代码、debug、写代码、debug...吃饭？那是debug的奖励。' },
  { type: 'joke', content: '代码写得好不好不重要，重要的是注释要写得像真的一样。' },
  { type: 'joke', content: '程序员相亲：我是程序员。对方：你整天对着电脑不会无聊吗？程序员：这比解释代码有趣多了。' },
  { type: 'joke', content: '世界上最遥远的距离不是生与死，而是你写的代码在测试环境运行正常，在生产环境报错。' },
  { type: 'joke', content: '程序员三大错觉：这个bug很简单；这次不需要版本控制；注释以后再加。' },
];

function insertDefaultWisdom() {
  const stmt = db.prepare("INSERT INTO wisdom (content, type) VALUES (?, ?)");
  for (const item of defaultWisdom) {
    stmt.run(item.content, item.type);
  }
  stmt.finalize();
  console.log('[数据库] 已插入默认鸡汤和笑话');
}

// 从网络获取更多鸡汤（使用免费API）
async function fetchWisdomFromNetwork() {
  const apis = [
    { url: 'https://api.shadiao.pro/chp', type: 'wisdom' },
    { url: 'https://api.shadiao.pro/du', type: 'joke' },
  ];
  
  try {
    const api = apis[Math.floor(Math.random() * apis.length)];
    const res = await fetch(api.url);
    const json = await res.json();
    
    if (json.data && json.data.text) {
      db.run("INSERT INTO wisdom (content, type, source) VALUES (?, ?, ?)", 
        [json.data.text, api.type, 'shadiao'],
        (err) => {
          if (err) console.log('[数据库] 插入失败:', err.message);
        }
      );
      return json.data.text;
    }
  } catch (e) {
    console.log('[网络] 获取鸡汤失败:', e.message);
  }
  return null;
}

// 获取随机鸡汤或笑话
function getRandomWisdom(type = null) {
  return new Promise((resolve) => {
    let sql = "SELECT content, type FROM wisdom ORDER BY RANDOM() LIMIT 1";
    if (type) {
      sql = `SELECT content, type FROM wisdom WHERE type = '${type}' ORDER BY RANDOM() LIMIT 1`;
    }
    
    db.get(sql, (err, row) => {
      if (err || !row) {
        resolve({ content: '功夫不负有心人，你的提示词即将出炉！', type: 'wisdom' });
      } else {
        resolve(row);
      }
    });
  });
}

// API: 获取随机鸡汤/笑话
app.get('/api/wisdom', async (req, res) => {
  const type = req.query.type || null;  // 'wisdom' | 'joke' | null
  const wisdom = await getRandomWisdom(type);
  
  // 后台尝试从网络获取新内容
  fetchWisdomFromNetwork().catch(() => {});
  
  res.json(wisdom);
});

// 存储
const store = {
  conversations: [],
  currentSessionId: null,
  apiConfig: {
    apiBase: 'https://api.deepseek.com',
    apiKey: '',
    model: 'deepseek-chat'
  }
};

function loadConfig() {
  const configPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.apiConfig) {
        store.apiConfig = { ...store.apiConfig, ...config.apiConfig };
      }
    } catch {}
  }
}

function saveConfig() {
  const configPath = path.join(__dirname, 'config.json');
  try {
    fs.writeFileSync(configPath, JSON.stringify({ apiConfig: store.apiConfig }, null, 2), 'utf8');
  } catch {}
}

loadConfig();

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'demo.html'));
});

app.get('/api/status', (req, res) => {
  const latest = store.conversations.length > 0
    ? store.conversations[store.conversations.length - 1]
    : null;
  
  res.json({
    hitCount: store.hitCount,
    hasHistory: store.conversations.length > 0,
    latestPrompt: latest ? latest.prompt.substring(0, 100) + '...' : '',
    conversationCount: store.conversations.length
  });
});

app.post('/api/hit', (req, res) => {
  store.hitCount++;
  res.json({ hitCount: store.hitCount });
});

app.get('/api/conversations', (req, res) => {
  res.json(store.conversations);
});

app.post('/api/conversations', (req, res) => {
  const { sessionId, prompt, response, promptAt, responseAt } = req.body;
  
  if (!sessionId || !prompt) {
    return res.status(400).json({ error: '缺少必填参数' });
  }
  
  const existing = store.conversations.find(
    c => c.sessionId === sessionId && c.prompt === prompt
  );
  
  if (existing) {
    if (response) {
      existing.response = response;
      existing.responseAt = responseAt || Date.now();
    }
  } else {
    store.conversations.push({
      id: `${sessionId}-${Date.now()}`,
      sessionId,
      prompt,
      response: response || '',
      promptAt: promptAt || Date.now(),
      responseAt: responseAt || 0
    });
  }
  
  store.currentSessionId = sessionId;
  
  while (store.conversations.length > 20) {
    store.conversations.shift();
  }
  
  res.json({ success: true, count: store.conversations.length });
});

app.get('/api/latest-turn', (req, res) => {
  const withResponse = store.conversations.filter(c => c.response && c.response.length > 0);
  const latest = withResponse.length > 0
    ? withResponse[withResponse.length - 1]
    : null;
  res.json(latest);
});

app.post('/api/chat', async (req, res) => {
  const { prompt, messages, sessionId } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ success: false, message: '缺少问题' });
  }
  
  if (!store.apiConfig.apiKey) {
    return res.status(400).json({ success: false, message: '请先配置 API Key' });
  }
  
  try {
    const url = store.apiConfig.apiBase.replace(/\/$/, '') + '/v1/chat/completions';
    
    console.log(`[API] 调用 ${url}，模型: ${store.apiConfig.model}`);
    
    let chatMessages = [];
    
    if (messages && Array.isArray(messages) && messages.length > 0) {
      chatMessages = messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));
      chatMessages.push({ role: 'user', content: prompt });
    } else {
      chatMessages = [{ role: 'user', content: prompt }];
    }
    
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    
    const apiRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${store.apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: store.apiConfig.model,
        max_tokens: 2048,
        messages: chatMessages
      }),
      signal: controller.signal
    });
    
    clearTimeout(timer);
    
    if (!apiRes.ok) {
      const errorBody = await apiRes.text();
      console.log(`[API] 失败 ${apiRes.status}: ${errorBody.substring(0, 500)}`);
      return res.json({ success: false, message: `API 调用失败 (${apiRes.status})` });
    }
    
    const json = await apiRes.json();
    const content = json.choices?.[0]?.message?.content || json.content?.[0]?.text || '';
    
    if (!content.trim()) {
      return res.json({ success: false, message: 'API 返回空内容' });
    }
    
    const sid = sessionId || 'chat-' + Date.now();
    store.conversations.push({
      id: `${sid}-${Date.now()}`,
      sessionId: sid,
      prompt,
      response: content.trim(),
      promptAt: Date.now(),
      responseAt: Date.now()
    });
    
    while (store.conversations.length > 50) {
      store.conversations.shift();
    }
    
    res.json({
      success: true,
      response: content.trim()
    });
  } catch (e) {
    res.json({ success: false, message: 'API 请求超时或网络错误' });
  }
});

app.post('/api/improve', async (req, res) => {
  const { prompt, response, attempt = 0, previousImprovement } = req.body;
  
  if (!prompt || !response) {
    return res.status(400).json({ success: false, message: '缺少对话内容' });
  }
  
  if (!store.apiConfig.apiKey) {
    return res.status(400).json({ success: false, message: '请先配置 API Key' });
  }
  
  try {
    // 1. 先获取随机鸡汤/笑话（用于等待时显示）
    const wisdom = await getRandomWisdom();
    
    // 2. 在后台尝试从网络获取新内容并存入数据库
    fetchWisdomFromNetwork().catch(() => {});
    
    const improvementPrompt = attempt === 0
      ? buildImprovementPrompt(prompt, response)
      : buildRetryPrompt(prompt, response, previousImprovement);
    
    const url = store.apiConfig.apiBase.replace(/\/$/, '') + '/v1/chat/completions';
    
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    
    const apiRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${store.apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: store.apiConfig.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: improvementPrompt }]
      }),
      signal: controller.signal
    });
    
    clearTimeout(timer);
    
    if (!apiRes.ok) {
      return res.json({ success: false, message: `API 调用失败 (${apiRes.status})` });
    }
    
    const json = await apiRes.json();
    const content = json.choices?.[0]?.message?.content || json.content?.[0]?.text || '';
    
    if (!content.trim()) {
      return res.json({ success: false, message: 'API 返回空内容' });
    }
    
    res.json({
      success: true,
      message: '已生成改进提示词',
      improvedPrompt: content.trim(),
      wisdom: wisdom  // 返回随机鸡汤/笑话
    });
  } catch (e) {
    res.json({ success: false, message: 'API 请求超时或网络错误' });
  }
});

app.post('/api/config', (req, res) => {
  const { apiBase, apiKey, model } = req.body;
  if (apiBase) store.apiConfig.apiBase = apiBase;
  if (apiKey) store.apiConfig.apiKey = apiKey;
  if (model) store.apiConfig.model = model;
  saveConfig();
  res.json({ success: true });
});

app.get('/api/config', (req, res) => {
  res.json({
    apiBase: store.apiConfig.apiBase,
    hasApiKey: !!store.apiConfig.apiKey,
    model: store.apiConfig.model
  });
});

app.post('/api/clear', (req, res) => {
  store.conversations = [];
  store.hitCount = 0;
  res.json({ success: true });
});

function buildImprovementPrompt(originalPrompt, originalResponse) {
  return `你是一位专业的 AI 提示词优化师。

用户对以下 AI 回答不满意。请基于原始问题和 AI 的回答，生成一个更精准、更具操作性的改进版提示词。

示例：
原始问题：写一个排序算法
AI 回答：这是冒泡排序的实现...（仅给出了最简单的 O(n²) 方案）
改进版：请实现一个高效的排序算法，要求：1. 时间复杂度优于 O(n²) 2. 包含原地排序和递归两种变体 3. 用中文注释解释每一步逻辑 4. 附复杂度分析

原始问题：${originalPrompt}

AI 的回答（用户不满意）：${originalResponse}

要求：
1. 生成一个改进版提示词，用中文书写
2. 改进提示词应具体、清晰，包含明确的要求和约束
3. 直接输出改进后的提示词，不要解释、不要加前缀

改进版提示词`;
}

function buildRetryPrompt(originalPrompt, originalResponse, previousImprovement) {
  return `你是一位专业的 AI 提示词优化师。

用户对以下 AI 回答不满意。之前已经生成过一次改进提示词，但用户对那次改进也不满意。

请换一个角度或策略，重新生成一个更有效的改进版提示词。

原始问题：${originalPrompt}

AI 的回答：${originalResponse}

上一次改进（用户不满意）：${previousImprovement || ''}

要求：
1. 换一个角度，不要重复上一次的改进方向
2. 生成一个改进版提示词，用中文书写
3. 直接输出改进后的提示词，不要解释、不要加前缀

改进版提示词`;
}

app.listen(PORT, () => {
  console.log('\n');
  console.log('=========================================');
  console.log('   CC Punch CLI - 赛博木鱼桌宠');
  console.log('=========================================');
  console.log(`服务器已启动：http://localhost:${PORT}`);
  console.log('');
  console.log('使用方法：');
  console.log('  1. 打开浏览器访问 http://localhost:${PORT}');
  console.log('  2. 配置 TRAE CLI Hook');
  console.log('  3. 在 TRAE CLI 中聊天，桌宠会自动捕获对话');
  console.log('  4. 点击木鱼三连击触发改进');
  console.log('');
  console.log('按 Ctrl+C 停止服务器');
  console.log('=========================================');
});

// DeepSeek API 封装:SSE 流式解析、上下文组装、错误映射
// 已实测 api.deepseek.com 支持浏览器 CORS,可直接调用
const API_URL = 'https://api.deepseek.com/chat/completions';

const MAX_CHARS = 6000; // 历史上下文总字符预算

/**
 * 组装消息:system + 历史(从近到远裁剪)+ 当前问题
 * history: [{role, content}](旧→新)
 */
export function buildMessages({ system, history, question }) {
  const messages = [{ role: 'system', content: system }];
  let total = system.length + question.length;
  const kept = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (total + m.content.length > MAX_CHARS) break;
    kept.unshift(m);
    total += m.content.length;
  }
  messages.push(...kept);
  messages.push({ role: 'user', content: question });
  return messages;
}

/**
 * 流式对话:onDelta 逐段回调;signal 用于「停止生成」
 */
export async function streamChat({ key, messages, onDelta, signal }) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({ model: 'deepseek-chat', messages, stream: true }),
    signal,
  });
  if (!res.ok) throw await makeError(res);
  if (!res.body) throw new Error('当前浏览器不支持流式响应');

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true }); // stream 模式防中文跨 chunk 截断
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const j = JSON.parse(payload);
        const delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
        if (delta) onDelta(delta);
      } catch (e) { /* 忽略无法解析的行 */ }
    }
  }
}

async function makeError(res) {
  let message = '请求失败(' + res.status + ')';
  try {
    const j = await res.json();
    if (j && j.error && j.error.message) message = j.error.message;
  } catch (e) {}
  const err = new Error(message);
  err.status = res.status;
  return err;
}

export function friendlyError(err) {
  const status = err && err.status;
  if (status === 401) return 'API 密钥无效,请到「设置」检查';
  if (status === 402) return 'DeepSeek 账户余额不足,请充值后重试';
  if (status === 429) return '请求过于频繁,请稍后再试';
  if (status >= 500) return 'DeepSeek 服务暂时不可用,请稍后再试';
  if (err && err.name === 'AbortError') return '已停止生成';
  if (err instanceof TypeError) return '网络连接失败,请检查网络后重试';
  return (err && err.message) ? err.message : '请求失败,请重试';
}

/** 密钥连通性测试(非流式,最小消耗) */
export async function testKey(key) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: '你好' }],
      max_tokens: 2,
      stream: false,
    }),
  });
  if (!res.ok) throw await makeError(res);
  return true;
}

// AI 聊天面板:全屏覆盖层、流式打字、按书对话历史
import { db } from '../storage/db.js';
import { getKey } from '../storage/settings.js';
import { buildMessages, streamChat, friendlyError } from './deepseek.js';
import {
  latestConversation, listConversations, messagesOf,
  newConversation, newMessage, deleteConversation,
} from './history.js';
import { actionSheet } from '../ui/sheet.js';
import { showToast } from '../ui/toast.js';

const el = (id) => document.getElementById(id);

let ctx = null;   // {bookId, bookTitle, chapter, quote, paragraph}
let conv = null;  // 当前会话
let streaming = false;
let abortCtl = null;

export function initChat() {
  el('btn-chat-close').addEventListener('click', closeChat);
  el('btn-chat-send').addEventListener('click', send);
  el('btn-chat-history').addEventListener('click', showHistory);
  el('btn-chat-new').addEventListener('click', () => {
    if (streaming) stopStreaming();
    conv = null;
    renderMessages();
  });
  const input = el('chat-input');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      send();
    }
  });
  input.addEventListener('input', () => autoGrow(input));
}

export async function openChat(c) {
  ctx = c;
  conv = await latestConversation(c.bookId);
  el('chat-book-title').textContent = c.bookTitle || '未命名';
  el('chat-chapter').textContent = c.chapter || '';
  el('chat-panel').classList.add('open');
  await renderMessages();
  setTimeout(() => el('chat-input').focus(), 250);
}

function closeChat() {
  if (streaming) stopStreaming();
  el('chat-panel').classList.remove('open');
}

function stopStreaming() {
  if (abortCtl) { abortCtl.abort(); abortCtl = null; }
  streaming = false;
  updateSendBtn();
}

function updateSendBtn() {
  const btn = el('btn-chat-send');
  btn.textContent = streaming ? '■' : '➤';
  btn.classList.toggle('stop', streaming);
}

function autoGrow(input) {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 110) + 'px';
}

async function renderMessages() {
  const box = el('chat-messages');
  box.innerHTML = '';
  if (!conv) {
    if (ctx && ctx.quote) {
      appendBubble('assistant', '已带上你选中的内容:\n\n"' + ctx.quote + '"\n\n直接输入你的问题即可。');
    } else {
      appendBubble('assistant', '你好!我是本书的阅读助手,可以针对书中的内容回答你的问题。');
    }
    return;
  }
  const msgs = await messagesOf(conv.id);
  for (const m of msgs) appendBubble(m.role, m.content, m.quoteText || '');
}

function appendBubble(role, content, quote) {
  const box = el('chat-messages');
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  if (quote) {
    const q = document.createElement('span');
    q.className = 'quote-tag';
    q.textContent = '"' + (quote.length > 60 ? quote.slice(0, 60) + '…' : quote) + '"';
    div.appendChild(q);
  }
  const body = document.createElement('span');
  body.textContent = content;
  div.appendChild(body);
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

async function send() {
  if (streaming) { stopStreaming(); return; }
  if (!ctx) return;
  const input = el('chat-input');
  const question = input.value.trim();
  if (!question) return;
  const key = getKey();
  if (!key) { showToast('请先在「设置」中填入 DeepSeek API 密钥'); return; }

  if (!conv) {
    conv = newConversation(ctx.bookId, question);
    await db.put('conversations', conv);
  }

  // 历史上下文(不含本轮刚发出的问题)
  const prior = (await messagesOf(conv.id))
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content }));

  const quote = ctx.quote || '';
  const paragraph = ctx.paragraph || '';
  const chapter = ctx.chapter || '';

  let content = question;
  if (quote) {
    content += '\n\n【引用原文' + (chapter ? '(' + chapter + ')' : '') + '】"' + quote + '"';
    if (paragraph) content += '\n【所在段落】' + paragraph;
  }

  const system = ctx.bookId === 'external'
    ? '你是「随身书架」的阅读助手。用户从其他应用(如 Apple 图书)选中了一段文字来向你提问。' +
      '请优先依据用户提供的引用内容回答;若内容不足以回答,请如实说明。请用简体中文,回答简洁清晰。'
    : '你是「随身书架」的阅读助手,正在与我讨论《' + (ctx.bookTitle || '这本书') + '》。' +
      (chapter ? '我目前阅读的章节是「' + chapter + '」。' : '') +
      '请优先依据我提供的书中原文回答;若书中内容不足以回答,请如实说明。请用简体中文,回答简洁清晰。';

  await db.put('messages', newMessage(conv.id, ctx.bookId, 'user', question, { quoteText: quote || undefined, chapter }));
  appendBubble('user', question, quote);
  input.value = '';
  autoGrow(input);

  const div = appendBubble('assistant', '');
  div.classList.add('streaming');
  let acc = '';
  streaming = true;
  updateSendBtn();
  abortCtl = new AbortController();

  try {
    await streamChat({
      key,
      messages: buildMessages({ system, history: prior, question: content }),
      signal: abortCtl.signal,
      onDelta: (d) => {
        acc += d;
        div.lastChild.textContent = acc;
        const box = el('chat-messages');
        box.scrollTop = box.scrollHeight;
      },
    });
  } catch (e) {
    const aborted = e && e.name === 'AbortError';
    const msg = friendlyError(e);
    if (!aborted) {
      div.lastChild.textContent = acc ? acc + '\n\n(生成中断:' + msg + ')' : '⚠ ' + msg;
      showToast(msg);
    } else if (!acc) {
      div.lastChild.textContent = '(已停止)';
    }
  } finally {
    div.classList.remove('streaming');
    streaming = false;
    abortCtl = null;
    updateSendBtn();
    if (acc) {
      await db.put('messages', newMessage(conv.id, ctx.bookId, 'assistant', acc));
      conv.updatedAt = Date.now();
      await db.put('conversations', conv);
    }
  }
  ctx.quote = '';
  ctx.paragraph = '';
}

async function showHistory() {
  if (!ctx) return;
  const list = await listConversations(ctx.bookId);
  if (!list.length) { showToast('暂无历史对话'); return; }
  const id = await actionSheet({
    title: '历史对话',
    actions: list.map((c, i) => ({ id: 'c' + i, label: (c.title || '对话') + ' · ' + fmtTime(c.updatedAt) })),
  });
  if (id === 'cancel') return;
  const c = list[Number(id.slice(1))];
  const act = await actionSheet({
    title: c.title || '对话',
    actions: [
      { id: 'open', label: '继续此对话' },
      { id: 'del', label: '删除此对话', danger: true },
    ],
  });
  if (act === 'open') { conv = c; await renderMessages(); }
  if (act === 'del') {
    await deleteConversation(c.id);
    if (conv && conv.id === c.id) { conv = null; await renderMessages(); }
    showToast('已删除');
  }
}

function fmtTime(ts) {
  const d = new Date(ts || Date.now());
  const p = (n) => String(n).padStart(2, '0');
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

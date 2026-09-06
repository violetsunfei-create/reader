// 数据备份:导出/导入 JSON(含高亮、对话、设置;书文件本身不含,重新导入同名书自动关联)
import { db } from '../storage/db.js';
import { getAll, update } from '../storage/settings.js';
import { VERSION } from '../version.js';
import { showToast } from '../ui/toast.js';

const APP_TAG = 'shenshen-shujia-backup';

export async function collectBackup() {
  const books = await db.all('books');
  return {
    app: APP_TAG,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    settings: getAll(),
    books: books.map((b) => ({
      id: b.id, fileName: b.fileName, title: b.title, author: b.author,
      size: b.size, addedAt: b.addedAt, lastCfi: b.lastCfi, lastReadAt: b.lastReadAt,
      progress: b.progress || 0,
      hasFile: !!b.buffer,
    })),
    highlights: await db.all('highlights'),
    conversations: await db.all('conversations'),
    messages: await db.all('messages'),
  };
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '' + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
}

export async function exportToFile() {
  const data = await collectBackup();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'shenshen-backup-' + stamp() + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  showToast('备份已导出');
}

export async function exportToClipboard() {
  const data = await collectBackup();
  try {
    await navigator.clipboard.writeText(JSON.stringify(data));
    showToast('备份已复制到剪贴板');
  } catch (e) {
    showToast('复制失败:' + (e && e.message || ''));
  }
}

export async function importData(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data || data.app !== APP_TAG) throw new Error('不是有效的备份文件');
  if (data.settings) update(data.settings);
  for (const b of data.books || []) {
    const fields = { ...b };
    delete fields.hasFile;
    const existing = await db.get('books', b.id);
    if (existing) {
      await db.put('books', { ...existing, ...fields }); // 保留本机已有的书文件
    } else {
      await db.put('books', { ...fields, buffer: null }); // 无文件,书架显示「重新导入」
    }
  }
  for (const h of data.highlights || []) await db.put('highlights', h);
  for (const c of data.conversations || []) await db.put('conversations', c);
  for (const m of data.messages || []) await db.put('messages', m);
}

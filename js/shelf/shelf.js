// 书架:导入 EPUB、封面/元数据解析、删除、卡片渲染
import { db, uid } from '../storage/db.js';
import { showToast } from '../ui/toast.js';
import { confirmSheet } from '../ui/sheet.js';

const coverUrls = new Map(); // bookId -> objectURL

export function initShelf({ onOpenBook }) {
  document.getElementById('btn-import').addEventListener('click', () => {
    const input = document.getElementById('import-input');
    delete input.dataset.reuse;
    input.click();
  });
  document.getElementById('import-input').addEventListener('change', async (e) => {
    const input = e.target;
    const file = input.files && input.files[0];
    const reuseId = input.dataset.reuse || null;
    delete input.dataset.reuse;
    input.value = '';
    if (!file) return;
    if (!/\.epub$/i.test(file.name)) { showToast('请选择 .epub 格式的电子书'); return; }
    showToast('正在导入…');
    try {
      await importEpub(file, reuseId);
      showToast('导入成功');
      await refreshShelf();
    } catch (err) {
      console.error(err);
      showToast('导入失败:' + (err && err.message ? err.message : '文件可能已损坏'));
    }
  });
}

export async function importEpub(file, reuseId = null) {
  const buf = await file.arrayBuffer();
  let title = file.name.replace(/\.epub$/i, '').trim() || '未命名';
  let author = '';
  let cover = null;
  try {
    const b = window.ePub(buf, { openAs: 'binary' });
    await b.opened;
    const meta = b.packaging.metadata || {};
    if (meta.title && String(meta.title).trim()) title = String(meta.title).trim();
    if (meta.creator) {
      const c = Array.isArray(meta.creator) ? meta.creator[0] : meta.creator;
      const raw = c && (c['#text'] || c);
      author = String(raw || '').replace(/\s*\(著\)\s*$/, '').trim();
    }
    try {
      const coverUrl = await b.coverUrl();
      if (coverUrl) {
        const res = await fetch(coverUrl);
        cover = await res.blob();
      }
    } catch (e) { /* 无封面,忽略 */ }
    try { b.destroy(); } catch (e) { /* 忽略 */ }
  } catch (e) {
    console.warn('元数据解析失败,使用文件名兜底', e);
  }

  // 同名书复用 bookId(备份恢复场景:重新导入后高亮/对话自动关联)
  let id = reuseId;
  if (!id) {
    const existing = await db.all('books');
    const same = existing.find((r) => r.fileName === file.name);
    if (same) id = same.id;
  }
  if (!id) id = uid();

  const old = await db.get('books', id);
  const rec = {
    id,
    fileName: file.name,
    title,
    author,
    size: file.size,
    buffer: buf,
    cover,
    addedAt: old && old.addedAt ? old.addedAt : Date.now(),
    lastCfi: (old && old.lastCfi) || null,
    lastReadAt: (old && old.lastReadAt) || 0,
    progress: (old && old.progress) || 0,
  };
  await db.put('books', rec);
  return id;
}

export async function refreshShelf() {
  const grid = document.getElementById('book-grid');
  const empty = document.getElementById('shelf-empty');
  const books = await db.all('books');
  books.sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0));
  grid.innerHTML = '';
  empty.hidden = books.length > 0;
  for (const b of books) grid.appendChild(renderCard(b));
}

function renderCard(b) {
  const card = document.createElement('div');
  card.className = 'book-card';
  card.dataset.id = b.id;

  const coverEl = document.createElement('div');
  coverEl.className = 'book-cover';
  if (b.cover && b.cover instanceof Blob) {
    if (coverUrls.has(b.id)) URL.revokeObjectURL(coverUrls.get(b.id));
    const url = URL.createObjectURL(b.cover);
    coverUrls.set(b.id, url);
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    coverEl.appendChild(img);
  } else {
    const fb = document.createElement('div');
    fb.className = 'cover-fallback';
    fb.textContent = b.title || '未命名';
    coverEl.appendChild(fb);
  }
  card.appendChild(coverEl);

  const title = document.createElement('div');
  title.className = 'book-title';
  title.textContent = b.title || b.fileName;
  card.appendChild(title);

  if (b.author) {
    const au = document.createElement('div');
    au.className = 'book-author';
    au.textContent = b.author;
    card.appendChild(au);
  }
  if (!b.buffer) {
    const badge = document.createElement('div');
    badge.className = 'badge-need-file';
    badge.textContent = '⚠ 点击重新导入文件';
    card.appendChild(badge);
  }
  const prog = document.createElement('div');
  prog.className = 'book-progress';
  const pct = Math.round((b.progress || 0) * 100);
  prog.innerHTML = '<i style="width:' + pct + '%"></i>';
  card.appendChild(prog);

  // 点击:打开书;文件缺失时重新导入
  card.addEventListener('click', () => {
    if (longPressed) { longPressed = false; return; }
    if (!b.buffer) {
      const input = document.getElementById('import-input');
      input.dataset.reuse = b.id;
      input.click();
    } else {
      openBook(b.id);
    }
  });

  // 长按删除(600ms)
  let longPressed = false;
  let longTimer = null;
  card.addEventListener('touchstart', () => {
    longPressed = false;
    longTimer = setTimeout(() => { longPressed = true; askDelete(b); }, 600);
  }, { passive: true });
  card.addEventListener('touchend', () => clearTimeout(longTimer));
  card.addEventListener('touchmove', () => clearTimeout(longTimer));

  function openBook(id) {
    location.hash = '#/reader/' + encodeURIComponent(id);
  }

  return card;
}

async function askDelete(b) {
  const ok = await confirmSheet({
    title: '删除书籍',
    message: '确定删除《' + (b.title || b.fileName) + '》吗?该书的高亮与 AI 对话也会一并删除。',
    okLabel: '删除',
  });
  if (!ok) return;
  await db.del('books', b.id);
  await db.delByIndex('highlights', 'bookId', b.id);
  await db.delByIndex('conversations', 'bookId', b.id);
  await db.delByIndex('messages', 'bookId', b.id);
  showToast('已删除');
  await refreshShelf();
}

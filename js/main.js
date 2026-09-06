// 入口:hash 路由、屏幕切换、全局事件、首次引导
import { initShelf, refreshShelf } from './shelf/shelf.js';
import { ReaderController } from './reader/reader.js';
import { initChat, openChat } from './ai/chat-ui.js';
import { initSettings } from './settings/screen.js';
import { getAll, update } from './storage/settings.js';
import { db } from './storage/db.js';
import { showToast } from './ui/toast.js';

let reader = null;

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  document.getElementById('tabbar').style.display = name === 'reader' ? 'none' : 'flex';
}

async function openReader(bookId) {
  const rec = await db.get('books', bookId);
  if (!rec || !rec.buffer) { showToast('书文件缺失,请在书架重新导入该文件'); return; }
  showScreen('reader');
  document.getElementById('reader-title').textContent = rec.title || '';
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('progress-text').textContent = '0%';
  const viewport = document.getElementById('reader-viewport');
  viewport.innerHTML = '';
  reader = new ReaderController(rec, viewport);
  try {
    await reader.init();
  } catch (e) {
    console.error(e);
    showToast('打开失败:' + (e && e.message ? e.message : '文件可能不兼容'));
    await closeReader();
  }
}

async function closeReader() {
  if (reader) { try { await reader.destroy(); } catch (e) {} reader = null; }
  location.hash = '#/shelf';
}

function disposeReader() {
  if (reader) { try { reader.destroy(); } catch (e) {} reader = null; }
}

function updateTabs() {
  const h = location.hash || '#/shelf';
  document.querySelectorAll('#tabbar .tab').forEach((t) => {
    t.classList.toggle('active', h.startsWith(t.dataset.route));
  });
  const anyActive = Array.prototype.some.call(
    document.querySelectorAll('#tabbar .tab'),
    (t) => t.classList.contains('active')
  );
  if (!anyActive) document.querySelector('#tabbar .tab[data-route="#/shelf"]').classList.add('active');
}

function route() {
  const hash = location.hash || '#/shelf';
  if (hash.startsWith('#/reader/')) {
    const id = decodeURIComponent(hash.slice('#/reader/'.length));
    if (reader && reader.rec.id === id) return;
    disposeReader();
    openReader(id);
  } else if (hash.startsWith('#/ask')) {
    // 外部文字入口:Apple 图书等 App 选中文字 → 快捷指令 → 打开本应用提问
    disposeReader();
    showScreen('shelf');
    refreshShelf();
    const qi = hash.indexOf('?');
    const params = new URLSearchParams(qi >= 0 ? hash.slice(qi + 1) : '');
    const q = (params.get('q') || '').trim().slice(0, 2000);
    if (q) {
      openChat({ bookId: 'external', bookTitle: '外部引用内容', chapter: '', quote: q, paragraph: '' });
    } else {
      showToast('没有收到选中的文字');
    }
  } else if (hash === '#/settings') {
    disposeReader();
    showScreen('settings');
  } else {
    disposeReader();
    showScreen('shelf');
    refreshShelf();
  }
  updateTabs();
}

function bindReaderToolbar() {
  document.getElementById('btn-reader-back').addEventListener('click', () => closeReader());
  document.getElementById('btn-reader-ai').addEventListener('click', () => reader && reader.askAI());
  document.getElementById('btn-reader-toc').addEventListener('click', () => reader && reader.openToc());
  document.getElementById('btn-reader-aa').addEventListener('click', () => reader && reader.openAa());
  document.getElementById('btn-prev-ch').addEventListener('click', () => reader && reader.prev());
  document.getElementById('btn-next-ch').addEventListener('click', () => reader && reader.next());
}

function onboardIfNeeded() {
  if (getAll().onboarded) return;
  import('./ui/sheet.js').then(({ actionSheet }) => {
    actionSheet({
      title: '欢迎使用随身书架 📚',
      actions: [
        { id: 'import', label: '📖 导入一本 EPUB 电子书' },
        { id: 'key', label: '🔑 去设置填 DeepSeek 密钥' },
      ],
      cancelText: '开始使用',
    }).then((id) => {
      update({ onboarded: true });
      if (id === 'import') document.getElementById('btn-import').click();
      if (id === 'key') location.hash = '#/settings';
    });
  });
}

initChat();
initSettings({ onDataChanged: () => refreshShelf() });
initShelf({ onOpenBook: (id) => { location.hash = '#/reader/' + encodeURIComponent(id); } });
bindReaderToolbar();
document.getElementById('btn-to-settings').addEventListener('click', () => { location.hash = '#/settings'; });
document.querySelectorAll('#tabbar .tab').forEach((t) => {
  t.addEventListener('click', () => { location.hash = t.dataset.route; });
});
window.addEventListener('hashchange', route);

// iOS 键盘顶起处理:键盘高度写入 --kb,聊天输入条随之抬高
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    const diff = Math.max(0, window.innerHeight - window.visualViewport.height);
    document.documentElement.style.setProperty('--kb', diff + 'px');
  });
}

route();
onboardIfNeeded();

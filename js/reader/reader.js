// 阅读器:epub.js 生命周期、渲染、目录、字号/主题、进度持久化
import { db } from '../storage/db.js';
import { getAll, update } from '../storage/settings.js';
import { HighlightsManager } from './highlights.js';
import { openChat } from '../ai/chat-ui.js';
import { actionSheet } from '../ui/sheet.js';
import { showToast } from '../ui/toast.js';
import { isCfi } from '../utils/cfi.js';

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

export class ReaderController {
  constructor(bookRec, viewport) {
    this.rec = bookRec;
    this.viewport = viewport;
    this.book = null;
    this.rendition = null;
    this.highlights = null;
    this.tocItems = [];
    this.tocByHref = new Map();
    this.locationsReady = false;
    this.current = null;
    this.saveTimer = null;
  }

  async init() {
    if (!window.ePub) throw new Error('阅读引擎加载失败');
    this.book = window.ePub(this.rec.buffer, { openAs: 'binary' });
    await this.book.ready;

    this.rendition = this.book.renderTo(this.viewport, {
      width: '100%',
      height: '100%',
      flow: 'scrolled-doc',
      allowScriptedContent: false,
    });

    this.registerThemes();
    this.applyAppearance();
    this.buildToc();

    this.highlights = new HighlightsManager({
      rendition: this.rendition,
      book: this.book,
      bookId: this.rec.id,
      chapterOf: (cfi) => this.chapterOf(cfi),
      onAskAI: (ctx) => this.askAI(ctx),
    });
    await this.highlights.init();

    this.rendition.on('relocated', (loc) => this.onRelocated(loc));

    await this.rendition.display(isCfi(this.rec.lastCfi) ? this.rec.lastCfi : undefined);

    this.book.locations.generate(1500)
      .then(() => { this.locationsReady = true; this.updateProgress(); })
      .catch(() => {});
  }

  registerThemes() {
    this.rendition.themes.default({
      body: { 'font-family': FONT_STACK, 'line-height': '1.85' },
    });
    this.rendition.themes.register('light', { body: { background: '#F7F3EA', color: '#2E2A24' } });
    this.rendition.themes.register('dark', { body: { background: '#16130F', color: '#BDB5A9' } });
    this.rendition.themes.register('sepia', { body: { background: '#F2E6CE', color: '#4A3B28' } });
  }

  applyAppearance() {
    const s = getAll();
    try { this.rendition.themes.fontSize(s.fontSize + '%'); } catch (e) {}
    try { this.rendition.themes.select(s.theme === 'dark' || s.theme === 'sepia' ? s.theme : 'light'); } catch (e) {}
  }

  buildToc() {
    this.tocItems = [];
    this.tocByHref = new Map();
    const walk = (items) => {
      for (const it of items || []) {
        const label = (it.label || '').trim();
        if (label && it.href) {
          this.tocItems.push({ label, href: it.href });
          this.tocByHref.set(it.href, label);
        }
        if (it.subitems) walk(it.subitems);
      }
    };
    walk(this.book.navigation.toc);
  }

  chapterOf(cfi) {
    try {
      const section = this.book.spine.get(cfi);
      if (section) {
        const label = this.tocByHref.get(section.href);
        if (label) return label;
      }
    } catch (e) {}
    return '';
  }

  onRelocated(loc) {
    this.current = loc;
    const href = loc && loc.start && loc.start.href;
    const title = this.tocByHref.get(href) || this.rec.title || '';
    document.getElementById('reader-title').textContent = title;
    this.updateProgress();
    this.scheduleSave();
  }

  updateProgress() {
    const fill = document.getElementById('progress-fill');
    const text = document.getElementById('progress-text');
    let pct = 0;
    if (this.current) {
      const cfi = this.current.start.cfi;
      if (this.locationsReady) {
        try { pct = Math.round(this.book.locations.percentageFromCfi(cfi) * 100); } catch (e) { pct = 0; }
      } else if (typeof this.current.start.percentage === 'number') {
        pct = Math.round(this.current.start.percentage * 100);
      }
    }
    fill.style.width = pct + '%';
    text.textContent = pct + '%';
  }

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => { this.saveProgress().catch(() => {}); }, 600);
  }

  async saveProgress() {
    if (!this.current || !this.current.start) return;
    const cfi = this.current.start.cfi;
    let progress = 0;
    if (this.locationsReady) {
      try { progress = this.book.locations.percentageFromCfi(cfi); } catch (e) {}
    }
    this.rec.lastCfi = cfi;
    this.rec.lastReadAt = Date.now();
    this.rec.progress = progress;
    await db.put('books', this.rec);
  }

  async next() { try { await this.rendition.next(); } catch (e) {} }
  async prev() { try { await this.rendition.prev(); } catch (e) {} }

  async openToc() {
    if (!this.tocItems.length) { showToast('这本书没有目录'); return; }
    const id = await actionSheet({
      title: '目录',
      actions: this.tocItems.map((it, i) => ({ id: String(i), label: it.label, icon: '▸' })),
    });
    if (id === 'cancel') return;
    const item = this.tocItems[Number(id)];
    try {
      await this.rendition.display(item.href);
    } catch (e) {
      showToast('跳转失败');
    }
  }

  async openAa() {
    const s = getAll();
    const id = await actionSheet({
      title: '阅读设置',
      actions: [
        { id: 'size-90', label: (s.fontSize === '90' ? '✓ ' : '') + '字号 · 小' },
        { id: 'size-100', label: (s.fontSize === '100' ? '✓ ' : '') + '字号 · 标准' },
        { id: 'size-125', label: (s.fontSize === '125' ? '✓ ' : '') + '字号 · 大' },
        { id: 'size-150', label: (s.fontSize === '150' ? '✓ ' : '') + '字号 · 特大' },
        { id: 'theme-light', label: (s.theme === 'light' ? '✓ ' : '') + '主题 · 浅色' },
        { id: 'theme-sepia', label: (s.theme === 'sepia' ? '✓ ' : '') + '主题 · 护眼' },
        { id: 'theme-dark', label: (s.theme === 'dark' ? '✓ ' : '') + '主题 · 夜间' },
      ],
    });
    if (id === 'cancel') return;
    if (id.startsWith('size-')) {
      const v = id.slice(5);
      update({ fontSize: v });
      try { this.rendition.themes.fontSize(v + '%'); } catch (e) {}
    } else if (id.startsWith('theme-')) {
      const t = id.slice(6);
      update({ theme: t });
      try { this.rendition.themes.select(t); } catch (e) {}
    }
  }

  askAI(ctx = {}) {
    const chapter = ctx.chapter || this.chapterOf(this.current ? this.current.start.cfi : '');
    openChat({
      bookId: this.rec.id,
      bookTitle: this.rec.title,
      chapter,
      quote: ctx.quote || '',
      paragraph: ctx.paragraph || '',
    });
  }

  async destroy() {
    clearTimeout(this.saveTimer);
    try { await this.saveProgress(); } catch (e) {}
    if (this.highlights) this.highlights.destroy();
    if (this.book) { try { this.book.destroy(); } catch (e) {} }
    this.viewport.innerHTML = '';
  }
}

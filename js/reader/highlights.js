// 高亮管理:选中→操作条、增删、CFI 持久化、分节重挂载(全项目风险最高的模块)
import { db, uid } from '../storage/db.js';
import { actionSheet } from '../ui/sheet.js';
import { showToast } from '../ui/toast.js';
import { idrefFromCfi, sameHref } from '../utils/cfi.js';

const HL_CSS = [
  'a.app-hl {',
  '  background-color: rgba(255, 216, 77, 0.45) !important;',
  '  color: inherit !important;',
  '  text-decoration: none !important;',
  '  border-radius: 2px;',
  '}',
  'a.app-hl.tap-flash { background-color: rgba(255, 190, 40, 0.75) !important; }',
].join('\n');

export class HighlightsManager {
  constructor({ rendition, book, bookId, chapterOf, onAskAI }) {
    this.rendition = rendition;
    this.book = book;
    this.bookId = bookId;
    this.chapterOf = chapterOf;
    this.onAskAI = onAskAI;
    this.byId = new Map(); // id -> 高亮记录
    this.injectedDocs = new WeakSet();
  }

  async init() {
    const list = await db.byIndex('highlights', 'bookId', this.bookId);
    for (const h of list) this.byId.set(h.id, h);
    // 每个章节内容加载完成后:注入样式 + 重挂载本小节高亮
    this.rendition.hooks.content.register((contents) => this.onContentsLoaded(contents));
    this.rendition.on('selected', (cfiRange, contents) => this.onSelected(cfiRange, contents));
  }

  onContentsLoaded(contents) {
    const doc = contents && contents.document;
    if (!doc || !doc.head) return;
    if (!this.injectedDocs.has(doc)) {
      this.injectedDocs.add(doc);
      const style = doc.createElement('style');
      style.textContent = HL_CSS;
      doc.head.appendChild(style);
      doc.addEventListener('click', (e) => this.onDocClick(e, contents), true);
    }
    this.remountSection(contents);
  }

  remountSection(contents) {
    const href = contents.section && contents.section.href;
    for (const h of this.byId.values()) {
      let belongs = false;
      try {
        const section = this.book.spine.get(h.cfiRange);
        belongs = section ? sameHref(section.href, href) : sameHref(idrefFromCfi(h.cfiRange), href);
      } catch (e) {
        belongs = sameHref(idrefFromCfi(h.cfiRange), href);
      }
      if (!belongs) continue;
      try {
        this.rendition.annotations.highlight(
          h.cfiRange,
          { id: h.id, text: h.text },
          undefined,
          'app-hl',
          { 'background-color': 'rgba(255,216,77,0.45)' }
        );
      } catch (e) { /* 无法解析的高亮跳过 */ }
    }
  }

  onSelected(cfiRange, contents) {
    const win = contents && contents.window;
    if (!win) return;
    const text = String(win.getSelection().toString() || '').replace(/\s+/g, ' ').trim();
    // 收起 iOS 原生选区气泡
    setTimeout(() => {
      try { win.getSelection().removeAllRanges(); } catch (e) {}
    }, 30);
    if (!text) return;
    if (text.length > 2000) { showToast('选中内容过长'); return; }
    const chapter = this.chapterOf(cfiRange);
    this.showMenu(cfiRange, contents, text, chapter);
  }

  async showMenu(cfiRange, contents, text, chapter) {
    const brief = text.length > 18 ? text.slice(0, 18) + '…' : text;
    const id = await actionSheet({
      title: '"' + brief + '"',
      actions: [
        { id: 'highlight', label: '高亮', icon: '🖍' },
        { id: 'ask', label: '问 DeepSeek', icon: '✦' },
      ],
    });
    if (id === 'cancel') return;
    if (id === 'highlight') await this.addHighlight(cfiRange, text, chapter);
    if (id === 'ask') {
      const paragraph = this.paragraphOf(contents);
      this.onAskAI({ quote: text, chapter, paragraph });
    }
  }

  paragraphOf(contents) {
    try {
      const sel = contents.window.getSelection();
      const node = sel && sel.anchorNode ? sel.anchorNode : null;
      const p = node && node.closest ? node.closest('p, blockquote, li') : null;
      if (p) {
        const t = p.textContent.replace(/\s+/g, ' ').trim();
        return t.length > 400 ? t.slice(0, 400) + '…' : t;
      }
    } catch (e) {}
    return '';
  }

  async addHighlight(cfiRange, text, chapter) {
    const rec = {
      id: uid(),
      bookId: this.bookId,
      cfiRange,
      text,
      color: '#FFD84D',
      chapter,
      createdAt: Date.now(),
    };
    await db.put('highlights', rec);
    this.byId.set(rec.id, rec);
    try {
      this.rendition.annotations.highlight(
        cfiRange,
        { id: rec.id, text },
        undefined,
        'app-hl',
        { 'background-color': 'rgba(255,216,77,0.45)' }
      );
    } catch (e) {
      showToast('高亮已保存,渲染稍后生效');
    }
    showToast('已高亮');
  }

  onDocClick(e, contents) {
    const a = e.target.closest && e.target.closest('a.app-hl');
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    let hit = null;
    try {
      this.rendition.annotations.each((entry) => {
        if (!hit && entry.marker && entry.marker.contains(a)) hit = entry;
      });
    } catch (err) {}
    const rec = hit && hit.data && hit.data.id ? this.byId.get(hit.data.id) : null;
    if (!rec) return;
    this.onTapHighlight(rec, a);
  }

  async onTapHighlight(rec, marker) {
    try { marker.classList.add('tap-flash'); } catch (e) {}
    setTimeout(() => { try { marker.classList.remove('tap-flash'); } catch (e) {} }, 400);
    const brief = rec.text.length > 18 ? rec.text.slice(0, 18) + '…' : rec.text;
    const id = await actionSheet({
      title: '"' + brief + '"',
      actions: [
        { id: 'ask', label: '问 DeepSeek', icon: '✦' },
        { id: 'remove', label: '删除高亮', icon: '🗑', danger: true },
      ],
    });
    if (id === 'cancel') return;
    if (id === 'ask') this.onAskAI({ quote: rec.text, chapter: rec.chapter || '' });
    if (id === 'remove') await this.removeHighlight(rec);
  }

  async removeHighlight(rec) {
    await db.del('highlights', rec.id);
    this.byId.delete(rec.id);
    try { this.rendition.annotations.remove(rec.cfiRange, 'highlight'); } catch (e) {}
    showToast('高亮已删除');
  }

  destroy() {
    this.byId.clear();
  }
}

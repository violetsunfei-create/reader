// 设置页:密钥输入与测试、备份/恢复、版本信息
import { getKey, update } from '../storage/settings.js';
import { testKey, friendlyError } from '../ai/deepseek.js';
import { exportToFile, exportToClipboard, importData } from '../utils/data-io.js';
import { showToast } from '../ui/toast.js';
import { VERSION } from '../version.js';

export function initSettings({ onDataChanged }) {
  const keyInput = document.getElementById('input-key');
  keyInput.value = getKey();
  keyInput.addEventListener('input', () => update({ key: keyInput.value.trim() }));

  document.getElementById('btn-test-key').addEventListener('click', async () => {
    const key = getKey();
    if (!key) { showToast('请先填入 API 密钥'); return; }
    showToast('正在测试…');
    try {
      await testKey(key);
      showToast('✅ 连接成功,可以使用');
    } catch (e) {
      showToast('❌ ' + friendlyError(e));
    }
  });

  document.getElementById('btn-export-file').addEventListener('click', () => {
    exportToFile().catch((e) => showToast('导出失败:' + (e && e.message || '')));
  });
  document.getElementById('btn-export-clip').addEventListener('click', () => {
    exportToClipboard().catch((e) => showToast('导出失败:' + (e && e.message || '')));
  });

  document.getElementById('btn-import-file').addEventListener('click', () => {
    document.getElementById('backup-input').click();
  });
  document.getElementById('backup-input').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      await importData(await f.text());
      showToast('恢复成功');
      if (onDataChanged) onDataChanged();
    } catch (err) {
      showToast('恢复失败:' + (err && err.message || ''));
    }
  });
  document.getElementById('btn-import-clip').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) { showToast('剪贴板为空'); return; }
      await importData(text);
      showToast('恢复成功');
      if (onDataChanged) onDataChanged();
    } catch (err) {
      showToast('恢复失败:' + (err && err.message || ''));
    }
  });

  document.getElementById('app-version').textContent = 'v' + VERSION;
}

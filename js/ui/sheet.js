// 底部弹层:动作条(actionSheet)与确认框(confirmSheet)

function rootEl() {
  return document.getElementById('sheet-root');
}

function buildWrap(close) {
  const wrap = document.createElement('div');
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.addEventListener('click', () => close('cancel'));
  wrap.appendChild(backdrop);
  return { wrap, close };
}

/**
 * 动作条:actions = [{ id, label, icon?, danger? }]
 * resolve(被点击项的 id),点背景/取消/返回键 resolve('cancel')
 */
export function actionSheet({ title, actions, cancelText = '取消' }) {
  return new Promise((resolve) => {
    const { wrap, close } = buildWrap((id) => finish(id));
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    if (title) {
      const t = document.createElement('div');
      t.className = 'sheet-title';
      t.textContent = title;
      sheet.appendChild(t);
    }
    for (const a of actions) {
      const btn = document.createElement('button');
      btn.className = 'sheet-action' + (a.danger ? ' danger' : '');
      btn.innerHTML = '<span class="action-icon">' + (a.icon || '') + '</span><span>' + a.label + '</span>';
      btn.addEventListener('click', () => finish(a.id));
      sheet.appendChild(btn);
    }
    const cancel = document.createElement('button');
    cancel.className = 'sheet-action cancel';
    cancel.textContent = cancelText;
    cancel.addEventListener('click', () => finish('cancel'));
    sheet.appendChild(cancel);
    wrap.appendChild(sheet);
    rootEl().appendChild(wrap);

    function onKey(e) { if (e.key === 'Escape') finish('cancel'); }
    document.addEventListener('keydown', onKey);
    function finish(id) {
      document.removeEventListener('keydown', onKey);
      wrap.remove();
      resolve(id);
    }
  });
}

/**
 * 确认框:resolve(true/false)
 */
export function confirmSheet({ title, message, okLabel = '确定', cancelText = '取消', danger = true }) {
  return new Promise((resolve) => {
    const { wrap, close } = buildWrap(() => finish(false));
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    if (title) {
      const t = document.createElement('div');
      t.className = 'sheet-title';
      t.textContent = title;
      sheet.appendChild(t);
    }
    const msg = document.createElement('div');
    msg.style.cssText = 'text-align:center;padding:10px 16px 16px;font-size:15px;line-height:1.7;';
    msg.textContent = message;
    sheet.appendChild(msg);
    const ok = document.createElement('button');
    ok.className = 'sheet-action' + (danger ? ' danger' : '');
    ok.style.justifyContent = 'center';
    ok.textContent = okLabel;
    ok.addEventListener('click', () => finish(true));
    sheet.appendChild(ok);
    const cancel = document.createElement('button');
    cancel.className = 'sheet-action cancel';
    cancel.textContent = cancelText;
    cancel.addEventListener('click', () => finish(false));
    sheet.appendChild(cancel);
    wrap.appendChild(sheet);
    rootEl().appendChild(wrap);
    function finish(val) {
      wrap.remove();
      resolve(val);
    }
  });
}

// CFI 辅助:CFI 只作不透明键使用,这里仅做归属判断与合法性检查,绝不手工构造

export function isCfi(str) {
  return typeof str === 'string' && str.startsWith('epubcfi(');
}

// 从 CFI 提取 spine idref,例如 epubcfi(/6/4[chap01.xhtml]!/...) → chap01.xhtml
export function idrefFromCfi(cfi) {
  const m = /^epubcfi\(\/6\/\d+\[([^\]]+)\]/.exec(cfi);
  return m ? m[1] : null;
}

// 比较两个 href(忽略路径与锚点差异)
export function sameHref(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const na = String(a).split('/').pop().split('#')[0];
  const nb = String(b).split('/').pop().split('#')[0];
  return na === nb;
}

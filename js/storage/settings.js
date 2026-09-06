// 设置(localStorage):DeepSeek 密钥、字号、主题、引导状态
const KEY = 'shenshen-settings';
const DEFAULTS = { key: '', fontSize: '100', theme: 'light', onboarded: false };

export function getAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

export function get(name) {
  return getAll()[name];
}

export function update(partial) {
  const next = { ...getAll(), ...partial };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function getKey() {
  return (getAll().key || '').trim();
}

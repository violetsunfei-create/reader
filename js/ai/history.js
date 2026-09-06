// 对话历史:按书保存的会话与消息
import { db, uid } from '../storage/db.js';

export async function latestConversation(bookId) {
  const list = await db.byIndex('conversations', 'bookId', bookId);
  list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return list[0] || null;
}

export async function listConversations(bookId) {
  const list = await db.byIndex('conversations', 'bookId', bookId);
  list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return list;
}

export async function messagesOf(convId) {
  const list = await db.byIndex('messages', 'convId', convId);
  list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return list;
}

export function newConversation(bookId, title) {
  const now = Date.now();
  return { id: uid(), bookId, title: title.slice(0, 24), createdAt: now, updatedAt: now };
}

export function newMessage(convId, bookId, role, content, extra = {}) {
  return { id: uid(), convId, bookId, role, content, createdAt: Date.now(), ...extra };
}

export async function deleteConversation(convId) {
  await db.del('conversations', convId);
  await db.delByIndex('messages', 'convId', convId);
}

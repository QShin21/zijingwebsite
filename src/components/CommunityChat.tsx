"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { sendChatAction, hideChatAction } from "@/app/(frontend)/community/actions";
type Message = { id: number; name: string; body: string; createdAt: string; own: boolean; member?: number };
export function CommunityChat({ slug, game, signedIn, manager }: { slug: string; game: number; signedIn: boolean; manager: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("正在连接社群…");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [older, setOlder] = useState(true);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const current = useRef<Message[]>([]);
  const latest = useRef(0);
  const bottom = () => { const box = scroller.current; if (box) box.scrollTop = box.scrollHeight; setUnread(false); };
  const fetchMessages = useCallback(async (history = false, signal?: AbortSignal) => {
    const existing = current.current;
    const query = new URLSearchParams();
    if (history && existing.length) query.set("before", String(existing[0].id));
    else if (latest.current) query.set("after", String(latest.current));
    if (!history && existing.length) query.set("known", existing.slice(-1000).map(m => m.id).join(","));
    const response = await fetch(`/community/${encodeURIComponent(slug)}/chat/feed?${query}`, { cache: "no-store", signal });
    if (!response.ok) throw new Error("聊天记录加载失败，正在尝试重新连接。");
    const data: { messages: Message[]; hasMore: boolean; removed: number[] } = await response.json();
    const box = scroller.current;
    const wasBottom = !box || box.scrollHeight - box.scrollTop - box.clientHeight < 100;
    const previousHeight = box?.scrollHeight || 0;
    const previousTop = box?.scrollTop || 0;
    const map = new Map(current.current.map(m => [m.id, m]));
    data.messages.forEach(m => map.set(m.id, m)); data.removed.forEach(id => map.delete(id));
    const merged = [...map.values()].sort((a, b) => a.id - b.id);
    current.current = merged; setMessages(merged);
    if (!latest.current || history) setOlder(data.hasMore);
    if (data.messages.length) latest.current = Math.max(latest.current, ...data.messages.map(m => m.id));
    if (!history && data.messages.length && !wasBottom) setUnread(true);
    setStatus("已连接 · 每 4 秒更新");
    requestAnimationFrame(() => {
      if (!box) return;
      if (history) box.scrollTop = previousTop + box.scrollHeight - previousHeight;
      else if (wasBottom) box.scrollTop = box.scrollHeight;
    });
  }, [slug]);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try { if (!document.hidden) await fetchMessages(false, controller.signal); }
      catch { if (!controller.signal.aborted) setStatus("连接暂时中断，将自动重试。"); }
      if (!controller.signal.aborted) timer = setTimeout(poll, 4000);
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [fetchMessages]);
  async function history() { setLoading(true); try { await fetchMessages(true); } catch { setError("历史消息加载失败，请重试。"); } finally { setLoading(false); } }
  async function send() {
    if (sending || !body.trim()) return;
    setSending(true); setError("");
    try {
      const result = await sendChatAction(game, body);
      if (result.error) setError(result.error);
      else { setBody(""); await fetchMessages(); requestAnimationFrame(bottom); }
    } catch { setError("发送状态未确认，请查看消息记录后重试。输入内容已保留。"); }
    finally { setSending(false); }
  }
  return <section className="chat-shell"><div className="chat-top"><h2>社群交流</h2><small role="status">{status}</small></div>
    <div className="chat-history" ref={scroller} onScroll={() => { const b = scroller.current; if (b && b.scrollHeight - b.scrollTop - b.clientHeight < 100) setUnread(false); }}>
      {older && <button className="moderate-button chat-older" disabled={loading} onClick={history}>{loading ? "正在加载…" : "加载更早消息"}</button>}
      {!messages.length && <p className="chat-empty">这里还没有消息，和伙伴打个招呼吧。</p>}
      <div role="log" aria-label="社群聊天记录" aria-live="off">{messages.map(message => <article key={message.id} className={`chat-message ${message.own ? "chat-own" : ""}`}>
        <span className="chat-avatar" aria-hidden="true">{message.name.slice(0, 1)}</span><div className="chat-bubble-wrap"><div className="chat-meta"><strong>{message.name}</strong><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</time></div>
        <p className="chat-bubble">{message.body}</p>{manager && <button className="moderate-button" onClick={async () => {
          const result = await hideChatAction(message.id);
          if (result.error) setError(result.error); else await fetchMessages();
        }}>隐藏消息</button>}</div>
      </article>)}</div>
    </div>
    {unread && <button className="button chat-unread" onClick={bottom}>有新消息 · 回到底部 ↓</button>}
    <p role="alert">{error}</p>
    {signedIn ? <form className="chat-compose" onSubmit={event => { event.preventDefault(); void send(); }}>
      <label htmlFor="chat-input">发消息</label><textarea id="chat-input" value={body} onChange={event => setBody(event.target.value)} maxLength={5000} rows={3} placeholder="聊聊近况、约个时间一起玩…" onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
      <div className="dialog-top"><small>Ctrl / ⌘ + Enter 发送 · 最多 5000 字</small><button className="button" disabled={sending || !body.trim()}>{sending ? "发送中…" : "发送"}</button></div>
    </form> : <a className="button" href="/login">登录后参与聊天</a>}
  </section>;
}

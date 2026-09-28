"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { sendChatAction } from "@/app/(frontend)/community/actions";
type Message = { id: number; name: string; body: string; image?: string; createdAt: string; own: boolean; member?: number };
export function CommunityChat({ slug, game, signedIn }: { slug: string; game: number; signedIn: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [image, setImage] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [stickers, setStickers] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState("");
  const sendLock = useRef(false);
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) { setError("请选择 8 MB 以内的 JPG、PNG、WebP 或 GIF 图片"); return; }
    setImageBusy(true); setError("");
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      setImage(data);
    } catch { setError("图片读取失败，请重试。"); }
    finally { setImageBusy(false); }
  }
  async function search() {
    if (!keyword.trim() || searching) return;
    setSearching(true); setSearchNote(""); setStickers([]);
    try {
      const response = await fetch(`/community/stickers?q=${encodeURIComponent(keyword.trim())}`);
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setStickers(result.images); if (!result.images.length) setSearchNote("没有找到表情，换个词试试。");
    } catch { setSearchNote("表情搜索暂时不可用，请稍后重试。"); }
    finally { setSearching(false); }
  }
  async function chooseSticker(url: string) {
    setImageBusy(true); setError("");
    try {
      const response = await fetch(`/community/stickers?image=${encodeURIComponent(url)}`);
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setImage(result.image); setStickersOpen(false);
    } catch { setError("表情加载失败，请换一张或稍后重试。"); }
    finally { setImageBusy(false); }
  }
  const [status, setStatus] = useState("正在连接社群…");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [older, setOlder] = useState(true);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const current = useRef<Message[]>([]);
  const latest = useRef(0);
  const fetchQueue = useRef<Promise<unknown>>(Promise.resolve());
  const bottom = () => { const box = scroller.current; if (box) box.scrollTop = box.scrollHeight; setUnread(false); };
  const fetchMessages = useCallback((history = false, signal?: AbortSignal) => {
    const job = fetchQueue.current.catch(() => {}).then(async () => {
    if (signal?.aborted) return false;
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

    requestAnimationFrame(() => {
      if (!box) return;
      if (history) box.scrollTop = previousTop + box.scrollHeight - previousHeight;
      else if (wasBottom) box.scrollTop = box.scrollHeight;
    });
    return !history && data.hasMore && data.messages.length > 0;
    });
    fetchQueue.current = job;
    return job;
  }, [slug]);
  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    let pending = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const source = new EventSource(`/community/${encodeURIComponent(slug)}/chat/stream`);
    async function refresh() {
      pending = true;
      if (running) return;
      running = true;
      try {
        while (pending && !controller.signal.aborted) {
          pending = false;
          if (await fetchMessages(false, controller.signal)) pending = true;
          if (source.readyState === EventSource.OPEN) setStatus("已连接 · 实时更新");
        }
      } catch {
        if (!controller.signal.aborted) {
          setStatus("消息同步中断，正在重试…");
          clearTimeout(retry);
          retry = setTimeout(() => void refresh(), 1000);
        }
      } finally { running = false; }
    }
    source.addEventListener("ready", () => { setStatus("已连接 · 实时更新"); void refresh(); });
    source.addEventListener("change", () => void refresh());
    source.onerror = () => setStatus("连接暂时中断，将自动重连。");
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { controller.abort(); source.close(); clearTimeout(retry); document.removeEventListener("visibilitychange", visible); };
  }, [fetchMessages, slug]);
  async function history() { setLoading(true); try { await fetchMessages(true); } catch { setError("历史消息加载失败，请重试。"); } finally { setLoading(false); } }
  async function send() {
    if (sendLock.current || imageBusy || (!body.trim() && !image)) return;
    sendLock.current = true;
    setSending(true); setError("");
    try {
      const result = await sendChatAction(game, body, image || undefined);
      if (result.error) setError(result.error);
      else { setBody(""); setImage(""); await fetchMessages(); requestAnimationFrame(bottom); }
    } catch { setError("发送状态未确认，请查看消息记录后重试。输入内容已保留。"); }
    finally { setSending(false); sendLock.current = false; }
  }
  useEffect(() => {
    const el = inputRef.current;
    if (!el || !signedIn) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      if (!event.ctrlKey) { void send(); return; }
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = body.slice(0, start) + "\n" + body.slice(end);
      if (next.length > 5000) return;
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setValue?.call(el, next);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.setSelectionRange(start + 1, start + 1);
    };
    el.addEventListener("keydown", handleKey);
    return () => el.removeEventListener("keydown", handleKey);
  }, [body, image, imageBusy, sending, signedIn]);
  return <section className="chat-shell"><div className="chat-top"><h2>社群交流</h2><small role="status">{status}</small></div>
    <div className="chat-history" ref={scroller} onScroll={() => { const b = scroller.current; if (b && b.scrollHeight - b.scrollTop - b.clientHeight < 100) setUnread(false); }}>
      {older && <button className="moderate-button chat-older" disabled={loading} onClick={history}>{loading ? "正在加载…" : "加载更早消息"}</button>}
      {!messages.length && <p className="chat-empty">这里还没有消息，和伙伴打个招呼吧。</p>}
      <div role="log" aria-label="社群聊天记录" aria-live="off">{messages.map(message => <article key={message.id} className={`chat-message ${message.own ? "chat-own" : ""}`}>
        <span className="chat-avatar" aria-hidden="true">{message.name.slice(0, 1)}</span><div className="chat-bubble-wrap"><div className="chat-meta"><strong>{message.name}</strong><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</time></div>
        {message.body && <p className="chat-bubble">{message.body}</p>}
        {message.image && <a href={message.image} target="_blank" rel="noreferrer" aria-label="查看聊天图片">
          <img className="chat-image" src={message.image} alt="聊天图片" loading="lazy" onLoad={() => { const b = scroller.current; if (b && b.scrollHeight - b.scrollTop - b.clientHeight < 350) bottom(); }} /></a>}</div>
      </article>)}</div>
    </div>
    {unread && <button className="button chat-unread" onClick={bottom}>有新消息 · 回到底部 ↓</button>}
    <p role="alert">{error}</p>
    {signedIn ? <form className="chat-compose" onSubmit={event => { event.preventDefault(); void send(); }}>
      <div className="chat-tools"><label className="button">添加图片<input aria-label="添加图片" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={sending || imageBusy} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} /></label><button type="button" className="button" aria-expanded={stickersOpen} onClick={() => setStickersOpen(!stickersOpen)}>搜索表情包</button></div>
      {stickersOpen && <div className="sticker-panel"><label htmlFor="sticker-query">表情关键词</label><div className="chat-tools"><input id="sticker-query" value={keyword} maxLength={40} placeholder="例如：开心、收到、熊猫头" onChange={e => setKeyword(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); void search(); } }} /><button type="button" disabled={searching || !keyword.trim()} onClick={() => void search()}>{searching ? "搜索中…" : "搜索"}</button></div><small>来源：<a href="https://www.doutupk.com" target="_blank" rel="noreferrer">斗图啦</a> · 选择后点击发送</small><p role="status">{searchNote}</p><div className="sticker-results">{stickers.map((url, i) => <button type="button" key={url} aria-label={`选择表情 ${i + 1}`} disabled={imageBusy || sending} onClick={() => void chooseSticker(url)}><img src={`/community/stickers?preview=1&image=${encodeURIComponent(url)}`} alt={`${keyword}表情 ${i + 1}`} loading="lazy" /></button>)}</div></div>}
      {imageBusy && <p role="status">正在准备图片…</p>}
      {image && <div className="chat-attachment"><img src={image} alt="待发送图片" /><button type="button" disabled={sending} onClick={() => setImage("")}>移除图片</button><small>发送时自动压缩 · 保留动图</small></div>}
      <label htmlFor="chat-input">发消息</label><textarea id="chat-input" ref={inputRef} disabled={sending} value={body} onChange={event => setBody(event.target.value)} maxLength={5000} rows={3} placeholder="聊聊近况、约个时间一起玩…" />
      <div className="dialog-top"><small>Enter 发送 · Ctrl + Enter 换行 · 最多 5000 字</small><button className="button" disabled={sending || imageBusy || (!body.trim() && !image)}>{sending ? "发送中…" : "发送"}</button></div>
    </form> : <a className="button" href="/login">登录后参与聊天</a>}
  </section>;
}

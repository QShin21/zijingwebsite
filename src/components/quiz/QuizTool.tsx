"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useT } from "@/components/i18n/LocaleProvider";
import { TaskFrame } from "@/components/v2/TaskFrame";
import styles from "./quiz.module.css";

type Question = { prompt: string; options: string[] };
type Prize = { id: number; name: string; quantity: number; remaining: number };
type Round = { id: number; title: string; threshold: number; questions: Question[]; status: string; closesAt: string | null;
  submissionCount?: number; correctAnswers: number[] | null; entry: null | { answers: number[]; score: number | null; eligible: boolean; prize: string | null } };
type Event = { id: number; title: string; description: string; status: string };
type Detail = { admin: boolean; event: Event; prizes: Prize[]; rounds: Round[];
  winners: { round_id: number; user_id: number | null; name: string; prize: string; drawn_at: string }[] };
type Listing = { admin: boolean; events: Event[] };
type Send = (data: Record<string, unknown>, confirm?: string) => Promise<boolean>;

async function request<T>(path: string, data?: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, data ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) } : { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "请求未完成");
  return result as T;
}
function localDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function displayDate(value: string | null) { return value ? new Date(value).toLocaleString() : ""; }

function EventEditor({ event, send }: { event: Event; send: Send }) {
  const t = useT();
  const [title, setTitle] = useState(event.title), [description, setDescription] = useState(event.description);
  const [status, setStatus] = useState(event.status);
  return <form className={styles.form} onSubmit={e => { e.preventDefault(); void send({ action: "update-event", title, description, status }); }}>
    <label>{t("活动名称", "Event name")}<input maxLength={120} required value={title} onChange={e => setTitle(e.target.value)} /></label>
    <label>{t("活动说明", "Event description")}<textarea maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} /></label>
    <label>{t("活动状态", "Event status")}<select value={status} onChange={e => setStatus(e.target.value)}>
      {event.status === "draft" && <option value="draft">{t("草稿", "Draft")}</option>}
      <option value="published">{t("已发布", "Published")}</option><option value="archived">{t("已结束", "Archived")}</option>
    </select></label><button>{t("保存活动", "Save event")}</button>
  </form>;
}

function PrizeEditor({ prize, send }: { prize: Prize; send: Send }) {
  const t = useT();
  const [name, setName] = useState(prize.name), [quantity, setQuantity] = useState(String(prize.quantity));
  return <form className={styles.inline} onSubmit={e => { e.preventDefault(); void send({ action: "edit-prize", prizeId: prize.id, name, quantity }); }}>
    <label>{t("奖品", "Prize")}<input aria-label={t("奖品名称", "Prize name")} maxLength={120} required value={name} onChange={e => setName(e.target.value)} /></label>
    <label>{t("总数", "Total")}<input aria-label={t("奖品总数", "Prize total")} type="number" min="1" max="100000" required value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
    <span>{t(`剩余 ${prize.remaining}`, `${prize.remaining} remaining`)}</span><button>{t("保存", "Save")}</button>
  </form>;
}

function RoundEditor({ round, send, done }: { round?: Round; send: Send; done?: () => void }) {
  const t = useT();
  const [title, setTitle] = useState(round?.title ?? ""), [threshold, setThreshold] = useState(String(round?.threshold ?? 1));
  const [closesAt, setClosesAt] = useState(localDate(round?.closesAt));
  const [items, setItems] = useState<Question[]>(round?.questions ?? [{ prompt: "", options: ["", ""] }]);
  function changeQuestion(index: number, value: Question) { setItems(items.map((item, i) => i === index ? value : item)); }
  return <form className={styles.form} onSubmit={async e => {
    e.preventDefault();
    const result = await send({ action: "save-round", ...(round ? { roundId: round.id } : {}), title, threshold,
      questions: items, closesAt: closesAt ? new Date(closesAt).toISOString() : null });
    if (result) { if (!round) { setTitle(""); setThreshold("1"); setClosesAt(""); setItems([{ prompt: "", options: ["", ""] }]); } done?.(); }
  }}>
    <label>{t("轮次名称", "Round name")}<input required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} /></label>
    <div className={styles.inline}><label>{t("答对门槛", "Correct answers required")}<input type="number" min="1" max={items.length} required value={threshold} onChange={e => setThreshold(e.target.value)} /></label>
      <label>{t("截止时间（本地时间，可留空）", "Deadline (local time, optional)")}<input type="datetime-local" value={closesAt} onChange={e => setClosesAt(e.target.value)} /></label></div>
    {items.map((item, i) => <fieldset key={i} className={styles.question}><legend>{t(`第 ${i + 1} 题`, `Question ${i + 1}`)}</legend>
      <label>{t("题目", "Question")}<input required maxLength={300} value={item.prompt} onChange={e => changeQuestion(i, { ...item, prompt: e.target.value })} /></label>
      {item.options.map((option, j) => <div className={styles.inline} key={j}>
        <label>{t(`选项 ${j + 1}`, `Option ${j + 1}`)}<input required maxLength={160} value={option} onChange={e => changeQuestion(i, { ...item, options: item.options.map((v, k) => k === j ? e.target.value : v) })} /></label>
        {item.options.length > 2 && <button type="button" onClick={() => changeQuestion(i, { ...item, options: item.options.filter((_, k) => k !== j) })}>{t("删除选项", "Remove option")}</button>}
      </div>)}
      <div className={styles.actions}>{item.options.length < 8 && <button type="button" onClick={() => changeQuestion(i, { ...item, options: [...item.options, ""] })}>{t("增加选项", "Add option")}</button>}
        {items.length > 1 && <button type="button" onClick={() => setItems(items.filter((_, k) => k !== i))}>{t("删除本题", "Remove question")}</button>}</div>
    </fieldset>)}
    <div className={styles.actions}>{items.length < 30 && <button type="button" onClick={() => setItems([...items, { prompt: "", options: ["", ""] }])}>{t("增加题目", "Add question")}</button>}
      <button>{t("保存轮次草稿", "Save round draft")}</button>{done && <button type="button" onClick={done}>{t("取消", "Cancel")}</button>}</div>
  </form>;
}

function RoundCard({ round, admin, active, send }: { round: Round; admin: boolean; active: boolean; send: Send }) {
  const t = useT();
  const [selected, setSelected] = useState<Record<number, number>>({}), [correct, setCorrect] = useState<Record<number, number>>({}), [editing, setEditing] = useState(false);
  const states: Record<string, string> = { draft: t("草稿", "Draft"), open: t("作答中", "Open"), closed: t("已截止", "Closed"), settled: t("已公布答案", "Results published") };
  function selectedAnswers(values: Record<number, number>) { return round.questions.map((_, i) => values[i] ?? null); }
  return <article className={styles.card}>
    <div className={styles.cardHead}><div><span className={styles.badge}>{states[round.status]}</span><h3>{round.title}</h3></div>
      <span>{t(`答对 ${round.threshold} 题可抽奖`, `${round.threshold} correct to draw`)}</span></div>
    {round.closesAt && <p>{t("截止：", "Deadline: ")}{displayDate(round.closesAt)}</p>}
    {admin && <p>{t(`已提交 ${round.submissionCount ?? 0} 人`, `${round.submissionCount ?? 0} submissions`)}</p>}
    {editing ? <RoundEditor round={round} send={send} done={() => setEditing(false)} /> : <>
      {round.questions.map((q, i) => <fieldset key={i} className={styles.question}><legend>{i + 1}. {q.prompt}</legend>
        {q.options.map((option, j) => <label key={j} className={styles.option}>
          {round.status === "open" && !round.entry && active && <input type="radio" name={`round-${round.id}-${i}`} checked={selected[i] === j} onChange={() => setSelected({ ...selected, [i]: j })} />}
          <span>{option}</span>{round.entry?.answers[i] === j && <strong>{t("你的选择", "Your choice")}</strong>}
          {round.correctAnswers?.[i] === j && <strong>{t("正确答案", "Correct")}</strong>}
        </label>)}
        {admin && round.status === "closed" && <label>{t("公布正确选项", "Correct answer")}<select value={correct[i] ?? ""} onChange={e => {
          if (e.target.value === "") { const next = { ...correct }; delete next[i]; setCorrect(next); }
          else setCorrect({ ...correct, [i]: Number(e.target.value) });
        }}>
          <option value="">{t("请选择", "Select")}</option>{q.options.map((option, j) => <option key={j} value={j}>{option}</option>)}</select></label>}
      </fieldset>)}
      {round.entry ? <p className={styles.result}>{round.entry.score === null ? t("已提交，等待公布答案。", "Submitted; waiting for results.") :
        t(`答对 ${round.entry.score} 题。`, `${round.entry.score} correct.`)} {round.entry.prize ? t(`获得：${round.entry.prize}`, `Prize: ${round.entry.prize}`) : ""}</p> : null}
      <div className={styles.actions}>
        {round.status === "open" && !round.entry && active && <button onClick={() => void send({ action: "submit", roundId: round.id, answers: selectedAnswers(selected) }, t("确认提交？提交后不能修改。", "Submit your answers? They cannot be changed."))}>{t("提交竞猜", "Submit answers")}</button>}
        {round.entry?.eligible && !round.entry.prize && active && <button onClick={() => void send({ action: "draw", roundId: round.id })}>{t("抽取奖品", "Draw a prize")}</button>}
        {admin && round.status === "draft" && <><button onClick={() => setEditing(true)}>{t("编辑轮次", "Edit round")}</button><button onClick={() => void send({ action: "open-round", roundId: round.id }, t("开放后题目与门槛将锁定，确认开放？", "Open this round and lock its questions?"))}>{t("开放竞猜", "Open round")}</button></>}
        {admin && round.status === "open" && <button onClick={() => void send({ action: "close-round", roundId: round.id }, t("确认截止本轮？", "Close this round?"))}>{t("截止竞猜", "Close round")}</button>}
        {admin && round.status === "closed" && <button onClick={() => void send({ action: "settle-round", roundId: round.id, answers: selectedAnswers(correct) }, t("确认公布答案？公布后答案将锁定。", "Publish and lock the correct answers?"))}>{t("公布答案", "Publish answers")}</button>}
      </div>
    </>}
  </article>;
}

export function QuizTool() {
  const t = useT();
  const [listing, setListing] = useState<Listing | null>(null), [detail, setDetail] = useState<Detail | null>(null);
  const [eventID, setEventID] = useState<number | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const [title, setTitle] = useState(""), [description, setDescription] = useState(""), [prizeName, setPrizeName] = useState(""), [quantity, setQuantity] = useState("1");
  const load = useCallback(async (id: number | null) => {
    setLoading(true); setError("");
    try { const list = await request<Listing>("/api/quiz"); setListing(list); setDetail(id ? await request<Detail>(`/api/quiz?event=${id}`) : null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "加载失败"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const param = new URLSearchParams(window.location.search).get("event"); const id = param && /^[1-9]\d*$/.test(param) ? Number(param) : null; setEventID(id); void load(id); }, [load]);
  function select(id: number | null) { setEventID(id); setDetail(null); setMessage(""); window.history.replaceState(null, "", id ? `/quiz?event=${id}` : "/quiz"); void load(id); }
  const send: Send = async (data, confirm) => {
    if (busy || (confirm && !window.confirm(confirm))) return false;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await request<{ id?: number; prize?: string }>("/api/quiz", { ...data, ...(eventID ? { eventId: eventID } : {}) });
      if (result.prize) setMessage(t(`抽奖结果：${result.prize}`, `Your prize: ${result.prize}`));
      else setMessage(t("操作完成。", "Saved."));
      if (data.action === "create-event" && result.id) { setTitle(""); setDescription(""); select(result.id); }
      else await load(eventID);
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "操作失败"); return false; }
    finally { setBusy(false); }
  };
  function create(e: FormEvent) { e.preventDefault(); void send({ action: "create-event", title, description }); }
  const admin = detail?.admin ?? listing?.admin ?? false;
  return <TaskFrame eyebrow="QUIZ & PRIZES" title={t("竞猜与抽奖", "Quiz & prize draw")}
    description={t("参与每轮竞猜，达到门槛即可从活动共享奖池抽取奖品。", "Answer each round to earn a draw from the event's shared prize pool.")} back={{ href: "/", label: t("返回主场", "Back to home") }} wide>
    <div className={styles.tool} aria-busy={busy || loading}>
      {eventID && <button className={styles.back} onClick={() => select(null)}>{t("← 所有竞猜活动", "← All quiz events")}</button>}
      {error && <div className={styles.error} role="alert">{error} <button onClick={() => void load(eventID)}>{t("重新加载", "Reload")}</button></div>}
      {message && <p className={styles.message} role="status">{message}</p>}
      {loading && <p>{t("正在加载…", "Loading…")}</p>}
      {!eventID && listing && <>
        <section className={styles.card}><h2>{t("竞猜活动", "Quiz events")}</h2>
          {listing.events.length ? <div className={styles.list}>{listing.events.map(event => <button key={event.id} className={styles.event} onClick={() => select(event.id)}><strong>{event.title}</strong><span>{event.description}</span><span>{event.status === "draft" ? t("草稿", "Draft") : event.status === "archived" ? t("已结束", "Archived") : t("查看轮次 →", "View rounds →")}</span></button>)}</div> : <p>{t("目前还没有竞猜活动。", "No quiz events yet.")}</p>}
        </section>
        {admin && <section className={styles.card}><h2>{t("创建竞猜活动", "Create quiz event")}</h2><form className={styles.form} onSubmit={create}>
          <label>{t("活动名称", "Event name")}<input maxLength={120} required value={title} onChange={e => setTitle(e.target.value)} /></label>
          <label>{t("活动说明", "Event description")}<textarea maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} /></label>
          <button disabled={busy}>{t("创建活动草稿", "Create event draft")}</button></form></section>}
      </>}
      {detail && <>
        <section className={styles.card}><span className={styles.badge}>{detail.event.status === "draft" ? t("草稿", "Draft") : detail.event.status === "archived" ? t("已结束", "Archived") : t("进行中", "Active")}</span>
          <h2>{detail.event.title}</h2><p>{detail.event.description}</p>
          {admin && <details><summary>{t("管理活动", "Manage event")}</summary><EventEditor key={JSON.stringify(detail.event)} event={detail.event} send={send} /></details>}
        </section>
        <section className={styles.card}><h2>{t("活动共享奖池", "Shared prize pool")}</h2>
          <p>{t("每次从剩余奖品中随机抽取，奖池由所有轮次共用。", "Each draw randomly selects from the remaining prizes shared by all rounds.")}</p>
          {detail.prizes.length ? <ul className={styles.prizes}>{detail.prizes.map(p => <li key={p.id}><strong>{p.name}</strong><span>{t(`剩余 ${p.remaining} / ${p.quantity}`, `${p.remaining} / ${p.quantity} remaining`)}</span></li>)}</ul> : <p>{t("奖池正在设置。", "The prize pool is being prepared.")}</p>}
          {admin && <details><summary>{t("设置奖池", "Manage prizes")}</summary>{detail.prizes.map(p => <PrizeEditor key={`${p.id}-${p.quantity}-${p.name}`} prize={p} send={send} />)}
            <form className={styles.inline} onSubmit={async e => { e.preventDefault(); if (await send({ action: "add-prize", name: prizeName, quantity })) { setPrizeName(""); setQuantity("1"); } }}>
              <label>{t("新奖品", "New prize")}<input required maxLength={120} value={prizeName} onChange={e => setPrizeName(e.target.value)} /></label>
              <label>{t("数量", "Quantity")}<input required type="number" min="1" max="100000" value={quantity} onChange={e => setQuantity(e.target.value)} /></label><button>{t("加入奖池", "Add prize")}</button>
            </form></details>}
        </section>
        <section><h2>{t("竞猜轮次", "Quiz rounds")}</h2>{detail.rounds.length ? detail.rounds.map(round => <RoundCard key={`${round.id}-${round.status}`} round={round} active={detail.event.status === "published"} admin={admin} send={send} />) : <p>{t("轮次正在筹备。", "Rounds are being prepared.")}</p>}</section>
        {admin && <><section className={styles.card}><h2>{t("新增竞猜轮次", "Add a round")}</h2><p>{t("每题为单选题；开放后题目和门槛锁定。", "Each question has one answer; opening locks the questions and threshold.")}</p><RoundEditor send={send} /></section>
          <section className={styles.card}><h2>{t("中奖记录", "Prize records")}</h2>{detail.winners.length ? <ul className={styles.prizes}>{detail.winners.map((record, i) => <li key={`${record.round_id}-${record.user_id}-${i}`}><span>{record.name} · {detail.rounds.find(round => round.id === record.round_id)?.title}</span><strong>{record.prize}</strong></li>)}</ul> : <p>{t("暂时没有中奖记录。", "No prizes drawn yet.")}</p>}</section></>}
      </>}
    </div>
  </TaskFrame>;
}

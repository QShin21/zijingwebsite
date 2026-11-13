"use client";
import { useState } from "react";
import type { StaffBatch } from "@/payload-types";
import { SignupBuilder } from "./SignupBuilder";
import {
  defaultStaffForm,
  staffForm,
  staffWindow,
} from "@/lib/staff-recruitment-model";
import { saveStaffBatchAction } from "@/app/(frontend)/staff/manage/actions";
import { ActionForm } from "./activity-pages/ActionForm";
import styles from "./activity-pages/Workspace.module.css";
import { useLocale, useT } from "./i18n/LocaleProvider";
import { accountLabel } from "@/lib/i18n/labels-account";

const localDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
};
const isoDate = (value: string) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : "";
export function StaffBatchEditor({ batch }: { batch?: StaffBatch }) {
  const t = useT(),
    locale = useLocale();
  const [form, setForm] = useState(() =>
    batch ? staffForm(batch.signupForm) : defaultStaffForm,
  );
  const [start, setStart] = useState(localDate(batch?.startAt)),
    [end, setEnd] = useState(localDate(batch?.endAt));
  const [title, setTitle] = useState(batch?.title ?? ""),
    [description, setDescription] = useState(batch?.description ?? "");
  const [identity, setIdentity] = useState({
    id: batch?.id,
    revision: batch?.updatedAt ?? "",
  });
  return (
    <details className={styles.batch}>
      <summary>
        <span>
          {batch
            ? t("配置批次：", "Configure batch: ") + batch.title
            : identity.id
              ? t("已保存批次：", "Saved batch: ") + title
              : t("创建骨干招新批次", "Create a staff recruitment batch")}
        </span>
        <span className={styles.batchMeta}>
          {batch
            ? (batch.state === "draft" ? t("草稿 · 未公开", "Draft · not public") : accountLabel(staffWindow(batch), locale)) +
              " · " +
              t(`批次 ${batch.id}`, `Batch ${batch.id}`)
            : t("配置说明、开放时间与申请问卷", "Set the description, dates and application form")}
        </span>
      </summary>
      <ActionForm
        action={saveStaffBatchAction}
        onSuccess={(result) =>
          setIdentity({ id: result.id, revision: result.revision ?? "" })
        }
      >
        <input type="hidden" name="id" value={identity.id ?? ""} />
        <input type="hidden" name="revision" value={identity.revision} />
        <section className={styles.batchFields}>
          <header>
            <h3>{t("批次说明与开放安排", "Description and schedule")}</h3>
            <p>{t("向同学说明职责、申请条件和后续选拔安排。", "Explain duties, requirements and the selection process.")}</p>
          </header>
          <label>
            {t("批次标题", "Batch title")}
            <input
              name="title"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            {t("批次说明", "Batch description")}
            <textarea
              name="description"
              maxLength={5000}
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className={styles.toolbar}>
            <label>
              {t("开始时间", "Start time")}
              <input
                type="datetime-local"
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </label>
            <label>
              {t("截止时间", "Deadline")}
              <input
                type="datetime-local"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </label>
          </div>
        </section>
        <input type="hidden" name="startAt" value={isoDate(start)} />
        <input type="hidden" name="endAt" value={isoDate(end)} />
        <p className={styles.scope}>
          {t("同一时间只有一个当前批次。截止或关闭后申请只读；已有录用结果的申请须明确退回后才可补充。录用不会授予账号角色。", "Only one batch is current at a time. After the deadline or closing, applications are read-only; decided applications must be returned explicitly before they can be updated. Acceptance does not grant an account role.")}
        </p>
        <section className={styles.batchQuestionnaire}>
          <SignupBuilder value={form} onChange={setForm} />
        </section>
        <input type="hidden" name="signupForm" value={JSON.stringify(form)} />
        <p>{t("保留必要资料与执行／宣传方向选择。不要求身份证、住址或健康信息。", "Keep the required fields and the Operations/Publicity choice. Do not ask for ID numbers, addresses or health information.")}</p>
        <div className={styles.saveBar}>
          <p>
            {t("保存草稿不公开。发布后，同学可在开放时间内提交申请；关闭后已有申请保留为只读回执。", "Drafts are not public. Once published, students can apply while it is open; after closing, applications remain as read-only receipts.")}
          </p>
          <div className="reaction-bar">
            <button
              type="submit"
              name="state"
              value="draft"
              className="button light"
            >
              {t("保存草稿", "Save draft")}
            </button>
            <button type="submit" name="state" value="open" className="button">
              {t("发布骨干招新", "Publish recruitment")}
            </button>
            <button
              type="submit"
              name="state"
              value="closed"
              className="button light"
              disabled={!identity.id}
            >
              {t("关闭批次", "Close batch")}
            </button>
          </div>
        </div>
        {batch && batch.updatedAt !== identity.revision && (
          <p className={styles.scope}>
            {t("此批次已有更新。当前编辑仍保留，载入最新配置后可继续修改。", "This batch has been updated. Your edits are kept; load the latest settings to continue.")}
            <button
              type="button"
              onClick={() => {
                setForm(staffForm(batch.signupForm));
                setTitle(batch.title);
                setDescription(batch.description ?? "");
                setStart(localDate(batch.startAt));
                setEnd(localDate(batch.endAt));
                setIdentity({ id: batch.id, revision: batch.updatedAt });
              }}
            >
              {t("载入最新配置并替换当前编辑", "Load latest settings and replace my edits")}
            </button>
          </p>
        )}
      </ActionForm>
    </details>
  );
}

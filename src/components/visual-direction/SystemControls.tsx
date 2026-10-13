"use client";
import { useId, useRef, useState } from "react";

/** An explicitly labelled interaction specimen, never a substitute for a business submission. */
export function SystemControls() {
  const id = useId();
  const first = useRef<HTMLInputElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [checked, setChecked] = useState(false);
  return (
    <form
      className="z-specimen-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const missing = !first.current?.value.trim();
        setError(missing);
        setChecked(!missing);
        if (missing) requestAnimationFrame(() => summary.current?.focus());
      }}
    >
      <p className="z-muted">
        控件交互样张，仅在本页检查输入，不提交业务资料。
      </p>
      {error && (
        <div className="z-field-error" ref={summary} tabIndex={-1} role="alert">
          <strong>请检查示例字段</strong>
          <a href={"#" + id + "-name"} onClick={() => first.current?.focus()}>
            填写活动名称后再检查
          </a>
        </div>
      )}
      <label htmlFor={id + "-name"}>
        活动名称 <span>必填</span>
      </label>
      <input
        ref={first}
        id={id + "-name"}
        name="name"
        required
        aria-invalid={error || undefined}
        aria-describedby={id + "-hint"}
        placeholder="例如：周末同好交流"
        onInput={() => {
          setError(false);
          setChecked(false);
        }}
      />
      <p id={id + "-hint"} className="z-field-hint">
        切换主题会保留正在填写的内容。
      </p>
      <label htmlFor={id + "-note"}>
        补充说明 <span>选填</span>
      </label>
      <textarea id={id + "-note"} name="note" rows={3} />
      <label htmlFor={id + "-file"}>
        附件预览 <span>仅选择，不上传</span>
      </label>
      <input id={id + "-file"} name="file" type="file" accept="image/*" />
      <label className="z-specimen-check">
        <input type="checkbox" name="acknowledged" /> 我了解这是一份交互样张
      </label>
      <div className="z-specimen-actions">
        <button className="z-button" type="submit">
          检查示例字段
        </button>
        <LinkButton />
      </div>
      {checked && (
        <p className="z-field-success" role="status">
          示例字段检查完成。没有提交申请或上传附件。
        </p>
      )}
    </form>
  );
}
function LinkButton() {
  return (
    <a className="z-text-link" href="/community/apply">
      进入真实社群申请
    </a>
  );
}

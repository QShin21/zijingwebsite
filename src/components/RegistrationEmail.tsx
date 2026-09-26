"use client";

import { useId, useState } from "react";

export function RegistrationEmail() {
  const hintId = useId();
  const [domain, setDomain] = useState("mails.tsinghua.edu.cn");
  const [local, setLocal] = useState("");
  const [manual, setManual] = useState("");
  const isManual = domain === "manual";

  return (
    <div className="registration-email">
      <label>
        邮箱后缀
        <select
          value={domain}
          onChange={(event) => {
            const next = event.target.value;
            if (next === "manual" && !manual && local) {
              setManual(`${local}@${domain}`);
            }
            setDomain(next);
          }}
        >
          <option value="mails.tsinghua.edu.cn">
            学生邮箱 @mails.tsinghua.edu.cn
          </option>
          <option value="tsinghua.org.cn">校友邮箱 @tsinghua.org.cn</option>
          <option value="manual">其他清华邮箱，手动填写</option>
        </select>
      </label>
      <label>
        {isManual ? "完整清华邮箱" : "邮箱 @ 前的部分"}
        <input
          key={isManual ? "manual" : "local"}
          type={isManual ? "email" : "text"}
          value={isManual ? manual : local}
          onChange={(event) => {
            if (isManual) setManual(event.target.value);
            else setLocal(event.target.value);
          }}
          required
          maxLength={isManual ? 254 : 64}
          pattern={isManual ? undefined : "[^@\\s]+"}
          autoComplete={isManual ? "email" : "off"}
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby={hintId}
          placeholder={isManual ? "name@tsinghua.edu.cn" : "name"}
        />
      </label>
      <span id={hintId} className="field-hint">
        {isManual
          ? "教师等其他清华邮箱请填写完整地址（含 @ 和后缀）。"
          : `只需填写 @ 前的部分，后缀为 @${domain}。`}
      </span>
      <input
        type="hidden"
        name="email"
        value={
          isManual ? manual.trim() : local ? `${local.trim()}@${domain}` : ""
        }
      />
    </div>
  );
}

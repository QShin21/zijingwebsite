"use client";

import { useId, useState } from "react";
import styles from "./account-pages/AccountPages.module.css";
import { useT } from "./i18n/LocaleProvider";

const domains = [
  { value: "mails.tsinghua.edu.cn", zh: "学生邮箱", en: "Student email" },
  { value: "tsinghua.org.cn", zh: "校友邮箱", en: "Alumni email" },
];

export function RegistrationEmail() {
  const t = useT();
  const id = useId();
  const [domain, setDomain] = useState(domains[0].value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  return (
    <div className={styles.field}>
      <label htmlFor={`${id}-prefix`}>{t("邮箱", "Email")}</label>
      <div className={styles.emailRow}>
        <input
          id={`${id}-prefix`}
          name="emailPrefix"
          aria-label={t("邮箱前缀", "Email username")}
          required
          maxLength={64}
          pattern="[^@\s]+"
          placeholder={t("邮箱前缀", "Email username")}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <span className="email-at" aria-hidden="true">
          @
        </span>
        <div
          className={styles.emailDomain}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setOpen(false);
          }}
        >
          <input
            name="emailDomain"
            aria-label={t("邮箱后缀", "Email domain")}
            role="combobox"
            aria-expanded={open}
            aria-controls={open ? `${id}-domains` : undefined}
            aria-autocomplete="list"
            aria-activedescendant={
              open && active >= 0 ? `${id}-option-${active}` : undefined
            }
            aria-describedby={`${id}-hint`}
            value={domain}
            required
            maxLength={189}
            pattern="[^@\s]+"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            onFocus={(event) => {
              setOpen(true);
              setActive(-1);
              event.target.select();
            }}
            onClick={() => setOpen(true)}
            onChange={(event) => {
              setDomain(event.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setOpen(true);
                setActive((current) =>
                  current < 0
                    ? event.key === "ArrowDown"
                      ? 0
                      : 1
                    : (current +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        domains.length) %
                      domains.length,
                );
              } else if (event.key === "Enter" && open && active >= 0) {
                event.preventDefault();
                setDomain(domains[active].value);
                setOpen(false);
              } else if (event.key === "Escape" && open) {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
              }
            }}
          />
          {open && (
            <div
              id={`${id}-domains`}
              role="listbox"
              aria-label={t("常用邮箱后缀", "Common email domains")}
              className={styles.emailOptions}
            >
              {domains.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  id={`${id}-option-${index}`}
                  tabIndex={-1}
                  aria-selected={active === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setDomain(option.value);
                    setOpen(false);
                  }}
                >
                  <span>{option.value}</span>
                  <small>{t(option.zh, option.en)}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <span id={`${id}-hint`} className={styles.hint}>
        {t("可输入任意可接收验证码的邮箱。清华及校友邮箱对应清华用户，其他教育邮箱对应友校学生，普通邮箱对应校外人士。", "Use any email that can receive the code. Tsinghua and alumni emails make you a Tsinghua user, other .edu emails a partner-school student, and other emails an external user.")}
      </span>
    </div>
  );
}

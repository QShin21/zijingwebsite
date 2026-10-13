"use client";

import { useId, useState } from "react";
import styles from "./account-pages/AccountPages.module.css";

const domains = [
  { value: "mails.tsinghua.edu.cn", label: "学生邮箱" },
  { value: "tsinghua.org.cn", label: "校友邮箱" },
];

export function RegistrationEmail() {
  const id = useId();
  const [domain, setDomain] = useState(domains[0].value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  return (
    <div className={styles.field}>
      <label htmlFor={`${id}-prefix`}>清华邮箱</label>
      <div className={styles.emailRow}>
        <input
          id={`${id}-prefix`}
          name="emailPrefix"
          aria-label="邮箱前缀"
          required
          maxLength={64}
          pattern="[^@\s]+"
          placeholder="邮箱前缀"
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
            aria-label="邮箱后缀"
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
              aria-label="常用邮箱后缀"
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
                  <small>{option.label}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <span id={`${id}-hint`} className={styles.hint}>
        后缀可选择学生或校友邮箱，也可直接输入其他清华邮箱后缀。
      </span>
    </div>
  );
}

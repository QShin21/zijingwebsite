"use client";
import styles from "./ApplicationFlow.module.css";
import { useT } from "@/components/i18n/LocaleProvider";
export function SubmissionSteps({
  current,
}: {
  current?: "fill" | "review" | "receipt";
}) {
  const t = useT();
  const steps = [
    { key: "fill", label: t("填写信息", "Fill in") },
    { key: "review", label: t("核对提交", "Review & submit") },
    { key: "receipt", label: t("本人回执", "Receipt") },
  ];
  return (
    <ol className={styles.steps} aria-label={t("提交步骤", "Submission steps")}>
      {steps.map((step, index) => (
        <li
          key={step.key}
          aria-current={current === step.key ? "step" : undefined}
        >
          <span>{index + 1}</span>
          {step.label}
        </li>
      ))}
    </ol>
  );
}

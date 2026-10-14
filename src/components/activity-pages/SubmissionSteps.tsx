import styles from "./ApplicationFlow.module.css";
export function SubmissionSteps({
  current,
}: {
  current?: "fill" | "review" | "receipt";
}) {
  const steps = [
    { key: "fill", label: "填写信息" },
    { key: "review", label: "核对提交" },
    { key: "receipt", label: "本人回执" },
  ];
  return (
    <ol className={styles.steps} aria-label="提交步骤">
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

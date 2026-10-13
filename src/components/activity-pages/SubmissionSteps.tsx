import styles from "./ApplicationFlow.module.css";
export function SubmissionSteps() {
  return (
    <ol className={styles.steps} aria-label="提交步骤">
      <li>
        <span>01</span>填写信息
      </li>
      <li>
        <span>02</span>核对提交
      </li>
      <li>
        <span>03</span>查看本人回执
      </li>
    </ol>
  );
}

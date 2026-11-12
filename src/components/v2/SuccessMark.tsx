import styles from "./success-mark.module.css";

export function SuccessMark() {
  return (
    <svg
      className={styles.mark}
      data-confirmed-success=""
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <path
        d="M3 11h4v4h4v-4h4V7h4V3h4v8h-4v4h-4v4h-4v4H7v-4H3z"
        fill="currentColor"
      />
    </svg>
  );
}

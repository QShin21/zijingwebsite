"use client";

import { useState } from "react";
import { useCampusMotion } from "./CampusMotion";
import styles from "./schedule-runner.module.css";

export function ScheduleRunner() {
  const { ref, running } = useCampusMotion(0);
  const [jump, setJump] = useState(0);
  return (
    <div ref={ref} className={styles.runner} data-running={running}>
      <button
        type="button"
        className={styles.track}
        aria-label="让像素小恐龙跳跃"
        onClick={() => setJump((value) => value + 1)}
      >
        <span className={styles.cloud} aria-hidden="true" />
        <span className={styles.dinosaur} aria-hidden="true">
          <span key={jump} className={jump ? styles.manualJump : undefined}>
            <svg
              width="44"
              height="48"
              viewBox="0 0 22 24"
              shapeRendering="crispEdges"
            >
              <path d="M9 1h12v8H14v2h5v2h-7v5H6v-3H4v-2H2v-3H0V5h2v4h2v2h5Z" />
              <rect x="17" y="3" width="2" height="2" className={styles.eye} />
              <path d="M6 17h3v5h3v2H6Z" className={styles.leg} />
              <path d="M11 17h3v3h3v2h-6Z" className={styles.otherLeg} />
            </svg>
          </span>
        </span>
        <span className={styles.obstacles} aria-hidden="true">
          <svg
            width="24"
            height="30"
            viewBox="0 0 12 15"
            shapeRendering="crispEdges"
          >
            <path d="M5 0h3v15H5V9H1V3h2v4h2Zm3 7h2V2h2v7H8Z" />
          </svg>
        </span>
        <span className={styles.ground} aria-hidden="true" />
      </button>
    </div>
  );
}

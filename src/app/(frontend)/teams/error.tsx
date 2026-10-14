"use client";

import Link from "next/link";
import { ClubFrame } from "../_club/ClubPage";
import styles from "@/components/team-pages/TeamPages.module.css";

export default function TeamError({ retry }: { retry: () => void }) {
  return (
    <ClubFrame className={styles.loading}>
      <h1>队伍页面暂时无法读取</h1>
      <p>请重新读取当前页面。若刚完成提交，可先到本人记录核对结果。</p>
      <div className={styles.actions}>
        <button className="button" onClick={() => retry()}>
          重新读取
        </button>
        <Link href="/teams/recruitment">查看我的入队记录</Link>
        <Link href="/teams/honors?view=mine">查看我的荣誉记录</Link>
      </div>
    </ClubFrame>
  );
}

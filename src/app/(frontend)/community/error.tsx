"use client";

import Link from "next/link";
import { ClubFrame } from "../_club/ClubPage";
import styles from "@/components/community-pages/CommunityPages.module.css";

export default function CommunityError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ClubFrame className={`${styles.page} ${styles.loading}`}>
      <h1>社群内容暂时无法加载</h1>
      <p>
        请重试读取。如果刚才提交过申请或处理进度，请先核对本人记录，再决定是否重新提交。
      </p>
      <div className={styles.submitRow}>
        <button className="button" type="button" onClick={retry}>
          重新加载
        </button>
        <Link className="button light" href="/account">
          查看我的事务
        </Link>
        <Link href="/community">返回社群目录</Link>
      </div>
    </ClubFrame>
  );
}

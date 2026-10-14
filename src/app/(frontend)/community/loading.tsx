import { ClubFrame } from "../_club/ClubPage";
import styles from "@/components/community-pages/CommunityPages.module.css";

export default function LoadingCommunity() {
  return (
    <ClubFrame className={`${styles.page} ${styles.loading}`}>
      <section aria-busy="true" aria-label="正在加载社群">
        <h1>游戏社群</h1>
        <p role="status">正在读取社群与当前进度，请稍候…</p>
      </section>
    </ClubFrame>
  );
}

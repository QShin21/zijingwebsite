import { ClubFrame } from "../../_club/ClubPage";
import styles from "@/components/team-pages/TeamPages.module.css";

export default function TeamLoading() {
  return (
    <ClubFrame className={styles.loading}>
      <h1>代表队与荣誉</h1>
      <p role="status">正在读取队伍资料与当前任务…</p>
    </ClubFrame>
  );
}

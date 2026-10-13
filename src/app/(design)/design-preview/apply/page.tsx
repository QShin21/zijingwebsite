import Link from "next/link";
import Apply from "@/app/(frontend)/community/apply/page";
import { StageArt } from "@/components/visual-direction/DesignUI";
export default async function ApplyDirection({
  searchParams,
}: {
  searchParams: Promise<{
    message?: string;
    submitted?: string;
    edit?: string;
  }>;
}) {
  return (
    <div className="z-apply">
      <div className="z-flow-breadcrumb">
        <Link href="/design-preview">紫荆</Link>
        <span>/</span>
        <Link href="/community">游戏社群</Link>
        <span>/</span>
        <strong>参与社群组织</strong>
      </div>
      <div className="z-apply-grid">
        <div className="z-apply-main">{await Apply({ searchParams })}</div>
        <aside className="z-apply-aside">
          <StageArt />
          <div className="z-apply-aside-copy">
            <p className="z-kicker">FROM PLAYER TO BUILDER</p>
            <h2>
              不止上场，
              <br />
              一起创造主场。
            </h2>
            <p>一个好想法，值得拥有一起实现它的人。</p>
          </div>
          <div className="z-apply-process">
            <p className="z-kicker">YOUR NEXT STEPS</p>
            <ol className="z-step-list">
              <li>
                <span>01</span>
                <div>
                  <strong>填写申请资料</strong>
                  <p>说明组织计划，上传名片，由本人明确同意联系方式展示。</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>等待负责人审核</strong>
                  <p>在“我的申请”查看真实状态与处理意见，退回后可修改重提。</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>获批后人工组织</strong>
                  <p>独立社群任职与平台角色分开；微信建群和拉群由人工完成。</p>
                </div>
              </li>
            </ol>
            <p className="z-privacy-footnote">
              姓名、手机号与申请说明仅用于受控审核。获批名片仍可关闭展示。
            </p>
            <Link className="z-text-link" href="/privacy">
              阅读隐私说明 ↗
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

import { Stage, StageActions, StageKicker, StageLead, StageTitle, Ticker } from "@/components/v2/Stage";
import { ButtonLink, Chip, CommunityChip, DemoPill, EmptyState, Notice, Section, StatusPill, Wrap } from "@/components/v2/ui";
import { DateBlock } from "@/components/v2/cards";
import layout from "@/components/v2/layout.module.css";

/**
 * Static specimen of V2 primitives. Values below are design labels only
 * (never shown on production routes and never stored).
 */
export default function PreviewHome() {
  const hues = [12, 96, 180, 262, 318];
  return (
    <>
      <Stage label="样张舞台" aside={<DateBlock iso="2026-11-14T10:30:00.000Z" size="lg" tone="accent" />} ticker={<Ticker label="SPECIMEN" items={[{ key: "a", text: "样张滚动条 · 示例一" }, { key: "b", text: "样张滚动条 · 示例二" }]} />}>
        <StageKicker>
          <strong>SPECIMEN</strong>V2 组件样张
        </StageKicker>
        <StageTitle>
          竞在<em>紫荆</em>
        </StageTitle>
        <StageLead>舞台背景、光效（浏览器 Canvas 本地渲染）、记分牌日期与按钮层级。</StageLead>
        <StageActions>
          <ButtonLink href="/design-preview/system" tone="accent" icon="arrow">
            主操作
          </ButtonLink>
          <ButtonLink href="/design-preview/system" tone="stage">
            次操作
          </ButtonLink>
        </StageActions>
      </Stage>
      <Wrap>
        <Section id="buttons" title="按钮">
          <div className={layout.filterActions}>
            <ButtonLink href="#buttons">主色</ButtonLink>
            <ButtonLink href="#buttons" tone="accent">
              青柠
            </ButtonLink>
            <ButtonLink href="#buttons" tone="ghost">
              描边
            </ButtonLink>
            <ButtonLink href="#buttons" tone="danger">
              危险
            </ButtonLink>
          </div>
        </Section>
        <Section id="chips" title="标签与状态">
          <div className={layout.filterActions}>
            <Chip>中性</Chip>
            <Chip tone="action">主色</Chip>
            <Chip tone="accent">青柠</Chip>
            {hues.map((hue) => (
              <CommunityChip key={hue} community={{ id: hue, slug: `hue-${hue}`, title: `社群色 ${hue}`, hue }} />
            ))}
            <StatusPill tone="live">进行中</StatusPill>
            <StatusPill tone="success">报名开放</StatusPill>
            <StatusPill tone="info">即将开放</StatusPill>
            <StatusPill tone="warning">延期</StatusPill>
            <StatusPill tone="danger">已取消</StatusPill>
            <StatusPill>已结束</StatusPill>
            <DemoPill />
          </div>
        </Section>
        <Section id="dates" title="记分牌日期">
          <div className={layout.filterActions}>
            <DateBlock iso="2026-11-14T10:30:00.000Z" size="sm" />
            <DateBlock iso="2026-11-14T10:30:00.000Z" />
            <DateBlock iso={null} />
          </div>
        </Section>
        <Section id="notices" title="提示与空状态">
          <div className={layout.stack}>
            <Notice>信息提示</Notice>
            <Notice tone="success">成功提示</Notice>
            <Notice tone="warning">注意提示</Notice>
            <Notice tone="danger">错误提示</Notice>
            <EmptyState title="空状态标题">空状态说明文字与下一步。</EmptyState>
          </div>
        </Section>
      </Wrap>
    </>
  );
}

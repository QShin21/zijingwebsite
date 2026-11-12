import { PageHero, Section, Wrap } from "@/components/v2/ui";
import layout from "@/components/v2/layout.module.css";

/** V2 form-kit specimen: the global classes used by the retained complex forms. */
export default function SystemPage() {
  return (
    <>
      <PageHero tone="stage" eyebrow="FORM KIT" title="表单样张" description="保留业务逻辑的复杂表单统一使用这一套 V2 渲染层。" />
      <Wrap width="form" className={layout.pageBody}>
        <Section id="form" title="字段">
          <form className="member-form" aria-label="样张表单">
            <label>
              单行文本
              <input name="specimen-text" placeholder="占位文字" />
            </label>
            <label>
              下拉选择
              <select name="specimen-select" defaultValue="a">
                <option value="a">选项一</option>
                <option value="b">选项二</option>
              </select>
            </label>
            <label>
              多行文本
              <textarea name="specimen-area" />
            </label>
            <span className="field-hint">字段说明使用 field-hint。</span>
            <label className="check">
              <input type="checkbox" name="specimen-check" />
              勾选项
            </label>
            <p className="form-feedback" role="status">
              状态反馈
            </p>
            <p className="form-feedback" role="alert">
              错误反馈
            </p>
            <div className="signup-tools">
              <button type="button" className="button">
                主按钮
              </button>
              <button type="button" className="button light">
                次按钮
              </button>
              <button type="button" className="button" disabled>
                禁用
              </button>
            </div>
          </form>
        </Section>
        <Section id="questionnaire" title="问卷选项">
          <div className="questionnaire">
            <fieldset className="signup-question">
              <legend>单选题</legend>
              <label className="signup-choice questionnaire-option">
                <input type="radio" name="specimen-radio" defaultChecked />
                已选中
              </label>
              <label className="signup-choice questionnaire-option">
                <input type="radio" name="specimen-radio" />
                未选中
              </label>
            </fieldset>
          </div>
        </Section>
      </Wrap>
    </>
  );
}

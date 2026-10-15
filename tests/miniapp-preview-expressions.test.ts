import { describe, expect, it } from 'vitest';
import { evaluateWxmlExpression } from '../scripts/wxml-preview-expression.mjs';

describe('Synthetic WXML layout mapper expression semantics', () => {
  it('keeps the non-featured activity class and full details when template options are omitted', () => {
    expect(evaluateWxmlExpression("featured && index === 0 ? 'native-featured-event' : 'native-schedule-item'", { index: 0 })).toBe('native-schedule-item');
    expect(evaluateWxmlExpression('!compact && item.nativeEnd', { item: { nativeEnd: '合成结束时间' } })).toBe('合成结束时间');
    expect(evaluateWxmlExpression("emptyTitle || '暂无已发布内容'", {})).toBe('暂无已发布内容');
  });
  it('retains fallback branches for absent nested values, without converting false or zero into objects', () => {
    expect(evaluateWxmlExpression('promotions.event.length || promotions.notice.length', { promotions: { notice: ['synthetic'] } })).toBe(1);
    expect(evaluateWxmlExpression("join.note || '待公布'", { join: null })).toBe('待公布');
    expect(evaluateWxmlExpression("items[0].title || '空列表'", { items: [] })).toBe('空列表');
    expect(evaluateWxmlExpression('!busy && count === 0', { busy: false, count: 0 })).toBe(true);
  });
  it('preserves literal property-like text and template object data', () => {
    expect(evaluateWxmlExpression("'item.title' + item.title", { item: { title: '合成' } })).toBe('item.title合成');
    expect(evaluateWxmlExpression('{{docs, featured:false, compact:false, label:missing || "活动"}}', { docs: [{ id: 1 }] }, true)).toEqual({ docs: [{ id: 1 }], featured: false, compact: false, label: '活动' });
    expect(evaluateWxmlExpression('process || wx || require', {})).toBeUndefined();
  });
});

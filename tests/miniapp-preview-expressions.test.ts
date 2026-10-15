import { describe, expect, it } from 'vitest';
import { evaluateWxmlExpression } from '../scripts/wxml-preview-expression.mjs';
import { renderRichTextNodes } from '../scripts/wxml-preview-richtext.mjs';

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

describe('Synthetic WXML rich-text mapping', () => {
  it('keeps nested reading content and its actual typography instead of dropping the body', () => {
    expect(renderRichTextNodes([
      { name: 'h2', attrs: { style: 'font-size:21px;line-height:1.5;' }, children: [{ type: 'text', text: '合成标题' }] },
      { name: 'p', children: [{ type: 'text', text: '正文 ' }, { name: 'strong', children: [{ type: 'text', text: '强调' }] }, { name: 'br' }, { type: 'text', text: '换行' }] },
      { name: 'ul', children: [{ name: 'li', children: [{ type: 'text', text: '条目' }] }] },
    ])).toBe('<h2 style="font-size:21px;line-height:1.5;">合成标题</h2><p>正文 <strong>强调</strong><br>换行</p><ul><li>条目</li></ul>');
  });
  it('escapes text and keeps unsupported tags, event attributes and network styles inert', () => {
    expect(renderRichTextNodes([{ name: 'script', attrs: { onload: 'alert(1)', style: 'background:url(https://invalid.test)' }, children: [{ type: 'text', text: '<img src="x"> &' }] }]))
      .toBe('<div>&lt;img src=&quot;x&quot;&gt; &amp;</div>');
    expect(renderRichTextNodes('not a node array')).toBe('');
  });
});

/** Static projection of the native renderer's node tree, never arbitrary HTML. */
const supported = new Set(['div', 'p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ol', 'ul', 'li', 'strong', 'em', 'u', 's', 'code', 'br']);
const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function renderRichTextNodes(nodes) {
  let budget = 3000;
  const render = (items, depth = 0) => {
    if (!Array.isArray(items) || depth > 30) return '';
    return items.map(node => {
      if (!node || typeof node !== 'object' || --budget < 0) return '';
      if (node.type === 'text') return escape(node.text);
      const tag = supported.has(node.name) ? node.name : 'div';
      const rawStyle = typeof node.attrs?.style === 'string' ? node.attrs.style : '';
      // Native safe renderer currently only emits typography/spacing declarations.
      // Do not turn future URL-bearing data or HTML event attributes into browser effects.
      const style = /url\s*\(|expression\s*\(|@import/i.test(rawStyle) ? '' : rawStyle;
      if (tag === 'br') return '<br>';
      return '<' + tag + (style ? ' style="' + escape(style) + '"' : '') + '>' + render(node.children, depth + 1) + '</' + tag + '>';
    }).join('');
  };
  return render(nodes);
}

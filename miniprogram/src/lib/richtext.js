const { safeURL } = require('./format');
const tags = { paragraph: 'p', quote: 'blockquote', listitem: 'li' };
function render(body) {
  const links = [];
  let budget = 3000;
  function visit(node, depth) {
    if (!node || depth > 30 || --budget < 0) return null;
    if (node.type === 'text') {
      let output = { type: 'text', text: String(node.text || '') };
      const format = Number(node.format) || 0;
      for (const [bit, name] of [[1, 'strong'], [2, 'em'], [8, 'u'], [4, 's'], [16, 'code']]) {
        if (format & bit) output = { name, children: [output] };
      }
      return output;
    }
    if (node.type === 'linebreak') return { name: 'br', children: [] };
    if (['link', 'autolink'].includes(node.type)) {
      const href = node.fields && node.fields.url || node.url;
      if (safeURL(href) && !links.some(value => value.url === href)) {
        links.push({ url: href, label: (node.children || []).map(child => child.text || '').join('') || href });
      }
    }
    let name = tags[node.type] || 'div';
    if (node.type === 'heading') name = /^h[1-6]$/.test(node.tag) ? node.tag : 'h2';
    if (node.type === 'list') name = node.listType === 'number' ? 'ol' : 'ul';
    // Unknown nodes lose their attributes; arbitrary HTML, images and scripts are not executed.
    return { name, attrs: { style: 'line-height:1.8;word-break:break-word;' },
      children: (Array.isArray(node.children) ? node.children : []).map(child => visit(child, depth + 1)).filter(Boolean) };
  }
  return { nodes: (body && body.root && body.root.children || []).map(node => visit(node, 0)).filter(Boolean), links };
}
module.exports = { render };

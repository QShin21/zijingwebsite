const http = require('./http');
const session = require('./session');
function parser(onChange) {
  let buffer = '';
  return chunk => {
    // Notifications contain ASCII event names; message bodies arrive through the JSON feed.
    const bytes = new Uint8Array(chunk);
    let text = ''; for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
    buffer = (buffer + text).replace(/\r\n/g, '\n');
    if (buffer.length > 65536) { buffer = ''; return; }
    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
      const event = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
      if (/^event: (change|ready)$/m.test(event)) onChange();
    }
  };
}
function subscribe(slug, change, status) {
  let closed = false; let task; let timer;
  const reconnect = () => { if (!closed && session.token()) timer = setTimeout(connect, 1500); };
  function connect() {
    if (closed || !session.token()) return;
    const consume = parser(change);
    task = wx.request({ url: http.url(`/community/${encodeURIComponent(slug)}/chat/stream`),
      header: { Authorization: `JWT ${session.token()}` }, enableChunked: true, timeout: 70000,
      success(response) { if (response.statusCode === 401 || response.statusCode === 403) { closed = true; session.clear(); status('请重新登录'); } },
      fail() { if (!closed) status('连接中断，正在重连'); },
      complete() { if (!closed) reconnect(); },
    });
    if (task.onChunkReceived) task.onChunkReceived(event => { if (!closed) { consume(event.data); status('即时接收已连接'); } });
    else { closed = true; task.abort(); status('当前微信版本不支持即时接收，可下拉刷新'); }
  }
  connect();
  return () => { closed = true; clearTimeout(timer); if (task) task.abort(); };
}
function merge(previous, incoming, removed = []) {
  const hidden = new Set(removed);
  const byID = new Map();
  previous.concat(incoming).forEach(message => { if (!hidden.has(message.id)) byID.set(message.id, message); });
  return [...byID.values()].sort((a, b) => a.id - b.id).slice(-1000);
}
module.exports = { parser, subscribe, merge };

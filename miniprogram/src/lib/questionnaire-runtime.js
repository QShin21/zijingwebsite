// Local helpers for native engines that do not expose newer web globals.
function utf8Length(text) {
  let length = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) length++;
    else if (code < 0x800) length += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) {
      length += 4; i++;
    } else length += 3;
  }
  return length;
}
function fromEntries(entries) {
  const result = {};
  for (const [key, value] of entries)
    Object.defineProperty(result, key, { value, writable: true, configurable: true, enumerable: true });
  return result;
}
module.exports = { utf8Length, fromEntries };

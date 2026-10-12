// This checks escaped expression tokens, not WXML or JavaScript syntax.
/** @param {string} text */
export function escapedWxmlBindings(text) {
  const failures = [];
  const reference = /&(?:[a-z][a-z0-9]*|#[0-9]+|#x[0-9a-f]+);/iy;
  let index = 0;
  while (index < text.length) {
    if (text.startsWith('<!--', index)) {
      const end = text.indexOf('-->', index + 4);
      if (end < 0) break;
      index = end + 3;
      continue;
    }
    if (!text.startsWith('{{', index)) { index++; continue; }
    index += 2;
    let quote = ''; let braces = 0; let reported = false;
    while (index < text.length) {
      const character = text[index];
      if (quote) {
        if (character === '\\') { index += 2; continue; }
        if (character === quote) quote = '';
        index++;
        continue;
      }
      if (character === "'" || character === '"') { quote = character; index++; continue; }
      if (braces === 0 && text.startsWith('}}', index)) { index += 2; break; }
      if (character === '{') braces++;
      else if (character === '}' && braces > 0) braces--;
      else if (character === '&') {
        reference.lastIndex = index;
        const match = reference.exec(text);
        if (match) {
          if (!reported) failures.push({ index, entity: match[0] });
          reported = true;
          index += match[0].length;
          continue;
        }
      }
      index++;
    }
  }
  return failures;
}

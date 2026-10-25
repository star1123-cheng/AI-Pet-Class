// 畫面共用的小工具。文字一律走 textContent，不用 innerHTML 放使用者輸入。

// 建立元素：h('button', { class: 'primary', text: '好', onclick }, ...子元素)
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid) el.append(kid);
  return el;
}

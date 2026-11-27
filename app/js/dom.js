export function el(tag, attrs, children) {
  const node = document.createElement(tag);
  const props = attrs || {};
  Object.keys(props).forEach((key) => {
    const value = props[key];
    if (value == null || value === false) return;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'disabled') node.disabled = true;
    else if (key === 'hidden') node.hidden = true;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      node.setAttribute(key, value === true ? '' : String(value));
    }
  });
  const list = children == null ? [] : Array.isArray(children) ? children : [children];
  list.forEach((child) => {
    if (child == null || child === false) return;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return node;
}

export function svgIcon(markup) {
  const span = document.createElement('span');
  span.className = 'tab-icon';
  span.innerHTML = markup;
  return span;
}

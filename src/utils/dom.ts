/** Minimal DOM helpers so the views can build markup without a framework. */

type Child = Node | string | null | undefined | false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = Record<string, any>;

/**
 * Create an element with props + children.
 *  - `class`   -> className
 *  - `style`   -> Object.assign(node.style, ...)
 *  - `dataset` -> Object.assign(node.dataset, ...)
 *  - `html`    -> innerHTML
 *  - `onClick` / `onPointerdown` ... -> addEventListener
 *  - anything else: set as property when it exists, else as an attribute.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'style') applyStyle(node, value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key in node) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (node as any)[key] = value;
    } else {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children) if (child != null && child !== false) node.append(child);
  return node;
}

/**
 * Apply a style object. CSS custom properties (`--foo`) must go through
 * `setProperty` — assigning them onto the style object is silently ignored.
 */
function applyStyle(node: HTMLElement, style: Record<string, string>): void {
  for (const [prop, val] of Object.entries(style)) {
    if (val == null) continue;
    if (prop.startsWith('--')) node.style.setProperty(prop, String(val));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    else (node.style as any)[prop] = val;
  }
}

/** Remove all children from a node. */
export const clear = (node: HTMLElement): void => node.replaceChildren();

/** Query helper that throws if the element is missing (fail fast during boot). */
export function mustQuery<T extends HTMLElement>(selector: string, root: ParentNode = document): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`GrooveLab: expected element "${selector}" not found`);
  return found;
}

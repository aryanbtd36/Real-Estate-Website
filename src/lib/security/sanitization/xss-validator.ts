import DOMPurify from 'isomorphic-dompurify';

export function isXssSafe(input: string): boolean {
  if (!input) return true;
  const clean = DOMPurify.sanitize(input, {
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style', 'xml', 'svg'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur', 'onchange'],
  });
  return clean === input;
}

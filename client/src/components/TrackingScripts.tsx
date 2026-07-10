'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { contentApi } from '@/lib/content.api';

/**
 * Injects the enabled tracking snippets (configured in Admin → Integrations)
 * into the live page. Snippets arrive as HTML strings; because `innerHTML` won't
 * execute injected <script> tags, we re-create each script node so it runs.
 * Each snippet is tagged with a `data-int` marker to guarantee it loads once.
 */
function injectHtml(html: string, target: HTMLElement, marker: string) {
  if (!html || document.querySelector(`[data-int="${marker}"]`)) return;
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  Array.from(tpl.content.childNodes).forEach((node) => {
    if (node.nodeName === 'SCRIPT') {
      const src = node as HTMLScriptElement;
      const s = document.createElement('script');
      Array.from(src.attributes).forEach((a) => s.setAttribute(a.name, a.value));
      if (!src.src) s.textContent = src.textContent;
      s.setAttribute('data-int', marker);
      target.appendChild(s);
    } else {
      const clone = node.cloneNode(true);
      if (clone instanceof HTMLElement) clone.setAttribute('data-int', marker);
      target.appendChild(clone);
    }
  });
}

export function TrackingScripts() {
  const { data } = useQuery({ queryKey: ['public-tracking'], queryFn: contentApi.tracking, staleTime: 5 * 60_000, retry: false });

  useEffect(() => {
    if (!data) return;
    (data.head || []).forEach((s) => injectHtml(s.html, document.head, `int-${s.key}`));
    (data.footer || []).forEach((s) => injectHtml(s.html, document.body, `int-${s.key}`));
    (data.js || []).forEach((s) => {
      const marker = `int-${s.key}`;
      if (!s.code || document.querySelector(`[data-int="${marker}"]`)) return;
      const el = document.createElement('script');
      el.textContent = s.code;
      el.setAttribute('data-int', marker);
      document.body.appendChild(el);
    });
  }, [data]);

  return null;
}

export default TrackingScripts;

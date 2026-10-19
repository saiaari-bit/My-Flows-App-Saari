import { useEffect, useState } from 'react';

import { DefaultError, DefaultLoading } from './fallbackViews';

export function TextRenderer({ url }: { url: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) return <DefaultError error={error} />;
  if (content === null) return <DefaultLoading />;

  return (
    <pre
      style={{
        margin: 0,
        padding: 16,
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontSize: 13,
        lineHeight: 1.5,
        fontFamily: 'monospace',
      }}
    >
      {content}
    </pre>
  );
}

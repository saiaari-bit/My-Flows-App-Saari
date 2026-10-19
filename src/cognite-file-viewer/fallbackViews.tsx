export function DefaultLoading() {
  return <div style={{ padding: 16, color: '#666' }}>Loading file...</div>;
}

export function DefaultError({ error }: { error: Error }) {
  return (
    <div style={{ padding: 16, color: '#c00' }}>
      Failed to load file: {error.message}
    </div>
  );
}

export function DefaultUnsupported({ mimeType }: { mimeType: string | undefined }) {
  return (
    <div style={{ padding: 16, color: '#666' }}>
      Unsupported file type{mimeType ? `: ${mimeType}` : ''}
    </div>
  );
}

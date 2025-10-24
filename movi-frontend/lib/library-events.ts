type Handler = () => void;

const subscribers = new Set<Handler>();

export function onLibraryChanged(handler: Handler) {
  subscribers.add(handler);
  // Return a cleanup function that removes the handler (no return value)
  return () => {
    subscribers.delete(handler);
  };
}

export function emitLibraryChanged() {
  subscribers.forEach((h) => {
    try {
      h();
    } catch {}
  });
}


interface AbortableRef {
  current: AbortController | { abort?: () => void } | null;
}

export function cleanupAbortController(
  controllerRef: AbortableRef,
): void {
  const controller = controllerRef.current;
  if (controller && 'abort' in controller && typeof controller.abort === 'function') {
    controller.abort();
    controllerRef.current = null;
  }
}

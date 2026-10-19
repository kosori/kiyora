/** A subscribe method over a listener set: adds the listener, returns the unsubscribe. */
export const subscriptionOf =
  (set: Set<() => void>) =>
  (listener: () => void): (() => void) => {
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  };

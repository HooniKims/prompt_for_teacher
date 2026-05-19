export function createLocalStorageMock(initial = {}) {
  const store = new Map(Object.entries(initial));

  return {
    dump() {
      return Object.fromEntries(store.entries());
    },
    get length() {
      return store.size;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

export function createFailingStorageMock(message = "localStorage unavailable") {
  return {
    getItem() {
      throw new Error(message);
    },
    setItem() {
      throw new Error(message);
    },
    removeItem() {
      throw new Error(message);
    }
  };
}

export const createFailingStorage = createFailingStorageMock;

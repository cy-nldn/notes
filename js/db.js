const DB_NAME = 'pdf_notes_studio';
const DB_VERSION = 1;
const STORE = 'pdf_files';

function withStore(mode, callback) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const tx = request.result.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      callback(store, resolve, reject);
      tx.oncomplete = () => request.result.close();
      tx.onerror = () => reject(tx.error);
    };
  });
}

export const fileStore = {
  put(id, file) {
    return withStore('readwrite', (store, resolve) => {
      store.put(file, id);
      resolve();
    });
  },
  get(id) {
    return withStore('readonly', (store, resolve) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ?? null);
    });
  },
  delete(id) {
    return withStore('readwrite', (store, resolve) => {
      store.delete(id);
      resolve();
    });
  }
};

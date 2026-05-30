export interface OfflineVoiceRecord {
    id: string;
    audioBase64: string;
    mimeType: string;
    timestamp: string;
    plant?: string;
    sector?: string;
}

export async function openOfflineDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB is not supported in this environment'));
            return;
        }
        const request = indexedDB.open('safetyvision-offline-transcription', 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('audio_queue')) {
                db.createObjectStore('audio_queue', { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function addToOfflineQueue(record: OfflineVoiceRecord): Promise<void> {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('audio_queue', 'readwrite');
        const store = tx.objectStore('audio_queue');
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function getOfflineQueue(): Promise<OfflineVoiceRecord[]> {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('audio_queue', 'readonly');
        const store = tx.objectStore('audio_queue');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function removeFromOfflineQueue(id: string): Promise<void> {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('audio_queue', 'readwrite');
        const store = tx.objectStore('audio_queue');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

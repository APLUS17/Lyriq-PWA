import { Song } from '../types';

const DB_NAME = 'LyriqDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

export interface ProjectMetadata {
    id: string;
    title: string;
    updatedAt: number;
    gradient: string;
}

export interface StoredProject extends ProjectMetadata {
    song: Song;
    createdAt: number;
}

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

export const saveProject = async (project: StoredProject): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(project);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
};

export const getProjectsMetadata = async (): Promise<ProjectMetadata[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const projects = request.result as StoredProject[];
            // Return only metadata to keep the list lightweight
            const metadata = projects.map(({ id, title, updatedAt, gradient }) => ({
                id,
                title,
                updatedAt,
                gradient
            })).sort((a, b) => b.updatedAt - a.updatedAt);
            resolve(metadata);
        };
    });
};

export const getProject = async (id: string): Promise<StoredProject | undefined> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
};

export const deleteProject = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
};

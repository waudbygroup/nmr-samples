/**
 * Storage Handler - Manages persistent storage of directory handles using IndexedDB
 * Desktop-only NMR Sample Manager
 */

class StorageHandler {
    constructor() {
        this.dbName = 'NMRSampleManager';
        this.dbVersion = 1;
        this.storeName = 'directoryHandles';
        this.db = null;
    }

    /**
     * Initialize IndexedDB connection
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object store for directory handles
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
                    store.createIndex('type', 'type', { unique: false });
                }
            };
        });
    }

    /**
     * Store a directory handle with a key
     */
    async storeDirectoryHandle(key, handle, metadata = {}) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            const data = {
                key: key,
                handle: handle,
                metadata: {
                    ...metadata,
                    timestamp: Date.now(),
                    name: handle.name
                },
                type: 'directory'
            };

            const request = store.put(data);

            request.onsuccess = () => {
                console.log(`Successfully stored directory handle: ${key}`, data);
                resolve();
            };

            request.onerror = () => {
                console.error(`Failed to store directory handle: ${key}`, request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Retrieve a stored directory handle by key
     */
    async getDirectoryHandle(key) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);

            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    console.log(`Retrieved directory handle: ${key}`);
                    resolve(result);
                } else {
                    console.log(`No directory handle found for key: ${key}`);
                    resolve(null);
                }
            };

            request.onerror = () => {
                console.error(`Failed to retrieve directory handle: ${key}`, request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Remove a stored directory handle
     */
    async removeDirectoryHandle(key) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(key);

            request.onsuccess = () => {
                console.log(`Removed directory handle: ${key}`);
                resolve();
            };

            request.onerror = () => {
                console.error(`Failed to remove directory handle: ${key}`, request.error);
                reject(request.error);
            };
        });
    }

    /**
     * List all stored directory handles
     */
    async listStoredHandles() {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                const results = request.result.map(item => ({
                    key: item.key,
                    name: item.metadata.name,
                    timestamp: item.metadata.timestamp,
                    type: item.type
                }));
                resolve(results);
            };

            request.onerror = () => {
                console.error('Failed to list stored handles:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Verify that a stored directory handle is still accessible
     */
    async verifyDirectoryHandle(storedData, requireUserActivation = false) {
        try {
            // Try to verify permission status first
            const permissionStatus = await storedData.handle.queryPermission({ mode: 'readwrite' });
            if (permissionStatus === 'granted') {
                return true;
            }

            // Only try to request permission if user activation is available
            if (requireUserActivation) {
                const requestStatus = await storedData.handle.requestPermission({ mode: 'readwrite' });
                return requestStatus === 'granted';
            } else {
                // During automatic loading, just check if we can access the handle
                // Try a simple read operation to test accessibility
                try {
                    await storedData.handle.entries().next();
                    return true;
                } catch (accessError) {
                    console.warn('Directory handle not accessible without user permission:', accessError);
                    return false;
                }
            }
        } catch (error) {
            console.warn('Directory handle verification failed:', error);
            return false;
        }
    }
}
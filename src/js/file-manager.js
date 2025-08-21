/**
 * File Manager - Handles file system operations using File System Access API
 * Desktop-only NMR Sample Manager
 */

class FileManager {
    constructor() {
        this.currentDirectoryHandle = null;
        this.sampleFiles = new Map(); // filename -> fileHandle
        this.onDirectoryChanged = null;
        this.onSamplesChanged = null;
    }

    /**
     * Check if File System Access API is supported
     */
    isSupported() {
        return 'showDirectoryPicker' in window;
    }

    /**
     * Open directory picker and set current directory
     */
    async selectDirectory() {
        if (!this.isSupported()) {
            throw new Error('File System Access API not supported. Please use Chrome or Edge.');
        }

        try {
            const dirHandle = await window.showDirectoryPicker({
                mode: 'readwrite'
            });
            
            this.currentDirectoryHandle = dirHandle;
            await this.scanForSamples();
            
            if (this.onDirectoryChanged) {
                this.onDirectoryChanged(dirHandle.name);
            }
            
            return dirHandle;
        } catch (error) {
            if (error.name !== 'AbortError') {
                throw error;
            }
        }
    }

    /**
     * Scan current directory for JSON sample files
     */
    async scanForSamples() {
        if (!this.currentDirectoryHandle) return;

        this.sampleFiles.clear();
        
        try {
            for await (const [name, handle] of this.currentDirectoryHandle.entries()) {
                if (handle.kind === 'file' && name.endsWith('.json')) {
                    // Check if it looks like a sample file (timestamp_name.json format)
                    const timestampPattern = /^\d{4}-\d{2}-\d{2}_\d{6}_/;
                    if (timestampPattern.test(name)) {
                        this.sampleFiles.set(name, handle);
                    }
                }
            }

            if (this.onSamplesChanged) {
                this.onSamplesChanged(Array.from(this.sampleFiles.keys()));
            }
        } catch (error) {
            console.error('Error scanning for samples:', error);
            throw error;
        }
    }

    /**
     * Read a sample file
     */
    async readSample(filename) {
        const fileHandle = this.sampleFiles.get(filename);
        if (!fileHandle) {
            throw new Error(`Sample file not found: ${filename}`);
        }

        try {
            const file = await fileHandle.getFile();
            const text = await file.text();
            return JSON.parse(text);
        } catch (error) {
            console.error(`Error reading sample ${filename}:`, error);
            throw error;
        }
    }

    /**
     * Write a sample file
     */
    async writeSample(filename, data, skipCallback = false) {
        if (!this.currentDirectoryHandle) {
            throw new Error('No directory selected');
        }

        try {
            // Add metadata if not present
            if (!data.Metadata) {
                data.Metadata = {};
            }
            
            const now = new Date().toISOString();
            if (!data.Metadata.created_timestamp) {
                data.Metadata.created_timestamp = now;
            }
            data.Metadata.modified_timestamp = now;
            data.Metadata.schema_version = "0.0.1";

            const fileHandle = await this.currentDirectoryHandle.getFileHandle(filename, {
                create: true
            });

            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(data, null, 2));
            await writable.close();

            // Update our cache
            this.sampleFiles.set(filename, fileHandle);

            // Only trigger callback if not explicitly skipped
            if (!skipCallback && this.onSamplesChanged) {
                this.onSamplesChanged(Array.from(this.sampleFiles.keys()));
            }

        } catch (error) {
            console.error(`Error writing sample ${filename}:`, error);
            throw error;
        }
    }

    /**
     * Generate filename for new sample
     */
    generateFilename(sampleLabel = 'Sample') {
        const now = new Date();
        const datePart = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const timePart = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHMMSS
        
        // Clean sample label for filename
        const cleanLabel = sampleLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
        
        return `${datePart}_${timePart}_${cleanLabel}.json`;
    }

    /**
     * Check if a sample has been ejected
     */
    async getSampleStatus(filename) {
        try {
            const data = await this.readSample(filename);
            const metadata = data.Metadata || {};
            
            if (metadata.ejected_timestamp) {
                return 'ejected';
            } else if (metadata.created_timestamp) {
                return 'ready'; // Created but not ejected
            }
            return 'unknown';
        } catch (error) {
            console.error(`Error getting status for ${filename}:`, error);
            return 'error';
        }
    }

    /**
     * Mark sample as ejected
     */
    async ejectSample(filename) {
        try {
            const data = await this.readSample(filename);
            if (!data.Metadata) {
                data.Metadata = {};
            }
            
            data.Metadata.ejected_timestamp = new Date().toISOString();
            // Skip callback here since we'll call scanForSamples manually
            await this.writeSample(filename, data, true);
            
            return true;
        } catch (error) {
            console.error(`Error ejecting sample ${filename}:`, error);
            throw error;
        }
    }

    /**
     * Create a duplicate of an existing sample
     */
    async duplicateSample(sourceFilename, newLabel) {
        try {
            const sourceData = await this.readSample(sourceFilename);
            
            // Remove metadata to create fresh timestamps
            delete sourceData.Metadata;
            
            // Update sample label if provided
            if (newLabel && sourceData.Sample) {
                sourceData.Sample.Label = newLabel;
            }
            
            const newFilename = this.generateFilename(newLabel || 'DuplicatedSample');
            await this.writeSample(newFilename, sourceData);
            
            return newFilename;
        } catch (error) {
            console.error(`Error duplicating sample ${sourceFilename}:`, error);
            throw error;
        }
    }

    /**
     * Get current directory name
     */
    getCurrentDirectoryName() {
        return this.currentDirectoryHandle ? this.currentDirectoryHandle.name : null;
    }

    /**
     * Get list of sample filenames
     */
    getSampleFilenames() {
        return Array.from(this.sampleFiles.keys()).sort().reverse(); // Latest first
    }
}
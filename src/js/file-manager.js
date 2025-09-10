/**
 * File Manager - Handles file system operations using File System Access API
 * Desktop-only NMR Sample Manager
 */

class FileManager {
    constructor() {
        this.rootDirectoryHandle = null;
        this.currentDirectoryHandle = null;
        this.currentSubfolderPath = '';
        this.sampleFiles = new Map(); // filename -> fileHandle
        this.onDirectoryChanged = null;
        this.onSamplesChanged = null;
        this.onRootDirectoryChanged = null;
        this.storage = new StorageHandler();
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
                this.onSamplesChanged(this.getSampleFilenames());
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
                this.onSamplesChanged(this.getSampleFilenames());
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
            
            // Don't update timestamp if sample is already ejected
            if (data.Metadata.ejected_timestamp) {
                return true; // Already ejected, do nothing
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
        return Array.from(this.sampleFiles.keys()).sort(); // Alphabetical sort
    }

    /**
     * Initialize storage system
     */
    async initialize() {
        console.log('FileManager: Initializing storage...');
        await this.storage.initialize();
        console.log('FileManager: Storage initialized, loading root directory...');
        const rootLoaded = await this.loadRootDirectory();
        console.log('FileManager: Root directory loaded:', rootLoaded);
    }

    /**
     * Set root directory and persist it
     */
    async setRootDirectory() {
        if (!this.isSupported()) {
            throw new Error('File System Access API not supported. Please use Chrome or Edge.');
        }

        try {
            const dirHandle = await window.showDirectoryPicker({
                mode: 'readwrite'
            });
            
            this.rootDirectoryHandle = dirHandle;
            console.log('Storing root directory handle:', dirHandle.name);
            await this.storage.storeDirectoryHandle('root', dirHandle, {
                type: 'root',
                name: dirHandle.name,
                // Store display name (we'll show just the name for now, but this allows future expansion)
                displayName: dirHandle.name
            });
            console.log('Root directory handle stored successfully');

            if (this.onRootDirectoryChanged) {
                // For root directory, show the folder name (since we can't get full path from File System API)
                this.onRootDirectoryChanged(dirHandle.name);
            }
            
            // Reset current directory to root
            this.currentDirectoryHandle = dirHandle;
            this.currentSubfolderPath = '';
            await this.scanForSamples();
            
            return dirHandle;
        } catch (error) {
            if (error.name !== 'AbortError') {
                throw error;
            }
        }
    }

    /**
     * Load stored root directory
     */
    async loadRootDirectory() {
        try {
            console.log('Loading root directory from storage...');
            const storedData = await this.storage.getDirectoryHandle('root');
            console.log('Retrieved stored data:', storedData);
            if (storedData) {
                console.log('Found stored root directory:', storedData.metadata.name);
                // Store the handle but don't verify access during startup
                console.log('Root directory found in storage, setting up...');
                this.rootDirectoryHandle = storedData.handle;
                this.currentDirectoryHandle = storedData.handle;
                this.currentSubfolderPath = '';
                
                if (this.onRootDirectoryChanged) {
                    this.onRootDirectoryChanged(storedData.metadata.displayName || storedData.metadata.name);
                }
                
                if (this.onDirectoryChanged) {
                    this.onDirectoryChanged(this.getFullCurrentPath());
                }
                
                // Try to scan for samples, but don't fail if permissions aren't available yet
                try {
                    await this.scanForSamples();
                } catch (error) {
                    console.log('Root directory loaded but permissions needed for file access');
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error loading root directory:', error);
            return false;
        }
    }

    /**
     * Navigate to a subfolder relative to root
     */
    async navigateToSubfolder(subfolderPath) {
        if (!this.rootDirectoryHandle) {
            throw new Error('No root directory set');
        }

        try {
            let currentHandle = this.rootDirectoryHandle;
            
            // Try to verify permissions and request if needed
            try {
                const permissionStatus = await this.rootDirectoryHandle.queryPermission({ mode: 'readwrite' });
                if (permissionStatus !== 'granted') {
                    console.log('Requesting root directory permissions...');
                    const requestStatus = await this.rootDirectoryHandle.requestPermission({ mode: 'readwrite' });
                    if (requestStatus !== 'granted') {
                        throw new Error('Root directory access denied. Please grant permission or set a new root directory.');
                    }
                }
            } catch (permissionError) {
                console.error('Permission error:', permissionError);
                throw new Error('Root directory is no longer accessible. Please set a new root directory.');
            }
            const pathParts = subfolderPath.split('/').filter(part => part.length > 0);
            
            // Navigate through each path component
            for (const part of pathParts) {
                currentHandle = await currentHandle.getDirectoryHandle(part);
            }
            
            this.currentDirectoryHandle = currentHandle;
            this.currentSubfolderPath = subfolderPath;
            await this.scanForSamples();
            
            if (this.onDirectoryChanged) {
                this.onDirectoryChanged(this.getFullCurrentPath());
            }
            
            return currentHandle;
        } catch (error) {
            console.error(`Error navigating to subfolder: ${subfolderPath}`, error);
            throw error;
        }
    }

    /**
     * Select a subfolder using file picker
     */
    async selectSubfolder() {
        if (!this.isSupported()) {
            throw new Error('File System Access API not supported. Please use Chrome or Edge.');
        }

        try {
            const dirHandle = await window.showDirectoryPicker({
                mode: 'readwrite'
            });
            
            this.currentDirectoryHandle = dirHandle;
            // Try to determine subfolder path relative to root if possible
            // For now, just set as unknown subfolder
            this.currentSubfolderPath = `.../${dirHandle.name}`;
            await this.scanForSamples();
            
            if (this.onDirectoryChanged) {
                this.onDirectoryChanged(this.getFullCurrentPath());
            }
            
            return dirHandle;
        } catch (error) {
            if (error.name !== 'AbortError') {
                throw error;
            }
        }
    }

    /**
     * Get full current path for display
     */
    getFullCurrentPath() {
        if (!this.rootDirectoryHandle) {
            return this.currentDirectoryHandle ? this.currentDirectoryHandle.name : null;
        }
        
        const rootName = this.rootDirectoryHandle.name;
        if (!this.currentSubfolderPath) {
            return rootName;
        }
        
        return `${rootName}/${this.currentSubfolderPath}`;
    }

    /**
     * Get root directory name
     */
    getRootDirectoryName() {
        return this.rootDirectoryHandle ? this.rootDirectoryHandle.name : null;
    }

    /**
     * Request permissions for current directory if needed
     */
    async requestCurrentDirectoryPermissions() {
        if (!this.currentDirectoryHandle) return false;
        
        try {
            const permissionStatus = await this.currentDirectoryHandle.queryPermission({ mode: 'readwrite' });
            if (permissionStatus !== 'granted') {
                console.log('Requesting current directory permissions...');
                const requestStatus = await this.currentDirectoryHandle.requestPermission({ mode: 'readwrite' });
                return requestStatus === 'granted';
            }
            return true;
        } catch (error) {
            console.error('Error requesting directory permissions:', error);
            return false;
        }
    }

    /**
     * Scan current directory for numbered experiment directories
     */
    async scanExperimentDirectories() {
        if (!this.currentDirectoryHandle) return [];

        const experimentDirs = [];
        
        try {
            for await (const [name, handle] of this.currentDirectoryHandle.entries()) {
                if (handle.kind === 'directory' && /^\d+$/.test(name)) {
                    experimentDirs.push({
                        number: parseInt(name, 10),
                        name: name,
                        handle: handle
                    });
                }
            }

            // Sort by experiment number
            experimentDirs.sort((a, b) => a.number - b.number);
            return experimentDirs;
        } catch (error) {
            console.error('Error scanning experiment directories:', error);
            return [];
        }
    }

    /**
     * Read experiment data from a numbered directory
     */
    async readExperimentData(expHandle) {
        try {
            let startTime = null;
            let pulseProgram = null;
            let title = null;

            // Read audita.txt for start time
            try {
                const auditaHandle = await expHandle.getFileHandle('audita.txt');
                const auditaFile = await auditaHandle.getFile();
                const auditaText = await auditaFile.text();
                
                const timeMatch = auditaText.match(/started at (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} [+-]\d{4})/);
                if (timeMatch) {
                    startTime = timeMatch[1];
                }
            } catch (error) {
                // audita.txt missing - skip this experiment
                return null;
            }

            // Read acqus for pulse program and HOLDER
            let holder = null;
            try {
                const acqusHandle = await expHandle.getFileHandle('acqus');
                const acqusFile = await acqusHandle.getFile();
                const acqusText = await acqusFile.text();
                
                const pulseMatch = acqusText.match(/##\$PULPROG= <(.+?)>/);
                if (pulseMatch) {
                    pulseProgram = pulseMatch[1];
                }
                
                const holderMatch = acqusText.match(/##\$HOLDER= (\d+)/);
                if (holderMatch) {
                    holder = holderMatch[1];
                }
            } catch (error) {
                // acqus missing - skip this experiment
                return null;
            }

            // Read pdata/1/title for experiment title (optional)
            try {
                const pdataHandle = await expHandle.getDirectoryHandle('pdata');
                const pdata1Handle = await pdataHandle.getDirectoryHandle('1');
                const titleHandle = await pdata1Handle.getFileHandle('title');
                const titleFile = await titleHandle.getFile();
                const titleText = await titleFile.text();
                
                const firstLine = titleText.split('\n')[0].trim();
                if (firstLine) {
                    title = firstLine;
                }
            } catch (error) {
                // title file missing or empty - that's okay
            }

            return {
                startTime,
                pulseProgram,
                title,
                holder
            };
        } catch (error) {
            console.error(`Error reading experiment data:`, error);
            return null;
        }
    }

    /**
     * Generate timeline data combining samples and experiments
     */
    async generateTimelineData() {
        const timelineEvents = [];

        // Add sample events
        for (const filename of this.getSampleFilenames()) {
            try {
                const sampleData = await this.readSample(filename);
                const metadata = sampleData.Metadata || {};
                const sampleLabel = sampleData.Sample?.Label || 'Unknown';

                // Sample creation event
                if (metadata.created_timestamp) {
                    timelineEvents.push({
                        timestamp: metadata.created_timestamp,
                        type: 'Sample',
                        event: 'Created',
                        details: sampleLabel,
                        rawTimestamp: new Date(metadata.created_timestamp)
                    });
                }

                // Sample ejection event
                if (metadata.ejected_timestamp) {
                    timelineEvents.push({
                        timestamp: metadata.ejected_timestamp,
                        type: 'Sample',
                        event: 'Ejected',
                        details: sampleLabel,
                        rawTimestamp: new Date(metadata.ejected_timestamp)
                    });
                }
            } catch (error) {
                console.error(`Error reading sample ${filename} for timeline:`, error);
            }
        }

        // Add experiment events
        const experimentDirs = await this.scanExperimentDirectories();
        for (const expDir of experimentDirs) {
            try {
                const expData = await this.readExperimentData(expDir.handle);
                if (expData && expData.startTime && expData.pulseProgram) {
                    // Parse the timestamp format: "2024-04-24 14:04:59.108 +0100"
                    const timestampMatch = expData.startTime.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\.\d{3} [+-]\d{4}/);
                    if (timestampMatch) {
                        const isoTimestamp = timestampMatch[1].replace(' ', 'T') + 'Z';
                        
                        timelineEvents.push({
                            timestamp: expData.startTime,
                            type: 'Experiment',
                            event: expData.pulseProgram,
                            details: expData.title || `Experiment ${expDir.number}`,
                            experimentNumber: expDir.number,
                            holder: expData.holder,
                            rawTimestamp: new Date(isoTimestamp)
                        });
                    }
                }
            } catch (error) {
                console.error(`Error reading experiment ${expDir.number} for timeline:`, error);
            }
        }

        // Sort by timestamp (oldest first)
        timelineEvents.sort((a, b) => a.rawTimestamp - b.rawTimestamp);

        return timelineEvents;
    }
}
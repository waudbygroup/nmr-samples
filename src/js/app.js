/**
 * Main Application - NMR Sample Manager
 * Desktop-only application using File System Access API
 */

class NMRSampleManager {
    constructor() {
        this.fileManager = new FileManager();
        this.schemaHandler = new SchemaHandler();
        this.currentSample = null;
        this.selectedSampleFile = null;
        this.formComponent = null;
        this.currentReactRoot = null;
        this.currentOperation = null; // Track ongoing operations: 'creating-new', 'duplicating', null

        // Bind event handlers
        this.fileManager.onDirectoryChanged = this.handleDirectoryChanged.bind(this);
        this.fileManager.onSamplesChanged = this.handleSamplesChanged.bind(this);
        this.fileManager.onRootDirectoryChanged = this.handleRootDirectoryChanged.bind(this);

        this.init();
    }

    async init() {
        try {
            // Check File System Access API support
            if (!this.fileManager.isSupported()) {
                this.showError('File System Access API not supported. Please use Chrome or Edge browser.');
                return;
            }

            // Initialize FileManager with storage
            await this.fileManager.initialize();

            // Load schema
            await this.schemaHandler.loadSchema();

            // Setup UI event listeners
            this.setupEventListeners();

            // Check for folder parameter in URL after initialization is complete
            await this.handleURLParameters();

            // Show ready message
            console.log('NMR Sample Manager initialized successfully');

        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize application: ' + error.message);
        }
    }

    async handleURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const folderParam = urlParams.get('folder');
        const actionParam = urlParams.get('action');
        
        if (folderParam) {
            if (this.fileManager.rootDirectoryHandle) {
                // Strip root directory path from folder param if present
                let relativePath = folderParam;
                const rootName = this.fileManager.rootDirectoryHandle.name;
                
                // Handle different path formats: /Users/chris/NMR/spec/exp vs spec/exp
                if (folderParam.includes(rootName)) {
                    const rootIndex = folderParam.indexOf(rootName);
                    if (rootIndex !== -1) {
                        // Extract and store the full root path for display
                        const fullRootPath = folderParam.substring(0, rootIndex + rootName.length);
                        this.setStoredRootPath(fullRootPath);
                        // Update the display immediately
                        this.handleRootDirectoryChanged(rootName);
                        
                        // Extract everything after the root directory name
                        relativePath = folderParam.substring(rootIndex + rootName.length);
                        // Remove leading slash if present
                        relativePath = relativePath.replace(/^\/+/, '');
                    }
                }
                
                if (relativePath) {
                    // Check if we have permissions first
                    try {
                        const permissionStatus = await this.fileManager.rootDirectoryHandle.queryPermission({ mode: 'readwrite' });
                        if (permissionStatus === 'granted') {
                            // We have permissions, try automatic navigation
                            await this.fileManager.navigateToSubfolder(relativePath);
                            // Handle actions after successful navigation
                            await this.handleURLAction(actionParam);
                        } else {
                            // Need user interaction for permissions
                            this.showNavigationPrompt(relativePath, actionParam);
                        }
                    } catch (error) {
                        console.error('Error checking permissions for URL navigation:', error);
                        this.showNavigationPrompt(relativePath, actionParam);
                    }
                }
            } else {
                // No root directory set, show message
                const welcomeMessage = document.querySelector('.welcome-message');
                if (welcomeMessage) {
                    welcomeMessage.innerHTML = `
                        <h3>Set Root Directory First</h3>
                        <p>To navigate to: <strong>${this.escapeHtml(folderParam)}</strong></p>
                        <p>Please first set a root directory, then the app will navigate to the requested subfolder.</p>
                    `;
                }
            }
        }
    }

    showNavigationPrompt(relativePath, actionParam = null) {
        const welcomeMessage = document.querySelector('.welcome-message');
        if (welcomeMessage) {
            let actionText = '';
            let buttonText = 'Grant Access & Navigate';
            
            if (actionParam === 'eject') {
                actionText = ' and eject the most recent sample';
                buttonText = 'Grant Access & Navigate + Eject';
            } else if (actionParam === 'inject') {
                actionText = ' and prepare for sample injection';
                buttonText = 'Grant Access & Navigate + Inject';
            }
            
            welcomeMessage.innerHTML = `
                <h3>Navigate to Folder</h3>
                <p>Click the button below to navigate to: <strong>${this.escapeHtml(relativePath)}</strong>${actionText}</p>
                <button id="navigate-to-url-folder" class="btn btn-primary" style="margin-top: 1rem;">
                    ${buttonText}
                </button>
            `;
            
            // Add click handler for the navigation button
            document.getElementById('navigate-to-url-folder').addEventListener('click', async () => {
                try {
                    await this.fileManager.navigateToSubfolder(relativePath);
                    // Handle actions after successful navigation
                    await this.handleURLAction(actionParam);
                    // Clear the welcome message after successful navigation
                    welcomeMessage.innerHTML = '<p class="form-placeholder">Select a sample or create a new one to see the form</p>';
                } catch (error) {
                    console.error('Error navigating from URL prompt:', error);
                    welcomeMessage.innerHTML = `
                        <h3>Navigation Failed</h3>
                        <p>Could not navigate to: <strong>${this.escapeHtml(relativePath)}</strong></p>
                        <p>Error: ${this.escapeHtml(error.message)}</p>
                        <p>Please use "Browse" to select the folder manually.</p>
                    `;
                }
            });
        }
    }

    async handleURLAction(actionParam) {
        if (!actionParam) return;

        try {
            if (actionParam === 'eject') {
                await this.ejectMostRecentSample();
            } else if (actionParam === 'inject') {
                await this.handleInjectAction();
            }
            // Add other actions here in the future
        } catch (error) {
            console.error(`Error handling URL action '${actionParam}':`, error);
            this.showError(`Failed to ${actionParam}: ${error.message}`);
        }
    }

    async ejectMostRecentSample() {
        const sampleFiles = this.fileManager.getSampleFilenames();
        
        if (sampleFiles.length === 0) {
            throw new Error('No samples found in the current directory');
        }

        // Get the most recent sample (last in the alphabetically sorted list)
        const mostRecentSample = sampleFiles[sampleFiles.length - 1];
        
        // Check if it's already ejected
        const status = await this.fileManager.getSampleStatus(mostRecentSample);
        if (status === 'ejected') {
            throw new Error(`Most recent sample (${mostRecentSample}) is already ejected`);
        }

        // Eject the sample
        console.log(`Ejecting most recent sample: ${mostRecentSample}`);
        await this.fileManager.ejectSample(mostRecentSample);
        
        // Refresh the sample list to update status
        await this.fileManager.scanForSamples();
        
        this.showSuccess(`Successfully ejected most recent sample: ${mostRecentSample}`);
    }

    async handleInjectAction() {
        const sampleFiles = this.fileManager.getSampleFilenames();
        
        if (sampleFiles.length === 0) {
            // No samples exist, start creating a new sample
            console.log('No samples found, starting new sample creation');
            this.createNewSample();
            this.showSuccess('Started creating new sample for injection');
        } else {
            // Samples exist, prevent auto-selection and prompt user for choice
            this.currentOperation = 'inject-prompt';
            this.showInjectPrompt(sampleFiles);
        }
    }

    showInjectPrompt(sampleFiles) {
        const welcomeMessage = document.querySelector('.welcome-message');
        if (welcomeMessage) {
            const sampleCount = sampleFiles.length;
            const mostRecentSample = sampleFiles[sampleFiles.length - 1];
            
            welcomeMessage.innerHTML = `
                <h3>Sample Injection</h3>
                <p>Found ${sampleCount} existing sample${sampleCount > 1 ? 's' : ''} in this folder.</p>
                <p>Most recent: <strong>${this.escapeHtml(mostRecentSample)}</strong></p>
                <p>What would you like to do?</p>
                <div style="margin-top: 1rem; display: flex; gap: 0.75rem;">
                    <button id="inject-new-sample" class="btn btn-success">
                        Create New Sample
                    </button>
                    <button id="inject-duplicate-sample" class="btn btn-info">
                        Duplicate Most Recent
                    </button>
                </div>
                <p style="margin-top: 1rem; font-size: 0.9rem; color: #6c757d;">
                    <em>Tip: You can also select any sample from the list on the left and use the "Duplicate" button.</em>
                </p>
            `;
            
            // Add click handlers for the action buttons
            document.getElementById('inject-new-sample').addEventListener('click', () => {
                console.log('User chose to create new sample for injection');
                this.currentOperation = null; // Clear inject prompt operation
                this.createNewSample(); // This will handle operation tracking internally
                welcomeMessage.innerHTML = '<p class="form-placeholder">Creating new sample...</p>';
            });
            
            document.getElementById('inject-duplicate-sample').addEventListener('click', () => {
                console.log('User chose to duplicate most recent sample for injection');
                // Set the selected file and duplicate directly
                this.currentOperation = null; // Clear inject prompt operation
                this.selectedSampleFile = mostRecentSample;
                this.duplicateSelectedSample();
                welcomeMessage.innerHTML = '<p class="form-placeholder">Duplicating sample for injection...</p>';
            });
        }
    }

    async ejectAllPreviousSamples() {
        const sampleFiles = this.fileManager.getSampleFilenames();
        let ejectedCount = 0;
        
        for (const sampleFile of sampleFiles) {
            try {
                const status = await this.fileManager.getSampleStatus(sampleFile);
                if (status !== 'ejected') {
                    console.log(`Auto-ejecting previous sample: ${sampleFile}`);
                    await this.fileManager.ejectSample(sampleFile);
                    ejectedCount++;
                }
            } catch (error) {
                console.error(`Error auto-ejecting sample ${sampleFile}:`, error);
            }
        }
        
        if (ejectedCount > 0) {
            console.log(`Auto-ejected ${ejectedCount} previous sample${ejectedCount > 1 ? 's' : ''}`);
            // Refresh the sample list to show updated statuses
            await this.fileManager.scanForSamples();
            this.showSuccess(`Auto-ejected ${ejectedCount} previous sample${ejectedCount > 1 ? 's' : ''} before creating new sample`);
        }
    }

    setupEventListeners() {
        // Root directory selection
        document.getElementById('set-root-folder').addEventListener('click', () => {
            this.setRootDirectory();
        });

        // Subfolder selection
        document.getElementById('browse-subfolder').addEventListener('click', () => {
            this.selectSubfolder();
        });

        // Timeline button
        document.getElementById('show-timeline').addEventListener('click', () => {
            this.showTimeline();
        });

        // Sample management buttons
        document.getElementById('new-sample').addEventListener('click', () => {
            this.createNewSample();
        });

        document.getElementById('duplicate-sample').addEventListener('click', () => {
            this.duplicateSelectedSample();
        });

        document.getElementById('edit-sample').addEventListener('click', () => {
            this.editSelectedSample();
        });

        document.getElementById('eject-sample').addEventListener('click', () => {
            this.ejectSelectedSample();
        });
    }

    async setRootDirectory() {
        try {
            await this.fileManager.setRootDirectory();
        } catch (error) {
            console.error('Error setting root directory:', error);
            this.showError('Failed to set root directory: ' + error.message);
        }
    }

    async selectSubfolder() {
        try {
            // First try to request permissions for current directory if needed
            if (this.fileManager.rootDirectoryHandle) {
                const hasPermission = await this.fileManager.requestCurrentDirectoryPermissions();
                if (hasPermission) {
                    await this.fileManager.scanForSamples(); // Refresh samples if we got permission
                }
            }
            await this.fileManager.selectSubfolder();
        } catch (error) {
            console.error('Error selecting subfolder:', error);
            this.showError('Failed to select subfolder: ' + error.message);
        }
    }

    handleRootDirectoryChanged(rootDirectoryName) {
        const rootElement = document.getElementById('root-folder');
        if (rootDirectoryName) {
            // If we have stored full path context, use it
            const fullPath = this.getStoredRootPath() || rootDirectoryName;
            rootElement.textContent = fullPath;
            rootElement.style.color = '#495057';
        } else {
            rootElement.textContent = 'No root directory set';
            rootElement.style.color = '#6c757d';
        }
    }

    getStoredRootPath() {
        // Try to get full path from localStorage if previously stored
        return localStorage.getItem('nmr-root-path');
    }

    setStoredRootPath(path) {
        localStorage.setItem('nmr-root-path', path);
    }

    handleDirectoryChanged(directoryName) {
        // Extract just the final folder name from the full path
        const finalFolderName = directoryName ? directoryName.split('/').pop() : 'No folder selected';
        document.getElementById('current-folder').textContent = finalFolderName;
        
        // Enable timeline button when directory is selected
        const timelineBtn = document.getElementById('show-timeline');
        timelineBtn.disabled = !directoryName;
    }

    async handleSamplesChanged(sampleFilenames) {
        console.log('Samples changed:', sampleFilenames);
        const sampleList = document.getElementById('sample-list');
        
        // Clear existing content completely
        sampleList.innerHTML = '';
        
        // Clear current selection if the selected file is no longer in the list
        if (this.selectedSampleFile && !sampleFilenames.includes(this.selectedSampleFile)) {
            this.selectedSampleFile = null;
            this.clearForm();
        }

        if (sampleFilenames.length === 0) {
            sampleList.innerHTML = '<p class="form-placeholder">No sample files found in this directory</p>';
            this.updateButtonStates(false);
            return;
        }

        // Create fresh sample items
        for (const filename of sampleFilenames) {
            const sampleItem = await this.createSampleListItem(filename);
            sampleList.appendChild(sampleItem);
        }

        // Restore selection if it still exists
        if (this.selectedSampleFile && sampleFilenames.includes(this.selectedSampleFile)) {
            const selectedRadio = document.querySelector(`input[value="${this.selectedSampleFile}"]`);
            if (selectedRadio) {
                selectedRadio.checked = true;
                selectedRadio.closest('.sample-item').classList.add('selected');
                this.updateButtonStates(true);
            }
        } else if (!this.currentOperation) {
            // No previous selection and no ongoing operation, automatically select the most recent sample
            const mostRecentSample = sampleFilenames[sampleFilenames.length - 1];
            if (mostRecentSample) {
                console.log('Auto-selecting most recent sample:', mostRecentSample);
                await this.selectSample(mostRecentSample);
            } else {
                this.updateButtonStates(false);
            }
        } else {
            // Auto-selection is skipped (e.g., for inject prompt)
            this.updateButtonStates(false);
        }
    }

    async createSampleListItem(filename) {
        const item = document.createElement('div');
        item.className = 'sample-item';
        
        // Make entire item clickable
        item.addEventListener('click', async (e) => {
            // Don't trigger if clicking on the radio button itself
            if (e.target.type !== 'radio') {
                const radio = item.querySelector('input[type="radio"]');
                if (radio) {
                    radio.checked = true;
                    await this.selectSample(filename);
                }
            }
        });
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'selected-sample';
        radio.value = filename;
        radio.addEventListener('change', async () => {
            await this.selectSample(filename);
        });

        const labelSpan = document.createElement('span');
        labelSpan.className = 'sample-label';

        const statusSpan = document.createElement('span');
        statusSpan.className = 'sample-status';
        
        try {
            // Load sample data to get the label
            const sampleData = await this.fileManager.readSample(filename);
            const sampleLabel = sampleData.Sample?.Label || 'Untitled Sample';
            
            // Truncate long labels (keep first 25 characters + ellipsis)
            const displayLabel = sampleLabel.length > 25 ? sampleLabel.substring(0, 25) + '...' : sampleLabel;
            labelSpan.textContent = displayLabel;
            labelSpan.title = sampleLabel; // Show full label on hover
            
            const status = await this.fileManager.getSampleStatus(filename);
            // Only show EJECTED status, hide others
            if (status === 'ejected') {
                statusSpan.textContent = 'EJECTED';
                statusSpan.classList.add('status-ejected');
            } else {
                statusSpan.style.display = 'none';
            }
        } catch (error) {
            // Fallback to filename if sample can't be read
            labelSpan.textContent = filename;
            statusSpan.textContent = 'ERROR';
            statusSpan.classList.add('status-error');
        }

        item.appendChild(radio);
        item.appendChild(labelSpan);
        item.appendChild(statusSpan);

        return item;
    }

    async selectSample(filename) {
        console.log('Selecting sample:', filename);
        this.selectedSampleFile = filename;
        
        // Update UI selection
        document.querySelectorAll('.sample-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        const selectedRadio = document.querySelector(`input[value="${filename}"]`);
        if (selectedRadio) {
            selectedRadio.checked = true;
            selectedRadio.closest('.sample-item').classList.add('selected');
        }

        this.updateButtonStates(true);
        
        // Show loading message immediately - clear React first
        this.showLoadingMessage();
        
        // Load and display sample data in read-only mode
        await this.loadAndDisplaySample(filename);
    }
    
    showLoadingMessage() {
        const formContainer = document.getElementById('sample-form');
        
        // Always unmount React components first
        if (this.currentReactRoot) {
            try {
                ReactDOM.unmountComponentAtNode(formContainer);
            } catch (e) {
                console.warn('Error unmounting React component for loading:', e);
            }
            this.currentReactRoot = null;
        }
        
        formContainer.innerHTML = '<p class="form-placeholder">Loading sample data...</p>';
    }

    async loadAndDisplaySample(filename) {
        try {
            console.log('Loading sample data for:', filename);
            console.log('Available samples in cache:', Array.from(this.fileManager.sampleFiles.keys()));
            const data = await this.fileManager.readSample(filename);
            console.log('Sample data loaded:', data);
            this.renderForm(data, false); // false = read-only
        } catch (error) {
            console.error('Error loading sample for display:', error);
            console.error('Error details:', error.message);
            console.error('Error stack:', error.stack);
            
            // Clear React components first, then show error
            const formContainer = document.getElementById('sample-form');
            if (this.currentReactRoot) {
                try {
                    ReactDOM.unmountComponentAtNode(formContainer);
                } catch (e) {
                    console.warn('Error unmounting React component for error:', e);
                }
                this.currentReactRoot = null;
            }
            formContainer.innerHTML = `<p class="error">Error loading sample data: ${error.message}</p>`;
        }
    }

    updateButtonStates(hasSelection) {
        const duplicateBtn = document.getElementById('duplicate-sample');
        const editBtn = document.getElementById('edit-sample');
        const ejectBtn = document.getElementById('eject-sample');

        duplicateBtn.disabled = !hasSelection;
        editBtn.disabled = !hasSelection;
        ejectBtn.disabled = !hasSelection;
    }

    async createNewSample() {
        try {
            console.log('Creating new sample...');
            // Set operation to prevent auto-selection during the entire process
            this.currentOperation = 'creating-new';
            this.selectedSampleFile = null;
            
            // Auto-eject all previous samples before creating new one
            await this.ejectAllPreviousSamples();
            
            const defaultData = this.schemaHandler.createDefaultData();
            console.log('Default data:', defaultData);
            this.currentSample = defaultData;
            this.renderForm(defaultData, true);
            
            // Don't clear operation flag immediately - let it be cleared when user saves or when another explicit action occurs
        } catch (error) {
            console.error('Error creating new sample:', error);
            this.showError('Failed to create new sample: ' + error.message);
        }
    }

    async duplicateSelectedSample() {
        if (!this.selectedSampleFile) return;

        try {
            // Auto-eject all previous samples before creating duplicate
            await this.ejectAllPreviousSamples();
            
            const newLabel = prompt('Enter label for duplicated sample:', 'Duplicate');
            if (!newLabel) return;

            const newFilename = await this.fileManager.duplicateSample(this.selectedSampleFile, newLabel);
            
            // Load the new sample for editing
            const newData = await this.fileManager.readSample(newFilename);
            this.currentSample = newData;
            this.selectedSampleFile = newFilename;
            this.renderForm(newData, true);

        } catch (error) {
            console.error('Error duplicating sample:', error);
            this.showError('Failed to duplicate sample: ' + error.message);
        }
    }

    async editSelectedSample() {
        if (!this.selectedSampleFile) return;

        try {
            const data = await this.fileManager.readSample(this.selectedSampleFile);
            this.currentSample = data;
            this.renderForm(data, true);
        } catch (error) {
            console.error('Error loading sample:', error);
            this.showError('Failed to load sample: ' + error.message);
        }
    }

    async ejectSelectedSample() {
        if (!this.selectedSampleFile) return;

        const confirmed = confirm(`Are you sure you want to eject sample: ${this.selectedSampleFile}?`);
        if (!confirmed) return;

        try {
            console.log('Ejecting sample:', this.selectedSampleFile);
            await this.fileManager.ejectSample(this.selectedSampleFile);
            
            // Refresh the sample list to update status
            console.log('Refreshing sample list after ejection');
            await this.fileManager.scanForSamples();
            
            this.showSuccess('Sample ejected successfully');
        } catch (error) {
            console.error('Error ejecting sample:', error);
            this.showError('Failed to eject sample: ' + error.message);
        }
    }

    renderForm(data, editable = false) {
        const formContainer = document.getElementById('sample-form');
        
        console.log('Rendering form, editable:', editable, 'data:', data);
        
        // Always unmount React components first to avoid conflicts
        if (this.currentReactRoot) {
            try {
                ReactDOM.unmountComponentAtNode(formContainer);
            } catch (e) {
                console.warn('Error unmounting React component:', e);
            }
            this.currentReactRoot = null;
        }
        
        // Clear container completely
        formContainer.innerHTML = '';
        
        if (!editable) {
            // Show nicely formatted sample details
            this.generateSampleDetailsView(data).then(html => {
                formContainer.innerHTML = html;
            }).catch(error => {
                console.error('Error generating sample details:', error);
                formContainer.innerHTML = `<p class="error">Error loading sample details: ${this.escapeHtml(error.message)}</p>`;
            });
            return;
        }

        try {
            // Check if React JSON Schema Form v1.8.1 is loaded
            console.log('Available globals:', Object.keys(window).filter(k => 
                k.includes('JSON') || k.includes('Form') || k.includes('RJSF')
            ));
            
            if (!window.JSONSchemaForm) {
                formContainer.innerHTML = '<p class="error">React JSON Schema Form not loaded. Please check your internet connection.</p>';
                return;
            }

            // Use the working v1.8.1 API
            const Form = window.JSONSchemaForm.default || window.JSONSchemaForm;
            
            console.log('Form component:', Form);
            console.log('Form type:', typeof Form);
            
            // Create React form props (v1.8.1 API - simple and reliable)
            const formProps = {
                schema: this.schemaHandler.getSchema(),
                uiSchema: this.schemaHandler.getUISchema(),
                formData: data,
                onSubmit: ({ formData }) => this.handleFormSubmit({ formData }),
                onError: (errors) => this.handleFormError(errors),
                onKeyDown: (e) => {
                    // Prevent Enter key from submitting form
                    if (e.key === 'Enter' && e.target.type !== 'submit') {
                        e.preventDefault();
                    }
                }
            };

            console.log('Rendering React form with props:', formProps);

            // Create form element using React.createElement
            const formElement = React.createElement(Form, formProps);
            
            // Use ReactDOM.render (React 16)
            ReactDOM.render(formElement, formContainer);
            this.currentReactRoot = formContainer;
            
        } catch (error) {
            console.error('Error rendering form:', error);
            // Clear any React components first, then show error
            formContainer.innerHTML = '';
            formContainer.innerHTML = `<p class="error">Error rendering form: ${error.message}</p>`;
        }
    }

    async handleFormSubmit({ formData }) {
        try {
            // Process form data
            const processedData = this.schemaHandler.processFormData(formData);
            
            // Generate filename if this is a new sample
            let filename = this.selectedSampleFile;
            if (!filename) {
                const sampleLabel = processedData.Sample?.Label || 'NewSample';
                filename = this.fileManager.generateFilename(sampleLabel);
            }

            // Save the sample
            await this.fileManager.writeSample(filename, processedData);
            
            // Clear any ongoing operation since save is complete
            this.currentOperation = null;
            
            this.showSuccess(`Sample saved successfully: ${filename}`);
            
            // Clear form
            this.clearForm();
            
        } catch (error) {
            console.error('Error saving sample:', error);
            this.showError('Failed to save sample: ' + error.message);
        }
    }

    handleFormError(errors) {
        console.error('Form validation errors:', errors);
        this.showError('Please fix the form errors before saving');
    }

    clearForm() {
        const formContainer = document.getElementById('sample-form');
        formContainer.innerHTML = '<p class="form-placeholder">Select a sample or create a new one to see the form</p>';
        
        // Clear selection
        this.currentSample = null;
        this.selectedSampleFile = null;
        
        // Reset radio buttons
        document.querySelectorAll('input[name="selected-sample"]').forEach(radio => {
            radio.checked = false;
        });
        
        document.querySelectorAll('.sample-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        this.updateButtonStates(false);
    }

    async generateSampleDetailsView(data) {
        const sampleLabel = data.Sample?.Label || 'Untitled Sample';
        
        // Get experiments table for this sample's lifecycle
        const experimentsSection = await this.generateExperimentsSection(data);
        
        return `
            <div class="sample-details">
                <div class="sample-details-header">
                    <h3>Sample: ${this.escapeHtml(sampleLabel)}</h3>
                </div>
                <div class="sample-details-body">
                    ${this.generateUsersSection(data.Users)}
                    ${this.generateSampleSection(data.Sample)}
                    ${this.generateBufferSection(data.Buffer)}
                    ${this.generateNMRTubeSection(data['NMR Tube'])}
                    ${this.generateLabReferenceSection(data['Laboratory Reference'])}
                    ${this.generateNotesSection(data.Notes)}
                    ${this.generateMetadataSection(data.Metadata)}
                    ${experimentsSection}
                </div>
            </div>
        `;
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    generateUsersSection(users) {
        if (!users || users.length === 0) return '';
        
        return `
            <div class="detail-row">
                <div class="detail-label">Users</div>
                <div class="detail-content">${users.map(user => this.escapeHtml(user)).join(', ')}</div>
            </div>
        `;
    }

    generateSampleSection(sample) {
        if (!sample) return '';
        
        let content = '';
        
        if (sample.Components && sample.Components.length > 0) {
            const componentLines = [];
            sample.Components.forEach(component => {
                let componentText = '';
                if (component.Name) {
                    componentText += this.escapeHtml(component.Name);
                }
                if (component.Concentration !== undefined) {
                    const concentration = `${component.Concentration || 0} ${component.Unit || ''}`;
                    componentText += componentText ? ` (${concentration})` : concentration;
                }
                if (component['Isotopic labelling']) {
                    componentText += ` - ${this.escapeHtml(component['Isotopic labelling'])}`;
                }
                if (componentText) {
                    componentLines.push(componentText);
                }
            });
            content = '<ul style="margin: 0; padding-left: 1.2rem;">' + 
                      componentLines.map(line => `<li>${line}</li>`).join('') + 
                      '</ul>';
        }
        
        return content ? `
            <div class="detail-row">
                <div class="detail-label">Sample</div>
                <div class="detail-content">${content}</div>
            </div>
        ` : '';
    }

    generateBufferSection(buffer) {
        if (!buffer) return '';
        
        const componentsList = [];
        const otherInfo = [];
        
        // Add components as bullet points
        if (buffer.Components && buffer.Components.length > 0) {
            buffer.Components.forEach(component => {
                let componentText = '';
                if (component.name) {
                    componentText += this.escapeHtml(component.name);
                }
                if (component.Concentration !== undefined) {
                    const concentration = `${component.Concentration || 0} ${component.Unit || ''}`;
                    componentText += componentText ? ` (${concentration})` : concentration;
                }
                if (componentText) {
                    componentsList.push(componentText);
                }
            });
        }
        
        // Add other buffer info with bold labels
        if (buffer.pH !== undefined && buffer.pH !== null) {
            otherInfo.push(`<strong>pH:</strong> ${buffer.pH}`);
        }
        
        if (buffer['Chemical shift reference'] && buffer['Chemical shift reference'] !== 'none') {
            let referenceText = `<strong>Chemical shift reference:</strong> ${this.escapeHtml(buffer['Chemical shift reference'])}`;
            if (buffer['Reference concentration'] !== undefined && buffer['Reference unit']) {
                referenceText += ` (${buffer['Reference concentration']} ${buffer['Reference unit']})`;
            }
            otherInfo.push(referenceText);
        }
        
        if (buffer.Solvent) {
            otherInfo.push(`<strong>Solvent:</strong> ${this.escapeHtml(buffer.Solvent)}`);
        }
        
        if (componentsList.length === 0 && otherInfo.length === 0) return '';
        
        let content = '';
        if (componentsList.length > 0) {
            content += '<ul style="margin: 0; padding-left: 1.2rem;">' + 
                      componentsList.map(line => `<li>${line}</li>`).join('') + 
                      '</ul>';
            if (otherInfo.length > 0) {
                content += '<br>' + otherInfo.join('<br>');
            }
        } else {
            content = otherInfo.join('<br>');
        }
        
        return `
            <div class="detail-row">
                <div class="detail-label">Buffer</div>
                <div class="detail-content">${content}</div>
            </div>
        `;
    }

    generateNMRTubeSection(tube) {
        if (!tube) return '';
        
        const contentLines = [];
        
        if (tube.Diameter) {
            contentLines.push(`<strong>Diameter:</strong> ${this.escapeHtml(tube.Diameter)}`);
        }
        
        if (tube.Type) {
            contentLines.push(`<strong>Type:</strong> ${this.escapeHtml(tube.Type)}`);
        }
        
        if (tube['Sample Volume']) {
            contentLines.push(`<strong>Volume:</strong> ${tube['Sample Volume']} µL`);
        }
        
        if (tube['SampleJet Rack Position']) {
            contentLines.push(`<strong>Rack Position:</strong> ${this.escapeHtml(tube['SampleJet Rack Position'])}`);
        }
        
        if (tube['SampleJet Rack ID']) {
            contentLines.push(`<strong>Rack ID:</strong> ${this.escapeHtml(tube['SampleJet Rack ID'])}`);
        }
        
        return contentLines.length > 0 ? `
            <div class="detail-row">
                <div class="detail-label">NMR Tube</div>
                <div class="detail-content">${contentLines.join('<br>')}</div>
            </div>
        ` : '';
    }


    generateLabReferenceSection(labRef) {
        if (!labRef) return '';
        
        const contentLines = [];
        
        if (labRef['Labbook Entry']) {
            contentLines.push(`<strong>Labbook:</strong> ${this.escapeHtml(labRef['Labbook Entry'])}`);
        }
        
        if (labRef['Experiment ID']) {
            contentLines.push(`<strong>Experiment:</strong> ${this.escapeHtml(labRef['Experiment ID'])}`);
        }
        
        return contentLines.length > 0 ? `
            <div class="detail-row">
                <div class="detail-label">Lab Reference</div>
                <div class="detail-content">${contentLines.join('<br>')}</div>
            </div>
        ` : '';
    }

    generateNotesSection(notes) {
        if (!notes) return '';
        
        return `
            <div class="detail-row">
                <div class="detail-label">Notes</div>
                <div class="detail-content" style="white-space: pre-wrap;">${this.escapeHtml(notes)}</div>
            </div>
        `;
    }

    generateMetadataSection(metadata) {
        if (!metadata) return '';
        
        const contentLines = [];
        
        if (metadata.created_timestamp) {
            const createdDate = new Date(metadata.created_timestamp);
            const dateStr = createdDate.toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric', 
                month: 'short',
                year: 'numeric'
            });
            const timeStr = createdDate.toTimeString().split(' ')[0];
            contentLines.push(`<strong>Created:</strong> ${dateStr} ${timeStr}`);
        }
        
        if (metadata.modified_timestamp) {
            const modifiedDate = new Date(metadata.modified_timestamp);
            const dateStr = modifiedDate.toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric', 
                month: 'short',
                year: 'numeric'
            });
            const timeStr = modifiedDate.toTimeString().split(' ')[0];
            contentLines.push(`<strong>Modified:</strong> ${dateStr} ${timeStr}`);
        }
        
        if (metadata.ejected_timestamp) {
            const ejectedDate = new Date(metadata.ejected_timestamp);
            const dateStr = ejectedDate.toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric', 
                month: 'short',
                year: 'numeric'
            });
            const timeStr = ejectedDate.toTimeString().split(' ')[0];
            contentLines.push(`<strong>Ejected:</strong> ${dateStr} ${timeStr}`);
        }
        
        return contentLines.length > 0 ? `
            <div class="detail-row">
                <div class="detail-label">Metadata</div>
                <div class="detail-content">${contentLines.join('<br>')}</div>
            </div>
        ` : '';
    }

    async generateExperimentsSection(sampleData) {
        try {
            const timelineData = await this.fileManager.generateTimelineData();
            
            // Get sample lifecycle timestamps
            const metadata = sampleData.Metadata || {};
            const sampleCreated = metadata.created_timestamp ? new Date(metadata.created_timestamp) : null;
            const sampleEjected = metadata.ejected_timestamp ? new Date(metadata.ejected_timestamp) : null;
            
            // Filter to only show experiment events within sample lifecycle
            let experimentEvents = timelineData.filter(event => event.type === 'Experiment');
            
            // Filter by sample lifecycle if we have timestamps
            if (sampleCreated) {
                experimentEvents = experimentEvents.filter(event => {
                    const experimentTime = event.rawTimestamp;
                    
                    // Must be after sample creation
                    if (experimentTime < sampleCreated) return false;
                    
                    // Must be before sample ejection (if ejected)
                    if (sampleEjected && experimentTime > sampleEjected) return false;
                    
                    return true;
                });
            }
            
            if (experimentEvents.length === 0) {
                return `
                    <div class="experiments-section">
                        <h4>Experiments</h4>
                        <p>No experiments found for this sample</p>
                    </div>
                `;
            }
            
            let tableRows = '';
            experimentEvents.forEach((event) => {
                const date = event.rawTimestamp.toLocaleDateString('en-GB', {
                    weekday: 'short',
                    day: 'numeric', 
                    month: 'short',
                    year: 'numeric'
                });
                const time = event.rawTimestamp.toTimeString().split(' ')[0];
                
                // Use consistent darker shading for all rows
                let rowClass = 'timeline-group-1';
                
                tableRows += `
                    <tr class="${rowClass}">
                        <td>${event.experimentNumber}</td>
                        <td>${date}</td>
                        <td>${time}</td>
                        <td>${this.escapeHtml(event.event)}</td>
                        <td>${this.escapeHtml(event.details)}</td>
                    </tr>
                `;
            });
            
            return `
                <div class="experiments-section">
                    <h4>Experiments (${experimentEvents.length})</h4>
                    <table class="timeline-table">
                        <thead>
                            <tr>
                                <th>Exp</th>
                                <th>Date</th>
                                <th>Time</th>
                                <th>Pulse Program</th>
                                <th>Title</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            console.error('Error generating experiments section:', error);
            return `
                <div class="detail-section">
                    <h4>Experiments</h4>
                    <p class="detail-value error">Error loading experiments: ${this.escapeHtml(error.message)}</p>
                </div>
            `;
        }
    }

    showError(message) {
        alert('Error: ' + message);
    }

    showSuccess(message) {
        alert('Success: ' + message);
    }

    showInfo(message) {
        alert('Info: ' + message);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Assign alternating color groups based on sample sessions
     */
    assignSampleGroupColors(timelineData) {
        const result = [];
        let currentColorIndex = 0;
        let currentSample = null;
        
        timelineData.forEach((event) => {
            if (event.type === 'Sample' && event.event === 'Created') {
                // New sample session starts
                currentSample = event.details;
                currentColorIndex = currentColorIndex === 0 ? 1 : 0; // Alternate between 0 and 1
            }
            
            // Assign current color to this event
            result.push({
                ...event,
                colorGroup: currentColorIndex
            });
            
            if (event.type === 'Sample' && event.event === 'Ejected' && event.details === currentSample) {
                // Sample session ends
                currentSample = null;
            }
        });
        
        return result;
    }

    /**
     * Show timeline view
     */
    async showTimeline() {
        try {
            const timelineData = await this.fileManager.generateTimelineData();
            this.renderTimeline(timelineData);
            
        } catch (error) {
            console.error('Error showing timeline:', error);
            this.showError('Failed to load timeline: ' + error.message);
        }
    }

    /**
     * Render timeline table
     */
    renderTimeline(timelineData) {
        const contentArea = document.getElementById('sample-form');
        
        if (timelineData.length === 0) {
            contentArea.innerHTML = `
                <div class="timeline-view">
                    <h3>Experiment Timeline</h3>
                    <p>No timeline data found in this directory.</p>
                </div>
            `;
            return;
        }

        // Assign sample group colors
        const timelineWithColors = this.assignSampleGroupColors(timelineData);

        let tableRows = '';
        timelineWithColors.forEach((event) => {
            // Format date as "Mon 9 Oct 2023"
            const date = event.rawTimestamp.toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric', 
                month: 'short',
                year: 'numeric'
            });
            const time = event.rawTimestamp.toTimeString().split(' ')[0];
            
            // Use sample group color class and add bold for sample creation
            let rowClass = `timeline-group-${event.colorGroup}`;
            if (event.type === 'Sample' && event.event === 'Created') {
                rowClass += ' timeline-sample-created';
            }
            
            // Show experiment number for experiments, or just the type for samples
            const typeDisplay = event.type === 'Experiment' ? event.experimentNumber : event.type;
            
            tableRows += `
                <tr class="${rowClass}">
                    <td>${date}</td>
                    <td>${time}</td>
                    <td>${typeDisplay}</td>
                    <td>${this.escapeHtml(event.event)}</td>
                    <td>${this.escapeHtml(event.details)}</td>
                </tr>
            `;
        });

        contentArea.innerHTML = `
            <div class="timeline-view">
                <h3>Experiment Timeline</h3>
                <p>Showing ${timelineData.length} events from ${this.fileManager.getFullCurrentPath()}</p>
                <table class="timeline-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Experiment</th>
                            <th>Event / pulseprogram</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                <p class="timeline-footer">
                    <em>Click on any sample in the list to return to normal view</em>
                </p>
            </div>
        `;
    }
}

// Application initialization is now controlled by index.html
// to ensure schema is loaded before app starts
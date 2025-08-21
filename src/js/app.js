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

        // Bind event handlers
        this.fileManager.onDirectoryChanged = this.handleDirectoryChanged.bind(this);
        this.fileManager.onSamplesChanged = this.handleSamplesChanged.bind(this);

        this.init();
    }

    async init() {
        try {
            // Check File System Access API support
            if (!this.fileManager.isSupported()) {
                this.showError('File System Access API not supported. Please use Chrome or Edge browser.');
                return;
            }

            // Load schema
            await this.schemaHandler.loadSchema();

            // Setup UI event listeners
            this.setupEventListeners();

            // Show ready message
            console.log('NMR Sample Manager initialized successfully');

        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize application: ' + error.message);
        }
    }

    setupEventListeners() {
        // Folder selection
        document.getElementById('browse-folder').addEventListener('click', () => {
            this.selectFolder();
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

    async selectFolder() {
        try {
            await this.fileManager.selectDirectory();
        } catch (error) {
            console.error('Error selecting folder:', error);
            this.showError('Failed to select folder: ' + error.message);
        }
    }

    handleDirectoryChanged(directoryName) {
        document.getElementById('current-folder').textContent = directoryName;
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
        } else {
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

        const filenameSpan = document.createElement('span');
        filenameSpan.className = 'sample-filename';
        filenameSpan.textContent = filename;

        const statusSpan = document.createElement('span');
        statusSpan.className = 'sample-status';
        
        try {
            const status = await this.fileManager.getSampleStatus(filename);
            statusSpan.textContent = status.toUpperCase();
            statusSpan.classList.add(`status-${status}`);
        } catch (error) {
            statusSpan.textContent = 'ERROR';
            statusSpan.classList.add('status-error');
        }

        item.appendChild(radio);
        item.appendChild(filenameSpan);
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
            const defaultData = this.schemaHandler.createDefaultData();
            console.log('Default data:', defaultData);
            this.currentSample = defaultData;
            this.selectedSampleFile = null;
            this.renderForm(defaultData, true);
        } catch (error) {
            console.error('Error creating new sample:', error);
            this.showError('Failed to create new sample: ' + error.message);
        }
    }

    async duplicateSelectedSample() {
        if (!this.selectedSampleFile) return;

        try {
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
            // Show read-only data
            formContainer.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
            return;
        }

        try {
            // Check if React JSON Schema Form is loaded (v1.8.1)
            if (!window.JSONSchemaForm) {
                formContainer.innerHTML = '<p class="error">React JSON Schema Form not loaded. Please check your internet connection.</p>';
                return;
            }

            // For v1.8.1, extract the Form component correctly
            const Form = window.JSONSchemaForm.default || window.JSONSchemaForm.Form || window.JSONSchemaForm;
            
            // Create React form props (v1.8.1 API)
            const formProps = {
                schema: this.schemaHandler.getSchema(),
                uiSchema: this.schemaHandler.getUISchema(),
                formData: data,
                onSubmit: ({ formData }) => this.handleFormSubmit({ formData }),
                onError: (errors) => this.handleFormError(errors)
            };

            console.log('Rendering React form with props:', formProps);

            // Create form element using React.createElement
            const formElement = React.createElement(Form, formProps);
            
            // Render React component
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

    showError(message) {
        alert('Error: ' + message);
    }

    showSuccess(message) {
        alert('Success: ' + message);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.sampleManager = new NMRSampleManager();
});
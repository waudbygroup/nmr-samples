/**
 * Schema Handler - Manages JSON schema loading and form generation
 * Desktop-only NMR Sample Manager
 */

class SchemaHandler {
    constructor() {
        this.schema = null;
        this.currentVersion = '0.0.1';
    }

    /**
     * Load schema from embedded data
     */
    async loadSchema(version = this.currentVersion) {
        try {
            if (window.EMBEDDED_SCHEMA) {
                this.schema = window.EMBEDDED_SCHEMA;
                return this.schema;
            } else {
                throw new Error('Embedded schema not found');
            }
        } catch (error) {
            console.error('Error loading schema:', error);
            throw error;
        }
    }

    /**
     * Get the current schema
     */
    getSchema() {
        return this.schema;
    }

    /**
     * Validate data against the schema
     */
    validate(data) {
        if (!this.schema) {
            throw new Error('Schema not loaded');
        }
        
        // Basic validation - in a real implementation you'd use Ajv or similar
        // For now, just check that the data is an object
        return typeof data === 'object' && data !== null;
    }

    /**
     * Create default/empty data structure based on schema
     */
    createDefaultData() {
        if (!this.schema) {
            throw new Error('Schema not loaded');
        }

        // Create a minimal valid structure based on our schema
        return {
            Users: [],
            Sample: {
                Label: '',
                Components: []
            },
            Buffer: {
                Components: [],
                pH: null,
                Solvent: '10% D2O'
            },
            'NMR Tube': {
                'Sample Volume': null,
                Diameter: '5 mm',
                Type: 'regular',
                'SampleJet Rack Position': '',
                'SampleJet Rack ID': ''
            },
            'Laboratory Reference': {
                'Labbook Entry': '',
                'Experiment ID': ''
            },
            Notes: '',
            Metadata: {
                schema_version: this.currentVersion
            }
        };
    }

    /**
     * Get UI schema for form customization
     */
    getUISchema() {
        return {
            Users: {
                "ui:options": {
                    orderable: false
                }
            },
            Sample: {
                Label: {
                    "ui:placeholder": "Enter a descriptive sample name"
                },
                Components: {
                    "ui:options": {
                        orderable: false
                    },
                    items: {
                        Name: {
                            "ui:placeholder": "e.g., MyProtein, BSA, etc."
                        },
                        'Isotopic labelling': {
                            "ui:widget": "select"
                        },
                        'Custom labelling': {
                            "ui:widget": "textarea",
                            "ui:placeholder": "Describe custom labelling scheme"
                        },
                        Concentration: {
                            "ui:placeholder": "Numeric value"
                        },
                        Unit: {
                            "ui:widget": "select"
                        }
                    }
                }
            },
            Buffer: {
                Components: {
                    "ui:options": {
                        orderable: false
                    },
                    items: {
                        name: {
                            "ui:placeholder": "e.g., Tris-HCl, NaCl, EDTA"
                        },
                        Concentration: {
                            "ui:placeholder": "Numeric value"
                        },
                        Unit: {
                            "ui:widget": "select"
                        }
                    }
                },
                pH: {
                    "ui:placeholder": "e.g., 7.4"
                },
                'Chemical shift reference': {
                    "ui:widget": "select"
                },
                'Reference concentration': {
                    "ui:placeholder": "e.g., 0.1"
                },
                'Reference unit': {
                    "ui:widget": "select"
                },
                Solvent: {
                    "ui:widget": "select"
                },
                'Custom solvent': {
                    "ui:widget": "textarea",
                    "ui:placeholder": "Describe custom solvent composition"
                }
            },
            'NMR Tube': {
                'Sample Volume': {
                    "ui:placeholder": "e.g., 600"
                },
                Diameter: {
                    "ui:widget": "select"
                },
                Type: {
                    "ui:widget": "select"
                },
                'SampleJet Rack Position': {
                    "ui:placeholder": "e.g., A3, G11"
                },
                'SampleJet Rack ID': {
                    "ui:placeholder": "e.g., Rack-001"
                }
            },
            'Laboratory Reference': {
                'Labbook Entry': {
                    "ui:placeholder": "e.g., LB2025-08-001"
                },
                'Experiment ID': {
                    "ui:placeholder": "e.g., EXP-001"
                }
            },
            Notes: {
                "ui:widget": "textarea",
                "ui:placeholder": "Additional notes and observations"
            },
            Metadata: {
                "ui:widget": "hidden"
            }
        };
    }

    /**
     * Process form data before saving
     */
    processFormData(formData) {
        // Clean up empty arrays and objects
        const cleaned = JSON.parse(JSON.stringify(formData));
        
        // Remove empty components arrays
        if (cleaned.Sample && cleaned.Sample.Components && cleaned.Sample.Components.length === 0) {
            delete cleaned.Sample.Components;
        }
        
        if (cleaned.Buffer && cleaned.Buffer.Components && cleaned.Buffer.Components.length === 0) {
            delete cleaned.Buffer.Components;
        }

        // Remove empty Users array
        if (cleaned.Users && cleaned.Users.length === 0) {
            delete cleaned.Users;
        }

        return cleaned;
    }

    /**
     * Get form validation messages
     */
    getValidationMessages() {
        return {
            required: "This field is required",
            pattern: "Please enter a valid format",
            minimum: "Value must be greater than or equal to minimum",
            maximum: "Value must be less than or equal to maximum"
        };
    }
}
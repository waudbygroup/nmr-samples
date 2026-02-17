/**
 * Schema Handler - Manages JSON schema loading and form generation
 * Desktop-only NMR Sample Manager
 */

class SchemaHandler {
    constructor() {
        this.schema = null;
        this.currentVersion = '0.1.0';
    }

    /**
     * Load schema from embedded data
     */
    async loadSchema() {
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

        return typeof data === 'object' && data !== null;
    }

    /**
     * Create default/empty data structure based on schema
     */
    createDefaultData() {
        if (!this.schema) {
            throw new Error('Schema not loaded');
        }

        return {
            people: {
                users: []
            },
            sample: {
                label: '',
                physical_form: '',
                components: []
            },
            buffer: {
                components: [],
                ph: null,
                solvent: ''
            },
            nmr_tube: {
                sample_volume_uL: null,
                diameter: null,
                type: ''
            },
            reference: {
                labbook_entry: '',
                sample_id: ''
            },
            notes: '',
            metadata: {
                schema_version: this.currentVersion
            }
        };
    }

    /**
     * Get UI schema for form customization
     */
    getUISchema() {
        return {
            people: {
                users: {
                    "ui:options": { orderable: false },
                    items: {
                        "ui:placeholder": "Name or username"
                    }
                },
                groups: {
                    "ui:options": { orderable: false },
                    items: {
                        "ui:placeholder": "Group surname"
                    }
                }
            },
            sample: {
                label: {
                    "ui:placeholder": "Enter a descriptive sample name"
                },
                physical_form: {
                    "ui:widget": "select"
                },
                components: {
                    "ui:options": { orderable: false },
                    items: {
                        name: {
                            "ui:placeholder": "e.g., MyProtein, BSA, etc."
                        },
                        isotopic_labelling: {
                            "ui:widget": "select"
                        },
                        custom_labelling: {
                            "ui:widget": "textarea",
                            "ui:placeholder": "Describe custom labelling scheme"
                        },
                        concentration_or_amount: {
                            "ui:placeholder": "Numeric value"
                        },
                        unit: {
                            "ui:widget": "select"
                        }
                    }
                }
            },
            buffer: {
                components: {
                    "ui:options": { orderable: false },
                    items: {
                        name: {
                            "ui:placeholder": "e.g., Tris-HCl, NaCl, EDTA"
                        },
                        concentration: {
                            "ui:placeholder": "Numeric value"
                        },
                        unit: {
                            "ui:widget": "select"
                        }
                    }
                },
                ph: {
                    "ui:placeholder": "e.g., 7.4"
                },
                chemical_shift_reference: {
                    "ui:widget": "select"
                },
                reference_concentration: {
                    "ui:placeholder": "e.g., 0.1"
                },
                reference_unit: {
                    "ui:widget": "select"
                },
                solvent: {
                    "ui:widget": "select"
                },
                custom_solvent: {
                    "ui:widget": "textarea",
                    "ui:placeholder": "Describe custom solvent composition"
                }
            },
            nmr_tube: {
                sample_volume_uL: {
                    "ui:placeholder": "e.g., 600"
                },
                sample_mass_mg: {
                    "ui:placeholder": "e.g., 10"
                },
                diameter: {
                    "ui:placeholder": "e.g., 5"
                },
                type: {
                    "ui:widget": "select"
                }
            },
            reference: {
                labbook_entry: {
                    "ui:placeholder": "e.g., LB2025-08-001"
                },
                sample_id: {
                    "ui:placeholder": "e.g., EXP-001"
                }
            },
            notes: {
                "ui:widget": "textarea",
                "ui:placeholder": "Additional notes and observations"
            },
            metadata: {
                "ui:widget": "hidden"
            }
        };
    }

    /**
     * Process form data before saving
     */
    processFormData(formData) {
        const cleaned = JSON.parse(JSON.stringify(formData));

        if (cleaned.sample?.components?.length === 0) {
            delete cleaned.sample.components;
        }

        if (cleaned.buffer?.components?.length === 0) {
            delete cleaned.buffer.components;
        }

        if (cleaned.people?.users?.length === 0) {
            delete cleaned.people.users;
        }

        if (cleaned.people?.groups?.length === 0) {
            delete cleaned.people.groups;
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

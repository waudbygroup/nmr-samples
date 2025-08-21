# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# NMR Sample Manager

## Project Overview

A standalone web application for managing NMR sample metadata in TopSpin environments. The tool provides an intuitive interface for recording, editing, and managing sample information while integrating seamlessly with TopSpin workflows.

## Architecture

### Core Design Principles

- **Standalone web application**: No servers or complex installation required
- **TopSpin integration**: Simple Python scripts for workflow integration
- **Schema-driven**: JSON Schema defines data structure and validation
- **Human-readable storage**: JSON files for metadata persistence
- **Version control friendly**: Text-based storage with clear schema versioning

### System Components

```
┌─ NMR Sample Manager ──────────────────────────┐
│                                               │
│  Web Interface (HTML/JavaScript)             │
│  ├─ Folder selection                         │
│  ├─ Sample list/browser                      │
│  ├─ Form interface (React JSON Schema Form)  │
│  └─ File operations                          │
│                                               │
├─ Data Layer ─────────────────────────────────┤
│  ├─ JSON Schema (validation/structure)       │
│  ├─ JSON files (sample metadata)             │
│  └─ Favourites/templates                     │
│                                               │
├─ TopSpin Integration ───────────────────────┤
│  ├─ aij/aej commands (Python scripts)        │
│  ├─ Directory navigation                     │
│  └─ Sample logging                           │
│                                               │
└───────────────────────────────────────────────┘
```

## File Structure

```
nmr-sample-manager/
├── CLAUDE.md                    # This architecture document
├── README.md                    # User documentation
├── src/
│   ├── index.html              # Main web application
│   ├── js/
│   │   ├── app.js              # Main application logic
│   │   ├── schema-handler.js   # Schema loading and validation
│   │   └── file-manager.js     # File operations
│   └── css/
│       └── styles.css          # Application styling
├── schemas/
│   ├── v0.0.1.json            # Current schema version (exists)
│   ├── v1.0.0.json            # Future schema versions
│   └── current -> v0.0.1.json # Symlink to current version (to be created)
├── topspin-integration/
│   ├── aij.py                  # Annotated inject command
│   ├── aej.py                  # Annotated eject command
│   ├── sample_launcher.py      # Main launcher script
│   └── install_commands.sh     # TopSpin command installation
├── favourites/
│   ├── common_buffers.json     # Template buffer compositions
│   └── labelling_schemes.json  # Common isotopic labelling setups
└── docs/
    ├── installation.md         # Installation instructions
    ├── usage.md               # User guide
    └── topspin-integration.md  # TopSpin setup guide
```

## Data Model

### JSON Schema Approach

- **Schema versioning**: Stored in `schemas/` with semantic versioning
- **Current schema**: Symlink `schemas/current` points to active version
- **Validation**: Client-side validation using JSON Schema
- **Evolution**: Schema migrations for backwards compatibility

### Sample Metadata Structure

```json
{
  "Metadata": {
    "created_timestamp": "2025-08-21T14:30:22Z",
    "modified_timestamp": "2025-08-21T15:45:30Z",
    "schema_version": "0.0.1"
  },
  "Users": ["researcher1", "researcher2"],
  "Sample": {
    "Label": "MyProtein_pH7",
    "Components": [{
      "Name": "MyProtein",
      "Isotopic labelling": "15N",
      "Concentration": {
        "value": 500,
        "unit": "uM"
      }
    }]
  },
  "Buffer": {
    "Components": [{
      "name": "Tris-HCl",
      "concentration": {
        "value": 50,
        "unit": "mM"
      }
    }],
    "pH": 7.4,
    "Solvent": "10% D2O"
  },
  "NMR Tube": {
    "Diameter": "5mm",
    "Type": "shigemi"
  },
  "Sample Position": {
    "Rack Position": "A3",
    "Rack ID": "Rack-001"
  },
  "Laboratory Reference": {
    "Labbook Entry": "LB2025-08-001",
    "Experiment ID": "EXP-001"
  },
  "Notes": "Sample prepared for HSQC experiments"
}
```

### File Naming Convention

```
{timestamp}_{sample_name}.json
2025-08-21_143022_MyProtein.json
```

## User Interface

### Web Application Features

- **Folder browser**: Select TopSpin dataset directories
- **Sample list**: Browse existing samples with timestamps
- **Form interface**: Auto-generated from JSON Schema
- **Search/filter**: Find samples by name, date, user
- **Duplicate/modify**: Copy samples for titration series
- **Favourites**: Save common buffers and configurations
- **Export**: Generate reports or data summaries

### Form Generation

- **React JSON Schema Form**: Automatic form generation
- **Validation**: Real-time client-side validation
- **Custom widgets**: Dropdowns for controlled vocabularies
- **Conditional fields**: Show/hide based on selections
- **Array handling**: Dynamic addition of sample components

## TopSpin Integration

We will develop this later once the core system is working.

### Command Implementation

#### `aij` (Annotated Inject)
```python
# Execute standard inject command
os.system("ij")
# Launch sample manager with current directory
launch_sample_manager(get_current_dataset_path())
```

#### `aej` (Annotated Eject)
```python
# Log ejection with timestamp
log_sample_ejection(get_current_dataset_path())
# Execute standard eject command
os.system("ej")
```

### Integration Points

- **Directory detection**: Automatic navigation to current TopSpin dataset
- **Sample logging**: Timestamped injection/ejection events
- **Workflow integration**: Seamless integration with existing TopSpin commands
- **No TopSpin modification**: Pure additive functionality

## Technical Implementation

### Browser Requirements

- **Primary**: Chrome/Edge (full File System Access API support)
- **Secondary**: Firefox (manual file selection)
- **Minimum**: Modern ES6+ support required

### Dependencies

- **React JSON Schema Form**: Form generation and validation
- **Native JSON**: Built-in JavaScript JSON parsing
- **File System Access API**: Direct file operations
- **No build process**: Direct HTML/JavaScript deployment

### File Operations

- **Read**: Load existing JSON files from selected directory
- **Write**: Save new/modified samples as JSON
- **Validation**: Schema validation before save
- **Error handling**: Graceful handling of file permissions/errors

## Development Commands

Since this is a browser-based application with no build process, there are no traditional build/lint/test commands. Development is done by:

1. **Testing**: Manual testing in browsers (Chrome/Edge preferred for File System Access API)
2. **Deployment**: Direct file copying - no build step required

### Schema Evolution

1. Create new schema version in `schemas/vX.Y.Z.json`
2. Update symlink: `ln -sf vX.Y.Z.json current` (when current symlink system is implemented)
3. Implement migration logic if needed
4. Update form interface for new fields
5. Test backwards compatibility

## Current Project State

**Note**: This project is in early development. Currently only contains:
- `schemas/v0.0.1.json` - JSON schema defining the data structure
- Architecture documentation (this file)

### Existing Schema Structure (`schemas/v0.0.1.json`)

The current schema defines these main sections (all optional):
- **Users**: Array of people involved in the experiment
- **Sample**: Label and components with isotopic labelling, concentrations
- **Buffer**: pH, components, and solvent information
- **NMR Tube**: Diameter (3mm/5mm/1.7mm) and type (regular/shigemi/shaped/coaxial)
- **Sample Position**: Rack position (A3, G11 format) and rack ID
- **Laboratory Reference**: Lab book entries and experiment IDs
- **Notes**: Free text observations
- **Metadata**: Timestamps and schema version tracking

### Implementation Priorities

When implementing the web interface:
1. Create `src/` directory for web application files
2. Use direct HTML/JavaScript (no build process)
3. Implement browser-based file operations using File System Access API
4. Generate forms dynamically from the JSON schema
5. Focus on Chrome/Edge browsers first (File System Access API support)

## Future Enhancements

### Phase 1 (Core Functionality)
- [ ] Basic form interface
- [ ] File operations
- [ ] Schema validation

### Phase 2 (Topspin Integration)
- [ ] TopSpin integration
- [ ] Favourites/templates system

### Phase 3 (Enhanced Features)
- [ ] Search and filtering
- [ ] Sample relationship tracking
- [ ] Export capabilities

### Phase 4 (Advanced Integration)
- [ ] BMRB dictionary mapping
- [ ] Advanced reporting

### Phase 5 (Laboratory Integration)
- [ ] Multi-spectrometer support
- [ ] User authentication
- [ ] Audit logging
- [ ] Data backup strategies

## Success Criteria

1. **Zero installation**: Works immediately on any laboratory computer
2. **TopSpin integration**: Seamless workflow enhancement
3. **Data quality**: Structured, validated metadata collection
4. **User adoption**: Scientists actively use the tool
5. **Future ready**: Foundation for BMRB deposition automation

## Notes

- All fields optional to encourage adoption
- Human-readable JSON for transparency
- Schema-driven development for maintainability
- Browser-based for maximum compatibility
- Git-friendly for version control and collaboration
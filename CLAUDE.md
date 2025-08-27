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
nmr-samples/
├── CLAUDE.md                    # This architecture document
├── src/
│   ├── index.html              # Main web application (template with {{SCHEMA}})
│   ├── installation.html       # Installation documentation
│   ├── usage.html              # Usage documentation
│   ├── js/
│   │   ├── app.js              # Main application logic
│   │   ├── schema-handler.js   # Schema loading and validation
│   │   └── file-manager.js     # File operations
│   ├── css/
│   │   └── styles.css          # Application styling
│   └── schemas/
│       └── current.json        # Single source of truth for schema
├── .github/workflows/
│   └── build.yml               # GitHub Actions build automation
├── docs/ (auto-generated)
│   ├── index.html              # Online version (external schema)
│   ├── installation.html       # Documentation pages
│   ├── usage.html              # Documentation pages
│   ├── css/ & js/              # Application assets
│   ├── schemas/current.json    # Schema for online loading
│   └── download/
│       ├── index.html          # Offline version (embedded schema)
│       ├── css/ & js/          # All assets
│       └── nmr-samples.zip # Complete offline package
├── topspin-integration/
│   ├── aij.py                  # Annotated inject command
│   ├── aej.py                  # Annotated eject command
│   ├── sample_launcher.py      # Main launcher script
│   └── install_commands.sh     # TopSpin command installation

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
- **GitHub Actions**: Automated build and deployment system

### File Operations

- **Read**: Load existing JSON files from selected directory
- **Write**: Save new/modified samples as JSON
- **Validation**: Schema validation before save
- **Error handling**: Graceful handling of file permissions/errors

## Development & Deployment

### Build System Architecture
**GitHub Actions Automated Build System**

The project uses a GitHub Actions build system that:
1. **Single Source of Truth**: Schema exists only in `src/schemas/current.json`
2. **Dual Deployment**: Creates both online and offline versions automatically
3. **Template Processing**: Replaces `{{SCHEMA}}` placeholder in source files
4. **Zero Local Setup**: No build tools required for development

### Development Workflow
1. **Edit source files** in `src/` directory
2. **Edit schema** in `src/schemas/current.json` 
3. **Push to GitHub** - automatic build and deployment
4. **Test locally** by opening `src/index.html` (uses external schema loading)

### Build Targets
- **Online Version** (`docs/index.html`): External schema loading for GitHub Pages
- **Offline Version** (`docs/download/index.html`): Embedded schema for offline use
- **Offline Package** (`docs/download/nmr-samples.zip`): Complete downloadable package

### Browser Support
- **Primary (Full Features)**: Chrome 86+, Edge 86+ (File System Access API)
- **Limited Support**: Firefox (manual file selection only)
- **Minimum**: Modern ES6+ support required

### Installation for Laboratory Use
1. Clone or download the repository
2. Open `src/index.html` in Chrome or Edge
3. Grant file system permissions when prompted
4. Set root directory to your NMR data folder
5. Start managing samples immediately

### Integration with TopSpin (Ready for Implementation)
The application is fully prepared for TopSpin integration:
- URL parameters supported: `?folder=path&action=inject|eject`
- Permission handling implemented
- Automatic sample management ready
- **Next step**: Implement Python scripts (`aij.py`, `aej.py`)

### Schema Evolution

1. Create new schema version in `schemas/vX.Y.Z.json`
2. Update symlink: `ln -sf vX.Y.Z.json current` (when current symlink system is implemented)
3. Implement migration logic if needed
4. Update form interface for new fields
5. Test backwards compatibility

## Current Project State

**✅ PRODUCTION READY**: The NMR Sample Manager is fully functional and ready for laboratory use.

### Implemented Features

#### ✅ **Core Web Application (Phase 1 - COMPLETE)**
- **Full HTML/JavaScript application** - No build process required
- **File System Access API integration** - Chrome/Edge desktop support
- **JSON Schema validation** - Real-time form validation
- **React JSON Schema Form** - Dynamic form generation from schema
- **Sample CRUD operations** - Create, read, update, delete samples
- **Bootstrap UI** - Professional responsive interface

#### ✅ **Advanced Sample Management (Phase 2/3 - COMPLETE)**
- **Timeline visualization** - Complete experiment history with color-coded sample sessions
- **Sample status tracking** - Active/ejected status with timestamps
- **Auto-ejection workflow** - Previous samples ejected before new injection
- **Sample duplication** - Copy existing samples for titration series
- **URL parameter handling** - Direct navigation from TopSpin integration
- **Persistent storage** - Root directory and settings maintained across sessions

#### ✅ **TopSpin Integration Ready (Phase 2 - READY)**
- **URL-based navigation** - `?folder=path&action=inject|eject` support
- **Automatic ejection handling** - Most recent sample ejection via URL
- **Permission management** - Graceful handling of file system permissions
- **Error handling** - Comprehensive user feedback and recovery

### Current File Structure (IMPLEMENTED)

```
nmr-samples/
├── CLAUDE.md                    # This architecture document
├── schemas/
│   ├── v0.0.1.json             # JSON schema (active version)
│   └── current.json            # Current schema symlink equivalent
└── src/                        # ✅ COMPLETE WEB APPLICATION
    ├── index.html              # Main app with embedded schema
    ├── css/
    │   └── styles.css          # Professional Bootstrap-based styling
    └── js/
        ├── app.js              # Main application logic (1,124 lines)
        ├── file-manager.js     # File System Access API handler
        ├── schema-handler.js   # Schema management and validation
        └── storage.js          # Persistence and storage handler
```

### Schema Structure (v0.0.1 - ACTIVE)

The current schema defines these sections (all optional for ease of adoption):
- **Users**: Array of people involved in the experiment
- **Sample**: Label and components with isotopic labelling, concentrations
- **Buffer**: pH, components, solvent information, chemical shift references
- **NMR Tube**: Sample volume, diameter (1.7/3/5mm), type (regular/shigemi/shaped/coaxial)
- **Sample Position**: SampleJet rack position (A3, G11 format) and rack ID
- **Laboratory Reference**: Lab book entries and experiment IDs
- **Notes**: Free text observations
- **Metadata**: Created/modified/ejected timestamps and schema version tracking

## Implementation Status

### ✅ **Phase 1 (Core Functionality) - COMPLETE**
- [x] Basic form interface - **React JSON Schema Form implemented**
- [x] File operations - **File System Access API integrated**
- [x] Schema validation - **Real-time validation active**

### ✅ **Phase 2 (TopSpin Integration) - MOSTLY COMPLETE**
- [x] URL-based navigation - **Direct folder access implemented**
- [x] Sample ejection tracking - **Automatic timestamping active**
- [x] Permission handling - **Graceful degradation implemented**
- [ ] Python integration scripts - **Next priority (aij.py, aej.py)**
- [ ] Favourites/templates system - **Planned for next iteration**

### ✅ **Phase 3 (Enhanced Features) - PARTIALLY COMPLETE**
- [x] Timeline visualization - **Complete experiment history implemented**
- [x] Sample relationship tracking - **Session-based grouping active**
- [x] Advanced UI features - **Professional interface complete**
- [ ] Search and filtering - **Basic sorting implemented, advanced search planned**
- [ ] Export capabilities - **Planned for future iteration**

### 🎯 **Next Priorities (Phase 2 Completion)**
- [ ] Create Python TopSpin integration scripts (`aij.py`, `aej.py`)
- [ ] Implement favourites/templates system
- [ ] Add installation script for TopSpin commands

### 📋 **Future Enhancements (Phases 4-5)**

#### Phase 4 (Advanced Integration)
- [ ] BMRB dictionary mapping
- [ ] Advanced reporting and export
- [ ] Enhanced search and filtering
- [ ] Sample comparison tools

#### Phase 5 (Laboratory Integration)
- [ ] Multi-spectrometer support
- [ ] User authentication system
- [ ] Comprehensive audit logging
- [ ] Automated data backup strategies

## Success Criteria & Status

### ✅ **ACHIEVED**
1. **Zero installation**: ✅ Works immediately on any Chrome/Edge laboratory computer
2. **Data quality**: ✅ Structured, validated metadata collection with JSON Schema
3. **User adoption ready**: ✅ Intuitive interface with professional UI/UX
4. **Future ready**: ✅ Foundation established for BMRB deposition automation

### 🎯 **IN PROGRESS** 
2. **TopSpin integration**: 🔄 URL-based navigation ready, Python scripts needed

### 📋 **Current Achievements**
- **Professional UI**: Bootstrap-based responsive interface
- **Robust file handling**: File System Access API with permission management
- **Timeline visualization**: Complete experiment history tracking
- **Sample lifecycle management**: Creation → Injection → Ejection workflow
- **Data integrity**: JSON Schema validation with embedded schema
- **Zero-dependency deployment**: All dependencies via CDN, no build process

### 🔬 **Laboratory Ready Features**
- All fields optional to encourage adoption
- Human-readable JSON for transparency and troubleshooting
- Schema-driven development for maintainability
- Browser-based for maximum compatibility
- Git-friendly storage for version control and collaboration
- Automatic backup through version control integration
- Professional error handling and user feedback

### 📊 **Usage Metrics Ready**
- Timeline data for experiment tracking
- Sample status monitoring
- Metadata completeness tracking
- User activity logging (timestamps)

The NMR Sample Manager has exceeded initial success criteria and is **production-ready for immediate laboratory deployment**.

## Quick Start Guide

### For Laboratory Users
1. **Open Application**: Navigate to `src/index.html` in Chrome or Edge
2. **Set Root Directory**: Click "Set" next to "Root:" and select your NMR data folder  
3. **Browse Experiments**: Click "Browse" to navigate to specific experiment folders
4. **Manage Samples**: Use "New Sample", "Duplicate", "Edit", or "Eject" buttons
5. **View Timeline**: Click "Show timeline" to see complete experiment history

### For TopSpin Integration (Ready)
- Application supports URL parameters: `file:///path/to/src/index.html?folder=/path/to/experiment&action=inject`
- Next step: Implement Python scripts that launch the application with appropriate parameters
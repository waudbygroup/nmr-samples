# Schema Migration Guide

## Overview

This document describes the breaking changes between schema versions and the migration strategy for upgrading sample metadata files.

## Schema Version History

### v0.0.1 (Internal Development)
- Initial schema design
- Not deployed to users
- PascalCase/Title Case property names

### v0.0.2 (First Deployed Version)
- First production schema
- PascalCase/Title Case property names
- Basic NMR sample metadata structure
- Users as top-level array

### v0.0.3 (Intermediate Migration Step)
- All property names converted to snake_case
- Structural reorganization (Users → people.users)
- `schema_version` updated to "0.0.3"
- **Note**: This is an intermediate version for migration path only

### v0.1.0 (Current Version)
- Added `title` properties for display labels
- Added new fields:
  - `people.groups` - Research group affiliations
  - `sample.physical_form` - Solution/aligned/solid
  - `sample.components[].concentration_or_amount` - Support for solid samples
  - `nmr_tube.sample_mass_mg` - Mass for solid samples
  - `nmr_tube.rotor_serial` - Solid-state NMR rotor tracking
  - `reference.sample_id` - Renamed from Experiment ID
- Changed `nmr_tube.diameter` from enum strings to numeric values
- Removed `nmr_tube.samplejet_rack_position` (replaced by external tracking)
- Expanded isotopic labelling options (deuteration patterns)
- Added solid-state NMR tube types (J Young, rotors)

## Breaking Changes: v0.0.2 → v0.1.0

### 1. Property Name Convention

**All property names changed from PascalCase/Title Case to snake_case:**

| Old (v0.0.2) | New (v0.1.0) | Notes |
|--------------|--------------|-------|
| `Users` | `people.users` | Also moved to nested structure |
| `Sample` | `sample` | |
| `Sample.Label` | `sample.label` | |
| `Sample.Components` | `sample.components` | |
| `Components[].Name` | `components[].name` | |
| `Components[].Concentration` | `components[].concentration_or_amount` | Semantic change |
| `Components[].Unit` | `components[].unit` | |
| `Components[].Isotopic labelling` | `components[].isotopic_labelling` | |
| `Components[].Custom labelling` | `components[].custom_labelling` | |
| `Buffer` | `buffer` | |
| `Buffer.pH` | `buffer.ph` | |
| `Buffer.Components` | `buffer.components` | |
| `Buffer.Components[].name` | `buffer.components[].name` | Already lowercase |
| `Buffer.Components[].Concentration` | `buffer.components[].concentration` | |
| `Buffer.Components[].Unit` | `buffer.components[].unit` | |
| `Buffer.Chemical shift reference` | `buffer.chemical_shift_reference` | |
| `Buffer.Reference concentration` | `buffer.reference_concentration` | |
| `Buffer.Reference unit` | `buffer.reference_unit` | |
| `Buffer.Solvent` | `buffer.solvent` | |
| `Buffer.Custom solvent` | `buffer.custom_solvent` | |
| `NMR Tube` | `nmr_tube` | |
| `NMR Tube.Diameter` | `nmr_tube.diameter` | Also type change |
| `NMR Tube.Type` | `nmr_tube.type` | |
| `NMR Tube.Sample Volume (μL)` | `nmr_tube.sample_volume_uL` | |
| `NMR Tube.SampleJet Rack Position` | **REMOVED** | |
| `NMR Tube.SampleJet Rack ID` | `nmr_tube.rack_id` | |
| `Laboratory Reference` | `reference` | |
| `Laboratory Reference.Labbook Entry` | `reference.labbook_entry` | |
| `Laboratory Reference.Experiment ID` | `reference.sample_id` | Semantic change |
| `Notes` | `notes` | |
| `Metadata` | `metadata` | |

### 2. Display Labels via `title` Property

In v0.1.0, human-readable labels are specified using JSON Schema `title` properties instead of property names:

```json
{
  "sample": {
    "title": "Sample",
    "type": "object",
    "properties": {
      "label": {
        "title": "Label",
        "type": "string"
      }
    }
  }
}
```

**Impact**: Form generation libraries (React JSON Schema Form) will now use `title` for field labels, allowing cleaner property names in data files.

### 3. Type Changes

#### Tube Diameter
- **Old**: Enum strings `"1.7 mm"`, `"3 mm"`, `"5 mm"`
- **New**: Numeric values `1.7`, `3.0`, `5.0`
- **Rationale**: Support arbitrary diameters for solid-state NMR rotors

#### Concentration vs. Amount
- **Old**: `Concentration` (number)
- **New**: `concentration_or_amount` (number | null)
- **Rationale**: Support both concentrations (solution) and amounts (solid samples)

### 4. Removed Fields

- `nmr_tube.samplejet_rack_position` - Position tracking moved to external sample tracking system
  - **Migration**: Field is deleted, no data preservation

### 5. New Fields

All new fields are optional and initialized with empty/default values:

- `people.groups` (array) - Research group affiliations
- `sample.physical_form` (enum: "", "solution", "aligned", "solid") - Defaults to ""
- `nmr_tube.sample_mass_mg` (number | null) - For solid samples
- `nmr_tube.rotor_serial` (string) - Rotor tracking
- `reference.sample_id` (string) - Renamed from Experiment ID

## Migration Strategy

### Automatic Migration

The migration system uses a declarative patch file ([src/schemas/current/patch.json](src/schemas/current/patch.json)) that defines transformation operations.

**Migration Path**: v0.0.2 → v0.0.3 → v0.1.0

#### Operation Types

1. **`rename_key`**: Rename a property
   ```json
   {"op": "rename_key", "path": "/Sample", "to": "sample"}
   ```

2. **`move`**: Move a property to a new location
   ```json
   {"op": "move", "path": "/Users", "to": "/people/users"}
   ```

3. **`map`**: Transform values
   ```json
   {"op": "map", "path": "/nmr_tube/diameter", "from": "5 mm", "to": 5.0}
   ```

4. **`remove`**: Delete a field
   ```json
   {"op": "remove", "path": "/nmr_tube/samplejet_rack_position"}
   ```

5. **`set`**: Add or set a field value
   ```json
   {"op": "set", "path": "/sample/physical_form", "value": ""}
   ```

### Migration Tool Usage

The migration tool is located at [src/schemas/migration/schema_migrate.js](src/schemas/migration/schema_migrate.js).

#### Loading Modes

**Online Mode** (GitHub Pages):
- Schema loaded from external URL
- Migrations loaded from `https://raw.githubusercontent.com/waudbygroup/nmr-sample-schema/main/current/patch.json`

**Offline Mode** (Downloaded ZIP):
- Schema embedded in HTML
- Migrations embedded in HTML via `window.EMBEDDED_MIGRATIONS`

#### Programmatic Usage

```javascript
// Load migrations (checks for embedded first, then fetches)
const migrations = await loadMigrations();

// Load and migrate a sample file
const data = JSON.parse(fileContent);
const migratedData = updateToLatestSchema(data, migrations);

// Or use the convenience function with File System Access API
const migratedData = await loadSample(migrations);
```

### File System Access Permissions

The migration tool integrates with the File System Access API workflow:

1. **Read Permission**: Granted when user selects a folder
2. **Write Permission**: Requested when saving migrated files
3. **Graceful Degradation**: Falls back to manual file selection in browsers without full API support

**User Workflow**:
1. User opens a folder containing old schema files
2. App detects old schema version (from `metadata.schema_version`)
3. User prompted: "Migrate old samples to new schema?"
4. Migrations applied in-memory
5. User prompted for write permission to save updated files
6. Files saved with updated `metadata.schema_version = "0.1.0"`

### Build System Integration

The GitHub Actions workflow ([.github/workflows/build.yml](.github/workflows/build.yml)) handles schema and migration embedding:

**Online Version** (`docs/index.html`):
- `{{SCHEMA}}` → External fetch from `schemas/current/schema.json`
- `{{MIGRATIONS}}` → Comment (loaded via `loadMigrations()`)

**Offline Version** (`docs/download/index.html`):
- `{{SCHEMA}}` → Embedded `window.EMBEDDED_SCHEMA`
- `{{MIGRATIONS}}` → Embedded `window.EMBEDDED_MIGRATIONS`

## Form Rendering Changes

With the new schema convention, form generation libraries should use the `title` property for labels:

**React JSON Schema Form configuration**:
```javascript
// The library automatically uses 'title' for labels
// No special configuration needed
const form = <Form schema={schema} formData={formData} />;
```

**Display mapping**:
- `sample.label` → Displayed as "Label" (from `title: "Label"`)
- `buffer.ph` → Displayed as "pH" (from `title: "pH"`)
- `nmr_tube.sample_volume_uL` → Displayed as "Sample volume (μL)" (from `title`)

## Validation

All migrated data is validated against the v0.1.0 schema before saving. The migration tool ensures:

1. All required transformations are applied
2. Data types are correctly converted
3. New optional fields are initialized
4. `metadata.schema_version` is updated

## Rollback Strategy

**Not supported**: Migration is one-way only (v0.0.2 → v0.1.0).

If rollback is needed:
1. Restore from backup (git history for version-controlled data)
2. Manual conversion (not recommended for large datasets)

## Testing Migration

To test the migration system:

1. **Create test files** in v0.0.2 format
2. **Load in development app**:
   ```bash
   open src/index.html  # Chrome/Edge only
   ```
3. **Select folder** with test files
4. **Verify migration prompt** appears
5. **Check migrated data** for correctness
6. **Validate against schema** using browser dev tools:
   ```javascript
   // In browser console
   const migrations = await loadMigrations();
   const testData = { /* v0.0.2 data */ };
   const migrated = updateToLatestSchema(testData, migrations);
   console.log(migrated);
   ```

## Future Schema Evolution

When creating future schema versions:

1. **Add to `src/schemas/versions/vX.Y.Z/schema.json`**
2. **Update `src/schemas/current/schema.json`** to point to new version
3. **Extend `src/schemas/current/patch.json`** with new migration operations
4. **Test migration path** from all previous versions
5. **Document changes** in this file
6. **Update `version` in schema** and default `schema_version` in metadata

### Semantic Versioning for Schemas

- **Major (1.0.0)**: Breaking changes requiring migration
- **Minor (0.1.0)**: New optional fields, backwards compatible
- **Patch (0.0.1)**: Documentation, validation changes only

Current version **0.1.0** indicates:
- Pre-1.0 development phase
- Minor version bump for new optional fields
- Breaking changes in property names (justified during pre-1.0)

## References

- [JSON Schema Specification](https://json-schema.org/)
- [JSON Patch (RFC 6902)](https://tools.ietf.org/html/rfc6902) - Inspiration for operation types
- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
- [React JSON Schema Form](https://rjsf-team.github.io/react-jsonschema-form/)

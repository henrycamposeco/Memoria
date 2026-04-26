# Changelog

All notable technical changes derived from Memoria persistent storage.

## [2026-04-26] - Developer Update
### Added
- **Final Documentation and Environment Verification** (ID: 22)
  - *Technical Detail*: Verified the final documentation and architecture diagrams. The project now has a clear roadmap for developers to replicate the POC into official projects, supported by an automated, intelligent changelog system. Environment is stable and optimized.
  - *Type*: learned

- **Intelligent Changelog Grouping Implemented** (ID: 21)
  - *Technical Detail*: Upgraded the 'changelog' command to support intelligent grouping. New entries are now merged into existing date and semantic tag sections, preventing redundant headers and improving document structure. Added newline normalization for cleaner output.
  - *Type*: learned

- **CLI and Documentation Enhancements** (ID: 18)
  - *Technical Detail*: Implemented the 'changelog' CLI command to automate Semantic Developer Changelog generation. Updated README with a Mermaid architecture diagram, clear setup steps, and a full command reference. Verified duplicate prevention and semantic tagging (Added, Changed, Fixed).
  - *Type*: learned

- **Dashboard UI Readability Refinement** (ID: 16)
  - *Technical Detail*: Refined the dashboard UI to improve readability on dark backgrounds. Restored high-contrast colors (background #050505, text #f3f4f6) and increased opacity for dimmed elements from 20-30% to 50-60%. Replaced hardcoded green colors with dynamic persona-based colors in the edit modal and header. Verified changes with a full project build.
  - *Type*: learned

- **Changelog Safety Guard Implemented** (ID: 23)
  - *Technical Detail*: Implemented a 'Safety Guard' in the 'changelog' command. It now scans for local file changes modified after the latest saved memory. If discrepancies are found, it warns the user and aborts the sync, preventing incomplete changelogs. Added a --force flag for manual overrides. This ensures developers maintain discipline in documenting their work.
  - *Type*: learned

### Changed
- **Sync grouping logic updated** (ID: 20)
  - *Technical Detail*: Improved the changelog sync to group by date and semantic tag instead of creating new headers for every run.
  - *Type*: decision

- **Persona Shift: Grumpy Tech Lead Activated** (ID: 19)
  - *Technical Detail*: Switched the project persona to 'grumpy'. Responses will now be brutally honest and direct, focusing on high standards and no tolerance for technical debt. buckle up.
  - *Type*: decision

- **Local Repository Initialized** (ID: 24)
  - *Technical Detail*: Initialized local Git repository for the 'Memoria' project. Created a .gitignore to exclude build artifacts and sensitive data. Committed all source files with an initial message. Ready to push to a remote repository once a URL is provided.
  - *Type*: decision

- **Project-Local Storage Encapsulation Implemented** (ID: 25)
  - *Technical Detail*: Refactored storage logic to use project-local encapsulation. The SQLite database and vector index are now stored in a '.memoria' directory within the project root instead of the global home directory. Migrated all existing memories and vectors to the local directory to ensure continuity.
  - *Type*: decision

- **Project Pushed to GitHub & UI Simplified** (ID: 26)
  - *Technical Detail*: Configured remote repository 'origin' and pushed the complete project to GitHub. Also documented manual UI refinements to the dashboard: switched to a high-contrast light theme (#dddddd) and simplified the header by removing background gradients and logo filters for a cleaner look. Environment is now fully backed up and ready for collaboration.
  - *Type*: decision

- **License Updated to Apache 2.0** (ID: 28)
  - *Technical Detail*: Updated the project license from ISC to Apache-2.0 in both README.md and package.json to reflect the official release standards.
  - *Type*: decision

### Fixed
- **Fix dashboard port collision** (ID: 17)
  - *Technical Detail*: Moved dashboard default port from 3000 to 3001 to avoid collisions with other local services.
  - *Type*: bug

- **Documentation Inconsistencies Corrected** (ID: 27)
  - *Technical Detail*: Fixed inconsistencies in README.md. Updated the storage path description from global (~/.memoria) to project-local (./.memoria) and corrected the dashboard URL to point to port 3001. Documentation now matches the actual system state.
  - *Type*: bug


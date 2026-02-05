# Release Workflow

This project requires a GitHub release for every update to serve as a backup.

## Steps for every update:

1.  **Bump Version:** Update the version in `package.json`.
2.  **Build Artifacts:** Run `npm run build` (or `npx electron-builder --win --linux`).
    *   Ensure both `.AppImage` (Linux) and `.exe` (Windows) are generated in the `release/` folder.
3.  **Git Tag:** Commit changes and tag the commit (e.g., `v1.0.0-beta.X`).
4.  **Push:** Push commits and tags to GitHub.
5.  **GitHub Release:** Create a new release on GitHub for the tag.
6.  **Upload Assets:** Upload the generated `.AppImage` and `.exe` files to the release.

**Note:** Always ensure both binary formats are uploaded.

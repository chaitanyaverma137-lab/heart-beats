# Heart Beats v1.0.4

A personal Windows desktop music player built with Electron, React, Vite and TypeScript.

## v1.0.4 changes
- Restored a dedicated **About Heart Beats** panel in Settings.
- Displays the installed application version dynamically from Electron (`app.getVersion()`), rather than a hard-coded label.
- Restored a clear **Check for updates** action, updater status, download progress, latest version information, and **Restart & install** action.
- Retains GitHub Releases update configuration for `chaitanyaverma137-lab/heart-beats`.

## Build

```bash
npm install
npm run dist
```

The Windows NSIS installer and updater metadata are generated in `release/`.

## Publishing updates

Publish a non-draft GitHub Release with the Windows installer and the matching `latest.yml` (and `.blockmap` when generated). The package is configured to use GitHub Releases through `electron-updater`. See the [electron-builder auto-update guide](https://www.electron.build/docs/features/auto-update/) for release asset requirements.

Update checks are available in packaged builds. Development builds show a development-mode status rather than querying the release feed.

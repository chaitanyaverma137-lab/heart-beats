# Heart Beats v0.9.0

## Reference-inspired player update
- Floating mini-player is now a wide, horizontal, always-on-top pill with circular album artwork, title, artist, previous, play/pause and next controls.
- Clicking the artwork or track information opens the full-screen Now Playing view.
- The full-screen view keeps playback/settings on the left and synced lyrics on the right. Album art is shown when embedded in the audio file.
- Audio tags are read locally with `music-metadata`; files without embedded artwork use the Heart Beats fallback artwork.
- GitHub update publishing is configured for `chaitanyaverma137-lab/heart-beats`.

## Build on Windows
1. Install Node.js LTS and Git.
2. Extract this ZIP and open a terminal in the project folder.
3. Run `npm install` then `npm run dist`.
4. The NSIS installer is created in `release/`.

To publish an update, create a GitHub Release and upload the generated installer plus the `latest.yml` and blockmap files from `release/`. Automatic updates require a published release and a signed-in GitHub repository with the matching release assets.

This source archive has not been fully built or runtime-tested on Windows in this environment.

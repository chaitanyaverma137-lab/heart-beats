# Heart Beats v0.8.0

Heart Beats is an Electron + React desktop music player.

## v0.8.0 — Floating Player & Immersive Now Playing
- Native always-on-top floating mini-player with a music thumbnail tile, track title, previous/play-pause/next controls and live progress.
- The floating window is draggable and stays above other windows.
- Click the artwork or track title to open the immersive full-screen player.
- Full-screen player uses a two-column layout: playback and controls/settings on the left; timestamp-synchronised lyrics on the right.
- Includes volume, shuffle, repeat, playback speed, equaliser toggle, visualiser toggle, sleep timer and LRC import controls.
- Lyrics lines can be clicked to seek to their timestamp.

## Automatic updates
The GitHub update owner is configured as `chaitanyaverma137-lab`; repository name is `heart-beats`. The updater requires that repository to exist and a GitHub Release to be published with the Windows installer assets and `latest.yml`. The first installer must be distributed manually. For later releases, increment `version` in `package.json`, build and publish the release. Set a GitHub token in the build environment; never commit access tokens.

## Build on Windows
1. Install Node.js LTS.
2. Extract this ZIP and open a terminal in the project folder.
3. Run `npm install`.
4. Run `npm run dist`.
5. The Windows installer is created in `release/`.

## Existing features
- Local audio library and playlists
- Equaliser, visualiser, playback speed and sleep timer
- LRCLIB lyric lookup and timestamped LRC import
- Automatic update checking and background download

## Limitations
- Album artwork is currently a generated music tile, not fetched cover art.
- Automatic updates work only after the `chaitanyaverma137-lab/heart-beats` GitHub repository exists and a release has been published.
- Lyrics lookup requires internet access; synchronized highlighting requires timestamped lyrics.
- Spotify and YouTube Music account integration are not implemented in this build.

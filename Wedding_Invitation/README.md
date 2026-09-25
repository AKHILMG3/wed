# Digital Wedding Invitation

## Edit the invitation

Update `src/data/wedding.js` to change the couple names, date and time, venue, map link, invitation message, and all page copy. The same file contains the cover and gallery image URLs and the background music path.

To use your own files, place optimized images in `public` (for example, `public/photos/cover.jpg`) and set the matching path in `wedding.media.cover` (`/photos/cover.jpg`). Replace the entries in `wedding.media.photos` and their descriptions the same way. Add an audio file such as `public/wedding-music.mp3` and set `wedding.media.music` to `/wedding-music.mp3`.

The project currently has no uploaded wedding photos or audio, so the configured remote sample photos remain in place until you replace them. The music control reports when its configured audio file is unavailable.

## Run locally

```sh
npm install
npm run dev
```

Run `npm run lint` and `npm run build` to check the project.
# Digital Wedding Invitation

## Edit the invitation

Update `src/data/wedding.js` to change the couple names, date and time, venue, map link, invitation message, and all page copy. The same file contains the cover and gallery image URLs and the background music path.

The Our Story section uses `public/photos/our-story.jpg`; replace that file and update `wedding.media.storyImageDescription` in `src/data/wedding.js` if needed. The six photos in `public/photos/moment-01.jpg` through `moment-06.jpg` appear in the gallery in order; update `wedding.media.photos` and `wedding.media.photoDescriptions` to change them. To use your own cover, place an optimized image in `public` (for example, `public/photos/cover.jpg`) and set the matching path in `wedding.media.cover` (`/photos/cover.jpg`). Add an audio file such as `public/wedding-music.mp3` and set `wedding.media.music` to `/wedding-music.mp3`.

The floating music control starts playback only when selected, loops while visitors browse the page, and plays at a low volume. If the configured file is unavailable, the control is disabled. Use only a royalty-free or properly licensed instrumental track in `public/wedding-music.mp3`.

## Connect Supabase wishes

1. Create a Supabase project.
2. In the Supabase SQL Editor, run `supabase/schema.sql`. It creates the `wedding_wishes` table, enables row-level security, and adds the table to Realtime.
3. Copy `.env.example` to `.env.local`, then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase project's API settings. Use the exact Project URL shown in the dashboard and confirm the project is active; an incorrect or inactive project URL will prevent wishes from being sent. Restart the Vite dev server after changing environment variables.
4. Set the same variables in your hosting provider before deploying.

The browser uses only the public anon key. Never put a Supabase `service_role` key in a `VITE_` variable or client code. The included policies allow anonymous visitors to read and submit wishes; add CAPTCHA or server-side rate limiting before sharing the public link to reduce spam. Without the two environment variables, the wish form works as a local preview and does not save or share wishes.

## Run locally

```sh
npm install
npm run dev
```

Run `npm run lint` and `npm run build` to check the project.
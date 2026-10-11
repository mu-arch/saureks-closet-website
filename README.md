# Saurek's Closet website

Static website for the [Saurek's Closet](https://github.com/mu-arch/SaureksCloset) World of Warcraft 1.12.1 addon, designed for GitHub Pages.

## Local preview

Open `index.html` in a browser, or serve this directory with any static file server.

## Publishing

Publish the root of the `main` branch with GitHub Pages. No build step or secrets are required.

## Content and assets

The addon information and screenshots are drawn from the official Saurek's Closet project. Download links point to its latest release so this site does not mirror executable files. The screenshots in `assets/` retain the addon project's separate [artwork and assets license](https://github.com/mu-arch/SaureksCloset/blob/main/ASSETS-LICENSE); they are not included in any license for the website code. World of Warcraft imagery belongs to Blizzard Entertainment.

The background uses a [World of Warcraft landscape image](https://cdn.mos.cms.futurecdn.net/arGh4zjZisf9JZ8GZBWqDn-1200-80.jpg.webp) supplied by the user. The gallery buttons use a converted `Main.blp` addon texture, and the logo and decorative rim are from user-supplied artwork. The gallery contains six screenshots already published by the addon project and one user-supplied gameplay clip.

## Performance

Screenshots use high-quality WebP with their original dimensions. The silent gameplay clip uses 30 fps, with a fast-start H.264 MP4 preferred and a VP9 WebM fallback. Gallery images load lazily, resizing batches layout reads before writes, and hidden tabs pause playback. The golden Install pulse plays only on activation and respects reduced motion.

Cinzel, Cormorant Garamond, and Inter are served as local Latin WOFF2 fonts, with only the weights used by the page. Each font's SIL Open Font License is included in `assets/fonts/`. Fonts are sourced from Google Fonts; these licenses are separate from the project's artwork license. No build tools, trackers, third-party scripts, or runtime font services are required.

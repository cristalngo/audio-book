# Audiobook Sanctuary

A standalone static audiobook listener for GitHub Pages. It uses only `index.html`, `styles.css`, `app.js`, and a static JSON catalog.

## Preview Locally

From this folder:

```sh
python3 -m http.server 8027
```

Then open `http://127.0.0.1:8027/`.

When this folder is placed at `/Users/cristal/Documents/Audio book/audiobook-listener`, it will first try to load the Studio export catalog from:

```text
/Users/cristal/Documents/Audio book/listener-export/data/catalog.json
```

That exported catalog points to audio files in:

```text
/Users/cristal/Documents/Audio book/listener-export/audio/
```

If the export catalog is not available, the site falls back to the sample catalog in `data/catalog.json`.

The library refreshes the catalog each time you return to the library view. If Audiobook Studio exports a new book while the listener is open, go back to the library and the new book should appear.

The Delete button removes a book from the listener library on the current device by saving that preference in `localStorage`. Because this is a static GitHub Pages site, it does not delete MP3 files or edit the JSON catalog on disk.

## Add A New Audiobook

1. Create a folder for the audio files:

```text
audio/my-book-id/
```

2. Copy chapter files into that folder. MP3 is recommended for GitHub Pages:

```text
audio/my-book-id/chapter-01.mp3
audio/my-book-id/chapter-02.mp3
```

3. Add a cover image:

```text
assets/covers/my-book-id.jpg
```

4. Add a new book object to `data/catalog.json`:

```json
{
  "id": "my-book-id",
  "title": "My Audiobook Title",
  "subtitle": "Optional subtitle",
  "author": "Author or narrator",
  "description": "A short description shown on the book page.",
  "cover": "./assets/covers/my-book-id.jpg",
  "chapters": [
    {
      "title": "Chapter 1",
      "duration": "12:34",
      "src": "./audio/my-book-id/chapter-01.mp3"
    },
    {
      "title": "Chapter 2",
      "duration": "10:18",
      "src": "./audio/my-book-id/chapter-02.mp3"
    }
  ]
}
```

Use relative paths beginning with `./` so the site works from a GitHub Pages project URL such as `https://username.github.io/repository-name/`.

## Deploy To GitHub Pages

Upload the contents of this folder to a GitHub repository and enable GitHub Pages for the branch/folder you prefer. If you keep this site in a larger repo, publish this folder as the Pages root or copy these files into the repo root.

For GitHub Pages, copy the generated export files into this site folder before uploading:

```text
listener-export/data/catalog.json -> audiobook-listener/data/catalog.json
listener-export/audio/ -> audiobook-listener/audio/
```

After copying, the same catalog chapter paths such as `audio/my-book-id/chapter-01.mp3` will work online.

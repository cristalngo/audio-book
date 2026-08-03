import fs from "node:fs";
import path from "node:path";

const siteRoot = path.resolve(import.meta.dirname, "..");
const catalogPath = path.join(siteRoot, "data", "catalog.json");
const booksRoot = path.join(siteRoot, "books");
const siteUrl = "https://cristalngo.github.io/audio-book/";
const appVersion = "share-pages-21";

const knownCoverPaths = {
  "dayspring-of-youth": "assets/covers/dayspring-of-youth.jpg?v=1",
  "tam-ly-hoc-cho-su-thay-oi-triet-e": "assets/covers/tam-ly-hoc-cho-su-thay-doi-triet-de.jpg?v=1",
  "bong-hong-cai-ao": "assets/covers/bong-hong-cai-ao.jpg?v=3",
  "xu-xo-cua-cac-vi-than": "assets/covers/xu-xo-cua-cac-vi-than.jpg?v=2"
};

const knownSocialImagePaths = {
  "dayspring-of-youth": "assets/social/dayspring-of-youth.jpg",
  "tam-ly-hoc-cho-su-thay-oi-triet-e": "assets/social/tam-ly-hoc-cho-su-thay-oi-triet-e.jpg",
  "bong-hong-cai-ao": "assets/social/bong-hong-cai-ao.jpg",
  "xu-xo-cua-cac-vi-than": "assets/social/xu-xo-cua-cac-vi-than.jpg"
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

function normalizeAsset(assetPath, bookId) {
  const fallback = knownCoverPaths[bookId] || "assets/icons/icon-512.png";
  const value = assetPath || fallback;
  return value.replace(/^\.\//, "");
}

function cleanAssetUrl(assetPath) {
  return assetPath.split("?")[0];
}

function absoluteSiteUrl(relativePath) {
  return new URL(relativePath, siteUrl).href;
}

function bookDescription(book) {
  return book.description || book.subtitle || [
    book.author ? `Author: ${book.author}` : "",
    book.narrator ? `Narrator: ${book.narrator}` : "",
    `${book.chapters?.length || 0} chapter${book.chapters?.length === 1 ? "" : "s"}`
  ].filter(Boolean).join(" · ");
}

function htmlForBook(book) {
  const title = `${book.title} | Stillword`;
  const description = bookDescription(book);
  const coverPath = normalizeAsset(book.cover, book.id);
  const socialImagePath = knownSocialImagePaths[book.id] || cleanAssetUrl(coverPath);
  const socialImage = absoluteSiteUrl(socialImagePath);
  const pageUrl = absoluteSiteUrl(`books/${book.id}/`);
  const appUrl = absoluteSiteUrl(`#book/${book.id}`);

  return `<!doctype html>
<html lang="${book.language || "en"}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${escapeHtml(pageUrl)}">
    <meta property="og:type" content="music.album">
    <meta property="og:site_name" content="Stillword">
    <meta property="og:title" content="${escapeHtml(book.title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(pageUrl)}">
    <meta property="og:image" content="${escapeHtml(socialImage)}">
    <meta property="og:image:secure_url" content="${escapeHtml(socialImage)}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${escapeHtml(`${book.title} cover`)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(book.title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(socialImage)}">
    <meta name="twitter:image:alt" content="${escapeHtml(`${book.title} cover`)}">
    <link rel="stylesheet" href="../../styles.css?v=${appVersion}">
  </head>
  <body>
    <main class="share-landing">
      <img src="../../${escapeHtml(coverPath)}" alt="">
      <h1>${escapeHtml(book.title)}</h1>
      ${book.author ? `<p>${escapeHtml(book.author)}</p>` : ""}
      <a class="primary-button" href="${escapeHtml(appUrl)}">Listen on Stillword</a>
    </main>
  </body>
</html>
`;
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
fs.mkdirSync(booksRoot, { recursive: true });

for (const book of catalog.books || []) {
  const folder = path.join(booksRoot, book.id);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, "index.html"), htmlForBook(book));
}

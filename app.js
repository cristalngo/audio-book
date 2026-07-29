const catalogSources = [
  { url: "../listener-export/data/catalog.json", assetBase: "../listener-export/" },
  { url: "./data/catalog.json", assetBase: "./" }
];
const storageKey = "audiobookSanctuary.resume.v1";
const hiddenBooksStorageKey = "stillword.hiddenBooks.v1";
const excludedBookIds = new Set(["binh-minh-tuoi-tre"]);
const knownCoverPaths = {
  "dayspring-of-youth": "./assets/covers/dayspring-of-youth.jpg?v=1",
  "tam-ly-hoc-cho-su-thay-oi-triet-e": "./assets/covers/tam-ly-hoc-cho-su-thay-doi-triet-de.jpg?v=1",
  "bong-hong-cai-ao": "./assets/covers/bong-hong-cai-ao.jpg?v=3"
};

const state = {
  catalog: [],
  hiddenBookIds: getHiddenBookIds(),
  showHiddenBooks: false,
  currentBook: null,
  currentChapterIndex: 0,
  routeBook: null,
  playMode: "chapter",
  restoreTime: 0,
  isRefreshing: false
};

const els = {
  bookGrid: document.querySelector("#bookGrid"),
  bookCount: document.querySelector("#bookCount"),
  hiddenToggleBtn: document.querySelector("#hiddenToggleBtn"),
  hiddenBooksPanel: document.querySelector("#hiddenBooksPanel"),
  libraryHero: document.querySelector("#libraryHero"),
  libraryView: document.querySelector("#libraryView"),
  bookView: document.querySelector("#bookView"),
  bookDetail: document.querySelector("#bookDetail"),
  backBtn: document.querySelector("#backBtn"),
  playerBar: document.querySelector("#playerBar"),
  playerCover: document.querySelector("#playerCover"),
  playerTitle: document.querySelector("#playerTitle"),
  playerChapter: document.querySelector("#playerChapter"),
  playPauseBtn: document.querySelector("#playPauseBtn"),
  audio: document.querySelector("#audioPlayer"),
  seekBar: document.querySelector("#seekBar"),
  currentTime: document.querySelector("#currentTime"),
  durationTime: document.querySelector("#durationTime"),
  resumePanel: document.querySelector("#resumePanel"),
  resumeTitle: document.querySelector("#resumeTitle"),
  resumeMeta: document.querySelector("#resumeMeta"),
  heroContinueBtn: document.querySelector("#heroContinueBtn"),
  headerContinueBtn: document.querySelector("#headerContinueBtn")
};

async function init() {
  try {
    await refreshCatalog();
    renderLibrary();
    updateResumeUi();
    route();
  } catch (error) {
    els.bookGrid.innerHTML = `<p class="empty-state">Catalog could not be loaded. Check listener-export/data/catalog.json or data/catalog.json.</p>`;
    console.error(error);
  }
}

async function loadCatalog() {
  const errors = [];

  for (const source of catalogSources) {
    try {
      const response = await fetch(withCacheBust(source.url));
      if (!response.ok) throw new Error(`${source.url} returned ${response.status}`);
      const data = await response.json();
      const books = normalizeCatalog(data.books || [], source.assetBase);
      if (books.length) return { books, source };
    } catch (error) {
      errors.push(error);
    }
  }

  throw new Error(errors.map((error) => error.message).join("; "));
}

async function refreshCatalog() {
  if (state.isRefreshing) return;
  state.isRefreshing = true;

  try {
    const { books } = await loadCatalog();
    state.catalog = books;
    renderLibrary();
    updateResumeUi();
  } finally {
    state.isRefreshing = false;
  }
}

function normalizeCatalog(books, assetBase) {
  return books.filter((book) => !excludedBookIds.has(book.id)).map((book) => ({
    ...book,
    author: book.author || book.narrator || "",
    cover: resolveAsset(book.cover, assetBase) || knownCover(book.id) || placeholderCover(book),
    description: book.description || book.subtitle || "",
    language: normalizeLanguage(book.language, book.title),
    publishedAt: book.publishedAt || book.publishedDate || book.updatedAt || "",
    chapters: [...(book.chapters || [])]
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((chapter) => ({
        ...chapter,
        duration: formatDurationLabel(chapter.duration),
        src: resolveAsset(chapter.src, assetBase)
      }))
  }));
}

function knownCover(bookId) {
  return knownCoverPaths[bookId] || "";
}

function normalizeLanguage(language, title = "") {
  if (language) {
    const value = String(language).toLowerCase();
    if (value.startsWith("vi") || value.includes("vietnam")) return "vi";
    if (value.startsWith("en") || value.includes("english")) return "en";
  }
  return /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(title) ? "vi" : "en";
}

function copy(book, key) {
  const strings = {
    en: {
      back: "Back to library",
      hide: "Hide",
      listen: "Listen",
      open: "Open",
      published: "Published",
      language: "English"
    },
    vi: {
      back: "Quay lại thư viện",
      hide: "Ẩn",
      listen: "Nghe",
      open: "Mở",
      published: "Xuất bản",
      language: "Tiếng Việt"
    }
  };
  return strings[book.language || "en"]?.[key] || strings.en[key];
}

function chapterCountLabel(book) {
  const count = book.chapters.length;
  if (book.language === "vi") return `${count} chương`;
  return `${count} chapter${count === 1 ? "" : "s"}`;
}

function languageLabel(book) {
  return copy(book, "language");
}

function publishedLabel(book) {
  const date = new Date(book.publishedAt);
  const value = Number.isNaN(date.getTime())
    ? book.publishedAt
    : date.toLocaleDateString(book.language === "vi" ? "vi-VN" : "en-US", {
      year: "numeric",
      month: book.language === "vi" ? "2-digit" : "short",
      day: "numeric"
    });
  return `${copy(book, "published")} ${value}`;
}

function resolveAsset(path, assetBase) {
  if (!path) return "";
  if (/^(https?:|file:|data:|\/)/.test(path)) return path;
  return `${assetBase}${path.replace(/^\.\//, "")}`;
}

function absoluteUrl(path) {
  try {
    return new URL(path, window.location.href).href;
  } catch {
    return path;
  }
}

function mediaArtworkType(path) {
  const cleanPath = String(path || "").split("?")[0].toLowerCase();
  if (cleanPath.endsWith(".png")) return "image/png";
  if (cleanPath.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function updateMediaSession(book, chapter) {
  if (!("mediaSession" in navigator) || !window.MediaMetadata) return;

  const artworkSrc = absoluteUrl(book.cover);
  const artworkType = mediaArtworkType(book.cover);
  navigator.mediaSession.metadata = new MediaMetadata({
    title: chapter?.title || book.title,
    artist: book.author || book.narrator || "Stillword",
    album: book.title,
    artwork: [
      { src: artworkSrc, sizes: "96x96", type: artworkType },
      { src: artworkSrc, sizes: "128x128", type: artworkType },
      { src: artworkSrc, sizes: "192x192", type: artworkType },
      { src: artworkSrc, sizes: "256x256", type: artworkType },
      { src: artworkSrc, sizes: "512x512", type: artworkType }
    ]
  });
}

function setMediaPlaybackState(playbackState) {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.playbackState = playbackState;
}

function seekRelative(offset) {
  const duration = els.audio.duration || 0;
  const nextTime = Math.min(Math.max(0, els.audio.currentTime + offset), duration || Number.MAX_SAFE_INTEGER);
  els.audio.currentTime = nextTime;
}

function playNextChapter() {
  if (!state.currentBook) return;
  const nextIndex = state.currentChapterIndex + 1;
  if (nextIndex < state.currentBook.chapters.length) {
    loadChapter(state.currentBook, nextIndex, { playMode: "book", autoplay: true, startTime: 0 });
  }
}

function playPreviousChapter() {
  if (!state.currentBook) return;
  if (els.audio.currentTime > 5 || state.currentChapterIndex === 0) {
    els.audio.currentTime = 0;
    saveResume(0);
    return;
  }
  loadChapter(state.currentBook, state.currentChapterIndex - 1, {
    playMode: "book",
    autoplay: true,
    startTime: 0
  });
}

function setupMediaSessionActions() {
  if (!("mediaSession" in navigator)) return;

  const setAction = (action, handler) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // Some browsers expose Media Session but not every action.
    }
  };

  setAction("play", () => {
    if (ensurePlayableSelection()) els.audio.play();
  });
  setAction("pause", () => els.audio.pause());
  setAction("seekbackward", (details = {}) => seekRelative(-(details.seekOffset || 10)));
  setAction("seekforward", (details = {}) => seekRelative(details.seekOffset || 10));
  setAction("previoustrack", playPreviousChapter);
  setAction("nexttrack", playNextChapter);
  setAction("seekto", (details = {}) => {
    if (!Number.isFinite(details.seekTime)) return;
    if (details.fastSeek && "fastSeek" in els.audio) {
      els.audio.fastSeek(details.seekTime);
    } else {
      els.audio.currentTime = details.seekTime;
    }
  });
}

function renderLibrary() {
  const visibleBooks = state.catalog.filter((book) => !state.hiddenBookIds.has(book.id));
  const hiddenBooks = state.catalog.filter((book) => state.hiddenBookIds.has(book.id));

  els.bookCount.textContent = hiddenBooks.length
    ? `${visibleBooks.length} shown, ${hiddenBooks.length} hidden`
    : `${visibleBooks.length} audiobook${visibleBooks.length === 1 ? "" : "s"}`;
  els.hiddenToggleBtn.hidden = hiddenBooks.length === 0;
  els.hiddenToggleBtn.textContent = state.showHiddenBooks ? "Hide hidden" : `Hidden (${hiddenBooks.length})`;
  els.bookGrid.innerHTML = visibleBooks.length ? visibleBooks.map((book) => `
    <article class="book-card" data-book-id="${escapeHtml(book.id)}">
      <button class="book-open" type="button" data-action="open-book" aria-label="${escapeHtml(copy(book, "open"))} ${escapeHtml(book.title)}">
        <img src="${escapeHtml(book.cover)}" alt="">
      </button>
      <div>
        <h3>${escapeHtml(book.title)}</h3>
        ${book.subtitle || book.description ? `<p>${escapeHtml(book.subtitle || book.description)}</p>` : ""}
        <div class="book-meta-list">
          <span>${escapeHtml(chapterCountLabel(book))}</span>
          <span>${escapeHtml(languageLabel(book))}</span>
          ${book.publishedAt ? `<span>${escapeHtml(publishedLabel(book))}</span>` : ""}
        </div>
        <div class="card-actions">
          <button class="primary-button small-button" type="button" data-action="open-book">${escapeHtml(copy(book, "listen"))}</button>
        </div>
      </div>
      <button class="hide-book-button" type="button" data-action="hide-book" aria-label="${escapeHtml(copy(book, "hide"))} ${escapeHtml(book.title)}">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 3l18 18"/>
          <path d="M10.6 10.6A2 2 0 0 0 12 14a2 2 0 0 0 1.4-.6"/>
          <path d="M9.1 5.4A9.8 9.8 0 0 1 12 5c5 0 8.5 4.6 9.5 7a11.7 11.7 0 0 1-2.1 3.1"/>
          <path d="M6.4 6.9A11.6 11.6 0 0 0 2.5 12c1 2.4 4.5 7 9.5 7 1.4 0 2.7-.4 3.8-1"/>
        </svg>
      </button>
    </article>
  `).join("") : `<p class="empty-state">No books in your library right now.</p>`;
  els.hiddenBooksPanel.hidden = !state.showHiddenBooks || hiddenBooks.length === 0;
  els.hiddenBooksPanel.innerHTML = hiddenBooks.map((book) => `
    <div class="hidden-book-row" data-book-id="${escapeHtml(book.id)}">
      <span>${escapeHtml(book.title)}</span>
      <button class="text-button small-text-button" type="button" data-action="restore-book">Restore</button>
    </div>
  `).join("");

  els.bookGrid.querySelectorAll("[data-action='open-book']").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-book-id]");
      location.hash = `book/${card.dataset.bookId}`;
    });
  });

  els.bookGrid.querySelectorAll("[data-action='hide-book']").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-book-id]");
      hideBook(card.dataset.bookId);
    });
  });

  els.hiddenBooksPanel.querySelectorAll("[data-action='restore-book']").forEach((button) => {
    button.addEventListener("click", () => {
      const row = button.closest("[data-book-id]");
      restoreBook(row.dataset.bookId);
    });
  });
}

function renderBook(book) {
  const shouldShowDescription = book.description && book.description !== book.subtitle;
  els.backBtn.textContent = copy(book, "back");

  els.bookDetail.innerHTML = `
    <div class="book-heading">
      <img class="book-cover-small" src="${escapeHtml(book.cover)}" alt="">
      <div>
        ${book.author ? `<p class="eyebrow">${escapeHtml(book.author)}</p>` : ""}
        <h1>${escapeHtml(book.title)}</h1>
        ${book.subtitle ? `<h2>${escapeHtml(book.subtitle)}</h2>` : ""}
        <div class="book-meta-list detail-meta">
          <span>${escapeHtml(chapterCountLabel(book))}</span>
          <span>${escapeHtml(languageLabel(book))}</span>
          ${book.publishedAt ? `<span>${escapeHtml(publishedLabel(book))}</span>` : ""}
        </div>
        ${shouldShowDescription ? `<p class="book-description">${escapeHtml(book.description)}</p>` : ""}
      </div>
    </div>
    <div class="chapter-list">
      ${book.chapters.map((chapter, index) => `
        <button class="chapter-row" type="button" data-chapter-index="${index}">
          <span class="chapter-number">${index + 1}</span>
          <div>
            <h3>${escapeHtml(chapter.title)}</h3>
            <span class="chapter-meta">${escapeHtml(chapter.duration || "Audio chapter")}</span>
          </div>
        </button>
      `).join("")}
    </div>
  `;

  els.bookDetail.querySelectorAll("[data-chapter-index]").forEach((button) => {
    button.addEventListener("click", () => {
      loadChapter(book, Number(button.dataset.chapterIndex), { playMode: "book", autoplay: true, startTime: 0 });
    });
  });
}

async function route() {
  const match = location.hash.match(/^#book\/([^/]+)$/);
  const book = match ? findBook(decodeURIComponent(match[1])) : null;
  state.routeBook = book || null;
  els.libraryHero.hidden = Boolean(book);
  els.libraryView.hidden = Boolean(book);
  els.bookView.hidden = !book;
  updateResumeUi();
  if (book) {
    showPlayerForBook(book);
    renderBook(book);
  } else {
    await refreshCatalog();
    showPlayerForLibrary();
  }
}

function showPlayerForBook(book) {
  document.body.classList.add("has-player");
  document.body.classList.remove("mini-player");
  els.playerBar.hidden = false;
  if (state.currentBook?.id === book.id && els.audio.src) return;

  els.audio.pause();
  els.audio.removeAttribute("src");
  els.audio.load();
  state.currentBook = null;
  state.currentChapterIndex = 0;
  state.restoreTime = 0;
  els.playerCover.src = book.cover;
  els.playerTitle.textContent = book.title;
  els.playerChapter.textContent = "Select a chapter";
  els.playPauseBtn.textContent = "Play";
  els.playPauseBtn.setAttribute("aria-label", "Play");
  els.seekBar.value = 0;
  els.currentTime.textContent = "0:00";
  els.durationTime.textContent = "0:00";
}

function showPlayerForLibrary() {
  const hasLoadedAudio = Boolean(state.currentBook && els.audio.src);
  document.body.classList.toggle("has-player", hasLoadedAudio);
  document.body.classList.toggle("mini-player", hasLoadedAudio);
  els.playerBar.hidden = !hasLoadedAudio;
}

function loadChapter(book, chapterIndex, options = {}) {
  const chapter = book.chapters[chapterIndex];
  if (!chapter) return;

  state.currentBook = book;
  state.currentChapterIndex = chapterIndex;
  state.playMode = options.playMode || "chapter";
  state.restoreTime = options.startTime || 0;
  els.audio.volume = 1;

  els.playerBar.hidden = false;
  els.playerCover.src = book.cover;
  els.playerTitle.textContent = book.title;
  els.playerChapter.textContent = chapter.title;
  els.playPauseBtn.textContent = "Play";
  els.playPauseBtn.setAttribute("aria-label", "Play");
  els.audio.src = chapter.src;
  updateMediaSession(book, chapter);
  setMediaPlaybackState("paused");
  els.audio.load();
  saveResume(state.restoreTime);

  if (options.autoplay) {
    els.audio.play().catch(() => {
      els.playerChapter.textContent = `${chapter.title} - tap Play to start`;
    });
  }
}

function continueListening(autoplay = false) {
  const resume = getResume();
  if (!resume) return;
  const book = findBook(resume.bookId);
  if (!book) return;
  if (location.hash !== `#book/${book.id}`) location.hash = `book/${book.id}`;
  loadChapter(book, resume.chapterIndex || 0, {
    playMode: "book",
    autoplay,
    startTime: resume.time || 0
  });
}

function ensurePlayableSelection() {
  if (els.audio.src) return true;

  const resume = getResume();
  const resumeBook = resume ? findBook(resume.bookId) : null;
  const book = state.routeBook || resumeBook || state.catalog[0];
  if (!book) return false;

  const chapterIndex = resumeBook?.id === book.id ? resume.chapterIndex || 0 : 0;
  const startTime = resumeBook?.id === book.id ? resume.time || 0 : 0;
  loadChapter(book, chapterIndex, {
    playMode: "book",
    autoplay: false,
    startTime
  });
  return true;
}

function updateResumeUi() {
  const resume = getResume();
  const book = resume ? findBook(resume.bookId) : null;
  const chapter = book?.chapters?.[resume.chapterIndex || 0];
  const hasResume = Boolean(book && chapter);

  els.resumePanel.hidden = Boolean(state.routeBook) || !hasResume;
  els.headerContinueBtn.hidden = true;
  if (!hasResume) return;

  els.resumeTitle.textContent = book.title;
  els.resumeMeta.textContent = `${chapter.title} at ${formatTime(resume.time || 0)}`;
}

function saveResume(time = els.audio.currentTime || 0) {
  if (!state.currentBook) return;
  localStorage.setItem(storageKey, JSON.stringify({
    bookId: state.currentBook.id,
    chapterIndex: state.currentChapterIndex,
    time,
    updatedAt: new Date().toISOString()
  }));
  updateResumeUi();
}

function getResume() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "null");
  } catch {
    return null;
  }
}

function findBook(bookId) {
  return state.catalog.find((book) => book.id === bookId);
}

function getHiddenBookIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(hiddenBooksStorageKey) || "[]"));
  } catch {
    return new Set();
  }
}

function saveHiddenBookIds() {
  localStorage.setItem(hiddenBooksStorageKey, JSON.stringify([...state.hiddenBookIds]));
}

function hideBook(bookId) {
  state.hiddenBookIds.add(bookId);
  saveHiddenBookIds();
  renderLibrary();
}

function restoreBook(bookId) {
  state.hiddenBookIds.delete(bookId);
  saveHiddenBookIds();
  renderLibrary();
}

function withCacheBust(url) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}t=${Date.now()}`;
}

function formatTime(seconds) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatDurationLabel(duration) {
  if (typeof duration === "number") return formatTime(duration);
  return duration || "Audio chapter";
}

function placeholderCover(book) {
  const seed = hashString(`${book.id || ""}:${book.title || ""}`);
  const palettes = [
    ["#eadcc4", "#dce7de", "#3f6356", "#f9f0cf", "#b87368"],
    ["#e6d6ce", "#dce5ec", "#394f68", "#f7e7b0", "#7c6a9a"],
    ["#efe2c5", "#e3ead9", "#746042", "#fff4c4", "#3f6658"],
    ["#d9e4df", "#f0dcc8", "#5d4d67", "#fff1d4", "#c38a3e"],
    ["#e7dfc9", "#d8e4e8", "#6b4d45", "#f8f1dd", "#56766c"],
    ["#e9d6bc", "#d9eadf", "#365d65", "#fff6cc", "#9b6a4e"]
  ];
  const palette = palettes[seed % palettes.length];
  const titleLines = splitCoverTitle(book.title || "Audiobook");
  const author = escapeHtml(book.author || book.narrator || "M");
  const scene = coverScene(seed, palette);
  const titleMarkup = titleLines.map((line, index) => (
    `<tspan x="450" ${index === 0 ? 'y="168"' : 'dy="74"'}>${escapeHtml(line)}</tspan>`
  )).join("");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1200">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${palette[0]}"/>
          <stop offset="0.58" stop-color="${palette[1]}"/>
          <stop offset="1" stop-color="${palette[2]}"/>
        </linearGradient>
      </defs>
      <rect width="900" height="1200" fill="url(#g)"/>
      <rect x="44" y="44" width="812" height="1112" rx="36" fill="none" stroke="${palette[3]}" stroke-width="3" opacity="0.34"/>
      ${scene}
      <text text-anchor="middle" font-family="Georgia, serif" font-size="${titleLines.length > 1 ? 58 : 66}" font-weight="600" fill="#24312c">
        ${titleMarkup}
      </text>
      <text x="450" y="${titleLines.length > 1 ? 318 : 254}" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="${palette[2]}">${author}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function coverScene(seed, palette) {
  const variant = seed % 6;
  const accent = palette[4];
  const light = palette[3];
  const dark = palette[2];

  const scenes = [
    `<circle cx="612" cy="430" r="126" fill="${light}" opacity="0.72"/>
     <path d="M0 760 C145 684 265 790 408 716 C544 646 662 746 900 660 L900 1200 L0 1200 Z" fill="${dark}" opacity="0.9"/>
     <path d="M100 714 L282 516 L422 690 L540 570 L762 714 Z" fill="${dark}" opacity="0.34"/>
     <path d="M104 714 L282 516 L422 690 L540 570 L762 714" fill="none" stroke="${light}" stroke-width="6" opacity="0.36"/>`,
    `<path d="M258 780 L258 484 C258 322 642 322 642 484 L642 780 Z" fill="${dark}" opacity="0.18"/>
     <path d="M326 780 L326 506 C326 404 574 404 574 506 L574 780 Z" fill="${light}" opacity="0.68"/>
     <path d="M228 782 H672" stroke="${dark}" stroke-width="26" opacity="0.62"/>
     <path d="M324 842 H576 M286 908 H614 M246 974 H654" stroke="${accent}" stroke-width="10" opacity="0.45"/>`,
    `<circle cx="306" cy="430" r="102" fill="${light}" opacity="0.64"/>
     <circle cx="350" cy="394" r="104" fill="${palette[1]}" opacity="0.92"/>
     <path d="M0 760 C150 704 230 806 376 744 C556 668 644 806 900 704 L900 1200 L0 1200 Z" fill="${dark}" opacity="0.9"/>
     <path d="M150 570 C218 520 282 520 350 570 M578 538 C650 482 718 482 790 538" fill="none" stroke="${accent}" stroke-width="9" opacity="0.44"/>`,
    `<path d="M450 352 L566 640 L856 650 L622 824 L706 1102 L450 938 L194 1102 L278 824 L44 650 L334 640 Z" fill="${light}" opacity="0.38"/>
     <circle cx="450" cy="654" r="168" fill="none" stroke="${dark}" stroke-width="20" opacity="0.38"/>
     <circle cx="450" cy="654" r="92" fill="${light}" opacity="0.54"/>
     <path d="M450 452 V856 M248 654 H652" stroke="${accent}" stroke-width="8" opacity="0.38"/>`,
    `<path d="M450 872 C286 724 250 588 350 474 C410 406 490 406 550 474 C650 588 614 724 450 872 Z" fill="${light}" opacity="0.56"/>
     <path d="M450 872 C364 718 376 584 450 450 C524 584 536 718 450 872 Z" fill="${dark}" opacity="0.24"/>
     <path d="M248 806 C326 720 382 690 450 872 C518 690 574 720 652 806" fill="none" stroke="${accent}" stroke-width="11" opacity="0.5"/>
     <path d="M0 966 C164 914 284 1010 450 944 C628 872 746 978 900 922 L900 1200 L0 1200 Z" fill="${dark}" opacity="0.9"/>`,
    `<path d="M452 342 C596 482 652 640 622 814 C596 966 492 1060 450 1084 C408 1060 304 966 278 814 C248 640 306 482 452 342 Z" fill="${dark}" opacity="0.22"/>
     <path d="M450 330 V1058" stroke="${light}" stroke-width="8" opacity="0.5"/>
     <path d="M450 470 C350 506 296 588 282 704 M450 602 C550 638 604 720 618 836 M450 738 C364 766 314 834 298 930" fill="none" stroke="${accent}" stroke-width="10" opacity="0.42"/>
     <circle cx="450" cy="320" r="72" fill="${light}" opacity="0.7"/>`
  ];

  return scenes[variant];
}

function hashString(value) {
  return String(value).split("").reduce((hash, char) => (
    ((hash << 5) - hash + char.charCodeAt(0)) >>> 0
  ), 2166136261);
}

function splitCoverTitle(title) {
  const words = String(title).trim().split(/\s+/);
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > 18 && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });

  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

els.backBtn.addEventListener("click", () => {
  history.pushState("", document.title, location.pathname + location.search);
  route();
});

els.playPauseBtn.addEventListener("click", () => {
  if (!ensurePlayableSelection()) return;
  if (els.audio.paused) {
    els.audio.play();
  } else {
    els.audio.pause();
  }
});

els.audio.addEventListener("loadedmetadata", () => {
  if (state.restoreTime > 0 && state.restoreTime < els.audio.duration) {
    els.audio.currentTime = state.restoreTime;
    state.restoreTime = 0;
  }
  els.durationTime.textContent = formatTime(els.audio.duration);
});

els.audio.addEventListener("play", () => {
  els.playPauseBtn.textContent = "Pause";
  els.playPauseBtn.setAttribute("aria-label", "Pause");
  setMediaPlaybackState("playing");
});

els.audio.addEventListener("pause", () => {
  els.playPauseBtn.textContent = "Play";
  els.playPauseBtn.setAttribute("aria-label", "Play");
  setMediaPlaybackState("paused");
  saveResume();
});

els.audio.addEventListener("timeupdate", () => {
  const duration = els.audio.duration || 0;
  els.currentTime.textContent = formatTime(els.audio.currentTime);
  els.durationTime.textContent = formatTime(duration);
  els.seekBar.value = duration ? Math.round((els.audio.currentTime / duration) * 1000) : 0;
  saveResume();
});

els.seekBar.addEventListener("input", () => {
  const duration = els.audio.duration || 0;
  if (!duration) return;
  els.audio.currentTime = (Number(els.seekBar.value) / 1000) * duration;
});

els.audio.addEventListener("ended", () => {
  saveResume(0);
  if (state.playMode !== "book" || !state.currentBook) return;
  playNextChapter();
});

els.audio.addEventListener("error", () => {
  els.playerChapter.textContent = "Audio file not found. Check the chapter src path.";
});

els.heroContinueBtn.addEventListener("click", () => continueListening(true));

els.hiddenToggleBtn.addEventListener("click", () => {
  state.showHiddenBooks = !state.showHiddenBooks;
  renderLibrary();
});
els.headerContinueBtn.addEventListener("click", () => continueListening(true));
window.addEventListener("hashchange", route);

setupMediaSessionActions();
init();

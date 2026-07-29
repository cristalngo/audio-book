const catalogSources = [
  { url: "../listener-export/data/catalog.json", assetBase: "../listener-export/" },
  { url: "./data/catalog.json", assetBase: "./" }
];
const storageKey = "audiobookSanctuary.resume.v1";
const deletedBooksKey = "audiobookSanctuary.deletedBooks.v1";

const state = {
  catalog: [],
  allBooks: [],
  currentBook: null,
  currentChapterIndex: 0,
  playMode: "chapter",
  restoreTime: 0,
  isRefreshing: false
};

const els = {
  bookGrid: document.querySelector("#bookGrid"),
  bookCount: document.querySelector("#bookCount"),
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
    state.allBooks = books;
    state.catalog = applyDeletedBooks(books);
    renderLibrary();
    updateResumeUi();
  } finally {
    state.isRefreshing = false;
  }
}

function normalizeCatalog(books, assetBase) {
  return books.map((book) => ({
    ...book,
    author: book.author || book.narrator || "Audiobook",
    cover: resolveAsset(book.cover, assetBase) || placeholderCover(book),
    description: book.description || book.subtitle || "",
    chapters: [...(book.chapters || [])]
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((chapter) => ({
        ...chapter,
        duration: formatDurationLabel(chapter.duration),
        src: resolveAsset(chapter.src, assetBase)
      }))
  }));
}

function resolveAsset(path, assetBase) {
  if (!path) return "";
  if (/^(https?:|file:|data:|\/)/.test(path)) return path;
  return `${assetBase}${path.replace(/^\.\//, "")}`;
}

function renderLibrary() {
  els.bookCount.textContent = `${state.catalog.length} audiobook${state.catalog.length === 1 ? "" : "s"}`;
  els.bookGrid.innerHTML = state.catalog.length ? state.catalog.map((book) => `
    <article class="book-card" data-book-id="${escapeHtml(book.id)}">
      <button class="book-open" type="button" data-action="open-book" aria-label="Open ${escapeHtml(book.title)}">
        <img src="${escapeHtml(book.cover)}" alt="">
      </button>
      <div>
        <h3>${escapeHtml(book.title)}</h3>
        <p>${escapeHtml(book.subtitle || book.description || "Ready to listen")}</p>
        <span class="card-meta">
          <span>${escapeHtml(book.author || "Unknown author")}</span>
          <span>${book.chapters.length} chapters</span>
        </span>
        <div class="card-actions">
          <button class="primary-button small-button" type="button" data-action="open-book">Open</button>
          <button class="ghost-button small-button danger-button" type="button" data-action="delete-book">Delete</button>
        </div>
      </div>
    </article>
  `).join("") : `<p class="empty-state">No books in your library right now.</p>`;

  els.bookGrid.querySelectorAll("[data-action='open-book']").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-book-id]");
      location.hash = `book/${card.dataset.bookId}`;
    });
  });

  els.bookGrid.querySelectorAll("[data-action='delete-book']").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-book-id]");
      const book = findBook(card.dataset.bookId);
      if (book) deleteBook(book);
    });
  });
}

function renderBook(book) {
  const resume = getResume();
  const hasResume = resume && resume.bookId === book.id;
  const resumeChapter = hasResume ? book.chapters[resume.chapterIndex] : null;

  els.bookDetail.innerHTML = `
    <img class="book-cover-large" src="${escapeHtml(book.cover)}" alt="">
    <div>
      <p class="eyebrow">${escapeHtml(book.author || "Audiobook")}</p>
      <h1>${escapeHtml(book.title)}</h1>
      ${book.subtitle ? `<h2>${escapeHtml(book.subtitle)}</h2>` : ""}
      <p class="book-description">${escapeHtml(book.description || "")}</p>
      <div class="detail-actions">
        <button class="primary-button" type="button" data-action="play-book">Play Book</button>
        ${hasResume ? `<button class="ghost-button" type="button" data-action="resume-book">Continue: ${escapeHtml(resumeChapter?.title || "Chapter")}</button>` : ""}
      </div>
      <div class="chapter-list">
        ${book.chapters.map((chapter, index) => `
          <article class="chapter-row">
            <span class="chapter-number">${index + 1}</span>
            <div>
              <h3>${escapeHtml(chapter.title)}</h3>
              <span class="chapter-meta">${escapeHtml(chapter.duration || "Audio chapter")}</span>
            </div>
            <button class="chapter-play" type="button" data-chapter-index="${index}">Play</button>
          </article>
        `).join("")}
      </div>
    </div>
  `;

  els.bookDetail.querySelector("[data-action='play-book']").addEventListener("click", () => {
    loadChapter(book, 0, { playMode: "book", autoplay: true, startTime: 0 });
  });

  const resumeBtn = els.bookDetail.querySelector("[data-action='resume-book']");
  if (resumeBtn) {
    resumeBtn.addEventListener("click", () => continueListening(true));
  }

  els.bookDetail.querySelectorAll("[data-chapter-index]").forEach((button) => {
    button.addEventListener("click", () => {
      loadChapter(book, Number(button.dataset.chapterIndex), { playMode: "chapter", autoplay: true, startTime: 0 });
    });
  });
}

async function route() {
  const match = location.hash.match(/^#book\/([^/]+)$/);
  const book = match ? findBook(decodeURIComponent(match[1])) : null;
  els.libraryView.hidden = Boolean(book);
  els.bookView.hidden = !book;
  if (book) {
    renderBook(book);
  } else {
    await refreshCatalog();
  }
}

function loadChapter(book, chapterIndex, options = {}) {
  const chapter = book.chapters[chapterIndex];
  if (!chapter) return;

  state.currentBook = book;
  state.currentChapterIndex = chapterIndex;
  state.playMode = options.playMode || "chapter";
  state.restoreTime = options.startTime || 0;

  els.playerBar.hidden = false;
  els.playerCover.src = book.cover;
  els.playerTitle.textContent = book.title;
  els.playerChapter.textContent = chapter.title;
  els.playPauseBtn.textContent = "Play";
  els.playPauseBtn.setAttribute("aria-label", "Play");
  els.audio.src = chapter.src;
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

function updateResumeUi() {
  const resume = getResume();
  const book = resume ? findBook(resume.bookId) : null;
  const chapter = book?.chapters?.[resume.chapterIndex || 0];
  const hasResume = Boolean(book && chapter);

  els.resumePanel.hidden = !hasResume;
  els.headerContinueBtn.hidden = !hasResume;
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

function deleteBook(book) {
  const confirmed = window.confirm(`Delete "${book.title}" from this library on this device?`);
  if (!confirmed) return;

  const deletedBookIds = getDeletedBookIds();
  deletedBookIds.add(book.id);
  localStorage.setItem(deletedBooksKey, JSON.stringify([...deletedBookIds]));

  const resume = getResume();
  if (resume?.bookId === book.id) localStorage.removeItem(storageKey);
  if (state.currentBook?.id === book.id) {
    els.audio.pause();
    els.audio.removeAttribute("src");
    els.audio.load();
    els.playerBar.hidden = true;
    state.currentBook = null;
  }

  state.catalog = applyDeletedBooks(state.allBooks);
  renderLibrary();
  updateResumeUi();
}

function applyDeletedBooks(books) {
  const deletedBookIds = getDeletedBookIds();
  return books.filter((book) => !deletedBookIds.has(book.id));
}

function getDeletedBookIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(deletedBooksKey) || "[]"));
  } catch {
    return new Set();
  }
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
  const title = escapeHtml(book.title || "Audiobook");
  const author = escapeHtml(book.author || book.narrator || "Listener edition");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1200">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#e7dbc5"/>
          <stop offset="0.55" stop-color="#dce5dc"/>
          <stop offset="1" stop-color="#6f8374"/>
        </linearGradient>
      </defs>
      <rect width="900" height="1200" fill="url(#g)"/>
      <circle cx="450" cy="440" r="154" fill="#fff8df" opacity="0.62"/>
      <path d="M0 735 C190 662 314 790 480 724 C650 656 760 756 900 700 L900 1200 L0 1200 Z" fill="#405d53" opacity="0.88"/>
      <text x="450" y="165" text-anchor="middle" font-family="Georgia, serif" font-size="64" fill="#24312c">${title}</text>
      <text x="450" y="245" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#415d50">${author}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
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
  if (!els.audio.src) return;
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
});

els.audio.addEventListener("pause", () => {
  els.playPauseBtn.textContent = "Play";
  els.playPauseBtn.setAttribute("aria-label", "Play");
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
  const nextIndex = state.currentChapterIndex + 1;
  if (nextIndex < state.currentBook.chapters.length) {
    loadChapter(state.currentBook, nextIndex, { playMode: "book", autoplay: true, startTime: 0 });
  }
});

els.audio.addEventListener("error", () => {
  els.playerChapter.textContent = "Audio file not found. Check the chapter src path.";
});

els.heroContinueBtn.addEventListener("click", () => continueListening(true));
els.headerContinueBtn.addEventListener("click", () => continueListening(true));
window.addEventListener("hashchange", route);

init();

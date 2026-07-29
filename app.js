const catalogSources = [
  { url: "../listener-export/data/catalog.json", assetBase: "../listener-export/" },
  { url: "./data/catalog.json", assetBase: "./" }
];
const storageKey = "audiobookSanctuary.resume.v1";

const state = {
  catalog: [],
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
  return books.map((book) => ({
    ...book,
    author: book.author || book.narrator || "",
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
        ${book.subtitle || book.description ? `<p>${escapeHtml(book.subtitle || book.description)}</p>` : ""}
        <span class="card-meta">${book.chapters.length} chapter${book.chapters.length === 1 ? "" : "s"}</span>
        <div class="card-actions">
          <button class="primary-button small-button" type="button" data-action="open-book">Listen</button>
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
}

function renderBook(book) {
  const shouldShowDescription = book.description && book.description !== book.subtitle;

  els.bookDetail.innerHTML = `
    <div class="book-heading">
      <img class="book-cover-small" src="${escapeHtml(book.cover)}" alt="">
      <div>
        ${book.author ? `<p class="eyebrow">${escapeHtml(book.author)}</p>` : ""}
        <h1>${escapeHtml(book.title)}</h1>
        ${book.subtitle ? `<h2>${escapeHtml(book.subtitle)}</h2>` : ""}
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
      loadChapter(book, Number(button.dataset.chapterIndex), { playMode: "chapter", autoplay: true, startTime: 0 });
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
  const sunX = 300 + (seed % 4) * 90;
  const sunY = 370 + ((seed >> 3) % 5) * 34;
  const sunRadius = 112 + ((seed >> 5) % 4) * 18;
  const waveA = 640 + ((seed >> 7) % 120);
  const waveB = 690 + ((seed >> 9) % 115);
  const waveC = 720 + ((seed >> 11) % 105);
  const pattern = seed % 3;
  const motif = [
    `<path d="M146 230 C210 176 276 176 340 230" fill="none" stroke="${palette[4]}" stroke-width="8" opacity="0.42"/>
     <path d="M560 230 C626 176 694 176 760 230" fill="none" stroke="${palette[2]}" stroke-width="8" opacity="0.26"/>`,
    `<circle cx="156" cy="226" r="18" fill="${palette[4]}" opacity="0.42"/>
     <circle cx="730" cy="284" r="28" fill="${palette[3]}" opacity="0.52"/>
     <circle cx="774" cy="228" r="10" fill="${palette[2]}" opacity="0.28"/>`,
    `<path d="M120 262 L172 214 L224 262" fill="none" stroke="${palette[4]}" stroke-width="7" opacity="0.42"/>
     <path d="M682 248 L734 202 L786 248" fill="none" stroke="${palette[2]}" stroke-width="7" opacity="0.26"/>`
  ][pattern];
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
      ${motif}
      <circle cx="${sunX}" cy="${sunY}" r="${sunRadius}" fill="${palette[3]}" opacity="0.66"/>
      <path d="M0 ${waveA} C150 ${waveA - 72} 290 ${waveB + 38} 460 ${waveB - 28} C636 ${waveB - 96} 736 ${waveC + 48} 900 ${waveC - 32} L900 1200 L0 1200 Z" fill="${palette[2]}" opacity="0.9"/>
      <path d="M0 ${waveA + 86} C194 ${waveA + 12} 304 ${waveB + 116} 500 ${waveB + 48} C652 ${waveB - 8} 778 ${waveC + 112} 900 ${waveC + 46}" fill="none" stroke="${palette[3]}" stroke-width="5" opacity="0.28"/>
      <text text-anchor="middle" font-family="Georgia, serif" font-size="${titleLines.length > 1 ? 58 : 66}" font-weight="600" fill="#24312c">
        ${titleMarkup}
      </text>
      <text x="450" y="${titleLines.length > 1 ? 318 : 254}" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="${palette[2]}">${author}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
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

import { fileStore } from './db.js';

const STORAGE_KEY = 'pdf_notes_meta_v1';
const state = {
  notes: [],
  view: 'grid',
  search: '',
  activeFolder: '',
  activeTag: '',
  modeFilter: 'all'
};

const el = {
  notesContainer: document.getElementById('notesContainer'),
  searchInput: document.getElementById('searchInput'),
  viewToggle: document.getElementById('viewToggle'),
  themeToggle: document.getElementById('themeToggle'),
  tagList: document.getElementById('tagList'),
  folderList: document.getElementById('folderList'),
  fileInput: document.getElementById('fileInput'),
  pickFilesBtn: document.getElementById('pickFilesBtn'),
  dropZone: document.getElementById('dropZone'),
  floatingUpload: document.getElementById('floatingUpload'),
  viewer: document.getElementById('pdfViewerModal'),
  viewerTitle: document.getElementById('viewerTitle'),
  pdfFrame: document.getElementById('pdfFrame'),
  closeViewer: document.getElementById('closeViewer'),
  navItems: [...document.querySelectorAll('.nav-item')],
  newFolderBtn: document.getElementById('newFolderBtn'),
  sidebar: document.getElementById('sidebar'),
  mobileMenuBtn: document.getElementById('mobileMenuBtn')
};

const saveMeta = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
const loadMeta = () => {
  state.notes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
};

const formatDate = (iso) => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });

function getFilteredNotes() {
  const query = state.search.toLowerCase();
  const recentThreshold = Date.now() - 1000 * 60 * 60 * 24 * 7;
  return state.notes.filter((note) => {
    const matchesSearch = [note.title, note.folder, ...(note.tags || [])].join(' ').toLowerCase().includes(query);
    const matchesFolder = !state.activeFolder || note.folder === state.activeFolder;
    const matchesTag = !state.activeTag || (note.tags || []).includes(state.activeTag);
    const recentOK = state.modeFilter !== 'recent' || new Date(note.dateAdded).getTime() >= recentThreshold;
    return matchesSearch && matchesFolder && matchesTag && recentOK;
  }).sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
}

function renderFilters() {
  const folders = [...new Set(state.notes.map((n) => n.folder).filter(Boolean))];
  el.folderList.innerHTML = folders.map((folder) => `<button class="token ${state.activeFolder === folder ? 'active' : ''}" data-folder="${folder}">${folder}</button>`).join('');

  const tags = [...new Set(state.notes.flatMap((n) => n.tags || []))];
  el.tagList.innerHTML = tags.map((tag) => `<button class="token ${state.activeTag === tag ? 'active' : ''}" data-tag="${tag}">#${tag}</button>`).join('');
}

function emptyState() {
  el.notesContainer.innerHTML = `
    <article class="empty-state glass-panel">
      <h3>no files</h3>
      <p>upload pdf to begin</p>
    </article>
  `;
}

function renderNotes() {
  const notes = getFilteredNotes();
  el.notesContainer.classList.toggle('list', state.view === 'list');
  [...el.viewToggle.children].forEach((child) => child.classList.toggle('active', child.dataset.view === state.view));

  if (!notes.length) return emptyState();
  const template = document.getElementById('noteCardTemplate');
  el.notesContainer.innerHTML = '';

  notes.forEach((note) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector('.note-card');
    fragment.querySelector('.thumbnail').src = note.thumbnail || '';
    fragment.querySelector('.title').textContent = note.title;
    fragment.querySelector('.date').textContent = `+ ${formatDate(note.dateAdded)}`;
    fragment.querySelector('.folder').textContent = note.folder ? `dir/${note.folder}` : 'dir/none';
    fragment.querySelector('.tags').innerHTML = (note.tags || []).map((t) => `<span class="token">#${t}</span>`).join('');

    fragment.querySelector('.open-btn').addEventListener('click', () => openViewer(note));
    fragment.querySelector('.rename-btn').addEventListener('click', () => renameNote(note.id));
    fragment.querySelector('.delete-btn').addEventListener('click', () => deleteNote(note.id));

    card.dataset.id = note.id;
    el.notesContainer.appendChild(fragment);
  });
}

async function generatePdfThumbnail(file) {
  if (!globalThis.pdfjsLib) return '';
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.7.76/pdf.worker.min.mjs';
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 0.55 });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.85);
}

async function createNotesFromFiles(files) {
  for (const file of files) {
    if (file.type !== 'application/pdf') continue;
    const title = file.name.replace(/\.pdf$/i, '');
    const folder = prompt('folder (optional):', '') || '';
    const tagsInput = prompt('tags (comma optional):', '') || '';
    const note = {
      id: crypto.randomUUID(),
      title,
      dateAdded: new Date().toISOString(),
      tags: tagsInput.split(',').map((tag) => tag.trim()).filter(Boolean),
      folder,
      thumbnail: await generatePdfThumbnail(file)
    };
    await fileStore.put(note.id, file);
    state.notes.push(note);
  }
  saveMeta();
  renderFilters();
  renderNotes();
}

async function openViewer(note) {
  const file = await fileStore.get(note.id);
  if (!file) return alert('missing file in storage');
  const url = URL.createObjectURL(file);
  el.viewerTitle.textContent = note.title;
  el.pdfFrame.src = url;
  el.viewer.showModal();
  el.viewer.onclose = () => URL.revokeObjectURL(url);
}

function renameNote(id) {
  const note = state.notes.find((n) => n.id === id);
  if (!note) return;
  const nextTitle = prompt('rename:', note.title);
  if (!nextTitle) return;
  note.title = nextTitle.trim();
  const nextFolder = prompt('folder:', note.folder || '') || '';
  note.folder = nextFolder;
  const nextTags = prompt('tags:', (note.tags || []).join(', ')) || '';
  note.tags = nextTags.split(',').map((x) => x.trim()).filter(Boolean);
  saveMeta();
  renderFilters();
  renderNotes();
}

async function deleteNote(id) {
  const ok = confirm('delete note?');
  if (!ok) return;
  state.notes = state.notes.filter((n) => n.id !== id);
  await fileStore.delete(id);
  saveMeta();
  renderFilters();
  renderNotes();
}

function wireEvents() {
  el.searchInput.addEventListener('input', (e) => {
    state.search = e.target.value;
    renderNotes();
  });

  el.viewToggle.addEventListener('click', (e) => {
    const tab = e.target.closest('span[data-view]');
    if (!tab) return;
    state.view = tab.dataset.view;
    renderNotes();
  });

  el.themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
  });

  el.pickFilesBtn.addEventListener('click', () => el.fileInput.click());
  el.floatingUpload.addEventListener('click', () => el.fileInput.click());
  el.fileInput.addEventListener('change', async (e) => {
    await createNotesFromFiles([...e.target.files]);
    e.target.value = '';
  });

  ['dragenter', 'dragover'].forEach((type) => {
    el.dropZone.addEventListener(type, (e) => {
      e.preventDefault();
      el.dropZone.classList.add('dragging');
    });
  });

  ['dragleave', 'drop'].forEach((type) => {
    el.dropZone.addEventListener(type, () => el.dropZone.classList.remove('dragging'));
  });

  el.dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    await createNotesFromFiles([...e.dataTransfer.files]);
  });

  el.folderList.addEventListener('click', (e) => {
    const button = e.target.closest('[data-folder]');
    if (!button) return;
    state.activeFolder = state.activeFolder === button.dataset.folder ? '' : button.dataset.folder;
    renderFilters();
    renderNotes();
  });

  el.tagList.addEventListener('click', (e) => {
    const button = e.target.closest('[data-tag]');
    if (!button) return;
    state.activeTag = state.activeTag === button.dataset.tag ? '' : button.dataset.tag;
    renderFilters();
    renderNotes();
  });

  el.navItems.forEach((item) => {
    item.addEventListener('click', () => {
      el.navItems.forEach((x) => x.classList.remove('active'));
      item.classList.add('active');
      state.modeFilter = item.dataset.filter;
      renderNotes();
    });
  });

  el.newFolderBtn.addEventListener('click', () => {
    const name = prompt('new folder:');
    if (!name) return;
    state.activeFolder = name.trim();
    renderFilters();
    renderNotes();
  });

  el.closeViewer.addEventListener('click', () => el.viewer.close());
  el.mobileMenuBtn.addEventListener('click', () => el.sidebar.classList.toggle('open'));
}

loadMeta();
renderFilters();
renderNotes();
wireEvents();

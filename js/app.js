/* ==========
  Nhật ký GV – app.js
  Lưu trữ localStorage, hỗ trợ tag, lọc, LaTeX preview, export/import JSON
========== */

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

// --------- State ---------
let state = {
  notes: [],               // {id,title,content,mode,class,student,tags[],date,pinned,createdAt,updatedAt}
  filters: {
    mode: 'all',           // all | cn | toan
    classes: [],           // ['10A8', '11A2']
    tags: [],              // ['#vi_pham','khen_thuong']
    pinnedOnly: false,
    todayOnly: false,
    hasStudentOnly: false,
    q: ''
  },
  ui: {
    theme: localStorage.getItem('theme') || 'dark',
    selectedId: null,
    sidebarOpen: false
  }
};

// Sample initial data for first run
const SAMPLE_NOTES = [
  {
    id: self.crypto ? crypto.randomUUID() : String(Date.now())+'-1',
    title: "Sinh hoạt lớp tuần 5",
    content: "1) Tổng kết chuyên cần tuần qua.\n2) Khen thưởng nhóm trực nhật.\n3) Nhắc nhở **đồng phục**.\n\n#chu_nhiem #10A8",
    mode: "cn", class: "10A8", student: "", tags: ["#chu_nhiem","#10A8"],
    date: new Date().toISOString().slice(0,10), pinned: true,
    createdAt: Date.now(), updatedAt: Date.now()
  },
  {
    id: self.crypto ? crypto.randomUUID() : String(Date.now())+'-2',
    title: "Toán 12 – Tích phân: ví dụ minh hoạ",
    content: "Tính $$\\int_0^1 x^2\\,dx$$. Gợi ý: \\(\\frac{1}{3}\\).\n\n#toan #tich_phan #12",
    mode: "toan", class: "12", student: "", tags: ["#toan","#tich_phan","#12"],
    date: new Date().toISOString().slice(0,10), pinned: false,
    createdAt: Date.now(), updatedAt: Date.now()
  }
];

// --------- Persistence ---------
function load() {
  const raw = localStorage.getItem('gv_notes_v1');
  if (raw) {
    try { state.notes = JSON.parse(raw); }
    catch(e){ console.warn(e); state.notes = SAMPLE_NOTES; }
  } else {
    state.notes = SAMPLE_NOTES;
    save();
  }
  applyTheme(state.ui.theme);
}
function save() {
  localStorage.setItem('gv_notes_v1', JSON.stringify(state.notes));
}

// --------- Utilities ---------
function uniq(arr){ return [...new Set(arr)].filter(Boolean); }
function parseTagsFromContent(text){
  return uniq((text.match(/#[\p{L}\w-]+/gu)||[]).map(s=>s.trim()));
}
function excerpt(text, n=160){
  const t = text.replace(/\s+/g,' ').trim();
  return t.length>n ? t.slice(0,n-1)+'…' : t;
}
function fmtDate(ts){
  const d = new Date(ts);
  return d.toLocaleString('vi-VN');
}

// --------- Rendering ---------
function renderChips(){
  const classes = uniq(state.notes.map(n=>n.class).filter(Boolean)).sort();
  const tags = uniq(state.notes.flatMap(n=>n.tags||[])).sort();

  const classChips = $("#classChips");
  classChips.innerHTML = "";
  classes.forEach(c => {
    const el = document.createElement('button');
    el.className = 'chip'+(state.filters.classes.includes(c)?' active':'');
    el.textContent = c;
    el.addEventListener('click', ()=>{
      const idx = state.filters.classes.indexOf(c);
      if (idx>-1) state.filters.classes.splice(idx,1);
      else state.filters.classes.push(c);
      renderAll();
    });
    classChips.appendChild(el);
  });

  const tagChips = $("#tagChips");
  tagChips.innerHTML = "";
  tags.forEach(t => {
    const el = document.createElement('button');
    el.className = 'chip'+(state.filters.tags.includes(t)?' active':'');
    el.textContent = t;
    el.addEventListener('click', ()=>{
      const idx = state.filters.tags.indexOf(t);
      if (idx>-1) state.filters.tags.splice(idx,1);
      else state.filters.tags.push(t);
      renderAll();
    });
    tagChips.appendChild(el);
  });
}

function filteredNotes(){
  const f = state.filters;
  const today = new Date().toISOString().slice(0,10);
  return state.notes.filter(n=>{
    if (f.mode!=='all' && n.mode!==f.mode) return false;
    if (f.classes.length && !f.classes.includes(n.class)) return false;
    if (f.tags.length && !n.tags?.some(t=>f.tags.includes(t))) return false;
    if (f.pinnedOnly && !n.pinned) return false;
    if (f.todayOnly && n.date!==today) return false;
    if (f.hasStudentOnly && !n.student) return false;
    if (f.q){
      const q = f.q.toLowerCase();
      const text = [n.title, n.content, n.class, n.student, (n.tags||[]).join(' ')].join(' ').toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  }).sort((a,b)=> (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));
}

function renderList(){
  const list = $("#noteList");
  const notes = filteredNotes();
  list.innerHTML = "";
  const tpl = $("#noteItemTpl");
  if (!notes.length){
    list.innerHTML = `<p style="opacity:.7">Chưa có ghi chú nào khớp bộ lọc.</p>`;
    return;
  }
  notes.forEach(n=>{
    const node = tpl.content.cloneNode(true);
    node.querySelector('.title').textContent = n.title + (n.pinned?' 📍':'');
    node.querySelector('.meta-line').textContent = `${n.mode==='cn'?'Chủ nhiệm':'Toán'} • Lớp ${n.class||'—'} • ${n.date||'—'} • Cập nhật ${fmtDate(n.updatedAt)}`;
    node.querySelector('.excerpt').textContent = excerpt(n.content);
    const card = node.querySelector('.note-card');
    card.dataset.id = n.id;
    node.querySelector('.btn-edit').addEventListener('click', ()=> openEditor(n.id));
    node.querySelector('.btn-dup').addEventListener('click', ()=> duplicateNote(n.id));
    node.querySelector('.btn-pin').addEventListener('click', ()=> togglePin(n.id));
    node.querySelector('.btn-del').addEventListener('click', ()=> deleteNote(n.id));
    list.appendChild(node);
  });
}

function renderEditor(n=null){
  $("#editor").classList.remove('hidden');
  if (!n){
    $("#noteTitle").value = "";
    $("#noteContent").value = "";
    $("#noteMode").value = "cn";
    $("#noteClass").value = "";
    $("#noteStudent").value = "";
    $("#noteTags").value = "";
    $("#noteDate").valueAsDate = new Date();
    $("#preview").classList.add('hidden');
    $("#btnPin").dataset.active = "false";
    state.ui.selectedId = null;
    return;
  }
  $("#noteTitle").value = n.title || "";
  $("#noteContent").value = n.content || "";
  $("#noteMode").value = n.mode || "cn";
  $("#noteClass").value = n.class || "";
  $("#noteStudent").value = n.student || "";
  $("#noteTags").value = (n.tags||[]).join(", ");
  $("#noteDate").value = n.date || new Date().toISOString().slice(0,10);
  $("#btnPin").dataset.active = n.pinned ? "true" : "false";
  state.ui.selectedId = n.id;
}

function renderAll(){
  renderChips();
  renderList();
}

function openEditor(id){
  const n = state.notes.find(x=>x.id===id);
  renderEditor(n);
}
function togglePin(id){
  const n = state.notes.find(x=>x.id===id);
  if (!n) return;
  n.pinned = !n.pinned;
  n.updatedAt = Date.now();
  save(); renderAll();
}
function duplicateNote(id){
  const n = state.notes.find(x=>x.id===id);
  if (!n) return;
  const copy = {...n, id: (self.crypto?crypto.randomUUID():String(Date.now())+'-copy'), title: n.title + " (bản sao)", pinned:false, createdAt: Date.now(), updatedAt: Date.now()};
  state.notes.unshift(copy);
  save(); renderAll();
}
function deleteNote(id){
  if (!confirm("Xoá ghi chú này?")) return;
  state.notes = state.notes.filter(x=>x.id!==id);
  save(); renderAll();
}

function applyTheme(theme){
  document.documentElement.classList.toggle('light', theme==='light');
  state.ui.theme = theme;
  localStorage.setItem('theme', theme);
}

// --------- Event bindings ---------
function bindEvents(){
  // Sidebar show/hide on mobile
  $("#btnMenu").addEventListener('click', ()=>{
    $("#sidebar").classList.toggle('open');
  });

  // Mode pills
  $$(".pill").forEach(p => {
    p.addEventListener('click', ()=>{
      $$(".pill").forEach(x=>x.classList.remove('active'));
      p.classList.add('active');
      state.filters.mode = p.dataset.mode;
      renderAll();
    });
  });

  // Search
  $("#searchInput").addEventListener('input', (e)=>{
    state.filters.q = e.target.value.trim();
    renderAll();
  });

  // Quick filters
  $("#filterPinned").addEventListener('change', e=>{ state.filters.pinnedOnly = e.target.checked; renderAll(); });
  $("#filterToday").addEventListener('change', e=>{ state.filters.todayOnly = e.target.checked; renderAll(); });
  $("#filterHasStudent").addEventListener('change', e=>{ state.filters.hasStudentOnly = e.target.checked; renderAll(); });

  // Accordion
  $$(".acc-header").forEach(h => {
    h.addEventListener('click', ()=> h.nextElementSibling.classList.toggle('hidden'));
  });

  // New note
  $("#btnNew").addEventListener('click', ()=> renderEditor(null));

  // Save / Close / Pin
  $("#btnSave").addEventListener('click', saveFromEditor);
  $("#btnClose").addEventListener('click', ()=> $("#editor").classList.add('hidden'));
  $("#btnPin").addEventListener('click', ()=>{
    const cur = $("#btnPin").dataset.active === "true";
    $("#btnPin").dataset.active = (!cur).toString();
  });

  // Preview
  $("#btnPreview").addEventListener('click', ()=>{
    const content = $("#noteContent").value;
    const preview = $("#preview");
    preview.classList.remove('hidden');
    preview.innerHTML = markdownToHTML(content);
    if (window.MathJax) MathJax.typesetPromise([preview]);
  });

  // Export / Import
  $("#btnExport").addEventListener('click', doExport);
  $("#importInput").addEventListener('change', doImport);

  // Print
  $("#btnPrint").addEventListener('click', ()=> window.print());

  // Theme
  $("#btnTheme").addEventListener('click', ()=> applyTheme(state.ui.theme==='dark'?'light':'dark'));
}

function saveFromEditor(){
  const id = state.ui.selectedId;
  const note = {
    id: id || (self.crypto?crypto.randomUUID():String(Date.now())),
    title: $("#noteTitle").value.trim(),
    content: $("#noteContent").value,
    mode: $("#noteMode").value,
    class: $("#noteClass").value.trim(),
    student: $("#noteStudent").value.trim(),
    tags: uniq($("#noteTags").value.split(',').map(s=>s.trim()).filter(Boolean).concat(parseTagsFromContent($("#noteContent").value))),
    date: $("#noteDate").value || new Date().toISOString().slice(0,10),
    pinned: $("#btnPin").dataset.active === "true",
    createdAt: id ? (state.notes.find(n=>n.id===id)?.createdAt || Date.now()) : Date.now(),
    updatedAt: Date.now()
  };
  if (!note.title) { alert("Vui lòng nhập tiêu đề."); return; }
  const idx = state.notes.findIndex(n=>n.id===note.id);
  if (idx>-1) state.notes[idx] = note;
  else state.notes.unshift(note);
  save();
  renderAll();
  $("#editor").classList.add('hidden');
}

// --------- Import/Export ---------
function doExport(){
  const data = JSON.stringify({exportedAt: new Date().toISOString(), notes: state.notes}, null, 2);
  const blob = new Blob([data], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gv-notes-export.json';
  a.click();
  URL.revokeObjectURL(url);
}

function doImport(e){
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (Array.isArray(data)) {
        state.notes = data;
      } else if (Array.isArray(data.notes)) {
        state.notes = data.notes;
      } else {
        throw new Error("JSON không đúng định dạng.");
      }
      save(); renderAll();
      alert("Nhập dữ liệu thành công!");
    } catch(err){
      alert("Lỗi khi nhập JSON: " + err.message);
    }
  };
  reader.readAsText(file);
}

// --------- Minimal Markdown parser (very small) ---------
function markdownToHTML(md){
  // Very tiny subset: **bold**, *italic*, [text](url), line breaks
  let html = md
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g,'<br/>');
  return html;
}

// --------- Init ---------
load();
bindEvents();
renderAll();

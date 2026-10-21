/* ===================================================
   app.js - رفيق الجامعة UniMate
   الشاشات، المنطق، التنبيهات، المؤقت.
   الإصدار 1.0.0 - تصميم وتطوير: سامي الصلاحي
=================================================== */

const APP_VERSION = '1.0.0';
const DEV = { name: 'سامي الصلاحي', phone: '772798471' };
const DAYS = ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];

/* ---------- الإعدادات الافتراضية ---------- */
const DEFAULT_SETTINGS = {
  theme: 'dark',              // dark | light | system
  accent: '#6c5ce7',
  bg: 'books',                // books | pencils | none
  weekStart: 0,               // أول يوم يظهر في الأسبوع (0 = السبت)
  timeFormat: '24',           // 24 | 12
  pomoWork: 25,
  pomoBreak: 5,
  leadMin: 10,                // دقائق التنبيه قبل المحاضرة/الجلسة
  absenceDefault: 25,         // الحد الافتراضي للغياب (%)، قابل للتعديل لكل مادة
  maxStudyPerSubject: 120,    // أقصى دقائق لمادة واحدة في يوم
  fontScale: 100,
  termStart: '',
  termEnd: '',
  dailyTime: '07:00',
  notif: { lecture:true, lectureStart:true, attend:true, taskDue:true, taskLate:true, study:true, exam:true, absence:true, daily:true }
};
const ACCENTS = ['#6c5ce7','#0984e3','#00b894','#e17055','#d63031'];
const STATUS_ATT = ['حاضر','غائب','متأخر','ملغاة'];
const TASK_STATUS = ['لم يبدأ','قيد التنفيذ','مكتمل','تم التسليم'];
const PRIORITY = ['مرتفعة','متوسطة','منخفضة'];
const PRI_RANK = { 'مرتفعة':0, 'متوسطة':1, 'منخفضة':2 };
const BG_SVG = {
  books: '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420"><rect x="20" y="40" width="28" height="150" fill="#6c5ce7"/><rect x="50" y="40" width="22" height="150" fill="#00b894"/><rect x="74" y="60" width="30" height="130" fill="#e17055"/><rect x="280" y="90" width="26" height="120" fill="#d63031"/><rect x="200" y="270" width="160" height="26" fill="#0984e3" transform="rotate(-8 280 283)"/><rect x="210" y="298" width="150" height="22" fill="#fdcb6e" transform="rotate(-8 285 309)"/></svg>',
  pencils: '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420"><g transform="rotate(-30 120 120)"><rect x="40" y="110" width="150" height="20" fill="#fdcb6e"/><polygon points="190,110 215,120 190,130" fill="#e17055"/></g><g transform="rotate(25 300 300)"><rect x="240" y="290" width="150" height="20" fill="#00b894"/><polygon points="390,290 415,300 390,310" fill="#6c5ce7"/></g><circle cx="330" cy="80" r="12" fill="#0984e3"/><circle cx="90" cy="330" r="10" fill="#d63031"/></svg>'
};

/* ---------- مساعدات عامة ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2, '0');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseYMD = s => { const [y,m,d] = (s || '').split('-').map(Number); return new Date(y, (m||1)-1, d||1); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => ymd(new Date());
const dayIdx = d => (d.getDay() + 1) % 7;                 // 0 = السبت ... 6 = الجمعة
const toMin = t => { const [h,m] = (t || '0:0').split(':').map(Number); return h*60 + m; };
const nowMin = () => { const d = new Date(); return d.getHours()*60 + d.getMinutes(); };
const diffDays = (a, b) => Math.round((parseYMD(b) - parseYMD(a)) / 86400000);
const fmtT = t => {
  if (!t) return '';
  if (C.settings.timeFormat !== '12') return t;
  const [h,m] = t.split(':').map(Number);
  return `${h%12 || 12}:${pad(m)} ${h < 12 ? 'ص' : 'م'}`;
};
const fmtDate = d => d.toLocaleDateString('ar', { weekday:'long', day:'numeric', month:'long' });
const fmtShort = s => s ? parseYMD(s).toLocaleDateString('ar', { weekday:'short', day:'numeric', month:'short' }) : '—';
const startOfWeek = d => addDays(d, -((dayIdx(d) - C.settings.weekStart + 7) % 7));
const isDone = t => t.status === 'مكتمل' || t.status === 'تم التسليم';
const clamp = (n, a=0, b=100) => Math.max(a, Math.min(b, n));
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const bar = (p, color) => `<div class="bar"><span style="width:${clamp(p)}%;${color ? 'background:'+color : ''}"></span></div>`;

/* ---------- الحالة ---------- */
const C = {
  profile: null,
  settings: { ...DEFAULT_SETTINGS },
  subjects: [], lectures: [], attendance: [], tasks: [],
  sessions: [], notes: [], exams: [], notifications: [],
  fired: new Set()
};
const V = {
  schedView: 'day',
  schedDate: today(),
  taskTab: 'today',
  studyWeek: ymd(new Date()),
  calMonth: ymd(new Date()),
  calDay: today(),
  notesQ: '',
  notesSub: '',
  attPeriod: 'week',
  pendingPhoto: null
};

/* ---------- تحميل البيانات وحفظها ---------- */
async function loadAll(){
  const all = {};
  for (const s of ['profile','settings','subjects','lectures','attendance','tasks','sessions','notes','exams','notifications','fired']) {
    all[s] = await DB.all(s);
  }
  C.profile = all.profile.find(p => p.id === 'me') || null;
  const st = all.settings.find(x => x.id === 'main') || {};
  C.settings = { ...DEFAULT_SETTINGS, ...st, notif: { ...DEFAULT_SETTINGS.notif, ...(st.notif || {}) } };
  C.subjects = all.subjects; C.lectures = all.lectures; C.attendance = all.attendance;
  C.tasks = all.tasks; C.sessions = all.sessions; C.notes = all.notes;
  C.exams = all.exams; C.notifications = all.notifications;
  C.fired = new Set(all.fired.map(x => x.id));
}
async function save(store, obj){ await DB.put(store, obj); await loadAll(); render(); }
async function remove(store, id){ await DB.del(store, id); await loadAll(); render(); }
async function saveSettings(patch){ C.settings = { ...C.settings, ...patch }; await DB.put('settings', { ...C.settings, id:'main' }); await loadAll(); render(); }

/* ---------- الاستعلامات ---------- */
const subById = id => C.subjects.find(s => s.id === id);
const subName = id => subById(id)?.name || 'عام';
const subColor = id => subById(id)?.color || '#6c5ce7';
const subLimit = id => (subById(id)?.absenceLimit ?? C.settings.absenceDefault);
const lecturesOn = idx => C.lectures.filter(l => l.day === idx).sort((a,b) => toMin(a.start) - toMin(b.start));
const attOf = (lecId, date) => C.attendance.find(a => a.id === lecId + '|' + date);
const sessionsOn = d => C.sessions.filter(s => s.date === d).sort((a,b) => (a.start||'').localeCompare(b.start||''));

// إحصاءات الحضور لكل مادة ضمن فلتر زمني
function attStats(filter = () => true){
  const by = {};
  C.attendance.filter(filter).forEach(a => {
    if (a.status === 'ملغاة') return;
    const lec = C.lectures.find(l => l.id === a.lectureId);
    if (!lec) return;
    const k = lec.subjectId || '_';
    by[k] = by[k] || { id:k, name:subName(lec.subjectId), color:subColor(lec.subjectId), total:0, att:0, abs:0, late:0 };
    const b = by[k];
    b.total++;
    if (a.status === 'حاضر') b.att++;
    if (a.status === 'غائب') b.abs++;
    if (a.status === 'متأخر') b.late++;
  });
  Object.values(by).forEach(b => {
    b.rate = pct(b.att + b.late, b.total);
    b.absPct = pct(b.abs, b.total);
    b.limit = b.id === '_' ? C.settings.absenceDefault : subLimit(b.id);
  });
  return by;
}
function attPeriodFilter(){
  const t = today();
  if (V.attPeriod === 'week') { const from = ymd(addDays(new Date(), -7)); return a => a.date >= from && a.date <= t; }
  if (V.attPeriod === 'month') { const m = t.slice(0,7); return a => a.date.startsWith(m); }
  if (V.attPeriod === 'term') {
    const s = C.settings.termStart || '0000-00-00', e = C.settings.termEnd || '9999-12-31';
    return a => a.date >= s && a.date <= e;
  }
  return () => true;
}

function taskGroup(tab){
  const t = today(), wk = ymd(addDays(new Date(), 7));
  return C.tasks.filter(x => {
    const done = isDone(x);
    if (tab === 'done') return done;
    if (done) return false;
    if (tab === 'today') return x.dueDate === t || (!x.dueDate && x.receivedDate === t);
    if (tab === 'week') return x.dueDate > t && x.dueDate <= wk;
    if (tab === 'late') return x.dueDate && x.dueDate < t;
    if (tab === 'upcoming') return !x.dueDate || x.dueDate > wk;
    return true;
  }).sort((a,b) => (PRI_RANK[a.priority] ?? 1) - (PRI_RANK[b.priority] ?? 1) || (a.dueDate||'9999').localeCompare(b.dueDate||'9999'));
}

/* ===================================================
   التنبيهات
=================================================== */
async function notify(type, title, body){
  const n = { id: uid(), type, title, body, createdAt: new Date().toISOString(), read: false };
  await DB.put('notifications', n);
  C.notifications.push(n);
  toast(title + ': ' + body);
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body }); } catch(e) {}
  }
  updateBadge();
}

async function runAlerts(){
  if (!C.profile) return;
  const s = C.settings, t = today(), now = nowMin(), idx = dayIdx(new Date());
  const fire = async (key, type, title, body) => {
    if (C.fired.has(key)) return;
    C.fired.add(key);
    await DB.put('fired', { id: key });
    if (s.notif[type] !== false) await notify(type, title, body);
  };

  // المحاضرات
  for (const l of lecturesOn(idx)) {
    const st = toMin(l.start), en = toMin(l.end), name = subName(l.subjectId);
    if (now >= st - s.leadMin && now < st)
      await fire(`lead-${l.id}-${t}`, 'lecture', 'محاضرة قريبة', `${name} تبدأ بعد ${st - now} دقيقة${l.hall ? ' في ' + l.hall : ''}`);
    if (now >= st && now < st + 2)
      await fire(`start-${l.id}-${t}`, 'lectureStart', 'بدأت المحاضرة', `${name} الآن`);
    if (now >= en && now < en + 180 && !attOf(l.id, t))
      await fire(`att-${l.id}-${t}`, 'attend', 'سجّل حضورك', `هل حضرت ${name}؟ سجّل الحالة الآن`);
  }

  // التكاليف
  for (const k of C.tasks.filter(x => !isDone(x) && x.dueDate)) {
    const dd = diffDays(t, k.dueDate);
    if (dd < 0) await fire(`late-${k.id}-${t}`, 'taskLate', 'تكليف متأخر', `${k.title} تجاوز موعد التسليم`);
    else if (dd <= (k.reminderDays ?? 1))
      await fire(`due-${k.id}-${t}`, 'taskDue', 'تذكير تكليف', dd === 0 ? `${k.title} موعد تسليمه اليوم` : `${k.title} يُسلَّم بعد ${dd} يوم`);
  }

  // جلسات المذاكرة
  for (const x of C.sessions.filter(x => x.date === t && x.status === 'planned' && x.start)) {
    const st = toMin(x.start);
    if (now >= st - s.leadMin && now < st + 5)
      await fire(`study-${x.id}-${t}`, 'study', 'جلسة مذاكرة', `${subName(x.subjectId)}: ${x.topic || x.goal || 'حان وقت المذاكرة'}`);
  }

  // الاختبارات
  for (const e of C.exams) {
    const dd = diffDays(t, e.date);
    if (dd === 1) await fire(`exam1-${e.id}`, 'exam', 'اختبار غداً', `${e.title} - ${subName(e.subjectId)}`);
    if (dd === 0) await fire(`exam0-${e.id}-${t}`, 'exam', 'اختبار اليوم', `${e.title} - ${subName(e.subjectId)}`);
  }

  // اقتراب تجاوز حد الغياب
  Object.values(attStats()).forEach(async v => {
    if (v.total < 3) return;
    if (v.absPct >= v.limit * 0.8)
      await fire(`abs-${v.id}-${t}`, 'absence', 'تنبيه الغياب', `نسبة غيابك في ${v.name} ${v.absPct}% والحد المسموح ${v.limit}%`);
  });

  // ملخص يومي
  if (now >= toMin(s.dailyTime)) {
    const due = C.tasks.filter(x => !isDone(x) && x.dueDate === t).length;
    await fire(`daily-${t}`, 'daily', 'ملخص اليوم', `${lecturesOn(idx).length} محاضرة و${due} تكليف مستحق اليوم`);
  }
  updateBadge();
}

function unreadCount(){ return C.notifications.filter(n => !n.read).length; }
function updateBadge(){
  const el = $('#moreBadge');
  if (!el) return;
  const n = unreadCount();
  el.textContent = n > 9 ? '9+' : n;
  el.style.display = n ? 'inline-flex' : 'none';
}

function toast(msg){
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

/* ===================================================
   المظهر
=================================================== */
function applyTheme(){
  const s = C.settings;
  const dark = s.theme === 'dark' || (s.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.setProperty('--accent', s.accent);
  document.documentElement.style.fontSize = s.fontScale + '%';
  const bg = BG_SVG[s.bg];
  $('#bgLayer').style.backgroundImage = bg ? `url("data:image/svg+xml,${encodeURIComponent(bg)}")` : 'none';
  document.querySelector('meta[name=theme-color]').content = s.accent;
}

/* ===================================================
   التوجيه والعرض
=================================================== */
const TABS = [
  { k:'home', i:'🏠', n:'الرئيسية' },
  { k:'schedule', i:'📚', n:'الجدول' },
  { k:'tasks', i:'📝', n:'التكاليف' },
  { k:'study', i:'🧠', n:'المذاكرة' },
  { k:'more', i:'☰', n:'المزيد' }
];
const MORE = [
  ['attendance','📋','سجل الحضور'], ['subjects','📘','المواد'], ['pomodoro','⏱','المؤقت'],
  ['calendar','🗓','التقويم'], ['exams','🎯','الاختبارات'], ['notes','✏️','الملاحظات'],
  ['notifications','🔔','التنبيهات'], ['stats','📊','الإحصائيات'], ['profile','👤','الملف الشخصي'],
  ['settings','⚙️','الإعدادات'], ['help','ℹ️','المساعدة والمعلومات']
];

function currentRoute(){
  const r = (location.hash || '').replace(/^#\/?/, '');
  if (!C.profile) return r === 'profile' ? 'profile' : 'welcome';
  return r || 'home';
}

function render(){
  applyTheme();
  const full = currentRoute();
  const [name, arg] = full.split('/');
  const nav = $('#nav');
  const app = $('#app');
  const hideNav = name === 'welcome' || name === 'profile' && !C.profile;
  nav.style.display = hideNav ? 'none' : '';

  const views = {
    welcome: vWelcome, profile: vProfile, home: vHome, schedule: vSchedule, tasks: vTasks,
    study: vStudy, more: vMore, attendance: vAttendance, subjects: vSubjects, subject: vSubject,
    pomodoro: vPomodoro, calendar: vCalendar, exams: vExams, notes: vNotes,
    notifications: vNotifications, stats: vStats, settings: vSettings, help: vHelp
  };
  const fn = views[name] || vHome;
  app.innerHTML = fn(arg);

  const activeTab = ['schedule','tasks','study','home'].includes(name) ? name : (name === 'more' ? 'more' : '');
  nav.innerHTML = TABS.map(t => {
    const on = (t.k === activeTab) || (t.k === 'more' && !activeTab && name !== 'welcome' && name !== 'profile');
    return `<a href="#/${t.k}" class="${on ? 'on' : ''}"><span class="ic">${t.i}</span>${t.n}${t.k === 'more' ? '<span class="dot" id="moreBadge" style="display:none"></span>' : ''}</a>`;
  }).join('');
  updateBadge();
  afterRender(name);
}

function afterRender(name){
  if (name === 'pomodoro') updatePomoUI();
}

window.addEventListener('hashchange', render);

/* ===================================================
   المودال
=================================================== */
function openModal(title, body){
  $('#modal').innerHTML = `
    <div class="sheet-bg" data-act="close"></div>
    <div class="sheet" role="dialog">
      <div class="sheet-head"><b>${title}</b><button class="btn ghost small" type="button" data-act="close">✕</button></div>
      <div class="sheet-body">${body}</div>
    </div>`;
}
function closeModal(){ $('#modal').innerHTML = ''; }

/* ===================================================
   الشاشات
=================================================== */

/* --- الترحيب --- */
function vWelcome(){
  return `
  <div class="welcome"><div class="card">
    <div class="logo">🎓</div>
    <h1>رفيق الجامعة</h1>
    <div class="slogan">نظّم دراستك، واستثمر وقتك، وحقق هدفك.</div>
    <p>تطبيق يساعدك على تنظيم الجدول والحضور والتكاليف والمذاكرة في مكان واحد، وتعمل بياناتك على جهازك.</p>
    <a class="btn block" href="#/profile">ابدأ رحلتك الجامعية</a>
  </div></div>`;
}

/* --- الملف الشخصي --- */
function vProfile(){
  const p = C.profile || {};
  const photo = V.pendingPhoto ?? p.photo ?? '';
  return `
  <div class="page-title">${C.profile ? 'الملف الشخصي' : 'إعداد ملفك الجامعي'}</div>
  <div class="page-sub">${C.profile ? 'عدّل بياناتك في أي وقت' : 'أدخل بياناتك مرة واحدة، وسنحفظها لك'}</div>
  <div class="card">
    <div class="flex" style="align-items:center;margin-bottom:14px">
      <div class="photo">${photo ? `<img src="${photo}" alt="">` : '👤'}</div>
      <div class="grow">
        <label>صورة شخصية (اختيارية)</label>
        <input type="file" accept="image/*" id="photoInput" data-act="photoPick">
      </div>
    </div>
    <form data-form="profile">
      <label>الاسم الكامل</label><input name="name" required value="${esc(p.name)}">
      <div class="row">
        <div><label>العمر</label><input name="age" type="number" min="15" max="80" required value="${esc(p.age)}"></div>
        <div><label>المستوى الدراسي</label>
          <select name="level">${['الأول','الثاني','الثالث','الرابع','الخامس','السادس','متقدم'].map(l=>`<option ${p.level===l?'selected':''}>${l}</option>`).join('')}</select>
        </div>
      </div>
      <label>اسم الجامعة</label><input name="university" required value="${esc(p.university)}">
      <div class="row">
        <div><label>الكلية</label><input name="faculty" required value="${esc(p.faculty)}"></div>
        <div><label>التخصص</label><input name="major" required value="${esc(p.major)}"></div>
      </div>
      <button class="btn block" type="submit">${C.profile ? 'حفظ التعديلات' : 'ابدأ رحلتك الجامعية'}</button>
    </form>
  </div>`;
}

/* --- الرئيسية --- */
function vHome(){
  const t = today(), idx = dayIdx(new Date()), nm = nowMin();
  const todays = lecturesOn(idx);
  const todayAtt = C.attendance.filter(a => a.date === t);
  const attended = todayAtt.filter(a => a.status === 'حاضر' || a.status === 'متأخر').length;
  const absent = todayAtt.filter(a => a.status === 'غائب').length;
  const remaining = todays.filter(l => toMin(l.start) > nm && !attOf(l.id, t)).length;

  const dueToday = C.tasks.filter(x => x.dueDate === t);
  const soon = C.tasks.filter(x => !isDone(x) && x.dueDate && x.dueDate >= t && x.dueDate <= ymd(addDays(new Date(), 3)))
                      .sort((a,b) => a.dueDate.localeCompare(b.dueDate));
  const pendingAll = C.tasks.filter(x => !isDone(x)).length;

  const sToday = sessionsOn(t);
  const doneSessions = sToday.filter(x => x.status === 'completed').length;
  const doneTasks = dueToday.filter(isDone).length;
  const itemsToday = sToday.length + dueToday.length;
  const dailyPct = pct(doneSessions + doneTasks, itemsToday);

  const nextSession = C.sessions.filter(x => x.status === 'planned' && (x.date > t || (x.date === t && (!x.start || toMin(x.start) >= nm))))
                       .sort((a,b) => (a.date+(a.start||'')).localeCompare(b.date+(b.start||'')))[0];
  const nextLec = todays.find(l => toMin(l.start) > nm);

  const ready = C.subjects.length ? Math.round(C.subjects.reduce((s,x) => s + (x.readiness||0), 0) / C.subjects.length) : 0;
  const att = attStats(); const allTot = Object.values(att).reduce((s,x)=>s+x.total,0);
  const allAtt = Object.values(att).reduce((s,x)=>s+x.att+x.late,0);
  const attPct = pct(allAtt, allTot);

  const studyToday = subjectsStudyToday();

  return `
  <div class="card hero">
    <div style="font-size:1.6rem;font-weight:900">أهلاً بك يا ${esc((C.profile.name||'').split(' ')[0])} 👋</div>
    <p>${fmtDate(new Date())}</p>
    <p class="muted">${esc(C.profile.major)} • ${esc(C.profile.university)}</p>
  </div>

  <div class="grid3">
    <div class="stat"><div class="num">${todays.length}</div><div class="lbl">محاضرات اليوم</div></div>
    <div class="stat"><div class="num">${remaining}</div><div class="lbl">متبقية</div></div>
    <div class="stat"><div class="num">${attended}</div><div class="lbl">حضرت</div></div>
    <div class="stat"><div class="num">${absent}</div><div class="lbl">غائب</div></div>
    <div class="stat"><div class="num">${pendingAll}</div><div class="lbl">تكليف غير مكتمل</div></div>
    <div class="stat"><div class="num">${dailyPct}%</div><div class="lbl">إنجاز اليوم</div></div>
  </div>

  <div class="card" style="margin-top:16px"><h2>محاضرات اليوم</h2>
    ${todays.length ? todays.map(l => {
      const cur = toMin(l.start) <= nm && nm <= toMin(l.end);
      const a = attOf(l.id, t);
      return `<div class="item ${cur?'cur':''}">
        ${cur?'<span class="tag">الآن</span>':''}
        ${a ? `<span class="tag ${a.status==='حاضر'?'ok':a.status==='غائب'?'bad':a.status==='متأخر'?'warn':'gray'}">${a.status}</span>` : ''}
        <div class="t">${esc(subName(l.subjectId))}</div>
        <div class="m">${fmtT(l.start)} - ${fmtT(l.end)} • ${esc(l.hall||'')} ${l.doctor?'• د. '+esc(l.doctor):''}</div>
      </div>`;}).join('')
      : `<div class="empty"><div class="big">🎉</div>لا توجد محاضرات اليوم</div>`}
  </div>

  <div class="card"><h2>التكاليف القريبة</h2>
    ${soon.length ? soon.map(x => `
      <div class="item">
        <span class="tag ${x.dueDate===t?'bad':'warn'}">${x.dueDate===t?'اليوم':'خلال '+diffDays(t,x.dueDate)+' يوم'}</span>
        ${x.mode==='today'?'<span class="tag gray">ينفذ اليوم</span>':''}
        <div class="t">${esc(x.title)}</div>
        <div class="m">${esc(subName(x.subjectId))} • التسليم: ${fmtShort(x.dueDate)} ${x.dueTime?fmtT(x.dueTime):''}</div>
      </div>`).join('')
      : `<div class="empty"><div class="big">✅</div>لا توجد تكليفات قريبة</div>`}
  </div>

  <div class="card"><h2>المذاكرة اليوم</h2>
    ${studyToday.length ? studyToday.map(x => `<div class="item"><div class="t">${esc(x.name)}</div><div class="m">مقترح: ${x.minutes} دقيقة</div></div>`).join('')
      : `<div class="empty"><div class="big">📖</div>أضف جلسة مذاكرة لتظهر هنا</div>`}
    <div class="small-note">الجلسة القادمة: ${nextSession ? `${esc(subName(nextSession.subjectId))} - ${fmtShort(nextSession.date)} ${fmtT(nextSession.start)}` : 'لا توجد جلسات مجدولة'}</div>
    <div class="small-note">المحاضرة القادمة: ${nextLec ? `${esc(subName(nextLec.subjectId))} الساعة ${fmtT(nextLec.start)}` : 'لا توجد محاضرات قادمة اليوم'}</div>
  </div>

  <div class="card"><h2>ملخص التقدم</h2>
    <div class="m">متوسط الجاهزية للمواد: ${ready}%</div>${bar(ready)}
    <div class="m">نسبة الحضور الإجمالية: ${attPct}%</div>${bar(attPct, '#00b894')}
    <div class="m">إنجاز مهام اليوم: ${dailyPct}%</div>${bar(dailyPct, '#0984e3')}
    <div class="small-note">${unreadCount()} تنبيه غير مقروء</div>
  </div>`;
}

// الجلسات المقترحة اليوم لكل مادة
function subjectsStudyToday(){
  const t = today();
  const byS = {};
  C.sessions.filter(x => x.date === t && x.status === 'planned').forEach(x => {
    byS[x.subjectId] = (byS[x.subjectId] || 0) + (x.plannedMinutes || 0);
  });
  return Object.entries(byS).map(([id, minutes]) => ({ name: subName(id), minutes }));
}

/* --- الجدول --- */
function vSchedule(){
  const d = parseYMD(V.schedDate);
  const idx = dayIdx(d);
  const views = [['day','يوم'],['week','أسبوع'],['list','قائمة'],['month','شهر']];
  const head = V.schedView === 'month'
    ? d.toLocaleDateString('ar', { month:'long', year:'numeric' })
    : fmtDate(d);

  const toolbar = `
    <div class="segs">${views.map(([k,n]) => `<button type="button" class="seg ${V.schedView===k?'on':''}" data-act="schedView" data-v="${k}">${n}</button>`).join('')}</div>
    <div class="toolbar">
      <button type="button" class="btn ghost small" data-act="schedShift" data-n="-1">السابق ›</button>
      <b>${head}</b>
      <button type="button" class="btn ghost small" data-act="schedShift" data-n="1">‹ التالي</button>
      <button type="button" class="btn small" data-act="schedToday">اليوم</button>
    </div>`;

  let body = '';
  if (V.schedView === 'day') body = dayBody(idx, V.schedDate);
  else if (V.schedView === 'week') {
    const start = startOfWeek(d);
    body = [0,1,2,3,4,5,6].map(i => {
      const day = addDays(start, i), ds = ymd(day), di = dayIdx(day);
      const list = lecturesOn(di);
      return `<div class="sec">${DAYS[di]} • ${fmtShort(ds)}</div>` +
        (list.length ? list.map(l => lecRow(l, ds, true)).join('') : `<div class="small-note">لا توجد محاضرات</div>`);
    }).join('');
  }
  else if (V.schedView === 'list') {
    const order = [0,1,2,3,4,5,6].map(i => (C.settings.weekStart + i) % 7);
    body = order.map(di => {
      const list = lecturesOn(di);
      return list.length ? `<div class="sec">${DAYS[di]}</div>` + list.map(l => lecRow(l, null, false)).join('') : '';
    }).join('') || `<div class="empty"><div class="big">📚</div>لا توجد محاضرات بعد</div>`;
  }
  else if (V.schedView === 'month') body = monthGrid(V.schedDate, 'schedPick');

  return `
    <div class="page-title">الجدول الدراسي</div>
    <div class="page-sub">الجدول متكرر أسبوعياً، وحضورك يُسجَّل لكل تاريخ.</div>
    ${toolbar}
    ${body}
    <div class="row" style="margin-top:8px">
      <button type="button" class="btn" data-act="lecNew">+ إضافة محاضرة</button>
      <button type="button" class="btn ghost" data-act="copyDay">نسخ جدول هذا اليوم</button>
    </div>`;
}

function dayBody(idx, date){
  const list = lecturesOn(idx);
  if (!C.subjects.length) return `<div class="card empty"><div class="big">📘</div>أضف موادك أولاً من قسم المواد، ثم أضف محاضراتك هنا.<div style="margin-top:12px"><a class="btn small" href="#/subjects">إضافة مادة</a></div></div>`;
  if (!list.length) return `<div class="empty card"><div class="big">📚</div>لا توجد محاضرات في هذا اليوم</div>`;
  return list.map(l => lecRow(l, date, true)).join('');
}

function lecRow(l, date, withAtt){
  const st = toMin(l.start);
  const s = date ? attOf(l.id, date) : null;
  const tagClass = s ? (s.status==='حاضر'?'ok':s.status==='غائب'?'bad':s.status==='متأخر'?'warn':'gray') : '';
  return `
  <div class="item flex">
    <div class="stripe" style="background:${subColor(l.subjectId)}"></div>
    <div class="grow">
      <div class="t">${esc(subName(l.subjectId))} ${l.type?`<span class="tag gray">${esc(l.type)}</span>`:''}</div>
      <div class="m">${fmtT(l.start)} - ${fmtT(l.end)} • ${esc(l.hall||'بدون قاعة')} ${l.doctor?'• د. '+esc(l.doctor):''}</div>
      ${l.notes ? `<div class="m">ملاحظة: ${esc(l.notes)}</div>` : ''}
      ${withAtt && date ? `
        <div style="margin-top:8px">${s ? `<span class="tag ${tagClass}">${s.status}</span>` : '<span class="tag gray">لم يُسجَّل</span>'}</div>
        <div class="acts">
          ${STATUS_ATT.map(x => `<button type="button" class="btn small ${s&&s.status===x?'':'ghost'}" data-act="att" data-id="${l.id}" data-d="${date}" data-s="${x}">${x}</button>`).join('')}
          ${s ? `<button type="button" class="btn small ghost" data-act="att" data-id="${l.id}" data-d="${date}" data-s="">إلغاء التسجيل</button>` : ''}
        </div>` : ''}
      <div class="acts">
        <button type="button" class="btn small ghost" data-act="lecEdit" data-id="${l.id}">تعديل</button>
        <button type="button" class="btn small danger" data-act="lecDel" data-id="${l.id}">حذف</button>
      </div>
    </div>
  </div>`;
}

function monthGrid(dateStr, pickAct){
  const d = parseYMD(dateStr);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const offset = dayIdx(first);
  const days = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
  const t = today();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<div class="daycell out"></div>');
  for (let n = 1; n <= days; n++) {
    const ds = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(n)}`;
    const di = dayIdx(parseYMD(ds));
    const lc = lecturesOn(di).length;
    const sc = sessionsOn(ds).length;
    const tc = C.tasks.filter(x => x.dueDate === ds && !isDone(x)).length;
    const ec = C.exams.filter(x => x.date === ds).length;
    const isSel = (pickAct === 'schedPick' && ds === V.schedDate) || (pickAct === 'calPick' && ds === V.calDay);
    cells.push(`<div class="daycell ${ds===t?'today':''} ${isSel?'sel':''}" data-act="${pickAct}" data-d="${ds}">
      <div class="n">${n}</div>
      <div class="dots">
        ${lc?`<span class="dot" style="background:#0984e3"></span>`:''}
        ${sc?`<span class="dot" style="background:#00b894"></span>`:''}
        ${tc?`<span class="dot" style="background:#f0a500"></span>`:''}
        ${ec?`<span class="dot" style="background:#d63031"></span>`:''}
      </div></div>`);
  }
  const heads = DAYS.map(x => `<div class="dayhead">${x.slice(0,3)}</div>`).join('');
  return `
    <div class="card">
      <div class="dayrow">${heads}</div>
      <div class="dayrow" style="grid-template-columns:repeat(7,1fr)">${cells.join('')}</div>
      <div class="small-note">أزرق: محاضرات • أخضر: مذاكرة • برتقالي: تكاليف • أحمر: اختبارات</div>
    </div>`;
}

/* --- التكاليف --- */
function vTasks(){
  const tabs = [['today','اليوم'],['week','هذا الأسبوع'],['upcoming','القادمة'],['late','المتأخرة'],['done','المكتملة']];
  const list = taskGroup(V.taskTab);
  const t = today();
  return `
    <div class="page-title">التكاليف والواجبات</div>
    <div class="page-sub">التكليف المتأخر يبقى ظاهراً ولا يُحذف.</div>
    <div class="segs">${tabs.map(([k,n]) => `<button type="button" class="seg ${V.taskTab===k?'on':''}" data-act="taskTab" data-v="${k}">${n} (${taskGroup(k).length})</button>`).join('')}</div>
    <button type="button" class="btn block" data-act="taskNew" style="margin-bottom:14px">+ إضافة تكليف</button>
    ${list.length ? list.map(x => taskCard(x, t)).join('') : `<div class="empty card"><div class="big">📝</div>لا توجد تكليفات في هذا القسم</div>`}`;
}

function taskCard(x, t){
  const late = !isDone(x) && x.dueDate && x.dueDate < t;
  const sub = x.subtasks || [];
  const sp = pct(sub.filter(s=>s.done).length, sub.length);
  const cls = x.status==='مكتمل'||x.status==='تم التسليم' ? 'ok' : x.status==='قيد التنفيذ' ? 'warn' : 'gray';
  return `
  <div class="item">
    <span class="tag ${cls}">${x.status}</span>
    <span class="tag ${x.priority==='مرتفعة'?'bad':x.priority==='متوسطة'?'warn':'gray'}">أولوية ${x.priority}</span>
    ${late ? '<span class="tag bad">متأخر</span>' : ''}
    ${x.mode==='today' ? '<span class="tag gray">ينفذ في نفس اليوم</span>' : ''}
    <div class="t">${esc(x.title)}</div>
    <div class="m">${esc(subName(x.subjectId))} • التسليم: ${fmtShort(x.dueDate)} ${x.dueTime ? fmtT(x.dueTime) : ''}</div>
    ${x.estimateHours ? `<div class="m">الوقت المتوقع: ${x.estimateHours} ساعة</div>` : ''}
    ${x.description ? `<div class="m">${esc(x.description)}</div>` : ''}
    ${sub.length ? `<div class="m">المهام الفرعية: ${sub.filter(s=>s.done).length} من ${sub.length}</div>${bar(sp,'#00b894')}
      ${sub.map((s,i)=>`<label class="check" style="margin:4px 0"><input type="checkbox" data-act="subToggle" data-tid="${x.id}" data-i="${i}" ${s.done?'checked':''}> <span>${esc(s.title)}</span></label>`).join('')}` : ''}
    <div class="acts">
      <button type="button" class="btn small" data-act="taskStatus" data-id="${x.id}">الحالة: ${x.status}</button>
      <button type="button" class="btn small ghost" data-act="taskEdit" data-id="${x.id}">تعديل</button>
      <button type="button" class="btn small danger" data-act="taskDel" data-id="${x.id}">حذف</button>
    </div>
  </div>`;
}

/* --- المذاكرة --- */
function vStudy(){
  const ws = parseYMD(V.studyWeek);
  const start = startOfWeek(ws);
  const days = [0,1,2,3,4,5,6].map(i => ymd(addDays(start, i)));
  const sumWeek = C.sessions.filter(x => x.status === 'completed' && days.includes(x.date)).reduce((s,x)=>s+(x.actualMinutes||0),0);

  const plans = C.subjects.map(s => {
    const remaining = Math.max(0, (s.targetHours||0) * (1 - (s.readiness||0)/100));
    const left = s.examDate ? Math.max(1, diffDays(today(), s.examDate)) : 7;
    const perDay = (remaining / left).toFixed(1);
    const logged = C.sessions.filter(x => x.subjectId === s.id && x.status === 'completed').reduce((a,x)=>a+(x.actualMinutes||0),0);
    return { s, remaining: remaining.toFixed(1), left, perDay, logged };
  });

  return `
    <div class="page-title">خطة المذاكرة</div>
    <div class="page-sub">وزّع مذاكرتك على الأيام، ولا تتراكم مادة واحدة في يوم واحد.</div>

    <div class="card"><h2>أسبوع ${fmtShort(days[0])} - ${fmtShort(days[6])}</h2>
      <div class="toolbar">
        <button type="button" class="btn ghost small" data-act="studyWeek" data-n="-7">السابق ›</button>
        <button type="button" class="btn small" data-act="studyWeek" data-n="0">هذا الأسبوع</button>
        <button type="button" class="btn ghost small" data-act="studyWeek" data-n="7">‹ التالي</button>
      </div>
      <div class="m">ساعات مكتملة هذا الأسبوع: ${(sumWeek/60).toFixed(1)} ساعة</div>
      <div class="row" style="margin-top:12px">
        <button type="button" class="btn" data-act="sesNew">+ إضافة جلسة</button>
        <button type="button" class="btn ghost" data-act="sesResched">إعادة جدولة غير المكتملة</button>
      </div>
    </div>

    ${days.map((ds, i) => {
      const list = sessionsOn(ds);
      const di = dayIdx(parseYMD(ds));
      return `<div class="sec">${DAYS[di]} • ${fmtShort(ds)} ${ds===today()?'<span class="tag">اليوم</span>':''}</div>` +
        (list.length ? list.map(x => sesRow(x)).join('') : `<div class="small-note">لا توجد جلسات</div>`);
    }).join('')}

    <div class="card" style="margin-top:12px"><h2>المقترح اليومي لكل مادة</h2>
      ${plans.length ? plans.map(p => `
        <div class="item">
          <div class="t">${esc(p.s.name)}</div>
          <div class="m">المتبقي: ${p.remaining} ساعة • ${p.left} يوم حتى الاختبار</div>
          <div class="m"><b>المطلوب يومياً: ${p.perDay} ساعة</b> • مكتمل: ${(p.logged/60).toFixed(1)} ساعة</div>
          <div class="acts">
            <button type="button" class="btn small" data-act="planGen" data-id="${p.s.id}">إنشاء خطة مراجعة</button>
          </div>
        </div>`).join('')
        : `<div class="empty"><div class="big">📘</div>أضف موادك أولاً لنقترح عليك الخطة</div>`}
    </div>`;
}

function sesRow(x){
  const stLabel = { planned:'مخطط', completed:'مكتمل', incomplete:'لم يكتمل' }[x.status] || x.status;
  const cls = x.status==='completed' ? 'ok' : x.status==='incomplete' ? 'bad' : 'gray';
  return `
  <div class="item flex">
    <div class="stripe" style="background:${subColor(x.subjectId)}"></div>
    <div class="grow">
      <span class="tag ${cls}">${stLabel}</span>
      <div class="t">${esc(subName(x.subjectId))}${x.topic?' - '+esc(x.topic):''}</div>
      <div class="m">${x.start?fmtT(x.start)+' • ':''}${x.plannedMinutes} دقيقة ${x.actualMinutes?'• فعلياً: '+x.actualMinutes+' دقيقة':''}</div>
      ${x.goal ? `<div class="m">الهدف: ${esc(x.goal)}</div>` : ''}
      <div class="acts">
        ${x.status!=='completed' ? `<button type="button" class="btn small ok" data-act="sesDone" data-id="${x.id}">تم</button>` : ''}
        ${x.status!=='incomplete' && x.status!=='completed' ? `<button type="button" class="btn small ghost" data-act="sesFail" data-id="${x.id}">لم أكمل</button>` : ''}
        <button type="button" class="btn small ghost" data-act="sesEdit" data-id="${x.id}">تعديل / نقل</button>
        <button type="button" class="btn small danger" data-act="sesDel" data-id="${x.id}">حذف</button>
      </div>
    </div>
  </div>`;
}

/* --- المؤقت --- */
const POMO = { mode:'work', running:false, endAt:0, left:0, subjectId:'', topic:'', timer:null };
function pomoTotal(){ return (POMO.mode === 'work' ? C.settings.pomoWork : C.settings.pomoBreak) * 60; }
if (!POMO.left) POMO.left = 25 * 60;

function vPomodoro(){
  if (!POMO.running && (POMO.left === 0 || POMO.left > pomoTotal())) POMO.left = pomoTotal();
  const t = today();
  const todayMin = C.sessions.filter(x => x.date === t && x.status === 'completed').reduce((a,x)=>a+(x.actualMinutes||0),0);
  const weekStart = ymd(startOfWeek(new Date()));
  const weekMin = C.sessions.filter(x => x.status === 'completed' && x.date >= weekStart).reduce((a,x)=>a+(x.actualMinutes||0),0);
  return `
    <div class="page-title">مؤقت المذاكرة</div>
    <div class="page-sub">بومودورو: ${C.settings.pomoWork} دقيقة مذاكرة ثم ${C.settings.pomoBreak} دقائق راحة</div>
    <div class="card">
      <div class="mode" id="pomoMode">${POMO.mode==='work'?'وقت المذاكرة':'وقت الراحة'}</div>
      <div class="timer" id="pomoTime">${fmtSec(POMO.left)}</div>
      <div class="row" style="margin-bottom:10px">
        <div><label>المادة</label>
          <select id="pomoSub" onchange="POMO.subjectId=this.value">
            <option value="">عام</option>
            ${C.subjects.map(s=>`<option value="${s.id}" ${POMO.subjectId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}
          </select></div>
        <div><label>الموضوع</label>
          <input id="pomoTopic" value="${esc(POMO.topic)}" oninput="POMO.topic=this.value" placeholder="مثال: الفصل الثاني"></div>
      </div>
      <div class="row">
        <button type="button" class="btn ok" id="pomoBtn" data-act="pomoToggle">${POMO.running?'إيقاف مؤقت':'ابدأ'}</button>
        <button type="button" class="btn ghost" data-act="pomoSave">حفظ ما أنجزته</button>
        <button type="button" class="btn ghost" data-act="pomoReset">إعادة</button>
      </div>
      <div class="small-note">يعمل المؤقت أثناء بقاء التطبيق مفتوحاً في المتصفح.</div>
    </div>
    <div class="grid2">
      <div class="stat"><div class="num">${todayMin}</div><div class="lbl">دقيقة مذاكرة اليوم</div></div>
      <div class="stat"><div class="num">${(weekMin/60).toFixed(1)}</div><div class="lbl">ساعة هذا الأسبوع</div></div>
    </div>
    <div class="sec">آخر الجلسات</div>
    ${C.sessions.filter(x=>x.status==='completed').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map(x=>`
      <div class="item"><div class="t">${esc(subName(x.subjectId))}${x.topic?' - '+esc(x.topic):''}</div>
      <div class="m">${fmtShort(x.date)} • ${x.actualMinutes} دقيقة</div></div>`).join('') || '<div class="empty">لا توجد جلسات مكتملة بعد</div>'}`;
}
function fmtSec(s){ return pad(Math.floor(s/60)) + ':' + pad(s%60); }

function updatePomoUI(){
  const el = $('#pomoTime'); if (el) el.textContent = fmtSec(POMO.left);
  const m = $('#pomoMode'); if (m) m.textContent = POMO.mode === 'work' ? 'وقت المذاكرة' : 'وقت الراحة';
  const b = $('#pomoBtn'); if (b) b.textContent = POMO.running ? 'إيقاف مؤقت' : 'ابدأ';
}
function pomoStart(){
  if (POMO.running) return;
  if (POMO.left <= 0) POMO.left = pomoTotal();
  POMO.running = true;
  POMO.endAt = Date.now() + POMO.left * 1000;
  clearInterval(POMO.timer);
  POMO.timer = setInterval(pomoTick, 500);
  updatePomoUI();
}
function pomoPause(){
  if (!POMO.running) return;
  POMO.left = Math.max(0, Math.round((POMO.endAt - Date.now()) / 1000));
  POMO.running = false;
  clearInterval(POMO.timer);
  updatePomoUI();
}
function pomoReset(){
  clearInterval(POMO.timer);
  POMO.running = false;
  POMO.left = pomoTotal();
  updatePomoUI();
}
async function pomoTick(){
  POMO.left = Math.max(0, Math.round((POMO.endAt - Date.now()) / 1000));
  if (POMO.left <= 0) {
    clearInterval(POMO.timer);
    POMO.running = false;
    const finished = POMO.mode;
    const mins = Math.round(pomoTotal() / 60);
    if (finished === 'work') {
      await DB.put('sessions', { id: uid(), subjectId: POMO.subjectId, topic: POMO.topic, date: today(), start: '', plannedMinutes: mins, actualMinutes: mins, goal: 'جلسة بومودورو', status: 'completed', notes: '' });
      POMO.mode = 'break';
      await loadAll();
      await notify('study', 'انتهت جلسة المذاكرة', `تم تسجيل ${mins} دقيقة. خذ استراحة قصيرة.`);
    } else {
      POMO.mode = 'work';
      await notify('study', 'انتهت الاستراحة', 'هيا نبدأ جلسة مذاكرة جديدة.');
    }
    POMO.left = pomoTotal();
    if (route().startsWith('pomodoro')) render(); else updatePomoUI();
    return;
  }
  updatePomoUI();
}
function route(){ return currentRoute(); }

/* --- المواد --- */
function vSubjects(){
  return `
    <div class="page-title">المواد الدراسية</div>
    <div class="page-sub">لكل مادة صفحة تحتوي على الموضوعات والملاحظات والاختبارات.</div>
    <button type="button" class="btn block" data-act="subNew" style="margin-bottom:14px">+ إضافة مادة</button>
    ${C.subjects.length ? C.subjects.map(s => {
      const att = attStats()[s.id];
      return `
      <div class="item flex" style="cursor:pointer" onclick="location.hash='#/subject/${s.id}'">
        <div class="stripe" style="background:${s.color||'#6c5ce7'}"></div>
        <div class="grow">
          <div class="t">${esc(s.name)}</div>
          <div class="m">${s.doctor?'د. '+esc(s.doctor)+' • ':''}${s.units?s.units+' وحدة • ':''}${esc(s.difficulty||'')}</div>
          <div class="m">الجاهزية ${s.readiness||0}%</div>${bar(s.readiness||0)}
          ${att ? `<div class="m">الحضور: ${att.rate}% • الغياب: ${att.absPct}% (الحد ${att.limit}%)</div>` : ''}
        </div>
      </div>`;}).join('')
      : `<div class="empty card"><div class="big">📘</div>لا توجد مواد بعد. أضف أول مادة لتبدأ.</div>`}`;
}

function vSubject(id){
  const s = subById(id);
  if (!s) return `<div class="empty">المادة غير موجودة</div>`;
  const lecs = C.lectures.filter(l => l.subjectId === id);
  const tasks = C.tasks.filter(x => x.subjectId === id);
  const exams = C.exams.filter(x => x.subjectId === id);
  const notes = C.notes.filter(x => x.subjectId === id);
  const sess = C.sessions.filter(x => x.subjectId === id);
  const att = attStats()[id];
  return `
    <a class="btn ghost small" href="#/subjects">‹ العودة للمواد</a>
    <div class="page-title" style="margin-top:12px"><span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${s.color};margin-inline-end:6px"></span>${esc(s.name)}</div>
    <div class="page-sub">${s.doctor?'د. '+esc(s.doctor):''} ${s.difficulty?'• صعوبة: '+esc(s.difficulty):''} ${s.units?'• '+s.units+' وحدة':''}</div>

    <div class="grid3">
      <div class="stat"><div class="num">${s.readiness||0}%</div><div class="lbl">الجاهزية</div></div>
      <div class="stat"><div class="num">${att ? att.rate : 0}%</div><div class="lbl">الحضور</div></div>
      <div class="stat"><div class="num">${att ? att.absPct : 0}%</div><div class="lbl">الغياب (الحد ${subLimit(id)}%)</div></div>
    </div>
    ${att && att.absPct >= subLimit(id) ? `<div class="card" style="border-color:var(--bad)"><b>تجاوزت حد الغياب المسموح في هذه المادة.</b></div>`
      : att && att.absPct >= subLimit(id)*0.8 ? `<div class="card" style="border-color:var(--warn)"><b>اقتربت من حد الغياب المسموح.</b></div>` : ''}

    <div class="card" style="margin-top:14px"><h2>تعديل المادة</h2>
      <form data-form="subject" data-id="${s.id}">
        <div class="row">
          <div><label>اسم المادة</label><input name="name" required value="${esc(s.name)}"></div>
          <div><label>اسم الدكتور</label><input name="doctor" value="${esc(s.doctor)}"></div>
        </div>
        <div class="row">
          <div><label>عدد الفصول/الوحدات</label><input name="units" type="number" min="0" value="${s.units||''}"></div>
          <div><label>الصعوبة</label><select name="difficulty">${['سهل','متوسط','صعب'].map(x=>`<option ${s.difficulty===x?'selected':''}>${x}</option>`).join('')}</select></div>
          <div><label>لون المادة</label><input name="color" type="color" value="${s.color||'#6c5ce7'}"></div>
        </div>
        <div class="row">
          <div><label>الجاهزية (%)</label><input name="readiness" type="number" min="0" max="100" value="${s.readiness||0}"></div>
          <div><label>ساعات المذاكرة المستهدفة</label><input name="targetHours" type="number" min="0" value="${s.targetHours||''}"></div>
          <div><label>موعد الاختبار</label><input name="examDate" type="date" value="${s.examDate||''}"></div>
        </div>
        <div class="row">
          <div><label>حد الغياب لهذه المادة (%)</label><input name="absenceLimit" type="number" min="0" max="100" value="${s.absenceLimit ?? ''}" placeholder="الافتراضي ${C.settings.absenceDefault}%"></div>
        </div>
        <label>الموضوعات المطلوب مذاكرتها (سطر لكل موضوع)</label>
        <textarea name="topics">${esc((s.topics||[]).join('\n'))}</textarea>
        <label>المراجع والروابط</label>
        <textarea name="refs">${esc(s.refs||'')}</textarea>
        <label>أهم النقاط للمراجعة</label>
        <textarea name="reviewPoints">${esc(s.reviewPoints||'')}</textarea>
        <button class="btn block" type="submit">حفظ المادة</button>
      </form>
      <div class="acts" style="margin-top:10px">
        <button type="button" class="btn ok" data-act="planGen" data-id="${s.id}">إنشاء خطة مراجعة قبل الاختبار</button>
        <button type="button" class="btn danger" data-act="subDel" data-id="${s.id}">حذف المادة</button>
      </div>
      ${s.reviewPoints ? '' : ''}
    </div>

    <div class="sec">المحاضرات (${lecs.length})</div>
    ${lecs.length ? lecs.map(l=>`<div class="item"><div class="t">${fmtT(l.start)} - ${fmtT(l.end)}</div><div class="m">${DAYS[l.day]} • ${esc(l.hall||'')} • ${esc(l.type||'')}</div></div>`).join('') : '<div class="small-note">لا توجد محاضرات</div>'}

    <div class="sec">التكاليف (${tasks.length})</div>
    ${tasks.length ? tasks.map(x=>`<div class="item"><span class="tag ${isDone(x)?'ok':'gray'}">${x.status}</span><div class="t">${esc(x.title)}</div><div class="m">التسليم: ${fmtShort(x.dueDate)}</div></div>`).join('') : '<div class="small-note">لا توجد تكاليف</div>'}

    <div class="sec">الاختبارات (${exams.length})</div>
    ${exams.length ? exams.map(x=>`<div class="item"><div class="t">${esc(x.title)}</div><div class="m">${fmtShort(x.date)} ${x.time?fmtT(x.time):''} ${x.place?'• '+esc(x.place):''}</div></div>`).join('') : '<div class="small-note">لا توجد اختبارات</div>'}

    <div class="sec">الملاحظات (${notes.length})</div>
    ${notes.length ? notes.map(x=>`<div class="item"><div class="t">${esc(x.title)}</div><div class="m">${esc((x.body||'').slice(0,120))}</div></div>`).join('') : '<div class="small-note">لا توجد ملاحظات</div>'}
    <button type="button" class="btn ghost block" data-act="noteNew" data-sub="${s.id}" style="margin-top:8px">+ ملاحظة لهذه المادة</button>

    <div class="sec">جلسات المذاكرة (${sess.length})</div>
    ${sess.length ? sess.map(x=>sesRow(x)).join('') : '<div class="small-note">لا توجد جلسات</div>'}`;
}

/* --- سجل الحضور --- */
function vAttendance(){
  const periods = [['week','آخر 7 أيام'],['month','هذا الشهر'],['term','الفصل الدراسي'],['all','الكل']];
  const stats = attStats(attPeriodFilter());
  const all = Object.values(stats);
  const tot = all.reduce((s,x)=>s+x.total,0);
  const att = all.reduce((s,x)=>s+x.att,0);
  const late = all.reduce((s,x)=>s+x.late,0);
  const abs = all.reduce((s,x)=>s+x.abs,0);
  return `
    <div class="page-title">سجل الحضور والغياب</div>
    <div class="page-sub">نسبة الحضور تحسب (حاضر + متأخر)، وتُستثنى المحاضرات الملغاة.</div>
    <div class="segs">${periods.map(([k,n])=>`<button type="button" class="seg ${V.attPeriod===k?'on':''}" data-act="attPeriod" data-v="${k}">${n}</button>`).join('')}</div>
    <div class="grid2">
      <div class="stat"><div class="num">${tot}</div><div class="lbl">إجمالي المحاضرات المسجلة</div></div>
      <div class="stat"><div class="num">${att}</div><div class="lbl">حضور</div></div>
      <div class="stat"><div class="num">${abs}</div><div class="lbl">غياب</div></div>
      <div class="stat"><div class="num">${late}</div><div class="lbl">تأخر</div></div>
    </div>
    <div class="sec">لكل مادة</div>
    ${all.length ? all.map(v => `
      <div class="item">
        <div class="t"><span class="tag ${v.absPct>=v.limit?'bad':v.absPct>=v.limit*0.8?'warn':'ok'}">${v.absPct>=v.limit?'تجاوزت الحد':v.absPct>=v.limit*0.8?'اقتربت من الحد':'ضمن الحد'}</span> ${esc(v.name)}</div>
        <div class="m">الحضور ${v.rate}% • الغياب ${v.absPct}% • الحد المسموح ${v.limit}% • ${v.total} محاضرة</div>
        ${bar(v.rate, v.color)}
      </div>`).join('')
      : `<div class="empty card"><div class="big">📋</div>سجّل حضورك من شاشة الجدول ليظهر هنا</div>`}
    <div class="small-note">لتغيير حد الغياب لكل مادة افتح المادة من قسم المواد.</div>`;
}

/* --- المزيد --- */
function vMore(){
  return `<div class="page-title">المزيد</div><div class="page-sub">كل أقسام التطبيق</div>
  <div class="grid2">${MORE.map(([k,i,n])=>`<a class="card" href="#/${k}" style="text-align:center;text-decoration:none;color:var(--text)"><div style="font-size:2rem">${i}</div><b>${n}</b>${k==='notifications'&&unreadCount()?`<div class="tag bad">${unreadCount()} جديد</div>`:''}</a>`).join('')}</div>`;
}

/* --- التقويم --- */
function vCalendar(){
  const m = parseYMD(V.calMonth);
  const d = V.calDay;
  const dIdx = dayIdx(parseYMD(d));
  const lecs = lecturesOn(dIdx);
  const sess = sessionsOn(d);
  const tasks = C.tasks.filter(x => x.dueDate === d);
  const exams = C.exams.filter(x => x.date === d);
  const none = !lecs.length && !sess.length && !tasks.length && !exams.length;
  return `
    <div class="page-title">التقويم الجامعي</div>
    <div class="toolbar">
      <button type="button" class="btn ghost small" data-act="calMonth" data-n="-1">السابق ›</button>
      <b>${m.toLocaleDateString('ar',{month:'long',year:'numeric'})}</b>
      <button type="button" class="btn ghost small" data-act="calMonth" data-n="1">‹ التالي</button>
      <button type="button" class="btn small" data-act="calToday">اليوم</button>
    </div>
    <div class="card">${monthGrid(V.calMonth, 'calPick')}</div>
    <div class="sec">أحداث ${fmtDate(parseYMD(d))}</div>
    ${none ? '<div class="empty card">لا توجد أحداث في هذا اليوم</div>' : ''}
    ${lecs.map(l=>`<div class="item"><span class="tag">محاضرة</span><div class="t">${esc(subName(l.subjectId))}</div><div class="m">${fmtT(l.start)} - ${fmtT(l.end)} • ${esc(l.hall||'')}</div></div>`).join('')}
    ${sess.map(x=>`<div class="item"><span class="tag ok">مذاكرة</span><div class="t">${esc(subName(x.subjectId))}${x.topic?' - '+esc(x.topic):''}</div><div class="m">${x.plannedMinutes} دقيقة • ${x.status}</div><div class="acts"><button type="button" class="btn small ghost" data-act="sesEdit" data-id="${x.id}">تعديل</button></div></div>`).join('')}
    ${tasks.map(x=>`<div class="item"><span class="tag warn">تسليم تكليف</span><div class="t">${esc(x.title)}</div><div class="m">${esc(subName(x.subjectId))} • ${x.status}</div><div class="acts"><button type="button" class="btn small ghost" data-act="taskEdit" data-id="${x.id}">تعديل</button></div></div>`).join('')}
    ${exams.map(x=>`<div class="item"><span class="tag bad">اختبار</span><div class="t">${esc(x.title)}</div><div class="m">${x.time?fmtT(x.time):''} ${x.place?'• '+esc(x.place):''}</div><div class="acts"><button type="button" class="btn small ghost" data-act="examEdit" data-id="${x.id}">تعديل</button></div></div>`).join('')}`;
}

/* --- الاختبارات --- */
function vExams(){
  const t = today();
  const list = [...C.exams].sort((a,b)=>a.date.localeCompare(b.date));
  return `
    <div class="page-title">الاختبارات والمواعيد المهمة</div>
    <button type="button" class="btn block" data-act="examNew" style="margin:10px 0 14px">+ إضافة اختبار</button>
    ${list.length ? list.map(x => {
      const dd = diffDays(t, x.date);
      return `<div class="item flex">
        <div class="stripe" style="background:${subColor(x.subjectId)}"></div>
        <div class="grow">
          <span class="tag ${dd<0?'gray':dd<=3?'bad':'warn'}">${dd<0?'انتهى':dd===0?'اليوم':'بعد '+dd+' يوم'}</span>
          <div class="t">${esc(x.title)}</div>
          <div class="m">${esc(subName(x.subjectId))} • ${fmtShort(x.date)} ${x.time?fmtT(x.time):''} ${x.place?'• '+esc(x.place):''}</div>
          <div class="acts">
            <button type="button" class="btn small ghost" data-act="examEdit" data-id="${x.id}">تعديل</button>
            <button type="button" class="btn small danger" data-act="examDel" data-id="${x.id}">حذف</button>
          </div>
        </div></div>`;}).join('')
    : `<div class="empty card"><div class="big">🎯</div>لا توجد اختبارات مسجلة</div>`}`;
}

/* --- الملاحظات --- */
function vNotes(){
  const q = V.notesQ.trim().toLowerCase();
  const list = C.notes.filter(n =>
    (!V.notesSub || n.subjectId === V.notesSub) &&
    (!q || (n.title||'').toLowerCase().includes(q) || (n.body||'').toLowerCase().includes(q))
  ).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
  return `
    <div class="page-title">الملاحظات الدراسية</div>
    <div class="row">
      <input id="notesQ" placeholder="ابحث في الملاحظات" value="${esc(V.notesQ)}" oninput="V.notesQ=this.value;render();const q=$('#notesQ');q.focus();q.setSelectionRange(q.value.length,q.value.length)">
      <select onchange="V.notesSub=this.value;render()" style="max-width:220px">
        <option value="">كل المواد</option>
        ${C.subjects.map(s=>`<option value="${s.id}" ${V.notesSub===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}
      </select>
    </div>
    <button type="button" class="btn block" data-act="noteNew" style="margin:10px 0 14px">+ ملاحظة جديدة</button>
    ${list.length ? list.map(n => `
      <div class="item">
        <span class="tag gray">${esc(subName(n.subjectId))}</span>
        <div class="t">${esc(n.title)}</div>
        <div class="m" style="white-space:pre-wrap">${esc(n.body)}</div>
        <div class="acts">
          <button type="button" class="btn small ghost" data-act="noteEdit" data-id="${n.id}">تعديل</button>
          <button type="button" class="btn small danger" data-act="noteDel" data-id="${n.id}">حذف</button>
        </div>
      </div>`).join('')
    : `<div class="empty card"><div class="big">✏️</div>لا توجد ملاحظات مطابقة</div>`}`;
}

/* --- التنبيهات --- */
function vNotifications(){
  const list = [...C.notifications].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return `
    <div class="page-title">مركز التنبيهات</div>
    <div class="page-sub">التنبيهات تظهر هنا وتُحفظ على جهازك. تعمل أثناء فتح التطبيق فقط.</div>
    <div class="row" style="margin-bottom:12px">
      <button type="button" class="btn ghost" data-act="notifClear">مسح الكل</button>
      <button type="button" class="btn ghost" data-act="notifPerm">تفعيل إشعارات المتصفح</button>
    </div>
    ${list.length ? list.map(n => `
      <div class="item" style="${n.read?'opacity:.65':''}">
        <span class="tag ${n.read?'gray':'bad'}">${n.read?'مقروء':'جديد'}</span>
        <div class="t">${esc(n.title)}</div>
        <div class="m">${esc(n.body)}</div>
        <div class="m">${new Date(n.createdAt).toLocaleString('ar')}</div>
        <div class="acts">
          ${n.read?'':`<button type="button" class="btn small ok" data-act="notifRead" data-id="${n.id}">تحديد كمقروء</button>`}
          <button type="button" class="btn small danger" data-act="notifDel" data-id="${n.id}">حذف</button>
        </div>
      </div>`).join('')
    : `<div class="empty card"><div class="big">🔔</div>لا توجد تنبيهات بعد</div>`}`;
}

/* --- الإحصائيات --- */
function vStats(){
  const att = attStats();
  const allV = Object.values(att);
  const tot = allV.reduce((s,x)=>s+x.total,0);
  const ok = allV.reduce((s,x)=>s+x.att+x.late,0);
  const attPct = pct(ok, tot);
  const doneT = C.tasks.filter(isDone).length;
  const late = C.tasks.filter(x=>!isDone(x) && x.dueDate && x.dueDate < today()).length;
  const taskPct = pct(doneT, C.tasks.length);
  const completed = C.sessions.filter(x=>x.status==='completed');
  const totalMin = completed.reduce((s,x)=>s+(x.actualMinutes||0),0);
  const bySub = {};
  completed.forEach(x => { bySub[x.subjectId] = (bySub[x.subjectId]||0) + (x.actualMinutes||0); });
  const maxMin = Math.max(1, ...Object.values(bySub));
  return `
    <div class="page-title">الإحصائيات والتقارير</div>
    <div class="grid3">
      <div class="stat"><div class="num">${attPct}%</div><div class="lbl">نسبة الحضور</div></div>
      <div class="stat"><div class="num">${taskPct}%</div><div class="lbl">إنجاز التكاليف</div></div>
      <div class="stat"><div class="num">${(totalMin/60).toFixed(1)}</div><div class="lbl">ساعة مذاكرة</div></div>
    </div>
    <div class="grid3" style="margin-top:14px">
      <div class="stat"><div class="num">${C.tasks.length}</div><div class="lbl">إجمالي التكاليف</div></div>
      <div class="stat"><div class="num">${doneT}</div><div class="lbl">مكتملة</div></div>
      <div class="stat"><div class="num">${late}</div><div class="lbl">متأخرة</div></div>
    </div>

    <div class="card" style="margin-top:16px"><h2>الحضور لكل مادة</h2>
      ${allV.length ? allV.map(v=>`<div style="margin-bottom:12px"><b>${esc(v.name)}</b> — ${v.rate}%${bar(v.rate, v.color)}</div>`).join('') : '<div class="empty">لا توجد بيانات حضور</div>'}
    </div>

    <div class="card"><h2>ساعات المذاكرة لكل مادة</h2>
      ${Object.keys(bySub).length ? Object.entries(bySub).map(([id,m])=>`<div style="margin-bottom:12px"><b>${esc(subName(id))}</b> — ${(m/60).toFixed(1)} ساعة${bar(pct(m,maxMin), subColor(id))}</div>`).join('') : '<div class="empty">لا توجد جلسات مكتملة</div>'}
    </div>

    <div class="card"><h2>الجاهزية لكل مادة</h2>
      ${C.subjects.length ? C.subjects.map(s=>`<div style="margin-bottom:12px"><b>${esc(s.name)}</b> — ${s.readiness||0}%${bar(s.readiness||0, s.color)}</div>`).join('') : '<div class="empty">أضف مواد لتظهر هنا</div>'}
    </div>`;
}

/* --- الإعدادات --- */
function vSettings(){
  const s = C.settings;
  const sw = (k, label) => `<label class="check"><input type="checkbox" name="n_${k}" ${s.notif[k]!==false?'checked':''}> ${label}</label>`;
  return `
    <div class="page-title">الإعدادات</div>
    <div class="card"><h2>المظهر</h2>
      <div class="segs">
        ${[['dark','داكن'],['light','فاتح'],['system','تلقائي']].map(([k,n])=>`<button type="button" class="seg ${s.theme===k?'on':''}" data-act="theme" data-v="${k}">${n}</button>`).join('')}
      </div>
      <label>لون التطبيق</label>
      <div>${ACCENTS.map(c=>`<span class="swatch ${s.accent===c?'on':''}" style="background:${c}" data-act="accent" data-v="${c}"></span>`).join('')}</div>
      <label style="margin-top:12px">خلفية التطبيق</label>
      <div class="segs">
        ${[['books','كتب'],['pencils','أقلام'],['none','بدون']].map(([k,n])=>`<button type="button" class="seg ${s.bg===k?'on':''}" data-act="bg" data-v="${k}">${n}</button>`).join('')}
      </div>
    </div>

    <form class="card" data-form="settings"><h2>الدراسة والتنبيهات</h2>
      <div class="row">
        <div><label>مدة المذاكرة (دقيقة)</label><input name="pomoWork" type="number" min="5" max="120" value="${s.pomoWork}"></div>
        <div><label>مدة الراحة (دقيقة)</label><input name="pomoBreak" type="number" min="1" max="60" value="${s.pomoBreak}"></div>
      </div>
      <div class="row">
        <div><label>التنبيه قبل المحاضرة</label>
          <select name="leadMin">${[5,10,15,30].map(m=>`<option value="${m}" ${s.leadMin==m?'selected':''}>${m} دقائق</option>`).join('')}</select></div>
        <div><label>الحد الافتراضي للغياب (%)</label><input name="absenceDefault" type="number" min="0" max="100" value="${s.absenceDefault}"></div>
      </div>
      <div class="row">
        <div><label>أقصى دقائق مذاكرة لمادة في اليوم</label><input name="maxStudyPerSubject" type="number" min="30" max="480" value="${s.maxStudyPerSubject}"></div>
        <div><label>وقت الملخص اليومي</label><input name="dailyTime" type="time" value="${s.dailyTime}"></div>
      </div>
      <div class="row">
        <div><label>بداية الفصل الدراسي</label><input name="termStart" type="date" value="${s.termStart}"></div>
        <div><label>نهاية الفصل الدراسي</label><input name="termEnd" type="date" value="${s.termEnd}"></div>
      </div>
      <div class="row">
        <div><label>أول يوم في الأسبوع</label>
          <select name="weekStart">${DAYS.map((d,i)=>`<option value="${i}" ${s.weekStart==i?'selected':''}>${d}</option>`).join('')}</select></div>
        <div><label>تنسيق الوقت</label>
          <select name="timeFormat"><option value="24" ${s.timeFormat==='24'?'selected':''}>24 ساعة</option><option value="12" ${s.timeFormat==='12'?'selected':''}>12 ساعة</option></select></div>
        <div><label>حجم الخط (%)</label><input name="fontScale" type="number" min="85" max="130" value="${s.fontScale}"></div>
      </div>
      <label style="margin-top:6px">أنواع التنبيهات</label>
      ${sw('lecture','تنبيه قبل المحاضرة')}
      ${sw('lectureStart','تنبيه ببداية المحاضرة')}
      ${sw('attend','تذكير بتسجيل الحضور')}
      ${sw('taskDue','تذكير بالتكاليف قبل التسليم')}
      ${sw('taskLate','تنبيه التكاليف المتأخرة')}
      ${sw('study','تذكير بجلسات المذاكرة')}
      ${sw('exam','تنبيه الاختبارات')}
      ${sw('absence','تنبيه اقتراب حد الغياب')}
      ${sw('daily','ملخص يومي')}
      <button class="btn block" type="submit" style="margin-top:8px">حفظ الإعدادات</button>
    </form>

    <div class="card"><h2>الملف الشخصي</h2>
      <p class="muted">${esc(C.profile.name)} • ${esc(C.profile.university)} • ${esc(C.profile.faculty)}</p>
      <div class="acts" style="margin-top:10px"><a class="btn small" href="#/profile">تعديل الملف الشخصي</a></div>
    </div>

    <div class="card"><h2>البيانات</h2>
      <p class="small-note">البيانات محفوظة على هذا الجهاز فقط، ولا تُزامن بين الأجهزة.</p>
      <div class="row" style="margin-top:10px">
        <button type="button" class="btn" data-act="exportData">تصدير نسخة احتياطية</button>
        <label class="btn ghost" style="cursor:pointer;margin:0">استيراد نسخة احتياطية<input type="file" accept="application/json" data-act="importData" class="hide"></label>
      </div>
      <div style="margin-top:14px"><button type="button" class="btn danger block" data-act="resetAll">مسح كل البيانات</button></div>
    </div>

    <div class="card"><h2>نشاط الإشعارات</h2>
      <button type="button" class="btn ghost block" data-act="notifPerm">تفعيل إشعارات المتصفح</button>
      <div class="small-note">تظهر التنبيهات داخل التطبيق دائماً. إشعارات المتصفح تعمل أثناء فتح التطبيق فقط.</div>
    </div>`;
}

/* --- المساعدة والمعلومات --- */
function vHelp(){
  return `
    <div class="page-title">المساعدة ومعلومات التطبيق</div>
    <div class="card"><h2>رفيق الجامعة - UniMate</h2>
      <p>نظّم دراستك، واستثمر وقتك، وحقق هدفك.</p>
      <p class="muted">الإصدار ${APP_VERSION}</p>
      <p class="muted">تصميم وتطوير: ${DEV.name}</p>
      <p class="muted">للتواصل: ${DEV.phone}</p>
    </div>
    <div class="card"><h2>كيف أبدأ؟</h2>
      <p>1. أضف موادك من قسم المواد.</p>
      <p>2. أضف محاضراتك من الجدول.</p>
      <p>3. سجّل حضورك بعد كل محاضرة.</p>
      <p>4. أضف تكاليفك وحدد مواعيد تسليمها.</p>
      <p>5. اختر مادة وأنشئ لها خطة مراجعة قبل الاختبار.</p>
    </div>
    <div class="card"><h2>ملاحظات مهمة</h2>
      <p>• البيانات تُحفظ على جهازك فقط.</p>
      <p>• التنبيهات تعمل أثناء فتح التطبيق، ولا تعمل والتطبيق مغلق.</p>
      <p>• للاحتفاظ ببياناتك انسخها من الإعدادات بين وقت وآخر.</p>
    </div>`;
}

/* ===================================================
   الأحداث (Actions)
=================================================== */
const ACT = {
  close(){ closeModal(); },
  schedView(d){ V.schedView = d.v; render(); },
  schedShift(d){
    const mult = V.schedView === 'month' ? 30 : V.schedView === 'week' ? 7 : 1;
    V.schedDate = ymd(addDays(parseYMD(V.schedDate), +d.n * mult));
    render();
  },
  schedToday(){ V.schedDate = today(); render(); },
  schedPick(d){ V.schedDate = d.d; V.schedView = 'day'; render(); },
  calPick(d){ V.calDay = d.d; render(); },
  calMonth(d){
    const x = parseYMD(V.calMonth); x.setMonth(x.getMonth() + (+d.n));
    V.calMonth = ymd(x); render();
  },
  calToday(){ V.calMonth = today(); V.calDay = today(); render(); },

  lecNew(){ openLectureForm(null); },
  lecEdit(d){ openLectureForm(C.lectures.find(l => l.id === d.id)); },
  async lecDel(d){
    if (!confirm('حذف هذه المحاضرة؟ سيُحذف سجل حضورها أيضاً.')) return;
    for (const a of C.attendance.filter(a => a.lectureId === d.id)) await DB.del('attendance', a.id);
    await remove('lectures', d.id);
  },
  async att(d){
    const id = d.id + '|' + d.d;
    if (!d.s) { await remove('attendance', id); return; }
    await save('attendance', { id, lectureId: d.id, date: d.d, status: d.s });
  },
  copyDay(){ openCopyDay(); },

  taskTab(d){ V.taskTab = d.v; render(); },
  taskNew(){ openTaskForm(null); },
  taskEdit(d){ openTaskForm(C.tasks.find(x => x.id === d.id)); },
  async taskDel(d){ if (confirm('حذف هذا التكليف؟')) await remove('tasks', d.id); },
  async taskStatus(d){
    const x = C.tasks.find(t => t.id === d.id); if (!x) return;
    const i = TASK_STATUS.indexOf(x.status);
    x.status = TASK_STATUS[(i + 1) % TASK_STATUS.length];
    if (isDone(x)) x.completedAt = new Date().toISOString();
    await save('tasks', x);
  },
  async subToggle(d, el){
    const x = C.tasks.find(t => t.id === d.tid); if (!x) return;
    x.subtasks[+d.i].done = el.checked;
    await save('tasks', x);
  },

  studyWeek(d){
    const x = parseYMD(V.studyWeek);
    V.studyWeek = d.n === '0' ? ymd(new Date()) : ymd(addDays(x, +d.n));
    render();
  },
  sesNew(){ openSessionForm(null); },
  sesEdit(d){ openSessionForm(C.sessions.find(x => x.id === d.id)); },
  async sesDone(d){
    const x = C.sessions.find(s => s.id === d.id); if (!x) return;
    x.status = 'completed'; x.actualMinutes = x.actualMinutes || x.plannedMinutes;
    await save('sessions', x);
  },
  async sesFail(d){
    const x = C.sessions.find(s => s.id === d.id); if (!x) return;
    x.status = 'incomplete'; await save('sessions', x);
  },
  async sesDel(d){ if (confirm('حذف هذه الجلسة؟')) await remove('sessions', d.id); },
  async sesResched(){
    const tomorrow = ymd(addDays(new Date(), 1));
    const list = C.sessions.filter(x => x.status === 'incomplete');
    if (!list.length) return toast('لا توجد جلسات غير مكتملة لإعادة جدولتها');
    for (const x of list) await DB.put('sessions', { ...x, status:'planned', date: tomorrow, start:'' });
    toast(`تم نقل ${list.length} جلسة إلى الغد`);
    await loadAll(); render();
  },
  planGen(d){ openPlanForm(d.id); },

  pomoToggle(){ POMO.running ? pomoPause() : pomoStart(); },
  pomoReset(){ pomoReset(); },
  async pomoSave(){
    const spent = Math.round((pomoTotal() - POMO.left) / 60);
    if (spent < 1) return toast('لم تنجز دقيقة كاملة بعد');
    pomoPause();
    await save('sessions', { id: uid(), subjectId: POMO.subjectId, topic: POMO.topic, date: today(), start:'', plannedMinutes: spent, actualMinutes: spent, goal:'جلسة يدوية', status:'completed', notes:'' });
    POMO.left = pomoTotal();
    toast(`تم حفظ ${spent} دقيقة`);
  },

  subNew(){ openSubjectForm(null); },
  async subDel(d){
    const s = subById(d.id); if (!s) return;
    if (!confirm(`حذف المادة "${s.name}"؟ سيُحذف معها محاضراتها وتكاليفها واختباراتها وملاحظاتها وجلساتها. لا يمكن التراجع.`)) return;
    const lecIds = C.lectures.filter(l => l.subjectId === d.id).map(l => l.id);
    for (const a of C.attendance.filter(a => lecIds.includes(a.lectureId))) await DB.del('attendance', a.id);
    for (const id of lecIds) await DB.del('lectures', id);
    for (const x of C.tasks.filter(x => x.subjectId === d.id)) await DB.del('tasks', x.id);
    for (const x of C.sessions.filter(x => x.subjectId === d.id)) await DB.del('sessions', x.id);
    for (const x of C.notes.filter(x => x.subjectId === d.id)) await DB.del('notes', x.id);
    for (const x of C.exams.filter(x => x.subjectId === d.id)) await DB.del('exams', x.id);
    await DB.del('subjects', d.id);
    await loadAll();
    location.hash = '#/subjects';
    render();
  },

  attPeriod(d){ V.attPeriod = d.v; render(); },

  examNew(){ openExamForm(null); },
  examEdit(d){ openExamForm(C.exams.find(x => x.id === d.id)); },
  async examDel(d){ if (confirm('حذف هذا الاختبار؟')) await remove('exams', d.id); },

  noteNew(d){ openNoteForm(null, d.sub || ''); },
  noteEdit(d){ openNoteForm(C.notes.find(n => n.id === d.id)); },
  async noteDel(d){ if (confirm('حذف هذه الملاحظة؟')) await remove('notes', d.id); },

  async notifRead(d){
    const n = C.notifications.find(x => x.id === d.id); if (!n) return;
    n.read = true; await save('notifications', n); updateBadge();
  },
  async notifDel(d){ await remove('notifications', d.id); },
  async notifClear(){
    if (!confirm('مسح كل التنبيهات؟')) return;
    for (const n of C.notifications) await DB.del('notifications', n.id);
    await loadAll(); render();
  },
  notifPerm(){
    if (!('Notification' in window)) return toast('متصفحك لا يدعم الإشعارات');
    Notification.requestPermission().then(p => toast(p === 'granted' ? 'تم تفعيل إشعارات المتصفح ✔' : 'لم يتم السماح بالإشعارات'));
  },

  theme(d){ saveSettings({ theme: d.v }); },
  accent(d){ saveSettings({ accent: d.v }); },
  bg(d){ saveSettings({ bg: d.v }); },

  async exportData(){
    const data = await DB.exportAll();
    const blob = new Blob([JSON.stringify({ app:'unimate', version: APP_VERSION, exportedAt: new Date().toISOString(), data }, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `unimate-backup-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('تم تنزيل النسخة الاحتياطية');
  },
  async resetAll(){
    if (!confirm('هل أنت متأكد من مسح كل البيانات؟ لا يمكن التراجع عن ذلك.')) return;
    if (!confirm('تأكيد أخير: سيتم حذف الملف الشخصي والمواد والمحاضرات والتكاليف كلها.')) return;
    await DB.clearAll();
    POMO.running = false; clearInterval(POMO.timer); POMO.left = 25*60;
    await loadAll();
    location.hash = '#/welcome';
    render();
  }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (!fn) return;
  if (el.tagName === 'INPUT' && el.type === 'file') return;
  if (el.tagName === 'INPUT' && el.type === 'checkbox') return;
  e.preventDefault();
  Promise.resolve(fn(el.dataset, el)).catch(err => { console.error(err); toast('حدث خطأ: ' + err.message); });
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.act === 'subToggle') return ACT.subToggle(el.dataset, el).catch(console.error);
  if (el.dataset.act === 'importData') return importBackup(el.files[0]);
  if (el.dataset.act === 'photoPick') return readPhoto(el.files[0]);
});


/* ---------- الاستيراد ---------- */
async function importBackup(file){
  if (!file) return;
  try {
    const obj = JSON.parse(await file.text());
    if (obj.app !== 'unimate' || !obj.data) throw new Error('الملف ليس نسخة احتياطية من التطبيق');
    if (!confirm('سيتم استبدال كل البيانات الحالية بمحتوى النسخة. متابعة؟')) return;
    await DB.replaceAll(obj.data);
    await loadAll();
    toast('تم استيراد النسخة بنجاح');
    location.hash = '#/home';
    render();
  } catch (err) {
    toast('تعذر الاستيراد: ' + err.message);
  }
}

/* ---------- الصورة الشخصية ---------- */
function readPhoto(file){
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    const max = 256, scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = img.width * scale; c.height = img.height * scale;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    V.pendingPhoto = c.toDataURL('image/jpeg', 0.85);
    render();
  };
  img.src = URL.createObjectURL(file);
}

/* ===================================================
   النماذج (Forms)
=================================================== */
function subjectOptions(selected){
  return C.subjects.map(s => `<option value="${s.id}" ${selected===s.id?'selected':''}>${esc(s.name)}</option>`).join('');
}
function needSubjects(){
  if (C.subjects.length) return false;
  toast('أضف مادة أولاً');
  location.hash = '#/subjects';
  return true;
}

function openLectureForm(l){
  if (needSubjects()) return;
  const d = l ? l.day : dayIdx(parseYMD(V.schedDate));
  openModal(l ? 'تعديل محاضرة' : 'إضافة محاضرة', `
    <form data-form="lecture" data-id="${l?l.id:''}">
      <label>المادة</label><select name="subjectId" required>${subjectOptions(l?.subjectId)}</select>
      <div class="row">
        <div><label>اليوم</label><select name="day">${DAYS.map((x,i)=>`<option value="${i}" ${i===d?'selected':''}>${x}</option>`).join('')}</select></div>
        <div><label>نوع المحاضرة</label><select name="type">${['نظري','عملي'].map(x=>`<option ${l?.type===x?'selected':''}>${x}</option>`).join('')}</select></div>
      </div>
      <div class="row">
        <div><label>من</label><input name="start" type="time" required value="${l?.start||'08:00'}"></div>
        <div><label>إلى</label><input name="end" type="time" required value="${l?.end||'09:00'}"></div>
      </div>
      <div class="row">
        <div><label>القاعة أو المعمل</label><input name="hall" value="${esc(l?.hall)}"></div>
        <div><label>اسم الدكتور</label><input name="doctor" value="${esc(l?.doctor)}"></div>
      </div>
      <label>ملاحظات (اختياري)</label><textarea name="notes">${esc(l?.notes)}</textarea>
      <button class="btn block" type="submit">حفظ المحاضرة</button>
    </form>`);
}

function openCopyDay(){
  const from = dayIdx(parseYMD(V.schedDate));
  if (!lecturesOn(from).length) return toast('لا توجد محاضرات في هذا اليوم لنسخها');
  openModal('نسخ جدول اليوم', `
    <form data-form="copyDay" data-from="${from}">
      <p class="muted">سيتم نسخ محاضرات ${DAYS[from]} إلى اليوم الذي تختاره.</p>
      <label>إلى يوم</label>
      <select name="target">${DAYS.map((x,i)=> i===from?'':`<option value="${i}">${x}</option>`).join('')}</select>
      <button class="btn block" type="submit">نسخ</button>
    </form>`);
}

function openTaskForm(x){
  if (needSubjects()) return;
  const t = today();
  const sub = x?.subjectId || C.subjects[0].id;
  const lecs = C.lectures.filter(l => l.subjectId === sub);
  openModal(x ? 'تعديل تكليف' : 'إضافة تكليف', `
    <form data-form="task" data-id="${x?x.id:''}">
      <label>عنوان التكليف</label><input name="title" required value="${esc(x?.title)}">
      <div class="row">
        <div><label>المادة</label><select name="subjectId">${subjectOptions(sub)}</select></div>
        <div><label>المحاضرة المرتبطة (اختياري)</label><select name="lectureId"><option value="">بدون</option>${C.lectures.map(l=>`<option value="${l.id}" ${x?.lectureId===l.id?'selected':''}>${esc(subName(l.subjectId))} - ${DAYS[l.day]} ${fmtT(l.start)}</option>`).join('')}</select></div>
      </div>
      <label>وصف المطلوب</label><textarea name="description">${esc(x?.description)}</textarea>
      <div class="row">
        <div><label>تاريخ الاستلام</label><input name="receivedDate" type="date" value="${x?.receivedDate || t}"></div>
        <div><label>تاريخ التسليم</label><input name="dueDate" type="date" value="${x?.dueDate || t}"></div>
        <div><label>وقت التسليم</label><input name="dueTime" type="time" value="${x?.dueTime||''}"></div>
      </div>
      <div class="row">
        <div><label>التنفيذ</label><select name="mode"><option value="today" ${x?.mode==='today'?'selected':''}>في نفس اليوم</option><option value="later" ${x?.mode!=='today'?'selected':''}>في موعد لاحق</option></select></div>
        <div><label>الأولوية</label><select name="priority">${PRIORITY.map(p=>`<option ${(x?.priority||'متوسطة')===p?'selected':''}>${p}</option>`).join('')}</select></div>
        <div><label>الحالة</label><select name="status">${TASK_STATUS.map(p=>`<option ${(x?.status||'لم يبدأ')===p?'selected':''}>${p}</option>`).join('')}</select></div>
      </div>
      <div class="row">
        <div><label>التذكير قبل التسليم (أيام)</label><input name="reminderDays" type="number" min="0" max="14" value="${x?.reminderDays ?? 1}"></div>
        <div><label>الوقت المتوقع (ساعات)</label><input name="estimateHours" type="number" min="0" step="0.5" value="${x?.estimateHours||''}"></div>
      </div>
      <label>المهام الفرعية (سطر لكل مهمة)</label>
      <textarea name="subtasks">${esc((x?.subtasks||[]).map(s=>s.title).join('\n'))}</textarea>
      <label>ملاحظاتك</label><textarea name="notes">${esc(x?.notes)}</textarea>
      <button class="btn block" type="submit">حفظ التكليف</button>
    </form>`);
}

function openSessionForm(x){
  if (needSubjects()) return;
  const dateDefault = x?.date || V.studyWeek || today();
  openModal(x ? 'تعديل جلسة / نقلها' : 'جلسة مذاكرة جديدة', `
    <form data-form="session" data-id="${x?x.id:''}">
      <label>المادة</label><select name="subjectId">${subjectOptions(x?.subjectId)}</select>
      <label>الموضوع</label><input name="topic" value="${esc(x?.topic)}">
      <div class="row">
        <div><label>التاريخ</label><input name="date" type="date" required value="${dateDefault}"></div>
        <div><label>وقت البداية</label><input name="start" type="time" value="${x?.start||''}"></div>
        <div><label>المدة (دقيقة)</label><input name="plannedMinutes" type="number" min="5" max="480" required value="${x?.plannedMinutes||50}"></div>
      </div>
      <label>الهدف من الجلسة</label><input name="goal" value="${esc(x?.goal)}">
      ${x ? `<label>الحالة</label><select name="status">${['planned','completed','incomplete'].map(s=>`<option value="${s}" ${x.status===s?'selected':''}>${{planned:'مخطط',completed:'مكتمل',incomplete:'لم يكتمل'}[s]}</option>`).join('')}</select>` : ''}
      <button class="btn block" type="submit">حفظ الجلسة</button>
    </form>`);
}

function openPlanForm(subjectId){
  const s = subById(subjectId);
  if (!s) return toast('اختر مادة أولاً');
  if (!s.examDate) return toast('حدد موعد الاختبار لهذه المادة أولاً');
  openModal(`خطة مراجعة: ${esc(s.name)}`, `
    <form data-form="planGen" data-id="${s.id}">
      <p class="muted">سيتم توزيع موضوعات المادة على الأيام الباقية حتى الاختبار (${fmtShort(s.examDate)}).</p>
      <div class="row">
        <div><label>مدة الجلسة (دقيقة)</label><input name="minutes" type="number" min="15" max="180" value="50"></div>
        <div><label>تبدأ من</label><input name="from" type="date" value="${today()}"></div>
      </div>
      <button class="btn block" type="submit">إنشاء الخطة</button>
    </form>`);
}

function openSubjectForm(s){
  openModal('إضافة مادة', `
    <form data-form="subjectNew">
      <label>اسم المادة</label><input name="name" required>
      <div class="row">
        <div><label>اسم الدكتور</label><input name="doctor"></div>
        <div><label>لون المادة</label><input name="color" type="color" value="${ACCENTS[C.subjects.length % ACCENTS.length]}"></div>
      </div>
      <div class="row">
        <div><label>عدد الفصول/الوحدات</label><input name="units" type="number" min="0"></div>
        <div><label>الصعوبة</label><select name="difficulty"><option>سهل</option><option selected>متوسط</option><option>صعب</option></select></div>
      </div>
      <div class="row">
        <div><label>موعد الاختبار</label><input name="examDate" type="date"></div>
        <div><label>ساعات المذاكرة المستهدفة</label><input name="targetHours" type="number" min="0"></div>
      </div>
      <button class="btn block" type="submit">إضافة المادة</button>
    </form>`);
}

function openExamForm(x){
  if (needSubjects()) return;
  openModal(x ? 'تعديل اختبار' : 'إضافة اختبار', `
    <form data-form="exam" data-id="${x?x.id:''}">
      <label>المادة</label><select name="subjectId">${subjectOptions(x?.subjectId)}</select>
      <label>عنوان الاختبار</label><input name="title" required value="${esc(x?.title||'اختبار')}">
      <div class="row">
        <div><label>التاريخ</label><input name="date" type="date" required value="${x?.date||today()}"></div>
        <div><label>الوقت</label><input name="time" type="time" value="${x?.time||''}"></div>
      </div>
      <label>المكان</label><input name="place" value="${esc(x?.place)}">
      <button class="btn block" type="submit">حفظ الاختبار</button>
    </form>`);
}

function openNoteForm(n, subId){
  if (needSubjects()) return;
  openModal(n ? 'تعديل ملاحظة' : 'ملاحظة جديدة', `
    <form data-form="note" data-id="${n?n.id:''}">
      <label>المادة</label><select name="subjectId">${subjectOptions(n?.subjectId || subId)}</select>
      <label>العنوان</label><input name="title" required value="${esc(n?.title)}">
      <label>المحتوى</label><textarea name="body" style="min-height:160px">${esc(n?.body)}</textarea>
      <button class="btn block" type="submit">حفظ الملاحظة</button>
    </form>`);
}

/* ---------- معالجة الإرسال ---------- */
const FORMS = {
  async profile(f, d){
    if (!d.name.trim()) return toast('الاسم مطلوب');
    if (+d.age < 15 || +d.age > 80) return toast('أدخل عمراً صحيحاً');
    const p = {
      id:'me', name:d.name.trim(), age:+d.age, level:d.level,
      university:d.university.trim(), faculty:d.faculty.trim(), major:d.major.trim(),
      photo: V.pendingPhoto ?? C.profile?.photo ?? ''
    };
    V.pendingPhoto = null;
    const isNew = !C.profile;
    await save('profile', p);
    toast(isNew ? 'مرحباً بك في رفيق الجامعة 🎓' : 'تم حفظ الملف الشخصي ✔');
    location.hash = '#/home';
  },

  async lecture(f, d){
    if (toMin(d.end) <= toMin(d.start)) return toast('وقت النهاية يجب أن يكون بعد البداية');
    const id = f.dataset.id || uid();
    const exists = C.lectures.find(l => l.id === id);
    const clash = C.lectures.find(l => l.id !== id && l.day === +d.day && toMin(l.start) < toMin(d.end) && toMin(d.start) < toMin(l.end));
    if (clash && !confirm(`يوجد تعارض مع محاضرة ${subName(clash.subjectId)} في نفس الوقت. متابعة الحفظ؟`)) return;
    await save('lectures', { id, subjectId:d.subjectId, day:+d.day, start:d.start, end:d.end, hall:d.hall.trim(), doctor:d.doctor.trim(), type:d.type, notes:d.notes.trim() });
    closeModal();
    toast(exists ? 'تم تعديل المحاضرة' : 'تمت إضافة المحاضرة');
  },

  async copyDay(f, d){
    const from = +f.dataset.from, to = +d.target;
    const list = lecturesOn(from);
    for (const l of list) await DB.put('lectures', { ...l, id: uid(), day: to });
    await loadAll();
    closeModal();
    toast(`تم نسخ ${list.length} محاضرة إلى ${DAYS[to]}`);
    render();
  },

  async task(f, d){
    if (!d.title.trim()) return toast('عنوان التكليف مطلوب');
    const id = f.dataset.id || uid();
    const old = C.tasks.find(x => x.id === id);
    const oldSub = old?.subtasks || [];
    const subtasks = d.subtasks.split('\n').map(s=>s.trim()).filter(Boolean).map(title => {
      const prev = oldSub.find(s => s.title === title);
      return { title, done: prev ? prev.done : false };
    });
    const status = d.status;
    const obj = {
      id, title:d.title.trim(), subjectId:d.subjectId, lectureId:d.lectureId,
      description:d.description.trim(), receivedDate:d.receivedDate, dueDate:d.dueDate, dueTime:d.dueTime,
      mode:d.mode, priority:d.priority, status, reminderDays:+d.reminderDays || 0,
      estimateHours: d.estimateHours ? +d.estimateHours : '', subtasks, notes:d.notes.trim(),
      completedAt: isDone({status}) ? (old?.completedAt || new Date().toISOString()) : ''
    };
    await save('tasks', obj);
    closeModal();
    toast(old ? 'تم تعديل التكليف' : 'تمت إضافة التكليف');
  },

  async session(f, d){
    const id = f.dataset.id || uid();
    const old = C.sessions.find(x => x.id === id);
    const minutes = +d.plannedMinutes;
    const same = C.sessions.filter(x => x.id !== id && x.subjectId === d.subjectId && x.date === d.date)
                  .reduce((s,x)=>s+(x.plannedMinutes||0), 0);
    if (same + minutes > C.settings.maxStudyPerSubject)
      toast(`تنبيه: مجموع مذاكرة هذه المادة في ${fmtShort(d.date)} تجاوز ${C.settings.maxStudyPerSubject} دقيقة`);
    const status = d.status || 'planned';
    await save('sessions', {
      id, subjectId:d.subjectId, topic:d.topic.trim(), date:d.date, start:d.start,
      plannedMinutes:minutes, actualMinutes: status==='completed' ? (old?.actualMinutes || minutes) : (old?.actualMinutes||0),
      goal:d.goal.trim(), status, notes: old?.notes || ''
    });
    closeModal();
    toast(old ? 'تم تحديث الجلسة' : 'تمت إضافة الجلسة');
  },

  async planGen(f, d){
    const s = subById(f.dataset.id);
    const minutes = Math.min(+d.minutes || 50, C.settings.maxStudyPerSubject);
    const start = parseYMD(d.from);
    const end = parseYMD(s.examDate);
    const days = diffDays(ymd(start), s.examDate);
    if (days <= 0) return toast('موعد الاختبار قريب جداً أو مضى');
    const topics = (s.topics && s.topics.length) ? s.topics : Array.from({length: Math.max(1, s.units || 5)}, (_, i) => `الوحدة ${i+1}`);
    let count = 0;
    for (let i = 0; i < topics.length; i++) {
      const offset = Math.floor(i * days / topics.length);
      const date = ymd(addDays(start, offset));
      if (date >= s.examDate) continue;
      await DB.put('sessions', { id: uid(), subjectId: s.id, topic: topics[i], date, start:'', plannedMinutes: minutes, actualMinutes: 0, goal:'مراجعة قبل الاختبار', status:'planned', notes:'' });
      count++;
    }
    // جلسة مراجعة أخيرة قبل الاختبار بيوم
    const review = ymd(addDays(end, -1));
    if (review >= d.from) {
      await DB.put('sessions', { id: uid(), subjectId: s.id, topic:'مراجعة شاملة', date: review, start:'', plannedMinutes: minutes, actualMinutes:0, goal:'مراجعة نهائية', status:'planned', notes:'' });
      count++;
    }
    await loadAll();
    closeModal();
    toast(`تم إنشاء ${count} جلسة مراجعة`);
    render();
  },

  async subject(f, d){
    const id = f.dataset.id || uid();
    await saveSubject(id, d, f);
  },
  async subjectNew(f, d){
    if (!d.name.trim()) return toast('اسم المادة مطلوب');
    const id = uid();
    await saveSubject(id, d, f, true);
  },

  async exam(f, d){
    const id = f.dataset.id || uid();
    await save('exams', { id, subjectId:d.subjectId, title:d.title.trim(), date:d.date, time:d.time, place:d.place.trim() });
    closeModal(); toast('تم حفظ الاختبار');
  },

  async note(f, d){
    const id = f.dataset.id || uid();
    await save('notes', { id, subjectId:d.subjectId, title:d.title.trim(), body:d.body, updatedAt:new Date().toISOString() });
    closeModal(); toast('تم حفظ الملاحظة');
  },

  async settings(f, d){
    const notif = {};
    Object.keys(DEFAULT_SETTINGS.notif).forEach(k => { notif[k] = !!f.elements.namedItem('n_' + k)?.checked; });
    const pw = Math.max(5, Math.min(120, +d.pomoWork || 25));
    const pb = Math.max(1, Math.min(60, +d.pomoBreak || 5));
    await saveSettings({
      pomoWork: pw, pomoBreak: pb, leadMin: +d.leadMin,
      absenceDefault: Math.max(0, Math.min(100, +d.absenceDefault || 0)),
      maxStudyPerSubject: Math.max(30, +d.maxStudyPerSubject || 120),
      dailyTime: d.dailyTime, termStart: d.termStart, termEnd: d.termEnd,
      weekStart: +d.weekStart, timeFormat: d.timeFormat,
      fontScale: Math.max(85, Math.min(130, +d.fontScale || 100)),
      notif
    });
    POMO.left = pomoTotal();
    toast('تم حفظ الإعدادات');
  }
};

async function saveSubject(id, d, f, isNew){
  const topics = d.topics ? d.topics.split('\n').map(x=>x.trim()).filter(Boolean) : [];
  const old = subById(id) || {};
  const obj = {
    id, name: d.name.trim(), doctor: (d.doctor||'').trim(), color: d.color || '#6c5ce7',
    units: d.units ? +d.units : '', difficulty: d.difficulty || 'متوسط',
    readiness: d.readiness !== undefined ? clamp(+d.readiness || 0) : (old.readiness || 0),
    examDate: d.examDate || '', targetHours: d.targetHours ? +d.targetHours : (old.targetHours || ''),
    absenceLimit: (d.absenceLimit === '' || d.absenceLimit === undefined) ? null : clamp(+d.absenceLimit),
    topics: d.topics !== undefined ? topics : (old.topics || []),
    refs: d.refs !== undefined ? d.refs : (old.refs || ''),
    reviewPoints: d.reviewPoints !== undefined ? d.reviewPoints : (old.reviewPoints || '')
  };
  await save('subjects', obj);
  closeModal();
  toast(isNew ? 'تمت إضافة المادة' : 'تم حفظ المادة');
  if (isNew) location.hash = '#/subject/' + id;
}

document.addEventListener('submit', e => {
  const f = e.target;
  if (!f.dataset.form) return;
  e.preventDefault();
  const fn = FORMS[f.dataset.form];
  if (!fn) return;
  const d = Object.fromEntries(new FormData(f));
  Promise.resolve(fn(f, d)).catch(err => { console.error(err); toast('حدث خطأ: ' + err.message); });
});

/* ===================================================
   التشغيل
=================================================== */
async function boot(){
  try {
    await openDB();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch (e) {
    toast('تعذر فتح قاعدة البيانات على هذا المتصفح');
    console.error(e);
  }
  await loadAll();
  if (!location.hash) location.hash = C.profile ? '#/home' : '#/welcome';
  render();
  await runAlerts();
  updateBadge();
  setInterval(() => runAlerts().catch(console.error), 30000);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
boot();

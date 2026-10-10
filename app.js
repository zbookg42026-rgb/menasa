(() => {
'use strict';

/* ===== الثوابت والحالة ===== */
const KEY = 'edu-platform-v1';
const SESS = 'ep-session';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9);
const pad = n => String(n).padStart(2, '0');
const date = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateTime = () => { const d = new Date(); return `${date(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const dateAfter = n => { const d = new Date(); d.setDate(d.getDate() + n); return date(d); };
const subDays = end => end ? Math.ceil((new Date(end + 'T23:59:59') - new Date()) / 864e5) : null;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => Number(n || 0).toLocaleString('ar-EG') + ' ج.م';
function courseDebt(c) { return Math.max(0, (Number(c.studentsCount || 0) - Number(c.settledStudents || 0))) * (Number(c.price) || 0) * (100 - (Number(c.commission) || 0)) / 100; }
function courseSalary(c) { return Number(c.studentsCount || 0) * (Number(c.price) || 0) * (Number(c.commission) || 0) / 100; }
function teacherDebt(t) { return (t.courses || []).reduce((a, c) => a + courseDebt(c), 0); }
function teacherSalary(t) { return (t.courses || []).reduce((a, c) => a + courseSalary(c), 0); }
const find = (coll, id) => db[coll].find(x => x.id === id);
const PROVIDERS = { vodafone: 'فودافون كاش', instapay: 'إنستا باي', etisalat: 'اتصالات كاش', orange: 'أورنج كاش', we: 'وي كاش', bank: 'حساب بنكي' };
const PROVIDER_ICON = { vodafone: '🔴', instapay: '🟣', etisalat: '🟢', orange: '🟠', we: '🟡', bank: '🏦' };
const TYPE_LABEL = { wallet: 'محفظة إلكترونية', instapay: 'إنستا باي' };
const FIELD_TYPES = { text: 'نص قصير', number: 'رقم', textarea: 'نص طويل', select: 'قائمة اختيار', date: 'تاريخ' };
const ARABIC_NAME_REGEX = /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]+$/;

let db = load();

/* ===== مزامنة فورية مع السيرفر (قاعدة البيانات) + نسخ احتياطي تلقائي ===== */
let serverRev = parseInt(localStorage.getItem(KEY + '-rev') || '0', 10) || 0;
let pushTimer = null;
let pushing = false;

async function pushToServer() {
  if (pushing) return;
  pushing = true;
  try {
    const r = await fetch('api.php?action=save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rev: serverRev, data: db })
    });
    const j = await r.json();
    if (j && j.ok) {
      serverRev = j.rev;
      localStorage.setItem(KEY + '-rev', String(serverRev));
    } else if (j && j.conflict) {
      /* جهاز آخر حفظ بيانات أحدث — نعتمد نسخة السيرفر ونحدث الشاشة */
      serverRev = j.rev;
      localStorage.setItem(KEY + '-rev', String(serverRev));
      db = migrate(j.data);
      localStorage.setItem(KEY, JSON.stringify(db));
      if (session) render();
      toast('تم تحديث البيانات من جهاز آخر.', 'success');
    }
  } catch (e) { /* لا يوجد اتصال — تبقى النسخة المحلية وتُرفع عند عودة الاتصال مع أول حفظ تالٍ */ }
  pushing = false;
}
function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(pushToServer, 400); }

/* عند الفتح: اسحب أحدث نسخة من السيرفر — هكذا تظهر نفس البيانات على كل الأجهزة */
(async function pullFromServer() {
  try {
    const r = await fetch('api.php?action=load', { cache: 'no-store' });
    const j = await r.json();
    if (j && j.ok && j.data && j.rev > serverRev) {
      serverRev = j.rev;
      localStorage.setItem(KEY + '-rev', String(serverRev));
      db = migrate(j.data);
      localStorage.setItem(KEY, JSON.stringify(db));
      render();
    } else if (j && j.ok && j.data === null && serverRev === 0) {
      /* السيرفر فارغ — ارفع النسخة المحلية الحالية */
      pushToServer();
    }
  } catch (e) {}
})();
let session = loadSession();
let page = 'dashboard';
let loginRole = 'admin';
let sortDir = {};
let filters = { payStatus: 'all', supStatus: 'all', msgType: 'all', msgStatus: 'all', stuStatus: 'all', courseTeacher: 'all' };
let pubState = null;
let fbFields = []; // حقول النموذج أثناء التحرير (محرر كامل)
let studentMode = 'login'; // دخول الطالب: login | register | code
let returnHash = null; // رجوع الطالب للنموذج بعد تسجيل الدخول
let menuOpen = false; // حالة قائمة التنقل (زر الفتح والإغلاق)

function seed() {
  return {
    settings: { platformName: 'منصتي التعليمية', bannerImage: 'https://h.top4top.io/p_3423g6lfx0.jpg', grades: ['الصف الأول الإعدادي', 'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي', 'الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي'], dark: false, socials: { facebook: 'https://fb.openinapp.co/g33m5', youtube: 'https://youtube.com/@edu-nileacademy', whatsapp: '201286085786', tiktok: 'https://openinapp.link/xs908', googleplay: 'https://www.appcreator24.com/app4204296-jfk8x6' }, theme: { primary: '', primaryDark: '', sidebar: '' }, logoLight: '', logoDark: '' },
    users: [{ id: 'u-admin', name: 'مدير النظام', username: 'admin', password: '1234' }],
    teachers: [{ id: 't-demo', name: 'أ/ محمود السيد', username: 'mahmoud', password: '1234', phone: '01000000001', specialty: 'رياضيات', subscriptionEnd: dateAfter(60), subscriptionType: 'monthly', subscriptionPrice: 150, photo: '', platformLink: '', pubShow: { photo: true, name: true, specialty: true, link: true }, courses: [{ id: 'c-1', title: 'كورس الرياضيات — الصف الأول الثانوي', price: 300, commission: 40, link: '', studentsCount: 20, settledStudents: 0 }], payAccounts: [
      { id: 'pa-1', label: 'فودافون كاش', number: '01204635599', provider: 'vodafone' },
      { id: 'pa-2', label: 'إنستا باي', number: '01030068105', provider: 'instapay' }
    ] }],
    supervisors: [{ id: 'sp-demo', name: 'أ/ كريم عبد الله', username: 'kareem', password: '1234', phone: '01000000002', specialty: 'الدعم العلمي — رياضيات', subscriptionEnd: dateAfter(90), subscriptionType: 'monthly', subscriptionPrice: 100, ownerTeacherId: 't-demo' }],
    students: [{ id: 'st-demo', name: 'أحمد محمد علي', username: 'ahmed', password: '1234', phone: '01122334455', grade: 'الصف الأول الثانوي', createdAt: date() }],
    settlements: [],
    store: [{ id: 'tool-demo', title: 'كوبون كارد ستوديو برو', description: 'أداة إنشاء كوبونات دفع احترافية قابلة للتصدير PDF — للمعلمين والطلاب', icon: '🎟️', fileRef: 'tools/coupon-card-studio-pro.html', fileName: 'coupon-card-studio-pro.html', price: 150, duration: 30, trialDays: 3, forWhom: ['student', 'teacher'], active: true, createdAt: date() }],
    purchases: [],
    forms: [
      { id: 'f-pay', type: 'payment', title: 'تأكيد الدفع', teacherId: 't-demo', route: 'teacher', supervisorId: '', active: true, createdAt: date(), fields: [], defs: [], desc: '', successMsg: '' },
      { id: 'f-sup', type: 'support', title: 'الدعم العلمي', teacherId: 't-demo', route: 'supervisor', supervisorId: 'sp-demo', active: true, createdAt: date(), fields: [
        { id: 'cf-subject', key: 'cf-subject', label: 'المادة الدراسية', type: 'select', required: false, options: ['رياضيات', 'فيزياء', 'كيمياء', 'أحياء', 'لغة عربية', 'لغة إنجليزية'] }
      ], defs: [], desc: '', successMsg: '' }
    ],
    submissions: [
      { id: 'sub-1', formId: 'f-pay', formType: 'payment', teacherId: 't-demo', supervisorId: '', studentId: 'st-demo', studentCode: '482913', name: 'أحمد محمد علي', grade: 'الصف الأول الثانوي', createdAt: dateTime(), status: 'new', reply: '', image: '', data: { amount: '300', targetNumber: '01204635599', targetLabel: 'فودافون كاش', transferType: 'wallet', senderPhone: '01122334455', transactionNumber: '', accountNumber: '', notes: 'دفعة الحصة الأولى', custom: {}, customLabels: {} } },
      { id: 'sub-2', formId: 'f-sup', formType: 'support', teacherId: 't-demo', supervisorId: 'sp-demo', studentId: '', studentCode: '731640', name: 'سارة خالد إبراهيم', grade: 'الصف الثاني الإعدادي', createdAt: dateTime(), status: 'resolved', reply: 'المقلوب هو 1 على العدد، أما الاقتران فهو العدد نفسه مع تغيير إشارة الجزء التخيلي — راجعي فيديو الدرس الثالث.', image: '', data: { question: 'ما الفرق بين الاقتران والمقلوب في الأعداد المركبة؟', notes: '', custom: { 'cf-subject': 'رياضيات' }, customLabels: { 'cf-subject': 'المادة الدراسية' } } }
    ],
    activity: [
      { id: uid(), at: dateTime(), who: 'مدير النظام', text: 'أنشأ حساب معلم: أ/ محمود السيد' },
      { id: uid(), at: dateTime(), who: 'أ/ محمود السيد', text: 'أنشأ نموذج دفع «تأكيد الدفع»' }
    ]
  };
}
function defaultDefs(type, customFields = []) {
  const base = type === 'payment' ? [
    { key: 'name', label: 'اسم الطالب', type: 'text', required: true, placeholder: 'مثال: أحمد محمد علي', hint: 'ثلاثي على الأقل — بالعربية', enabled: true },
    { key: 'grade', label: 'الصف الدراسي', type: 'grade', required: true, placeholder: '', hint: '', enabled: true },
    { key: 'amount', label: 'المبلغ المرسل', type: 'number', required: true, placeholder: 'أدخل المبلغ المرسل', hint: '', enabled: true },
    { key: 'target', label: 'الرقم الذي تم التحويل عليه', type: 'target', required: true, placeholder: '', hint: 'اضغط للنسخ التلقائي', enabled: true },
    { key: 'transferType', label: 'نوع التحويل', type: 'transfer', required: true, placeholder: '', hint: '', enabled: true },
    { key: 'sender', label: 'الرقم الذي تم التحويل منه', type: 'phone', required: true, placeholder: 'أدخل 11 رقم', hint: '', enabled: true },
    { key: 'transaction', label: 'رقم العملية', type: 'text', required: false, placeholder: 'أدخل رقم العملية', hint: '', enabled: true },
    { key: 'account', label: 'رقم الحساب', type: 'text', required: false, placeholder: 'أدخل رقم الحساب', hint: '', enabled: true },
    { key: 'image', label: 'صورة التحويل', type: 'image', required: true, placeholder: '', hint: 'تُرسل الصورة مع الرسالة تلقائياً', enabled: true },
    { key: 'notes', label: 'ملاحظات إضافية', type: 'textarea', required: false, placeholder: 'اكتب أي ملاحظات إضافية', hint: 'اختياري', enabled: true }
  ] : [
    { key: 'name', label: 'اسم الطالب', type: 'text', required: true, placeholder: 'مثال: أحمد محمد علي', hint: 'ثلاثي على الأقل — بالعربية', enabled: true },
    { key: 'grade', label: 'الصف الدراسي', type: 'grade', required: true, placeholder: '', hint: '', enabled: true },
    { key: 'question', label: 'نص السؤال', type: 'textarea', required: true, placeholder: 'اكتب سؤالك هنا بالتفصيل…', hint: 'اكتب سؤالك بالتفصيل', enabled: true },
    { key: 'image', label: 'صورة السؤال', type: 'image', required: false, placeholder: '', hint: 'اختياري', enabled: true },
    { key: 'notes', label: 'ملاحظات إضافية', type: 'textarea', required: false, placeholder: 'اكتب أي ملاحظات إضافية', hint: 'اختياري', enabled: true }
  ];
  return base.concat((customFields || []).map(x => ({ ...x, enabled: x.enabled !== false })));
}
function load() { try { const raw = localStorage.getItem(KEY); if (raw) { const d = JSON.parse(raw); if (d && Array.isArray(d.teachers)) return migrate(d); } } catch {} const fresh = migrate(seed()); try { localStorage.setItem(KEY, JSON.stringify(fresh)); } catch {} return fresh; }
function migrate(d) {
  if (!d.settings) d.settings = seed().settings;
  if (!d.settings.socials) d.settings.socials = { facebook: 'https://fb.openinapp.co/g33m5', youtube: 'https://youtube.com/@edu-nileacademy', whatsapp: '201286085786', tiktok: 'https://openinapp.link/xs908', googleplay: 'https://www.appcreator24.com/app4204296-jfk8x6' };
  else {
    const sc = d.settings.socials;
    ['facebook', 'youtube', 'whatsapp', 'tiktok', 'googleplay'].forEach(k => { if (sc[k] === undefined) sc[k] = ''; });
    if (!sc.facebook && !sc.youtube && !sc.whatsapp && !sc.tiktok && !sc.googleplay) {
      d.settings.socials = { facebook: 'https://fb.openinapp.co/g33m5', youtube: 'https://youtube.com/@edu-nileacademy', whatsapp: '201286085786', tiktok: 'https://openinapp.link/xs908', googleplay: 'https://www.appcreator24.com/app4204296-jfk8x6' };
    }
  }
  if (!d.settings.theme) d.settings.theme = { primary: '', primaryDark: '', sidebar: '' };
  if (d.settings.logoLight === undefined) d.settings.logoLight = '';
  if (d.settings.logoDark === undefined) d.settings.logoDark = '';
  if (!Array.isArray(d.forms)) d.forms = [];
  if (!Array.isArray(d.students)) d.students = [];
  d.students.forEach(s => { if (s.createdAt === undefined) s.createdAt = date(); });
  d.teachers.forEach(t => {
    if (!t.pubShow) t.pubShow = { photo: true, name: true, specialty: true, link: true };
    if (t.subscriptionType === undefined) t.subscriptionType = 'monthly';
    if (t.subscriptionPrice === undefined) t.subscriptionPrice = 0;
    if (!Array.isArray(t.courses)) t.courses = [];
    t.courses.forEach(c => {
      if (c.studentsCount === undefined) c.studentsCount = 0;
      if (c.settledStudents === undefined) c.settledStudents = 0;
    });
  });
  d.supervisors.forEach(s => {
    if (s.ownerTeacherId === undefined) s.ownerTeacherId = '';
    if (s.subscriptionType === undefined) s.subscriptionType = 'monthly';
    if (s.subscriptionPrice === undefined) s.subscriptionPrice = 0;
  });
  d.forms.forEach(f => {
    if (!Array.isArray(f.fields)) f.fields = [];
    f.fields.forEach(x => { if (!x.id) x.id = 'cf-' + uid(); if (!x.key) x.key = x.id; if (!Array.isArray(x.options)) x.options = []; });
    if (!Array.isArray(f.defs) || !f.defs.length) f.defs = defaultDefs(f.type, f.fields);
    f.defs.forEach(x => { if (!x.key) x.key = x.id || 'cf-' + uid(); if (x.enabled === undefined) x.enabled = true; if (!Array.isArray(x.options)) x.options = []; });
    if (f.desc === undefined) f.desc = '';
    if (f.successMsg === undefined) f.successMsg = '';
  });
  if (!Array.isArray(d.submissions)) d.submissions = [];
  if (!Array.isArray(d.settlements)) d.settlements = [];
  if (!Array.isArray(d.store)) d.store = [];
  d.store.forEach(t => {
    if (!Array.isArray(t.forWhom)) t.forWhom = ['student', 'teacher'];
    if (t.active === undefined) t.active = true;
    if (t.trialDays === undefined) t.trialDays = 0;
    if (t.duration === undefined) t.duration = 30;
  });
  if (!Array.isArray(d.purchases)) d.purchases = [];
  d.purchases.forEach(p => { if (!p.status) p.status = 'approved'; });
  d.submissions.forEach(s => {
    if (s.studentCode === undefined) s.studentCode = '';
    if (s.studentId === undefined) s.studentId = '';
  });
  return d;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); schedulePush(); return true; } catch { return false; } }
function loadSession() { try { return JSON.parse(sessionStorage.getItem(SESS)) || null; } catch { return null; } }
function setSession(s) { session = s; if (s) sessionStorage.setItem(SESS, JSON.stringify(s)); else sessionStorage.removeItem(SESS); }
function logAct(who, text) { db.activity.unshift({ id: uid(), at: dateTime(), who, text }); }

/* ===== أدوات التحقق ===== */
function validateStudentName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return { valid: false, message: 'يرجى إدخال اسم الطالب أولاً' };
  if (!ARABIC_NAME_REGEX.test(trimmed)) return { valid: false, message: 'يجب كتابة الاسم بالحروف العربية فقط (بدون أرقام أو رموز أو حروف إنجليزية)' };
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 3) return { valid: false, message: `يجب إدخال الاسم ثلاثي على الأقل (${words.length} من 3 كلمات). مثال: أحمد محمد علي` };
  if (words.some(w => w.length < 2)) return { valid: false, message: 'كل جزء من الاسم يجب أن يكون حرفين على الأقل' };
  const counts = {}; for (const w of words) { counts[w] = (counts[w] || 0) + 1; if (counts[w] > 2) return { valid: false, message: 'لا يمكن تكرار نفس الكلمة أكثر من مرتين في الاسم' }; }
  return { valid: true };
}
function credAccounts(ignore) {
  const list = [];
  db.users.forEach(u => list.push({ kind: 'مدير النظام', coll: 'users', id: u.id, username: u.username, phone: u.phone || '', password: u.password }));
  db.teachers.forEach(t => list.push({ kind: 'معلم', coll: 'teachers', id: t.id, username: t.username, phone: t.phone || '', password: t.password }));
  db.supervisors.forEach(s => list.push({ kind: 'إرشاف مختص', coll: 'supervisors', id: s.id, username: s.username, phone: s.phone || '', password: s.password }));
  db.students.forEach(s => list.push({ kind: 'طالب', coll: 'students', id: s.id, username: s.username, phone: s.phone || '', password: s.password }));
  return ignore ? list.filter(x => !(x.coll === ignore.coll && x.id === ignore.id)) : list;
}
function checkUniqueCredentials(username, phone, ignore) {
  const accounts = credAccounts(ignore);
  const un = String(username || '').trim();
  if (un) { const hit = accounts.find(a => a.username && a.username.toLowerCase() === un.toLowerCase()); if (hit) return `اسم المستخدم مستخدم بالفعل لحساب ${hit.kind} — اختر اسماً آخر.`; }
  const ph = String(phone || '').trim();
  if (ph) { const hit = accounts.find(a => a.phone && a.phone === ph); if (hit) return `رقم الهاتف مستخدم بالفعل لحساب ${hit.kind} — اختر رقماً آخر.`; }
  return false;
}

/* ===== أدوات الواجهة ===== */
function toast(msg, type = 'success') {
  const root = $('#toast-root'); if (!root) return alert(msg);
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.textContent = msg;
  root.append(el);
  setTimeout(() => el.remove(), 4200);
}
function loginAlert(msg, type = 'error') {
  const box = $('#login-alert');
  if (!box) return toast(msg, type);
  box.className = 'login-alert show ' + type;
  box.textContent = msg;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  clearTimeout(loginAlert._t);
  loginAlert._t = setTimeout(() => { box.className = 'login-alert'; }, 6000);
}
function clearLoginAlert() { const box = $('#login-alert'); if (box) box.className = 'login-alert'; }
function closeModal() { const r = $('#modal-root'); if (r) r.innerHTML = ''; }
function modal(title, bodyHTML, onSubmit, submitLabel = 'حفظ') {
  $('#modal-root').innerHTML = `<div class="modal-backdrop"><form class="modal" id="modal-form">
    <div class="modal-head"><h2>${esc(title)}</h2><button type="button" class="close" data-close-modal>✕</button></div>
    ${bodyHTML}
    ${onSubmit ? `<div class="modal-foot"><button type="button" class="btn btn-light" data-close-modal>إلغاء</button><button class="btn btn-primary">${esc(submitLabel)}</button></div>` : ''}
  </form></div>`;
  const backdrop = $('#modal-root .modal-backdrop');
  backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) closeModal(); });
  if (onSubmit) $('#modal-form').addEventListener('submit', e => { e.preventDefault(); onSubmit(new FormData(e.target)); });
}
function infoModal(title, bodyHTML) { modal(title, bodyHTML + `<div class="modal-foot"><button type="button" class="btn btn-light" data-close-modal>إغلاق</button></div>`, null); }
function field(name, label, value = '', type = 'text', required = false, attrs = '') {
  return `<div class="field"><label>${esc(label)} ${required ? '<span class="required">*</span>' : ''}</label><input name="${name}" type="${type}" value="${esc(value)}" ${required ? 'required' : ''} ${attrs}></div>`;
}
function selectField(name, label, value, options, required = false) {
  return `<div class="field"><label>${esc(label)} ${required ? '<span class="required">*</span>' : ''}</label><select name="${name}" ${required ? 'required' : ''}>${options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select></div>`;
}
function badge(text, type = 'neutral') { return `<span class="badge ${type}">${esc(text)}</span>`; }
function actionBtn(label, action, id, cls = 'action') { return `<button type="button" class="${cls}" data-action="${action}" data-id="${esc(id)}">${label}</button>`; }
function pageHead(title, subtitle = '', actions = '') { return `<div class="page-head"><div><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div><div class="actions">${actions}</div></div>`; }
function tableToolbar(placeholder = 'بحث…', extra = '') { return `<div class="toolbar"><input class="search" data-filter="table" placeholder="${esc(placeholder)}">${extra}</div>`; }
function emptyRow(cols, text = 'لا توجد بيانات بعد.') { return `<tr><td class="empty" colspan="${cols}">${esc(text)}</td></tr>`; }
function statusBadge(status) {
  if (status === 'confirmed') return badge('مؤكد', 'success');
  if (status === 'rejected') return badge('مرفوض', 'danger');
  if (status === 'resolved') return badge('تم الرد', 'success');
  return badge('جديد', 'info');
}
function exportCSV(name, headers, rows) {
  const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name + '-' + date() + '.csv';
  a.click();
  toast('تم تصدير الملف.');
}
async function copyText(text) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.append(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove(); return ok;
  } catch { return false; }
}
function formLink(form) { return `${location.origin}${location.pathname}#/form/${form.id}`; }
function teacherName(id) { const t = find('teachers', id); return t ? t.name : 'معلم محذوف'; }
function supervisorName(id) { const s = find('supervisors', id); return s ? s.name : 'إرشاف محذوف'; }
function renewModal(coll, id) {
  const item = find(coll, id); if (!item) return;
  const stype = item.subscriptionType === 'yearly' ? 'سنوي' : 'شهري';
  const price = Number(item.subscriptionPrice || 0);
  modal('تجديد الاشتراك — ' + item.name, `<div class="notice">الاشتراك الحالي: <b>${stype}</b> بقيمة <b>${money(price)}</b> — ينتهي: <b>${esc(item.subscriptionEnd || 'بدون اشتراك')}</b></div>
  <div class="form-grid">${selectField('days', 'مدة التجديد', item.subscriptionType === 'yearly' ? '365' : '30', [['7', 'أسبوع'], ['30', 'شهر'], ['90', '3 شهور'], ['180', '6 شهور'], ['365', 'سنة']], true)}
  ${price ? field('paid', `المبلغ المدفوع (المتوقع ${money(price)})`, String(price), 'number', false, 'min="0"') : ''}</div>`, data => {
    item.subscriptionEnd = dateAfter(Number(data.get('days') || 30));
    const paid = Number(data.get('paid') || 0);
    logAct(sessionLabel(), `جدّد اشتراك ${item.name} حتى ${item.subscriptionEnd}` + (paid ? ` — دفع ${money(paid)}` : ''));
    if (!save()) return toast('تعذر الحفظ — مساحة التخزين ممتلئة.', 'error');
    closeModal(); render(); toast(`تم تجديد اشتراك ${item.name} حتى ${item.subscriptionEnd}.`);
  }, 'تجديد');
}
function sessionLabel() {
  if (!session) return 'زائر';
  if (session.kind === 'admin') return find('users', session.id)?.name || 'مدير النظام';
  if (session.kind === 'teacher') return teacherName(session.id);
  if (session.kind === 'supervisor') return supervisorName(session.id);
  if (session.kind === 'student') {
    if (session.id) return find('students', session.id)?.name || 'طالب';
    const m = db.submissions.find(s => s.studentCode === session.code);
    return m ? m.name : 'طالب';
  }
  return 'زائر';
}
function studentAccName(id) { const s = find('students', id); return s ? s.name : 'طالب'; }
function studentSubmissions() {
  if (!session || session.kind !== 'student') return [];
  const seen = new Set(); const out = [];
  const add = list => list.forEach(s => { if (!seen.has(s.id)) { seen.add(s.id); out.push(s); } });
  if (session.id) add(db.submissions.filter(s => s.studentId === session.id));
  if (session.code) add(db.submissions.filter(s => s.studentCode === session.code));
  return out;
}

/* ===== التنقل والتخطيط ===== */
function roleNav() {
  if (!session) return [];
  if (session.kind === 'admin') return [
    ['dashboard', '🏠', 'الرئيسية'], ['teachers', '👨‍🏫', 'المعلمون'], ['supervisors', '🧑‍🔧', 'الإرشاف المختص'],
    ['forms', '📋', 'النماذج'], ['courses', '🎓', 'الكورسات'], ['store', '🛒', 'المتجر'], ['messages', '📨', 'كل الرسائل'], ['reports', '📊', 'تقارير الرسائل'], ['finreports', '💰', 'التقارير المالية'], ['accounts', '👥', 'الحسابات'], ['settings', '⚙️', 'الإعدادات']
  ];
  if (session.kind === 'teacher') return [
    ['dashboard', '🏠', 'الرئيسية'], ['forms', '📋', 'نماذجي'], ['mycourses', '🎓', 'كورساتي'], ['mytools', '🧰', 'أدواتي'], ['mysupervisors', '🧑‍🔧', 'مشرفو الدعم'], ['payments', '💰', 'رسائل الدفع'], ['support', '💡', 'الدعم العلمي'], ['store', '🛒', 'المتجر'], ['reports', '📊', 'تقارير الرسائل'], ['finreports', '💰', 'تقاريري المالية'], ['settings', '⚙️', 'الإعدادات']
  ];
  if (session.kind === 'supervisor') return [['dashboard', '🏠', 'الرئيسية'], ['support', '💡', 'أسئلة الدعم'], ['reports', '📊', 'تقاريري']];
  if (session.kind === 'student') {
    if (session.id) return [['dashboard', '📥', 'رسائلي والردود'], ['mytools', '🧰', 'أدواتي'], ['store', '🛒', 'المتجر'], ['settings', '⚙️', 'إعداداتي']];
    return [['dashboard', '📥', 'رسائلي والردود'], ['mycode', '🔗', 'رمز المتابعة']];
  }
  return [['dashboard', '📥', 'رسائلي والردود']];
}
function navBadges() {
  const b = {};
  if (session?.kind === 'teacher') {
    const mine = db.submissions.filter(s => s.teacherId === session.id);
    b.payments = mine.filter(s => s.formType === 'payment' && s.status === 'new').length;
    b.support = mine.filter(s => s.formType === 'support' && s.status === 'new').length;
  }
  if (session?.kind === 'supervisor') b.support = db.submissions.filter(s => s.supervisorId === session.id && s.status === 'new').length;
  if (session?.kind === 'admin') {
    b.messages = db.submissions.filter(s => s.status === 'new').length;
    b.store = db.purchases.filter(p => p.status === 'pending').length;
  }
  return b;
}
function socialLinksHTML() {
  const s = db.settings.socials || {};
  const wa = (s.whatsapp || '').replace(/[^0-9]/g, '');
  const items = [
    ['facebook', s.facebook, 'fab fa-facebook-f', 'فيسبوك'],
    ['youtube', s.youtube, 'fab fa-youtube', 'يوتيوب'],
    ['whatsapp', wa ? 'https://wa.me/' + wa : '', 'fab fa-whatsapp', 'واتساب'],
    ['tiktok', s.tiktok, 'fab fa-tiktok', 'تيك توك'],
    ['google-play', s.googleplay, 'fab fa-google-play', 'تطبيقنا على جوجل بلاي']
  ].filter(x => x[1]);
  if (!items.length) return '';
  return `<div class="social-links">${items.map(([cls, url, icon, label]) => `<a href="${esc(url)}" target="_blank" rel="noopener" class="${cls}" title="${label}" aria-label="${label}"><i class="${icon}"></i></a>`).join('')}</div>`;
}
function themeSwitchHTML(extraCls = '') {
  const dark = !!db.settings.dark;
  return `<button type="button" class="theme-switch ${dark ? 'night' : ''} ${extraCls}" data-action="dark" title="${dark ? 'التبديل للوضع النهاري' : 'التبديل للوضع الليلي'}" aria-label="تبديل الوضع الليلي"><span class="slider"><span class="star s1"></span><span class="star s2"></span><span class="star s3"></span><svg class="cloud" viewBox="0 0 16 16" aria-hidden="true"><path transform="matrix(.77976 0 0 .78395 -299.99 -418.63)" fill="#fff" d="m391.84 540.91c-.421-.329-.949-.524-1.523-.524-1.351 0-2.451 1.084-2.485 2.435-1.395.526-2.388 1.88-2.388 3.466 0 1.874 1.385 3.423 3.182 3.667v.034h12.73v-.006c1.775-.104 3.182-1.584 3.182-3.395 0-1.747-1.309-3.186-2.994-3.379.007-.106.011-.214.011-.322 0-2.707-2.271-4.901-5.072-4.901-2.073 0-3.856 1.202-4.643 2.925"></path></svg></span></button>`;
}
function brandLogoHTML(dark, cls = '') {
  const src = (dark && db.settings.logoDark) || db.settings.logoLight || '';
  return src ? `<img class="brand-logo-img ${cls}" src="${esc(src)}" alt="${esc(db.settings.platformName)}">` : '';
}
function applyTheme() {
  const th = db.settings.theme || {};
  const r = document.documentElement.style;
  if (th.primary) r.setProperty('--primary', th.primary); else r.removeProperty('--primary');
  if (th.primaryDark) r.setProperty('--primary-dark', th.primaryDark); else r.removeProperty('--primary-dark');
  if (th.sidebar) r.setProperty('--sidebar-bg', th.sidebar); else r.removeProperty('--sidebar-bg');
}
function layout(content) {
  const dark = !!db.settings.dark;
  const badges = navBadges();
  const nav = roleNav().map(([p, ic, label]) => `<button class="nav-item ${page === p ? 'active' : ''}" data-page="${p}" title="${esc(label)}"><span class="nav-icon">${ic}</span><span class="nav-text">${esc(label)}</span>${badges[p] ? `<span class="nav-badge">${badges[p]}</span>` : ''}</button>`).join('');
  const current = roleNav().find(n => n[0] === page)?.[2] || '';
  let timer = '';
  if (session && (session.kind === 'teacher' || session.kind === 'supervisor')) {
    const item = session.kind === 'teacher' ? find('teachers', session.id) : find('supervisors', session.id);
    const days = item ? subDays(item.subscriptionEnd) : null;
    if (days !== null) {
      const cls = days <= 3 ? 'danger' : days <= 10 ? 'warn' : '';
      timer = `<div class="sub-timer ${cls}" title="${esc(sessionLabel())}">متبقي من الاشتراك: ${days} يوم — ${esc(item.subscriptionEnd)}</div>`;
    }
  }
  return `<div class="app-shell">
    <aside class="sidebar" id="sidebar">
      <div class="brand">${brandLogoHTML(dark, 'brand-img') || '<span class="brand-mark">🎓</span>'}<div><b>${esc(db.settings.platformName)}</b><small>${esc(current)}</small></div></div>
      ${timer}
      ${nav}
      <div class="nav-label">الحساب</div>
      <button class="nav-item" data-action="logout" title="تسجيل الخروج"><span class="nav-icon">🚪</span><span class="nav-text">تسجيل الخروج</span></button>
      ${socialLinksHTML()}
    </aside>
    <div class="content-wrap">
      <header class="topbar">
        <button type="button" class="menu-toggle ${menuOpen ? 'open' : ''}" data-action="sidebar" aria-label="فتح وإغلاق القائمة" aria-expanded="${menuOpen}">
          <span class="menu-glyph">☰</span>
          <span class="atom" aria-hidden="true"><span class="nucleus"></span><span class="electron"></span><span class="electron"></span></span>
        </button>
        <div class="brand-center">${brandLogoHTML(dark) || `<span class="brand-mark">🎓</span><b>${esc(db.settings.platformName)}</b>`}</div>
        <div class="spacer"></div>
        ${themeSwitchHTML()}
        <div class="user-pill"><div class="avatar">${esc((sessionLabel() || '؟').trim().charAt(0))}</div><div><b>${esc(sessionLabel())}</b><small>${session ? ({ admin: 'مدير النظام', teacher: 'معلم', supervisor: 'إرشاف مختص', student: 'طالب' }[session.kind]) : ''}</small></div></div>
      </header>
      <div class="scroll-progress" aria-hidden="true"><i id="scroll-progress"></i></div>
      <main class="main">${content}</main>
      <footer class="app-footer">© ${new Date().getFullYear()} ${esc(db.settings.platformName)} — جميع الحقوق محفوظة · <a href="https://wa.me/201286085786" target="_blank" rel="noopener">Developed by ES - solutions & 2D</a></footer>
    </div>
  </div>`;
}

/* ===== الدخول ===== */
function renderLogin(msg = '') {
  document.body.classList.toggle('dark', !!db.settings.dark);
  const loginLogo = db.settings.logoLight ? `<img class="login-logo-img" src="${esc(db.settings.logoLight)}" alt="${esc(db.settings.platformName)}">` : '🎓';
  const stuModes = [['login', '🚪 دخول'], ['register', '➕ حساب جديد'], ['code', '🔗 برمز متابعة']].map(([k, l]) => `<button type="button" class="chip ${studentMode === k ? 'active' : ''}" data-action="stu-mode" data-id="${k}">${l}</button>`).join('');
  const gradeOpts = [['', 'اختر الصف الدراسي…'], ...db.settings.grades.map(g => [g, g])];
  $('#app').innerHTML = `<div class="login-wrap"><div class="login-card">
    <div class="login-logo">${loginLogo}</div>
    <h1 style="text-align:center;margin:0 0 4px;font-size:20px">${esc(db.settings.platformName)}</h1>
    <p style="text-align:center;color:var(--muted);margin:0 0 18px">بوابة إدارة المعلمين والنماذج والرسائل</p>
    ${msg ? `<div class="notice">${esc(msg)}</div>` : ''}
    <div class="login-roles">${[['admin', 'مدير النظام'], ['teacher', 'معلم'], ['supervisor', 'الإرشاف المختص'], ['student', '🎒 طالب']].map(([k, l]) => `<button type="button" class="chip ${loginRole === k ? 'active' : ''}" data-login-role="${k}">${l}</button>`).join('')}</div>
    <form id="login-form">
      ${loginRole === 'student' ? `
      <div class="stu-modes">${stuModes}</div>
      ${studentMode === 'code' ? `
      <div class="notice" style="margin-bottom:14px">أدخل <b>رمز المتابعة</b> الذي ظهر لك بعد إرسال رسالتك — أو أنشئ حساباً لتتابع كل رسائلك من مكان واحد.</div>
      <div class="field"><label>رمز المتابعة</label><input name="code" inputmode="numeric" maxlength="6" placeholder="مثال: 482913" dir="ltr" style="text-align:center;font-size:20px;letter-spacing:6px" autocomplete="off" required></div>
      ` : studentMode === 'register' ? `
      <div class="notice" style="margin-bottom:14px">أنشئ حسابك <b>مرة واحدة</b> — لتتابع كل رسائلك وردودها من مكان واحد، بدون رموز لكل رسالة.</div>
      <div class="form-grid">
        ${field('name', 'الاسم (ثلاثي بالعربية)', '', 'text', true, 'placeholder="مثال: أحمد محمد علي"')}
        ${field('username', 'اسم المستخدم', '', 'text', true, 'autocomplete="username"')}
        ${field('password', 'كلمة المرور', '', 'password', true, 'autocomplete="new-password"')}
        ${field('confirm', 'تأكيد كلمة المرور', '', 'password', true, 'autocomplete="new-password"')}
        ${field('phone', 'رقم الهاتف (اختياري)', '', 'tel', false, 'dir="ltr"')}
        ${selectField('grade', 'الصف الدراسي', '', gradeOpts, true)}
      </div>
      ` : `
      <div class="notice" style="margin-bottom:14px">ادخل باسم المستخدم وكلمة المرور لمتابعة <b>كل رسائلك</b> وردودها من مكان واحد.</div>
      <div class="field"><label>اسم المستخدم</label><input name="username" autocomplete="username" required></div>
      <div class="field" style="margin-top:12px"><label>كلمة المرور</label><input name="password" type="password" autocomplete="current-password" required></div>
      `}
      ` : `
      <div class="field"><label>اسم المستخدم</label><input name="username" autocomplete="username" required></div>
      <div class="field" style="margin-top:12px"><label>كلمة المرور</label><input name="password" type="password" autocomplete="current-password" required></div>
      `}
      <button class="btn btn-primary" style="width:100%;margin-top:18px">${loginRole === 'student' ? (studentMode === 'register' ? 'إنشاء الحساب والدخول' : 'دخول بوابة الطالب') : 'تسجيل الدخول'}</button>
      ${loginRole === 'student' && studentMode !== 'register' ? `<button type="button" class="btn btn-light" style="width:100%;margin-top:10px" data-action="stu-mode" data-id="register">ليس لديك حساب؟ أنشئ حساباً جديداً</button>` : ''}
      <div id="login-alert" class="login-alert" role="alert"></div>
    </form>
  </div></div>`;
  $('#login-form').addEventListener('submit', submitLogin);
}
function submitLogin(e) {
  e.preventDefault();
  clearLoginAlert();
  const data = new FormData(e.target);
  const username = String(data.get('username') || '').trim();
  const password = String(data.get('password') || '').trim();
  if (loginRole === 'student') {
    if (studentMode === 'code') {
      const code = String(data.get('code') || '').trim();
      const mine = code ? db.submissions.filter(s => s.studentCode === code) : [];
      if (!mine.length) return loginAlert('لا توجد رسائل مرتبطة بهذا الرمز — تأكد منه كما ظهر لك بعد الإرسال.');
      setSession({ kind: 'student', code });
      history.replaceState(null, '', location.pathname + location.search);
      page = 'dashboard';
      render();
      toast('مرحباً ' + mine[0].name + ' 👋');
      return;
    }
    if (studentMode === 'register') {
      const name = String(data.get('name') || '').trim();
      const confirm = String(data.get('confirm') || '').trim();
      const phone = String(data.get('phone') || '').trim();
      const grade = String(data.get('grade') || '').trim();
      const nv = validateStudentName(name);
      if (!nv.valid) return loginAlert(nv.message);
      if (!username || !password) return loginAlert('اسم المستخدم وكلمة المرور مطلوبان.');
      if (password.length < 4) return loginAlert('كلمة المرور يجب أن تكون 4 أحرف على الأقل.');
      if (password !== confirm) return loginAlert('كلمتا المرور غير متطابقتين.');
      if (!grade) return loginAlert('اختر الصف الدراسي.');
      const dup = checkUniqueCredentials(username, phone, null);
      if (dup) return loginAlert(dup);
      const st = { id: 'st-' + uid(), name, username, password, phone, grade, createdAt: date() };
      db.students.push(st);
      if (!save()) { db.students.pop(); return loginAlert('تعذر الحفظ — مساحة التخزين ممتلئة.'); }
      logAct(name, 'أنشأ حساب طالب جديد');
      setSession({ kind: 'student', id: st.id });
      if (returnHash) { returnHash = null; render(); toast('مرحباً ' + name + ' 👋 — أكمل بيانات النموذج الآن.'); return; }
      history.replaceState(null, '', location.pathname + location.search);
      page = 'dashboard';
      render();
      toast('مرحباً ' + name + ' 👋 — حسابك جاهز وتابع رسائلك من هنا.');
      return;
    }
    const s = db.students.find(x => x.username.toLowerCase() === username.toLowerCase() && x.password === password);
    if (!s) return loginAlert('بيانات الدخول غير صحيحة — أو أنشئ حساباً جديداً.');
    setSession({ kind: 'student', id: s.id });
    if (returnHash) { returnHash = null; render(); toast('مرحباً ' + s.name + ' 👋 — أكمل بيانات النموذج الآن.'); return; }
    history.replaceState(null, '', location.pathname + location.search);
    page = 'dashboard';
    render();
    toast('مرحباً ' + s.name + ' 👋');
    return;
  }
  if (loginRole === 'admin') {
    const u = db.users.find(x => x.username.toLowerCase() === username.toLowerCase() && x.password === password);
    if (!u) return loginAlert('بيانات الدخول غير صحيحة — تأكد من اسم المستخدم وكلمة المرور.');
    setSession({ kind: 'admin', id: u.id });
  } else if (loginRole === 'teacher') {
    const t = db.teachers.find(x => x.username.toLowerCase() === username.toLowerCase() && x.password === password);
    if (!t) return loginAlert('بيانات الدخول غير صحيحة — تأكد من اسم المستخدم وكلمة المرور.');
    if (t.subscriptionEnd && subDays(t.subscriptionEnd) < 0) return loginAlert('انتهت فترة اشتراكك — راجع مدير النظام للتجديد.');
    setSession({ kind: 'teacher', id: t.id });
  } else {
    const s = db.supervisors.find(x => x.username.toLowerCase() === username.toLowerCase() && x.password === password);
    if (!s) return loginAlert('بيانات الدخول غير صحيحة — تأكد من اسم المستخدم وكلمة المرور.');
    if (s.subscriptionEnd && subDays(s.subscriptionEnd) < 0) return loginAlert('انتهت فترة اشتراكك — راجع مدير النظام للتجديد.');
    setSession({ kind: 'supervisor', id: s.id });
  }
  page = 'dashboard';
  render();
  toast('مرحباً بك، ' + sessionLabel() + ' 👋');
}

/* ===== لوحات التحكم ===== */
function statCards(cards) {
  return `<div class="grid stats">${cards.map(c => `<div class="stat-card"><span class="sc-ic" style="background:${c.accent || 'var(--ghost)'}">${c.icon || '📌'}</span><div class="sc-body"><span class="label">${c.label}</span><strong>${c.value}</strong>${c.trend ? `<span class="trend">${c.trend}</span>` : ''}</div></div>`).join('')}</div>`;
}
function quickActions(items) {
  return `<div class="qa-row">${items.map(([icon, label, action]) => `<button type="button" class="qa" data-action="${action}"><span>${icon}</span>${label}</button>`).join('')}</div>`;
}
function donut(segments, centerTitle, centerSub) {
  const total = segments.reduce((a, s) => a + s[1], 0);
  if (!total) return `<p class="empty">لا بيانات بعد.</p>`;
  let acc = 0;
  const stops = segments.map(([, count, color]) => { const from = acc / total * 100; acc += count; return `${color} ${from.toFixed(2)}% ${((acc / total) * 100).toFixed(2)}%`; }).join(', ');
  return `<div class="donut-wrap"><div class="donut" style="background:conic-gradient(${stops})"><div class="donut-center"><b>${esc(centerTitle)}</b><small>${esc(centerSub)}</small></div></div>
  <div class="chart-legend donut-legend">${segments.map(([label, count, color]) => `<span><i style="background:${color}"></i>${esc(label)} (${count})</span>`).join('')}</div></div>`;
}
function recentList(items, emptyText) {
  if (!items.length) return `<p class="empty">${esc(emptyText)}</p>`;
  return `<ul class="list">${items.map(s => `<li><div style="min-width:0"><b>${esc(s.name)}</b> <small style="color:var(--muted)">— ${esc(s.grade || '')}</small><div style="font-size:12px;color:var(--muted)">${esc(s.formType === 'payment' ? money(s.data.amount) : String(s.data.question || '').slice(0, 45))} · ${esc(s.createdAt)}</div></div><div class="actions">${statusBadge(s.status)}${actionBtn('👁️', 'sub-view', s.id)}</div></li>`).join('')}</ul>`;
}
function dashboard() {
  if (session.kind === 'student') return studentInbox();
  if (session.kind === 'admin') {
    const mine = db.submissions;
    const newCount = mine.filter(s => s.status === 'new').length;
    const days14 = [...Array(14)].map((_, i) => { const x = new Date(); x.setDate(x.getDate() - (13 - i)); return date(x); });
    const payC = days14.map(d => mine.filter(s => s.createdAt.startsWith(d) && s.formType === 'payment').length);
    const supC = days14.map(d => mine.filter(s => s.createdAt.startsWith(d) && s.formType === 'support').length);
    const max = Math.max(1, ...payC, ...supC);
    const chart = `<div class="bars dual">${days14.map((d, i) => `<div class="bar-pair"><div class="bar pay" title="مدفوعات: ${payC[i]}" style="height:${Math.max(4, Math.round(payC[i] / max * 100))}%"></div><div class="bar sup" title="دعم: ${supC[i]}" style="height:${Math.max(4, Math.round(supC[i] / max * 100))}%"></div><small>${d.slice(5)}</small></div>`).join('')}</div>
      <div class="chart-legend"><span><i style="background:var(--primary)"></i>مدفوعات</span><span><i style="background:var(--warning)"></i>أسئلة دعم</span></div><div style="height:26px"></div>`;
    const expiring = db.teachers.filter(t => { const d = subDays(t.subscriptionEnd); return d !== null && d >= 0 && d <= 10; }).length;
    return pageHead('لوحة مدير النظام', 'نظرة عامة حية على المنصة — ' + date()) + quickActions([
      ['👨‍🏫', 'إضافة معلم', 'teacher-new'], ['📋', 'نموذج جديد', 'form-new'], ['📊', 'التقارير', 'goto-reports'], ['⚙️', 'الإعدادات', 'goto-settings']
    ]) + statCards([
      { icon: '👨‍🏫', label: 'المعلمون', value: db.teachers.length, trend: expiring ? expiring + ' اشتراك ينتهي قريباً' : '', accent: '#e3edfd' },
      { icon: '🧑‍🔧', label: 'الإرشاف المختص', value: db.supervisors.length, trend: '', accent: '#fff3d4' },
      { icon: '📋', label: 'النماذج النشطة', value: db.forms.filter(f => f.active).length + ' / ' + db.forms.length, trend: '', accent: '#dff7ed' },
      { icon: '📨', label: 'رسائل جديدة', value: newCount, trend: 'من إجمالي ' + mine.length, accent: '#fce4e8' }
    ]) + `<div class="grid dashboard-grid" style="margin-top:16px">
      <div class="panel"><h2>📈 الرسائل — آخر 14 يوماً</h2>${chart}</div>
      <div class="panel"><h2>🧭 حالة الرسائل</h2>${donut([
        ['جديد', mine.filter(s => s.status === 'new').length, '#4f8ef7'],
        ['مؤكد / تم الرد', mine.filter(s => s.status === 'confirmed' || s.status === 'resolved').length, '#10b981'],
        ['مرفوض', mine.filter(s => s.status === 'rejected').length, '#ef4444']
      ], mine.length, 'رسالة')}</div>
    </div>
    <div class="grid dashboard-grid" style="margin-top:16px">
      <div class="panel"><h2>📨 أحدث الرسائل</h2>${recentList(mine.slice(0, 6), 'لم تصل رسائل بعد — شارك روابط النماذج مع المعلمين.')}</div>
      <div class="panel"><h2>🕘 آخر النشاط</h2>${db.activity.length ? `<ul class="list">${db.activity.slice(0, 8).map(a => `<li><div><b>${esc(a.who)}</b><div style="font-size:12px;color:var(--muted)">${esc(a.text)} · ${esc(a.at)}</div></div></li>`).join('')}</ul>` : '<p class="empty">لا نشاط بعد.</p>'}</div>
    </div>`;
  }
  if (session.kind === 'teacher') {
    const t = find('teachers', session.id);
    const mine = db.submissions.filter(s => s.teacherId === session.id);
    const days = subDays(t?.subscriptionEnd);
    const pays = mine.filter(s => s.formType === 'payment');
    const sups = mine.filter(s => s.formType === 'support');
    const days14 = [...Array(14)].map((_, i) => { const x = new Date(); x.setDate(x.getDate() - (13 - i)); return date(x); });
    const payC = days14.map(d => pays.filter(s => s.createdAt.startsWith(d)).length);
    const supC = days14.map(d => sups.filter(s => s.createdAt.startsWith(d)).length);
    const max = Math.max(1, ...payC, ...supC);
    const chart = `<div class="bars dual">${days14.map((d, i) => `<div class="bar-pair"><div class="bar pay" title="مدفوعات: ${payC[i]}" style="height:${Math.max(4, Math.round(payC[i] / max * 100))}%"></div><div class="bar sup" title="دعم: ${supC[i]}" style="height:${Math.max(4, Math.round(supC[i] / max * 100))}%"></div><small>${d.slice(5)}</small></div>`).join('')}</div>
      <div class="chart-legend"><span><i style="background:var(--primary)"></i>مدفوعات</span><span><i style="background:var(--warning)"></i>أسئلة دعم</span></div><div style="height:26px"></div>`;
    const courses = t.courses || [];
    const myShare = courses.reduce((a, c) => a + (Number(c.price) || 0) * (Number(c.commission) || 0) / 100, 0);
    return pageHead('لوحة المعلم', 'رسائل الدفع وأسئلة الدعم تصلك هنا مباشرة') + quickActions([
      ['📋', 'نموذج جديد', 'form-new'], ['📊', 'تقاريري', 'goto-reports'], ['🧑‍🔧', 'إضافة مشرف', 'mysp-new'], ['💳', 'حسابات الدفع', 'goto-settings']
    ]) + statCards([
      { icon: '📋', label: 'نماذجي النشطة', value: db.forms.filter(f => f.teacherId === session.id && f.active).length, trend: '', accent: '#e3edfd' },
      { icon: '💰', label: 'مدفوعات جديدة', value: pays.filter(s => s.status === 'new').length, trend: 'من ' + pays.length + ' مدفوع', accent: '#dff7ed' },
      { icon: '💡', label: 'أسئلة جديدة', value: sups.filter(s => s.status === 'new').length, trend: 'من ' + sups.length + ' سؤال', accent: '#fff3d4' },
      { icon: '🎓', label: 'نصيبك من الكورسات', value: money(myShare), trend: courses.length + ' كورس', accent: '#fce4e8' }
    ]) + `<div class="grid dashboard-grid" style="margin-top:16px">
      <div class="panel"><h2>📈 الرسائل — آخر 14 يوماً</h2>${chart}</div>
      <div class="panel"><h2>💳 حالة المدفوعات</h2>${donut([
        ['جديد', pays.filter(s => s.status === 'new').length, '#4f8ef7'],
        ['مؤكد', pays.filter(s => s.status === 'confirmed').length, '#10b981'],
        ['مرفوض', pays.filter(s => s.status === 'rejected').length, '#ef4444']
      ], pays.length, 'دفعة')}</div>
    </div>
    <div class="grid dashboard-grid" style="margin-top:16px">
      <div class="panel"><h2>💰 آخر مدفوعات</h2>${recentList(pays.slice(0, 5), 'لا مدفوعات بعد — شارك رابط نموذج الدفع مع طلابك.')}</div>
      <div class="panel"><h2>💡 آخر أسئلة الدعم</h2>${recentList(sups.slice(0, 5), 'لا أسئلة بعد.')}</div>
    </div>`;
  }
  const sp = find('supervisors', session.id);
  const mine = db.submissions.filter(s => s.supervisorId === session.id);
  const days14 = [...Array(14)].map((_, i) => { const x = new Date(); x.setDate(x.getDate() - (13 - i)); return date(x); });
  const counts = days14.map(d => mine.filter(s => s.createdAt.startsWith(d)).length);
  const max = Math.max(1, ...counts);
  const chart = `<div class="bars">${days14.map((d, i) => `<div class="bar sup" title="${counts[i]}" style="height:${Math.max(4, Math.round(counts[i] / max * 100))}%"><small>${d.slice(5)}</small></div>`).join('')}</div><div style="height:26px"></div>`;
  return pageHead('لوحة الإرشاف المختص', 'أسئلة الدعم العلمي الموجّهة إليك' + (sp?.specialty ? ' — ' + sp.specialty : '')) + statCards([
    { icon: '💡', label: 'أسئلة جديدة', value: mine.filter(s => s.status === 'new').length, trend: '', accent: '#fff3d4' },
    { icon: '✅', label: 'تم الرد عليها', value: mine.filter(s => s.status === 'resolved').length, trend: '', accent: '#dff7ed' },
    { icon: '📥', label: 'إجمالي الأسئلة', value: mine.length, trend: '', accent: '#e3edfd' },
    { icon: '⏳', label: 'الاشتراك', value: subDays(sp?.subscriptionEnd) === null ? 'مفتوح' : subDays(sp.subscriptionEnd) + ' يوم', trend: '', accent: '#fce4e8' }
  ]) + `<div class="grid dashboard-grid" style="margin-top:16px">
    <div class="panel"><h2>📈 الأسئلة — آخر 14 يوماً</h2>${chart}</div>
    <div class="panel"><h2>🧭 حالة الأسئلة</h2>${donut([
      ['جديد', mine.filter(s => s.status === 'new').length, '#4f8ef7'],
      ['تم الرد', mine.filter(s => s.status === 'resolved').length, '#10b981']
    ], mine.length, 'سؤال')}</div>
  </div>
  <div class="panel" style="margin-top:16px"><h2>💡 أحدث الأسئلة</h2>${recentList(mine.slice(0, 8), 'لا أسئلة موجّهة إليك بعد.')}</div>`;
}

/* ===== بوابة الطالب ===== */
function studentInbox() {
  const mine = studentSubmissions();
  const f = filters.stuStatus || 'all';
  const list = mine.filter(s => f === 'all' ? true : f === 'new' ? s.status === 'new' : s.status !== 'new');
  const chips = [['all', 'الكل', mine.length], ['new', 'بدون رد', mine.filter(s => s.status === 'new').length], ['replied', 'تم الرد', mine.filter(s => s.status !== 'new').length]]
    .map(([k, l, c]) => `<button type="button" class="stu-chip ${f === k ? 'active' : ''}" data-action="stu-filter" data-id="${k}">${l} (${c})</button>`).join('');
  const cards = list.map(s => {
    const d = s.data || {};
    const responder = s.supervisorId ? supervisorName(s.supervisorId) : teacherName(s.teacherId);
    return `<div class="stu-card">
      <div class="stu-head">
        ${s.formType === 'payment' ? badge('💳 تأكيد دفع', 'info') : badge('💡 سؤال دعم', 'warning')}
        <b>${esc(find('forms', s.formId)?.title || 'رسالة')}</b>
        <small>${esc(s.createdAt)}</small>
        <span style="margin-inline-start:auto">${statusBadge(s.status)}</span>
      </div>
      ${s.formType === 'support' ? `<div class="stu-q">${esc(d.question || '')}</div>` : ''}
      ${s.formType === 'payment' ? `<div class="stu-q">تم تحويل <b>${esc(money(d.amount))}</b> على <span dir="ltr">${esc(d.targetNumber || '')}</span> (${esc(d.targetLabel || '')})</div>` : ''}
      ${s.reply ? `<div class="stu-reply"><span>✉️ رد ${esc(responder)}</span>${esc(s.reply)}</div>` : `<div class="stu-wait">⏳ لم يتم الرد على رسالتك بعد — سيظهر الرد هنا فوراً عند كتابته.</div>`}
      ${s.image ? `<img class="stu-img" src="${s.image}" alt="مرفق" data-action="stu-view" data-id="${esc(s.id)}">` : ''}
      <div>${actionBtn('عرض التفاصيل الكاملة', 'stu-view', s.id, 'btn btn-light btn-sm')}</div>
    </div>`;
  }).join('');
  return pageHead('رسائلي والردود', 'تابع حالة رسائلك وردود المعلم والمشرف عليها') + (session.id ? '' : `<div class="notice" style="margin-bottom:14px">🔐 أنت داخل بـ<b>رمز متابعة</b> مؤقت — أنشئ حساباً واحداً لتتابع كل رسائلك من مكان واحد دون رموز. <button type="button" class="btn btn-primary btn-sm" data-action="stu-register" style="margin-inline-start:8px">إنشاء حساب الآن</button></div>`) + statCards([
    { icon: '📥', label: 'إجمالي رسائلي', value: mine.length, trend: '', accent: '#e3edfd' },
    { icon: '⏳', label: 'بدون رد', value: mine.filter(s => s.status === 'new').length, trend: '', accent: '#fff3d4' },
    { icon: '✅', label: 'تم الرد عليها', value: mine.filter(s => s.status !== 'new').length, trend: '', accent: '#dff7ed' }
  ]) + `<div class="stu-chips" style="margin-top:16px">${chips}</div>
  <div class="stu-grid" style="margin-top:4px">${cards || `<div class="panel"><p class="empty">لا رسائل بهذا الفلتر — أرسل رسالتك من رابط النموذج الذي شاركه معك المعلم.</p></div>`}</div>`;
}
function myCodePage() {
  return pageHead('رمز المتابعة', 'هذا الرمز هو دخولك لبوابة الطالب — احتفظ به') +
    `<div class="panel" style="text-align:center;max-width:520px;margin:0 auto">
      <p style="color:var(--muted);line-height:1.9">ادخل به من شاشة تسجيل الدخول باختيار «🎒 طالب» لتشاهد كل رسائلك وردودها من أي متصفح — لا يحتاج اسم مستخدم أو كلمة مرور.</p>
      <div class="stu-code" dir="ltr">${esc(session?.code || '')}</div>
      <button type="button" class="btn btn-primary" data-action="copy-code">📋 نسخ الرمز</button>
    </div>`;
}
function studentSubDetail(id) {
  const s = studentSubmissions().find(x => x.id === id); if (!s) return;
  const d = s.data || {};
  const kv = (k, v) => v ? `<li><span>${k}</span><b style="text-align:left">${esc(v)}</b></li>` : '';
  let body = `<ul class="list">
    ${kv('الطالب', s.name)}${kv('الصف الدراسي', s.grade)}${kv('التاريخ', s.createdAt)}${kv('رمز المتابعة', s.studentCode)}
    ${s.formType === 'payment' ? kv('المبلغ', money(d.amount)) + kv('الحساب المحوّل عليه', (d.targetLabel || '') + ' — ' + (d.targetNumber || '')) + kv('نوع التحويل', TYPE_LABEL[d.transferType] || '') + kv('الرقم المحوّل منه', d.senderPhone) + kv('ملاحظات', d.notes) : ''}
    ${s.formType === 'support' ? `<li style="display:block"><span style="display:block;margin-bottom:6px">السؤال</span><div style="white-space:pre-wrap;background:var(--th-bg);padding:12px;border-radius:9px">${esc(d.question || '')}</div></li>${kv('ملاحظات', d.notes)}` : ''}
    ${Object.keys(d.custom || {}).map(k => kv((d.customLabels || {})[k] || k, d.custom[k])).join('')}
  </ul>
  <div class="stu-reply" style="margin-top:14px"><span>✉️ الرد</span>${s.reply ? esc(s.reply) : 'لم يتم الرد بعد.'}</div>`;
  if (s.image) body += `<img class="detail-img" src="${s.image}" alt="مرفق">`;
  infoModal((s.formType === 'payment' ? 'رسالة دفع — ' : 'سؤال دعم — ') + s.name, body);
}
function studentSettingsPage() {
  const s = session.id ? find('students', session.id) : null;
  if (!s) return myCodePage();
  const gradeOpts = [['', 'اختر الصف الدراسي…'], ...db.settings.grades.map(g => [g, g])];
  const msgs = db.submissions.filter(x => x.studentId === s.id);
  const tools = db.purchases.filter(p => p.buyerId === s.id && p.status === 'approved');
  return pageHead('إعداداتي', 'بياناتك وكلمة المرور') +
    `<div class="panel"><h2>🎒 بياناتي</h2>
    <form id="stu-form"><div class="form-grid">
      ${field('username', 'اسم المستخدم للدخول (غير قابل للتعديل)', s.username || '', 'text', false, 'disabled readonly dir="ltr" style="opacity:.65;cursor:not-allowed"')}
      ${field('name', 'الاسم (ثلاثي بالعربية)', s.name, 'text', true)}
      ${field('phone', 'رقم الهاتف', s.phone || '', 'tel', false, 'dir="ltr"')}
      ${selectField('grade', 'الصف الدراسي', s.grade || '', gradeOpts, true)}
    </div><div class="modal-foot"><button class="btn btn-primary">حفظ البيانات</button></div></form>
    <div class="meta-grid">
      <div class="meta-card"><small>تاريخ الانضمام</small><b>${esc(s.createdAt || '—')}</b></div>
      <div class="meta-card"><small>رسائلي</small><b>${msgs.length} رسالة</b></div>
      <div class="meta-card"><small>أدواتي</small><b>${tools.length} أداة</b></div>
      <div class="meta-card"><small>حالة الحساب</small><b style="color:var(--success)">نشط ✓</b></div>
    </div></div>
    <div class="panel" style="margin-top:16px"><h2>🔑 تغيير كلمة المرور</h2>
    <form id="pw-form"><div class="form-grid">
      ${field('password', 'كلمة المرور الجديدة', '', 'password', true)}
      ${field('confirm', 'تأكيد كلمة المرور', '', 'password', true)}
    </div><div class="modal-foot"><button class="btn btn-primary">تغيير كلمة المرور</button></div></form></div>`;
}

/* ===== المعلمون والإرشاف المختص (الأدمن) ===== */
function peoplePage(coll) {
  const isTeachers = coll === 'teachers';
  const items = db[coll];
  const label = isTeachers ? 'المعلمون' : 'الإرشاف المختص';
  const rows = items.map(p => {
    const days = subDays(p.subscriptionEnd);
    const formsCount = isTeachers ? db.forms.filter(f => f.teacherId === p.id).length : db.forms.filter(f => f.supervisorId === p.id).length;
    const subs = isTeachers ? db.submissions.filter(s => s.teacherId === p.id).length : db.submissions.filter(s => s.supervisorId === p.id).length;
    return `<tr data-search="${esc(p.name + ' ' + p.username + ' ' + (p.specialty || ''))}">
      <td><b>${esc(p.name)}</b>${!isTeachers && p.ownerTeacherId ? `<div style="font-size:11px;color:var(--muted)">أضافه المعلم: ${esc(teacherName(p.ownerTeacherId))}</div>` : ''}</td><td>${esc(p.username)}</td><td><span dir="ltr">${esc(p.phone || '—')}</span></td>
      <td>${esc(p.specialty || '—')}</td>
      <td>${days === null ? badge('مفتوح', 'neutral') : days < 0 ? badge('منتهي', 'danger') : badge(days + ' يوم', days <= 10 ? 'warning' : 'success')}<div style="font-size:11px;color:var(--muted)">${esc(p.subscriptionEnd || '')}</div></td>
      <td>${formsCount}</td><td>${subs}</td>
      <td><div class="actions">${actionBtn('✏️', isTeachers ? 'teacher-edit' : 'sp-edit', p.id)}${isTeachers ? actionBtn('🎓', 'course-new', p.id) : ''}${actionBtn('🔄', isTeachers ? 'teacher-renew' : 'sp-renew', p.id)}${actionBtn('🗑️', isTeachers ? 'teacher-del' : 'sp-del', p.id)}</div></td>
    </tr>`;
  }).join('');
  return pageHead(label, isTeachers ? 'حسابات المعلمين باشتراكاتهم ونماذجهم' : 'مشرفو الدعم العلمي الذين تُوجَّه إليهم الأسئلة',
      actionBtn('+ إضافة ' + (isTeachers ? 'معلم' : 'مشرف'), isTeachers ? 'teacher-new' : 'sp-new', '', 'btn btn-primary')) +
    tableToolbar('ابحث بالاسم أو اسم المستخدم…') +
    `<div class="table-wrap"><table><thead><tr><th data-sortable>الاسم</th><th data-sortable>اسم المستخدم</th><th>الهاتف</th><th>التخصص</th><th data-sortable>الاشتراك</th><th>النماذج</th><th>الرسائل</th><th>إجراءات</th></tr></thead><tbody>${rows || emptyRow(8, 'لا حسابات بعد — أضف أول ' + (isTeachers ? 'معلم' : 'مشرف'))}</tbody></table></div>`;
}
function peopleForm(coll, id, ownerTeacherId = '') {
  const isTeachers = coll === 'teachers';
  const p = id ? find(coll, id) : null;
  const label = isTeachers ? (p ? 'تعديل معلم' : 'إضافة معلم') : (p ? 'تعديل مشرف' : 'إضافة مشرف');
  modal(label, `<div class="notice">${isTeachers ? 'المعلم يدخل ببياناته وينشئ نماذج الدفع والدعم وتصله الرسائل على لوحته مباشرة — بدون واتساب أو تليجرام.' : 'المشرف يستقبل أسئلة الدعم العلمي الموجّهة إليه من نماذج المعلمين ويرد عليها من لوحته.'}</div>
  <div class="form-grid">
    ${field('name', 'الاسم', p?.name || '', 'text', true)}
    ${field('username', 'اسم المستخدم للدخول', p?.username || '', 'text', true)}
    ${field('password', 'كلمة المرور', p?.password || '', 'text', true)}
    ${field('phone', 'رقم الهاتف', p?.phone || '', 'tel')}
    ${field('specialty', isTeachers ? 'التخصص (المادة)' : 'التخصص (مجال الإرشاف)', p?.specialty || '', 'text')}
    ${field('subscriptionEnd', 'تاريخ انتهاء الاشتراك', p?.subscriptionEnd || dateAfter(30), 'date', true)}
    ${isTeachers ? selectField('subscriptionType', 'نوع الاشتراك', p?.subscriptionType || 'monthly', [['monthly', 'شهري'], ['yearly', 'سنوي']], true) : ''}
    ${isTeachers ? field('subscriptionPrice', 'قيمة الاشتراك (ج.م)', p?.subscriptionPrice ?? '', 'number', false, 'min="0" placeholder="مثال: 150"') : ''}
    ${isTeachers ? field('photo', 'رابط صورة المعلم (تظهر أعلى نماذجه العامة)', p?.photo || '', 'url', false, 'dir="ltr" placeholder="https://…"') : ''}
    ${isTeachers ? field('platformLink', 'رابط تحميل منصة المعلم (يظهر للطلاب زر تحميل)', p?.platformLink || '', 'url', false, 'dir="ltr" placeholder="https://…"') : ''}
    ${isTeachers ? `<div class="section-title">ما يظهر للطالب في النماذج العامة</div>
    <div class="check"><label><input type="checkbox" name="pub-photo" ${(p ? (p.pubShow?.photo !== false) : true) ? 'checked' : ''}> صورة المعلم</label></div>
    <div class="check"><label><input type="checkbox" name="pub-name" ${(p ? (p.pubShow?.name !== false) : true) ? 'checked' : ''}> اسم المعلم</label></div>
    <div class="check"><label><input type="checkbox" name="pub-specialty" ${(p ? (p.pubShow?.specialty !== false) : true) ? 'checked' : ''}> التخصص</label></div>
    <div class="check"><label><input type="checkbox" name="pub-link" ${(p ? (p.pubShow?.link !== false) : true) ? 'checked' : ''}> زر تحميل المنصة</label></div>` : ''}
  </div>`, data => {
    const item = { ...(p || {}), id: p?.id || (isTeachers ? 't-' : 'sp-') + uid() };
    item.name = String(data.get('name') || '').trim();
    item.username = String(data.get('username') || '').trim();
    item.password = String(data.get('password') || '').trim();
    item.phone = String(data.get('phone') || '').trim();
    item.specialty = String(data.get('specialty') || '').trim();
    item.subscriptionEnd = data.get('subscriptionEnd') || dateAfter(30);
    if (isTeachers) {
      item.photo = String(data.get('photo') || '').trim();
      item.platformLink = String(data.get('platformLink') || '').trim();
      item.subscriptionType = data.get('subscriptionType') || 'monthly';
      item.subscriptionPrice = Number(data.get('subscriptionPrice') || 0);
      item.pubShow = { photo: data.get('pub-photo') === 'on', name: data.get('pub-name') === 'on', specialty: data.get('pub-specialty') === 'on', link: data.get('pub-link') === 'on' };
    }
    if (!item.name || !item.username || !item.password) return toast('الاسم واسم المستخدم وكلمة المرور مطلوبة.', 'error');
    if (isTeachers && !p) item.payAccounts = [];
    if (!isTeachers) item.ownerTeacherId = p ? (p.ownerTeacherId || '') : ownerTeacherId;
    const dup = checkUniqueCredentials(item.username, item.phone, { coll, id: item.id });
    if (dup) return toast(dup, 'error');
    if (p) Object.assign(p, item); else db[coll].push(item);
    logAct(sessionLabel(), `${p ? 'عدّل' : 'أنشأ'} حساب ${isTeachers ? 'معلم' : 'إرشاف مختص'}: ${item.name}`);
    if (!save()) return toast('تعذر الحفظ — مساحة التخزين ممتلئة.', 'error');
    closeModal(); render(); toast('تم حفظ الحساب.');
  });
}
function peopleDelete(coll, id) {
  const p = find(coll, id); if (!p) return;
  const isTeachers = coll === 'teachers';
  const forms = db.forms.filter(f => isTeachers ? f.teacherId === id : f.supervisorId === id);
  modal('تأكيد الحذف', `<div class="notice" style="border-color:var(--danger);background:#fce4e8;color:#ae1a34">سيُحذف حساب <b>${esc(p.name)}</b> نهائياً${forms.length ? ` مع <b>${forms.length}</b> من نماذجه وكل رسائلها` : ''}. لا يمكن التراجع.</div>`, () => {
    db[coll] = db[coll].filter(x => x.id !== id);
    if (isTeachers) {
      const formIds = db.forms.filter(f => f.teacherId === id).map(f => f.id);
      db.forms = db.forms.filter(f => f.teacherId !== id);
      db.submissions = db.submissions.filter(s => !formIds.includes(s.formId));
    } else {
      db.forms.forEach(f => { if (f.supervisorId === id) { f.supervisorId = ''; f.route = 'teacher'; } });
      db.submissions.forEach(s => { if (s.supervisorId === id) s.supervisorId = ''; });
    }
    logAct(sessionLabel(), `حذف حساب ${isTeachers ? 'معلم' : 'إرشاف مختص'}: ${p.name}`);
    if (!save()) return toast('تعذر الحفظ — مساحة التخزين ممتلئة.', 'error');
    closeModal(); render(); toast('تم حذف الحساب.');
  }, 'حذف نهائي');
}

/* ===== مشرفو الدعم (المعلم) ===== */
function mySupervisorsPage() {
  const list = db.supervisors.filter(s => s.ownerTeacherId === session.id);
  const rows = list.map(s => {
    const days = subDays(s.subscriptionEnd);
    const subs = db.submissions.filter(x => x.supervisorId === s.id).length;
    return `<tr data-search="${esc(s.name + ' ' + s.username + ' ' + (s.specialty || ''))}">
      <td><b>${esc(s.name)}</b><div style="font-size:11px;color:var(--muted)">${esc(s.specialty || '')}</div></td>
      <td>${esc(s.username)}</td><td><span dir="ltr">${esc(s.phone || '—')}</span></td>
      <td>${days === null ? badge('مفتوح', 'neutral') : days < 0 ? badge('منتهي', 'danger') : badge(days + ' يوم', days <= 10 ? 'warning' : 'success')}<div style="font-size:11px;color:var(--muted)">${esc(s.subscriptionEnd || '')}</div></td>
      <td>${subs}</td>
      <td><div class="actions">${actionBtn('✏️', 'mysp-edit', s.id)}${actionBtn('🔄', 'mysp-renew', s.id)}${actionBtn('🗑️', 'mysp-del', s.id)}</div></td>
    </tr>`;
  }).join('');
  return pageHead('مشرفو الدعم', 'أضف مشرفين تابعين لك يستقبلون أسئلة الدعم العلمي الموجّهة إليهم', actionBtn('+ إضافة مشرف', 'mysp-new', '', 'btn btn-primary')) +
    tableToolbar('ابحث بالاسم أو اسم المستخدم…') +
    `<div class="table-wrap"><table><thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>الهاتف</th><th>الاشتراك</th><th>الأسئلة</th><th>إجراءات</th></tr></thead><tbody>${rows || emptyRow(6, 'لا مشرفين بعد — أضف أول مشرف تابع لك')}</tbody></table></div>
    <div class="notice" style="margin-top:14px">ℹ️ المشرف التابع لك يدخل من شاشة الدخول باختيار «الإرشاف المختص» ببياناته (اسم المستخدم وكلمة المرور التي تحددها) — ويمكنك تجديد اشتراكه بنفسك من هنا. لتصل الأسئلة إليه: عند إنشاء نموذج دعم اختر توجيه «الإرشاف المختص» ثم اختر اسمه.</div>`;
}

/* ===== النماذج ===== */
function formsPage() {
  const list = session.kind === 'teacher' ? db.forms.filter(f => f.teacherId === session.id) : db.forms;
  const rows = list.map(f => {
    const subs = db.submissions.filter(s => s.formId === f.id);
    const route = f.type === 'payment' ? 'لوحة المعلم' : (f.route === 'supervisor' ? 'إرشاف: ' + supervisorName(f.supervisorId) : 'لوحة المعلم');
    return `<tr data-search="${esc(f.title + ' ' + (f.type === 'payment' ? 'دفع' : 'دعم'))}">
      <td><b>${esc(f.title)}</b></td>
      <td>${f.type === 'payment' ? badge('نموذج دفع', 'info') : badge('نموذج دعم علمي', 'warning')}</td>
      ${session.kind === 'admin' ? `<td>${esc(teacherName(f.teacherId))}</td>` : ''}
      <td>${esc(route)}</td>
      <td>${f.active ? badge('نشط', 'success') : badge('موقوف', 'neutral')}</td>
      <td>${subs.length}${subs.filter(s => s.status === 'new').length ? ' <span class="nav-badge" style="display:inline-block">' + subs.filter(s => s.status === 'new').length + '</span>' : ''}</td>
      <td><div class="actions">${actionBtn('🔗', 'form-share', f.id)}${actionBtn('✏️', 'form-edit', f.id)}${actionBtn(f.active ? '⏸️' : '▶️', 'form-toggle', f.id)}${actionBtn('🗑️', 'form-del', f.id)}</div></td>
    </tr>`;
  }).join('');
  return pageHead('النماذج', 'نماذج الدفع والدعم العلمي — انسخ الرابط وشاركه مع الطلاب', actionBtn('+ نموذج جديد', 'form-new', '', 'btn btn-primary')) +
    tableToolbar('ابحث في النماذج…') +
    `<div class="table-wrap"><table><thead><tr><th data-sortable>العنوان</th><th>النوع</th>${session.kind === 'admin' ? '<th>المعلم</th>' : ''}<th>تصل الرسائل إلى</th><th>الحالة</th><th data-sortable>الرسائل</th><th>إجراءات</th></tr></thead><tbody>${rows || emptyRow(session.kind === 'admin' ? 7 : 6, 'لا نماذج بعد — أنشئ أول نموذج')}</tbody></table></div>`;
}
function formEditor(id) {
  const f = id ? find('forms', id) : null;
  const teacherId = session.kind === 'teacher' ? session.id : (f?.teacherId || db.teachers[0]?.id || '');
  const teacher = find('teachers', teacherId);
  const supOptions = [['', '— اختر المشرف —'], ...db.supervisors.map(s => [s.id, s.name + (s.specialty ? ' — ' + s.specialty : '')])];
  fbFields = f ? JSON.parse(JSON.stringify(f.defs && f.defs.length ? f.defs : defaultDefs(f.type, f.fields || []))) : defaultDefs(f?.type || 'payment');
  modal(f ? 'تعديل النموذج — محرر كامل' : 'نموذج جديد — محرر كامل', `
    <div class="form-grid">
      ${selectField('type', 'نوع النموذج', f?.type || 'payment', [['payment', 'نموذج دفع (تأكيد تحويل)'], ['support', 'نموذج دعم علمي (سؤال)']])}
      ${field('title', 'عنوان النموذج', f?.title || '', 'text', true, 'placeholder="مثال: تأكيد الدفع"')}
      ${session.kind === 'admin' ? selectField('teacherId', 'المعلم صاحب النموذج', teacherId, db.teachers.map(t => [t.id, t.name]), db.teachers.length > 0) : ''}
      ${selectField('route', 'تصل الرسائل إلى', f?.route || 'teacher', [['teacher', 'لوحة تحكم المعلم'], ['supervisor', 'الإرشاف المختص']])}
      <div id="sup-picker">${selectField('supervisorId', 'المشرف المختص', f?.supervisorId || '', supOptions)}</div>
      <div class="check" style="grid-column:1/-1"><label><input type="checkbox" name="active" ${f ? (f.active ? 'checked' : '') : 'checked'}> النموذج نشط (متاح للطلاب)</label></div>
      ${field('desc', 'النص التوضيحي أعلى النموذج (يظهر للطالب)', f?.desc || '', 'text', false, 'placeholder="مثال: يرجى إكمال بيانات التحويل التالية"')}
      ${field('successMsg', 'رسالة النجاح بعد الإرسال (اختيارية)', f?.successMsg || '', 'text', false, 'placeholder="مثال: تم استلام طلبك وسيتم الرد قريباً"')}
    </div>
    <div class="notice" id="pay-warn">نموذج الدفع يعرض حسابات استلام المعلم — تأكد من إضافتها من الإعدادات${session.kind === 'teacher' ? '' : ' (لوحة المعلم)'}.${teacher && !(teacher.payAccounts || []).length ? ' <b>تنبيه: هذا المعلم لم يضف حسابات دفع بعد.</b>' : ''}</div>
    <div class="panel fb-panel"><h2>🧩 حقول النموذج — عدّل كل شيء <small>الحقول الأساسية: عدّل تسميتها وإلزاميتها وأظهرها أو أخفها و رتبها. الحقول المخصصة: أضفها وحررها واحذفها بحرية.</small></h2>
      <div id="fb-fields"></div>
      <button type="button" class="btn btn-light" data-action="fb-add">+ إضافة حقل مخصص</button>
    </div>`, data => {
    const item = { ...(f || {}), id: f?.id || 'f-' + uid(), createdAt: f?.createdAt || date() };
    item.type = data.get('type');
    item.title = String(data.get('title') || '').trim();
    item.teacherId = session.kind === 'teacher' ? session.id : data.get('teacherId');
    item.route = data.get('route') || 'teacher';
    item.supervisorId = item.route === 'supervisor' ? (data.get('supervisorId') || '') : '';
    item.active = data.get('active') === 'on';
    if (item.type === 'payment') { item.route = 'teacher'; item.supervisorId = ''; }
    if (!item.title) return toast('عنوان النموذج مطلوب.', 'error');
    if (!item.teacherId) return toast('اختر المعلم صاحب النموذج.', 'error');
    if (item.type === 'support' && item.route === 'supervisor' && !item.supervisorId) return toast('اختر المشرف الذي ستصل إليه الأسئلة.', 'error');
    if (item.type === 'payment') { const t = find('teachers', item.teacherId); if (t && !(t.payAccounts || []).length) return toast('هذا المعلم لم يضف حسابات دفع — أضفها أولاً من إعدادات المعلم.', 'error'); }
    item.desc = String(data.get('desc') || '').trim();
    item.successMsg = String(data.get('successMsg') || '').trim();
    item.defs = fbFields.filter(x => String(x.label || '').trim() || x.enabled !== false).map(x => ({ ...x, label: String(x.label || '').trim(), key: x.key || x.id || 'cf-' + uid() }));
    item.fields = item.defs.filter(x => String(x.key || '').startsWith('cf-') && String(x.label || '').trim());
    for (const x of item.defs) { if (String(x.key || '').startsWith('cf-') && x.type === 'select' && (x.options || []).length < 2) return toast(`حقل القائمة «${x.label}» يحتاج خيارين على الأقل.`, 'error'); }
    if (f) Object.assign(f, item); else db.forms.push(item);
    logAct(sessionLabel(), `${f ? 'عدّل' : 'أنشأ'} نموذج ${item.type === 'payment' ? 'دفع' : 'دعم'} «${item.title}»`);
    if (!save()) return toast('تعذر الحفظ — مساحة التخزين ممتلئة.', 'error');
    closeModal(); render(); toast('تم حفظ النموذج — انسخ رابطه وشاركه.');
  });
  const formEl = $('#modal-form');
  const sync = () => {
    const type = formEl.querySelector('[name="type"]').value;
    const route = formEl.querySelector('[name="route"]');
    const picker = $('#sup-picker');
    route.closest('.field').style.display = type === 'payment' ? 'none' : '';
    if (picker) picker.style.display = (route.value === 'supervisor' && type === 'support') ? '' : 'none';
    const warn = $('#pay-warn'); if (warn) warn.hidden = type !== 'payment';
  };
  const onTypeChange = () => {
    const type = formEl.querySelector('[name="type"]').value;
    const customs = fbFields.filter(x => String(x.key || '').startsWith('cf-'));
    fbFields = defaultDefs(type, []).concat(customs);
    renderFbEditor();
    sync();
  };
  formEl.querySelector('[name="type"]').addEventListener('change', onTypeChange);
  formEl.querySelector('[name="route"]').addEventListener('change', sync);
  sync();
  renderFbEditor();
  const fbWrap = $('#fb-fields');
  fbWrap.addEventListener('input', e => {
    const t = e.target.closest('[data-fb]'); if (!t) return;
    const i = Number(t.closest('.fb-item')?.dataset.i); if (fbFields[i] === undefined) return;
    if (t.dataset.fb === 'label') fbFields[i].label = t.value;
    if (t.dataset.fb === 'options') fbFields[i].options = t.value.split(',').map(x => x.trim()).filter(Boolean);
    if (t.dataset.fb === 'placeholder') fbFields[i].placeholder = t.value;
  });
  fbWrap.addEventListener('change', e => {
    const t = e.target.closest('[data-fb]'); if (!t) return;
    const i = Number(t.closest('.fb-item')?.dataset.i); if (fbFields[i] === undefined) return;
    if (t.dataset.fb === 'type') { fbFields[i].type = t.value; renderFbEditor(); }
    if (t.dataset.fb === 'required') fbFields[i].required = t.checked;
    if (t.dataset.fb === 'enabled') fbFields[i].enabled = t.checked;
  });
}
function renderFbEditor() {
  const wrap = $('#fb-fields'); if (!wrap) return;
  const BUILTIN_LABEL = { name: 'اسم الطالب', grade: 'الصف الدراسي', amount: 'المبلغ المرسل', target: 'رقم التحويل', transferType: 'نوع التحويل', sender: 'رقم المُحوِّل', transaction: 'رقم العملية', account: 'رقم الحساب', image: 'الصورة المرفقة', notes: 'ملاحظات', question: 'نص السؤال' };
  wrap.innerHTML = fbFields.map((x, i) => {
    const isCustom = String(x.key || '').startsWith('cf-');
    const off = x.enabled === false;
    const tag = isCustom ? `<select data-fb="type">${Object.entries(FIELD_TYPES).map(([v, l]) => `<option value="${v}" ${x.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select>` : `<span class="fb-tag" title="حقل أساسي">${BUILTIN_LABEL[x.key] || x.key}</span>`;
    const hasPlaceholder = isCustom ? ['text', 'number', 'textarea'].includes(x.type) : ['name', 'amount', 'sender', 'transaction', 'account', 'notes', 'question'].includes(x.key);
    return `
    <div class="fb-item ${off ? 'fb-off' : ''}" data-i="${i}">
      <div class="fb-row">
        <input class="fb-label" value="${esc(x.label || '')}" placeholder="تسمية الحقل — مثال: المادة الدراسية" data-fb="label">
        ${tag}
        <label class="fb-req"><input type="checkbox" data-fb="required" ${x.required ? 'checked' : ''}> مطلوب</label>
        <label class="fb-req"><input type="checkbox" data-fb="enabled" ${off ? '' : 'checked'}> ظاهر</label>
      </div>
      ${isCustom && x.type === 'select' ? `<input class="fb-options" value="${esc((x.options || []).join(', '))}" placeholder="خيارات القائمة مفصولة بفاصلة: رياضيات, فيزياء, كيمياء" data-fb="options">` : ''}
      ${hasPlaceholder ? `<input class="fb-options" value="${esc(x.placeholder || '')}" placeholder="النص التوضيحي داخل الحقل (placeholder)" data-fb="placeholder">` : ''}
      <div class="fb-tools">
        <button type="button" data-action="fb-up" data-id="${i}" title="تحريك لأعلى">↑</button>
        <button type="button" data-action="fb-down" data-id="${i}" title="تحريك لأسفل">↓</button>
        <button type="button" data-action="fb-del" data-id="${i}" title="حذف الحقل">🗑️</button>
      </div>
    </div>`;
  }).join('');
}
function shareLinkModal(id) {
  const f = find('forms', id); if (!f) return;
  const link = formLink(f);
  modal('مشاركة النموذج — ' + f.title, `
    <div class="notice">هذا الرابط يفتح <b>${f.type === 'payment' ? 'نموذج الدفع' : 'نموذج الدعم العلمي'}</b> لأي طالب <b>بدون تسجيل دخول</b> — انسخه وأرسله في جروباتك أو صفحاتك.</div>
    <div class="field"><label>الرابط العام</label><input id="share-url" readonly value="${esc(link)}" dir="ltr" style="text-align:left;font-family:monospace"></div>
    <div class="modal-foot"><button type="button" class="btn btn-light" data-close-modal>إغلاق</button><button type="button" class="btn btn-primary" data-action="copy-link" data-id="${esc(f.id)}">📋 نسخ الرابط</button></div>`, null);
}
function formDelete(id) {
  const f = find('forms', id); if (!f) return;
  modal('تأكيد الحذف', `<div class="notice" style="border-color:var(--danger);background:#fce4e8;color:#ae1a34">سيُحذف نموذج <b>${esc(f.title)}</b> وكل الرسائل الواردة عبره (${db.submissions.filter(s => s.formId === id).length} رسالة).</div>`, () => {
    db.forms = db.forms.filter(x => x.id !== id);
    db.submissions = db.submissions.filter(s => s.formId !== id);
    logAct(sessionLabel(), `حذف نموذج «${f.title}»`);
    if (!save()) return toast('تعذر الحفظ — مساحة التخزين ممتلئة.', 'error');
    closeModal(); render(); toast('تم حذف النموذج.');
  }, 'حذف نهائي');
}

/* ===== الكورسات (الأدمن فقط — النشر والتصفية) ===== */
function findCourseOwner(courseId) { return db.teachers.find(t => (t.courses || []).some(c => c.id === courseId)); }
function coursesPage() {
  const filterTeacher = filters.courseTeacher || 'all';
  const items = [];
  db.teachers.forEach(t => (t.courses || []).forEach(c => items.push({ teacher: t, course: c })));
  const list = filterTeacher === 'all' ? items : items.filter(x => x.teacher.id === filterTeacher);
  const totalDebt = list.reduce((a, x) => a + courseDebt(x.course), 0);
  const totalSalary = list.reduce((a, x) => a + courseSalary(x.course), 0);
  const totalStudents = list.reduce((a, x) => a + (Number(x.course.studentsCount) || 0), 0);
  const rows = list.map(x => {
    const c = x.course, t = x.teacher;
    const debt = courseDebt(c), salary = courseSalary(c);
    const unsettled = Math.max(0, (Number(c.studentsCount) || 0) - (Number(c.settledStudents) || 0));
    return `<tr data-search="${esc(c.title + ' ' + t.name)}">
      <td><b>${esc(c.title)}</b>${c.link ? `<div style="font-size:11px"><a href="${esc(c.link)}" target="_blank" rel="noopener" style="color:var(--primary)">↗ رابط الكورس</a></div>` : ''}</td>
      <td>${esc(t.name)}</td>
      <td>${esc(money(c.price))}</td>
      <td>${badge((Number(c.commission) || 0) + '%', 'info')}</td>
      <td><b>${Number(c.studentsCount) || 0}</b>${c.settledStudents ? `<div style="font-size:11px;color:var(--muted)">مُصفّى منهم: ${c.settledStudents}</div>` : ''}</td>
      <td><b>${esc(money(salary))}</b></td>
      <td>${debt > 0 ? `<b style="color:var(--danger)">${esc(money(debt))}</b><div style="font-size:11px;color:var(--muted)">على ${unsettled} طالب</div>` : badge('مُصفّى', 'success')}</td>
      <td><div class="actions">${debt > 0 ? actionBtn('✅ تصفية', 'course-settle', c.id, 'action') : ''}${actionBtn('✏️', 'course-edit', c.id)}${actionBtn('🗑️', 'course-del', c.id)}</div></td>
    </tr>`;
  }).join('');
  const teacherFilter = `<select data-course-teacher><option value="all">كل المعلمين</option>${db.teachers.map(t => `<option value="${esc(t.id)}" ${filterTeacher === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>`;
  return pageHead('الكورسات', 'الأدمن وحده ينشر الكورسات — حدد عدد الطلاب وتابع راتب كل معلم ودينه وقم بالتصفية دورياً', actionBtn('+ نشر كورس', 'course-new', '', 'btn btn-primary')) +
    statCards([
      { icon: '🎓', label: 'الكورسات', value: list.length, trend: totalStudents + ' طالب مسجل', accent: '#e3edfd' },
      { icon: '💰', label: 'رواتب المعلمين', value: money(totalSalary), trend: 'حسب نسب كل كورس', accent: '#dff7ed' },
      { icon: '⚠️', label: 'ديون مستحقة', value: money(totalDebt), trend: 'بحاجة لتصفية', accent: '#fce4e8' }
    ]) +
    `<div class="toolbar" style="margin-top:16px">${teacherFilter}<input class="search" data-filter="table" placeholder="ابحث في الكورسات…"></div>
    <div class="table-wrap"><table><thead><tr><th>الكورس</th><th>المعلم</th><th data-sortable>السعر</th><th>نسبة المعلم</th><th>عدد الطلاب</th><th data-sortable>راتب المعلم</th><th data-sortable>الدين المستحق</th><th>إجراءات</th></tr></thead><tbody>${rows || emptyRow(8, 'لا كورسات منشورة بعد — انشر أول كورس وحدد نسبة المعلم وعدد طلابه')}</tbody></table></div>
    <div class="notice" style="margin-top:14px">ℹ️ <b>دورة المال:</b> الطالب يدفع سعر الكورس كاملاً للمعلم — <b>راتب المعلم</b> = عدد الطلاب × السعر × نسبته، و<b>الدين</b> = الجزء المتبقي على المعلم للمنصة (الطلاب غير المُصفّين × السعر × المتبقي من النسبة). زر «تصفية» يحاسب المعلم عن الطلاب الحاليين — يبقى عددهم محفوظاً في الكورس دون إضافته مجدداً لحسابه.</div>`;
}
function courseForm(teacherId, id) {
  const t = find('teachers', teacherId); if (!t) return;
  const c = id ? (t.courses || []).find(x => x.id === id) : null;
  modal(c ? 'تعديل كورس — ' + t.name : 'نشر كورس جديد — ' + t.name, `
    <div class="form-grid">
      ${field('title', 'اسم الكورس', c?.title || '', 'text', true, 'placeholder="مثال: كورس الرياضيات"')}
      ${field('price', 'سعر الكورس للطالب (ج.م)', c?.price ?? '', 'number', true, 'min="0" placeholder="مثال: 300"')}
      ${field('commission', 'نسبة المعلم من الكورس %', c?.commission ?? 50, 'number', true, 'min="0" max="100" placeholder="من 0 إلى 100"')}
      ${field('studentsCount', 'عدد الطلاب المسجلين في الكورس', c?.studentsCount ?? 0, 'number', true, 'min="0" placeholder="مثال: 20"')}
      ${field('link', 'رابط الكورس (اختياري)', c?.link || '', 'url', false, 'dir="ltr" placeholder="https://…"')}
    </div>
    <div class="notice">💡 <b>دورة المال:</b> الطالب يدفع السعر كاملاً للمعلم. راتب المعلم = عدد الطلاب × السعر × النسبة، والباقي (النسبة المتبقية) <b>دين على المعلم للمنصة</b> تُصفّاه الأدمن دورياً. الطلاب المُصفّون يبقى عددهم محفوظاً ولا يُضاف دينهم مجدداً.</div>`, data => {
    const item = { ...(c || {}), id: c?.id || 'c-' + uid() };
    item.title = String(data.get('title') || '').trim();
    item.price = Number(data.get('price') || 0);
    item.commission = Math.max(0, Math.min(100, Number(data.get('commission') || 0)));
    item.studentsCount = Math.max(0, Number(data.get('studentsCount') || 0));
    item.link = String(data.get('link') || '').trim();
    if (!item.title) return toast('اسم الكورس مطلوب.', 'error');
    if (!(item.price > 0)) return toast('أدخل سعراً صحيحاً للكورس.', 'error');
    if (item.studentsCount < (Number(c?.settledStudents) || 0)) return toast('عدد الطلاب لا يمكن أن يقل عن عدد الطلاب المُصفّين سابقاً.', 'error');
    t.courses = t.courses || [];
    if (c) Object.assign(c, item); else t.courses.push(item);
    logAct(sessionLabel(), `${c ? 'عدّل' : 'نشر'} كورس «${item.title}» للمعلم ${t.name} — ${item.studentsCount} طالب بنسبة ${item.commission}%`);
    if (!save()) return toast('تعذر الحفظ — مساحة التخزين ممتلئة.', 'error');
    closeModal(); render(); toast('تم حفظ الكورس.');
  });
}
function courseSettle(id) {
  const owner = findCourseOwner(id); if (!owner) return;
  const c = (owner.courses || []).find(x => x.id === id); if (!c) return;
  const debt = courseDebt(c);
  const unsettled = Math.max(0, (Number(c.studentsCount) || 0) - (Number(c.settledStudents) || 0));
  if (debt <= 0) return toast('لا دين مستحق على هذا الكورس — تم تصفيته بالكامل.', 'error');
  modal('تصفية دين كورس — ' + c.title, `
    <div class="notice">المعلم: <b>${esc(owner.name)}</b><br>الدين المستحق: <b style="color:var(--danger)">${esc(money(debt))}</b> — على <b>${unsettled}</b> طالب غير مُصفّى<br>النسبة المتبقية: <b>${100 - (Number(c.commission) || 0)}%</b> من سعر الكورس (${esc(money(c.price))})</div>
    ${field('paid', `المبلغ المدفوع فعلياً في هذه التصفية (المتوقع ${money(debt)})`, String(debt), 'number', true, 'min="0"')}
    ${field('note', 'ملاحظة التصفية (اختياري)', '', 'text', false, 'placeholder="مثال: دفعة الحصاد — كاش"')}
    <div class="notice">بعد التصفية: يبقى عدد الطلاب (${c.studentsCount}) محفوظاً في الكورس، ولن يُضاف دينهم إلى حساب المعلم مجدداً — يبدأ الحساب من الطلاب الجدد.</div>`, data => {
    const paid = Number(data.get('paid') || 0);
    const note = String(data.get('note') || '').trim();
    db.settlements.unshift({ id: 'set-' + uid(), teacherId: owner.id, courseId: c.id, courseTitle: c.title, teacherName: owner.name, at: dateTime(), amount: paid, studentsSettled: unsettled, note });
    c.settledStudents = Number(c.studentsCount) || 0;
    logAct(sessionLabel(), `صفّى دين كورس «${c.title}» للمعلم ${owner.name} — ${money(paid)} عن ${unsettled} طالب`);
    if (!save()) return toast('تعذر الحفظ — مساحة التخزين ممتلئة.', 'error');
    closeModal(); render(); toast(`تمت تصفية دين ${money(paid)} — عددهم المُصفّى الآن ${c.settledStudents} طالب.`);
  }, '✅ تأكيد التصفية');
}
function courseDelete(id) {
  const owner = findCourseOwner(id); if (!owner) return;
  const c = (owner.courses || []).find(x => x.id === id); if (!c) return;
  modal('تأكيد الحذف', `<div class="notice" style="border-color:var(--danger);background:#fce4e8;color:#ae1a34">سيُحذف كورس <b>${esc(c.title)}</b> من كورسات ${esc(owner.name)}. لا يمكن التراجع.</div>`, () => {
    owner.courses = (owner.courses || []).filter(x => x.id !== id);
    logAct(sessionLabel(), `حذف كورس «${c.title}»`);
    if (!save()) return toast('تعذر الحفظ.', 'error');
    closeModal(); render(); toast('تم حذف الكورس.');
  }, 'حذف نهائي');
}

/* ===== المتجر (أدوات مساعدة) ===== */
let storeFileText = null, storeFileName = '';
function buyerLabel(kind) { return kind === 'teacher' ? 'معلم' : kind === 'student' ? 'طالب' : kind === 'supervisor' ? 'مشرف' : '—'; }
function storePageAdmin() {
  const pending = db.purchases.filter(p => p.status === 'pending');
  const buys = db.purchases.filter(p => !p.trial && p.status === 'approved');
  const activeTrials = db.purchases.filter(p => p.trial && (p.trialEnds || '') >= date());
  const revenue = buys.reduce((a, p) => a + (Number(p.price) || 0), 0);
  const pendingRows = pending.map(p => `<tr data-search="${esc(p.buyerName)}">
      <td><b>${esc(p.buyerName)}</b><div style="font-size:11px;color:var(--muted)">${buyerLabel(p.buyerKind)}</div></td>
      <td>${esc(find('store', p.toolId)?.title || '—')}</td>
      <td>${esc(money(p.price))}</td>
      <td>${esc(p.at)}</td>
      <td>${esc(p.ref || '—')}</td>
      <td><div class="actions">${actionBtn('✅ موافقة', 'store-approve', p.id, 'action')}${actionBtn('✕ رفض', 'store-reject', p.id, 'action')}</div></td>
    </tr>`).join('');
  const rows = db.store.map(t => {
    const buyers = db.purchases.filter(p => p.toolId === t.id);
    return `<tr data-search="${esc(t.title + ' ' + (t.description || ''))}">
      <td><span style="font-size:20px">${esc(t.icon || '🧰')}</span> <b>${esc(t.title)}</b>${t.description ? `<div style="font-size:11.5px;color:var(--muted)">${esc(t.description)}</div>` : ''}</td>
      <td>${esc(money(t.price))}</td>
      <td>${t.duration} يوم</td>
      <td>${t.trialDays ? badge('تجربة ' + t.trialDays + ' يوم', 'warning') : badge('بدون تجربة', 'neutral')}</td>
      <td>${(t.forWhom || []).map(f => badge(f === 'student' ? 'طلاب' : 'معلمون', f === 'student' ? 'info' : 'success')).join(' ')}</td>
      <td>${buyers.length}</td>
      <td>${t.active ? badge('نشط', 'success') : badge('موقوف', 'neutral')}</td>
      <td><div class="actions">${actionBtn('✏️', 'store-edit', t.id)}${actionBtn(t.active ? '⏸️' : '▶️', 'store-toggle', t.id)}${actionBtn('🗑️', 'store-del', t.id)}</div></td>
    </tr>`;
  }).join('');
  const purRows = db.purchases.map(p => {
    const today = date();
    let status, kind;
    if (p.status === 'pending') { status = badge('قيد المراجعة', 'warning'); kind = badge('طلب شراء', 'info'); }
    else if (p.status === 'rejected') { status = badge('مرفوض', 'danger'); kind = badge('طلب شراء', 'info'); }
    else if (p.trial) { status = (p.trialEnds || '') >= today ? badge('تجربة نشطة', 'warning') : badge('انتهت التجربة', 'neutral'); kind = badge('تجربة مجانية', 'warning'); }
    else { status = (p.ends || '') >= today ? badge('مفعّل', 'success') : badge('منتهي', 'neutral'); kind = badge('مدفوع — ' + money(p.price), 'success'); }
    return `<tr data-search="${esc(p.buyerName + ' ' + (find('store', p.toolId)?.title || ''))}">
      <td><b>${esc(p.buyerName)}</b><div style="font-size:11px;color:var(--muted)">${buyerLabel(p.buyerKind)}</div></td>
      <td>${esc(find('store', p.toolId)?.title || 'أداة محذوفة')}</td>
      <td>${kind}</td>
      <td>${esc(p.at)}</td>
      <td>${esc(p.trial ? p.trialEnds : (p.ends || '—'))}</td>
      <td>${status}</td>
    </tr>`;
  }).join('');
  return pageHead('المتجر', 'انشر أدوات مساعدة للطلاب والمعلمين — ارفع ملف الأداة وحدد السعر ومدة الاشتراك والفترة التجريبية', actionBtn('+ إضافة أداة', 'store-new', '', 'btn btn-primary')) +
    statCards([
      { icon: '⏳', label: 'طلبات شراء قيد المراجعة', value: pending.length, trend: pending.length ? 'بحاجة لموافقتك' : 'لا طلبات معلقة', accent: pending.length ? '#fce4e8' : '#dff7ed' },
      { icon: '🧰', label: 'الأدوات المنشورة', value: db.store.filter(t => t.active).length + ' / ' + db.store.length, trend: '', accent: '#e3edfd' },
      { icon: '🛒', label: 'مشتريات مُعتمدة', value: buys.length, trend: 'بإجمالي ' + money(revenue), accent: '#dff7ed' },
      { icon: '⏱️', label: 'تجارب نشطة', value: activeTrials.length, trend: '', accent: '#fff3d4' }
    ]) +
    (pending.length ? `<div class="panel" style="margin-top:16px"><h2>📨 طلبات الشراء — بانتظار موافقتك</h2>
    <div class="notice">الموافقة تُفعّل الأداة للمشتري فوراً لمدة اشتراكها، والرفض يظهر له مع سببه في «أدواتي».</div>
    <div class="table-wrap"><table><thead><tr><th>المشتري</th><th>الأداة</th><th>المبلغ</th><th>تاريخ الطلب</th><th>مرجع التحويل</th><th>القرار</th></tr></thead><tbody>${pendingRows}</tbody></table></div></div>` : '') +
    `<div class="panel" style="margin-top:16px"><h2>🧰 الأدوات</h2>
    ${tableToolbar('ابحث في الأدوات…')}
    <div class="table-wrap"><table><thead><tr><th>الأداة</th><th data-sortable>السعر</th><th>مدة الاشتراك</th><th>التجربة</th><th>متاحة لـ</th><th>المشترون</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>${rows || emptyRow(8, 'لا أدوات بعد — أضف أول أداة برفع ملف HTML')}</tbody></table></div></div>
    <div class="panel" style="margin-top:16px"><h2>🧾 سجل الشراء والتجارب</h2>
    <div class="table-wrap"><table><thead><tr><th>المشتري</th><th>الأداة</th><th>النوع</th><th>التاريخ</th><th>ينتهي</th><th>الحالة</th></tr></thead><tbody>${purRows || emptyRow(6, 'لا عمليات بعد — يظهر هنا كل طلب شراء أو تجربة يقوم بها الطلاب والمعلمون')}</tbody></table></div></div>`;
}
function storePageBuyer() {
  const kind = session.kind;
  const tools = db.store.filter(t => t.active && (t.forWhom || []).includes(kind));
  const cards = tools.map(t => {
    const acc = toolAccess(t.id, kind, session.id);
    let actionHTML = '';
    if (acc.hasAccess) {
      const ends = acc.paid ? acc.paid.ends : acc.trial.trialEnds;
      actionHTML = `<div class="store-acts"><button type="button" class="btn btn-success" data-action="store-open" data-id="${esc(t.id)}">🚀 فتح الأداة</button><small class="store-until">مفعّلة حتى ${esc(ends)} ${acc.trial && !acc.paid ? '— تجربة' : ''}</small></div>`;
    } else if (acc.pending) {
      actionHTML = `<div class="store-acts"><span class="store-pending">⏳ طلبك قيد مراجعة مدير النظام</span><small class="store-until">ستُفعَّل الأداة تلقائياً بعد الموافقة</small></div>`;
    } else {
      const rej = acc.rejected ? `<small class="store-until" style="color:var(--danger)">طلبك السابق مرفوض${acc.rejected.rejectNote ? ': ' + esc(acc.rejected.rejectNote) : ''} — يمكنك إعادة الإرسال</small>` : '';
      actionHTML = `<div class="store-acts">${actionBtn('📨 إرسال طلب شراء — ' + money(t.price), 'store-buy', t.id, 'btn btn-primary')}${t.trialDays && !acc.usedTrial ? actionBtn('⏱️ تجربة ' + t.trialDays + ' يوم', 'store-trial', t.id, 'btn btn-light') : ''}${rej}</div>`;
    }
    return `<div class="store-card">
      <div class="store-ic">${esc(t.icon || '🧰')}</div>
      <div class="store-info"><b>${esc(t.title)}</b>${t.description ? `<p>${esc(t.description)}</p>` : ''}
        <div class="store-meta">${badge(money(t.price), 'info')}${badge(t.duration + ' يوم', 'neutral')}${t.trialDays ? badge('تجربة ' + t.trialDays + ' يوم', 'warning') : ''}</div>
      </div>
      ${actionHTML}
    </div>`;
  }).join('');
  return pageHead('المتجر', 'أدوات مساعدة يوفرها مدير النظام — جرّب مجاناً أو أرسل طلب شراء يوافق عليه الأدمن ثم افتح الأداة من «أدواتي»',
      actionBtn('🧰 أدواتي', 'goto-mytools', '', 'btn btn-primary')) +
    `<div class="store-grid">${cards || `<div class="panel"><p class="empty">لا أدوات متاحة لحسابك حالياً — تابع المتجر لأدوات جديدة.</p></div>`}</div>`;
}
function storeToolForm(id) {
  const t = id ? find('store', id) : null;
  storeFileText = null; storeFileName = '';
  modal(t ? 'تعديل أداة — ' + t.title : 'إضافة أداة جديدة للمتجر', `
    <div class="notice">📁 <b>إضافة الأداة تتم برفع ملف HTML</b> — مثل ملفات الأدوات الجاهزة. يُخزَّن الملف داخل النظام ويفتح للمشترين من المتجر مباشرة (الحد الأقصى 1.5 ميجابايت).</div>
    <div class="form-grid">
      ${field('title', 'اسم الأداة', t?.title || '', 'text', true, 'placeholder="مثال: كوبون كارد ستوديو برو"')}
      ${field('icon', 'أيقونة (إيموجي)', t?.icon || '🧰', 'text', false, 'maxlength="4"')}
      ${field('price', 'السعر (ج.م)', t?.price ?? '', 'number', true, 'min="0" placeholder="مثال: 150"')}
      ${field('duration', 'مدة الاشتراك بعد الشراء (يوم)', t?.duration ?? 30, 'number', true, 'min="1"')}
      ${field('trialDays', 'الفترة التجريبية المجانية (يوم — اكتب 0 لبدون تجربة)', t?.trialDays ?? 0, 'number', true, 'min="0"')}
      ${field('description', 'وصف الأداة (يظهر للمشترين)', t?.description || '', 'text')}
    </div>
    <div class="check" style="grid-column:1/-1;margin-top:4px"><label><input type="checkbox" name="for-student" ${(t ? (t.forWhom || []).includes('student') : true) ? 'checked' : ''}> متاحة للطلاب</label>
    <label style="margin-inline-start:18px"><input type="checkbox" name="for-teacher" ${(t ? (t.forWhom || []).includes('teacher') : true) ? 'checked' : ''}> متاحة للمعلمين</label></div>
    <div class="store-file-box">
      <label>ملف الأداة (HTML) ${t?.file || t?.fileRef ? '<span class="opt">مخزّن — ارفع ملفاً جديداً للاستبدال</span>' : '<span class="req">مطلوب</span>'}</label>
      <label class="btn btn-light" style="cursor:pointer">📁 اختيار ملف HTML<input type="file" id="tool-file" accept=".html,.htm" hidden></label>
      <div id="tool-file-info" class="store-file-info">${t?.fileRef ? 'الملف المدمج: <b dir="ltr">' + esc(t.fileRef) + '</b>' : t?.file ? 'الملف مخزّن داخل النظام (' + fmtSize(t.file.length) + ')' : 'لم يتم اختيار ملف بعد'}</div>
    </div>`, data => {
    const item = { ...(t || {}), id: t?.id || 'tool-' + uid(), createdAt: t?.createdAt || date() };
    item.title = String(data.get('title') || '').trim();
    item.icon = String(data.get('icon') || '🧰').trim() || '🧰';
    item.price = Number(data.get('price') || 0);
    item.duration = Math.max(1, Number(data.get('duration') || 30));
    item.trialDays = Math.max(0, Number(data.get('trialDays') || 0));
    item.description = String(data.get('description') || '').trim();
    const fw = [];
    if (data.get('for-student') === 'on') fw.push('student');
    if (data.get('for-teacher') === 'on') fw.push('teacher');
    if (!fw.length) return toast('حدد من تتاح له الأداة (طلاب أو معلمين على الأقل).', 'error');
    item.forWhom = fw;
    if (!item.title) return toast('اسم الأداة مطلوب.', 'error');
    if (!(item.price >= 0)) return toast('أدخل سعراً صحيحاً.', 'error');
    if (storeFileText) {
      if (storeFileText.length > 1536000) return toast('الملف كبير جداً (الحد الأقصى 1.5 ميجابايت).', 'error');
      item.file = storeFileText; item.fileName = storeFileName; item.fileRef = '';
    } else if (!t?.file && !t?.fileRef) return toast('ارفع ملف الأداة (HTML) أولاً.', 'error');
    if (t) Object.assign(t, item); else db.store.push(item);
    logAct(sessionLabel(), `${t ? 'عدّل' : 'أضاف'} أداة للمتجر: «${item.title}» بسعر ${money(item.price)}`);
    if (!save()) { if (!t) db.store.pop(); return toast('تعذر الحفظ — مساحة التخزين ممتلئة. جرّب ملفاً أصغر.', 'error'); }
    closeModal(); render(); toast('تم حفظ الأداة في المتجر.');
  });
  $('#tool-file')?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.html?$/i.test(file.name)) { toast('الملف يجب أن يكون HTML.', 'error'); e.target.value = ''; return; }
    if (file.size > 1536000) { toast('الملف كبير جداً (الحد الأقصى 1.5 ميجابايت).', 'error'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      storeFileText = String(reader.result || '');
      storeFileName = file.name;
      const info = $('#tool-file-info');
      if (info) info.innerHTML = '✅ جاهز: <b>' + esc(file.name) + '</b> (' + fmtSize(file.size) + ')';
      toast('تم اختيار الملف — اضغط «حفظ» لتخزين الأداة.');
    };
    reader.readAsText(file);
  });
}
function storeBuy(id) {
  const tool = find('store', id); if (!tool) return;
  const kind = session.kind;
  const buyer = kind === 'teacher' ? find('teachers', session.id) : find('students', session.id);
  if (!buyer) return;
  const acc = toolAccess(tool.id, kind, session.id);
  if (acc.hasAccess) return toast('لديك اشتراك نشط بهذه الأداة — افتحها من المتجر.', 'error');
  if (acc.pending) return toast('لديك طلب شراء قيد مراجعة مدير النظام لهذه الأداة بالفعل.', 'error');
  modal('طلب شراء أداة — ' + tool.title, `
    <div class="notice">الأداة: <b>${tool.icon} ${esc(tool.title)}</b><br>السعر: <b>${esc(money(tool.price))}</b> — مدة الاشتراك: <b>${tool.duration} يوم</b> تبدأ من لحظة موافقة مدير النظام.</div>
    ${field('paid', 'المبلغ المدفوع', String(tool.price), 'number', true, 'min="0"')}
    ${field('ref', 'رقم عملية التحويل / ملاحظة (اختياري)', '', 'text', false, 'placeholder="مثال: فودافون كاش — رقم العملية"')}
    <div class="notice" style="margin:0">📨 يُرسل الطلب إلى <b>مدير النظام</b> وحده للموافقة عليه — تُفعَّل الأداة فور الموافقة وتظهر في «أدواتي».</div>`, data => {
    db.purchases.unshift({ id: 'pur-' + uid(), toolId: tool.id, buyerKind: kind, buyerId: buyer.id, buyerName: buyer.name, at: dateTime(), price: Number(data.get('paid')) || tool.price, ref: String(data.get('ref') || '').trim(), trial: false, status: 'pending', ends: '', trialEnds: '' });
    logAct(buyer.name, `أرسل طلب شراء أداة «${tool.title}» — بانتظار موافقة مدير النظام`);
    if (!save()) { db.purchases.shift(); return toast('تعذر الحفظ — مساحة التخزين ممتلئة.', 'error'); }
    closeModal(); render(); toast('تم إرسال طلب الشراء ⏳ — سيُفعَّل بعد موافقة مدير النظام.');
  }, '📨 إرسال الطلب للأدمن');
}
function storeTrial(id) {
  const tool = find('store', id); if (!tool || !tool.trialDays) return;
  const kind = session.kind;
  const buyer = kind === 'teacher' ? find('teachers', session.id) : find('students', session.id);
  if (!buyer) return;
  const acc = toolAccess(tool.id, kind, session.id);
  if (acc.hasAccess) return toast('لديك اشتراك نشط بهذه الأداة بالفعل.', 'error');
  if (acc.usedTrial) return toast('استخدمت تجربتك المجانية لهذه الأداة — يمكنك شراؤها.', 'error');
  modal('بدء التجربة المجانية — ' + tool.title, `<div class="notice">ستحصل على <b>${tool.trialDays} يوم</b> تجربة مجانية كاملة لهذه الأداة — تجربة واحدة فقط لكل حساب.</div>`, () => {
    db.purchases.unshift({ id: 'pur-' + uid(), toolId: tool.id, buyerKind: kind, buyerId: buyer.id, buyerName: buyer.name, at: dateTime(), price: 0, trial: true, status: 'approved', ends: '', trialEnds: dateAfter(tool.trialDays) });
    logAct(buyer.name, `بدأ تجربة مجانية لأداة «${tool.title}»`);
    if (!save()) { db.purchases.shift(); return toast('تعذر الحفظ — مساحة التخزين ممتلئة.', 'error'); }
    closeModal(); render(); toast('بدأت تجربتك المجانية ⏱️ — افتح الأداة من المتجر.');
  }, '⏱️ بدء التجربة');
}
function toolError(msg, offerStore = false) {
  $('#app').innerHTML = `<div class="pub-wrap"><div class="pub-error-page">
    <div class="pub-sad">🔒</div><h1>تعذر فتح الأداة</h1><p>${esc(msg)}</p>
    ${offerStore ? `<div style="margin-top:14px"><button type="button" class="btn btn-primary" data-action="goto-store">🛒 الذهاب للمتجر</button></div>` : ''}
  </div></div>`;
}
function renderToolPage(id) {
  const tool = id ? find('store', id) : null;
  document.body.classList.toggle('dark', !!db.settings.dark);
  $('#modal-root').innerHTML = '';
  const kind = session?.kind;
  if (!session || (kind !== 'admin' && kind !== 'teacher' && kind !== 'student')) return toolError('سجّل الدخول بحسابك (طالب أو معلم) أولاً لفتح الأداة.');
  if (!tool || !tool.active) return toolError('هذه الأداة غير متاحة حالياً — راجع مدير النظام.');
  let expText = 'مفعّلة';
  if (kind !== 'admin') {
    const acc = toolAccess(tool.id, kind, session.id);
    if (!acc.hasAccess) return toolError('لا تملك اشتراكاً نشطاً بهذه الأداة — يمكنك شراؤها من المتجر.', true);
    expText = acc.paid ? `اشتراكك ينتهي: ${acc.paid.ends}` : `تجربتك تنتهي: ${acc.trial.trialEnds}`;
  } else {
    expText = 'معاينة الأدمن';
  }
  const src = tool.fileRef ? `<iframe class="tool-frame" src="${esc(tool.fileRef)}"></iframe>` : `<iframe class="tool-frame" id="tool-frame"></iframe>`;
  $('#app').innerHTML = `<div class="tool-wrap">
    <div class="tool-bar"><button type="button" class="btn btn-light btn-sm" data-action="tool-back">→ رجوع للمتجر</button><b>${esc(tool.icon || '🧰')} ${esc(tool.title)}</b><span class="tool-exp">${esc(expText)}</span></div>
    ${src}
  </div>`;
  if (!tool.fileRef) {
    try { $('#tool-frame').src = URL.createObjectURL(new Blob([tool.file || '<p>لا يوجد ملف</p>'], { type: 'text/html' })); } catch { toast('تعذر فتح ملف الأداة.', 'error'); }
  }
}

/* ===== الرسائل (الدفع/الدعم/الكل) ===== */
function mySubmissions() {
  if (session.kind === 'admin') return db.submissions;
  if (session.kind === 'student') return studentSubmissions();
  if (session.kind === 'teacher') return db.submissions.filter(s => s.teacherId === session.id);
  return db.submissions.filter(s => s.supervisorId === session.id);
}
function paymentsPage() {
  const list = mySubmissions().filter(s => s.formType === 'payment' && (filters.payStatus === 'all' || s.status === filters.payStatus));
  const rows = list.map(s => `<tr data-search="${esc(s.name + ' ' + (s.data.senderPhone || '') + ' ' + (s.data.targetNumber || ''))}">
    <td><b>${esc(s.name)}</b></td><td>${esc(s.grade || '—')}</td><td>${esc(money(s.data.amount))}</td>
    <td>${esc(s.data.targetLabel || '')}<div style="font-size:11px;color:var(--muted)" dir="ltr">${esc(s.data.targetNumber || '')}</div></td>
    <td>${esc(TYPE_LABEL[s.data.transferType] || '—')}</td>
    <td><span dir="ltr">${esc(s.data.senderPhone || '—')}</span></td>
    <td>${esc(s.createdAt)}</td><td>${statusBadge(s.status)}</td>
    <td><div class="actions">${actionBtn('👁️', 'sub-view', s.id)}${s.status === 'new' ? actionBtn('✓', 'sub-confirm', s.id) + actionBtn('✕', 'sub-reject', s.id) : actionBtn('↩️', 'sub-reopen', s.id)}</div></td>
  </tr>`).join('');
  return pageHead('رسائل الدفع', 'تأكيدات التحويل التي أرسلها الطلاب عبر نموذج الدفع', actionBtn('⬇️', 'export-current', '', 'btn btn-light')) +
    tableToolbar('ابحث بالاسم أو الرقم…', `<select data-sub-status><option value="all" ${filters.payStatus === 'all' ? 'selected' : ''}>كل الحالات</option><option value="new" ${filters.payStatus === 'new' ? 'selected' : ''}>جديد</option><option value="confirmed" ${filters.payStatus === 'confirmed' ? 'selected' : ''}>مؤكد</option><option value="rejected" ${filters.payStatus === 'rejected' ? 'selected' : ''}>مرفوض</option></select>`) +
    `<div class="table-wrap"><table><thead><tr><th data-sortable>الطالب</th><th>الصف</th><th data-sortable>المبلغ</th><th>الحساب المحوّل عليه</th><th>نوع التحويل</th><th>الرقم المحوّل منه</th><th data-sortable>التاريخ</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>${rows || emptyRow(9, 'لا رسائل دفع' + (filters.payStatus === 'all' ? ' بعد — شارك رابط نموذج الدفع' : ' بهذه الحالة'))}</tbody></table></div>`;
}
function supportPage() {
  const list = mySubmissions().filter(s => s.formType === 'support' && (filters.supStatus === 'all' || s.status === filters.supStatus));
  const rows = list.map(s => `<tr data-search="${esc(s.name + ' ' + (s.data.question || ''))}">
    <td><b>${esc(s.name)}</b></td><td>${esc(s.grade || '—')}</td>
    <td style="white-space:normal;max-width:340px">${esc(String(s.data.question || '').slice(0, 60))}${String(s.data.question || '').length > 60 ? '…' : ''}</td>
    <td>${esc(s.createdAt)}</td><td>${statusBadge(s.status)}</td>
    <td><div class="actions">${actionBtn('👁️', 'sub-view', s.id)}${s.status === 'new' ? actionBtn('✓ تم الرد', 'sub-resolve', s.id, 'btn btn-success btn-sm') : actionBtn('↩️', 'sub-reopen', s.id)}</div></td>
  </tr>`).join('');
  return pageHead('الدعم العلمي', session.kind === 'supervisor' ? 'الأسئلة الموجّهة إليك من نماذج المعلمين' : 'أسئلة الدعم الواردة عبر نماذجك', actionBtn('⬇️', 'export-current', '', 'btn btn-light')) +
    tableToolbar('ابحث بالاسم أو السؤال…', `<select data-sub-status><option value="all" ${filters.supStatus === 'all' ? 'selected' : ''}>كل الحالات</option><option value="new" ${filters.supStatus === 'new' ? 'selected' : ''}>جديد</option><option value="resolved" ${filters.supStatus === 'resolved' ? 'selected' : ''}>تم الرد</option></select>`) +
    `<div class="table-wrap"><table><thead><tr><th data-sortable>الطالب</th><th>الصف</th><th>السؤال</th><th data-sortable>التاريخ</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>${rows || emptyRow(6, 'لا أسئلة' + (filters.supStatus === 'all' ? ' بعد' : ' بهذه الحالة'))}</tbody></table></div>`;
}
function messagesPage() {
  const list = db.submissions.filter(s => (filters.msgType === 'all' || s.formType === filters.msgType) && (filters.msgStatus === 'all' || s.status === filters.msgStatus));
  const rows = list.map(s => `<tr data-search="${esc(s.name + ' ' + teacherName(s.teacherId) + ' ' + (s.data.question || ''))}">
    <td>${s.formType === 'payment' ? badge('دفع', 'info') : badge('دعم', 'warning')}</td>
    <td><b>${esc(s.name)}</b></td><td>${esc(s.grade || '—')}</td>
    <td>${esc(teacherName(s.teacherId))}</td>
    <td>${esc(s.formType === 'payment' ? 'لوحة المعلم' : (s.supervisorId ? supervisorName(s.supervisorId) : 'لوحة المعلم'))}</td>
    <td>${esc(s.formType === 'payment' ? money(s.data.amount) : String(s.data.question || '').slice(0, 40) + '…')}</td>
    <td>${esc(s.createdAt)}</td><td>${statusBadge(s.status)}</td>
    <td>${actionBtn('👁️', 'sub-view', s.id)}</td>
  </tr>`).join('');
  return pageHead('كل الرسائل', 'جميع رسائل الدفع والدعم في المنصة', actionBtn('⬇️', 'export-current', '', 'btn btn-light')) +
    tableToolbar('ابحث…', `<select data-msg-type><option value="all" ${filters.msgType === 'all' ? 'selected' : ''}>كل الأنواع</option><option value="payment" ${filters.msgType === 'payment' ? 'selected' : ''}>دفع</option><option value="support" ${filters.msgType === 'support' ? 'selected' : ''}>دعم علمي</option></select>
    <select data-msg-status><option value="all" ${filters.msgStatus === 'all' ? 'selected' : ''}>كل الحالات</option><option value="new" ${filters.msgStatus === 'new' ? 'selected' : ''}>جديد</option><option value="confirmed" ${filters.msgStatus === 'confirmed' ? 'selected' : ''}>مؤكد</option><option value="rejected" ${filters.msgStatus === 'rejected' ? 'selected' : ''}>مرفوض</option><option value="resolved" ${filters.msgStatus === 'resolved' ? 'selected' : ''}>تم الرد</option></select>`) +
    `<div class="table-wrap"><table><thead><tr><th>النوع</th><th data-sortable>الطالب</th><th>الصف</th><th>المعلم</th><th>الموجّه إلى</th><th>المحتوى</th><th data-sortable>التاريخ</th><th>الحالة</th><th></th></tr></thead><tbody>${rows || emptyRow(9, 'لا رسائل بعد')}</tbody></table></div>`;
}
function subDetail(id) {
  const s = find('submissions', id); if (!s) return;
  const d = s.data || {};
  const kv = (k, v) => v ? `<li><span>${k}</span><b style="text-align:left">${esc(v)}</b></li>` : '';
  let body = `<ul class="list">
    ${kv('الطالب', s.name)}${kv('الصف الدراسي', s.grade)}${kv('التاريخ', s.createdAt)}${s.studentId ? kv('مرتبطة بحساب طالب', studentAccName(s.studentId)) : kv('رمز متابعة الطالب', s.studentCode)}
    ${s.formType === 'payment' ? kv('المبلغ', money(d.amount)) + kv('الحساب المحوّل عليه', (d.targetLabel || '') + ' — ' + (d.targetNumber || '')) + kv('نوع التحويل', TYPE_LABEL[d.transferType] || '') + kv('الرقم المحوّل منه', d.senderPhone) + kv('رقم العملية', d.transactionNumber) + kv('رقم الحساب', d.accountNumber) + kv('ملاحظات', d.notes) : ''}
    ${s.formType === 'support' ? `<li style="display:block"><span style="display:block;margin-bottom:6px">السؤال</span><div style="white-space:pre-wrap;background:var(--th-bg);padding:12px;border-radius:9px">${esc(d.question || '')}</div></li>${kv('ملاحظات', d.notes)}` : ''}
    ${Object.keys(d.custom || {}).map(k => kv((d.customLabels || {})[k] || k, d.custom[k])).join('')}
    <li><span>الحالة</span>${statusBadge(s.status)}</li>
    <li><span>النموذج</span><b>${esc(find('forms', s.formId)?.title || '—')}</b></li>
  </ul>`;
  if (s.image) body += `<div style="margin-top:14px"><b style="font-size:12px;color:var(--muted)">📎 ${esc(s.imageName || 'صورة مرفقة')}</b><img class="detail-img" src="${s.image}" alt="مرفق"></div>`;
  const actions = s.status === 'new'
    ? (s.formType === 'payment'
      ? actionBtn('✓ تأكيد الدفع', 'sub-confirm', s.id, 'btn btn-success') + actionBtn('✕ رفض', 'sub-reject', s.id, 'btn btn-danger')
      : actionBtn('✓ تم الرد على السؤال', 'sub-resolve', s.id, 'btn btn-success'))
    : actionBtn('↩️ إعادة فتح', 'sub-reopen', s.id, 'btn btn-light');
  body += `<div class="field" style="margin-top:16px"><label>ردك على الطالب (يُحفظ مع الرسالة)</label><textarea id="sub-reply-${esc(s.id)}" placeholder="اكتب ردك أو ملاحظتك هنا…">${esc(s.reply || '')}</textarea></div>
  <div class="modal-foot">${actions}<button type="button" class="btn btn-primary" data-action="sub-reply" data-id="${esc(s.id)}">💾 حفظ الرد</button></div>`;
  infoModal((s.formType === 'payment' ? 'رسالة دفع — ' : 'سؤال دعم — ') + s.name, body);
}
function subAction(id, act) {
  const s = find('submissions', id); if (!s) return;
  const replyEl = $('#sub-reply-' + CSS.escape(id));
  const reply = replyEl ? replyEl.value.trim() : (s.reply || '');
  const who = sessionLabel();
  if (act === 'reply') {
    s.reply = reply;
    if (s.formType === 'support' && s.status === 'new' && reply) s.status = 'resolved';
    logAct(who, s.formType === 'payment' ? `حفظ رداً على دفعة ${s.name}` : `رد على سؤال ${s.name}`);
    if (!save()) return toast('تعذر الحفظ — مساحة التخزين ممتلئة.', 'error');
    render(); subDetail(id); toast('تم حفظ الرد.');
    return;
  }
  s.reply = reply;
  if (act === 'confirm') { s.status = 'confirmed'; logAct(who, `أكد دفعة ${s.name} بمبلغ ${money(s.data.amount)}`); toast('تم تأكيد الدفعة.'); }
  if (act === 'reject') { s.status = 'rejected'; logAct(who, `رفض دفعة ${s.name}`); toast('تم رفض الدفعة.'); }
  if (act === 'resolve') { s.status = 'resolved'; logAct(who, `أنهى سؤال ${s.name}`); toast('تم وضع علامة «تم الرد» على السؤال.'); }
  if (act === 'reopen') { s.status = 'new'; logAct(who, `أعاد فتح رسالة ${s.name}`); toast('أُعيد فتح الرسالة.'); }
  if (!save()) return toast('تعذر الحفظ — مساحة التخزين ممتلئة.', 'error');
  closeModal(); render();
}

/* ===== حسابات الدفع (المعلم) ===== */
function payAccountForm(id) {
  const t = session.kind === 'teacher' ? find('teachers', session.id) : null;
  if (!t) return;
  const acc = id ? (t.payAccounts || []).find(a => a.id === id) : null;
  modal(acc ? 'تعديل حساب دفع' : 'إضافة حساب دفع', `<div class="notice">تظهر هذه الحسابات في نموذج الدفع — يضغط الطالب على الحساب فيُنسخ الرقم تلقائياً. حسابات إنستا باي تفرض نوع التحويل «إنستا باي».</div>
  <div class="form-grid">
    ${selectField('provider', 'النوع', acc?.provider || 'vodafone', Object.entries(PROVIDERS))}
    ${field('label', 'الاسم الظاهر', acc?.label || '', 'text', true, 'placeholder="مثال: فودافون كاش"')}
    ${field('number', 'الرقم / الحساب', acc?.number || '', 'text', true, 'dir="ltr" placeholder="11 رقم" inputmode="numeric" maxlength="14"')}
  </div>`, data => {
    const item = { ...(acc || {}), id: acc?.id || 'pa-' + uid() };
    item.provider = data.get('provider');
    item.label = String(data.get('label') || '').trim();
    item.number = String(data.get('number') || '').trim();
    if (!item.label || !item.number) return toast('الاسم والرقم مطلوبان.', 'error');
    if (!/^[0-9]{6,14}$/.test(item.number)) return toast('أدخل رقماً صحيحاً (أرقام فقط، من 6 إلى 14 رقماً).', 'error');
    if ((t.payAccounts || []).some(a => a.number === item.number && a.id !== item.id)) return toast('هذا الرقم مضاف بالفعل كحساب دفع.', 'error');
    t.payAccounts = t.payAccounts || [];
    if (acc) Object.assign(acc, item); else t.payAccounts.push(item);
    logAct(sessionLabel(), `${acc ? 'عدّل' : 'أضاف'} حساب دفع ${item.label}`);
    if (!save()) return toast('تعذر الحفظ — مساحة التخزين ممتلئة.', 'error');
    closeModal(); render(); toast('تم حفظ حساب الدفع.');
  });
}

/* ===== الحسابات (الأدمن) ===== */
function accountsPage() {
  const card = (title, rows, emptyText) => `<div class="panel"><h2>${title}</h2>${rows.length ? `<ul class="list">${rows.join('')}</ul>` : `<p class="empty">${esc(emptyText)}</p>`}</div>`;
  const userRows = db.users.map(u => `<li><div><b>${esc(u.name)}</b><div style="font-size:12px;color:var(--muted)">${esc(u.username)}</div></div>${badge('دائم', 'success')}</li>`);
  const tRows = db.teachers.map(t => {
    const days = subDays(t.subscriptionEnd);
    return `<li><div><b>${esc(t.name)}</b> — ${esc(t.specialty || '')}<div style="font-size:12px;color:var(--muted)">${esc(t.username)} · ${(t.payAccounts || []).length} حساب دفع</div></div><div class="actions">${days === null ? badge('مفتوح', 'neutral') : days < 0 ? badge('منتهي', 'danger') : badge(days + ' يوم', days <= 10 ? 'warning' : 'success')}${actionBtn('🔄', 'teacher-renew', t.id)}${actionBtn('✏️', 'teacher-edit', t.id)}</div></li>`;
  });
  const sRows = db.supervisors.map(s => {
    const days = subDays(s.subscriptionEnd);
    return `<li><div><b>${esc(s.name)}</b> — ${esc(s.specialty || '')}<div style="font-size:12px;color:var(--muted)">${esc(s.username)} · ${db.submissions.filter(x => x.supervisorId === s.id).length} سؤال</div></div><div class="actions">${days === null ? badge('مفتوح', 'neutral') : days < 0 ? badge('منتهي', 'danger') : badge(days + ' يوم', days <= 10 ? 'warning' : 'success')}${actionBtn('🔄', 'sp-renew', s.id)}${actionBtn('✏️', 'sp-edit', s.id)}</div></li>`;
  });
  const stuRows = db.students.map(s => `<li><div><b>${esc(s.name)}</b> — ${esc(s.grade || '')}<div style="font-size:12px;color:var(--muted)">${esc(s.username)} · ${db.submissions.filter(x => x.studentId === s.id).length} رسالة بحسابه</div></div><div class="actions">${actionBtn('🗑️', 'student-del', s.id)}</div></li>`);
  return pageHead('الحسابات والأدوار', 'كل حسابات المنصة وحالة اشتراكاتها') +
    `<div class="grid dashboard-grid">${card('👑 مدير النظام', userRows, '')}${card('👨‍🏫 المعلمون', tRows, 'لا معلمين بعد')}${card('🧑‍🔧 الإرشاف المختص', sRows, 'لا مشرفين بعد')}${card('🎒 الطلاب', stuRows, 'لا طلاب بعد — الطالب ينشئ حسابه من بوابة الطالب')}</div>`;
}

/* ===== التقارير (الأدمن والمعلم) ===== */
function reportsPage() {
  const kind = session.kind;
  const isTeacher = kind === 'teacher';
  const mine = isTeacher ? db.submissions.filter(s => s.teacherId === session.id) : kind === 'supervisor' ? db.submissions.filter(s => s.supervisorId === session.id) : db.submissions;
  const pays = mine.filter(s => s.formType === 'payment');
  const sups = mine.filter(s => s.formType === 'support');
  const confirmed = pays.filter(s => s.status === 'confirmed');
  const confirmedSum = confirmed.reduce((a, s) => a + (parseFloat(s.data?.amount) || 0), 0);
  const replied = sups.filter(s => s.status === 'resolved').length;
  const done = confirmed.length + replied;
  const doneRate = mine.length ? Math.round(done / mine.length * 100) : 0;

  const days14 = [...Array(14)].map((_, i) => { const x = new Date(); x.setDate(x.getDate() - (13 - i)); return date(x); });
  const payC = days14.map(d => pays.filter(s => s.createdAt.startsWith(d)).length);
  const supC = days14.map(d => sups.filter(s => s.createdAt.startsWith(d)).length);
  const max = Math.max(1, ...payC, ...supC);
  const chart = `<div class="bars dual">${days14.map((d, i) => `<div class="bar-pair"><div class="bar pay" title="مدفوعات: ${payC[i]}" style="height:${Math.max(4, Math.round(payC[i] / max * 100))}%"></div><div class="bar sup" title="أسئلة دعم: ${supC[i]}" style="height:${Math.max(4, Math.round(supC[i] / max * 100))}%"></div><small>${d.slice(5)}</small></div>`).join('')}</div>
  <div class="chart-legend"><span><i style="background:var(--primary)"></i>مدفوعات</span><span><i style="background:var(--warning)"></i>أسئلة دعم</span></div><div style="height:26px"></div>`;

  const formsList = kind === 'admin' ? db.forms : isTeacher ? db.forms.filter(f => f.teacherId === session.id) : [...new Set(mine.map(s => s.formId))].map(id => find('forms', id)).filter(Boolean);
  const formRows = formsList.map(f => {
    const subs = mine.filter(s => s.formId === f.id);
    const c = st => subs.filter(s => s.status === st).length;
    return `<tr data-search="${esc(f.title + ' ' + (f.type === 'payment' ? 'دفع' : 'دعم'))}">
      <td><b>${esc(f.title)}</b></td>
      <td>${f.type === 'payment' ? badge('دفع', 'info') : badge('دعم', 'warning')}</td>
      <td><b>${subs.length}</b></td><td>${c('new')}</td><td>${c('confirmed')}</td><td>${c('rejected')}</td><td>${c('resolved')}</td>
    </tr>`;
  }).join('');

  const grades = [...new Set(mine.map(s => s.grade).filter(Boolean))];
  const gradeRows = grades.map(g => {
    const c = mine.filter(s => s.grade === g).length;
    const pct = Math.round(c / Math.max(1, mine.length) * 100);
    return `<div class="progress-row"><span>${esc(g)}</span><div class="progress"><i style="width:${pct}%"></i></div><b>${c}</b></div>`;
  }).join('');

  // إحصائيات إضافية للأدمن: الطلاب (التقارير المالية منفصلة في صفحة مستقلة)
  let adminExtra = '';
  if (kind === 'admin') {
    adminExtra = `
    <div class="panel" style="margin-top:16px"><h2>👥 الطلاب المسجلون</h2>
    <div class="notice">الطلاب أنشأوا حساباتهم من بوابة الطالب — كل طالب يتابع كل رسائله من حسابه. <button type="button" class="btn btn-light btn-sm" data-action="goto-finreports" style="margin-inline-start:8px">💰 التقارير المالية</button></div>
    ${statCards([{ icon: '🎒', label: 'حسابات الطلاب', value: db.students.length, trend: db.submissions.filter(s => s.studentId).length + ' رسالة مرتبطة بحسابات', accent: '#e3edfd' }])}</div>`;
  }

  const title = isTeacher ? 'تقارير أدائي' : kind === 'supervisor' ? 'تقاريري — الدعم العلمي' : 'تقارير المنصة';
  return pageHead(title, 'إحصائيات مفصلة عن الرسائل والمدفوعات والأسئلة' + (kind !== 'admin' ? ' الخاصة بك' : ''),
      actionBtn('🖨️', 'print-page', '', 'btn btn-light') + actionBtn('⬇️', 'report-export', '', 'btn btn-light')) +
    statCards([
      { icon: '📨', label: 'إجمالي الرسائل', value: mine.length, trend: pays.length + ' دفع · ' + sups.length + ' دعم', accent: '#e3edfd' },
      { icon: '💰', label: 'مدفوعات مؤكدة', value: confirmed.length, trend: 'بإجمالي ' + money(confirmedSum), accent: '#dff7ed' },
      { icon: '💡', label: 'أسئلة تم الرد', value: replied, trend: 'من ' + sups.length + ' سؤال', accent: '#fff3d4' },
      { icon: '📈', label: 'نسبة الإنجاز', value: doneRate + '%', trend: 'مؤكد + تم الرد', accent: '#fce4e8' }
    ]) +
    `<div class="grid dashboard-grid" style="margin-top:16px">
      <div class="panel"><h2>📈 الرسائل — آخر 14 يوماً</h2>${chart}</div>
      <div class="panel"><h2>🧭 توزيع حالات الرسائل</h2>${donut([
        ['جديد', mine.filter(s => s.status === 'new').length, '#4f8ef7'],
        ['مؤكد / تم الرد', done, '#10b981'],
        ['مرفوض', mine.filter(s => s.status === 'rejected').length, '#ef4444']
      ], mine.length, 'رسالة')}</div>
    </div>
    <div class="grid dashboard-grid" style="margin-top:16px">
      <div class="panel"><h2>🎓 الرسائل حسب الصف الدراسي</h2>${gradeRows || '<p class="empty">لا رسائل بعد.</p>'}</div>
      <div class="panel"><h2>🗓️ الرسائل حسب الشهر</h2>${monthRows(mine) || '<p class="empty">لا رسائل بعد.</p>'}</div>
    </div>
    <div class="panel" style="margin-top:16px"><h2>📋 تفصيل حسب النموذج</h2>
    ${tableToolbar('ابحث في النماذج…')}
    <div class="table-wrap"><table><thead><tr><th>النموذج</th><th>النوع</th><th data-sortable>الإجمالي</th><th>جديد</th><th>مؤكد</th><th>مرفوض</th><th>تم الرد</th></tr></thead><tbody>${formRows || emptyRow(7, 'لا نماذج بعد.')}</tbody></table></div></div>`
    + adminExtra;
}
function monthRows(list) {
  const months = {};
  list.forEach(s => { const m = String(s.createdAt || '').slice(0, 7); if (m) months[m] = (months[m] || 0) + 1; });
  const keys = Object.keys(months).sort().reverse().slice(0, 6);
  if (!keys.length) return '';
  const max = Math.max(1, ...keys.map(k => months[k]));
  return keys.map(k => `<div class="progress-row"><span>${k}</span><div class="progress"><i style="width:${Math.round(months[k] / max * 100)}%"></i></div><b>${months[k]}</b></div>`).join('');
}
function teacherMoneyStats(id) {
  const t = find('teachers', id); if (!t) return '';
  const list = t.courses || [];
  const students = list.reduce((a, c) => a + (Number(c.studentsCount) || 0), 0);
  const debt = teacherDebt(t);
  return `<div class="grid stats two" style="margin-top:16px">
    <div class="stat-card"><span class="sc-ic" style="background:#dff7ed">🎓</span><div class="sc-body"><span class="label">راتبك المستحق من الكورسات</span><strong>${esc(money(teacherSalary(t)))}</strong><span class="trend">${students} طالب في ${list.length} كورس</span></div></div>
    <div class="stat-card"><span class="sc-ic" style="background:${debt > 0 ? '#fce4e8' : '#dff7ed'}">⚠️</span><div class="sc-body"><span class="label">المستحق عليك (دينك للمنصة)</span><strong style="${debt > 0 ? 'color:var(--danger)' : ''}">${esc(money(debt))}</strong><span class="trend">${debt > 0 ? 'يُصفّاه مدير النظام دورياً' : 'تمت تصفيتك بالكامل ✓'}</span></div></div>
  </div>`;
}
function teacherSettlePanel(id) {
  const list = db.settlements.filter(x => x.teacherId === id).slice(0, 6);
  if (!list.length) return '';
  return `<div class="panel" style="margin-top:16px"><h2>🕘 سجل تصفيات ديونك السابقة</h2>
  <div class="table-wrap"><table><thead><tr><th>الكورس</th><th>التاريخ</th><th>الطلاب المُصفّون</th><th>المدفوع</th><th>ملاحظة</th></tr></thead><tbody>${list.map(x => `<tr><td>${esc(x.courseTitle)}</td><td>${esc(x.at)}</td><td>${x.studentsSettled}</td><td><b style="color:var(--success)">${esc(money(x.amount))}</b></td><td>${esc(x.note || '—')}</td></tr>`).join('')}</tbody></table></div></div>`;
}

/* ===== التقارير المالية (منفصلة عن تقارير الرسائل) ===== */
function finReportsPage() {
  const isTeacher = session.kind === 'teacher';
  if (isTeacher) {
    const t = find('teachers', session.id);
    const list = t.courses || [];
    const rows = list.map(c => `<tr data-search="${esc(c.title)}">
      <td><b>${esc(c.title)}</b></td>
      <td>${esc(money(c.price))}</td>
      <td>${badge((Number(c.commission) || 0) + '%', 'info')}</td>
      <td>${Number(c.studentsCount) || 0}${c.settledStudents ? `<div style="font-size:11px;color:var(--muted)">مُصفّى: ${c.settledStudents}</div>` : ''}</td>
      <td><b>${esc(money(courseSalary(c)))}</b></td>
      <td>${courseDebt(c) > 0 ? `<b style="color:var(--danger)">${esc(money(courseDebt(c)))}</b>` : badge('مُصفّى', 'success')}</td>
    </tr>`).join('');
    return pageHead('تقاريري المالية', 'رواتبك وديونك من الكورسات وسجل التصفيات — النشر والتعديل بيد مدير النظام',
        actionBtn('🖨️', 'print-page', '', 'btn btn-light')) +
      teacherMoneyStats(session.id) +
      `<div class="panel" style="margin-top:16px"><h2>🎓 تفصيل كورساتك</h2>
      <div class="table-wrap"><table><thead><tr><th>الكورس</th><th>سعره</th><th>نسبتك</th><th>الطلاب</th><th>راتبك منه</th><th>الدين عليه</th></tr></thead><tbody>${rows || emptyRow(6, 'لا كورسات منشورة لك بعد — مدير النظام هو من ينشر الكورسات')}</tbody></table></div></div>` +
      teacherSettlePanel(session.id);
  }
  const activeT = db.teachers.filter(t => !t.subscriptionEnd || subDays(t.subscriptionEnd) >= 0);
  const activeS = db.supervisors.filter(s => !s.subscriptionEnd || subDays(s.subscriptionEnd) >= 0);
  const subRevenue = activeT.reduce((a, t) => a + (t.subscriptionType === 'yearly' ? (Number(t.subscriptionPrice) || 0) / 12 : (Number(t.subscriptionPrice) || 0)), 0)
    + activeS.reduce((a, s) => a + (s.subscriptionType === 'yearly' ? (Number(s.subscriptionPrice) || 0) / 12 : (Number(s.subscriptionPrice) || 0)), 0);
  const teacherSalaryTotal = db.teachers.reduce((a, t) => a + teacherSalary(t), 0);
  const teacherDebtTotal = db.teachers.reduce((a, t) => a + teacherDebt(t), 0);
  const soonT = db.teachers.filter(t => { const d = subDays(t.subscriptionEnd); return d !== null && d >= 0 && d <= 10; });
  const soonS = db.supervisors.filter(s => { const d = subDays(s.subscriptionEnd); return d !== null && d >= 0 && d <= 10; });
  const subRows = [...db.teachers.map(t => ({ name: t.name, role: 'معلم', type: t.subscriptionType, price: t.subscriptionPrice, end: t.subscriptionEnd })), ...db.supervisors.map(s => ({ name: s.name, role: 'مشرف', type: s.subscriptionType, price: s.subscriptionPrice, end: s.subscriptionEnd }))]
    .map(x => `<tr data-search="${esc(x.name + ' ' + x.role)}"><td><b>${esc(x.name)}</b></td><td>${badge(x.role, x.role === 'معلم' ? 'info' : 'warning')}</td><td>${x.type === 'yearly' ? 'سنوي' : 'شهري'}</td><td>${esc(money(x.price))}</td><td>${esc(x.end || '—')}</td><td>${subDays(x.end) === null ? badge('مفتوح', 'neutral') : subDays(x.end) < 0 ? badge('منتهي', 'danger') : badge(subDays(x.end) + ' يوم', subDays(x.end) <= 10 ? 'warning' : 'success')}</td></tr>`).join('');
  const courseRows = db.teachers.map(t => {
    const list = t.courses || [];
    return `<tr data-search="${esc(t.name)}"><td><b>${esc(t.name)}</b></td><td>${list.length}</td><td>${esc(money(list.reduce((a, c) => a + (Number(c.studentsCount) || 0), 0)))}</td><td><b>${esc(money(teacherSalary(t)))}</b></td><td><b style="color:${teacherDebt(t) > 0 ? 'var(--danger)' : 'var(--success)'}">${esc(money(teacherDebt(t)))}</b></td><td>${actionBtn('🎓', 'goto-courses', '', 'action')}</td></tr>`;
  }).join('');
  const settleRows = db.settlements.map(x => `<tr data-search="${esc(x.teacherName + ' ' + x.courseTitle)}"><td><b>${esc(x.courseTitle)}</b></td><td>${esc(x.teacherName)}</td><td>${esc(x.at)}</td><td>${x.studentsSettled} طالب</td><td><b style="color:var(--success)">${esc(money(x.amount))}</b></td><td>${esc(x.note || '—')}</td></tr>`).join('');
  const buys = db.purchases.filter(p => !p.trial);
  const storeRevenue = buys.reduce((a, p) => a + (Number(p.price) || 0), 0);
  const storeRows = db.purchases.map(p => {
    const today = date();
    let status;
    if (p.status === 'pending') status = badge('قيد المراجعة', 'warning');
    else if (p.status === 'rejected') status = badge('مرفوض', 'danger');
    else if (p.trial) status = (p.trialEnds || '') >= today ? badge('تجربة نشطة', 'warning') : badge('انتهت', 'neutral');
    else status = (p.ends || '') >= today ? badge('مفعّل', 'success') : badge('منتهي', 'neutral');
    return `<tr data-search="${esc(p.buyerName)}"><td><b>${esc(p.buyerName)}</b><div style="font-size:11px;color:var(--muted)">${buyerLabel(p.buyerKind)}</div></td><td>${esc(find('store', p.toolId)?.title || '—')}</td><td>${p.trial ? badge('مجاني', 'warning') : (p.status === 'approved' ? esc(money(p.price)) : badge(p.status === 'pending' ? 'معلق' : 'مرفوض', p.status === 'pending' ? 'warning' : 'danger'))}</td><td>${esc(p.at)}</td><td>${status}</td></tr>`;
  }).join('');
  return pageHead('التقارير المالية', 'الاشتراكات والرواتب والديون والتصفيات وإيرادات المتجر — منفصلة عن تقارير الرسائل',
      actionBtn('🖨️', 'print-page', '', 'btn btn-light') + actionBtn('⬇️', 'fin-export', '', 'btn btn-light')) +
    statCards([
      { icon: '💳', label: 'إيراد الاشتراكات المتوقع', value: money(subRevenue) + ' / شهر', trend: activeT.length + activeS.length + ' اشتراك نشط', accent: '#e3edfd' },
      { icon: '🎓', label: 'رواتب المعلمين', value: money(teacherSalaryTotal), trend: 'مستحقة للمعلمين', accent: '#dff7ed' },
      { icon: '⚠️', label: 'ديون مستحقة', value: money(teacherDebtTotal), trend: db.settlements.length + ' عملية تصفية', accent: '#fce4e8' },
      { icon: '🛒', label: 'إيرادات المتجر', value: money(storeRevenue), trend: buys.length + ' عملية شراء', accent: '#fff3d4' }
    ]) +
    `<div class="grid dashboard-grid" style="margin-top:16px">
      <div class="panel"><h2>💳 الاشتراكات ${soonT.length + soonS.length ? `<span class="nav-badge" style="display:inline-block">${soonT.length + soonS.length} تنتهي قريباً</span>` : ''}</h2>
      <div class="table-wrap"><table><thead><tr><th>الحساب</th><th>الدور</th><th>النوع</th><th>القيمة</th><th>ينتهي</th><th>المتبقي</th></tr></thead><tbody>${subRows || emptyRow(6, 'لا اشتراكات بعد')}</tbody></table></div></div>
      <div class="panel"><h2>🎓 الرواتب والديون حسب المعلم</h2>
      <div class="table-wrap"><table><thead><tr><th>المعلم</th><th>الكورسات</th><th>الطلاب</th><th>راتبه</th><th>دينه</th><th></th></tr></thead><tbody>${courseRows || emptyRow(6, 'لا كورسات بعد')}</tbody></table></div></div>
    </div>
    <div class="grid dashboard-grid" style="margin-top:16px">
      <div class="panel"><h2>🕘 سجل التصفيات</h2>
      <div class="table-wrap"><table><thead><tr><th>الكورس</th><th>المعلم</th><th>التاريخ</th><th>الطلاب</th><th>المدفوع</th><th>ملاحظة</th></tr></thead><tbody>${settleRows || emptyRow(6, 'لا تصفيات بعد')}</tbody></table></div></div>
      <div class="panel"><h2>🛒 إيرادات المتجر</h2>
      <div class="table-wrap"><table><thead><tr><th>المشتري</th><th>الأداة</th><th>المبلغ</th><th>التاريخ</th><th>الحالة</th></tr></thead><tbody>${storeRows || emptyRow(5, 'لا عمليات بعد')}</tbody></table></div></div>
    </div>`;
}
function finExport() {
  const rows = [
    ...db.teachers.map(t => ['اشتراك', t.name, 'معلم', t.subscriptionType === 'yearly' ? 'سنوي' : 'شهري', Number(t.subscriptionPrice) || 0, t.subscriptionEnd || '']),
    ...db.supervisors.map(s => ['اشتراك', s.name, 'مشرف', s.subscriptionType === 'yearly' ? 'سنوي' : 'شهري', Number(s.subscriptionPrice) || 0, s.subscriptionEnd || '']),
    ...db.teachers.flatMap(t => (t.courses || []).map(c => ['كورس — راتب', c.title + ' — ' + t.name, c.commission + '%', courseSalary(c), ''])),
    ...db.teachers.flatMap(t => (t.courses || []).map(c => courseDebt(c) > 0 ? ['كورس — دين', c.title + ' — ' + t.name, (100 - (Number(c.commission) || 0)) + '%', courseDebt(c), ''] : [])),
    ...db.settlements.map(x => ['تصفية', x.courseTitle + ' — ' + x.teacherName, '', x.amount, x.at]),
    ...db.purchases.filter(p => !p.trial).map(p => ['متجر', find('store', p.toolId)?.title || '—', p.buyerName, p.price, p.at])
  ];
  if (!rows.length) return toast('لا بيانات مالية لتصديرها.', 'error');
  exportCSV('التقارير-المالية', ['النوع', 'البيان', 'نسبة/تفصيل', 'المبلغ', 'التاريخ'], rows);
}

/* ===== أدواتي (المملوكة للطالب/المعلم) ===== */
function myToolsPage() {
  const kind = session.kind;
  const mine = db.purchases.filter(p => p.buyerKind === kind && p.buyerId === session.id);
  const today = date();
  const ok = mine.filter(p => p.status === 'approved');
  const active = ok.filter(p => p.trial ? (p.trialEnds || '') >= today : (p.ends || '') >= today);
  const expired = ok.filter(p => !(p.trial ? (p.trialEnds || '') >= today : (p.ends || '') >= today));
  const pending = mine.filter(p => p.status === 'pending');
  const rejected = mine.filter(p => p.status === 'rejected');
  const card = (p, isActive) => {
    const tool = find('store', p.toolId);
    if (!tool) return '';
    const ends = p.trial ? p.trialEnds : p.ends;
    const days = Math.ceil((new Date(ends + 'T23:59:59') - new Date()) / 864e5);
    return `<div class="store-card">
      <div class="store-ic">${esc(tool.icon || '🧰')}</div>
      <div class="store-info"><b>${esc(tool.title)}</b>${tool.description ? `<p>${esc(tool.description)}</p>` : ''}
        <div class="store-meta">${p.trial ? badge('تجربة مجانية', 'warning') : badge('اشتراك مدفوع', 'success')}${badge(isActive ? 'ينتهي: ' + ends + (days >= 0 ? ' (' + days + ' يوم)' : '') : 'انتهى: ' + ends, isActive ? 'info' : 'danger')}</div>
      </div>
      <div class="store-acts">${isActive ? `<button type="button" class="btn btn-success" data-action="store-open" data-id="${esc(tool.id)}">🚀 فتح الأداة</button>` : `<button type="button" class="btn btn-primary" data-action="goto-store">🛒 اشترِ من المتجر</button>`}</div>
    </div>`;
  };
  const activeCards = active.map(p => card(p, true)).join('');
  const expiredCards = expired.map(p => card(p, false)).join('');
  const pendingCards = pending.map(p => {
    const tool = find('store', p.toolId);
    if (!tool) return '';
    return `<div class="store-card">
      <div class="store-ic">${esc(tool.icon || '🧰')}</div>
      <div class="store-info"><b>${esc(tool.title)}</b>
        <div class="store-meta">${badge('طلب شراء — ' + money(p.price), 'info')}${badge('قيد مراجعة الأدمن', 'warning')}${badge('أُرسل: ' + p.at, 'neutral')}</div>
      </div>
      <div class="store-acts"><span class="store-pending">⏳ بانتظار موافقة مدير النظام</span></div>
    </div>`;
  }).join('');
  const rejectedCards = rejected.map(p => {
    const tool = find('store', p.toolId);
    if (!tool) return '';
    return `<div class="store-card">
      <div class="store-ic">${esc(tool.icon || '🧰')}</div>
      <div class="store-info"><b>${esc(tool.title)}</b>
        <div class="store-meta">${badge('طلب مرفوض', 'danger')}${p.rejectNote ? badge('السبب: ' + p.rejectNote, 'neutral') : ''}</div>
      </div>
      <div class="store-acts"><button type="button" class="btn btn-light" data-action="goto-store">🛒 إعادة الطلب من المتجر</button></div>
    </div>`;
  }).join('');
  return pageHead('أدواتي', 'أدواتك المتاحة — المشتراة المعتمدة والتجارب المجانية وطلباتك قيد المراجعة',
      actionBtn('🛒 المتجر', 'goto-store', '', 'btn btn-primary')) +
    statCards([
      { icon: '🧰', label: 'أدوات نشطة', value: active.length, trend: active.filter(p => p.trial).length + ' منها في تجربة', accent: '#dff7ed' },
      { icon: '⏳', label: 'طلبات قيد المراجعة', value: pending.length, trend: pending.length ? 'بانتظار موافقة الأدمن' : '', accent: '#fff3d4' },
      { icon: '↩️', label: 'طلبات مرفوضة', value: rejected.length, trend: rejected.length ? 'يمكن إعادة الإرسال من المتجر' : '', accent: '#fce4e8' },
      { icon: '📅', label: 'اشتراكات منتهية', value: expired.length, trend: expired.length ? 'يمكن التجديد من المتجر' : '', accent: '#e3edfd' }
    ]) +
    `<div class="store-grid" style="margin-top:16px">${activeCards || `<div class="panel"><p class="empty">لا أدوات نشطة لحسابك بعد — تصفح المتجر وجرّب أو أرسل طلب شراء.</p></div>`}</div>` +
    (pendingCards ? `<h2 style="margin:22px 0 12px;font-size:16px">⏳ طلبات قيد المراجعة</h2><div class="store-grid">${pendingCards}</div>` : '') +
    (expiredCards ? `<h2 style="margin:22px 0 12px;font-size:16px">📅 اشتراكات منتهية</h2><div class="store-grid">${expiredCards}</div>` : '') +
    (rejectedCards ? `<h2 style="margin:22px 0 12px;font-size:16px">↩️ طلبات مرفوضة</h2><div class="store-grid">${rejectedCards}</div>` : '');
}

/* ===== كورساتي (تفاصيل كاملة للمعلم) ===== */
function teacherCoursesPage() {
  const t = find('teachers', session.id);
  const list = t.courses || [];
  const rows = list.map(c => {
    const unsettled = Math.max(0, (Number(c.studentsCount) || 0) - (Number(c.settledStudents) || 0));
    return `<tr data-search="${esc(c.title)}">
      <td><b>${esc(c.title)}</b>${c.link ? `<div style="font-size:11px"><a href="${esc(c.link)}" target="_blank" rel="noopener" style="color:var(--primary)">↗ رابط الكورس</a></div>` : ''}</td>
      <td>${esc(money(c.price))}</td>
      <td>${badge((Number(c.commission) || 0) + '%', 'info')}</td>
      <td><b>${Number(c.studentsCount) || 0}</b>${c.settledStudents ? `<div style="font-size:11px;color:var(--muted)">مُصفّى منهم: ${c.settledStudents} — يُحتسب منهم: ${unsettled}</div>` : ''}</td>
      <td><b>${esc(money(courseSalary(c)))}</b><div style="font-size:11px;color:var(--muted)">لكل طالب: ${esc(money((Number(c.price) || 0) * (Number(c.commission) || 0) / 100))}</div></td>
      <td>${courseDebt(c) > 0 ? `<b style="color:var(--danger)">${esc(money(courseDebt(c)))}</b><div style="font-size:11px;color:var(--muted)">لكل طالب: ${esc(money((Number(c.price) || 0) * (100 - (Number(c.commission) || 0)) / 100))}</div>` : badge('مُصفّى بالكامل', 'success')}</td>
    </tr>`;
  }).join('');
  return pageHead('كورساتي', 'كل تفاصيل كورساتك — النشر والتعديل بيد مدير النظام، وأنت تتابع راتبك ودينك من هنا',
      actionBtn('💰 تقاريري المالية', 'goto-finreports', '', 'btn btn-light')) +
    teacherMoneyStats(session.id) +
    `<div class="panel" style="margin-top:16px"><h2>🎓 تفاصيل الكورسات</h2>
    <div class="notice">💡 <b>دورة المال:</b> الطالب يدفع سعر الكورس كاملاً — نصيبك = السعر × نسبتك لكل طالب، والباقي دين علىك للمنصة يُصفّاه مدير النظام دورياً. الطلاب المُصفّون يبقى عددهم محفوظاً ولا يُضاف دينهم مجدداً.</div>
    <div class="table-wrap"><table><thead><tr><th>الكورس</th><th>سعره</th><th>نسبتك</th><th>عدد الطلاب</th><th>راتبك</th><th>الدين</th></tr></thead><tbody>${rows || emptyRow(6, 'لا كورسات منشورة لك بعد')}</tbody></table></div></div>` +
    teacherSettlePanel(session.id);
}

/* ===== الإعدادات ===== */
function settingsPage() {
  if (session.kind === 'teacher') {
    const t = find('teachers', session.id);
    const accRows = (t.payAccounts || []).map(a => `<tr data-search="${esc(a.label + ' ' + a.number)}"><td><b>${esc(a.label)}</b></td><td><span dir="ltr">${esc(a.number)}</span></td><td>${esc(PROVIDERS[a.provider] || a.provider)}</td><td><div class="actions">${actionBtn('✏️', 'payacc-edit', a.id)}${actionBtn('🗑️', 'payacc-del', a.id)}</div></td></tr>`).join('');
    const days = subDays(t?.subscriptionEnd);
    return pageHead('الإعدادات', 'بياناتك وحسابات استلام الدفع وكلمة المرور') +
      `<div class="panel"><h2>👤 بياناتي</h2>
      <form id="tsettings-form"><div class="form-grid">
        ${field('username', 'اسم المستخدم للدخول (غير قابل للتعديل)', t?.username || '', 'text', false, 'disabled readonly dir="ltr" style="opacity:.65;cursor:not-allowed"')}
        ${field('name', 'الاسم الظاهر للطلاب', t?.name || '', 'text', true)}
        ${field('phone', 'رقم الهاتف', t?.phone || '', 'tel', false, 'dir="ltr"')}
        ${field('specialty', 'التخصص (المادة)', t?.specialty || '', 'text')}
        ${field('photo', 'رابط صورتي (تظهر أعلى نماذجي إن سمح الأدمن)', t?.photo || '', 'url', false, 'dir="ltr" placeholder="https://…"')}
      </div><div class="modal-foot"><button class="btn btn-primary">حفظ البيانات</button></div></form>
      <div class="meta-grid">
        <div class="meta-card"><small>الاشتراك</small><b>${t?.subscriptionType === 'yearly' ? 'سنوي' : 'شهري'} — ${esc(money(t?.subscriptionPrice))}</b></div>
        <div class="meta-card"><small>ينتهي في</small><b>${esc(t?.subscriptionEnd || 'مفتوح')}${days !== null ? ' (' + (days < 0 ? 'منتهي' : days + ' يوم') + ')' : ''}</b></div>
        <div class="meta-card"><small>نصيبك من الكورسات</small><b>${esc(money(teacherSalary(t)))}</b></div>
        <div class="meta-card"><small>المستحق عليك</small><b style="${teacherDebt(t) > 0 ? 'color:var(--danger)' : 'color:var(--success)'}">${esc(money(teacherDebt(t)))}</b></div>
      </div></div>
      <div class="panel" style="margin-top:16px"><h2>💳 حسابات استلام الدفع</h2>
      <div class="notice">هذه الأرقام تظهر للطلاب في نموذج الدفع — الضغط على أي رقم ينسخه تلقائياً. حسابات إنستا باي تفرض نوع التحويل «إنستا باي».</div>
      <div class="table-wrap" style="margin-bottom:12px"><table><thead><tr><th>الاسم</th><th>الرقم</th><th>النوع</th><th>إجراءات</th></tr></thead><tbody>${accRows || emptyRow(4, 'لا حسابات دفع — أضف رقماً ليتمكن الطلاب من الدفع')}</tbody></table></div>
      ${actionBtn('+ إضافة حساب', 'payacc-new', '', 'btn btn-primary')}</div>
      <div class="panel" style="margin-top:16px"><h2>🔑 تغيير كلمة المرور</h2>
      <form id="pw-form"><div class="form-grid">
        ${field('password', 'كلمة المرور الجديدة', '', 'password', true)}
        ${field('confirm', 'تأكيد كلمة المرور', '', 'password', true)}
      </div><div class="modal-foot"><button class="btn btn-primary">تغيير كلمة المرور</button></div></form></div>`;
  }
  if (session.kind === 'supervisor') {
    return pageHead('الإعدادات', 'بياناتك وكلمة المرور') +
      `<div class="panel"><h2>🔑 تغيير كلمة المرور</h2>
      <form id="pw-form"><div class="form-grid">
        ${field('password', 'كلمة المرور الجديدة', '', 'text', true)}
        ${field('confirm', 'تأكيد كلمة المرور', '', 'text', true)}
      </div><div class="modal-foot"><button class="btn btn-primary">تغيير كلمة المرور</button></div></form></div>`;
  }
  const gradeRows = db.settings.grades.map((g, i) => `<li><b>${esc(g)}</b>${actionBtn('🗑️', 'grade-del', String(i))}</li>`).join('');
  return pageHead('الإعدادات', 'إعدادات المنصة العامة') +
    `<div class="panel"><h2>🏫 إعدادات المنصة</h2>
    <form id="settings-form"><div class="form-grid">
      ${field('platformName', 'اسم المنصة', db.settings.platformName, 'text', true)}
      ${field('bannerImage', 'رابط صورة البانر (تظهر أعلى النماذج)', db.settings.bannerImage, 'url', false, 'dir="ltr" placeholder="https://…"')}
    </div><div class="modal-foot"><button class="btn btn-primary">حفظ الإعدادات</button></div></form></div>
    <div class="panel" style="margin-top:16px"><h2>📚 الصفوف الدراسية</h2>
    <div class="notice">الصفوف التي يختار منها الطالب في النماذج العامة.</div>
    <ul class="list">${gradeRows || '<p class="empty">لا صفوف بعد.</p>'}</ul>
    <div class="toolbar" style="margin-top:12px"><input id="new-grade" placeholder="اسم الصف الجديد…"><button type="button" class="btn btn-primary" data-action="grade-add">+ إضافة</button></div></div>
    <div class="panel" style="margin-top:16px"><h2>🎨 الهوية والألوان واللوجو</h2>
    <div class="notice">غيّر لوجو المنصة وألوانها — تُطبَّق فوراً على الهيدر والقائمة والأزرار وشاشة الدخول والنماذج العامة. اترك اللوجو فارغاً للعودة إلى الأيقونة الافتراضية 🎓.</div>
    <form id="brand-form"><div class="form-grid">
      ${field('logoLight', 'رابط اللوجو — الوضع النهاري', db.settings.logoLight || '', 'url', false, 'dir="ltr" placeholder="https://…/logo.png"')}
      ${field('logoDark', 'رابط اللوجو — الوضع الليلي (اختياري)', db.settings.logoDark || '', 'url', false, 'dir="ltr" placeholder="https://…/logo-dark.png"')}
      <div class="field"><label>اللون الأساسي (الأزرار والروابط)</label><input type="color" name="primary" value="${esc(db.settings.theme?.primary || '#1262FF')}"></div>
      <div class="field"><label>اللون الغامق (عند التمرير)</label><input type="color" name="primaryDark" value="${esc(db.settings.theme?.primaryDark || '#0d4fc9')}"></div>
      <div class="field"><label>لون القائمة الجانبية (الوضع النهاري)</label><input type="color" name="sidebar" value="${esc(db.settings.theme?.sidebar || '#1262FF')}"></div>
    </div><div class="modal-foot"><button type="button" class="btn btn-light" data-action="brand-reset">↺ استعادة الافتراضي</button><button class="btn btn-primary">حفظ الهوية</button></div></form></div>
    <div class="panel" style="margin-top:16px"><h2>🔗 روابط التواصل الاجتماعي (تظهر أسفل القائمة الجانبية)</h2>
    <form id="socials-form"><div class="form-grid">
      ${field('facebook', 'رابط صفحة فيسبوك', db.settings.socials?.facebook || '', 'url', false, 'dir="ltr" placeholder="https://facebook.com/…"')}
      ${field('youtube', 'رابط قناة يوتيوب', db.settings.socials?.youtube || '', 'url', false, 'dir="ltr" placeholder="https://youtube.com/@…"')}
      ${field('whatsapp', 'رقم واتساب (بصيغة دولية)', db.settings.socials?.whatsapp || '', 'text', false, 'dir="ltr" placeholder="201286085786"')}
      ${field('tiktok', 'رابط تيك توك', db.settings.socials?.tiktok || '', 'url', false, 'dir="ltr" placeholder="https://tiktok.com/@…"')}
      ${field('googleplay', 'رابط التطبيق على جوجل بلاي', db.settings.socials?.googleplay || '', 'url', false, 'dir="ltr" placeholder="https://play.google.com/…"')}
    </div><div class="modal-foot"><button class="btn btn-primary">حفظ الروابط</button></div></form></div>
    <div class="panel" style="margin-top:16px"><h2>👑 حساب مدير النظام</h2>
    <form id="admin-form"><div class="form-grid">
      ${field('name', 'الاسم', db.users[0]?.name || '', 'text', true)}
      ${field('username', 'اسم المستخدم', db.users[0]?.username || '', 'text', true)}
      ${field('password', 'كلمة المرور', db.users[0]?.password || '', 'text', true)}
    </div><div class="modal-foot"><button class="btn btn-primary">حفظ الحساب</button></div></form></div>
    <div class="panel" style="margin-top:16px"><h2>💾 النسخ الاحتياطي</h2>
    <div class="notice">كل البيانات محفوظة محلياً في هذا المتصفح — نزّل نسخة احتياطية بانتظام.</div>
    <div class="actions">
      <button type="button" class="btn btn-light" data-action="backup">⬇️ تنزيل نسخة احتياطية</button>
      <label class="btn btn-light" style="display:inline-flex;align-items:center;cursor:pointer">⬆️ استعادة نسخة<input type="file" id="restore-file" accept=".json" hidden></label>
      <button type="button" class="btn btn-danger" data-action="reset">⚠️ تصفير النظام</button>
    </div></div>`;
}

/* ===== النماذج العامة (بدون دخول) ===== */
function publicFormId() { const m = location.hash.match(/^#\/form\/([A-Za-z0-9_-]+)$/); return m ? m[1] : null; }
function publicToolId() { const m = location.hash.match(/^#\/tool\/([A-Za-z0-9_-]+)$/); return m ? m[1] : null; }
function toolAccess(toolId, buyerKind, buyerId) {
  const today = date();
  const list = db.purchases.filter(p => p.toolId === toolId && p.buyerKind === buyerKind && p.buyerId === buyerId);
  const paid = list.find(p => !p.trial && p.status === 'approved' && (p.ends || '') >= today);
  const trial = list.find(p => p.trial && (p.trialEnds || '') >= today);
  return { paid, trial, usedTrial: list.some(p => p.trial), hasAccess: !!(paid || trial),
    pending: list.some(p => p.status === 'pending'),
    rejected: list.filter(p => p.status === 'rejected').slice(-1)[0] || null };
}
function enabledDefs(form) { return (form.defs && form.defs.length ? form.defs : defaultDefs(form.type)).filter(x => x.enabled !== false); }
function pubErrorPage(msg) {
  $('#app').innerHTML = `<div class="pub-wrap"><div class="pub-error-page">
    <div class="pub-sad">😔</div><h1>تعذر فتح النموذج</h1><p>${esc(msg)}</p>
  </div></div>`;
}
function pubGate(form, t) {
  returnHash = location.hash;
  loginRole = 'student';
  const banner = db.settings.bannerImage;
  const showP = t.pubShow || { photo: true, name: true, specialty: true, link: true };
  const heroImg = showP.photo && t.photo ? t.photo : banner;
  const teacherLine = showP.name ? `👨‍🏫 ${esc(t.name)}${showP.specialty && t.specialty ? ' — ' + esc(t.specialty) : ''}` : (showP.specialty && t.specialty ? esc(t.specialty) : '');
  const gradeOpts = [['', 'اختر الصف الدراسي…'], ...db.settings.grades.map(g => [g, g])];
  const stuModes = [['login', '🚪 دخول بحساب'], ['register', '➕ حساب جديد']].map(([k, l]) => `<button type="button" class="chip ${studentMode === k ? 'active' : ''}" data-action="stu-mode" data-id="${k}">${l}</button>`).join('');
  const authBody = studentMode === 'register' ? `
      <div class="form-grid">
        ${field('name', 'الاسم (ثلاثي بالعربية)', '', 'text', true, 'placeholder="مثال: أحمد محمد علي"')}
        ${field('username', 'اسم المستخدم', '', 'text', true, 'autocomplete="username"')}
        ${field('password', 'كلمة المرور', '', 'password', true, 'autocomplete="new-password"')}
        ${field('confirm', 'تأكيد كلمة المرور', '', 'password', true, 'autocomplete="new-password"')}
        ${field('phone', 'رقم الهاتف (اختياري)', '', 'tel', false, 'dir="ltr"')}
        ${selectField('grade', 'الصف الدراسي', '', gradeOpts, true)}
      </div>
      ` : `
      <div class="field"><label>اسم المستخدم</label><input name="username" autocomplete="username" required></div>
      <div class="field" style="margin-top:12px"><label>كلمة المرور</label><input name="password" type="password" autocomplete="current-password" required></div>
      `;
  $('#app').innerHTML = `${themeSwitchHTML('pub-dark-toggle')}<div class="pub-wrap"><div class="pub-card">
    <div class="pub-hero">${heroImg ? `<img src="${esc(heroImg)}" alt="" loading="eager">` : ''}<div class="pub-hero-grad"></div><span class="pub-badge">${form.type === 'payment' ? '💳' : '💡'} ${esc(form.title || '')}</span>${teacherLine ? `<div class="pub-teacher">${teacherLine}</div>` : ''}</div>
    <div class="pub-body">
      <h1>🔐 الدخول مطلوب قبل التعبئة</h1>
      <p class="pub-sub">لكل طالب <b>حساب واحد</b> يتابع منه كل رسائله وردودها — سجّل دخولك مرة واحدة وستُربط رسالتك بحسابك <b>تلقائياً</b> بعد الإرسال.</p>
      <div class="stu-modes">${stuModes}</div>
      <form id="login-form">
        ${authBody}
        <button class="btn btn-primary" style="width:100%;margin-top:18px">${studentMode === 'register' ? 'إنشاء الحساب والمتابعة للنموذج' : 'دخول ومتابعة للنموذج'}</button>
        <div id="login-alert" class="login-alert" role="alert"></div>
      </form>
    </div>
    <div class="pub-foot">${esc(db.settings.platformName)}</div>
  </div></div>`;
  $('#login-form').addEventListener('submit', submitLogin);
}
function renderPublicForm() {
  const id = publicFormId();
  const form = id ? find('forms', id) : null;
  document.body.classList.toggle('dark', !!db.settings.dark);
  $('#modal-root').innerHTML = '';
  if (!form) return pubErrorPage('هذا الرابط لا يفتح نموذجاً موجوداً — تأكد من صحة الرابط.');
  if (!form.active) return pubErrorPage('هذا النموذج متوقف حالياً — تواصل مع ' + teacherName(form.teacherId) + '.');
  const t = find('teachers', form.teacherId);
  if (!t || (t.subscriptionEnd && subDays(t.subscriptionEnd) < 0)) return pubErrorPage('اشتراك هذا المعلم منتهٍ حالياً — تعذر استقبال الرسائل، تواصل مع إدارة المنصة.');
  if (!(session?.kind === 'student' && session.id)) return pubGate(form, t);
  const needsAccounts = enabledDefs(form).some(d => d.key === 'target');
  if (form.type === 'payment' && needsAccounts && !(t.payAccounts || []).length) return pubErrorPage('لم يضف المعلم حسابات دفع بعد — تواصل معه مباشرة.');
  pubState = { form, target: '', provider: '', targetLabel: '', transferType: '', image: null, lastCode: '' };
  const stu = session?.kind === 'student' && session.id ? find('students', session.id) : null;
  const banner = db.settings.bannerImage;
  const showP = t.pubShow || { photo: true, name: true, specialty: true, link: true };
  const gradeOpts = [`<option value="" disabled selected>اختر الصف الدراسي</option>`, ...db.settings.grades.map(g => `<option value="${esc(g)}">${esc(g)}</option>`)].join('');
  const savedName = stu?.name || localStorage.getItem('pub-name') || '';
  const savedGrade = stu?.grade || localStorage.getItem('pub-grade') || '';
  pubState.savedName = savedName;
  pubState.gradeOpts = gradeOpts;
  const badgeTxt = form.type === 'payment' ? '💳 ' + (form.title || 'تأكيد الدفع') : '💡 ' + (form.title || 'الدعم العلمي');
  const routed = form.route === 'supervisor' && form.supervisorId ? supervisorName(form.supervisorId) : '';
  const defaultDesc = form.type === 'payment'
    ? 'يرجى إكمال بيانات التحويل التالية — تصل رسالتك للمعلم مباشرة'
    : 'أرسل سؤالك و' + (routed ? 'سيصلك رد ' + routed : 'سيتم الرد عليك') + ' في أقرب وقت';
  const renderDef = d => {
    const reqTag = d.required ? '<span class="req">مطلوب</span>' : (d.hint ? `<span class="opt">(${esc(d.hint)})</span>` : '');
    const errTag = `<p class="pub-err" data-err="${d.key === 'transferType' ? 'type' : esc(d.key)}"></p>`;
    const label = `<label>${esc(d.label || '')} ${reqTag}</label>`;
    switch (d.key) {
      case 'name': return `<div class="pub-field">${label}<input id="pf-name" class="pub-input" value="${esc(savedName)}" placeholder="${esc(d.placeholder || 'مثال: أحمد محمد علي')}" autocomplete="off">${errTag}</div>`;
      case 'grade': return `<div class="pub-field">${label}<select id="pf-grade" class="pub-input">${gradeOpts}</select>${errTag}</div>`;
      case 'amount': return `<div class="pub-field">${label}<div class="pub-amount"><span class="pub-cur">ج.م</span><input id="pf-amount" class="pub-input" inputmode="decimal" placeholder="${esc(d.placeholder || 'أدخل المبلغ المرسل')}" autocomplete="off"></div>${errTag}</div>`;
      case 'target': {
        const numbers = (t.payAccounts || []).map(a => `
          <div class="pub-num" data-value="${esc(a.number)}" data-provider="${esc(a.provider)}" data-label="${esc(a.label)}">
            <span class="cp">⧉</span>
            <span class="ic ${a.provider === 'instapay' ? 'ip' : 'vf'}">${PROVIDER_ICON[a.provider] || '💳'}</span>
            <span class="num">${esc(a.number)}</span>
            <span class="tag">${esc(a.label)}</span>
          </div>`).join('');
        return `<div class="pub-field">${label}<div class="pub-numbers">${numbers}</div>${errTag}</div>`;
      }
      case 'transferType': return `<div class="pub-field">${label}
          <div class="pub-types">
            <div class="pub-type" data-value="wallet"><span class="ic">👛</span><span class="label">محفظة إلكترونية</span><span class="unavailable" hidden>غير متاح</span></div>
            <div class="pub-type" data-value="instapay"><span class="ic">🏦</span><span class="label">إنستا باي</span></div>
          </div>${errTag}</div>`;
      case 'sender': return `<div class="pub-field" id="pf-sender-field" hidden>${label}<input id="pf-sender" class="pub-input" inputmode="numeric" maxlength="11" placeholder="${esc(d.placeholder || 'أدخل 11 رقم')}" autocomplete="off">${errTag}</div>`;
      case 'transaction': return `<div class="pub-field" id="pf-transaction-field" hidden>${label}<input id="pf-transaction" class="pub-input" inputmode="numeric" placeholder="${esc(d.placeholder || 'أدخل رقم العملية')}" autocomplete="off">${errTag}</div>`;
      case 'account': return `<div class="pub-field" id="pf-account-field" hidden>${label}<input id="pf-account" class="pub-input" inputmode="numeric" placeholder="${esc(d.placeholder || 'أدخل رقم الحساب')}" autocomplete="off">${errTag}</div>`;
      case 'image': return `<div class="pub-attach ${d.required ? 'required' : ''}">
          ${label}
          <button type="button" class="pub-attach-btn" data-action="pub-attach">📷 إرفاق الصورة</button>
          <input type="file" id="pf-file" accept="image/*" hidden>
          <div class="pub-preview" id="pf-preview" hidden><img id="pf-preview-img" src="" alt="معاينة"><div class="fi"><div class="fn" id="pf-fname"></div><div class="fs" id="pf-fsize"></div></div><button type="button" class="rm" data-action="pub-remove-image">✕</button></div>
          <div class="pub-hint">ℹ️ ${esc(d.hint || 'تُرسل الصورة مع الرسالة تلقائياً')}</div>
          ${errTag}</div>`;
      case 'notes': return `<div class="pub-field">${label}<textarea id="pf-notes" class="pub-input" maxlength="300" rows="2" placeholder="${esc(d.placeholder || 'اكتب أي ملاحظات إضافية')}"></textarea><div class="pub-count"><span id="pf-notes-count">0</span>/300</div></div>`;
      case 'question': return `<div class="pub-field">${label}<textarea id="pf-question" class="pub-input" maxlength="1000" rows="4" placeholder="${esc(d.placeholder || 'اكتب سؤالك هنا بالتفصيل…')}"></textarea><div class="pub-count"><span id="pf-question-count">0</span>/1000</div>${errTag}</div>`;
      default: {
        const fid = 'pf-cf-' + d.key.slice(3);
        if (d.type === 'select') {
          const opts = [d.required ? `<option value="" disabled selected>اختر…</option>` : `<option value="" selected>— بدون —</option>`, ...(d.options || []).map(o => `<option value="${esc(o)}">${esc(o)}</option>`)].join('');
          return `<div class="pub-field">${label}<select id="${fid}" class="pub-input">${opts}</select>${errTag}</div>`;
        }
        if (d.type === 'textarea') return `<div class="pub-field">${label}<textarea id="${fid}" class="pub-input" rows="2" maxlength="500" placeholder="${esc(d.placeholder || 'اكتب هنا…')}"></textarea>${errTag}</div>`;
        if (d.type === 'date') return `<div class="pub-field">${label}<input id="${fid}" type="date" class="pub-input">${errTag}</div>`;
        return `<div class="pub-field">${label}<input id="${fid}" class="pub-input" ${d.type === 'number' ? 'inputmode="numeric"' : ''} placeholder="${esc(d.placeholder || 'اكتب هنا…')}">${errTag}</div>`;
      }
    }
  };
  const defs = enabledDefs(form);
  let body = '';
  for (let i = 0; i < defs.length; i++) {
    if (defs[i].key === 'grade' && defs[i + 1]?.key === 'amount') {
      body += `<div class="pub-grid2">${renderDef(defs[i])}${renderDef(defs[i + 1])}</div>`;
      i++;
      continue;
    }
    body += renderDef(defs[i]);
  }
  body += `<button type="button" class="pub-submit" data-action="pub-submit">${form.type === 'payment' ? '✅' : '📤'} ${esc(form.title || (form.type === 'payment' ? 'تأكيد الدفع' : 'إرسال السؤال'))}</button>`;
  const heroImg = showP.photo && t.photo ? t.photo : banner;
  const teacherLine = showP.name ? `👨‍🏫 ${esc(t.name)}${showP.specialty && t.specialty ? ' — ' + esc(t.specialty) : ''}` : (showP.specialty && t.specialty ? esc(t.specialty) : '');
  const darkToggle = themeSwitchHTML('pub-dark-toggle');
  $('#app').innerHTML = `${darkToggle}<div class="pub-wrap"><div class="pub-card">
    <div class="pub-hero">${heroImg ? `<img src="${esc(heroImg)}" alt="" loading="eager">` : ''}<div class="pub-hero-grad"></div><span class="pub-badge">${badgeTxt}</span>${teacherLine ? `<div class="pub-teacher">${teacherLine}</div>` : ''}</div>
    <div class="pub-body">
      <h1>${esc(form.title || (form.type === 'payment' ? 'تأكيد الدفع' : 'الدعم العلمي'))}</h1>
      <p class="pub-sub">${esc(form.desc || defaultDesc)}</p>
      ${showP.link && t.platformLink ? `<a class="pub-link" href="${esc(t.platformLink)}" target="_blank" rel="noopener">📥 تحميل منصة المعلم</a>` : ''}
      ${body}
    </div>
    <div class="pub-foot">${esc(db.settings.platformName)}</div>
  </div></div>`;
  bindPublicForm();
  if (savedGrade && $('#pf-grade')) $('#pf-grade').value = savedGrade;
}
function pubErr(key, msg) {
  const el = document.querySelector(`.pub-err[data-err="${key}"]`);
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('show', !!msg);
}
function clearPubErrs() { $$('.pub-err').forEach(e => { e.textContent = ''; e.classList.remove('show'); }); }
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1280;
      let { width: w, height: h } = img;
      if (w > max || h > max) { const r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r); }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}
function fmtSize(bytes) { return bytes > 1048576 ? (bytes / 1048576).toFixed(2) + ' MB' : (bytes / 1024).toFixed(1) + ' KB'; }
function bindPublicForm() {
  const isPay = pubState.form.type === 'payment';
  $('#pf-name')?.addEventListener('input', () => pubErr('name'));
  $('#pf-grade')?.addEventListener('change', () => pubErr('grade'));
  if (isPay) {
    $('#pf-amount')?.addEventListener('input', e => { e.target.value = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'); pubErr('amount'); });
    $('#pf-sender')?.addEventListener('input', e => { e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 11); pubErr('sender'); });
    $$('.pub-num').forEach(card => card.addEventListener('click', () => {
      $$('.pub-num').forEach(c => c.classList.remove('active', 'copied'));
      card.classList.add('active');
      pubState.target = card.dataset.value;
      pubState.provider = card.dataset.provider;
      pubState.targetLabel = card.dataset.label;
      pubErr('target');
      applyProviderRules();
      copyText(pubState.target).then(ok => { if (ok) { card.classList.add('copied'); setTimeout(() => card.classList.remove('copied'), 2500); toast('تم نسخ الرقم: ' + pubState.target); } });
    }));
    $$('.pub-type').forEach(card => card.addEventListener('click', () => {
      if (card.classList.contains('disabled')) return;
      $$('.pub-type').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      pubState.transferType = card.dataset.value;
      pubErr('type');
      updateTransferFields();
    }));
  }
  const notesEl = $('#pf-notes');
  notesEl?.addEventListener('input', () => { $('#pf-notes-count').textContent = notesEl.value.length; });
  const qEl = $('#pf-question');
  qEl?.addEventListener('input', () => { $('#pf-question-count').textContent = qEl.value.length; pubErr('question'); });
  $$('[id^="pf-cf-"]').forEach(el => {
    const key = el.id.replace('pf-cf-', '');
    el.addEventListener('input', () => pubErr(key));
    el.addEventListener('change', () => pubErr(key));
  });
  $('#pf-file')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('يرجى اختيار ملف صورة فقط.', 'error'); e.target.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { toast('حجم الصورة كبير جداً (الحد الأقصى 5 ميجابايت).', 'error'); e.target.value = ''; return; }
    try {
      const dataURL = await compressImage(file);
      pubState.image = { dataURL, name: file.name };
      $('#pf-preview-img').src = dataURL;
      $('#pf-fname').textContent = file.name;
      $('#pf-fsize').textContent = fmtSize(file.size);
      $('#pf-preview').hidden = false;
      $('.pub-attach-btn').style.display = 'none';
      pubErr('image');
      toast('تم إرفاق الصورة بنجاح.');
    } catch { toast('تعذر قراءة الصورة — جرّب صورة أخرى.', 'error'); }
  });
}
function applyProviderRules() {
  const wallet = $('.pub-type[data-value="wallet"]');
  const instapay = $('.pub-type[data-value="instapay"]');
  if (!wallet || !instapay) return;
  if (pubState.provider === 'instapay' || pubState.provider === 'bank') {
    wallet.classList.add('disabled');
    wallet.querySelector('.unavailable').hidden = false;
    $$('.pub-type').forEach(c => c.classList.remove('active'));
    instapay.classList.add('active');
    pubState.transferType = 'instapay';
    updateTransferFields();
  } else {
    wallet.classList.remove('disabled');
    wallet.querySelector('.unavailable').hidden = true;
  }
}
function updateTransferFields() {
  const sf = $('#pf-sender-field'), tf = $('#pf-transaction-field'), af = $('#pf-account-field');
  if (sf) sf.hidden = !pubState.transferType;
  if (tf) tf.hidden = pubState.transferType !== 'wallet';
  if (af) af.hidden = pubState.transferType !== 'instapay';
  if (pubState.transferType !== 'wallet') { const x = $('#pf-transaction'); if (x) x.value = ''; }
  if (pubState.transferType !== 'instapay') { const x = $('#pf-account'); if (x) x.value = ''; }
}
function submitPublic() {
  const form = pubState.form;
  const defs = enabledDefs(form);
  clearPubErrs();
  const activeNum = document.querySelector('.pub-num.active');
  if (activeNum) { pubState.target = activeNum.dataset.value; pubState.provider = activeNum.dataset.provider; pubState.targetLabel = activeNum.dataset.label; }
  const activeType = document.querySelector('.pub-type.active');
  if (activeType) pubState.transferType = activeType.dataset.value;
  const imgSrc = $('#pf-preview-img')?.getAttribute('src') || '';
  pubState.image = imgSrc.startsWith('data:') ? { dataURL: imgSrc, name: $('#pf-fname')?.textContent || '' } : null;
  const data = { notes: '', custom: {}, customLabels: {} };
  let name = '', grade = '', firstErr = '';
  const fail = (key, msg) => { pubErr(key, msg); if (!firstErr) firstErr = msg; };
  for (const d of defs) {
    if (d.key === 'transaction' || d.key === 'account') continue; // تُجمع لاحقاً حسب نوع التحويل
    if (d.key === 'name') {
      name = $('#pf-name')?.value.trim() || '';
      const nv = validateStudentName(name);
      if (!nv.valid) fail('name', nv.message);
    } else if (d.key === 'grade') {
      grade = $('#pf-grade')?.value || '';
      if (!grade) fail('grade', 'يرجى اختيار الصف الدراسي');
    } else if (d.key === 'amount') {
      const v = $('#pf-amount')?.value.trim() || '';
      if (!v || !(parseFloat(v) > 0)) fail('amount', 'يرجى إدخال المبلغ المرسل');
      data.amount = v;
    } else if (d.key === 'target') {
      if (!pubState.target) fail('target', 'يرجى اختيار الرقم الذي تم التحويل عليه');
      data.targetNumber = pubState.target; data.targetLabel = pubState.targetLabel;
    } else if (d.key === 'transferType') {
      if (!pubState.transferType) fail('type', 'يرجى اختيار نوع التحويل');
      data.transferType = pubState.transferType;
    } else if (d.key === 'sender') {
      const v = $('#pf-sender')?.value.trim() || '';
      if (!/^[0-9]{11}$/.test(v)) fail('sender', 'يرجى إدخال 11 رقم بالضبط للرقم المحوّل منه');
      data.senderPhone = v;
    } else if (d.key === 'image') {
      if (d.required && !pubState.image) fail('image', 'يرجى إرفاق الصورة أولاً');
    } else if (d.key === 'notes') {
      data.notes = $('#pf-notes')?.value.trim() || '';
    } else if (d.key === 'question') {
      const v = $('#pf-question')?.value.trim() || '';
      if (!v) fail('question', 'يرجى كتابة نص السؤال');
      data.question = v;
    } else if (d.key.startsWith('cf-')) {
      const el = $('#pf-cf-' + d.key.slice(3));
      const v = String(el?.value || '').trim();
      if (d.required && !v) fail(d.key, 'هذا الحقل مطلوب');
      data.custom[d.key] = v;
      data.customLabels[d.key] = d.label;
    }
  }
  if (firstErr) { toast(firstErr, 'error'); return; }
  const tf = $('#pf-transaction-field'), af = $('#pf-account-field');
  if (tf && !tf.hidden) data.transactionNumber = $('#pf-transaction')?.value.trim() || '';
  if (af && !af.hidden) data.accountNumber = $('#pf-account')?.value.trim() || '';
  if ((pubState.provider === 'instapay' || pubState.provider === 'bank') && pubState.transferType === 'wallet') { toast('الدفع بالمحفظة الإلكترونية غير متاح لهذا الرقم.', 'error'); return; }
  let studentCode = '';
  do { studentCode = String(Math.floor(100000 + Math.random() * 900000)); } while (db.submissions.some(s => s.studentCode === studentCode));
  const attached = !!(session?.kind === 'student' && session.id);
  const sub = {
    id: 'sub-' + uid(), formId: form.id, formType: form.type, teacherId: form.teacherId,
    supervisorId: form.type === 'support' && form.route === 'supervisor' ? form.supervisorId : '',
    name, grade, createdAt: dateTime(), status: 'new', reply: '', studentCode, studentId: attached ? session.id : '',
    image: pubState.image ? pubState.image.dataURL : '', imageName: pubState.image?.name || '',
    data
  };
  db.submissions.unshift(sub);
  logAct(name, form.type === 'payment' ? `أرسل تأكيد دفع بمبلغ ${money(data.amount)} عبر «${form.title}»` : `أرسل سؤال دعم عبر «${form.title}»`);
  if (!save()) {
    db.submissions.shift(); db.activity.shift();
    return toast('تعذر الإرسال — مساحة التخزين ممتلئة. جرّب صورة أصغر.', 'error');
  }
  try { localStorage.setItem('pub-name', name); localStorage.setItem('pub-grade', grade); } catch {}
  pubState.lastCode = studentCode;
  showPubSuccess(form.type, attached ? '' : studentCode, attached);
  resetPubForm();
}
function showPubSuccess(type, code, attached) {
  const overlay = document.createElement('div');
  overlay.className = 'pub-ok';
  overlay.innerHTML = `<div class="pub-ok-card"><div class="pub-ok-ic">✅</div><h3>تم الإرسال بنجاح</h3>
    ${attached ? `<p>✅ أُضيفت الرسالة إلى حسابك في بوابة الطالب — تابع رد المعلم عليها هناك.</p><button type="button" class="portal" data-action="pub-ok-portal">🎒 إلى رسائلي</button>` : code ? `<p>احفظ <b>رمز المتابعة</b> الخاص بك — به تدخل بوابة الطالب لمشاهدة رد المعلم على رسالتك:</p><div class="pub-ok-code" dir="ltr">${esc(code)}</div><button type="button" class="copy" data-action="pub-ok-copy">📋 نسخ الرمز</button>` : ''}
    <p>${type === 'payment' ? 'تم استلام تأكيد الدفع وسيراجعه المعلم الآن من لوحته.' : 'تم استلام سؤالك وسيتم الرد عليك في أقرب وقت.'}</p>
    <button type="button" data-action="pub-ok-close">حسناً</button>
    ${code ? `<button type="button" class="portal" data-action="pub-ok-portal">🎒 دخول بوابة الطالب</button>` : ''}</div>`;
  document.body.append(overlay);
}
function resetPubForm() {
  const notes = $('#pf-notes'); if (notes) notes.value = '';
  const nc = $('#pf-notes-count'); if (nc) nc.textContent = '0';
  const q = $('#pf-question'); if (q) { q.value = ''; const qc = $('#pf-question-count'); if (qc) qc.textContent = '0'; }
  pubState.image = null; pubState.target = ''; pubState.provider = ''; pubState.targetLabel = ''; pubState.transferType = '';
  const file = $('#pf-file'); if (file) file.value = '';
  const preview = $('#pf-preview'); if (preview) preview.hidden = true;
  $('#pf-preview-img')?.removeAttribute('src');
  const btn = $('.pub-attach-btn'); if (btn) btn.style.display = '';
  $$('[id^="pf-cf-"]').forEach(el => { el.value = ''; });
  if (pubState.form.type === 'payment') {
    const amount = $('#pf-amount'); if (amount) amount.value = '';
    const sender = $('#pf-sender'); if (sender) sender.value = '';
    const tr = $('#pf-transaction'); if (tr) tr.value = '';
    const acc = $('#pf-account'); if (acc) acc.value = '';
    $$('.pub-num').forEach(c => c.classList.remove('active', 'copied'));
    $$('.pub-type').forEach(c => c.classList.remove('active'));
    applyProviderRules();
    updateTransferFields();
  }
  clearPubErrs();
}

/* ===== العرض والربط ===== */
function renderPage() {
  if (page === 'dashboard') return dashboard();
  if (page === 'teachers' && session.kind === 'admin') return peoplePage('teachers');
  if (page === 'supervisors' && session.kind === 'admin') return peoplePage('supervisors');
  if (page === 'forms') return formsPage();
  if (page === 'mysupervisors' && session.kind === 'teacher') return mySupervisorsPage();
  if (page === 'payments' && session.kind === 'teacher') return paymentsPage();
  if (page === 'support' && (session.kind === 'teacher' || session.kind === 'supervisor')) return supportPage();
  if (page === 'messages' && session.kind === 'admin') return messagesPage();
  if (page === 'reports' && (session.kind === 'admin' || session.kind === 'teacher' || session.kind === 'supervisor')) return reportsPage();
  if (page === 'mycode' && session.kind === 'student') return myCodePage();
  if (page === 'courses' && session.kind === 'admin') return coursesPage();
  if (page === 'mycourses' && session.kind === 'teacher') return teacherCoursesPage();
  if (page === 'store' && (session.kind === 'admin' || session.kind === 'teacher' || session.kind === 'student')) return session.kind === 'admin' ? storePageAdmin() : storePageBuyer();
  if (page === 'mytools' && (session.kind === 'teacher' || session.kind === 'student')) return myToolsPage();
  if (page === 'reports' && (session.kind === 'admin' || session.kind === 'teacher' || session.kind === 'supervisor')) return reportsPage();
  if (page === 'finreports' && (session.kind === 'admin' || session.kind === 'teacher')) return finReportsPage();
  if (page === 'settings' && session.kind === 'student') return studentSettingsPage();
  if (page === 'accounts' && session.kind === 'admin') return accountsPage();
  if (page === 'settings') return settingsPage();
  return dashboard();
}
function render() {
  applyTheme();
  menuOpen = false;
  if (publicFormId()) { renderPublicForm(); return; }
  if (publicToolId()) { renderToolPage(publicToolId()); return; }
  if (!session) { renderLogin(); return; }
  const kick = msg => { setSession(null); renderLogin(msg); };
  if (session.kind === 'admin' && !find('users', session.id)) return kick('الحساب لم يعد موجوداً.');
  if (session.kind === 'student') {
    if (session.id) {
      if (!find('students', session.id)) return kick('الحساب لم يعد موجوداً.');
    } else if (!db.submissions.some(s => s.studentCode === session.code)) {
      return kick('لا توجد رسائل مرتبطة بهذا الرمز — ادخل من جديد.');
    }
  }
  if (session.kind === 'teacher') {
    const t = find('teachers', session.id);
    if (!t) return kick('الحساب لم يعد موجوداً — راجع مدير النظام.');
    if (t.subscriptionEnd && subDays(t.subscriptionEnd) < 0) return kick('انتهت فترة اشتراكك — راجع مدير النظام للتجديد.');
  }
  if (session.kind === 'supervisor') {
    const s = find('supervisors', session.id);
    if (!s) return kick('الحساب لم يعد موجوداً — راجع مدير النظام.');
    if (s.subscriptionEnd && subDays(s.subscriptionEnd) < 0) return kick('انتهت فترة اشتراكك — راجع مدير النظام للتجديد.');
  }
  const allowed = roleNav().map(n => n[0]);
  if (!allowed.includes(page)) page = 'dashboard';
  document.body.classList.toggle('dark', !!db.settings.dark);
  $('#app').innerHTML = layout(renderPage());
  bindDynamic();
}
function bindDynamic() {
  const on = (q, ev, fn) => { const el = $(q); if (el) el.addEventListener(ev, fn); };
  on('#brand-form', 'submit', e => {
    e.preventDefault();
    const data = new FormData(e.target);
    db.settings.logoLight = String(data.get('logoLight') || '').trim();
    db.settings.logoDark = String(data.get('logoDark') || '').trim();
    db.settings.theme = {
      primary: String(data.get('primary') || '').trim(),
      primaryDark: String(data.get('primaryDark') || '').trim(),
      sidebar: String(data.get('sidebar') || '').trim()
    };
    if (!save()) return toast('تعذر الحفظ — مساحة التخزين ممتلئة.', 'error');
    logAct(sessionLabel(), 'عدّل هوية المنصة (اللوجو والألوان)');
    applyTheme(); render(); toast('تم حفظ الهوية — طُبِّقت الألوان واللوجو.');
  });
  on('#socials-form', 'submit', e => {
    e.preventDefault();
    const data = new FormData(e.target);
    db.settings.socials = {
      facebook: String(data.get('facebook') || '').trim(),
      youtube: String(data.get('youtube') || '').trim(),
      whatsapp: String(data.get('whatsapp') || '').trim().replace(/[^0-9]/g, ''),
      tiktok: String(data.get('tiktok') || '').trim(),
      googleplay: String(data.get('googleplay') || '').trim()
    };
    if (!save()) return toast('تعذر الحفظ — مساحة التخزين ممتلئة.', 'error');
    logAct(sessionLabel(), 'حدّث روابط التواصل الاجتماعي');
    render(); toast('تم حفظ روابط التواصل — تظهر الآن في القائمة الجانبية.');
  });
  on('[data-filter="table"]', 'input', filterTable);
  on('[data-sub-status]', 'change', e => { filters.payStatus = filters.supStatus = e.target.value; render(); });
  on('[data-course-teacher]', 'change', e => { filters.courseTeacher = e.target.value; render(); });
  on('[data-msg-type]', 'change', e => { filters.msgType = e.target.value; render(); });
  on('[data-msg-status]', 'change', e => { filters.msgStatus = e.target.value; render(); });
  on('#settings-form', 'submit', e => {
    e.preventDefault();
    const data = new FormData(e.target);
    db.settings.platformName = String(data.get('platformName') || '').trim() || 'منصتي التعليمية';
    db.settings.bannerImage = String(data.get('bannerImage') || '').trim();
    logAct(sessionLabel(), 'عدّل إعدادات المنصة');
    save(); render(); toast('تم حفظ إعدادات المنصة.');
  });
  on('#admin-form', 'submit', e => {
    e.preventDefault();
    const data = new FormData(e.target);
    const u = db.users[0]; if (!u) return;
    const username = String(data.get('username') || '').trim();
    const password = String(data.get('password') || '').trim();
    if (!username || !password) return toast('اسم المستخدم وكلمة المرور مطلوبان.', 'error');
    const dup = checkUniqueCredentials(username, '', { coll: 'users', id: u.id });
    if (dup) return toast(dup, 'error');
    u.name = String(data.get('name') || '').trim() || u.name;
    u.username = username; u.password = password;
    logAct(sessionLabel(), 'عدّل حساب مدير النظام');
    save(); render(); toast('تم حفظ حساب مدير النظام.');
  });
  on('#pw-form', 'submit', e => {
    e.preventDefault();
    const data = new FormData(e.target);
    const pw = String(data.get('password') || '').trim();
    const cf = String(data.get('confirm') || '').trim();
    if (!pw) return toast('أدخل كلمة المرور الجديدة.', 'error');
    if (pw !== cf) return toast('كلمتا المرور غير متطابقتين.', 'error');
    if (session.kind === 'teacher') {
      const t = find('teachers', session.id);
      if (t) t.password = pw;
    } else if (session.kind === 'supervisor') {
      const s = find('supervisors', session.id);
      if (s) s.password = pw;
    } else if (session.kind === 'student' && session.id) {
      const st = find('students', session.id);
      if (st) st.password = pw;
    }
    logAct(sessionLabel(), 'غيّر كلمة المرور');
    save(); render(); toast('تم تغيير كلمة المرور.');
  });
  on('#tsettings-form', 'submit', e => {
    e.preventDefault();
    const data = new FormData(e.target);
    const t = find('teachers', session.id);
    if (!t) return;
    const name = String(data.get('name') || '').trim();
    if (!name) return toast('الاسم مطلوب.', 'error');
    t.name = name;
    t.phone = String(data.get('phone') || '').trim();
    t.specialty = String(data.get('specialty') || '').trim();
    t.photo = String(data.get('photo') || '').trim();
    if (!save()) return toast('تعذر الحفظ — مساحة التخزين ممتلئة.', 'error');
    logAct(sessionLabel(), 'حدّث بياناته الشخصية');
    render(); toast('تم حفظ بياناتك.');
  });
  on('#stu-form', 'submit', e => {
    e.preventDefault();
    const data = new FormData(e.target);
    const s = session.id ? find('students', session.id) : null;
    if (!s) return;
    const name = String(data.get('name') || '').trim();
    const grade = String(data.get('grade') || '').trim();
    if (!name) return toast('الاسم مطلوب.', 'error');
    const nv = validateStudentName(name);
    if (!nv.valid) return toast(nv.message, 'error');
    if (!grade) return toast('اختر الصف الدراسي.', 'error');
    s.name = name; s.grade = grade;
    s.phone = String(data.get('phone') || '').trim();
    if (!save()) return toast('تعذر الحفظ — مساحة التخزين ممتلئة.', 'error');
    render(); toast('تم حفظ بياناتك.');
  });
  on('#new-grade', 'keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('[data-action="grade-add"]')?.click(); } });
  on('#restore-file', 'change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.teachers) || !data.settings) throw 0;
        db = data;
        localStorage.setItem(KEY, JSON.stringify(db));
        schedulePush();
        setSession(null); page = 'dashboard';
        render(); toast('تمت استعادة النسخة الاحتياطية — سجّل الدخول من جديد.');
      } catch { toast('ملف غير صالح — تعذرت الاستعادة.', 'error'); }
    };
    reader.readAsText(file);
  });
}
window.addEventListener('storage', e => {
  if (e.key !== KEY || !e.newValue) return;
  try { const fresh = JSON.parse(e.newValue); if (JSON.stringify(fresh) === JSON.stringify(db)) return; db = fresh; render(); } catch {}
});
window.addEventListener('scroll', () => {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;
  const h = document.documentElement;
  const max = h.scrollHeight - h.clientHeight;
  bar.style.width = max > 0 ? Math.min(100, Math.round(h.scrollTop / max * 100)) + '%' : '0';
}, { passive: true });
window.addEventListener('hashchange', render);
function filterTable() {
  const q = $('[data-filter="table"]')?.value.toLowerCase() || '';
  document.querySelectorAll('tbody tr[data-search]').forEach(r => { r.style.display = r.dataset.search.toLowerCase().includes(q) ? '' : 'none'; });
}
function sortTable(th) {
  const table = th.closest('table'); const tbody = table?.querySelector('tbody'); if (!tbody) return;
  const idx = [...th.parentElement.children].indexOf(th);
  const key = `${page}:${idx}`; sortDir[key] = sortDir[key] === 'asc' ? 'desc' : 'asc'; const dir = sortDir[key] === 'asc' ? 1 : -1;
  const rows = [...tbody.children].filter(r => !r.querySelector('td.empty'));
  const val = t => { const n = t.replace(/[^\d.\-]/g, ''); return (n && !isNaN(+n)) ? +n : t.trim(); };
  rows.sort((a, b) => { const va = val(a.children[idx]?.textContent || ''), vb = val(b.children[idx]?.textContent || ''); return ((typeof va === 'number' && typeof vb === 'number') ? va - vb : String(va).localeCompare(String(vb), 'ar')) * dir; });
  rows.forEach(r => tbody.append(r));
  [...th.parentElement.children].forEach(h => { if (h.dataset.sortable !== undefined) h.textContent = h.textContent.replace(/\s*[↕↑↓]\s*.*$/, '') + ' ↕'; });
  th.textContent = th.textContent.replace(/\s*[↕↑↓]\s*.*$/, '') + (dir === 1 ? ' ↑' : ' ↓');
}
function exportCurrent() {
  const list = mySubmissions().filter(s => (page === 'payments' ? s.formType === 'payment' && (filters.payStatus === 'all' || s.status === filters.payStatus) : page === 'support' ? s.formType === 'support' && (filters.supStatus === 'all' || s.status === filters.supStatus) : (filters.msgType === 'all' || s.formType === filters.msgType) && (filters.msgStatus === 'all' || s.status === filters.msgStatus)));
  if (!list.length) return toast('لا يوجد ما يمكن تصديره بهذه الفلاتر.', 'error');
  const rows = list.map(s => [s.name, s.grade, s.formType === 'payment' ? money(s.data.amount) : String(s.data.question || '').slice(0, 50), s.createdAt, ({ new: 'جديد', confirmed: 'مؤكد', rejected: 'مرفوض', resolved: 'تم الرد' })[s.status], s.reply]);
  exportCSV(page === 'payments' ? 'رسائل-الدفع' : page === 'support' ? 'الدعم-العلمي' : 'كل-الرسائل', ['الطالب', 'الصف', 'المحتوى', 'التاريخ', 'الحالة', 'الرد'], rows);
}
function reportExport() {
  const isTeacher = session.kind === 'teacher';
  const mine = isTeacher ? db.submissions.filter(s => s.teacherId === session.id) : db.submissions;
  const formsList = isTeacher ? db.forms.filter(f => f.teacherId === session.id) : db.forms;
  if (!formsList.length) return toast('لا نماذج لتصدير تقرير عنها.', 'error');
  const rows = formsList.map(f => {
    const subs = mine.filter(s => s.formId === f.id);
    const c = st => subs.filter(s => s.status === st).length;
    return [f.title, f.type === 'payment' ? 'دفع' : 'دعم', subs.length, c('new'), c('confirmed'), c('rejected'), c('resolved')];
  });
  exportCSV(isTeacher ? 'تقرير-أدائي' : 'تقرير-المنصة', ['النموذج', 'النوع', 'الإجمالي', 'جديد', 'مؤكد', 'مرفوض', 'تم الرد'], rows);
}

/* ===== معالج النقر الموحد ===== */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action],[data-page],[data-close-modal],[data-login-role],[data-sortable]');
  if (!el) return;
  if (el.dataset.closeModal !== undefined) return closeModal();
  if (el.dataset.loginRole) { loginRole = el.dataset.loginRole; if (loginRole !== 'student') studentMode = 'login'; renderLogin(); return; }
  const a = el.dataset.action, id = el.dataset.id;
  if (a === 'stu-mode') {
    studentMode = id || 'login';
    clearLoginAlert();
    if (returnHash && publicFormId()) return renderPublicForm();
    renderLogin();
    return;
  }
  if (a === 'stu-register') { setSession(null); loginRole = 'student'; studentMode = 'register'; renderLogin(); return; }
  if (a && a.startsWith('pub-')) {
    if (a === 'pub-attach') return $('#pf-file')?.click();
    if (a === 'pub-remove-image') {
      pubState.image = null; $('#pf-file').value = '';
      $('#pf-preview').hidden = true; $('.pub-attach-btn').style.display = '';
      $('#pf-preview-img')?.removeAttribute('src');
      return;
    }
    if (a === 'pub-submit') return submitPublic();
    if (a === 'pub-ok-close') { el.closest('.pub-ok')?.remove(); return; }
    if (a === 'pub-ok-copy') { copyText(pubState.lastCode || '').then(ok => toast(ok ? 'تم نسخ الرمز — احفظه في مكان آمن.' : 'تعذر النسخ.', ok ? 'success' : 'error')); return; }
    if (a === 'pub-ok-portal') {
      el.closest('.pub-ok')?.remove();
      if (session?.kind === 'student') { page = 'dashboard'; render(); toast('هذه رسائلك — تابع ردودها هنا.'); }
      else { loginRole = 'student'; renderLogin(); toast('أدخل رمز المتابعة الذي نسخته لتدخل بوابة الطالب.'); }
      return;
    }
    if (a === 'pub-dark') { db.settings.dark = !db.settings.dark; save(); render(); return; }
    return;
  }
  if (el.dataset.page) { page = el.dataset.page; $('#sidebar')?.classList.remove('open'); render(); return; }
  if (el.dataset.sortable !== undefined) return sortTable(el);
  if (!session) return;
  if (a === 'logout') { setSession(null); page = 'dashboard'; render(); toast('تم تسجيل الخروج.'); return; }
  if (a === 'dark') { db.settings.dark = !db.settings.dark; save(); render(); return; }
  if (a === 'sidebar') {
    menuOpen = !menuOpen;
    $('#sidebar')?.classList.toggle('open', menuOpen);
    $('.menu-toggle')?.classList.toggle('open', menuOpen);
    return;
  }
  if (a === 'copy-link') { const f = find('forms', id); if (f && await copyText(formLink(f))) { toast('تم نسخ رابط النموذج.'); $('#share-url')?.select(); } return; }
  if (a === 'export-current') return exportCurrent();
  if (a === 'teacher-new') return peopleForm('teachers', '');
  if (a === 'teacher-edit') return peopleForm('teachers', id);
  if (a === 'teacher-renew') return renewModal('teachers', id);
  if (a === 'teacher-del') return peopleDelete('teachers', id);
  if (a === 'sp-new') return peopleForm('supervisors', '');
  if (a === 'sp-edit') return peopleForm('supervisors', id);
  if (a === 'sp-renew') return renewModal('supervisors', id);
  if (a === 'sp-del') return peopleDelete('supervisors', id);
  if (a === 'form-new') return formEditor('');
  if (a === 'form-edit') return formEditor(id);
  if (a === 'form-share') return shareLinkModal(id);
  if (a === 'form-toggle') {
    const f = find('forms', id); if (!f) return;
    f.active = !f.active;
    logAct(sessionLabel(), `${f.active ? 'نشّط' : 'أوقف'} نموذج «${f.title}»`);
    save(); render(); toast(f.active ? 'تم تشغيل النموذج.' : 'تم إيقاف النموذج — لن يستقبل رسائل.');
    return;
  }
  if (a === 'form-del') return formDelete(id);
  if (a === 'fb-add') { const k = 'cf-' + uid(); fbFields.push({ id: k, key: k, label: '', type: 'text', required: false, options: [] }); renderFbEditor(); return; }
  if (a === 'fb-del') { fbFields.splice(Number(id), 1); renderFbEditor(); return; }
  if (a === 'fb-up' || a === 'fb-down') {
    const i = Number(id), j = a === 'fb-up' ? i - 1 : i + 1;
    if (i >= 0 && j >= 0 && j < fbFields.length) { [fbFields[i], fbFields[j]] = [fbFields[j], fbFields[i]]; renderFbEditor(); }
    return;
  }
  if (a === 'mysp-new') return peopleForm('supervisors', '', session.id);
  if (a === 'mysp-edit' || a === 'mysp-renew' || a === 'mysp-del') {
    const s = find('supervisors', id);
    if (!s || s.ownerTeacherId !== session.id) return toast('هذا المشرف ليس تابعاً لك.', 'error');
    if (a === 'mysp-edit') return peopleForm('supervisors', id);
    if (a === 'mysp-renew') return renewModal('supervisors', id);
    return peopleDelete('supervisors', id);
  }
  if (a === 'stu-view') return studentSubDetail(id);
  if (a === 'stu-filter') { filters.stuStatus = id; render(); return; }
  if (a === 'goto-reports') { page = 'reports'; render(); return; }
  if (a === 'goto-settings') { page = 'settings'; render(); return; }
  if (a === 'goto-courses') { page = 'courses'; render(); return; }
  if (a === 'goto-store') { page = 'store'; render(); return; }
  if (a === 'course-new') { if (session.kind !== 'admin') return toast('الأدمن وحده من ينشر الكورسات.', 'error'); const tid = id || db.teachers[0]?.id || ''; return courseForm(tid, ''); }
  if (a === 'course-edit') { if (session.kind !== 'admin') return toast('الأدمن وحده من يعدّل الكورسات.', 'error'); const owner = findCourseOwner(id); return owner ? courseForm(owner.id, id) : toast('الكورس غير موجود.', 'error'); }
  if (a === 'course-del') { if (session.kind !== 'admin') return toast('الأدمن وحده من يحذف الكورسات.', 'error'); const owner = findCourseOwner(id); if (!owner) return toast('الكورس غير موجود.', 'error'); return courseDelete(id); }
  if (a === 'course-settle') { if (session.kind !== 'admin') return toast('الأدمن وحده له صلاحية التصفية.', 'error'); return courseSettle(id); }
  if (a === 'store-new') { if (session.kind !== 'admin') return toast('الأدمن وحده يدير المتجر.', 'error'); return storeToolForm(''); }
  if (a === 'store-edit') { if (session.kind !== 'admin') return toast('الأدمن وحده يدير المتجر.', 'error'); return storeToolForm(id); }
  if (a === 'store-toggle') {
    const t = find('store', id); if (!t || session.kind !== 'admin') return;
    t.active = !t.active;
    logAct(sessionLabel(), `${t.active ? 'نشّط' : 'أوقف'} أداة «${t.title}» في المتجر`);
    save(); render(); toast(t.active ? 'الأداة نشطة الآن في المتجر.' : 'تم إيقاف الأداة.');
    return;
  }
  if (a === 'store-del') {
    const t = find('store', id); if (!t || session.kind !== 'admin') return;
    modal('تأكيد الحذف', `<div class="notice" style="border-color:var(--danger);background:#fce4e8;color:#ae1a34">ستُحذف أداة <b>${esc(t.title)}</b> من المتجر مع كل سجلات شرائها. لا يمكن التراجع.</div>`, () => {
      db.store = db.store.filter(x => x.id !== id);
      db.purchases = db.purchases.filter(p => p.toolId !== id);
      logAct(sessionLabel(), `حذف أداة «${t.title}» من المتجر`);
      if (!save()) return toast('تعذر الحفظ.', 'error');
      closeModal(); render(); toast('تم حذف الأداة.');
    }, 'حذف نهائي');
    return;
  }
  if (a === 'store-buy') return storeBuy(id);
  if (a === 'store-trial') return storeTrial(id);
  if (a === 'store-approve') {
    const p = find('purchases', id);
    if (!p || session.kind !== 'admin') return;
    if (p.status !== 'pending') return toast('هذا الطلب تم البت فيه بالفعل.', 'error');
    const tool = find('store', p.toolId);
    p.status = 'approved';
    p.ends = dateAfter(tool?.duration || 30);
    p.approvedAt = dateTime();
    logAct(sessionLabel(), `وافق على طلب شراء «${tool?.title || ''}» لـ ${p.buyerName} — حتى ${p.ends}`);
    if (!save()) return toast('تعذر الحفظ.', 'error');
    render(); toast(`تمت الموافقة ✅ — الأداة مفعّلة لـ ${p.buyerName} حتى ${p.ends}.`);
    return;
  }
  if (a === 'store-reject') {
    const p = find('purchases', id);
    if (!p || session.kind !== 'admin') return;
    if (p.status !== 'pending') return toast('هذا الطلب تم البت فيه بالفعل.', 'error');
    modal('رفض طلب الشراء', `<div class="notice">المشتري: <b>${esc(p.buyerName)}</b> — الأداة: <b>${esc(find('store', p.toolId)?.title || '—')}</b><br>سيظهر الرفض وسببه في صفحة «أدواتي» لدى المشتري مع إمكانية إعادة الطلب.</div>${field('note', 'سبب الرفض (اختياري)', '', 'text', false, 'placeholder="مثال: المبلغ غير مكتمل"')}`, data => {
      p.status = 'rejected';
      p.rejectNote = String(data.get('note') || '').trim();
      logAct(sessionLabel(), `رفض طلب شراء ${p.buyerName}`);
      if (!save()) return toast('تعذر الحفظ.', 'error');
      closeModal(); render(); toast('تم رفض الطلب.');
    }, '✕ رفض الطلب');
    return;
  }
  if (a === 'goto-mytools') { page = 'mytools'; render(); return; }
  if (a === 'store-open') { location.hash = '#/tool/' + id; return; }
  if (a === 'tool-back') { location.hash = ''; page = 'store'; render(); return; }
  if (a === 'student-del') {
    const s = find('students', id); if (!s) return;
    modal('تأكيد الحذف', `<div class="notice" style="border-color:var(--danger);background:#fce4e8;color:#ae1a34">سيُحذف حساب الطالب <b>${esc(s.name)}</b> — ستبقى رسائله في النظام لكن بدون ربط حساب. لا يمكن التراجع.</div>`, () => {
      db.students = db.students.filter(x => x.id !== id);
      db.submissions.forEach(x => { if (x.studentId === id) x.studentId = ''; });
      logAct(sessionLabel(), `حذف حساب الطالب: ${s.name}`);
      if (!save()) return toast('تعذر الحفظ.', 'error');
      closeModal(); render(); toast('تم حذف حساب الطالب.');
    }, 'حذف');
    return;
  }
  if (a === 'copy-code') { copyText(session?.code || '').then(ok => toast(ok ? 'تم نسخ رمز المتابعة.' : 'تعذر النسخ.', ok ? 'success' : 'error')); return; }
  if (a === 'print-page') return window.print();
  if (a === 'report-export') return reportExport();
  if (a === 'fin-export') return finExport();
  if (a === 'goto-finreports') { page = 'finreports'; render(); return; }
  if (a === 'brand-reset') {
    if (session.kind !== 'admin') return;
    db.settings.theme = { primary: '', primaryDark: '', sidebar: '' };
    if (!save()) return toast('تعذر الحفظ.', 'error');
    logAct(sessionLabel(), 'أعاد ألوان المنصة الافتراضية');
    applyTheme(); render(); toast('أُعيدت الألوان الافتراضية ↺');
    return;
  }
  if (a === 'sub-view') return subDetail(id);
  if (a === 'sub-confirm' || a === 'sub-reject' || a === 'sub-resolve' || a === 'sub-reopen' || a === 'sub-reply') return subAction(id, a.slice(4));
  if (a === 'payacc-new') return payAccountForm('');
  if (a === 'payacc-edit') return payAccountForm(id);
  if (a === 'payacc-del') {
    const t = find('teachers', session.id); if (!t) return;
    const acc = (t.payAccounts || []).find(x => x.id === id); if (!acc) return;
    modal('تأكيد الحذف', `<div class="notice" style="border-color:var(--danger);background:#fce4e8;color:#ae1a34">سيُحذف حساب <b>${esc(acc.label)}</b> (<span dir="ltr">${esc(acc.number)}</span>) من نموذج الدفع.</div>`, () => {
      t.payAccounts = t.payAccounts.filter(x => x.id !== id);
      logAct(sessionLabel(), `حذف حساب دفع ${acc.label}`);
      if (!save()) return toast('تعذر الحفظ.', 'error');
      closeModal(); render(); toast('تم حذف حساب الدفع.');
    }, 'حذف');
    return;
  }
  if (a === 'grade-add') {
    const input = $('#new-grade');
    const g = String(input?.value || '').trim();
    if (!g) return toast('اكتب اسم الصف أولاً.', 'error');
    if (db.settings.grades.includes(g)) return toast('هذا الصف موجود بالفعل.', 'error');
    db.settings.grades.push(g);
    logAct(sessionLabel(), `أضاف صفاً دراسياً: ${g}`);
    save(); render(); toast('تمت إضافة الصف.');
    return;
  }
  if (a === 'grade-del') {
    const i = Number(id);
    const g = db.settings.grades[i]; if (g === undefined) return;
    db.settings.grades.splice(i, 1);
    logAct(sessionLabel(), `حذف صفاً دراسياً: ${g}`);
    save(); render(); toast('تم حذف الصف.');
    return;
  }
  if (a === 'backup') {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'نسخة-المنصة-' + date() + '.json';
    link.click();
    return toast('تم تنزيل النسخة الاحتياطية.');
  }
  if (a === 'reset') {
    modal('تصفير النظام', `<div class="notice" style="border-color:var(--danger);background:#fce4e8;color:#ae1a34">سيُحذف <b>كل شيء</b>: المعلمون والمشرفون والنماذج والرسائل، وتعود البيانات التجريبية الافتراضية. نزّل نسخة احتياطية أولاً إن أردت الاحتفاظ بالبيانات.</div>`, () => {
      db = seed();
      localStorage.setItem(KEY, JSON.stringify(db));
      schedulePush();
      setSession(null); page = 'dashboard';
      closeModal(); render(); toast('تمت إعادة النظام إلى حالته الافتراضية.');
    }, 'تصفير نهائي');
    return;
  }
});

render();
})();

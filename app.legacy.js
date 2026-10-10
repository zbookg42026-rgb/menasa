/* Smart Center — نظام متعدد الأدوار مع بابة دخول وصلاحيات واشتراكات. البيانات في localStorage. */
(() => {
  const KEY = 'smart-center-prototype-v1';
  const SESS = 'sc-session';
  const $ = (q, root = document) => root.querySelector(q);
  const money = n => new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(Number(n || 0)) + ' ج.م';
  const date = () => new Date().toISOString().slice(0, 10);
  const month = () => new Date().toISOString().slice(0, 7);
  const monthStart = () => date().slice(0, 8) + '01';
  const uid = () => Math.random().toString(36).slice(2, 9);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;
  const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
  const addMonths = (m, k) => { const [y, mm] = m.split('-').map(Number); return new Date(Date.UTC(y, mm - 1 + k, 1)).toISOString().slice(0, 7); };
  const addMonthsDate = (ds, k) => { const [y, mm, dd] = ds.split('-').map(Number); return new Date(Date.UTC(y, mm - 1 + k, dd)).toISOString().slice(0, 10); };
  const dateAfter = days => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
  const subDays = endDate => Math.ceil((new Date(endDate + 'T23:59:59') - Date.now()) / 864e5);
  const defaultFormFields = () => ({
    teacher: [
      { key: 'name', label: 'الاسم', type: 'text', required: true, enabled: true },
      { key: 'phone', label: 'رقم الهاتف', type: 'tel', required: false, enabled: true },
      { key: 'subject', label: 'المادة', type: 'text', required: true, enabled: true },
      { key: 'username', label: 'اسم المستخدم للدخول', type: 'text', required: true, enabled: true },
      { key: 'password', label: 'كلمة المرور', type: 'text', required: true, enabled: true },
      { key: 'subscriptionEnd', label: 'تاريخ انتهاء اشتراك الوصول', type: 'date', required: true, enabled: true },
      { key: 'payMode', label: 'نظام مستحقات المعلم', type: 'select', options: [['none', 'بدون حساب'], ['percent', 'نسبة من تحصيل مجموعاته'], ['salary', 'راتب شهري ثابت']], required: false, enabled: true },
      { key: 'payValue', label: 'قيمة النسبة % أو الراتب', type: 'number', required: false, enabled: true }
    ],
    supervisor: [
      { key: 'name', label: 'الاسم', type: 'text', required: true, enabled: true },
      { key: 'phone', label: 'رقم الهاتف', type: 'tel', required: false, enabled: true },
      { key: 'username', label: 'اسم المستخدم للدخول', type: 'text', required: true, enabled: true },
      { key: 'password', label: 'كلمة المرور', type: 'text', required: true, enabled: true },
      { key: 'salary', label: 'الراتب الشهري', type: 'number', required: true, enabled: true },
      { key: 'subscriptionEnd', label: 'تاريخ انتهاء اشتراك الوصول', type: 'date', required: true, enabled: true }
    ],
    student: [
      { key: 'name', label: 'اسم الطالب', type: 'text', required: true, enabled: true },
      { key: 'stage', label: 'المرحلة الدراسية', type: 'select', required: true, enabled: true },
      { key: 'gender', label: 'النوع', type: 'select', required: false, enabled: true },
      { key: 'code', label: 'كود الطالب (ID للدخول)', type: 'text', required: false, enabled: true },
      { key: 'spassword', label: 'كلمة مرور دخول الطالب', type: 'text', required: false, enabled: true },
      { key: 'gpassword', label: 'كلمة مرور دخول ولي الأمر', type: 'text', required: false, enabled: true },
      { key: 'phone', label: 'رقم هاتف الطالب', type: 'tel', required: false, enabled: true },
      { key: 'parentPhone', label: 'رقم ولي الأمر', type: 'tel', required: false, enabled: true },
      { key: 'email', label: 'البريد الإلكتروني', type: 'email', required: false, enabled: true },
      { key: 'paymentMode', label: 'طريقة الدفع', type: 'select', required: false, enabled: true },
      { key: 'fee', label: 'المصروف الشهري', type: 'number', required: false, enabled: true },
      { key: 'lessonPrice', label: 'سعر الحصة (لدفع بالحصة)', type: 'number', required: false, enabled: true },
      { key: 'installments', label: 'تقسيط المصروف على عدد من الشهور', type: 'number', required: false, enabled: true },
      { key: 'deposit', label: 'مقدم الحجز', type: 'number', required: false, enabled: true },
      { key: 'note', label: 'ملاحظة', type: 'textarea', required: false, enabled: true }
    ]
  });
  const defaultLoginFields = () => ({ admin: ['username', 'password'], teacher: ['username', 'password'], supervisor: ['username', 'password'], staff: ['username', 'password'], owner: ['username', 'password'], student: ['code', 'spassword'], guardian: ['code', 'gpassword'], viewer: ['code', 'password'] });

  const seed = {
    settings: { centerName: 'سمارت سنتر', type: 'center', monthlyFee: 200, capacity: 30, allowMakeup: true, confirmDelete: true, paymentMode: 'monthly', absenceLimit: 3, dark: false },
    stages: [
      { id: 'st1', name: 'الأولى الثانوية', fee: 150 },
      { id: 'st2', name: 'الثانية الثانوية', fee: 175 },
      { id: 'st3', name: 'الثالثة الثانوية', fee: 200 }
    ],
    subjects: ['الرياضيات', 'الفيزياء', 'اللغة العربية'],
    teachers: [{ id: 't1', name: 'محمود رضا', phone: '01000000000', subject: 'الرياضيات', stages: ['الأولى الثانوية', 'الثانية الثانوية', 'الثالثة الثانوية'], payMode: 'percent', payValue: 50, username: 'mahmoud', password: '1234', subscriptionEnd: dateAfter(30), workSchedule: { days: ['السبت', 'الاثنين'], time: '17:00' }, payMethods: [{ id: 'pm1', name: 'نقدي (يدوي)', kind: 'manual', destination: '' }, { id: 'pm2', name: 'فودافون كاش', kind: 'transfer', destination: '01000000000' }] }],
    supervisors: [{ id: 'sp1', name: 'كريم عبد الله', phone: '01050000000', username: 'kareem', password: '1234', teacherId: 't1', groupIds: ['g1'], subscriptionEnd: dateAfter(30), salary: 500, schedule: { days: ['السبت', 'الاثنين'], time: '17:00' }, attendanceLog: [] }],
    groups: [{ id: 'g1', name: 'مجموعة السبت والاثنين', teacherId: 't1', teacherIds: ['t1'], stage: 'الثالثة الثانوية', capacity: 30, schedule: 'السبت والاثنين — 17:00', days: ['السبت', 'الاثنين'], time: '17:00' }],
    students: [
      { id: 's1', code: '1001', name: 'أحمد مسعد', phone: '01010000001', parentPhone: '01010000011', email: '', stage: 'الثالثة الثانوية', gender: 'ذكر', groupIds: ['g1'], teacherIds: ['t1'], fee: 100, deposit: 50, note: 'متابعة الواجب', status: 'active', createdAt: date(), paymentMode: 'شهري', lessonPrice: 0, installments: [], password: '', registeredBy: 'الإدارة' },
      { id: 's2', code: '1002', name: 'مصطفى إبراهيم', phone: '01010000002', parentPhone: '01010000012', email: '', stage: 'الثالثة الثانوية', gender: 'ذكر', groupIds: ['g1'], teacherIds: ['t1'], fee: 200, deposit: 0, note: '', status: 'active', createdAt: date(), paymentMode: 'شهري', lessonPrice: 0, installments: [], password: '', registeredBy: 'الإدارة' }
    ],
    payments: [{ id: 'p1', studentId: 's1', amount: 80, due: 100, period: month(), receivedBy: 'المدير', collectedBy: 'المدير', method: 'نقدي (يدوي)', kind: 'manual', destination: '', createdAt: date(), archived: false }],
    attendance: [],
    exams: [{ id: 'e1', name: 'اختبار الباب الأول', kind: 'ورقي', stage: 'الثالثة الثانوية', duration: 30, date: date(), teacherId: 't1', grades: [{ studentId: 's1', score: 18, max: 20, note: '' }], status: 'open' }],
    expenses: [], incomes: [],
    suppliers: [{ id: 'v1', name: 'مطبعة الصفوة', phone: '01022220000', note: '' }],
    books: [{ id: 'b1', name: 'مراجعة نهائية', stage: 'الثالثة الثانوية', supplierId: 'v1', qty: 25, totalPurchased: 25, purchase: 50, sale: 55, supplierPaid: 0, deliveries: [] }],
    notifications: [],
    activity: [],
    supervisorAdjustments: [],
    payAdjustments: [],
    venues: [{ id: 'vn1', name: 'المقر الرئيسي', location: '', rent: 2000, supervisorIds: ['sp1'] }],
    staff: [],
    owners: [],
    loginFields: { admin: ['username', 'password'], teacher: ['username', 'password'], supervisor: ['username', 'password'], staff: ['username', 'password'], owner: ['username', 'password'], student: ['code', 'spassword'], guardian: ['code', 'gpassword'], viewer: ['code', 'password'] },
    formFields: defaultFormFields(),
    users: [{ id: 'u1', name: 'المدير', username: 'admin', password: '1234', phone: '01000000000', roleId: 'manager', extras: [], pin: '' }],
    archivedStudents: []
  };
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || structuredClone(seed); } catch { db = structuredClone(seed); }
  /* ترحيل البيانات القديمة */
  (function migrate() {
    if (Array.isArray(db.stages) && db.stages.some(s => typeof s === 'string')) {
      db.stages = db.stages.map(s => typeof s === 'string' ? { id: 'st-' + uid(), name: s, fee: Number(db.settings.monthlyFee || 0) } : s);
    }
    if (!Array.isArray(db.subjects)) db.subjects = [];
    if (!Array.isArray(db.activity)) db.activity = [];
    if (!Array.isArray(db.supervisors)) db.supervisors = [];
    db.groups.forEach(g => {
      if (!Array.isArray(g.teacherIds) || !g.teacherIds.length) g.teacherIds = [g.teacherId].filter(Boolean);
      if (!Array.isArray(g.days)) { g.days = DAYS.filter(d => (g.schedule || '').includes(d)); const m = (g.schedule || '').match(/\d{1,2}:\d{2}/); g.time = m ? m[0] : ''; }
      if (g.venueId === undefined) g.venueId = '';
    });
    if (!db.loginFields || !db.loginFields.admin) db.loginFields = defaultLoginFields();
    /* حقول الدخول لكل دور — تُضمن الأدوار الجديدة (صاحب السنتر، الطالب، ولي الأمر) للبيانات القديمة */
    const defLF = defaultLoginFields();
    ['admin', 'teacher', 'supervisor', 'staff', 'owner', 'student', 'guardian', 'viewer'].forEach(r => { if (!Array.isArray(db.loginFields[r])) db.loginFields[r] = defLF[r]; });
    if (!Array.isArray(db.owners)) db.owners = [];
    if (!Array.isArray(db.venues)) db.venues = [];
    if (!Array.isArray(db.staff)) db.staff = [];
    if (!Array.isArray(db.payAdjustments)) db.payAdjustments = [];
    (db.supervisorAdjustments || []).forEach(x => { if (!db.payAdjustments.some(y => y.id === x.id)) db.payAdjustments.push({ ...x, personKind: 'supervisor', personId: x.supervisorId }); });
    db.teachers.forEach(t => {
      if (!t.createdAt) t.createdAt = date();
      if (!t.workSchedule || !Array.isArray(t.workSchedule.days)) t.workSchedule = { days: [], time: '' };
      if (!t.payMode) t.payMode = 'none';
      if (t.payValue === undefined) t.payValue = 0;
      if (!t.username) t.username = t.phone || t.name;
      if (t.password === undefined) t.password = '1234';
      if (!t.subscriptionEnd) t.subscriptionEnd = dateAfter(30);
      if (!Array.isArray(t.payMethods) || !t.payMethods.length) t.payMethods = [{ id: 'pm-' + uid(), name: 'نقدي (يدوي)', kind: 'manual', destination: '' }];
    });
    db.supervisors.forEach(sp => {
      if (!sp.username) sp.username = sp.phone || sp.name;
      if (sp.password === undefined) sp.password = '1234';
      if (!sp.subscriptionEnd) sp.subscriptionEnd = dateAfter(30);
      if (sp.salary === undefined) sp.salary = 0;
      if (!Array.isArray(sp.groupIds)) sp.groupIds = [];
      if (!sp.createdAt) sp.createdAt = date();
    });
    db.staff.forEach(st => { if (!st.createdAt) st.createdAt = date(); });
    db.groups.forEach(g => { if (g.entryCloseTime === undefined) g.entryCloseTime = ''; });
    /* استبدال حساب السكرتارية بنظام المشرفين: تُحذف حسابات الموظفين ويبقى مدير النظام */
    db.users = db.users.filter(u => u.roleId === 'manager');
    db.users.forEach(u => {
      if (!u.username) u.username = u.roleId === 'manager' ? 'admin' : u.name;
      if (u.password === undefined) u.password = '1234';
      if (u.pin === undefined) u.pin = '';
    });
    if (!db.formFields || !db.formFields.teacher || !db.formFields.student || !db.formFields.supervisor) db.formFields = defaultFormFields();
    if (!db.formFields.student.some(f => f.key === 'gpassword')) db.formFields.student.splice(db.formFields.student.findIndex(f => f.key === 'spassword') + 1, 0, { key: 'gpassword', label: 'كلمة مرور دخول ولي الأمر', type: 'text', required: false, enabled: true });
    if (!Array.isArray(db.supervisorAdjustments)) db.supervisorAdjustments = [];
    db.supervisors.forEach(sp => {
      if (!sp.createdAt) sp.createdAt = date();
      if (!sp.schedule || !Array.isArray(sp.schedule.days)) sp.schedule = { days: [], time: '' };
      if (!Array.isArray(sp.attendanceLog)) sp.attendanceLog = [];
    });
    db.teachers.forEach(t => { if (!t.createdAt) t.createdAt = date(); });
    db.staff.forEach(st => { if (!st.createdAt) st.createdAt = date(); });
    db.students.forEach(s => {
      if (!Array.isArray(s.installments)) s.installments = [];
      if (s.paymentMode === undefined) s.paymentMode = 'شهري';
      if (s.lessonPrice === undefined) s.lessonPrice = 0;
      if (s.password === undefined) s.password = '';
      if (s.guardianPassword === undefined) s.guardianPassword = '';
      if (!s.registeredBy) s.registeredBy = '—';
      if (!Array.isArray(s.teacherIds)) s.teacherIds = [];
    });
    db.owners.forEach(o => {
      if (!o.createdAt) o.createdAt = date();
      if (o.phone === undefined) o.phone = '';
    });
  })();

  /* ===== الجلسة ===== */
  let session = null;
  try { session = JSON.parse(sessionStorage.getItem(SESS)); } catch {}
  const setSession = s => { session = s; try { s ? sessionStorage.setItem(SESS, JSON.stringify(s)) : sessionStorage.removeItem(SESS); } catch {} };
  const who = () => session?.name || '—';
  const isPortalUser = () => session && (session.kind === 'viewer' || session.kind === 'student' || session.kind === 'guardian');
  const isStaffLevel = () => session && (session.kind === 'admin' || session.kind === 'owner');
  const can = p => {
    if (!session) return false;
    if (session.kind === 'admin' || session.kind === 'owner') return true;
    if (session.kind !== 'staff') return false;
    const user = find('users', session.id);
    if (user?.roleId === 'manager') return true;
    const role = find('roles', user?.roleId);
    return [...(role?.permissions || []), ...(user?.extras || [])].includes(p);
  };

  /* فاحص التفرد العام: لا يتكرر اسم المستخدم أو رقم الهاتف بين أي فئتين (سد الثغرة الأمنية) */
  function usernameTaken(username, ignore) {
    if (!username) return false;
    const same = e => ignore && ignore.kind === e.kind && ignore.id === e.id;
    if (db.users.some(x => x.username === username && !same({ kind: 'user', id: x.id }))) return 'مدير/موظف إدارة';
    if ((db.owners || []).some(x => x.username === username && !same({ kind: 'owner', id: x.id }))) return 'صاحب سنتر';
    if (db.teachers.some(x => x.username === username && !same({ kind: 'teacher', id: x.id }))) return 'معلم';
    if (db.supervisors.some(x => x.username === username && !same({ kind: 'supervisor', id: x.id }))) return 'مشرف';
    if (db.staff.some(x => x.username === username && !same({ kind: 'staff', id: x.id }))) return 'موظف';
    return false;
  }
  function phoneTaken(phone, ignore) {
    if (!phone) return false;
    const same = e => ignore && ignore.kind === e.kind && ignore.id === e.id;
    if (db.users.some(x => x.phone && x.phone === phone && !same({ kind: 'user', id: x.id }))) return 'مدير/موظف إدارة';
    if ((db.owners || []).some(x => x.phone && x.phone === phone && !same({ kind: 'owner', id: x.id }))) return 'صاحب سنتر';
    if (db.teachers.some(x => x.phone && x.phone === phone && !same({ kind: 'teacher', id: x.id }))) return 'معلم';
    if (db.supervisors.some(x => x.phone && x.phone === phone && !same({ kind: 'supervisor', id: x.id }))) return 'مشرف';
    if (db.staff.some(x => x.phone && x.phone === phone && !same({ kind: 'staff', id: x.id }))) return 'موظف';
    return false;
  }
  const checkUniqueCredentials = (username, phone, ignore, password, passwordChanged) => {
    const u = usernameTaken(String(username || '').trim(), ignore);
    if (u) return `اسم المستخدم مستخدم بالفعل لحساب ${u} — اختر اسماً آخر.`;
    const p = phoneTaken(String(phone || '').trim(), ignore);
    if (p) return `رقم الهاتف مستخدم بالفعل لحساب ${p} — لا يمكن تكراره لأنه قد يكون وسيلة دخول.`;
    if (passwordChanged && passwordTaken(String(password || ''), ignore)) return 'كلمة المرور مستخدمة لحساب آخر — لكل حساب كلمة مرور مختلفة.';
    return '';
  };
  function passwordTaken(password, ignore) {
    if (!password) return false;
    const same = e => ignore && ignore.kind === e.kind && ignore.id === e.id;
    if (db.users.some(x => x.password && x.password === password && !same({ kind: 'user', id: x.id }))) return true;
    if ((db.owners || []).some(x => x.password && x.password === password && !same({ kind: 'owner', id: x.id }))) return true;
    if (db.teachers.some(x => x.password && x.password === password && !same({ kind: 'teacher', id: x.id }))) return true;
    if (db.supervisors.some(x => x.password && x.password === password && !same({ kind: 'supervisor', id: x.id }))) return true;
    if (db.staff.some(x => x.password && x.password === password && !same({ kind: 'staff', id: x.id }))) return true;
    return false;
  }

  /* ===== نطاق الرؤية (عزل المعلمين والمشرفين) ===== */
  const sessionTeacher = () => session?.kind === 'teacher' ? find('teachers', session.id) : null;
  const sessionSupervisor = () => session?.kind === 'supervisor' ? find('supervisors', session.id) : null;
  function myGroups() {
    if (!session || isStaffLevel()) return db.groups;
    if (session.kind === 'teacher') return db.groups.filter(g => (g.teacherIds || []).includes(session.id));
    if (session.kind === 'supervisor') return db.groups.filter(g => (sessionSupervisor()?.groupIds || []).includes(g.id));
    return [];
  }
  function visStudents(archivedToo = false) {
    const pool = archivedToo ? db.students : db.students.filter(s => s.status === 'active');
    if (!session || isStaffLevel()) return pool;
    if (isPortalUser()) return pool.filter(s => s.id === session.ref);
    const gids = myGroups().map(g => g.id);
    if (session.kind === 'teacher') return pool.filter(s => s.groupIds.some(g => gids.includes(g)) || (s.teacherIds || []).includes(session.id));
    if (session.kind === 'supervisor') return pool.filter(s => s.groupIds.some(g => gids.includes(g)));
    return [];
  }
  const canTouchStudent = s => !session ? false : isStaffLevel() ? true : session.kind === 'teacher' ? visStudents(true).some(x => x.id === s.id) : session.kind === 'supervisor' ? visStudents().some(x => x.id === s.id) : false;
  const canTouchGroup = g => !session ? false : isStaffLevel() ? true : session.kind === 'teacher' ? (g.teacherIds || []).includes(session.id) : session.kind === 'supervisor' ? (sessionSupervisor()?.groupIds || []).includes(g.id) : false;
  const activeStudents = () => visStudents(false);

  /* ===== أدوات عامة ===== */
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  const find = (collection, id) => db[collection].find(x => x.id === id);
  const archivedList = () => visStudents(true).filter(s => s.status === 'archived');
  const groupName = id => find('groups', id)?.name || '—';
  const teacherName = id => find('teachers', id)?.name || '—';
  const studentName = id => find('students', id)?.name || '—';
  const stageByName = name => db.stages.find(s => s.name === name);
  const stageFee = name => stageByName(name)?.fee;
  const studentFee = s => Number(s.fee || stageFee(s.stage) || db.settings.monthlyFee || 0);
  const studentPayMode = s => s.paymentMode || 'شهري';
  const studentMonthLessons = s => db.attendance.filter(a => a.studentId === s.id && a.status === 'present' && a.date.startsWith(month())).length;
  const nowTime = () => new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const monthOptions = () => [...new Set([...db.payments.map(p => p.period), ...db.incomes.map(i => i.createdAt.slice(0, 7)), ...db.expenses.map(i => i.createdAt.slice(0, 7)), month()])].sort().reverse();
  const logAct = (action, detail) => { db.activity.push({ id: 'l-' + uid(), user: who(), action, detail, at: date() + ' ' + nowTime() }); if (db.activity.length > 500) db.activity = db.activity.slice(-500); };
  const toast = (message, type = 'ok') => { const node = document.createElement('div'); node.className = 'toast' + (type === 'error' ? ' error' : ''); node.textContent = message; $('#toast-root').append(node); setTimeout(() => node.remove(), 3500); };
  const closeModal = () => { $('#modal-root').innerHTML = ''; };
  const modal = (title, body, onSave, saveText = 'حفظ') => {
    $('#modal-root').innerHTML = `<div class="modal-backdrop"><form class="modal" id="modal-form"><div class="modal-head"><h2>${title}</h2><button type="button" class="close" data-close-modal>×</button></div>${body}<div class="modal-foot"><button type="button" class="btn btn-light" data-close-modal>إلغاء</button><button class="btn btn-primary">${saveText}</button></div></form></div>`;
    $('#modal-form').addEventListener('submit', e => { e.preventDefault(); onSave(new FormData(e.currentTarget)); });
  };
  const optionList = (items, selected, mapper = x => Array.isArray(x) ? x : [x, x]) => items.map(x => { const [v, l] = mapper(x); return `<option value="${esc(v)}" ${String(v) === String(selected) ? 'selected' : ''}>${esc(l)}</option>`; }).join('');
  const badge = (text, type = 'neutral') => `<span class="badge ${type}">${esc(text)}</span>`;
  const btn = (text, action, id = '', style = 'action', title = '') => `<button type="button" class="${style}" data-action="${action}" data-id="${id}" title="${title}">${text}</button>`;
  const field = (name, label, value = '', type = 'text', required = false, attrs = '') => `<div class="field"><label>${label}${required ? ' <span class="required">*</span>' : ''}</label><input ${attrs} type="${type}" name="${name}" value="${esc(value)}" ${required ? 'required' : ''}></div>`;
  const selectField = (name, label, options, value = '', required = false, attrs = '', mapper) => `<div class="field"><label>${label}${required ? ' <span class="required">*</span>' : ''}</label><select name="${name}" ${attrs} ${required ? 'required' : ''}>${optionList(options, value, mapper)}</select></div>`;
  const checkField = (name, label, checked) => `<label class="check"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}> ${label}</label>`;
  const groupOptionsFor = stageName => myGroups().filter(g => !stageName || g.stage === stageName).map(g => [g.id, `${g.name} — المتبقي ${Math.max(0, g.capacity - db.students.filter(s => s.groupIds.includes(g.id) && s.status === 'active').length)}`]);
  /* حقول نماذج التسجيل — الأدارة تحدد ما يظهر */
  const cfgFields = role => (db.formFields[role] || []).filter(f => f.enabled);
  function cfgInput(f, val, extra = '') {
    if (f.type === 'textarea') return `<div class="field"><label>${esc(f.label)}${f.required ? ' <span class="required">*</span>' : ''}</label><textarea name="${esc(f.key)}" ${f.required ? 'required' : ''} ${extra}>${esc(val ?? '')}</textarea></div>`;
    if (f.type === 'select' && f.options) return selectField(f.key, f.label, f.options, val ?? '', f.required);
    return field(f.key, f.label, val ?? '', f.type || 'text', f.required, extra);
  }

  /* ===== أدوات التصدير والطباعة وواتساب ===== */
  function exportCSV(name, headers, rows) {
    const line = a => a.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
    const blob = new Blob(['\ufeff' + [line(headers), ...rows.map(line)].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `${name}-${date()}.csv`; link.click(); URL.revokeObjectURL(url);
    toast('تم تنزيل ملف CSV يفتح مباشرة في Excel بالعربية.');
  }
  function printDoc(title, body, script = 'setTimeout(function(){window.print();},400);') {
    const w = window.open('', '_blank');
    if (!w) return toast('فضلاً اسمح بالنوافذ المنبثقة لطباعة المستند.', 'error');
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      body{font-family:Cairo,Tahoma,Arial,sans-serif;padding:26px;color:#17203a}
      .doc-head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #1565d8;padding-bottom:10px;margin-bottom:16px}
      .doc-head h1{margin:0;font-size:20px}.meta{color:#5d6b8a;font-size:12px}
      table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:10px}
      th,td{border:1px solid #c7d2e4;padding:6px 8px;text-align:right}th{background:#eaf1fb}
      tfoot td{background:#f3f7fd;font-weight:800}
      .sig{margin-top:30px;display:flex;gap:48px;font-size:12px;color:#44536e}.sig div{border-top:1px solid #9aa7c0;padding-top:6px;width:170px;text-align:center}
      .barcode-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
      .barcode-card{border:1px dashed #98a6c2;border-radius:8px;padding:10px;text-align:center;page-break-inside:avoid}
      .barcode-card b{font-size:13px}.barcode-card .code{font-size:16px;letter-spacing:2px;font-weight:800;margin:2px 0 6px}
      .id-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
      .id-card{border:1px solid #b9c6dd;border-radius:10px;padding:10px;text-align:center;page-break-inside:avoid}
      .ic-head{background:#1565d8;color:#fff;border-radius:8px;padding:4px;font-size:12px;font-weight:800}
      .ic-name{font-weight:800;margin-top:6px}.ic-meta{font-size:11px;color:#44536e}
      .ic-qr{display:flex;justify-content:center;min-height:80px;margin-top:6px}.ic-code{letter-spacing:3px;font-weight:800;margin-top:4px}
      .print-btn{position:fixed;top:14px;left:14px;background:#1565d8;color:#fff;border:0;border-radius:8px;padding:9px 16px;font-weight:700;cursor:pointer}
      @media print{.print-btn{display:none}}
    </style></head><body><button class="print-btn" onclick="window.print()">طباعة</button>
    <div class="doc-head"><div><h1>${esc(db.settings.centerName)}</h1><div class="meta">${esc(title)} — ${date()}</div></div><div class="meta">طُبع بواسطة: ${esc(who())}</div></div>
    ${body}
    <div class="sig"><div>مسؤول السنتر</div><div>التوقيع</div></div>
    <script>${script}<\/script></body></html>`);
    w.document.close();
  }
  const printTable = (headers, rows, foot = []) => `<table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${headers.length}">لا توجد بيانات.</td></tr>`}</tbody>${foot.length ? `<tfoot><tr>${foot.map(c => `<td>${esc(c)}</td>`).join('')}</tfoot>` : ''}</table>`;
  const waPhone = p => { let d = String(p || '').replace(/\D/g, ''); if (!d) return ''; if (d.startsWith('0')) d = '20' + d.slice(1); if (!d.startsWith('20')) d = '20' + d; return d; };
  const waLink = (phone, text) => `https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(text)}`;
  function copyText(t) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(t);
    const ta = document.createElement('textarea'); ta.value = t; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); } catch {} ta.remove(); return Promise.resolve();
  }
  function notificationResults(messages) {
    if (!messages.length) return;
    modal(`تجهيز ${messages.length} رسالة`, `<div class="notice">زر «واتساب» يفتح محادثة جاهزة بالرسالة لكل مستلم، وزر النسخ ينسخ كل الرسائل دفعة واحدة للصقها في أي قناة.</div><ul class="list">${messages.map(m => `<li><span><b>${esc(m.name)}</b><br><small>${esc(m.phone || 'لا يوجد رقم هاتف')}</small></span><a class="btn btn-sm btn-success" target="_blank" rel="noopener" href="${waLink(m.phone, m.text)}">واتساب</a></li>`).join('')}</ul>`,
      () => { copyText(messages.map(m => m.text).join('\n---\n')).then(() => toast('تم نسخ كل الرسائل إلى الحافظة.')).catch(() => toast('تعذر النسخ إلى الحافظة.', 'error')); closeModal(); }, 'نسخ الرسائل كلها');
  }

  /* ===== الاشتراكات ===== */
  const subBadge = endDate => { const d = subDays(endDate); return d < 0 ? badge('منتهي', 'danger') : d <= 3 ? badge('متبقي ' + d + ' أيام', 'danger') : d <= 14 ? badge('متبقي ' + d + ' يوم', 'warning') : badge('متبقي ' + d + ' يوم', 'success'); };
  function renewModal(kind, id) {
    const ent = find(kind === 'teacher' ? 'teachers' : kind === 'owner' ? 'owners' : 'supervisors', id);
    if (!ent) return;
    const kindLabel = kind === 'teacher' ? 'معلم' : kind === 'owner' ? 'صاحب سنتر' : 'مشرف';
    modal(`تجديد الاشتراك — ${esc(ent.name)}`, `<div class="notice">الاشتراك الحالي حتى: <b>${esc(ent.subscriptionEnd)}</b> — ${subDays(ent.subscriptionEnd) < 0 ? 'منتهي' : 'متبقي ' + subDays(ent.subscriptionEnd) + ' يوم'}.</div><div class="form-grid">${selectField('months', 'مدة التجديد (تُضاف على المتبقي)', [['1', 'شهر'], ['3', '3 شهور'], ['6', '6 شهور'], ['12', 'سنة كاملة']], '1')}${field('until', 'أو تاريخ انتهاء محدد (يُلغي المدة)', '', 'date')}</div>`, data => {
      const until = data.get('until');
      const base = ent.subscriptionEnd && subDays(ent.subscriptionEnd) > 0 ? ent.subscriptionEnd : date();
      ent.subscriptionEnd = until || addMonthsDate(base, Number(data.get('months') || 1));
      logAct('تجديد اشتراك', `${ent.name} (${kindLabel}) — حتى ${ent.subscriptionEnd}`);
      save(); closeModal(); render(); toast(`تم تجديد اشتراك ${ent.name} حتى ${ent.subscriptionEnd}.`);
    });
  }

  /* ===== بوابة الاشتراك: انتهاء اشتراك المعلم المفرد أو صاحب السنتر يوقف الموقع عن الجميع تحته ===== */
  function subscriptionGateBlocked() {
    if (!isCenter()) return false;
    const owners = db.owners || [];
    return owners.length > 0 && owners.every(o => o.subscriptionEnd && subDays(o.subscriptionEnd) < 0);
  }
  function centerGateMsg() { return 'انتهى اشتراك السنتر — الدخول متوقف مؤقتاً. راجع مدير النظام للتجديد.'; }
  function studentAccessBlocked(s) {
    if (subscriptionGateBlocked()) return true;
    if (isCenter()) return false;
    const tids = new Set([...(s.teacherIds || [])]);
    (s.groupIds || []).forEach(gid => (find('groups', gid)?.teacherIds || []).forEach(t => tids.add(t)));
    const ts = [...tids].map(id => find('teachers', id)).filter(Boolean);
    return ts.length > 0 && ts.every(t => t.subscriptionEnd && subDays(t.subscriptionEnd) < 0);
  }
  function supervisorAccessBlocked(sp) {
    if (sp.subscriptionEnd && subDays(sp.subscriptionEnd) < 0) return 'انتهت فترة اشتراكك — راجع الإدارة للتجديد.';
    if (isCenter()) { if (subscriptionGateBlocked()) return centerGateMsg(); }
    else { const t = find('teachers', sp.teacherId); if (t && t.subscriptionEnd && subDays(t.subscriptionEnd) < 0) return 'انتهى اشتراك المعلم المسؤول عنك — الدخول متوقف مؤقتاً.'; }
    return '';
  }
  function staffAccessBlocked(st) {
    if (st.subscriptionEnd && subDays(st.subscriptionEnd) < 0) return 'انتهت فترة اشتراكك — راجع الإدارة.';
    if (isCenter() && subscriptionGateBlocked()) return centerGateMsg();
    return '';
  }

  /* ===== التنبيهات ===== */
  function alertCounts() {
    const limit = Number(db.settings.absenceLimit || 3);
    return {
      students: activeStudents().filter(s => studentDue(s) > 0).length,
      attendance: activeStudents().filter(s => db.attendance.filter(x => x.studentId === s.id && x.status === 'absent').length >= limit).length,
      exams: db.exams.filter(e => e.status === 'open' && e.date >= date() && e.date <= dateAfter(7)).length
    };
  }

  /* ===== القائمة والتخطيط ===== */
  const ALLNAV = [
    ['dashboard', '▦', 'الرئيسية', 'dashboard.view'], ['students', '♟', 'الطلاب', 'students.view'], ['teachers', '♙', 'المعلمون', 'teachers.view'], ['supervisors', '֎', 'المشرفون', 'supervisors.view'], ['staff', '☕', 'الموظفون', 'staff.view'], ['venues', '🏠', 'مقرات الدروس', 'venues.view'], ['groups', '☷', 'المجموعات', 'groups.view'], ['attendance', '✓', 'الغياب والحضور', 'attendance.view'], ['exams', '▤', 'الاختبارات', 'exams.view'], ['finance', '₪', 'الأموال والحسابات', 'finance.view'], ['reports', '◫', 'التقارير', 'reports.view'], ['books', '▣', 'الكتب', 'books.view'], ['prints', '▤', 'المطبوعات', 'prints.view'], ['notifications', '♧', 'الإشعارات', 'notifications.view'], ['settings', '⚙', 'الإعدادات', 'settings.view'], ['users', '♚', 'الحسابات والأدوار', 'users.view']
  ];
  function navFor() {
    const k = session?.kind;
    if (k === 'admin' || k === 'owner') return ALLNAV;
    if (k === 'staff') return ALLNAV.filter(x => can(x[3]));
    if (k === 'teacher') {
      if (isCenter()) {
        /* معلم موظف في السنتر: يرى طلابه وحصصه وراتبه فقط — لا يدير مشرفين أو مجموعات أو أموال السنتر */
        return [['dashboard', '▦', 'الرئيسية'], ['students', '♟', 'طلابي'], ['groups', '☷', 'مجموعاتي'], ['attendance', '✓', 'الغياب والحضور'], ['exams', '▤', 'الاختبارات'], ['reports', '◫', 'تقاريري'], ['prints', '▤', 'المطبوعات'], ['notifications', '♧', 'الإشعارات']];
      }
      return [['dashboard', '▦', 'الرئيسية'], ['students', '♟', 'الطلاب'], ['groups', '☷', 'مجموعاتي'], ['supervisors', '֎', 'المشرفون'], ['staff', '☕', 'الموظفون'], ['venues', '🏠', 'مقرات الدروس'], ['attendance', '✓', 'الغياب والحضور'], ['exams', '▤', 'الاختبارات'], ['finance', '₪', 'الأموال وطرق الدفع'], ['reports', '◫', 'التقارير'], ['prints', '▤', 'المطبوعات'], ['notifications', '♧', 'الإشعارات']];
    }
    if (k === 'supervisor') return [['dashboard', '▦', 'الرئيسية'], ['groups', '☷', 'مجموعاتي'], ['students', '♟', 'طلاب مجموعاتي'], ['attendance', '✓', 'الغياب والحضور'], ['reports', '◫', 'تقاريري']];
    if (k === 'employee') return [['dashboard', '▦', 'الرئيسية']];
    return [];
  }
  function layout(content) {
    const items = navFor();
    const alerts = alertCounts();
    const navBadge = id => alerts[id] ? `<span class="nav-badge">${alerts[id]}</span>` : '';
    const kindLabel = { admin: 'مدير النظام', owner: 'صاحب السنتر', staff: find('roles', find('users', session.id)?.roleId)?.name || 'موظف', teacher: isCenter() ? 'معلم' : 'معلم (صاحب المركز)', supervisor: 'مشرف', employee: find('staff', session.id)?.jobTitle || 'موظف' }[session.kind] || '';
    let timer = '';
    if (session.kind === 'teacher' || session.kind === 'supervisor' || session.kind === 'owner') {
      const end = session.kind === 'teacher' ? sessionTeacher()?.subscriptionEnd : session.kind === 'owner' ? find('owners', session.id)?.subscriptionEnd : sessionSupervisor()?.subscriptionEnd;
      if (end) { const d = subDays(end); const cls = d < 0 ? 'danger' : d <= 3 ? 'danger' : d <= 14 ? 'warn' : ''; timer = `<div class="sub-timer ${cls}">⏳ صلاحية وصولك: ${d < 0 ? 'منتهية — راجع الإدارة' : d + ' يوم متبقٍ'}</div>`; }
    }
    return `<div class="app-shell ${db.settings.dark ? 'dark' : ''}"><aside class="sidebar" id="sidebar"><div class="brand"><div class="brand-mark">▣</div><div><b>${esc(db.settings.centerName)}</b><small>${esc(kindLabel)} — ${esc(who())}</small></div></div>${timer}<div class="nav-label">القائمة الرئيسية</div>${items.map(([id, icon, title]) => `<button class="nav-item ${page === id ? 'active' : ''}" data-page="${id}"><span class="nav-icon">${icon}</span>${title}${navBadge(id)}</button>`).join('')}<div class="nav-label">الحساب</div><button class="nav-item" data-action="logout"><span class="nav-icon">⇥</span>تسجيل الخروج</button></aside><section class="content-wrap"><header class="topbar"><button class="icon-btn mobile-toggle" data-action="toggle-sidebar">☰</button><div class="student-search"><span>⌕</span><input id="global-code" placeholder="ابحث عن كود طالب…" inputmode="numeric"></div><button class="icon-btn" data-action="theme" title="وضع فاتح/داكن">◐</button><button class="icon-btn" data-action="print" title="طباعة">▤</button><button class="icon-btn" data-action="support" title="الدعم الفني">؟</button><div class="spacer"></div><div class="user-pill"><div class="avatar">${esc((who()[0] || '؟'))}</div><div><b>${esc(who())}</b><small>${esc(kindLabel)}</small></div></div></header><main class="main">${content}</main></section></div>`;
  }
  function viewerLayout(content) {
    const portalTitle = session.kind === 'guardian' ? 'بوابة ولي الأمر' : 'بوابة الطالب';
    const pillLabel = session.kind === 'guardian' ? 'ولي الأمر' : 'الطالب';
    return `<div class="app-shell ${db.settings.dark ? 'dark' : ''}" style="grid-template-columns:1fr"><section class="content-wrap"><header class="topbar"><div class="brand" style="border:0;padding:0;margin:0"><div class="brand-mark" style="width:36px;height:36px;font-size:18px">▣</div><div><b>${esc(db.settings.centerName)}</b><small>${esc(portalTitle)}</small></div></div><div class="spacer"></div><button class="icon-btn" data-action="theme" title="وضع فاتح/داكن">◐</button><div class="user-pill"><div class="avatar">${esc((who()[0] || '؟'))}</div><div><b>${esc(who())}</b><small>${esc(pillLabel)}</small></div></div><button class="btn btn-light btn-sm" data-action="logout">خروج</button></header><main class="main">${content}</main></section></div>`;
  }
  const pageHead = (title, description, action = '') => `<div class="page-head"><div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;

  /* ===== بابة الدخول: اختيار الدور ثم الحقول التي حددها الأدمن ===== */
  let loginRole = 'admin';
  /* أدوار الدخول — صاحب السنتر يظهر في نظام السنتر فقط، والطالب مفصول عن ولي الأمر */
  const loginRolesList = () => {
    const list = [['admin', 'مدير النظام'], ['teacher', 'معلم'], ['supervisor', 'مشرف'], ['staff', 'موظف']];
    if (isCenter()) list.push(['owner', 'صاحب السنتر']);
    list.push(['student', 'طالب'], ['guardian', 'ولي الأمر']);
    return list;
  };
  const LOGIN_FIELD_LABELS = { username: 'اسم المستخدم', password: 'كلمة المرور', code: 'كود الطالب (ID)', phone: 'رقم الهاتف', spassword: 'كلمة مرور الطالب', gpassword: 'كلمة مرور ولي الأمر' };
  const loginFieldLabel = (role, k) => {
    if (role === 'guardian' && k === 'phone') return 'هاتف ولي الأمر';
    if (role === 'guardian' && k === 'code') return 'كود الطالب (ابنك)';
    return LOGIN_FIELD_LABELS[k] || k;
  };
  const LOGIN_ROLE_HINTS = {
    admin: 'دخول مدير النظام بالحقول الظاهرة هنا',
    teacher: 'دخول المعلم بالحقول الظاهرة هنا — الحقول يحددها الأدمن',
    supervisor: 'دخول المشرف بالحقول الظاهرة هنا',
    staff: 'دخول الموظف بالحقول الظاهرة هنا',
    owner: 'دخول صاحب السنتر باسم المستخدم وكلمة المرور — وعند انتهاء اشتراكه يتوقف دخول الجميع',
    student: 'الطالب يدخل بكود الطالب وكلمة مرور الطالب (إن وُجدت) — بوابة دراسية',
    guardian: 'ولي الأمر يدخل بكود الطالب أو هاتفه وكلمة مرور ولي الأمر (إن وُجدت) — بوابة متابعة تشمل المصروفات'
  };
  const loginFieldsFor = role => (db.loginFields && Array.isArray(db.loginFields[role]) && db.loginFields[role].length) ? db.loginFields[role] : defaultLoginFields()[role] || ['username', 'password'];
  function renderLogin(msg = '') {
    document.body.classList.remove('dark');
    const fields = loginFieldsFor(loginRole);
    const body = fields.map(k => {
      /* كلمة مرور الطالب/ولي الأمر اختيارية في الإدخال — إن وُجدت للطالب فلا بد من مطابقتها */
      const pwdOptional = (loginRole === 'student' || loginRole === 'guardian') && k !== 'password';
      if (k === 'password' || k === 'spassword' || k === 'gpassword') return field(k, loginFieldLabel(loginRole, k), '', 'password', !pwdOptional, 'autocomplete="current-password"' + (pwdOptional ? ' placeholder="اتركها فارغة إن لم تُحدد كلمة مرور"' : ''));
      if (k === 'code') return field('code', loginFieldLabel(loginRole, k), '', 'text', true, 'autofocus inputmode="numeric"');
      if (k === 'phone') return field('phone', loginFieldLabel(loginRole, k), '', 'tel', true, 'autofocus');
      return field(k, loginFieldLabel(loginRole, k), '', 'text', true, 'autofocus autocomplete="username"');
    }).join('');
    $('#app').innerHTML = `<div class="login-wrap"><form class="login-card" id="login-form"><div class="login-logo">▣</div><h2 style="text-align:center;margin:0 0 4px">${esc(db.settings.centerName)}</h2><p style="text-align:center;color:var(--muted);margin:0 0 12px;font-size:13px">بوابة الدخول — اختر دورك أولاً</p>${msg ? `<div class="notice">${esc(msg)}</div>` : ''}<div class="login-roles">${loginRolesList().map(([k, l]) => `<button type="button" class="chip ${loginRole === k ? 'active' : ''}" data-login-role="${k}">${l}</button>`).join('')}</div><div class="form-grid" style="grid-template-columns:1fr">${body}</div><button class="btn btn-primary" style="width:100%;margin-top:6px">دخول</button><p style="text-align:center;color:var(--muted);font-size:12px;margin:10px 0 0">${esc(LOGIN_ROLE_HINTS[loginRole] || '')}</p></form></div>`;
    $('#login-form').addEventListener('submit', e => { e.preventDefault(); submitLogin(new FormData(e.currentTarget)); });
  }
  function submitLogin(data) {
    const fields = loginFieldsFor(loginRole);
    const get = k => String(data.get(k) || '').trim();
    /* الحقول الظاهرة: المملوء يجب أن يطابق، والفارغ يُتجاهل — ويكفي تحقق حقل تعريف واحد */
    const matchIdentity = entity => {
      let any = false;
      for (const k of ['username', 'phone', 'code']) {
        if (!fields.includes(k)) continue;
        const v = get(k);
        if (!v) continue;
        any = true;
        if (k === 'username') { if (!((entity.username || entity.name) === v || ((entity.phone || '') !== '' && entity.phone === v))) return false; }
        else if ((entity[k] || '') !== v) return false;
      }
      return any;
    };
    const passOk = entity => !fields.includes('password') || (get('password') && entity.password === get('password'));
    /* بوابة الطالب — منفصلة عن ولي الأمر */
    if (loginRole === 'student' || loginRole === 'guardian') {
      const pool = db.students.filter(x => x.status === 'active');
      const s = pool.find(x => {
        let any = false;
        if (fields.includes('code') && get('code')) { any = true; if ((x.code || '') !== get('code')) return false; }
        if (fields.includes('phone') && get('phone')) { any = true; if ((loginRole === 'guardian' ? (x.parentPhone || '') : (x.phone || '')) !== get('phone')) return false; }
        return any;
      });
      if (!s) return toast(loginRole === 'guardian' ? 'لا يوجد طالب نشط بهذه بيانات ولي الأمر.' : 'لا يوجد طالب نشط بهذه البيانات.', 'error');
      if (studentAccessBlocked(s)) return toast('انتهت فترة اشتراك النظام — الدخول متوقف مؤقتاً. راجع الإدارة.', 'error');
      if (loginRole === 'student') {
        if (fields.includes('spassword') && s.password && s.password !== get('spassword')) return toast('كلمة مرور الطالب غير صحيحة.', 'error');
        setSession({ kind: 'student', ref: s.id, name: s.name });
        page = 'dashboard'; logAct('تسجيل دخول', 'بوابة الطالب — ' + s.name); save(); render();
        return;
      }
      if (fields.includes('gpassword') && s.guardianPassword && s.guardianPassword !== get('gpassword')) return toast('كلمة مرور ولي الأمر غير صحيحة.', 'error');
      setSession({ kind: 'guardian', ref: s.id, name: 'ولي أمر ' + s.name });
      page = 'dashboard'; logAct('تسجيل دخول', 'بوابة ولي الأمر — ' + s.name); save(); render();
      return;
    }
    let ent = null;
    if (loginRole === 'admin') {
      ent = db.users.find(x => x.roleId === 'manager' && matchIdentity(x));
      if (!ent) return toast('بيانات الدخول غير صحيحة لهذا الدور.', 'error');
      if (!passOk(ent)) return toast('كلمة المرور غير صحيحة.', 'error');
      setSession({ kind: 'admin', id: ent.id, name: ent.name });
      page = 'dashboard'; logAct('تسجيل دخول', ent.name); save(); render();
      return;
    }
    if (loginRole === 'owner') {
      ent = (db.owners || []).find(x => matchIdentity(x));
      if (!ent) return toast('بيانات الدخول غير صحيحة لهذا الدور.', 'error');
      if (!passOk(ent)) return toast('كلمة المرور غير صحيحة.', 'error');
      if (ent.subscriptionEnd && subDays(ent.subscriptionEnd) < 0) return toast('انتهت فترة اشتراكك — راجع مدير النظام للتجديد. لا يمكن استخدام الموقع حتى التجديد.', 'error');
      setSession({ kind: 'owner', id: ent.id, name: ent.name });
      page = 'dashboard'; logAct('تسجيل دخول', 'صاحب السنتر — ' + ent.name); save(); render();
      return;
    }
    const col = { teacher: 'teachers', supervisor: 'supervisors', staff: 'staff' }[loginRole];
    ent = db[col].find(x => matchIdentity(x));
    if (!ent) return toast('بيانات الدخول غير صحيحة لهذا الدور.', 'error');
    if (!passOk(ent)) return toast('كلمة المرور غير صحيحة.', 'error');
    if (loginRole === 'teacher') {
      if (subDays(ent.subscriptionEnd) < 0) return toast('انتهت فترة اشتراكك — راجع الإدارة للتجديد. لا يمكن استخدام الموقع حتى التجديد.', 'error');
      if (isCenter() && subscriptionGateBlocked()) return toast(centerGateMsg(), 'error');
    }
    if (loginRole === 'supervisor') {
      const blocked = supervisorAccessBlocked(ent);
      if (blocked) return toast(blocked, 'error');
    }
    if (loginRole === 'staff') {
      const blocked = staffAccessBlocked(ent);
      if (blocked) return toast(blocked, 'error');
    }
    if (loginRole === 'supervisor') {
      if (!(ent.groupIds || []).length) return toast('لم يُربط حسابك بأي مجموعة بعد — راجع المعلم المسؤول.', 'error');
      ent.attendanceLog = ent.attendanceLog || [];
      ent.attendanceLog.push({ date: date(), time: nowTime() });
      if (ent.attendanceLog.length > 200) ent.attendanceLog = ent.attendanceLog.slice(-200);
      setSession({ kind: 'supervisor', id: ent.id, name: ent.name });
      page = 'dashboard'; logAct('تسجيل دخول', 'مشرف — ' + ent.name + ' — ' + nowTime()); save(); render();
      return;
    }
    setSession({ kind: loginRole === 'staff' ? 'employee' : loginRole, id: ent.id, name: ent.name });
    page = 'dashboard'; logAct('تسجيل دخول', (loginRole === 'teacher' ? 'معلم — ' : 'موظف (' + (ent.jobTitle || 'وظيفة') + ') — ') + ent.name); save(); render();
  }

  /* ===== الرئيسية ===== */
  /* ===== لوحة الراتب الشخصية: لمعلم السنتر والمشرف والموظف — تُظهر سبب كل خصم وبونص ===== */
  /* ===== لوحة الراتب الشخصية: لمعلم السنتر والمشرف والموظف — تُظهر سبب كل خصم وبونص ===== */
  function mySalaryPanel() {
    let base = 0, adj = { bonus: 0, deduct: 0, list: [] }, paid = 0, schedule = null, log = null, kindLabel = '';
    if (session.kind === 'supervisor') {
      const sp = sessionSupervisor(); if (!sp) return '';
      base = Number(sp.salary || 0); adj = supAdjustments(sp); paid = supPaid(sp); schedule = sp.schedule; log = sp.attendanceLog; kindLabel = 'المشرف';
    } else if (session.kind === 'teacher' && isCenter()) {
      const t = sessionTeacher(); if (!t) return '';
      base = teacherDues(t); adj = personAdjustments('teacher', t.id); paid = personPaid('teacher', t.id); schedule = t.workSchedule; kindLabel = 'المعلم';
    } else if (session.kind === 'employee') {
      const st = find('staff', session.id); if (!st) return '';
      base = Number(st.salary || 0); adj = personAdjustments('staff', st.id); paid = personPaid('staff', st.id); schedule = st.schedule; kindLabel = st.jobTitle || 'الموظف';
    } else return '';
    const net = Math.max(0, base + adj.bonus - adj.deduct - paid);
    return `<section class="panel" style="margin-top:16px"><h2>📋 راتبي وتقريري الشخصي — ${month()}</h2><div class="grid stats"><div class="stat-card"><span class="label">الراتب الأساسي</span><strong>${money(base)}</strong></div><div class="stat-card"><span class="label">بونص</span><strong style="color:var(--success)">${money(adj.bonus)}</strong></div><div class="stat-card"><span class="label">خصومات</span><strong style="color:var(--danger)">${money(adj.deduct)}</strong></div><div class="stat-card"><span class="label">صافي المستحق</span><strong>${money(net)}</strong></div></div><div class="grid" style="grid-template-columns:1fr 1fr;margin-top:14px"><div><h3>تعديلات راتبي هذا الشهر (بالأسباب)</h3><ul class="list">${adj.list.map(x => `<li><span>${x.type === 'bonus' ? 'بونص' : 'خصم'} — ${esc(x.reason)}<br><small>بواسطة ${esc(x.by)}</small></span><b style="color:${x.type === 'bonus' ? 'var(--success)' : 'var(--danger)'}">${x.type === 'bonus' ? '+' : '-'}${money(x.amount)}</b></li>`).join('') || '<li>لا توجد تعديلات هذا الشهر.</li>'}</ul><h3>المحاسبة</h3><ul class="list"><li><span>المصروف لي هذا الشهر</span><b>${money(paid)}</b></li><li><span>المتبقي لي</span><b>${money(net)}</b></li></ul></div><div><h3>${session.kind === 'teacher' ? 'مواعيد حضوري الأسبوعية' : 'مواعيد حضوري المطلوبة'}</h3>${schedule && schedule.days?.length ? `<ul class="list">${schedule.days.map(d => `<li><span>${esc(d)}</span><b>${esc(schedule.time || '—')}</b></li>`).join('')}</ul>` : '<p class="empty" style="padding:10px">لم تُحدد مواعيد حضور بعد.</p>'}${log ? `<h3>آخر تسجيلات دخولي (حضور)</h3><ul class="list">${log.slice(-8).reverse().map(l => `<li><span>${esc(l.date)}</span><b>${esc(l.time)}</b></li>`).join('') || '<li>لا يوجد سجل بعد.</li>'}</ul>` : ''}</div></div></section>`;
  }
  /* مواعيد حصص المعلم من مجموعاته */
  function mySessionsPanel() {
    const groups = myGroups(); if (!groups.length) return '';
    return `<section class="panel" style="margin-top:16px"><h2>🗓 مواعيد حصصي هذا الأسبوع</h2><div class="actions">${groups.map(g => `<span class="chip" title="${esc((g.teacherIds || []).map(teacherName).join('، '))}">${esc(g.name)} — ${esc(g.schedule || '—')}</span>`).join('')}</div></section>`;
  }
  function dashboard() {
    if (session.kind === 'employee') return pageHead(`أهلاً بك — ${esc(who())}`, 'لوحتك الشخصية: راتبك ومستحقاتك') + mySalaryPanel();
    const mine = activeStudents();
    const paidToday = db.payments.filter(p => p.createdAt === date() && !p.archived && (isStaffLevel() || mine.some(s => s.id === p.studentId))).reduce((a, p) => a + Number(p.amount), 0);
    const incomeToday = db.incomes.filter(i => i.createdAt === date()).reduce((a, i) => a + Number(i.amount), 0);
    const expenseToday = db.expenses.filter(i => i.createdAt === date()).reduce((a, i) => a + Number(i.amount), 0);
    const expected = mine.filter(s => studentPayMode(s) !== 'لا يدفع').reduce((a, s) => a + studentFee(s), 0);
    const total = mine.length;
    const stages = db.stages.map(st => ({ name: st.name, count: mine.filter(x => x.stage === st.name).length }));
    const maxCount = Math.max(1, ...stages.map(x => x.count));
    const recent = [
      ...db.payments.filter(p => !p.archived && (isStaffLevel() || mine.some(s => s.id === p.studentId))).map(p => ({ t: 'تحصيل رسوم — ' + studentName(p.studentId), d: p.createdAt, v: +p.amount, plus: true })),
      ...db.incomes.map(i => ({ t: 'دخل — ' + i.reason, d: i.createdAt, v: +i.amount, plus: true })),
      ...db.expenses.map(i => ({ t: 'مصروف — ' + i.reason, d: i.createdAt, v: +i.amount, plus: false }))
    ].sort((a, b) => b.d.localeCompare(a.d)).slice(0, 6);
    const last6 = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - 5 + i); const m = d.toISOString().slice(0, 7); return { m, net: monthNet(m).net }; });
    const maxNet = Math.max(1, ...last6.map(x => Math.abs(x.net)));
    const att7 = Array.from({ length: 7 }, (_, k) => { const ds = new Date(Date.now() - (6 - k) * 864e5).toISOString().slice(0, 10); return { ds, c: db.attendance.filter(a => a.date === ds && a.status === 'present' && (isStaffLevel() || mine.some(s => s.id === a.studentId))).length }; });
    const maxAtt = Math.max(1, ...att7.map(x => x.c));
    return pageHead('الرئيسية', session.kind === 'supervisor' ? 'لوحة المشرف — مجموعاتك وطلابها وتقريرك' : session.kind === 'teacher' ? (isCenter() ? 'لوحة المعلم — طلابك وحصصك وراتبك' : 'نظرة سريعة على طلابك ومجموعاتك') : 'نظرة سريعة على أداء السنتر اليوم') + (session.kind === 'supervisor' || (session.kind === 'teacher' && isCenter()) ? mySalaryPanel() : '') + (session.kind === 'teacher' && isCenter() ? mySessionsPanel() : '') + `<div class="grid stats"><div class="stat-card"><span class="label">الوارد اليومي</span><strong>${money(paidToday + incomeToday - expenseToday)}</strong><span class="trend">يتصفر تلقائياً يومياً</span></div><div class="stat-card"><span class="label">الوارد الشهري</span><strong>${money(db.payments.filter(p => p.period === month() && !p.archived && (isStaffLevel() || mine.some(s => s.id === p.studentId))).reduce((a, p) => a + Number(p.amount), 0))}</strong><span class="trend">رسوم محصلة هذا الشهر</span></div><div class="stat-card"><span class="label">عدد الطلاب</span><strong>${total}</strong><span class="trend">طالب في نطاقك</span></div><div class="stat-card"><span class="label">الدخل المتوقع</span><strong>${money(expected)}</strong><span class="trend">لا يمثل المقبوض فعلياً</span></div></div><div class="grid dashboard-grid" style="margin-top:16px"><section class="panel"><h2>الطلاب حسب المرحلة</h2><div class="bars">${stages.map(x => `<div class="bar" style="height:${Math.max(6, Math.round(x.count / maxCount * 100))}%" title="${esc(x.name)}: ${x.count}"><small>${esc(x.name.split(' ')[0])}</small></div>`).join('')}</div></section><section class="panel"><h2>ملخص عام</h2><ul class="list"><li><span>عمليات حضور مسجلة</span><b>${db.attendance.filter(a => a.status === 'present' && (isStaffLevel() || mine.some(s => s.id === a.studentId))).length}</b></li><li><span>درجات مرصودة</span><b>${db.exams.reduce((a, e) => a + e.grades.length, 0)}</b></li><li><span>متأخرون عن الدفع</span><b>${mine.filter(s => studentDue(s) > 0).length}</b></li></ul></section></div><div class="grid dashboard-grid" style="margin-top:16px"><section class="panel"><h2>تحصيل آخر 6 شهور</h2><div class="bars">${last6.map(x => `<div class="bar" style="height:${Math.max(6, Math.round(Math.abs(x.net) / maxNet * 100))}%;${x.net < 0 ? 'background:linear-gradient(#f08aa0,var(--danger))' : ''}" title="${x.m}: ${money(x.net)}"><small>${x.m.slice(5)}</small></div>`).join('')}</div></section><section class="panel"><h2>الحضور آخر 7 أيام</h2><div class="bars">${att7.map(x => `<div class="bar" style="height:${Math.max(6, Math.round(x.c / maxAtt * 100))}%" title="${x.ds}: ${x.c}"><small>${x.ds.slice(8)}</small></div>`).join('')}</div></section></div><div class="grid" style="grid-template-columns:1fr 1fr;margin-top:16px"><section class="panel"><h2>توزيع الطلاب</h2>${stages.map(x => `<div class="progress-row"><span>${esc(x.name)}</span><div class="progress"><i style="width:${pct(x.count, total)}%"></i></div><b>${x.count}</b></div>`).join('')}</section><section class="panel"><h2>آخر الحركات المالية</h2><ul class="list">${recent.map(r => `<li><span>${esc(r.t)}<br><small>${esc(r.d)}</small></span><b style="color:${r.plus ? 'var(--success)' : 'var(--danger)'}">${r.plus ? '+' : '−'}${money(r.v)}</b></li>`).join('') || '<li>لا توجد حركات بعد.</li>'}</ul></section></div>`;
  }

  /* ===== الطلاب ===== */
  function studentPaid(student, period = month()) { return db.payments.filter(p => p.studentId === student.id && p.period === period && !p.archived).reduce((a, p) => a + Number(p.amount), 0); }
  function studentDue(student) {
    const mode = studentPayMode(student);
    if (mode === 'لا يدفع') return 0;
    if (mode === 'بالحصة') return Math.max(0, Number(student.lessonPrice || 0) * studentMonthLessons(student) - studentPaid(student));
    return Math.max(0, studentFee(student) - studentPaid(student));
  }
  function tableToolbar(placeholder, filters = '') { return `<div class="toolbar"><div class="search"><input data-filter="table" placeholder="⌕ ${placeholder}"></div>${filters}<button class="btn btn-light btn-sm" data-action="export">تصدير Excel</button><button class="btn btn-light btn-sm" data-action="print">طباعة</button><button class="btn btn-light btn-sm" data-action="refresh">↻</button></div>`; }
  function students() {
    const PAGE = 15;
    const all = activeStudents();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE));
    if (studentsPage >= totalPages) studentsPage = totalPages - 1;
    const isCT = session.kind === 'teacher' && isCenter();
    const canEdit = (can('students.edit') || session.kind === 'teacher') && !isCT;
    const canAdd = (can('students.create') || session.kind === 'teacher') && !isCT;
    const showFees = !isCT;
    const rows = all.slice(studentsPage * PAGE, (studentsPage + 1) * PAGE).map(s => {
      const mode = studentPayMode(s);
      const dueCell = !showFees ? '' : mode === 'لا يدفع' ? '<span class="badge neutral">لا يدفع</span>' : session.kind === 'supervisor' ? (studentDue(s) ? badge('متبقي ' + money(studentDue(s)), 'warning') : badge('سدد', 'success')) : `<button class="badge ${studentDue(s) ? 'warning' : 'success'}" data-action="pay" data-id="${s.id}">${studentDue(s) ? (mode === 'بالحصة' ? 'مستحق ' + money(studentDue(s)) : 'متبقي ' + money(studentDue(s))) : 'تم الدفع'}</button>`;
      return `<tr data-search="${esc(s.name + ' ' + s.code + ' ' + s.phone)}"><td><b>${esc(s.name)}</b><br><small>${esc(s.code)}</small></td><td>${esc(s.stage)}</td><td>${esc(s.groupIds.map(groupName).join('، '))}</td><td>${esc(s.phone || '—')}</td><td>${db.attendance.filter(a => a.studentId === s.id && a.status === 'absent').length}</td>${showFees ? `<td>${dueCell}</td>` : ''}<td><div class="actions">${btn('عرض', 'student-file', s.id)}${canEdit ? btn('✎', 'edit-student', s.id) : ''}${canEdit ? btn('⌫', 'archive-student', s.id) : ''}</div></td></tr>`;
    }).join('');
    const pager = totalPages > 1 ? `<div class="pager">${btn('السابق', 'students-prev', '', 'btn btn-light btn-sm', '')}<span>صفحة ${studentsPage + 1} من ${totalPages} — ${all.length} طالب</span>${btn('التالي', 'students-next', '', 'btn btn-light btn-sm', '')}</div>` : '';
    return pageHead(session.kind === 'supervisor' ? 'طلاب مجموعاتي' : 'الطلاب', session.kind === 'teacher' ? 'طلاب مجموعاتك أو المرتبطون بك فقط — لا ترى طلاب معلم آخر' : 'إدارة بيانات الطلاب والرسوم والسجل', `<div class="actions">${session.kind === 'teacher' || isStaffLevel() ? `<button class="btn btn-light" data-action="view-archive">🗄 الأرشيف (${archivedList().length})</button>` : ''}${isStaffLevel() ? `<button class="btn btn-light" data-action="import-students">⇪ استيراد CSV</button>` : ''}${canAdd ? `<button class="btn btn-primary" data-action="add-student">＋ إضافة طالب</button>` : ''}</div>`) + tableToolbar('ابحث بالاسم أو الكود أو الهاتف', `${selectField('stage-filter', '', ['الكل', ...db.stages.map(s => s.name)], 'الكل', false, 'data-stage-filter')}`) + `<div class="table-wrap"><table><thead><tr><th data-sortable>الطالب ↕</th><th data-sortable>المرحلة ↕</th><th>المجموعات</th><th>الهاتف</th><th data-sortable>غيابات ↕</th>${showFees ? '<th data-sortable>حالة المصروفات ↕</th>' : ''}<th>إجراءات</th></tr></thead><tbody>${rows || `<tr><td colspan="${showFees ? 7 : 6}" class="empty">لا يوجد طلاب في نطاقك</td></tr>`}</tbody></table></div>${pager}`;
  }
  function studentForm(student = {}) {
    const initialStage = student.stage || db.stages[0]?.name;
    let groupOptions = groupOptionsFor(initialStage);
    if (!db.settings.multiGroup && student.groupIds?.[0] && !groupOptions.some(o => o[0] === student.groupIds[0])) groupOptions.unshift([student.groupIds[0], groupName(student.groupIds[0]) + ' — (المجموعة الحالية)']);
    if (!groupOptions.length) groupOptions.push(['', session.kind === 'teacher' ? 'لا توجد مجموعات لك في هذه المرحلة — أضف واحدة أولاً' : 'لا توجد مجموعات في هذه المرحلة — أضف واحدة أولاً']);
    const multi = !!db.settings.multiGroup;
    const groupFieldHTML = opts => multi
      ? `<div class="field"><label>المجموعات <span class="required">*</span></label><div class="permission-grid">${opts.filter(o => o[0]).map(o => `<label><input type="checkbox" name="groupIds" value="${esc(o[0])}" ${(student.groupIds || []).includes(o[0]) ? 'checked' : ''}> ${esc(o[1])}</label>`).join('') || '<span class="empty" style="padding:8px">لا توجد مجموعات متاحة لك.</span>'}</div></div>`
      : selectField('groupId', 'المجموعة', opts, student.groupIds?.[0] || opts[0]?.[0], true);
    const body = cfgFields('student').map(f => {
      if (f.key === 'stage') return selectField('stage', f.label, db.stages.map(s => s.name), initialStage, f.required) + `<div id="group-wrap" style="grid-column:1/-1">${groupFieldHTML(groupOptions)}</div>`;
      if (f.key === 'gender') return selectField('gender', f.label, ['ذكر', 'أنثى'], student.gender || 'ذكر', f.required);
      if (f.key === 'paymentMode') return selectField('paymentMode', f.label, ['شهري', 'بالحصة', 'لا يدفع'], studentPayMode(student), f.required);
      if (f.key === 'code') return field('code', f.label, student.code || String(1000 + db.students.length + 1), 'text', f.required);
      if (f.key === 'spassword') return field('spassword', f.label, student.password || '', 'text', f.required, 'placeholder="اتركها فارغة ليدخل الطالب بالكود فقط"');
      if (f.key === 'gpassword') return field('gpassword', f.label, student.guardianPassword || '', 'text', f.required, 'placeholder="كلمة مرور منفصلة لولي الأمر — فارغة = يدخل بالكود/الهاتف فقط"');
      return cfgInput(f, f.custom ? student.custom?.[f.key] : student[f.key]);
    }).join('');
    const teachersField = session.kind === 'admin' ? `<div class="field" style="grid-column:1/-1"><label>المعلمون المرتبطون بالطالب (يمكن ربطه بأكثر من معلم)</label><div class="permission-grid">${db.teachers.map(t => `<label><input type="checkbox" name="teacherIds" value="${esc(t.id)}" ${(student.teacherIds || []).includes(t.id) ? 'checked' : ''}> ${esc(t.name)}</label>`).join('') || '<span class="empty" style="padding:8px">لا يوجد معلمون — أضف معلماً أولاً.</span>'}</div></div>` : '';
    modal(student.id ? 'تعديل طالب' : 'تسجيل طالب جديد', `<div class="form-grid">${body}${teachersField}</div><div class="notice">دخول الطالب منفصل عن دخول ولي الأمر: الطالب بكوده وكلمة مرور الطالب، وولي الأمر بكود الطالب أو هاتفه وكلمة مرور ولي الأمر. الحقول الظاهرة يحددها الأدمن من: الإعدادات ← نماذج التسجيل.</div>`, data => {
      const groupIds = multi ? data.getAll('groupIds') : [data.get('groupId')];
      const item = { ...student, id: student.id || `s-${uid()}`, groupIds: groupIds.filter(Boolean), status: 'active', createdAt: student.createdAt || date(), custom: { ...(student.custom || {}) } };
      cfgFields('student').forEach(f => {
        if (f.key === 'stage') { item.stage = data.get('stage'); return; }
        if (f.key === 'gender') { item.gender = data.get('gender'); return; }
        if (f.key === 'paymentMode') { item.paymentMode = data.get('paymentMode'); return; }
        if (f.key === 'code') { item.code = data.get('code'); return; }
        if (f.key === 'spassword') { item.password = String(data.get('spassword') || '').trim(); return; }
        if (f.key === 'gpassword') { item.guardianPassword = String(data.get('gpassword') || '').trim(); return; }
        const v = data.get(f.key);
        if (f.custom) item.custom[f.key] = v || '';
        else if (f.type === 'number') item[f.key] = Number(v || 0);
        else item[f.key] = v ?? '';
      });
      if (!item.groupIds.length) return toast('اختر مجموعة واحدة على الأقل.', 'error');
      if (!item.name) return toast('حقل الاسم مطلوب.', 'error');
      if (db.students.some(s => s.code === item.code && s.id !== item.id)) return toast('كود الطالب مستخدم بالفعل.', 'error');
      let teacherIds = data.getAll('teacherIds').filter(Boolean);
      if (session.kind === 'teacher' && !teacherIds.includes(session.id)) teacherIds.push(session.id);
      item.teacherIds = [...new Set([...(student.teacherIds || []), ...teacherIds])];
      const isNew = !student.id;
      if (isNew) {
        item.registeredBy = who();
        const n = Math.min(12, Math.max(1, Number(data.get('installments') || 1)));
        if (n > 1 && studentPayMode(item) === 'شهري') {
          const per = Math.floor(item.fee / n); let rem = item.fee - per * n;
          item.installments = Array.from({ length: n }, (_, i) => ({ id: 'in-' + uid(), amount: per + (i === n - 1 ? rem : 0), month: addMonths(month(), i), paid: false }));
        } else item.installments = [];
      }
      if (student.id) Object.assign(student, item); else db.students.push(item);
      logAct(student.id ? 'تعديل طالب' : 'إضافة طالب', item.name + ' (' + item.code + ')');
      save(); closeModal(); render(); toast(student.id ? 'تم تعديل الطالب بنجاح.' : 'تمت إضافة الطالب بنجاح.');
      if (isNew && db.settings.welcome && (item.parentPhone || item.phone)) notificationResults([{ name: item.name + ' — رسالة ترحيب', phone: item.parentPhone || item.phone, text: `أهلاً بكم في ${db.settings.centerName} 🎓 تم تسجيل ${item.name} بنجاح. كود الدخول: ${item.code}. شكراً لثقتكم.` }]);
    });
    const form = $('#modal-form'), stageSel = form?.querySelector('[name="stage"]');
    if (stageSel) stageSel.addEventListener('change', () => {
      const feeInput = form.querySelector('[name="fee"]');
      if (feeInput) feeInput.value = stageFee(stageSel.value) ?? db.settings.monthlyFee;
      const opts = groupOptionsFor(stageSel.value);
      if (!opts.length) opts.push(['', 'لا توجد مجموعات متاحة لك في هذه المرحلة']);
      const wrap = form.querySelector('#group-wrap');
      if (wrap) wrap.innerHTML = groupFieldHTML(opts);
    });
  }
  function studentPayMethods(s) {
    const tids = new Set([...(s.teacherIds || [])]);
    s.groupIds.forEach(gid => { const g = find('groups', gid); (g?.teacherIds || []).forEach(t => tids.add(t)); });
    const out = [], seen = new Set();
    tids.forEach(tid => (find('teachers', tid)?.payMethods || []).forEach(m => {
      const key = m.name + '|' + m.kind + '|' + (m.destination || '');
      if (seen.has(key)) return; seen.add(key);
      out.push({ ...m, teacher: teacherName(tid) });
    }));
    if (!out.length) out.push({ id: 'manual', name: 'نقدي (يدوي)', kind: 'manual', destination: '', teacher: '—' });
    return out;
  }
  function studentFile(id) {
    const s = find('students', id); const isCT = session.kind === 'teacher' && isCenter();
    const pays = db.payments.filter(p => p.studentId === id && !p.archived); const records = db.attendance.filter(a => a.studentId === id).sort((a, b) => b.date.localeCompare(a.date)); const grades = db.exams.flatMap(e => e.grades.filter(g => g.studentId === id).map(g => ({ ...g, exam: e.name, date: e.date })));
    const tabs = isCT ? [['basic', 'بيانات أساسية'], ['grades', 'الدرجات'], ['absence', 'الحضور والغياب']] : [['basic', 'بيانات أساسية'], ['money', 'المصروفات'], ['grades', 'الدرجات'], ['absence', 'الغياب']];
    modal(`ملف الطالب — ${esc(s.name)}`, `<div class="tabs">${tabs.map(([k, l], i) => `<button type="button" class="tab ${i ? '' : 'active'}" data-file-tab="${k}">${l}</button>`).join('')}</div>
    <div class="file-section active" data-file-section="basic"><div class="form-grid"><div class="card" style="padding:14px"><b>المجموعة</b><p>${esc(s.groupIds.map(groupName).join('، '))}</p><b>المعلمون</b><p>${esc([...new Set([...(s.teacherIds || []), ...s.groupIds.flatMap(g => find('groups', g)?.teacherIds || [])])].map(teacherName).join('، ') || '—')}</p><b>الكود</b><p>${esc(s.code)}</p><b>حماية الدخول</b><p>${s.password ? badge('طالب بكلمة مرور', 'success') : badge('طالب بالكود فقط', 'neutral')} ${s.guardianPassword ? badge('ولي أمر بكلمة مرور', 'success') : badge('ولي أمر بدون كلمة مرور', 'warning')}</p><b>سجَّله</b><p>${esc(s.registeredBy || '—')}</p><b>المرحلة</b><p>${esc(s.stage)}</p><b>تاريخ التقديم</b><p>${esc(s.createdAt)}</p></div><div class="card" style="padding:14px"><b>مؤشرات الطالب</b><p>عدد الغيابات: ${records.filter(r => r.status === 'absent').length}</p><p>إجمالي الدرجات: ${grades.length}</p>${isCT ? '' : `<p>الرسوم الشهرية: ${money(studentFee(s))}</p><p>المتبقي هذا الشهر: ${money(studentDue(s))}</p>`}<p>ملاحظة: ${esc(s.note || '—')}</p></div></div></div>
    ${isCT ? '' : `<div class="file-section" data-file-section="money"><div class="notice">الرسوم الشهرية ${money(studentFee(s))} — المدفوع هذا الشهر ${money(studentPaid(s))} — المتبقي ${money(studentDue(s))}</div>${(s.installments || []).length ? `<h3>خطة الأقساط</h3><ul class="list">${s.installments.map(i => `<li><span>قسط ${esc(i.month)}</span><span>${i.paid ? badge('مدفوع', 'success') : (session.kind !== 'supervisor' ? btn('تحصيل ' + money(i.amount), 'pay-installment', s.id + '::' + i.id, 'btn btn-sm btn-primary') : badge('غير مدفوع', 'warning'))}</span></li>`).join('')}</ul>` : ''}<h3>سجل الدفعات (المصدر والمحصِّل)</h3><ul class="list">${pays.map(p => `<li><span>${esc(p.period)} — ${esc(p.method || 'يدوي')}${p.kind === 'transfer' ? ' → ' + esc(p.destination || '') : ''}<br><small>حصّله: ${esc(p.collectedBy || p.receivedBy || '—')} — ${esc(p.createdAt)}</small></span><b>${money(p.amount)}</b></li>`).join('') || '<li>لا توجد دفعات بعد.</li>'}</ul>${session.kind !== 'supervisor' ? `<button type="button" class="btn btn-primary btn-sm" data-action="pay" data-id="${s.id}">تحصيل دفعة</button>` : ''}</div>`}
    <div class="file-section" data-file-section="grades"><h3>سجل الدرجات</h3><ul class="list">${grades.map(g => `<li><span>${esc(g.exam)}<br><small>${esc(g.date)}</small></span><b>${g.score}/${g.max} (${pct(g.score, g.max)}%)</b></li>`).join('') || '<li>لا توجد درجات بعد.</li>'}</ul></div>
    <div class="file-section" data-file-section="absence"><h3>سجل الحضور والغياب</h3><ul class="list">${records.map(r => `<li><span>${esc(r.date)} — ${esc(groupName(r.groupId))}${r.makeup ? ' ' + badge('تعويض', 'info') : ''}</span>${badge(r.status === 'present' ? 'حاضر ' + (r.time || '') : 'غائب', r.status === 'present' ? 'success' : 'danger')}</li>`).join('') || '<li>لا توجد سجلات بعد.</li>'}</ul></div>`, () => closeModal(), 'إغلاق');
  }
  function archiveView() {
    modal('أرشيف الطلاب', `<div class="table-wrap"><table><thead><tr><th>الطالب</th><th>سبب الأرشفة</th><th>تاريخ الأرشفة</th><th></th></tr></thead><tbody>${archivedList().map(s => { const meta = db.archivedStudents.find(x => x.id === s.id); return `<tr><td><b>${esc(s.name)}</b><br><small>${esc(s.code)}</small></td><td>${esc(meta?.reason || '—')}</td><td>${esc(meta?.archivedAt || '—')}</td><td>${btn('استعادة', 'restore-student', s.id, 'btn btn-sm btn-success')}</td></tr>`; }).join('') || '<tr><td colspan="4" class="empty">الأرشيف فارغ.</td></tr>'}</tbody></table></div>`, () => closeModal(), 'إغلاق');
  }
  function paymentForm(id) {
    const s = find('students', id); if (!canTouchStudent(s)) return toast('لا تملك صلاحية التحصيل من هذا الطالب.', 'error');
    const due = studentDue(s);
    const methods = studentPayMethods(s);
    modal(`تحصيل مصروفات — ${esc(s.name)}`, `<div class="notice">المستحق لشهر ${month()}: <b>${money(due)}</b>. سيُسجل التحصيل باسم: <b>${esc(who())}</b> ويمكن مراجعته لاحقاً من تقرير مصادر التحصيل.</div><div class="form-grid">${field('amount', 'المبلغ المسدد', due, 'number', true, 'min="1"')}${selectField('method', 'طريقة الدفع', methods.map(m => [m.id, m.name + (m.kind === 'transfer' ? ' — تحويل' : '')]), methods[0]?.id, true)}${field('period', 'الشهر', month(), 'month', true)}</div><div id="pm-dest"></div>`, data => {
      const amount = Number(data.get('amount')); if (!amount) return toast('أدخل مبلغاً صحيحاً.', 'error');
      const m = methods.find(x => x.id === data.get('method')) || methods[0];
      db.payments.push({ id: 'p-' + uid(), studentId: id, amount, due: studentFee(s), period: data.get('period'), receivedBy: who(), collectedBy: who(), method: m.name, kind: m.kind, destination: m.destination || '', createdAt: date(), archived: false });
      logAct('تحصيل دفعة', `${s.name} — ${money(amount)} — ${m.name}${m.kind === 'transfer' ? ' → ' + m.destination : ''}`);
      save(); closeModal(); render(); toast(`تم تسجيل دفعة ${money(amount)} (${m.name}).`);
      if (db.settings.printReceipt) printDoc(`إيصال تحصيل — ${s.name}`, printTable(['البيان', 'القيمة'], [['اسم الطالب', s.name], ['الكود', s.code], ['المبلغ المسدد', money(amount)], ['طريقة الدفع', m.name + (m.kind === 'transfer' ? ' → ' + m.destination : '')], ['الشهر', data.get('period')], ['تاريخ السداد', date()], ['حصّله', who()]]));
      if (db.settings.feeNotify && (s.parentPhone || s.phone)) notificationResults([{ name: s.name + ' — ولي الأمر', phone: s.parentPhone || s.phone, text: `تم استلام ${money(amount)} من مصروفات ${s.name} لشهر ${data.get('period')} (${m.name}). شكراً لكم — ${db.settings.centerName}` }]);
    }, 'تحصيل');
    const sel = $('#modal-form [name="method"]');
    const destBox = () => { const m = methods.find(x => x.id === sel.value); $('#pm-dest').innerHTML = m && m.kind === 'transfer' ? `<div class="notice">تحويل إلى: <b>${esc(m.destination || 'غير محدد')}</b>${m.teacher && m.teacher !== '—' ? ' — حساب المعلم ' + esc(m.teacher) : ''}</div>` : ''; };
    if (sel) { sel.addEventListener('change', destBox); destBox(); }
  }
  function importStudentsModal() {
    modal('استيراد طلاب من CSV', `<div class="notice">الأعمدة: الاسم، الكود، المرحلة، هاتف الطالب، هاتف ولي الأمر، المصروف. المرحلة يجب أن تكون من مراحل النظام. الأكواد المكررة أو الفارغة تُولَّد تلقائياً.${session.kind === 'teacher' ? ' سيتم ربط الطلاب المستوردين بمجموعتك الأولى تلقائياً.' : ''}</div><div class="actions" style="margin-bottom:10px"><button type="button" class="btn btn-light btn-sm" data-action="import-template">⇩ تنزيل قالب جاهز</button></div><div class="field"><label>الصق البيانات (CSV) هنا أو اختر ملفاً</label><textarea id="import-text" name="import-text" required placeholder="الاسم,الكود,المرحلة,هاتف الطالب,هاتف ولي الأمر,المصروف&#10;محمد علي,,الثالثة الثانوية,0100,,200"></textarea></div><div class="field"><label>أو اختر ملف CSV</label><input type="file" id="import-file" accept=".csv,text/csv"></div>`, data => {
      const text = data.get('import-text') || '';
      if (!String(text).trim()) return toast('لا توجد بيانات للاستيراد.', 'error');
      importStudents(String(text));
    }, 'استيراد');
    $('#import-file')?.addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { $('#import-text').value = reader.result; toast('تم قراءة الملف — راجع البيانات ثم اضغط استيراد.'); };
      reader.readAsText(file, 'utf-8');
    });
  }
  function parseCSV(text) {
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r') cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(c => String(c).trim() !== ''));
  }
  function importStudents(text) {
    const rows = parseCSV(text);
    if (rows.length < 2) return toast('البيانات فارغة أو لا توجد صفوف بعد العنوان.', 'error');
    const H = rows[0].map(h => h.trim());
    const idx = names => H.findIndex(h => names.some(n => h.includes(n)));
    let iName = idx(['الاسم', 'اسم']), iCode = idx(['الكود', 'كود']), iStage = idx(['المرحلة', 'مرحلة']), iPhone = idx(['هاتف الطالب']), iParent = idx(['ولي الأمر']), iFee = idx(['المصروف']);
    if (iName === -1) { iName = 0; iCode = 1; iStage = 2; iPhone = 3; iParent = 4; iFee = 5; }
    const myG = session.kind === 'teacher' ? myGroups()[0] : null;
    let added = 0, skipped = 0, stageFixed = 0;
    rows.slice(1).forEach(r => {
      const name = String(r[iName] || '').trim();
      if (!name) { skipped++; return; }
      let code = String(r[iCode] || '').trim();
      if (!code || db.students.some(s => s.code === code)) code = String(1000 + db.students.length + 1);
      let stage = String(iStage > -1 ? r[iStage] || '' : '').trim();
      if (!stageByName(stage)) { stage = db.stages[0]?.name || ''; stageFixed++; }
      db.students.push({ id: 's-' + uid(), code, name, stage, phone: String(iPhone > -1 ? r[iPhone] || '' : '').trim(), parentPhone: String(iParent > -1 ? r[iParent] || '' : '').trim(), email: '', gender: 'ذكر', groupIds: myG ? [myG.id] : [], teacherIds: session.kind === 'teacher' ? [session.id] : [], paymentMode: 'شهري', fee: Number(iFee > -1 ? r[iFee] || 0 : 0) || stageFee(stage) || db.settings.monthlyFee, lessonPrice: 0, deposit: 0, note: 'مستورد', status: 'active', createdAt: date(), installments: [], password: '', registeredBy: who() });
      added++;
    });
    logAct('استيراد طلاب', `${added} طالب جديد${skipped ? ' — تخطي ' + skipped : ''}`);
    save(); closeModal(); render();
    toast(`تم استيراد ${added} طالب${skipped ? ` وتخطي ${skipped} صف فارغ` : ''}${stageFixed ? ` وتصحيح ${stageFixed} مرحلة غير معروفة` : ''}.`);
  }

  /* ===== المعلمون (للإدارة) ===== */
  function teachers() {
    const rows = db.teachers.map(t => `<tr data-search="${esc(t.name + ' ' + t.phone + ' ' + t.subject)}"><td><b>${esc(t.name)}</b><br><small>${esc(t.username)} — دخول بكلمة مرور</small></td><td>${badge(t.subject, 'info')}</td><td>${esc(t.stages.join('، '))}</td><td>${esc(t.phone || '—')}</td><td>${db.groups.filter(g => (g.teacherIds || []).includes(t.id)).length}</td><td>${t.payMode === 'percent' ? 'نسبة ' + t.payValue + '%' : t.payMode === 'salary' ? 'راتب ' + money(t.payValue) : '—'}</td><td>${subBadge(t.subscriptionEnd)}<br><small>${esc(t.subscriptionEnd)}</small></td><td><div class="actions">${btn('تجديد', 'renew-teacher', t.id, 'btn btn-sm btn-primary')}${btn('✎', 'edit-teacher', t.id)}${btn('⌫', 'delete-teacher', t.id)}</div></td></tr>`).join('');
    return pageHead('المعلمون', 'إضافة المعلمين وتحديد فترة اشتراك كل معلم وتجديدها — المعلم لا يرى إلا طلابه', `<button class="btn btn-primary" data-action="add-teacher">＋ إضافة معلم</button>`) + tableToolbar('ابحث بالاسم أو المادة') + `<div class="table-wrap"><table><thead><tr><th data-sortable>المعلم ↕</th><th>المادة</th><th>المراحل</th><th>الهاتف</th><th>مجموعات</th><th>نظام المستحقات</th><th>اشتراك الوصول</th><th>إجراءات</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function teacherForm(teacher = {}) {
    const body = cfgFields('teacher').filter(f => isCenter() || !['payMode', 'payValue'].includes(f.key)).map(f => {
      if (f.key === 'subject') return `<div class="field"><label>${esc(f.label)}${f.required ? ' <span class="required">*</span>' : ''}</label><input name="subject" list="subjects-datalist" value="${esc(teacher.subject || '')}" ${f.required ? 'required' : ''} placeholder="اختر مادة أو اكتب مادة جديدة"><datalist id="subjects-datalist">${db.subjects.map(s => `<option value="${esc(s)}">`).join('')}</datalist></div>`;
      if (f.key === 'password') return field('password', f.label, teacher.password || '', 'text', f.required);
      return cfgInput(f, f.custom ? teacher.custom?.[f.key] : teacher[f.key]);
    }).join('');
    const ws = teacher.workSchedule || { days: [], time: '' };
    const workBlock = isCenter() ? `<div class="field" style="grid-column:1/-1"><label>موعد حضور المعلم الأسبوعي (اختياري)</label><div class="permission-grid">${DAYS.map(d => `<label><input type="checkbox" name="wdays" value="${esc(d)}" ${(ws.days || []).includes(d) ? 'checked' : ''}> ${esc(d)}</label>`).join('')}</div></div>${field('wtime', 'وقت الحضور (اختياري)', ws.time || '', 'time', false)}` : '';
    modal(teacher.id ? 'تعديل معلم' : 'تسجيل معلم جديد', `<div class="form-grid">${body}${workBlock}<div class="field" style="grid-column:1/-1"><label>المراحل التي يدرّسها <span class="required">*</span></label><div class="permission-grid">${db.stages.map(st => `<label><input type="checkbox" name="stages" value="${esc(st.name)}" ${(teacher.stages || db.stages.map(x => x.name)).includes(st.name) ? 'checked' : ''}> ${esc(st.name)}</label>`).join('')}</div></div></div><div class="notice">${isCenter() ? 'في نظام السنتر يُحدد للمعلم راتب أو نسبة مع إمكانية خصم وبونص بسباب تظهر له في تقريره، وموعد الحضور اختياري.' : 'في نظام المعلم المفرد لا يُحدد راتب للمعلم (هو صاحب المركز).'}</div>`, data => {
      const stages = data.getAll('stages'); if (!stages.length) return toast('اختر مرحلة واحدة على الأقل.', 'error');
      const item = { ...teacher, id: teacher.id || 't-' + uid(), stages };
      cfgFields('teacher').forEach(f => {
        if (!isCenter() && ['payMode', 'payValue'].includes(f.key)) return;
        if (f.key === 'subject') { item.subject = String(data.get('subject') || '').trim(); return; }
        if (f.key === 'password') { item.password = String(data.get('password') || '').trim(); return; }
        const v = data.get(f.key);
        if (f.custom) item.custom = { ...(teacher.custom || {}), [f.key]: v || '' };
        else if (f.type === 'number') item[f.key] = Number(v || 0);
        else item[f.key] = v ?? '';
      });
      if (isCenter()) item.workSchedule = { days: data.getAll('wdays'), time: data.get('wtime') || '' };
      if (!item.name) return toast('حقل الاسم مطلوب.', 'error');
      if (item.subject && !db.subjects.includes(item.subject)) { db.subjects.push(item.subject); toast(`تمت إضافة مادة «${item.subject}» إلى قائمة المواد.`); }
      const dup = checkUniqueCredentials(item.username, item.phone, { kind: 'teacher', id: teacher.id || '' }, item.password, item.password !== (teacher.password || ''));
      if (dup) return toast(dup, 'error');
      if (!item.createdAt) item.createdAt = date();
      if (!item.subscriptionEnd) item.subscriptionEnd = dateAfter(30);
      if (!item.payMethods) item.payMethods = [{ id: 'pm-' + uid(), name: 'نقدي (يدوي)', kind: 'manual', destination: '' }];
      if (teacher.id) Object.assign(teacher, item); else db.teachers.push(item);
      logAct(teacher.id ? 'تعديل معلم' : 'إضافة معلم', item.name);
      save(); closeModal(); render(); toast('تم حفظ بيانات المعلم — يمكنه الدخول الآن باسم المستخدم وكلمة المرور.');
    });
  }

  /* ===== المشرفون ===== */
  const visibleSupervisors = () => session.kind === 'teacher' ? db.supervisors.filter(s => s.teacherId === session.id) : db.supervisors;
  /* ===== الوضعان: معلم مفرد / سنتر ===== */
  const isCenter = () => db.settings.type === 'center';
  /* محاسبة موحدة لأي شخص له راتب: معلم / مشرف / موظف */
  function personAdjustments(kind, id, m = month()) {
    const list = (db.payAdjustments || []).filter(x => x.personKind === kind && x.personId === id && x.month === m);
    return { bonus: list.filter(x => x.type === 'bonus').reduce((a, x) => a + Number(x.amount), 0), deduct: list.filter(x => x.type === 'deduction').reduce((a, x) => a + Number(x.amount), 0), list };
  }
  const personPaid = (kind, id, m = month()) => db.expenses.filter(e => e.month === m && ((e.payKind === kind && e.payId === id) || (kind === 'supervisor' && e.supervisorId === id) || (kind === 'teacher' && e.teacherId === id))).reduce((a, e) => a + Number(e.amount), 0);
  function payAdjustForm(kind, id, name) {
    const rows = (db.payAdjustments || []).filter(x => x.personKind === kind && x.personId === id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    modal(`خصم أو بونص — ${esc(name)}`, `<div class="notice">يُضاف البونص أو يُخصم على صافي راتب هذا الشهر، ويظهر السبب للمشرف أو المعلم أو الموظف في تقريره الشخصي.</div><div class="form-grid">${selectField('type', 'النوع', [['bonus', 'بونص (إضافة على الراتب)'], ['deduction', 'خصم من الراتب']], 'bonus', true)}${field('amount', 'المبلغ', '', 'number', true, 'min="1"')}${field('reason', 'السبب', '', 'text', true)}</div>${rows.length ? `<h3>آخر التعديلات</h3><ul class="list">${rows.map(x => `<li><span>${x.type === 'bonus' ? 'بونص' : 'خصم'} — ${esc(x.reason)}<br><small>${esc(x.month)} — بواسطة ${esc(x.by)}</small></span><b style="color:${x.type === 'bonus' ? 'var(--success)' : 'var(--danger)'}">${x.type === 'bonus' ? '+' : '-'}${money(x.amount)}</b></li>`).join('')}</ul>` : ''}`, data => {
      const amount = Number(data.get('amount')); if (!amount) return toast('أدخل المبلغ.', 'error');
      db.payAdjustments.push({ id: 'pa-' + uid(), personKind: kind, personId: id, type: data.get('type'), amount, reason: data.get('reason'), month: month(), date: date(), by: who() });
      logAct(data.get('type') === 'bonus' ? 'بونص' : 'خصم', `${kind === 'supervisor' ? 'مشرف' : kind === 'teacher' ? 'معلم' : 'موظف'} ${name} — ${money(amount)} — ${data.get('reason')}`);
      save(); closeModal(); render(); toast('تم تسجيل التعديل على الراتب.');
    });
  }
  /* رواتب المشرفين: راتب + بونص − خصم − المصروف (عبر السجل الموحد) */
  const supAdjustments = (sp, m = month()) => personAdjustments('supervisor', sp.id, m);
  const supPaid = (sp, m = month()) => personPaid('supervisor', sp.id, m);
  const supNet = (sp, m = month()) => { const adj = supAdjustments(sp, m); return Math.max(0, Number(sp.salary || 0) + adj.bonus - adj.deduct - supPaid(sp, m)); };
  /* كشف رواتب شهري من شهر التعيين حتى اليوم */
  function personSalaryRows(kind, id) {
    const ent = kind === 'teacher' ? find('teachers', id) : kind === 'supervisor' ? find('supervisors', id) : find('staff', id);
    const start = (ent?.createdAt || month()).slice(0, 7);
    const rows = []; let m = start, guard = 0;
    while (m <= month() && guard++ < 72) {
      let base = 0;
      if (kind === 'teacher') base = teacherDues(find('teachers', id), m);
      else base = Number(ent?.salary || 0);
      const adj = personAdjustments(kind, id, m); const paid = personPaid(kind, id, m);
      rows.push({ m, base, bonus: adj.bonus, deduct: adj.deduct, paid, net: Math.max(0, base + adj.bonus - adj.deduct - paid) });
      m = addMonths(m, 1);
    }
    return rows;
  }
  function personSalaryModal(kind, id, name) {
    const rows = personSalaryRows(kind, id);
    const T = rows.reduce((a, r) => ({ base: a.base + r.base, bonus: a.bonus + r.bonus, deduct: a.deduct + r.deduct, paid: a.paid + r.paid, net: a.net + r.net }), { base: 0, bonus: 0, deduct: 0, paid: 0, net: 0 });
    modal(`كشف الرواتب الشهري — ${esc(name)}`, `<div class="table-wrap"><table><thead><tr><th>الشهر</th><th>الأساسي</th><th>بونص</th><th>خصم</th><th>المصروف</th><th>الصافي</th></tr></thead><tbody>${rows.map(r => `<tr><td><b>${esc(r.m)}</b></td><td>${money(r.base)}</td><td style="color:var(--success)">${money(r.bonus)}</td><td style="color:var(--danger)">${money(r.deduct)}</td><td>${money(r.paid)}</td><td><b>${money(r.net)}</b></td></tr>`).join('')}</tbody><tfoot><tr style="font-weight:800"><td>الإجمالي</td><td>${money(T.base)}</td><td>${money(T.bonus)}</td><td>${money(T.deduct)}</td><td>${money(T.paid)}</td><td>${money(T.net)}</td></tr></tfoot></table></div><div class="notice">الكشف يبدأ من شهر تسجيل الشخص في النظام حتى الشهر الحالي — يعتمد على فترة تعيينه.</div>`, () => closeModal(), 'إغلاق');
  }
  function supScheduleForm(sp) {
    const sch = sp.schedule || { days: [], time: '' };
    modal(`مواعيد حضور المشرف — ${esc(sp.name)}`, `<div class="notice">حدد الأيام والوقت المطلوب حضور المشرف فيه. تسجيل دخوله للنظام يُسجل تلقائياً كحضور لمقارنته بالمواعيد، ويظهر له في تقريره.</div><div class="field" style="margin-bottom:10px"><label>أيام الحضور المطلوبة <span class="required">*</span></label><div class="permission-grid">${DAYS.map(d => `<label><input type="checkbox" name="days" value="${esc(d)}" ${(sch.days || []).includes(d) ? 'checked' : ''}> ${esc(d)}</label>`).join('')}</div></div>${field('time', 'وقت الحضور المطلوب', sch.time || '', 'time', true)}`, data => {
      const days = data.getAll('days'); const time = data.get('time');
      if (!days.length || !time) return toast('اختر الأيام وحدد الوقت.', 'error');
      sp.schedule = { days, time };
      logAct('تحديد مواعيد مشرف', `${sp.name} — ${days.join('، ')} ${time}`);
      save(); closeModal(); render(); toast('تم حفظ مواعيد حضور المشرف.');
    });
  }
  function supAdjustForm(sp) { payAdjustForm('supervisor', sp.id, sp.name); }
  function supervisorsPage() {
    const rows = visibleSupervisors().map(sp => { const adj = supAdjustments(sp); return `<tr data-search="${esc(sp.name + ' ' + sp.phone)}"><td><b>${esc(sp.name)}</b><br><small>${esc(sp.username)}</small></td><td>${esc(sp.phone || '—')}</td>${session.kind !== 'teacher' ? `<td>${esc(teacherName(sp.teacherId))}</td>` : ''}<td>${(sp.groupIds || []).map(groupName).join('، ') || '—'}</td><td>${sp.schedule && sp.schedule.days?.length ? badge(sp.schedule.days.length + ' أيام — ' + sp.schedule.time, 'info') : badge('بلا مواعيد', 'neutral')}</td><td>${money(sp.salary || 0)}${adj.bonus ? ` <small style="color:var(--success)">+${money(adj.bonus)}</small>` : ''}${adj.deduct ? ` <small style="color:var(--danger)">-${money(adj.deduct)}</small>` : ''}</td><td>${subBadge(sp.subscriptionEnd)}<br><small>${esc(sp.subscriptionEnd)}</small></td><td><div class="actions">${btn('🕐 مواعيده', 'sup-schedule', sp.id, 'btn btn-sm btn-light', 'مواعيد الحضور المطلوبة')}${btn('± خصم/بونص', 'sup-adjust', sp.id, 'btn btn-sm btn-light')}${btn('تجديد', 'renew-supervisor', sp.id, 'btn btn-sm btn-primary')}${btn('✎', 'edit-supervisor', sp.id)}${btn('⌫', 'delete-supervisor', sp.id)}</div></td></tr>`; }).join('');
    return pageHead('المشرفون', 'أضف مشرفين واربطهم بالمجموعات، وحدد لكل مشرف مواعيد حضور وراتباً مع خصومات وبونص — يرى طلاب مجموعاته فقط', `<button class="btn btn-primary" data-action="add-supervisor">＋ إضافة مشرف</button>`) + `<div class="table-wrap"><table><thead><tr><th>المشرف</th><th>الهاتف</th>${session.kind !== 'teacher' ? '<th>المعلم المسؤول</th>' : ''}<th>المجموعات المشرف عليها</th><th>مواعيد الحضور</th><th>الراتب (مع التعديلات)</th><th>اشتراك الوصول</th><th>إجراءات</th></tr></thead><tbody>${rows || `<tr><td colspan="8" class="empty">لا يوجد مشرفون بعد</td></tr>`}</tbody></table></div>`;
  }
  function supervisorForm(sp = {}) {
    const groups = myGroups();
    const body = cfgFields('supervisor').map(f => {
      if (f.key === 'username') return field('username', f.label, sp.username || '', 'text', f.required);
      if (f.key === 'password') return field('password', f.label, sp.password || '', 'text', f.required);
      return cfgInput(f, f.custom ? sp.custom?.[f.key] : sp[f.key]);
    }).join('');
    const sch = sp.schedule || { days: [], time: '' };
    const scheduleBlock = `<div class="field" style="grid-column:1/-1"><label>مواعيد حضور المشرف (اختياري — يمكن تحديدها لاحقاً)</label><div class="permission-grid">${DAYS.map(d => `<label><input type="checkbox" name="sdays" value="${esc(d)}" ${(sch.days || []).includes(d) ? 'checked' : ''}> ${esc(d)}</label>`).join('')}</div></div>${field('stime', 'وقت الحضور (اختياري)', sch.time || '', 'time', false)}`;
    modal(sp.id ? 'تعديل مشرف' : 'تسجيل مشرف جديد', `<div class="form-grid">${body}${scheduleBlock}<div class="field" style="grid-column:1/-1"><label>المجموعات المشرف عليها (يمكن الإشراف على أكثر من مجموعة، وكل مجموعة تقبل أكثر من مشرف) <span class="required">*</span></label><div class="permission-grid">${groups.map(g => `<label><input type="checkbox" name="groupIds" value="${esc(g.id)}" ${(sp.groupIds || []).includes(g.id) ? 'checked' : ''}> ${esc(g.name)}</label>`).join('') || '<span class="empty" style="padding:8px">لا توجد مجموعات متاحة — أضف مجموعة أولاً.</span>'}</div></div></div><div class="notice">المشرف يدخل باسم المستخدم وكلمة المرور، ويرى طلاب مجموعاته فقط ولا يرى طلاب المجموعات الأخرى. الحقول الظاهرة يحددها الأدمن من: الإعدادات ← نماذج التسجيل.</div>`, data => {
      const groupIds = data.getAll('groupIds'); if (!groupIds.length) return toast('اربط المشرف بمجموعة واحدة على الأقل.', 'error');
      const item = { ...sp, id: sp.id || 'sp-' + uid(), groupIds, teacherId: session.kind === 'teacher' ? session.id : (sp.teacherId || db.teachers[0]?.id || ''), schedule: { days: data.getAll('sdays'), time: data.get('stime') || '' }, attendanceLog: sp.attendanceLog || [] };
      cfgFields('supervisor').forEach(f => {
        if (f.key === 'username') { item.username = String(data.get('username') || '').trim(); return; }
        if (f.key === 'password') { item.password = String(data.get('password') || '').trim(); return; }
        const v = data.get(f.key);
        if (f.custom) item.custom = { ...(sp.custom || {}), [f.key]: v || '' };
        else if (f.type === 'number') item[f.key] = Number(v || 0);
        else item[f.key] = v ?? '';
      });
      if (!item.name) return toast('حقل الاسم مطلوب.', 'error');
      const dup = checkUniqueCredentials(item.username, item.phone, { kind: 'supervisor', id: sp.id || '' }, item.password, item.password !== (sp.password || ''));
      if (dup) return toast(dup, 'error');
      if (!item.createdAt) item.createdAt = date();
      if (sp.id) Object.assign(sp, item); else db.supervisors.push(item);
      logAct(sp.id ? 'تعديل مشرف' : 'إضافة مشرف', item.name);
      save(); closeModal(); render(); toast('تم حفظ بيانات المشرف — يمكنه الدخول الآن.');
    });
  }

  /* ===== المجموعات والجدول الأسبوعي ===== */
  function scheduleGrid() {
    const groups = myGroups();
    const times = [...new Set(groups.filter(g => g.time).map(g => g.time))].sort();
    const unscheduled = groups.filter(g => !g.time || !(g.days || []).length);
    const cell = (d, t) => groups.filter(g => g.time === t && (g.days || []).includes(d)).map(g => {
      const conflict = db.groups.filter(x => x.time === t && (x.days || []).includes(d) && x.id !== g.id && (x.teacherIds || []).some(tid => (g.teacherIds || []).includes(tid))).length > 0;
      return `<span class="chip ${conflict ? 'conflict' : ''}" title="${esc((g.teacherIds || []).map(teacherName).join('، '))} — ${esc(g.stage)}${conflict ? ' — تعارض موعد مع نفس المعلم!' : ''}">${esc(g.name)}</span>`;
    }).join('') || '';
    return `<section class="panel" style="margin-top:16px"><h2>الجدول الأسبوعي</h2>${times.length ? `<div style="overflow:auto"><div class="sched"><div></div>${DAYS.map(d => `<div class="day-h">${d}</div>`).join('')}${times.map(t => `<div class="day-h">${esc(t)}</div>${DAYS.map(d => `<div class="slot">${cell(d, t)}</div>`).join('')}`).join('')}</div></div>` : '<p class="empty" style="padding:14px">حدد أيام ووقت المجموعات لتظهر هنا.</p>'}${unscheduled.length ? `<h3>مجموعات بلا موعد محدد</h3><div class="actions">${unscheduled.map(g => `<span class="chip">${esc(g.name)} — ${esc(g.schedule || '—')}</span>`).join('')}</div>` : ''}</section>`;
  }
  function groups() {
    const isSup = session.kind === 'supervisor';
    const readOnly = isSup || (session.kind === 'teacher' && isCenter());
    const list = myGroups();
    const rows = list.map(g => { const enrolled = db.students.filter(s => s.status === 'active' && s.groupIds.includes(g.id)).length; return `<tr data-search="${esc(g.name + ' ' + g.stage + ' ' + (g.teacherIds || []).map(teacherName).join(' '))}"><td><b>${esc(g.name)}</b></td><td>${esc((g.teacherIds || []).map(teacherName).join('، '))}</td><td>${esc(g.stage)}</td><td>${esc(g.schedule || '—')}</td><td>${enrolled} / ${g.capacity} (${pct(enrolled, g.capacity)}%)</td>${readOnly ? '' : `<td><div class="actions">${btn('✎', 'edit-group', g.id)}${btn('⌫', 'delete-group', g.id)}</div></td>`}</tr>`; }).join('');
    return pageHead(isSup ? 'مجموعاتي' : (readOnly ? 'مجموعاتي (للقراءة — الإدارة تدير المجموعات)' : 'المجموعات'), isSup ? 'المجموعات المشرف عليها فقط' : (readOnly ? 'مواعيد حصصك — إضافة وتعديل المجموعات للأدارة' : 'المواعيد والسعات وربط المجموعة بأكثر من معلم'), readOnly ? '' : `<button class="btn btn-primary" data-action="add-group">＋ إضافة مجموعة</button>`) + `<div class="table-wrap"><table><thead><tr><th>المجموعة</th><th>المعلمون</th><th>المرحلة</th><th>الموعد</th><th>المسجلون</th>${readOnly ? '' : '<th>إجراءات</th>'}</tr></thead><tbody>${rows || `<tr><td colspan="6" class="empty">لا توجد مجموعات في نطاقك</td></tr>`}</tbody></table></div>` + scheduleGrid();
  }
  function groupForm(group = {}) {
    const tList = session.kind === 'teacher' ? db.teachers : db.teachers;
    modal(group.id ? 'تعديل مجموعة' : 'إضافة مجموعة', `<div class="form-grid">${field('name', 'اسم المجموعة', group.name, 'text', true)}${selectField('stage', 'المرحلة', db.stages.map(s => s.name), group.stage || db.stages[0]?.name, true)}${field('capacity', 'السعة', group.capacity || db.settings.capacity, 'number', true, 'min="1"')}<div class="field" style="grid-column:1/-1"><label>المعلمون المسؤولون (يمكن ربط المجموعة بأكثر من معلم) <span class="required">*</span></label><div class="permission-grid">${tList.map(t => `<label><input type="checkbox" name="teacherIds" value="${esc(t.id)}" ${(group.teacherIds || []).includes(t.id) || (!group.id && session.kind === 'teacher' && t.id === session.id) ? 'checked' : ''}> ${esc(t.name)}</label>`).join('')}</div></div><div class="field" style="grid-column:1/-1"><label>أيام الحصة <span class="required">*</span></label><div class="permission-grid">${DAYS.map(d => `<label><input type="checkbox" name="days" value="${esc(d)}" ${(group.days || []).includes(d) ? 'checked' : ''}> ${esc(d)}</label>`).join('')}</div></div>${field('time', 'وقت الحصة', group.time || '', 'time', true)}${field('entryClose', 'موعد غلق الدخول للحصة (اختياري — بعد هذا الوقت يُمنع تسجيل حضور)', group.entryCloseTime || '', 'time', false)}${db.venues.length ? selectField('venueId', 'المقر (اختياري — لأرباح المقرات)', [['', 'بدون مقر'], ...db.venues.map(v => [v.id, v.name + (v.rent ? ' — إيجار ' + money(v.rent) : '')])], group.venueId || '') : ''}</div><div class="notice">تظهر المجموعة في الجدول الأسبوعي، ويُحدد تعارض موعد المعلم تلقائياً.`, data => {
      const teacherIds = data.getAll('teacherIds'); if (!teacherIds.length) return toast('اختر معلماً واحداً على الأقل.', 'error');
      const days = data.getAll('days'); if (!days.length) return toast('اختر يوماً واحداً على الأقل.', 'error');
      const time = data.get('time'); if (!time) return toast('حدد وقت الحصة.', 'error');
      const item = { ...group, id: group.id || 'g-' + uid(), name: data.get('name'), stage: data.get('stage'), capacity: Number(data.get('capacity')), entryCloseTime: data.get('entryClose') || '', venueId: data.get('venueId') || '', teacherIds, teacherId: teacherIds[0], days, time, schedule: days.join('، ') + ' — ' + time };
      if (group.id) Object.assign(group, item); else db.groups.push(item);
      logAct(group.id ? 'تعديل مجموعة' : 'إضافة مجموعة', item.name + ' — معلمون: ' + teacherIds.map(teacherName).join('، '));
      save(); closeModal(); render(); toast('تم حفظ المجموعة.');
    });
  }

  /* ===== الحضور والغياب ===== */
  const nowHHMM = () => new Date().toTimeString().slice(0, 5);
  function attendance() {
    const group = myGroups().find(g => g.id === attendanceGroup) || myGroups()[0];
    attendanceGroup = group?.id || attendanceGroup;
    const isCT = session.kind === 'teacher' && isCenter();
    const records = db.attendance.filter(a => a.groupId === group?.id && a.date === date()).sort((a, b) => (b.time || '').localeCompare(a.time || '')); const present = records.filter(a => a.status === 'present');
    const groupStudents = activeStudents().filter(s => s.groupIds.includes(group?.id));
    const info = lastScanned && canTouchStudent(find('students', lastScanned) || {}) ? find('students', lastScanned) : null;
    const manual = db.settings.attendanceMode === 'manual';
    const entryClosed = group?.entryCloseTime && nowHHMM() > group.entryCloseTime;
    const entryCtl = !isCT ? '' : `<div class="toolbar"><label style="font-size:12px;font-weight:800">⏰ موعد غلق الدخول لحصة هذه المجموعة:</label><input type="time" id="entry-close" value="${esc(group?.entryCloseTime || '')}"><button class="btn btn-sm btn-primary" data-action="set-entry-close" data-id="${group?.id}">حفظ</button>${group?.entryCloseTime ? (entryClosed ? badge('الدخول مغلق الآن', 'danger') : badge('يُغلق بعد ' + group.entryCloseTime, 'info')) : badge('بلا غلق', 'neutral')}</div>`;
    return pageHead('الغياب والحضور', isCT ? 'متابعة حضور طلابك لحصصهم — تحديد موعد غلق الدخول من هنا' : 'سجل حضور الطلاب بالكارت أو الكود أو الاسم') + `<div class="grid" style="grid-template-columns:1fr .7fr"><section class="panel"><div class="form-grid"><div class="field"><label>المجموعة</label><select id="attendance-group">${optionList(myGroups(), group?.id, x => [x.id, x.name + ' — ' + x.schedule])}</select></div>${isCT ? '' : `<div class="field"><label>كود الطالب أو اسمه</label><input id="attendance-code" placeholder="${manual ? 'اكتب كود الطالب ثم Enter' : 'امسح البطاقة أو اكتب الكود ثم Enter'}" autofocus></div>`}</div>${entryCtl}<div class="notice">الحاضرون اليوم: <b>${present.length}</b> من ${groupStudents.length}.${db.settings.allowMakeup && !isCT ? ' السماح بالحضور التعويضي مفعّل.' : ''}${isCT ? ' تسجيل الحضور يقوم به المشرف — أنت تحدد موعد غلق الدخول وتتابع التقارير.' : ''}</div>${isCT ? '' : `<div class="actions"><button class="btn btn-primary" data-action="mark-attendance">تسجيل حضور</button><button class="btn btn-light" data-action="departure">تسجيل انصراف</button><button class="btn btn-light" data-action="close-session">إغلاق الحصة</button></div>`}<h3>التسجيلات الحالية</h3><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الحالة</th><th>الحضور</th><th>الانصراف</th>${isCT ? '' : '<th>المصروفات</th>'}</tr></thead><tbody>${records.map(r => { const s = find('students', r.studentId); return `<tr><td>${esc(s?.name || '—')}${r.makeup ? ' ' + badge('تعويض', 'info') : ''}</td><td>${badge(r.status === 'present' ? 'حاضر' : 'غائب', r.status === 'present' ? 'success' : 'danger')}</td><td>${esc(r.time || '—')}</td><td>${esc(r.departure || '—')}</td>${isCT ? '' : `<td>${s && studentDue(s) > 0 && session.kind !== 'supervisor' ? btn('متبقي ' + money(studentDue(s)), 'pay', s.id, 'badge warning') : (s && studentDue(s) > 0 ? badge('متبقي ' + money(studentDue(s)), 'warning') : 'تم الدفع')}</td>`}</tr>`; }).join('') || `<tr><td colspan="${isCT ? 4 : 5}" class="empty">لا توجد تسجيلات بعد.</td></tr>`}</tbody></table></div></section><aside class="panel"><h2>معلومة الطالب عند الدخول</h2>${info ? `<div class="card" style="padding:14px"><b>${esc(info.name)}</b><p>المجموعة: ${esc(info.groupIds.map(groupName).join('، '))}</p>${isCT ? '' : `<p>حالة الرسوم: ${studentDue(info) ? badge('متبقي ' + money(studentDue(info)), 'warning') : badge('سدد هذا الشهر', 'success')}</p>`}<p>غيابات مسجلة: ${db.attendance.filter(a => a.studentId === info.id && a.status === 'absent').length}</p><p>آخر ملاحظة: ${esc(info.note || '—')}</p>${studentDue(info) && session.kind !== 'supervisor' && !isCT ? `<button class="btn btn-primary btn-sm" data-action="pay" data-id="${info.id}">تحصيل الآن</button>` : ''}</div>` : '<p class="empty">بعد تسجيل الكود ستظهر هنا آخر ملاحظة وحالة الرسوم وسجل الحصة السابقة.</p>'}<h2 style="margin-top:18px">تقارير الغياب</h2><button class="btn btn-light" data-page="attendance-report">عرض التقرير اليومي</button></aside></div>`;
  }
  function attendanceReport() {
    const mine = activeStudents().map(s => s.id);
    const rows = db.attendance.filter(a => a.date === date() && mine.includes(a.studentId));
    const present = rows.filter(a => a.status === 'present').length, absent = rows.length - present;
    return pageHead('تقرير الغياب اليومي', `سجل ${date()} مع حالات الحضور والغياب`, `<div class="actions"><button class="btn btn-light" data-action="export">تصدير</button><button class="btn btn-primary" data-action="print">طباعة</button><button class="btn btn-light" data-page="attendance">العودة للحضور</button></div>`) + `<div class="grid stats" style="margin-bottom:16px"><div class="stat-card"><span class="label">حاضرون اليوم</span><strong>${present}</strong></div><div class="stat-card"><span class="label">غائبون اليوم</span><strong>${absent}</strong></div><div class="stat-card"><span class="label">نسبة الحضور</span><strong>${pct(present, rows.length)}%</strong></div><div class="stat-card"><span class="label">إجمالي التسجيلات</span><strong>${rows.length}</strong></div></div><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>المجموعة</th><th>الحالة</th><th>الحضور</th><th>الانصراف</th></tr></thead><tbody>${rows.map(a => `<tr><td>${esc(studentName(a.studentId))}</td><td>${esc(groupName(a.groupId))}</td><td>${badge(a.status === 'present' ? 'حاضر' : 'غائب', a.status === 'present' ? 'success' : 'danger')}</td><td>${esc(a.time || '—')}</td><td>${esc(a.departure || '—')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">لا توجد بيانات اليوم.</td></tr>'}</tbody></table></div>`;
  }
  function markAttendance() {
    const group = myGroups().find(g => g.id === attendanceGroup);
    if (!group) return toast('اختر مجموعة من نطاقك أولاً.', 'error');
    if (group.entryCloseTime && nowHHMM() > group.entryCloseTime) return toast(`أُغلق الدخول لهذه الحصة — موعد الغلق ${group.entryCloseTime}.`, 'error');
    const value = $('#attendance-code')?.value.trim(); if (!value) return toast('امسح البطاقة أو أدخل كود الطالب.', 'error');
    const s = visStudents().find(x => x.code === value || x.name.includes(value)); if (!s) return toast('لا يوجد طالب مطابق في نطاقك.', 'error');
    let makeup = false;
    if (!s.groupIds.includes(group.id)) {
      if (!db.settings.allowMakeup) return toast('الطالب غير مسجل في المجموعة المختارة.', 'error');
      makeup = true;
    }
    if (db.attendance.some(a => a.studentId === s.id && a.groupId === group.id && a.date === date() && a.status === 'present')) return toast('تم تسجيل حضور الطالب اليوم في هذه المجموعة.', 'error');
    db.attendance.push({ id: 'a-' + uid(), studentId: s.id, groupId: group.id, date: date(), time: nowTime(), status: 'present', makeup, note: makeup ? 'حضور تعويضي في ' + groupName(group.id) : '' });
    let extra = '';
    if (db.settings.autoPay && studentDue(s) > 0 && studentPayMode(s) === 'شهري' && session.kind !== 'supervisor') { const due = studentDue(s); const m = studentPayMethods(s)[0]; db.payments.push({ id: 'p-' + uid(), studentId: s.id, amount: due, due: studentFee(s), period: month(), receivedBy: who(), collectedBy: who(), method: m?.name || 'يدوي', kind: m?.kind || 'manual', destination: m?.destination || '', createdAt: date(), archived: false }); extra = ` تم تحصيل المصروف تلقائياً (${money(due)}).`; }
    lastScanned = s.id;
    save(); render(); toast(`تم تسجيل حضور ${s.name}${makeup ? ' (تعويضي)' : ''}.${s.note && !makeup ? ' آخر ملاحظة: ' + s.note : ''}${extra}`);
  }
  function departureForm() {
    modal('تسجيل انصراف', `<div class="notice">يُسجل الانصراف على أحدث حضور اليوم لأي مجموعة في نطاقك.</div>${field('code', 'كود الطالب', '', 'text', true, 'autofocus placeholder="اكتب الكود"')}`, data => {
      const s = visStudents().find(x => x.code === data.get('code').trim()); if (!s) return toast('لا يوجد طالب بهذا الكود في نطاقك.', 'error');
      const rec = [...db.attendance].reverse().find(a => a.studentId === s.id && a.date === date() && a.status === 'present'); if (!rec) return toast('لا يوجد حضور مسجل لهذا الطالب اليوم.', 'error');
      rec.departure = nowTime(); save(); closeModal(); render(); toast(`تم تسجيل انصراف ${s.name} الساعة ${rec.departure}.`);
    });
  }
  function closeSession() {
    const groupStudents = activeStudents().filter(s => s.groupIds.includes(attendanceGroup));
    const missing = groupStudents.filter(s => !db.attendance.some(a => a.studentId === s.id && a.groupId === attendanceGroup && a.date === date()));
    modal('إغلاق الحصة', `<div class="notice">اختر الطلاب الذين تريد تغييبهم. غير المحددين لن يضاف لهم سجل في هذا الإجراء.</div>${missing.map(s => `<label class="check" style="padding:8px;border-bottom:1px solid var(--line)"><input type="checkbox" name="absent" value="${s.id}" checked> ${esc(s.name)}</label>`).join('') || '<p>كل طلاب المجموعة لديهم تسجيل بالفعل.</p>'}`, data => {
      const ids = data.getAll('absent');
      ids.forEach(id => db.attendance.push({ id: 'a-' + uid(), studentId: id, groupId: attendanceGroup, date: date(), time: '—', status: 'absent' }));
      logAct('إغلاق حصة', groupName(attendanceGroup) + ' — تغييب ' + ids.length + ' طالب');
      save(); closeModal(); render(); toast('تم إغلاق الحصة وتسجيل الغياب للمحدد.');
      if (db.settings.absenceNotify && ids.length && session.kind !== 'supervisor') notificationResults(ids.map(id => { const s = find('students', id); return { name: s.name + ' — ولي الأمر', phone: s.parentPhone || s.phone, text: `ولي أمر ${s.name}: نود إبلاغكم بتغيب ${s.name} اليوم ${date()} عن حصة ${groupName(attendanceGroup)}. ${db.settings.centerName}` }; }));
    }, 'تغييب المحدد');
  }

  /* ===== الاختبارات ===== */
  const myExams = () => session.kind === 'teacher' ? db.exams.filter(e => e.teacherId === session.id) : db.exams;
  function exams() { const rows = myExams().map(e => `<tr data-search="${esc(e.name + ' ' + e.kind + ' ' + e.stage)}"><td><b>${esc(e.name)}</b></td><td>${esc(e.kind)}</td><td>${esc(e.stage)}</td><td>${esc(e.date)}</td><td>${e.grades.length}</td><td>${badge(e.status === 'open' ? 'مفتوح' : 'مغلق', e.status === 'open' ? 'success' : 'neutral')}</td><td><div class="actions">${btn('درجات', 'grades', e.id)}${btn('إحصاء', 'exam-stats', e.id)}${btn('✎', 'edit-exam', e.id)}${btn('⌫', 'delete-exam', e.id, 'action', 'حذف')}</div></td></tr>`).join(''); return pageHead('الاختبارات', 'اختبارات ورقية وإلكترونية ورصد الدرجات', `<button class="btn btn-primary" data-action="add-exam">＋ إضافة اختبار</button>`) + tableToolbar('ابحث باسم الاختبار') + `<div class="table-wrap"><table><thead><tr><th data-sortable>الاختبار ↕</th><th>النوع</th><th>المرحلة</th><th data-sortable>التاريخ ↕</th><th data-sortable>درجات مرصودة ↕</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>${rows}</tbody></table></div>`; }
  function examForm(exam = {}) { modal(exam.id ? 'تعديل اختبار' : 'إضافة اختبار', `<div class="form-grid">${field('name', 'اسم الاختبار', exam.name, 'text', true)}${selectField('kind', 'نوع الاختبار', ['ورقي', 'تسميع', 'واجب', 'إلكتروني'], exam.kind || 'ورقي', true)}${selectField('stage', 'المرحلة', db.stages.map(s => s.name), exam.stage || db.stages[0]?.name, true)}${session.kind === 'teacher' ? `<div class="field"><label>المعلم</label><input value="${esc(who())}" disabled></div>` : selectField('teacherId', 'المعلم', db.teachers, exam.teacherId || db.teachers[0]?.id, true, '', x => [x.id, x.name])}${field('duration', 'المدة بالدقائق', exam.duration || 30, 'number', true)}${field('date', 'التاريخ', exam.date || date(), 'date', true)}</div>`, data => { const item = { ...exam, id: exam.id || 'e-' + uid(), name: data.get('name'), kind: data.get('kind'), stage: data.get('stage'), teacherId: session.kind === 'teacher' ? session.id : (exam.teacherId || data.get('teacherId')), duration: Number(data.get('duration')), date: data.get('date'), grades: exam.grades || [], status: exam.status || 'open' }; if (exam.id) Object.assign(exam, item); else db.exams.push(item); logAct(exam.id ? 'تعديل اختبار' : 'إضافة اختبار', item.name); save(); closeModal(); render(); toast('تم حفظ الاختبار.'); }); }
  function gradeForm(examId) { const e = find('exams', examId); const allowed = activeStudents().filter(s => s.stage === e.stage); const rows = allowed.map(s => { const g = e.grades.find(x => x.studentId === s.id) || {}; return `<tr><td>${esc(s.name)}</td><td><input name="score-${s.id}" type="number" min="0" value="${g.score ?? ''}" style="width:90px"></td><td><input name="max-${s.id}" type="number" min="1" value="${g.max ?? 20}" style="width:90px"></td></tr>`; }).join(''); modal(`رصد درجات — ${esc(e.name)}`, `<div class="notice">تظهر هنا طلاب نطاقك فقط. أدخل الدرجة أو اتركها فارغة للطالب المتغيب. إغلاق الدرجات يصفّر من لا درجة له.</div><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الدرجة</th><th>النهائية</th></tr></thead><tbody>${rows}</tbody></table></div><label class="check" style="margin-top:14px"><input type="checkbox" name="close"> إغلاق الدرجات وتصفير من لا يملك درجة</label>`, data => { const notifyList = []; allowed.forEach(s => { let score = data.get('score-' + s.id); let max = data.get('max-' + s.id) || 20; if (score !== '' && score !== null) { let g = e.grades.find(x => x.studentId === s.id); if (g) { g.score = Number(score); g.max = Number(max); } else e.grades.push({ studentId: s.id, score: Number(score), max: Number(max), note: '' }); notifyList.push({ s, score: Number(score), max: Number(max) }); } else if (data.get('close')) e.grades.push({ studentId: s.id, score: 0, max: Number(max), note: 'تم التصفير عند إغلاق الدرجات' }); }); if (data.get('close')) e.status = 'closed'; logAct('رصد درجات', e.name + ' — ' + notifyList.length + ' درجة'); save(); closeModal(); render(); toast('تم حفظ الدرجات.'); if (db.settings.gradeNotify && notifyList.length && session.kind !== 'supervisor') notificationResults(notifyList.map(x => ({ name: x.s.name + ' — ولي الأمر', phone: x.s.parentPhone || x.s.phone, text: `نتيجة ${x.s.name} في ${e.name}: ${x.score}/${x.max} (${pct(x.score, x.max)}%). ${db.settings.centerName}` }))); }); }
  function examStats(id) { const e = find('exams', id), gs = e.grades; const avg = gs.length ? gs.reduce((a, g) => a + g.score / g.max * 100, 0) / gs.length : 0; modal(`إحصائيات — ${esc(e.name)}`, `<div class="grid stats"><div class="stat-card"><span class="label">متوسط الدرجات</span><strong>${avg.toFixed(1)}%</strong></div><div class="stat-card"><span class="label">الحاصلون على النهائية</span><strong>${gs.filter(g => g.score === g.max).length}</strong></div><div class="stat-card"><span class="label">أعلى من النصف</span><strong>${gs.filter(g => g.score / g.max >= .5).length}</strong></div><div class="stat-card"><span class="label">أقل من النصف</span><strong>${gs.filter(g => g.score / g.max < .5).length}</strong></div></div><h3>الترتيب</h3><ol>${[...gs].sort((a, b) => b.score / b.max - a.score / a.max).map(g => `<li>${esc(studentName(g.studentId))} — ${g.score}/${g.max}</li>`).join('') || '<li>لا توجد درجات.</li>'}</ol>`, () => closeModal(), 'إغلاق'); }

  /* ===== الأموال وطرق الدفع ===== */
  function myPayments(monthFilter = 'all') {
    const mine = activeStudents().map(s => s.id);
    return db.payments.filter(p => !p.archived && (isStaffLevel() || mine.includes(p.studentId)) && (monthFilter === 'all' || p.period === monthFilter));
  }
  function ledger(monthFilter = 'all') {
    return [...myPayments(monthFilter).map(p => ({ type: 'رسوم', name: studentName(p.studentId), amount: p.amount, date: p.createdAt, plus: true })),
    ...db.incomes.filter(i => monthFilter === 'all' || i.createdAt.startsWith(monthFilter)).map(i => ({ type: 'دخل مالي', name: i.reason, amount: i.amount, date: i.createdAt, plus: true })),
    ...db.expenses.filter(i => monthFilter === 'all' || i.createdAt.startsWith(monthFilter)).map(i => ({ type: 'مصروف مالي', name: i.reason, amount: i.amount, date: i.createdAt, plus: false }))].sort((a, b) => b.date.localeCompare(a.date));
  }
  function monthNet(m) { const fees = db.payments.filter(p => p.period === m && !p.archived).reduce((a, p) => a + p.amount, 0); const inc = db.incomes.filter(i => i.createdAt.startsWith(m)).reduce((a, i) => a + i.amount, 0); const exp = db.expenses.filter(i => i.createdAt.startsWith(m)).reduce((a, i) => a + i.amount, 0); return { fees, inc, exp, net: fees + inc - exp }; }
  function payMethodsPanel() {
    let tId;
    if (session.kind === 'teacher') tId = session.id;
    else { tId = pmTeacher || db.teachers[0]?.id; }
    const t = find('teachers', tId);
    if (!t) return '';
    return `<section class="panel" style="margin-top:16px"><h2>طرق استلام الأموال ${session.kind !== 'teacher' ? '— المعلم: ' + esc(t.name) : ''}</h2><p style="color:var(--muted);font-size:12px;margin:0 0 10px">هذه الطرق تظهر لولي الأمر في بوابة الطالب وعند التحصيل. طريقة «تحويل» تعرض رقم الحساب/المحفظة.</p>${session.kind !== 'teacher' && db.teachers.length > 1 ? `<div class="toolbar"><select id="pm-teacher">${optionList(db.teachers, t.id, x => [x.id, x.name])}</select></div>` : ''}<div class="list">${(t.payMethods || []).map(m => `<li><span><b>${esc(m.name)}</b> ${m.kind === 'transfer' ? badge('تحويل → ' + (m.destination || 'بدون رقم'), 'info') : badge('يدوي', 'success')}</span>${btn('⌫', 'del-paymethod', t.id + '::' + m.id)}</li>`).join('') || '<li>لا توجد طرق بعد.</li>'}</div><div class="toolbar" style="margin-top:10px"><input id="pm-name" placeholder="اسم الطريقة (مثال: فودافون كاش)" style="flex:1;min-width:150px"><select id="pm-kind"><option value="manual">يدوي / نقدي</option><option value="transfer">تحويل أموال</option></select><input id="pm-dest" placeholder="رقم الحساب/المحفظة (للتحويل)" style="flex:1;min-width:150px"><button class="btn btn-primary btn-sm" data-action="add-paymethod">＋ إضافة طريقة</button></div></section>`;
  }
  function finance() {
    const months = monthOptions();
    const events = ledger(financeMonth);
    const fees = events.filter(x => x.type === 'رسوم').reduce((a, x) => a + x.amount, 0), inc = events.filter(x => x.type === 'دخل مالي').reduce((a, x) => a + x.amount, 0), exp = events.filter(x => x.type === 'مصروف مالي').reduce((a, x) => a + x.amount, 0);
    return pageHead('الأموال والحسابات', session.kind === 'teacher' ? 'تحصيل طلابك وطرق استلام الأموال التي حددتها' : 'التقارير اليومية والشهرية وحركة النقدية', `<div class="actions"><select id="finance-month">${optionList([['all', 'كل الشهور'], ...months.map(m => [m, m])], financeMonth)}</select><button class="btn btn-light" data-action="add-income">＋ دخل مالي</button><button class="btn btn-primary" data-action="add-expense">＋ مصروف مالي</button></div>`) + `<div class="grid stats"><div class="stat-card"><span class="label">إجمالي الرسوم</span><strong>${money(fees)}</strong></div><div class="stat-card"><span class="label">دخل إضافي</span><strong>${money(inc)}</strong></div><div class="stat-card"><span class="label">مصروفات</span><strong>${money(exp)}</strong></div><div class="stat-card"><span class="label">الصافي</span><strong>${money(fees + inc - exp)}</strong></div></div><section class="panel" style="margin-top:16px"><h2>حركة النقدية ${financeMonth === 'all' ? '' : '— ' + financeMonth}</h2><div class="table-wrap"><table><thead><tr><th>النوع</th><th>البيان</th><th>الطريقة</th><th data-sortable>التاريخ ↕</th><th data-sortable>القيمة ↕</th></tr></thead><tbody>${events.map(x => { const p = x.type === 'رسوم' ? myPayments(financeMonth === 'all' ? 'all' : financeMonth).find(pp => studentName(pp.studentId) === x.name && pp.amount === x.amount) : null; return `<tr><td>${badge(x.type, x.plus ? 'success' : 'danger')}</td><td>${esc(x.name)}</td><td>${p ? esc((p.method || 'يدوي') + (p.kind === 'transfer' ? ' → ' + (p.destination || '') : '')) : '—'}</td><td>${x.date}</td><td style="color:${x.plus ? 'var(--success)' : 'var(--danger)'}">${x.plus ? '+' : '-'} ${money(x.amount)}</td></tr>`; }).join('') || '<tr><td colspan="5" class="empty">لا توجد حركة مالية.</td></tr>'}</tbody></table></div></section>` + (session.kind === 'teacher' || session.kind === 'admin' ? payMethodsPanel() : '');
  }
  function moneyForm(kind) { const isExpense = kind === 'expense'; modal(isExpense ? 'إضافة مصروف مالي' : 'إضافة دخل مالي', `<div class="form-grid">${field('amount', 'المبلغ', '', 'number', true, 'min="1"')}${field('date', 'التاريخ', date(), 'date', true)}${field('reason', 'السبب', '', 'text', true)}</div>`, data => { db[isExpense ? 'expenses' : 'incomes'].push({ id: (isExpense ? 'x' : 'i') + '-' + uid(), amount: Number(data.get('amount')), reason: data.get('reason'), createdAt: data.get('date') || date(), user: who() }); logAct(isExpense ? 'إضافة مصروف' : 'إضافة دخل', data.get('reason') + ' — ' + money(data.get('amount'))); save(); closeModal(); render(); toast('تم تسجيل العملية المالية.'); }); }

  /* ===== التقارير ===== */
  function reportTabsFor() {
  const all = [['finance', 'المالي الشهري'], ['defaulters', 'المتأخرون في السداد'], ['payments', 'سجل المدفوعات'], ['collections', 'مصادر التحصيل'], ['expenses', 'الدخل والمصروفات'], ['teacherdues', 'مستحقات المعلمين والمشرفين'], ['installments', 'الأقساط'], ['attendance', 'الحضور والغياب'], ['absence-log', 'الغياب التفصيلي'], ['daily', 'الملخص اليومي'], ['grades', 'الدرجات'], ['studentcard', 'ملف طالب شامل'], ['new-students', 'الطلاب الجدد'], ['books', 'الكتب والمبيعات'], ['teachers', 'أداء المعلمين'], ['stages', 'المراحل والمجموعات'], ['activity', 'سجل النشاط'], ['mypay', 'تقريري (حضوري وراتبي)']];
    if (session.kind === 'supervisor' || (session.kind === 'teacher' && isCenter())) return all.filter(t => ['attendance', 'absence-log', 'daily', 'grades', 'studentcard', 'mypay'].includes(t[0]));
    if (session.kind === 'teacher') return all;
    return all;
  }
  function reports() { const tabs = reportTabsFor(); if (!tabs.some(t => t[0] === reportTab)) reportTab = tabs[0][0]; return pageHead('التقارير', `${tabs.length} تقارير جاهزة للطباعة والتصدير مع فلاتر مرنة`) + `<section class="panel"><div class="tabs">${tabs.map(t => `<button type="button" class="tab ${reportTab === t[0] ? 'active' : ''}" data-report-tab="${t[0]}">${t[1]}</button>`).join('')}</div>${reportBody()}</section>`; }
  function reportTools(extra = '') { return `<div class="toolbar">${extra}<div style="flex:1"></div><button class="btn btn-light btn-sm" data-action="export">تصدير CSV</button><button class="btn btn-primary btn-sm" data-action="print-report">طباعة التقرير</button></div>`; }
  const attRateStats = (p, ab) => `<div class="grid stats"><div class="stat-card"><span class="label">إجمالي الحضور</span><strong>${p}</strong></div><div class="stat-card"><span class="label">إجمالي الغياب</span><strong>${ab}</strong></div><div class="stat-card"><span class="label">نسبة الحضور</span><strong>${pct(p, p + ab)}%</strong></div></div>`;
  function teacherCollected(t, m = month()) { const tGroups = db.groups.filter(g => (g.teacherIds || []).includes(t.id)).map(g => g.id); return db.payments.filter(p => !p.archived && p.period === m && tGroups.some(gid => find('students', p.studentId)?.groupIds.includes(gid))).reduce((a, p) => a + Number(p.amount), 0); }
  function teacherDues(t, m = month()) { if (t.payMode === 'percent') return Math.round(teacherCollected(t, m) * Number(t.payValue || 0) / 100); if (t.payMode === 'salary') return Number(t.payValue || 0); return 0; }
  function teacherPaid(t, m = month()) { return db.expenses.filter(e => e.teacherId === t.id && e.month === m).reduce((a, e) => a + Number(e.amount), 0); }
  function reportBody() {
    if (reportTab === 'finance') {
      const cur = monthNet(reportMonth);
      const expected = activeStudents().filter(s => studentPayMode(s) !== 'لا يدفع').reduce((a, s) => a + studentFee(s), 0);
      const events = ledger(reportMonth);
      const last6 = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - 5 + i); const m = d.toISOString().slice(0, 7); return { m, ...monthNet(m) }; });
      const maxAbs = Math.max(1, ...last6.map(x => Math.abs(x.net)));
      return reportTools(`<div class="field"><label>الشهر</label><input type="month" id="report-month" value="${reportMonth}"></div>`) + `<div class="grid stats"><div class="stat-card"><span class="label">رسوم محصلة</span><strong>${money(cur.fees)}</strong><span class="trend">${pct(cur.fees, expected)}% من المتوقع</span></div><div class="stat-card"><span class="label">دخل إضافي</span><strong>${money(cur.inc)}</strong></div><div class="stat-card"><span class="label">مصروفات</span><strong>${money(cur.exp)}</strong></div><div class="stat-card"><span class="label">الصافي</span><strong>${money(cur.net)}</strong></div></div><section class="panel" style="margin-top:14px"><h2>صافي آخر 6 شهور</h2><div class="bars">${last6.map(x => `<div class="bar" style="height:${Math.max(8, Math.round(Math.abs(x.net) / maxAbs * 100))}%;${x.net < 0 ? 'background:linear-gradient(#f08aa0,var(--danger))' : ''}" title="${x.m}: ${money(x.net)}"><small>${x.m.slice(5)}</small></div>`).join('')}</div></section><section class="panel" style="margin-top:14px"><h2>حركات الشهر</h2><div class="table-wrap"><table><thead><tr><th>النوع</th><th>البيان</th><th>التاريخ</th><th>القيمة</th></tr></thead><tbody>${events.map(x => `<tr><td>${badge(x.type, x.plus ? 'success' : 'danger')}</td><td>${esc(x.name)}</td><td>${x.date}</td><td style="color:${x.plus ? 'var(--success)' : 'var(--danger)'}">${x.plus ? '+' : '-'} ${money(x.amount)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">لا توجد حركة في هذا الشهر.</td></tr>'}</tbody></table></div></section>`;
    }
    if (reportTab === 'defaulters') {
      const list = activeStudents().map(s => ({ s, due: studentDue(s) })).filter(x => x.due > 0).sort((a, b) => b.due - a.due);
      const totalDue = list.reduce((a, x) => a + x.due, 0);
      return reportTools() + `<div class="notice">إجمالي المتأخرات هذا الشهر: <b>${money(totalDue)}</b> لعدد <b>${list.length}</b> طالب.</div><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>المرحلة</th><th>المجموعات</th><th>هاتف ولي الأمر</th><th>المصروف</th><th>المدفوع</th><th>المتبقي</th><th>إجراءات</th></tr></thead><tbody>${list.map(x => `<tr><td><b>${esc(x.s.name)}</b><br><small>${esc(x.s.code)}</small></td><td>${esc(x.s.stage)}</td><td>${esc(x.s.groupIds.map(groupName).join('، '))}</td><td>${esc(x.s.parentPhone || x.s.phone || '—')}</td><td>${money(studentFee(x.s))}</td><td>${money(studentPaid(x.s))}</td><td><b style="color:var(--danger)">${money(x.due)}</b></td><td><div class="actions">${session.kind !== 'supervisor' ? btn('تحصيل', 'pay', x.s.id, 'btn btn-sm btn-primary') : ''}${x.s.parentPhone || x.s.phone ? `<a class="btn btn-sm btn-success" target="_blank" rel="noopener" href="${waLink(x.s.parentPhone || x.s.phone, `ولي أمر ${x.s.name}: برجاء العلم بوجود متأخر من المصروفات قدره ${money(x.due)} لشهر ${month()}. شكراً لكم — ${db.settings.centerName}`)}">تنبيه واتساب</a>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="8" class="empty">لا يوجد متأخرون — تم تحصيل الجميع 🎉</td></tr>'}</tbody></table></div>`;
    }
    if (reportTab === 'payments') {
      const list = myPayments(reportMonth === 'all' ? 'all' : reportMonth).filter(p => reportStudent === 'all' || p.studentId === reportStudent).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const total = list.reduce((a, p) => a + Number(p.amount), 0);
      return reportTools(`<div class="field"><label>الشهر</label><select id="report-month">${optionList([['all', 'كل الشهور'], ...monthOptions().map(m => [m, m])], reportMonth)}</select></div><div class="field"><label>الطالب</label><select id="report-student">${optionList([['all', 'كل الطلاب'], ...activeStudents().map(s => [s.id, s.name + ' — ' + s.code])], reportStudent)}</select></div>`) + `<div class="grid stats"><div class="stat-card"><span class="label">عدد الدفعات</span><strong>${list.length}</strong></div><div class="stat-card"><span class="label">إجمالي المحصل</span><strong>${money(total)}</strong></div><div class="stat-card"><span class="label">متوسط الدفعة</span><strong>${money(list.length ? Math.round(total / list.length) : 0)}</strong></div><div class="stat-card"><span class="label">طلاب سددوا</span><strong>${new Set(list.map(p => p.studentId)).size}</strong></div></div><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>التاريخ</th><th>الطالب</th><th>الكود</th><th>شهر الرسوم</th><th>المبلغ</th><th>حصّله</th></tr></thead><tbody>${list.map(p => { const s = find('students', p.studentId); return `<tr><td>${esc(p.createdAt)}</td><td><b>${esc(s?.name || '—')}</b></td><td>${esc(s?.code || '—')}</td><td>${esc(p.period)}</td><td><b>${money(p.amount)}</b></td><td>${esc(p.collectedBy || p.receivedBy || '—')}</td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">لا توجد دفعات مطابقة للفلاتر.</td></tr>'}</tbody><tfoot><tr style="font-weight:800"><td colspan="4">الإجمالي</td><td colspan="2">${money(total)}</td></tr></tfoot></table></div>`;
    }
    if (reportTab === 'collections') {
      const list = myPayments(reportMonth === 'all' ? 'all' : reportMonth).filter(p => reportMethod === 'all' || p.kind === reportMethod).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const transfers = list.filter(p => p.kind === 'transfer');
      return reportTools(`<div class="field"><label>الشهر</label><select id="report-month">${optionList([['all', 'كل الشهور'], ...monthOptions().map(m => [m, m])], reportMonth)}</select></div><div class="field"><label>طريقة الدفع</label><select id="report-method">${optionList([['all', 'كل الطرق'], ['manual', 'يدوي / نقدي'], ['transfer', 'تحويل أموال']], reportMethod)}</select></div>`) + `<div class="grid stats"><div class="stat-card"><span class="label">إجمالي التحصيل</span><strong>${money(list.reduce((a, p) => a + Number(p.amount), 0))}</strong></div><div class="stat-card"><span class="label">تحويلات</span><strong>${money(transfers.reduce((a, p) => a + Number(p.amount), 0))}</strong></div><div class="stat-card"><span class="label">يدوي / نقدي</span><strong>${money(list.filter(p => p.kind !== 'transfer').reduce((a, p) => a + Number(p.amount), 0))}</strong></div><div class="stat-card"><span class="label">عدد العمليات</span><strong>${list.length}</strong></div></div><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>التاريخ</th><th>الطالب</th><th>المبلغ</th><th>الطريقة</th><th>وجهة التحويل</th><th>حصّله</th><th>شهر الرسوم</th></tr></thead><tbody>${list.map(p => `<tr><td>${esc(p.createdAt)}</td><td><b>${esc(studentName(p.studentId))}</b></td><td><b>${money(p.amount)}</b></td><td>${badge((p.method || 'يدوي'), p.kind === 'transfer' ? 'info' : 'success')}</td><td>${p.kind === 'transfer' ? esc(p.destination || '—') : '—'}</td><td>${esc(p.collectedBy || p.receivedBy || '—')}</td><td>${esc(p.period)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">لا توجد عمليات تحصيل مطابقة.</td></tr>'}</tbody></table></div>`;
    }
    if (reportTab === 'expenses') {
      const inM = x => reportMonth === 'all' || x.createdAt.startsWith(reportMonth);
      const exp = db.expenses.filter(inM), inc = db.incomes.filter(inM);
      const byReason = arr => { const m = {}; arr.forEach(x => { const k = x.reason || '—'; m[k] = m[k] || { count: 0, total: 0 }; m[k].count++; m[k].total += Number(x.amount); }); return Object.entries(m).sort((a, b) => b[1].total - a[1].total); };
      const expRows = byReason(exp), incRows = byReason(inc);
      const totExp = exp.reduce((a, x) => a + Number(x.amount), 0), totInc = inc.reduce((a, x) => a + Number(x.amount), 0);
      return reportTools(`<div class="field"><label>الشهر</label><select id="report-month">${optionList([['all', 'كل الشهور'], ...monthOptions().map(m => [m, m])], reportMonth)}</select></div>`) + `<div class="grid stats"><div class="stat-card"><span class="label">إجمالي الدخل</span><strong>${money(totInc)}</strong></div><div class="stat-card"><span class="label">إجمالي المصروفات</span><strong>${money(totExp)}</strong></div><div class="stat-card"><span class="label">الصافي</span><strong style="color:${totInc - totExp >= 0 ? 'var(--success)' : 'var(--danger)'}">${money(totInc - totExp)}</strong></div><div class="stat-card"><span class="label">أكبر بند مصروف</span><strong style="font-size:15px">${esc(expRows[0]?.[0] || '—')}</strong></div></div><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>النوع</th><th>البيان (السبب)</th><th>عدد العمليات</th><th>الإجمالي</th></tr></thead><tbody>${[...expRows.map(([k, v]) => `<tr><td>${badge('مصروف', 'danger')}</td><td>${esc(k)}</td><td>${v.count}</td><td style="color:var(--danger)">${money(v.total)}</td></tr>`), ...incRows.map(([k, v]) => `<tr><td>${badge('دخل', 'success')}</td><td>${esc(k)}</td><td>${v.count}</td><td style="color:var(--success)">${money(v.total)}</td></tr>`)].join('') || '<tr><td colspan="4" class="empty">لا توجد عمليات في هذا الشهر.</td></tr>'}</tbody></table></div>`;
    }
    if (reportTab === 'teacherdues') {
      let html = reportTools();
      if (isCenter()) {
        const rows = db.teachers.map(t => { const adj = personAdjustments('teacher', t.id); const paid = personPaid('teacher', t.id); const base = teacherDues(t); return { t, collected: teacherCollected(t), base, adj, paid, remaining: Math.max(0, base + adj.bonus - adj.deduct - paid) }; });
        html += `<h3 style="margin:4px 0 8px">رواتب ومستحقات المعلمين — ${month()}</h3><div class="table-wrap"><table><thead><tr><th>المعلم</th><th>النظام</th><th>تحصيل مجموعاته</th><th>المستحق الأساسي</th><th>بونص</th><th>خصم</th><th>المدفوع</th><th>المتبقي</th><th>إجراءات</th></tr></thead><tbody>${rows.map(x => `<tr><td><b>${esc(x.t.name)}</b></td><td>${x.t.payMode === 'percent' ? 'نسبة ' + x.t.payValue + '%' : x.t.payMode === 'salary' ? 'راتب ' + money(x.t.payValue) : '—'}</td><td>${money(x.collected)}</td><td><b>${money(x.base)}</b></td><td style="color:var(--success)">${money(x.adj.bonus)}</td><td style="color:var(--danger)">${money(x.adj.deduct)}</td><td>${money(x.paid)}</td><td style="color:${x.remaining ? 'var(--warning)' : 'var(--success)'}"><b>${money(x.remaining)}</b></td><td><div class="actions">${btn('📅 كشف شهري', 'salary-statement', 'teacher::' + x.t.id, 'btn btn-sm btn-light')}${btn('± خصم/بونص', 'adjust-teacher', x.t.id, 'btn btn-sm btn-light')}${x.remaining > 0 ? btn('تسجيل صرف', 'pay-teacher', x.t.id, 'btn btn-sm btn-primary') : '—'}</div></td></tr>`).join('') || '<tr><td colspan="9" class="empty">لا يوجد معلمون.</td></tr>'}</tbody></table></div>`;
      }
      if (session.kind !== 'supervisor') {
        const supPool = session.kind === 'teacher' ? db.supervisors.filter(s => s.teacherId === session.id) : db.supervisors;
        const supRows = supPool.map(sp => { const adj = supAdjustments(sp); const paid = supPaid(sp); return { sp, adj, paid, remaining: supNet(sp) }; });
        html += `<h3 style="margin:18px 0 8px">رواتب المشرفين — ${month()}</h3><div class="table-wrap"><table><thead><tr><th>المشرف</th><th>المعلم المسؤول</th><th>الراتب الأساسي</th><th>بونص</th><th>خصم</th><th>المدفوع</th><th>المتبقي</th><th>إجراءات</th></tr></thead><tbody>${supRows.map(x => `<tr><td><b>${esc(x.sp.name)}</b></td><td>${esc(teacherName(x.sp.teacherId))}</td><td>${money(x.sp.salary || 0)}</td><td style="color:var(--success)">${money(x.adj.bonus)}</td><td style="color:var(--danger)">${money(x.adj.deduct)}</td><td>${money(x.paid)}</td><td style="color:${x.remaining > 0 ? 'var(--warning)' : 'var(--success)'}"><b>${money(x.remaining)}</b></td><td><div class="actions">${btn('📅 كشف شهري', 'salary-statement', 'supervisor::' + x.sp.id, 'btn btn-sm btn-light')}${x.remaining > 0 ? btn('تسجيل صرف', 'pay-supervisor', x.sp.id, 'btn btn-sm btn-primary') : '—'}</div></td></tr>`).join('') || '<tr><td colspan="8" class="empty">لا يوجد مشرفون.</td></tr>'}</tbody></table></div>`;
        const stRows = db.staff.map(st => { const adj = personAdjustments('staff', st.id); const paid = personPaid('staff', st.id); return { st, adj, paid, remaining: Math.max(0, Number(st.salary || 0) + adj.bonus - adj.deduct - paid) }; });
        html += `<h3 style="margin:18px 0 8px">رواتب الموظفين — ${month()}</h3><div class="table-wrap"><table><thead><tr><th>الموظف</th><th>الوظيفة</th><th>الراتب الأساسي</th><th>بونص</th><th>خصم</th><th>المدفوع</th><th>المتبقي</th><th>إجراءات</th></tr></thead><tbody>${stRows.map(x => `<tr><td><b>${esc(x.st.name)}</b></td><td>${esc(x.st.jobTitle || '—')}</td><td>${money(x.st.salary || 0)}</td><td style="color:var(--success)">${money(x.adj.bonus)}</td><td style="color:var(--danger)">${money(x.adj.deduct)}</td><td>${money(x.paid)}</td><td style="color:${x.remaining > 0 ? 'var(--warning)' : 'var(--success)'}"><b>${money(x.remaining)}</b></td><td><div class="actions">${btn('📅 كشف شهري', 'salary-statement', 'staff::' + x.st.id, 'btn btn-sm btn-light')}${x.remaining > 0 ? btn('تسجيل صرف', 'pay-staff', x.st.id, 'btn btn-sm btn-primary') : '—'}</div></td></tr>`).join('') || '<tr><td colspan="8" class="empty">لا يوجد موظفون.</td></tr>'}</tbody></table></div>`;
      }
      return html;
    }
    if (reportTab === 'installments') {
      const rows = activeStudents().flatMap(s => (s.installments || []).filter(i => !i.paid).map(i => ({ s, i }))).sort((a, b) => a.i.month.localeCompare(b.i.month));
      const dueNow = rows.filter(x => x.i.month <= month());
      return reportTools() + `<div class="grid stats"><div class="stat-card"><span class="label">أقساط غير مدفوعة</span><strong>${rows.length}</strong></div><div class="stat-card"><span class="label">مستحقة الآن أو متأخرة</span><strong>${dueNow.length}</strong></div><div class="stat-card"><span class="label">قيمة المستحق الآن</span><strong>${money(dueNow.reduce((a, x) => a + x.i.amount, 0))}</strong></div><div class="stat-card"><span class="label">إجمالي الأقساط المتبقية</span><strong>${money(rows.reduce((a, x) => a + x.i.amount, 0))}</strong></div></div><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>الطالب</th><th>شهر القسط</th><th>المبلغ</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>${rows.map(x => `<tr><td><b>${esc(x.s.name)}</b><br><small>${esc(x.s.code)}</small></td><td>${esc(x.i.month)}</td><td><b>${money(x.i.amount)}</b></td><td>${x.i.month < month() ? badge('متأخر', 'danger') : x.i.month === month() ? badge('مستحق هذا الشهر', 'warning') : badge('قادم', 'info')}</td><td>${session.kind !== 'supervisor' ? btn('تحصيل', 'pay-installment', x.s.id + '::' + x.i.id, 'btn btn-sm btn-primary') : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">لا توجد أقساط غير مدفوعة.</td></tr>'}</tbody></table></div>`;
    }
    if (reportTab === 'attendance') {
      const mine = activeStudents().map(s => s.id);
      const inR = a => a.date >= reportFrom && a.date <= reportTo && (reportGroup === 'all' || a.groupId === reportGroup) && mine.includes(a.studentId);
      const pool = activeStudents().filter(s => reportGroup === 'all' || s.groupIds.includes(reportGroup));
      const stats = pool.map(s => { const p = db.attendance.filter(a => a.studentId === s.id && a.status === 'present' && inR(a)).length; const ab = db.attendance.filter(a => a.studentId === s.id && a.status === 'absent' && inR(a)).length; return { s, p, ab, rate: pct(p, p + ab) }; });
      const tp = stats.reduce((a, x) => a + x.p, 0), ta = stats.reduce((a, x) => a + x.ab, 0);
      const limit = Number(db.settings.absenceLimit || 3);
      return reportTools(`<div class="field"><label>من</label><input type="date" id="report-from" value="${reportFrom}"></div><div class="field"><label>إلى</label><input type="date" id="report-to" value="${reportTo}"></div><div class="field"><label>المجموعة</label><select id="report-group">${optionList([['all', 'كل المجموعات'], ...myGroups().map(g => [g.id, g.name])], reportGroup)}</select></div>`) + attRateStats(tp, ta) + `<div class="stat-card" style="margin-top:14px"><span class="label">تجاوزوا حد الغياب (${limit} حصص)</span><strong>${stats.filter(x => x.ab >= limit).length}</strong></div><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>الطالب</th><th>حضور</th><th>غياب</th><th>نسبة الحضور</th><th>الحالة</th></tr></thead><tbody>${stats.sort((a, b) => a.rate - b.rate).map(x => `<tr><td><b>${esc(x.s.name)}</b></td><td>${x.p}</td><td>${x.ab}</td><td><div class="progress" style="min-width:90px"><i style="width:${x.rate}%"></i></div></td><td>${x.ab >= limit ? badge('تجاوز حد الغياب', 'danger') : x.rate >= 80 ? badge('منتظم', 'success') : badge('مقبول', 'warning')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">لا يوجد طلاب.</td></tr>'}</tbody></table></div>`;
    }
    if (reportTab === 'absence-log') {
      const mine = activeStudents().map(s => s.id);
      const inR = a => a.date >= reportFrom && a.date <= reportTo && (reportGroup === 'all' || a.groupId === reportGroup) && mine.includes(a.studentId);
      const rows = db.attendance.filter(inR).sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''));
      const p = rows.filter(r => r.status === 'present').length, ab = rows.length - p;
      return reportTools(`<div class="field"><label>من</label><input type="date" id="report-from" value="${reportFrom}"></div><div class="field"><label>إلى</label><input type="date" id="report-to" value="${reportTo}"></div><div class="field"><label>المجموعة</label><select id="report-group">${optionList([['all', 'كل المجموعات'], ...myGroups().map(g => [g.id, g.name])], reportGroup)}</select></div>`) + attRateStats(p, ab) + `<div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>التاريخ</th><th>الطالب</th><th>المجموعة</th><th>الحالة</th><th>وقت الحضور</th><th>الانصراف</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.date)}</td><td><b>${esc(studentName(r.studentId))}</b></td><td>${esc(groupName(r.groupId))}</td><td>${badge(r.status === 'present' ? 'حاضر' : 'غائب', r.status === 'present' ? 'success' : 'danger')}</td><td>${esc(r.time || '—')}</td><td>${esc(r.departure || '—')}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">لا توجد سجلات في هذا النطاق.</td></tr>'}</tbody></table></div>`;
    }
    if (reportTab === 'daily') {
      const d = reportDay;
      const mine = activeStudents().map(s => s.id);
      const att = db.attendance.filter(a => a.date === d && mine.includes(a.studentId)), pays = db.payments.filter(p => p.createdAt === d && !p.archived && mine.includes(p.studentId)), inc = db.incomes.filter(i => i.createdAt === d), exp = db.expenses.filter(i => i.createdAt === d), fresh = db.students.filter(s => s.createdAt === d && mine.includes(s.id)), examsToday = db.exams.filter(e => e.date === d);
      const cashIn = pays.reduce((a, x) => a + Number(x.amount), 0) + inc.reduce((a, x) => a + Number(x.amount), 0);
      const cashOut = exp.reduce((a, x) => a + Number(x.amount), 0);
      const rows = [
        ...att.map(a => ({ t: 'حضور', b: studentName(a.studentId) + ' — ' + groupName(a.groupId), v: a.status === 'present' ? (a.time || '') : 'غياب', plus: a.status === 'present' })),
        ...pays.map(x => ({ t: 'دفعة رسوم', b: studentName(x.studentId) + ' — ' + (x.method || 'يدوي'), v: money(x.amount), plus: true })),
        ...inc.map(x => ({ t: 'دخل مالي', b: x.reason, v: money(x.amount), plus: true })),
        ...exp.map(x => ({ t: 'مصروف مالي', b: x.reason, v: money(x.amount), plus: false })),
        ...fresh.map(x => ({ t: 'طالب جديد', b: x.name + ' — ' + x.stage, v: '', plus: true })),
        ...examsToday.map(x => ({ t: 'اختبار', b: x.name, v: x.kind, plus: true }))
      ];
      return reportTools(`<div class="field"><label>التاريخ</label><input type="date" id="report-day" value="${d}"></div>`) + `<div class="grid stats"><div class="stat-card"><span class="label">حضور / غياب</span><strong>${att.filter(a => a.status === 'present').length} / ${att.filter(a => a.status === 'absent').length}</strong></div><div class="stat-card"><span class="label">الوارد النقدي</span><strong>${money(cashIn)}</strong></div><div class="stat-card"><span class="label">المصروف</span><strong>${money(cashOut)}</strong></div><div class="stat-card"><span class="label">طلاب جدد</span><strong>${fresh.length}</strong></div></div><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>النوع</th><th>البيان</th><th>التفاصيل</th></tr></thead><tbody>${rows.map(x => `<tr><td>${badge(x.t, x.plus ? 'success' : 'danger')}</td><td>${esc(x.b)}</td><td>${esc(x.v || '—')}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">لا يوجد نشاط في هذا اليوم.</td></tr>'}</tbody></table></div>`;
    }
    if (reportTab === 'grades') {
      const pool = myExams();
      const e = pool.find(x => x.id === reportExam) || pool[0];
      if (!e) return reportTools(`<div class="field"><label>الاختبار</label><select id="report-exam"><option value="">لا توجد اختبارات</option></select></div>`) + '<p class="empty">أضف اختبارات أولاً من صفحة الاختبارات.</p>';
      const gs = [...e.grades].sort((a, b) => b.score / b.max - a.score / a.max);
      const avg = gs.length ? gs.reduce((a, g) => a + g.score / g.max * 100, 0) / gs.length : 0;
      const high = gs.length ? Math.max(...gs.map(g => g.score / g.max * 100)) : 0, low = gs.length ? Math.min(...gs.map(g => g.score / g.max * 100)) : 0;
      return reportTools(`<div class="field"><label>الاختبار</label><select id="report-exam">${optionList(pool, e.id, x => [x.id, `${x.name} — ${x.date}`])}</select></div>`) + `<div class="grid stats"><div class="stat-card"><span class="label">المتوسط</span><strong>${avg.toFixed(1)}%</strong></div><div class="stat-card"><span class="label">أعلى نتيجة</span><strong>${high.toFixed(1)}%</strong></div><div class="stat-card"><span class="label">أدنى نتيجة</span><strong>${low.toFixed(1)}%</strong></div><div class="stat-card"><span class="label">عدد المشاركين</span><strong>${gs.length}</strong></div></div><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>الترتيب</th><th>الطالب</th><th>الدرجة</th><th>النسبة</th><th>النتيجة</th></tr></thead><tbody>${gs.map((g, i) => `<tr><td>${i + 1}</td><td><b>${esc(studentName(g.studentId))}</b></td><td>${g.score} / ${g.max}</td><td>${pct(g.score, g.max)}%</td><td>${g.score / g.max >= .5 ? badge('ناجح', 'success') : badge('ضعيف', 'danger')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">لم تُرصد درجات بعد.</td></tr>'}</tbody></table></div>`;
    }
    if (reportTab === 'studentcard') {
      const s = activeStudents().find(x => x.id === reportStudent) || activeStudents()[0];
      if (!s) return reportTools() + '<p class="empty">لا يوجد طلاب في نطاقك.</p>';
      const st = portalStats(s);
      const monthly = portalAttendanceMonthly(st.records);
      const paysShow = session.kind === 'supervisor' ? [] : st.pays;
      const rankPool = activeStudents().filter(x => x.groupIds.some(g => s.groupIds.includes(g)));
      const avgOf = x => { const gs = db.exams.flatMap(e => e.grades.filter(g => g.studentId === x.id)); return gs.length ? gs.reduce((a, g) => a + g.score / g.max * 100, 0) / gs.length : null; };
      const ranked = rankPool.map(x => ({ id: x.id, avg: avgOf(x) })).filter(x => x.avg !== null).sort((a, b) => b.avg - a.avg);
      const myRank = ranked.findIndex(x => x.id === s.id) + 1;
      return reportTools(`<div class="field"><label>الطالب</label><select id="report-student">${optionList([['all', '— اختر طالباً —'], ...activeStudents().map(x => [x.id, x.name + ' — ' + x.code])], s.id)}</select></div>`) + `<div class="notice">ملف شامل لطالب واحد: بياناته وحضوره ودرجاته وموقعه بين زملائه${session.kind === 'supervisor' ? '' : ' ووضعه المالي'} — قابل للطباعة والتوقيع.</div><div class="grid stats" style="margin-top:12px"><div class="stat-card"><span class="label">نسبة الحضور</span><strong>${st.records.length ? st.attRate + '%' : '—'}</strong><span class="trend">${st.present} حضور / ${st.absent} غياب</span></div><div class="stat-card"><span class="label">معدل الدرجات</span><strong>${st.grades.length ? st.avg + '%' : '—'}</strong><span class="trend">${st.grades.length} اختبار</span></div><div class="stat-card"><span class="label">الترتيب في مجموعاته</span><strong>${myRank ? myRank + ' من ' + ranked.length : '—'}</strong><span class="trend">حسب معدل الدرجات</span></div><div class="stat-card"><span class="label">حالة المصروفات</span><strong style="color:${studentDue(s) ? 'var(--danger)' : 'var(--success)'}">${money(studentDue(s))}</strong><span class="trend">المتبقي هذا الشهر</span></div></div>${monthly.length ? `<section class="panel" style="margin-top:14px"><h2>الحضور شهرياً</h2><div class="table-wrap"><table style="min-width:0"><thead><tr><th>الشهر</th><th>حضور</th><th>غياب</th><th>النسبة</th></tr></thead><tbody>${monthly.map(m => `<tr><td>${esc(m.m)}</td><td>${m.p}</td><td>${m.a}</td><td>${m.rate}%</td></tr>`).join('')}</tbody></table></div></section>` : ''}<section class="panel" style="margin-top:14px"><h2>سجل الدرجات</h2><div class="table-wrap"><table style="min-width:0"><thead><tr><th>الاختبار</th><th>التاريخ</th><th>الدرجة</th><th>النسبة</th></tr></thead><tbody>${st.grades.map(g => `<tr><td>${esc(g.exam)}</td><td>${esc(g.date)}</td><td>${g.score}/${g.max}</td><td>${pct(g.score, g.max)}%</td></tr>`).join('') || '<tr><td colspan="4" class="empty">لا توجد درجات.</td></tr>'}</tbody></table></div></section>${session.kind === 'supervisor' ? '' : `<section class="panel" style="margin-top:14px"><h2>آخر الدفعات</h2><ul class="list">${paysShow.slice(0, 8).map(p => `<li><span>${esc(p.period)} — ${esc(p.method || 'يدوي')}<br><small>${esc(p.createdAt)}</small></span><b>${money(p.amount)}</b></li>`).join('') || '<li>لا توجد دفعات.</li>'}</ul></section>`}`;
    }
    if (reportTab === 'new-students') {
      const list = db.students.filter(s => s.createdAt >= reportFrom && s.createdAt <= reportTo && (isStaffLevel() || (s.teacherIds || []).includes(session.id) || s.groupIds.some(g => myGroups().some(x => x.id === g)))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const perStage = db.stages.map(st => ({ name: st.name, count: list.filter(s => s.stage === st.name).length })).filter(x => x.count);
      return reportTools(`<div class="field"><label>من</label><input type="date" id="report-from" value="${reportFrom}"></div><div class="field"><label>إلى</label><input type="date" id="report-to" value="${reportTo}"></div>`) + `<div class="grid stats"><div class="stat-card"><span class="label">طلاب جدد في الفترة</span><strong>${list.length}</strong></div><div class="stat-card"><span class="label">منهم نشطون</span><strong>${list.filter(s => s.status === 'active').length}</strong></div><div class="stat-card"><span class="label">منهم مؤرشفون</span><strong>${list.filter(s => s.status === 'archived').length}</strong></div><div class="stat-card"><span class="label">متوسط المصروف</span><strong>${money(list.length ? Math.round(list.reduce((a, s) => a + studentFee(s), 0) / list.length) : 0)}</strong></div></div>${perStage.length ? `<section class="panel" style="margin-top:14px"><h2>التوزيع حسب المرحلة</h2>${perStage.map(x => `<div class="progress-row"><span>${esc(x.name)}</span><div class="progress"><i style="width:${pct(x.count, list.length)}%"></i></div><b>${x.count}</b></div>`).join('')}</section>` : ''}<div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>تاريخ الانضمام</th><th>الطالب</th><th>الكود</th><th>المرحلة</th><th>سجَّله</th><th>الحالة</th></tr></thead><tbody>${list.map(s => `<tr><td>${esc(s.createdAt)}</td><td><b>${esc(s.name)}</b></td><td>${esc(s.code)}</td><td>${esc(s.stage)}</td><td>${esc(s.registeredBy || '—')}</td><td>${s.status === 'active' ? badge('نشط', 'success') : badge('مؤرشف', 'neutral')}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">لا يوجد طلاب جدد في هذه الفترة.</td></tr>'}</tbody></table></div>`;
    }
    if (reportTab === 'books') {
      if (!isStaffLevel()) return '<p class="empty">هذا التقرير للإدارة فقط.</p>';
      const rows = db.books.map(b => { const sold = b.deliveries.filter(d => d.type === 'بيع'); const revenue = sold.reduce((a, d) => a + d.amount, 0); const cost = sold.length * b.purchase; return { b, sold: sold.length, revenue, cost, profit: revenue - cost, debt: Math.max(0, (b.totalPurchased ?? b.qty + sold.length) * b.purchase - b.supplierPaid) }; });
      const T = rows.reduce((a, x) => ({ sold: a.sold + x.sold, revenue: a.revenue + x.revenue, profit: a.profit + x.profit, debt: a.debt + x.debt }), { sold: 0, revenue: 0, profit: 0, debt: 0 });
      return reportTools() + `<div class="grid stats"><div class="stat-card"><span class="label">إجمالي المبيعات</span><strong>${T.sold}</strong></div><div class="stat-card"><span class="label">إيراد المبيعات</span><strong>${money(T.revenue)}</strong></div><div class="stat-card"><span class="label">أرباح الكتب</span><strong>${money(T.profit)}</strong></div><div class="stat-card"><span class="label">مستحقات الموردين</span><strong>${money(T.debt)}</strong></div></div><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>الكتاب</th><th>بِيع</th><th>المتبقي</th><th>الإيراد</th><th>التكلفة</th><th>الربح</th><th>مستحق المورد</th></tr></thead><tbody>${rows.map(x => `<tr><td><b>${esc(x.b.name)}</b></td><td>${x.sold}</td><td>${x.b.qty}</td><td>${money(x.revenue)}</td><td>${money(x.cost)}</td><td style="color:${x.profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${money(x.profit)}</td><td>${money(x.debt)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">لا توجد كتب.</td></tr>'}</tbody><tfoot><tr style="font-weight:800"><td>الإجمالي</td><td>${T.sold}</td><td>—</td><td>${money(T.revenue)}</td><td>—</td><td>${money(T.profit)}</td><td>${money(T.debt)}</td></tr></tfoot></table></div>`;
    }
    if (reportTab === 'teachers') {
      const rows = db.teachers.map(t => { const tGroups = db.groups.filter(g => (g.teacherIds || []).includes(t.id)); const students = activeStudents().filter(s => s.groupIds.some(g => tGroups.some(x => x.id === g)) || (s.teacherIds || []).includes(t.id)).length; const tExams = db.exams.filter(e => e.teacherId === t.id); const grades = tExams.flatMap(e => e.grades); const avg = grades.length ? grades.reduce((a, g) => a + g.score / g.max * 100, 0) / grades.length : 0; return { t, groups: tGroups.length, students, exams: tExams.length, avg }; });
      return reportTools() + `<div class="table-wrap"><table><thead><tr><th>المعلم</th><th>المادة</th><th>مجموعات</th><th>طلاب</th><th>اختبارات</th><th>متوسط نتائج اختباراته</th></tr></thead><tbody>${rows.map(x => `<tr><td><b>${esc(x.t.name)}</b></td><td>${esc(x.t.subject)}</td><td>${x.groups}</td><td>${x.students}</td><td>${x.exams}</td><td>${x.avg ? x.avg.toFixed(1) + '%' : '—'}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">لا يوجد معلمون.</td></tr>'}</tbody></table></div>`;
    }
    if (reportTab === 'stages') {
      const rows = db.stages.map(st => { const list = activeStudents().filter(s => s.stage === st.name); const expected = list.reduce((a, s) => a + studentFee(s), 0); const collected = list.reduce((a, s) => a + studentPaid(s), 0); return { name: st.name, fee: st.fee, count: list.length, expected, collected, late: list.filter(s => studentDue(s) > 0).length }; });
      const grows = myGroups().map(g => { const enrolled = db.students.filter(s => s.status === 'active' && s.groupIds.includes(g.id)).length; return { g, enrolled, fill: pct(enrolled, g.capacity) }; });
      return reportTools() + `<h3 style="margin:4px 0 8px">حسب المرحلة</h3><div class="table-wrap"><table><thead><tr><th>المرحلة</th><th>سعرها الشهري</th><th>عدد الطلاب</th><th>المتوقع شهرياً</th><th>المحصل هذا الشهر</th><th>متأخرون</th></tr></thead><tbody>${rows.map(x => `<tr><td><b>${esc(x.name)}</b></td><td>${money(x.fee)}</td><td>${x.count}</td><td>${money(x.expected)}</td><td>${money(x.collected)}</td><td>${x.late ? badge(x.late + ' طالب', 'warning') : '—'}</td></tr>`).join('')}</tbody></table></div><h3 style="margin:18px 0 8px">امتلاء المجموعات</h3><div class="table-wrap"><table><thead><tr><th>المجموعة</th><th>المعلمون</th><th>المسجلون</th><th>نسبة الامتلاء</th></tr></thead><tbody>${grows.map(x => `<tr><td><b>${esc(x.g.name)}</b></td><td>${esc((x.g.teacherIds || []).map(teacherName).join('، '))}</td><td>${x.enrolled} / ${x.g.capacity}</td><td><div class="progress" style="min-width:110px"><i style="width:${x.fill}%"></i></div> ${x.fill}%</td></tr>`).join('') || '<tr><td colspan="4" class="empty">لا توجد مجموعات.</td></tr>'}</tbody></table></div>`;
    }
    if (reportTab === 'activity') {
      const users = [...new Set(db.activity.map(l => l.user))];
      const pool = session.kind === 'teacher' ? db.activity.filter(l => l.user === who()) : db.activity;
      const rows = pool.filter(l => (reportStudent === 'all' || l.user === reportStudent) && l.at.slice(0, 10) >= reportFrom && l.at.slice(0, 10) <= reportTo).sort((a, b) => b.at.localeCompare(a.at));
      return reportTools(`<div class="field"><label>المستخدم</label><select id="report-student">${optionList([['all', 'كل المستخدمين'], ...users.map(u => [u, u])], reportStudent)}</select></div><div class="field"><label>من</label><input type="date" id="report-from" value="${reportFrom}"></div><div class="field"><label>إلى</label><input type="date" id="report-to" value="${reportTo}"></div>`) + `<div class="table-wrap"><table><thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>التفاصيل</th></tr></thead><tbody>${rows.map(l => `<tr><td>${esc(l.at)}</td><td><b>${esc(l.user)}</b></td><td>${badge(l.action, 'info')}</td><td>${esc(l.detail || '—')}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">لا يوجد نشاط في هذا النطاق.</td></tr>'}</tbody></table></div>`;
    }
    if (reportTab === 'mypay') {
      let p = null;
      if (session.kind === 'supervisor') { const sp = sessionSupervisor(); if (sp) p = { id: sp.id, name: sp.name, role: 'مشرف', base: Number(sp.salary || 0), adj: supAdjustments(sp), paid: supPaid(sp), schedule: sp.schedule, log: sp.attendanceLog, logTitle: 'سجل حضوري (تسجيلات الدخول)' }; }
      else if (session.kind === 'teacher' && isCenter()) { const t = sessionTeacher(); if (t) p = { id: t.id, name: t.name, role: 'معلم', base: teacherDues(t), adj: personAdjustments('teacher', t.id), paid: personPaid('teacher', t.id), schedule: t.workSchedule, log: null, logTitle: '' }; }
      else if (session.kind === 'employee') { const st = find('staff', session.id); if (st) p = { id: st.id, name: st.name, role: st.jobTitle || 'موظف', base: Number(st.salary || 0), adj: personAdjustments('staff', st.id), paid: personPaid('staff', st.id), schedule: st.schedule, log: null, logTitle: '' }; }
      if (!p) return '<p class="empty">غير متاح.</p>';
      const net = Math.max(0, p.base + p.adj.bonus - p.adj.deduct - p.paid);
      const kind = session.kind === 'supervisor' ? 'supervisor' : session.kind === 'teacher' ? 'teacher' : 'staff';
      const hist = personSalaryRows(kind, p.id);
      const HT = hist.reduce((a, r) => ({ base: a.base + r.base, bonus: a.bonus + r.bonus, deduct: a.deduct + r.deduct, paid: a.paid + r.paid, net: a.net + r.net }), { base: 0, bonus: 0, deduct: 0, paid: 0, net: 0 });
      return reportTools() + `<div class="grid stats"><div class="stat-card"><span class="label">الراتب الأساسي</span><strong>${money(p.base)}</strong></div><div class="stat-card"><span class="label">بونص هذا الشهر</span><strong style="color:var(--success)">${money(p.adj.bonus)}</strong></div><div class="stat-card"><span class="label">خصومات هذا الشهر</span><strong style="color:var(--danger)">${money(p.adj.deduct)}</strong></div><div class="stat-card"><span class="label">صافي المستحق</span><strong>${money(net)}</strong></div></div><section class="panel" style="margin-top:14px"><h2>📅 كشف رواتبي منذ تعييني (${(hist[0] || {}).m || month()} حتى ${month()})</h2><div class="table-wrap"><table><thead><tr><th>الشهر</th><th>الأساسي</th><th>بونص</th><th>خصم</th><th>المصروف</th><th>الصافي</th></tr></thead><tbody>${hist.map(r => `<tr><td><b>${esc(r.m)}</b></td><td>${money(r.base)}</td><td style="color:var(--success)">${money(r.bonus)}</td><td style="color:var(--danger)">${money(r.deduct)}</td><td>${money(r.paid)}</td><td><b>${money(r.net)}</b></td></tr>`).join('')}</tbody><tfoot><tr style="font-weight:800"><td>الإجمالي</td><td>${money(HT.base)}</td><td>${money(HT.bonus)}</td><td>${money(HT.deduct)}</td><td>${money(HT.paid)}</td><td>${money(HT.net)}</td></tr></tfoot></table></div></section><div class="grid" style="grid-template-columns:1fr 1fr;margin-top:14px"><section class="panel"><h3>مواعيد الحضور المطلوبة</h3><div class="table-wrap"><table style="min-width:0"><thead><tr><th>اليوم</th><th>الوقت</th></tr></thead><tbody>${(p.schedule?.days || []).map(d => `<tr><td>${esc(d)}</td><td>${esc(p.schedule.time || '—')}</td></tr>`).join('') || '<tr><td colspan="2" class="empty">لم تُحدد مواعيد بعد.</td></tr>'}</tbody></table></div>${p.log ? `<h3>${esc(p.logTitle)}</h3><div class="table-wrap"><table style="min-width:0"><thead><tr><th>التاريخ</th><th>الوقت</th></tr></thead><tbody>${p.log.slice(-20).reverse().map(l => `<tr><td>${esc(l.date)}</td><td>${esc(l.time)}</td></tr>`).join('') || '<tr><td colspan="2" class="empty">لا يوجد سجل بعد.</td></tr>'}</tbody></table></div>` : ''}</section><section class="panel"><h3>تعديلات الراتب — ${month()} (بالأسباب)</h3><div class="table-wrap"><table style="min-width:0"><thead><tr><th>النوع</th><th>السبب</th><th>بواسطة</th><th>المبلغ</th></tr></thead><tbody>${(p.adj.list || []).map(x => `<tr><td>${badge(x.type === 'bonus' ? 'بونص' : 'خصم', x.type === 'bonus' ? 'success' : 'danger')}</td><td>${esc(x.reason)}</td><td>${esc(x.by)}</td><td style="color:${x.type === 'bonus' ? 'var(--success)' : 'var(--danger)'}">${x.type === 'bonus' ? '+' : '-'}${money(x.amount)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">لا توجد تعديلات.</td></tr>'}</tbody><tfoot><tr style="font-weight:800"><td colspan="3">المصروف لي / المتبقي</td><td>${money(p.paid)} / ${money(net)}</td></tr></tfoot></table></div></section></div>`;
    }
    return '';
  }
  function exportReport(tab) {
    if (tab === 'finance') { const ev = ledger(reportMonth); return exportCSV('التقرير-المالي-' + reportMonth, ['النوع', 'البيان', 'التاريخ', 'القيمة'], ev.map(x => [x.type, x.name, x.date, (x.plus ? '' : '-') + x.amount])); }
    if (tab === 'defaulters') { const list = activeStudents().map(s => ({ s, due: studentDue(s) })).filter(x => x.due > 0); return exportCSV('المتأخرون-في-السداد', ['الطالب', 'الكود', 'المرحلة', 'هاتف ولي الأمر', 'المصروف', 'المدفوع', 'المتبقي'], list.map(x => [x.s.name, x.s.code, x.s.stage, x.s.parentPhone || x.s.phone, studentFee(x.s), studentPaid(x.s), x.due])); }
    if (tab === 'payments') { const list = myPayments(reportMonth === 'all' ? 'all' : reportMonth).filter(p => reportStudent === 'all' || p.studentId === reportStudent); return exportCSV('سجل-المدفوعات', ['التاريخ', 'الطالب', 'الكود', 'شهر الرسوم', 'المبلغ', 'حصّله'], list.map(p => { const s = find('students', p.studentId); return [p.createdAt, s?.name || '', s?.code || '', p.period, p.amount, p.collectedBy || p.receivedBy]; })); }
    if (tab === 'collections') { const list = myPayments(reportMonth === 'all' ? 'all' : reportMonth).filter(p => reportMethod === 'all' || p.kind === reportMethod); return exportCSV('مصادر-التحصيل', ['التاريخ', 'الطالب', 'المبلغ', 'الطريقة', 'النوع', 'وجهة التحويل', 'حصّله', 'شهر الرسوم'], list.map(p => [p.createdAt, studentName(p.studentId), p.amount, p.method || 'يدوي', p.kind === 'transfer' ? 'تحويل' : 'يدوي', p.destination || '', p.collectedBy || '', p.period])); }
    if (tab === 'expenses') { const inM = x => reportMonth === 'all' || x.createdAt.startsWith(reportMonth); return exportCSV('الدخل-والمصروفات', ['النوع', 'السبب', 'التاريخ', 'المبلغ'], [...db.expenses.filter(inM).map(x => ['مصروف', x.reason, x.createdAt, x.amount]), ...db.incomes.filter(inM).map(x => ['دخل', x.reason, x.createdAt, x.amount])]); }
    if (tab === 'teacherdues') { return exportCSV('المستحقات-والرواتب', ['الفئة', 'الاسم', 'النظام/المعلم', 'المستحق/الراتب', 'المدفوع', 'المتبقي'], [...db.teachers.map(t => ['معلم', t.name, t.payMode === 'percent' ? 'نسبة ' + t.payValue + '%' : t.payMode === 'salary' ? 'راتب ' + t.payValue : 'بدون', teacherDues(t), teacherPaid(t), Math.max(0, teacherDues(t) - teacherPaid(t))]), ...db.supervisors.map(sp => ['مشرف', sp.name, teacherName(sp.teacherId), sp.salary || 0, db.expenses.filter(e => e.supervisorId === sp.id && e.month === month()).reduce((a, e) => a + Number(e.amount), 0), Math.max(0, (sp.salary || 0) - db.expenses.filter(e => e.supervisorId === sp.id && e.month === month()).reduce((a, e) => a + Number(e.amount), 0))])]); }
    if (tab === 'installments') { return exportCSV('الأقساط', ['الطالب', 'الكود', 'شهر القسط', 'المبلغ', 'الحالة'], activeStudents().flatMap(s => (s.installments || []).map(i => [s.name, s.code, i.month, i.amount, i.paid ? 'مدفوع' : (i.month < month() ? 'متأخر' : 'قادم')]))); }
    if (tab === 'attendance') { const mine = activeStudents().map(s => s.id); const inR = a => a.date >= reportFrom && a.date <= reportTo && (reportGroup === 'all' || a.groupId === reportGroup) && mine.includes(a.studentId); const pool = activeStudents().filter(s => reportGroup === 'all' || s.groupIds.includes(reportGroup)); return exportCSV('تقرير-الحضور', ['الطالب', 'حضور', 'غياب', 'نسبة الحضور %'], pool.map(s => { const p = db.attendance.filter(a => a.studentId === s.id && a.status === 'present' && inR(a)).length; const ab = db.attendance.filter(a => a.studentId === s.id && a.status === 'absent' && inR(a)).length; return [s.name, p, ab, pct(p, p + ab)]; })); }
    if (tab === 'absence-log') { const mine = activeStudents().map(s => s.id); const inR = a => a.date >= reportFrom && a.date <= reportTo && (reportGroup === 'all' || a.groupId === reportGroup) && mine.includes(a.studentId); return exportCSV('الغياب-التفصيلي', ['التاريخ', 'الطالب', 'المجموعة', 'الحالة', 'وقت الحضور', 'الانصراف'], db.attendance.filter(inR).map(a => [a.date, studentName(a.studentId), groupName(a.groupId), a.status === 'present' ? 'حاضر' : 'غائب', a.time || '', a.departure || ''])); }
    if (tab === 'daily') { const d = reportDay; const mine = activeStudents().map(s => s.id); const rows = [...db.payments.filter(p => p.createdAt === d && !p.archived && mine.includes(p.studentId)).map(p => ['دفعة رسوم', studentName(p.studentId), p.amount]), ...db.incomes.filter(i => i.createdAt === d).map(i => ['دخل مالي', i.reason, i.amount]), ...db.expenses.filter(i => i.createdAt === d).map(i => ['مصروف مالي', i.reason, i.amount]), ...db.students.filter(s => s.createdAt === d && mine.includes(s.id)).map(s => ['طالب جديد', s.name, s.stage])]; return exportCSV('الملخص-اليومي-' + d, ['النوع', 'البيان', 'التفاصيل'], rows); }
    if (tab === 'grades') { const e = myExams().find(x => x.id === reportExam) || myExams()[0]; if (!e) return toast('لا توجد اختبارات للتصدير.', 'error'); return exportCSV('درجات-' + e.name, ['الترتيب', 'الطالب', 'الدرجة', 'النهائية', 'النسبة %'], [...e.grades].sort((a, b) => b.score / b.max - a.score / a.max).map((g, i) => [i + 1, studentName(g.studentId), g.score, g.max, pct(g.score, g.max)])); }
    if (tab === 'new-students') { const list = db.students.filter(s => s.createdAt >= reportFrom && s.createdAt <= reportTo && (isStaffLevel() || (s.teacherIds || []).includes(session.id))); return exportCSV('الطلاب-الجدد', ['تاريخ الانضمام', 'الطالب', 'الكود', 'المرحلة', 'سجّله', 'الحالة'], list.map(s => [s.createdAt, s.name, s.code, s.stage, s.registeredBy || '', s.status === 'active' ? 'نشط' : 'مؤرشف'])); }
    if (tab === 'books') { return exportCSV('تقرير-الكتب', ['الكتاب', 'بِيع', 'المتبقي', 'الإيراد', 'التكلفة', 'الربح', 'مستحق المورد'], db.books.map(b => { const sold = b.deliveries.filter(d => d.type === 'بيع'); const revenue = sold.reduce((a, d) => a + d.amount, 0); return [b.name, sold.length, b.qty, revenue, sold.length * b.purchase, revenue - sold.length * b.purchase, Math.max(0, (b.totalPurchased ?? b.qty + sold.length) * b.purchase - b.supplierPaid)]; })); }
    if (tab === 'teachers') { return exportCSV('أداء-المعلمين', ['المعلم', 'المادة', 'مجموعات', 'طلاب', 'اختبارات'], db.teachers.map(t => { const tg = db.groups.filter(g => (g.teacherIds || []).includes(t.id)); return [t.name, t.subject, tg.length, activeStudents().filter(s => s.groupIds.some(g => tg.some(x => x.id === g)) || (s.teacherIds || []).includes(t.id)).length, db.exams.filter(e => e.teacherId === t.id).length]; })); }
    if (tab === 'stages') { return exportCSV('توزيع-المراحل', ['المرحلة', 'السعر الشهري', 'عدد الطلاب', 'المتوقع شهرياً', 'المحصل هذا الشهر', 'متأخرون'], db.stages.map(st => { const list = activeStudents().filter(s => s.stage === st.name); return [st.name, st.fee, list.length, list.reduce((a, s) => a + studentFee(s), 0), list.reduce((a, s) => a + studentPaid(s), 0), list.filter(s => studentDue(s) > 0).length]; })); }
    if (tab === 'activity') { const pool = session.kind === 'teacher' ? db.activity.filter(l => l.user === who()) : db.activity; return exportCSV('سجل-النشاط', ['الوقت', 'المستخدم', 'العملية', 'التفاصيل'], pool.map(l => [l.at, l.user, l.action, l.detail])); }
    if (tab === 'studentcard') {
      const s = activeStudents().find(x => x.id === reportStudent) || activeStudents()[0];
      if (!s) return toast('لا يوجد طلاب في نطاقك.', 'error');
      const st = portalStats(s);
      const monthly = portalAttendanceMonthly(st.records);
      const rows = [['نسبة الحضور', st.records.length ? st.attRate + '%' : '—', st.present + ' حضور / ' + st.absent + ' غياب'], ...monthly.map(m => ['حضور ' + m.m, 'حاضر ' + m.p + ' / غائب ' + m.a, m.rate + '%']), ...st.grades.map(g => ['درجة — ' + g.exam, `${g.score}/${g.max}`, pct(g.score, g.max) + '%'])];
      if (session.kind !== 'supervisor') rows.push(['إجمالي المدفوع', money(st.totalPaid), ''], ['المتبقي هذا الشهر', money(studentDue(s)), '']);
      return exportCSV('ملف-شامل-' + s.name, ['البند', 'القيمة', 'تفاصيل'], rows);
    }
    if (tab === 'mypay') {
      let p = null;
      if (session.kind === 'supervisor') { const sp = sessionSupervisor(); if (sp) p = { name: sp.name, base: Number(sp.salary || 0), adj: supAdjustments(sp), paid: supPaid(sp), schedule: sp.schedule, log: sp.attendanceLog }; }
      else if (session.kind === 'teacher' && isCenter()) { const t = sessionTeacher(); if (t) p = { name: t.name, base: teacherDues(t), adj: personAdjustments('teacher', t.id), paid: personPaid('teacher', t.id), schedule: t.workSchedule, log: null }; }
      else if (session.kind === 'employee') { const st = find('staff', session.id); if (st) p = { name: st.name, base: Number(st.salary || 0), adj: personAdjustments('staff', st.id), paid: personPaid('staff', st.id), schedule: st.schedule, log: null }; }
      if (!p) return toast('غير متاح.', 'error');
      return exportCSV('تقريري-' + p.name, ['البند', 'القيمة'], [['الراتب الأساسي', p.base], ['بونص هذا الشهر', p.adj.bonus], ['خصومات هذا الشهر', p.adj.deduct], ['المصروف لي', p.paid], ['صافي المستحق', Math.max(0, p.base + p.adj.bonus - p.adj.deduct - p.paid)], ...p.adj.list.map(x => [`${x.type === 'bonus' ? 'بونص' : 'خصم'} — ${x.reason}`, (x.type === 'bonus' ? '' : '-') + x.amount]), ...(p.schedule?.days || []).map(d => [`موعد حضور — ${d}`, p.schedule.time || '']), ...(p.log || []).slice(-20).map(l => [`حضور مسجل — ${l.date}`, l.time])]);
    }
  }
  function printReport(tab) {
    if (tab === 'finance') { const cur = monthNet(reportMonth); return printDoc(`التقرير المالي — ${reportMonth}`, `<div class="grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">${[['رسوم محصلة', money(cur.fees)], ['دخل إضافي', money(cur.inc)], ['مصروفات', money(cur.exp)], ['الصافي', money(cur.net)]].map(x => `<div style="border:1px solid #c7d2e4;border-radius:8px;padding:8px"><small>${x[0]}</small><br><b>${x[1]}</b></div>`).join('')}</div>` + printTable(['النوع', 'البيان', 'التاريخ', 'القيمة'], ledger(reportMonth).map(x => [x.type, x.name, x.date, (x.plus ? '+' : '-') + money(x.amount)]))); }
    if (tab === 'defaulters') { const list = activeStudents().map(s => ({ s, due: studentDue(s) })).filter(x => x.due > 0).sort((a, b) => b.due - a.due); return printDoc('تقرير المتأخرين في السداد', printTable(['الطالب', 'الكود', 'المرحلة', 'هاتف ولي الأمر', 'المتبقي'], list.map(x => [x.s.name, x.s.code, x.s.stage, x.s.parentPhone || x.s.phone || '—', money(x.due)]), ['الإجمالي', '', '', '', money(list.reduce((a, x) => a + x.due, 0))])); }
    if (tab === 'payments') { const list = myPayments(reportMonth === 'all' ? 'all' : reportMonth).filter(p => reportStudent === 'all' || p.studentId === reportStudent).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); const total = list.reduce((a, p) => a + Number(p.amount), 0); return printDoc(`سجل المدفوعات ${reportMonth === 'all' ? '' : '— ' + reportMonth}`, printTable(['التاريخ', 'الطالب', 'الكود', 'شهر الرسوم', 'المبلغ', 'حصّله'], list.map(p => { const s = find('students', p.studentId); return [p.createdAt, s?.name || '—', s?.code || '—', p.period, money(p.amount), p.collectedBy || p.receivedBy || '—']; }), ['الإجمالي', '', '', '', money(total), ''])); }
    if (tab === 'collections') { const list = myPayments(reportMonth === 'all' ? 'all' : reportMonth).filter(p => reportMethod === 'all' || p.kind === reportMethod).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); return printDoc(`مصادر التحصيل ${reportMonth === 'all' ? '' : '— ' + reportMonth}`, printTable(['التاريخ', 'الطالب', 'المبلغ', 'الطريقة', 'وجهة التحويل', 'حصّله'], list.map(p => [p.createdAt, studentName(p.studentId), money(p.amount), (p.method || 'يدوي') + (p.kind === 'transfer' ? ' (تحويل)' : ' (يدوي)'), p.destination || '—', p.collectedBy || '—']))); }
    if (tab === 'expenses') { const inM = x => reportMonth === 'all' || x.createdAt.startsWith(reportMonth); const exp = db.expenses.filter(inM).reduce((a, x) => a + Number(x.amount), 0); const inc = db.incomes.filter(inM).reduce((a, x) => a + Number(x.amount), 0); const rows = [...db.expenses.filter(inM).map(x => ['مصروف', x.reason, x.createdAt, money(x.amount)]), ...db.incomes.filter(inM).map(x => ['دخل', x.reason, x.createdAt, money(x.amount)])]; return printDoc(`الدخل والمصروفات ${reportMonth === 'all' ? '' : '— ' + reportMonth}`, printTable(['النوع', 'البيان', 'التاريخ', 'المبلغ'], rows, ['الصافي', `دخل ${money(inc)} — مصروف ${money(exp)}`, '', money(inc - exp)])); }
    if (tab === 'teacherdues') { return printDoc('المستحقات والرواتب — ' + month(), printTable(['الفئة', 'الاسم', 'المستحق/الراتب', 'المدفوع', 'المتبقي'], [...db.teachers.map(t => ['معلم', t.name, money(teacherDues(t)), money(teacherPaid(t)), money(Math.max(0, teacherDues(t) - teacherPaid(t)))]), ...db.supervisors.map(sp => ['مشرف', sp.name, money(sp.salary || 0), money(db.expenses.filter(e => e.supervisorId === sp.id && e.month === month()).reduce((a, e) => a + Number(e.amount), 0)), money(Math.max(0, (sp.salary || 0) - db.expenses.filter(e => e.supervisorId === sp.id && e.month === month()).reduce((a, e) => a + Number(e.amount), 0)))])])); }
    if (tab === 'installments') { const rows = activeStudents().flatMap(s => (s.installments || []).filter(i => !i.paid).map(i => ({ s, i }))); return printDoc('الأقساط غير المدفوعة', printTable(['الطالب', 'الكود', 'شهر القسط', 'المبلغ'], rows.map(x => [x.s.name, x.s.code, x.i.month, money(x.i.amount)]), ['الإجمالي', '', '', money(rows.reduce((a, x) => a + x.i.amount, 0))])); }
    if (tab === 'attendance') { const mine = activeStudents().map(s => s.id); const inR = a => a.date >= reportFrom && a.date <= reportTo && (reportGroup === 'all' || a.groupId === reportGroup) && mine.includes(a.studentId); const pool = activeStudents().filter(s => reportGroup === 'all' || s.groupIds.includes(reportGroup)); return printDoc(`تقرير الحضور (${reportFrom} → ${reportTo})`, printTable(['الطالب', 'حضور', 'غياب', 'نسبة الحضور'], pool.map(s => { const p = db.attendance.filter(a => a.studentId === s.id && a.status === 'present' && inR(a)).length; const ab = db.attendance.filter(a => a.studentId === s.id && a.status === 'absent' && inR(a)).length; return [s.name, p, ab, pct(p, p + ab) + '%']; }))); }
    if (tab === 'absence-log') { const mine = activeStudents().map(s => s.id); const inR = a => a.date >= reportFrom && a.date <= reportTo && (reportGroup === 'all' || a.groupId === reportGroup) && mine.includes(a.studentId); return printDoc(`الغياب التفصيلي (${reportFrom} → ${reportTo})`, printTable(['التاريخ', 'الطالب', 'المجموعة', 'الحالة', 'الحضور', 'الانصراف'], db.attendance.filter(inR).map(a => [a.date, studentName(a.studentId), groupName(a.groupId), a.status === 'present' ? 'حاضر' : 'غائب', a.time || '—', a.departure || '—']))); }
    if (tab === 'daily') { const d = reportDay; const mine = activeStudents().map(s => s.id); const att = db.attendance.filter(a => a.date === d && mine.includes(a.studentId)); const rows = [...db.payments.filter(p => p.createdAt === d && !p.archived && mine.includes(p.studentId)).map(p => ['دفعة رسوم', studentName(p.studentId), money(p.amount)]), ...db.incomes.filter(i => i.createdAt === d).map(i => ['دخل مالي', i.reason, money(i.amount)]), ...db.expenses.filter(i => i.createdAt === d).map(i => ['مصروف مالي', i.reason, money(i.amount)]), ...db.students.filter(s => s.createdAt === d && mine.includes(s.id)).map(s => ['طالب جديد', s.name, s.stage]), ...att.map(a => ['حضور', studentName(a.studentId), a.status === 'present' ? (a.time || '') : 'غائب'])]; return printDoc(`الملخص اليومي — ${d}`, printTable(['النوع', 'البيان', 'التفاصيل'], rows)); }
    if (tab === 'grades') { const e = myExams().find(x => x.id === reportExam) || myExams()[0]; if (!e) return toast('لا توجد اختبارات للطباعة.', 'error'); return printDoc(`نتائج — ${e.name}`, printTable(['الترتيب', 'الطالب', 'الدرجة', 'النسبة'], [...e.grades].sort((a, b) => b.score / b.max - a.score / a.max).map((g, i) => [i + 1, studentName(g.studentId), `${g.score}/${g.max}`, pct(g.score, g.max) + '%']))); }
    if (tab === 'new-students') { const list = db.students.filter(s => s.createdAt >= reportFrom && s.createdAt <= reportTo && (isStaffLevel() || (s.teacherIds || []).includes(session.id))); return printDoc(`الطلاب الجدد (${reportFrom} → ${reportTo})`, printTable(['تاريخ الانضمام', 'الطالب', 'الكود', 'المرحلة', 'سجّله'], list.map(s => [s.createdAt, s.name, s.code, s.stage, s.registeredBy || '—']))); }
    if (tab === 'books') { return printDoc('تقرير الكتب والمبيعات', printTable(['الكتاب', 'بِيع', 'المتبقي', 'الإيراد', 'الربح', 'مستحق المورد'], db.books.map(b => { const sold = b.deliveries.filter(d => d.type === 'بيع'); const revenue = sold.reduce((a, d) => a + d.amount, 0); return [b.name, sold.length, b.qty, money(revenue), money(revenue - sold.length * b.purchase), money(Math.max(0, (b.totalPurchased ?? b.qty + sold.length) * b.purchase - b.supplierPaid))]; }))); }
    if (tab === 'teachers') { return printDoc('تقرير أداء المعلمين', printTable(['المعلم', 'المادة', 'مجموعات', 'طلاب', 'اختبارات'], db.teachers.map(t => { const tg = db.groups.filter(g => (g.teacherIds || []).includes(t.id)); return [t.name, t.subject, tg.length, activeStudents().filter(s => s.groupIds.some(g => tg.some(x => x.id === g)) || (s.teacherIds || []).includes(t.id)).length, db.exams.filter(e => e.teacherId === t.id).length]; }))); }
    if (tab === 'stages') { return printDoc('توزيع المراحل والمجموعات', `<h3>حسب المرحلة</h3>` + printTable(['المرحلة', 'السعر الشهري', 'عدد الطلاب', 'المتوقع شهرياً', 'المحصل هذا الشهر'], db.stages.map(st => { const list = activeStudents().filter(s => s.stage === st.name); return [st.name, money(st.fee), list.length, money(list.reduce((a, s) => a + studentFee(s), 0)), money(list.reduce((a, s) => a + studentPaid(s), 0))]; })) + `<h3 style="margin-top:14px">المجموعات</h3>` + printTable(['المجموعة', 'المعلمون', 'المسجلون / السعة'], myGroups().map(g => [g.name, (g.teacherIds || []).map(teacherName).join('، '), `${db.students.filter(s => s.status === 'active' && s.groupIds.includes(g.id)).length} / ${g.capacity}`]))); }
    if (tab === 'activity') { const pool = session.kind === 'teacher' ? db.activity.filter(l => l.user === who()) : db.activity; return printDoc('سجل النشاط', printTable(['الوقت', 'المستخدم', 'العملية', 'التفاصيل'], pool.map(l => [l.at, l.user, l.action, l.detail]))); }
    if (tab === 'studentcard') {
      const s = activeStudents().find(x => x.id === reportStudent) || activeStudents()[0];
      if (!s) return toast('لا يوجد طلاب للطباعة.', 'error');
      const st = portalStats(s);
      const monthly = portalAttendanceMonthly(st.records);
      const rankPool = activeStudents().filter(x => x.groupIds.some(g => s.groupIds.includes(g)));
      const avgOf = x => { const gs = db.exams.flatMap(e => e.grades.filter(g => g.studentId === x.id)); return gs.length ? gs.reduce((a, g) => a + g.score / g.max * 100, 0) / gs.length : null; };
      const ranked = rankPool.map(x => ({ id: x.id, avg: avgOf(x) })).filter(x => x.avg !== null).sort((a, b) => b.avg - a.avg);
      const myRank = ranked.findIndex(x => x.id === s.id) + 1;
      const head = `<div class="grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">${[['الطالب', s.name], ['الكود', s.code], ['المرحلة', s.stage], ['المجموعات', s.groupIds.map(groupName).join('، ') || '—']].map(x => `<div style="border:1px solid #c7d2e4;border-radius:8px;padding:8px"><small>${x[0]}</small><br><b>${esc(x[1])}</b></div>`).join('')}</div>`;
      const attPart = printTable(['إجمالي الحضور', 'إجمالي الغياب', 'نسبة الحضور'], [[st.present, st.absent, (st.records.length ? st.attRate : 0) + '%']]) + (monthly.length ? printTable(['الشهر', 'حضور', 'غياب', 'النسبة'], monthly.map(m => [m.m, m.p, m.a, m.rate + '%'])) : '');
      const gradesPart = printTable(['الاختبار', 'التاريخ', 'الدرجة', 'النسبة'], st.grades.map(g => [g.exam, g.date, `${g.score}/${g.max}`, pct(g.score, g.max) + '%']));
      const rankPart = myRank ? `<p>الترتيب بين زملائه في المجموعات: <b>${myRank} من ${ranked.length}</b> — بمعدل ${st.grades.length ? st.avg + '%' : '—'}</p>` : '';
      const moneyPart = session.kind === 'supervisor' ? '' : printTable(['البيان', 'القيمة'], [['إجمالي المدفوع', money(st.totalPaid)], ['المتبقي هذا الشهر', money(studentDue(s))], ['طريقة الدفع', studentPayMode(s)]]);
      return printDoc(`ملف شامل — ${s.name}`, head + `<h3>الحضور</h3>` + attPart + `<h3 style="margin-top:12px">الدرجات</h3>` + gradesPart + rankPart + (moneyPart ? `<h3 style="margin-top:12px">المصروفات</h3>` + moneyPart : ''));
    }
    if (tab === 'mypay') {
      let p = null;
      if (session.kind === 'supervisor') { const sp = sessionSupervisor(); if (sp) p = { name: sp.name, base: Number(sp.salary || 0), adj: supAdjustments(sp), paid: supPaid(sp), schedule: sp.schedule, log: sp.attendanceLog }; }
      else if (session.kind === 'teacher' && isCenter()) { const t = sessionTeacher(); if (t) p = { name: t.name, base: teacherDues(t), adj: personAdjustments('teacher', t.id), paid: personPaid('teacher', t.id), schedule: t.workSchedule, log: null }; }
      else if (session.kind === 'employee') { const st = find('staff', session.id); if (st) p = { name: st.name, base: Number(st.salary || 0), adj: personAdjustments('staff', st.id), paid: personPaid('staff', st.id), schedule: st.schedule, log: null }; }
      if (!p) return toast('غير متاح.', 'error');
      const net = Math.max(0, p.base + p.adj.bonus - p.adj.deduct - p.paid);
      return printDoc(`تقريري — ${p.name} (${month()})`, `<div class="grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">${[['الراتب الأساسي', money(p.base)], ['بونص', money(p.adj.bonus)], ['خصومات', money(p.adj.deduct)], ['صافي المستحق', money(net)]].map(x => `<div style="border:1px solid #c7d2e4;border-radius:8px;padding:8px"><small>${x[0]}</small><br><b>${x[1]}</b></div>`).join('')}</div>` + `<h3>مواعيد الحضور المطلوبة</h3>` + printTable(['اليوم', 'الوقت'], (p.schedule?.days || []).map(d => [d, p.schedule.time || '—'])) + `<h3 style="margin-top:12px">تعديلات الراتب (بالأسباب)</h3>` + printTable(['النوع', 'السبب', 'بواسطة', 'المبلغ'], p.adj.list.map(x => [x.type === 'bonus' ? 'بونص' : 'خصم', x.reason, x.by, money(x.amount)])) + (p.log ? `<h3 style="margin-top:12px">سجل الحضور</h3>` + printTable(['التاريخ', 'الوقت'], p.log.slice(-20).map(l => [l.date, l.time])) : ''));
    }
  }

  /* ===== الكتب (للإدارة) ===== */
  const bookDebt = b => Math.max(0, (b.totalPurchased ?? b.qty) * b.purchase - b.supplierPaid);
  function books() { const rows = db.books.map(b => { const sold = b.deliveries.filter(d => d.type === 'بيع').length; return `<tr data-search="${esc(b.name + ' ' + b.stage)}"><td><b>${esc(b.name)}</b></td><td>${esc(b.stage)}</td><td>${esc(find('suppliers', b.supplierId)?.name || '—')}</td><td>${b.qty}</td><td>${money(b.sale)}</td><td>${money(bookDebt(b))}</td><td>${sold}</td><td><div class="actions">${btn('تسليم', 'deliver-book', b.id)}${btn('＋ كمية', 'stock-book', b.id)}${btn('إحصاء', 'book-stats', b.id)}${btn('✎', 'edit-book', b.id)}${btn('⌫', 'delete-book', b.id, 'action', 'حذف')}</div></td></tr>`; }).join(''); return pageHead('الكتب', 'المخزون والموردون وتسليمات الكتب', `<div class="actions"><button class="btn btn-light" data-action="add-supplier">＋ مورد</button><button class="btn btn-primary" data-action="add-book">＋ كتاب</button></div>`) + tableToolbar('ابحث باسم الكتاب') + `<div class="table-wrap"><table><thead><tr><th data-sortable>الكتاب ↕</th><th>المرحلة</th><th>المورد</th><th data-sortable>الكمية ↕</th><th>سعر البيع</th><th>متبقي المورد</th><th data-sortable>مبيعات ↕</th><th>إجراءات</th></tr></thead><tbody>${rows}</tbody></table></div>`; }
  function supplierForm() { modal('إضافة مورد', `<div class="form-grid">${field('name', 'اسم المورد/المطبعة', '', 'text', true)}${field('phone', 'رقم الهاتف', '', 'tel')}<div class="field"><label>ملاحظة</label><textarea name="note"></textarea></div></div>`, data => { db.suppliers.push({ id: 'v-' + uid(), name: data.get('name'), phone: data.get('phone'), note: data.get('note') }); save(); closeModal(); render(); toast('تمت إضافة المورد.'); }); }
  function bookForm(book = {}) { modal(book.id ? 'تعديل كتاب' : 'إضافة كتاب', `<div class="form-grid">${field('name', 'اسم الكتاب', book.name, 'text', true)}${selectField('stage', 'المرحلة', ['عام لكل المراحل', ...db.stages.map(s => s.name)], book.stage || db.stages[0]?.name, true)}${selectField('supplierId', 'المورد', db.suppliers, book.supplierId || db.suppliers[0]?.id, true, '', x => [x.id, x.name])}${field('qty', 'الكمية المتاحة', book.qty ?? 1, 'number', true, 'min="0"')}${field('purchase', 'سعر الشراء', book.purchase ?? 0, 'number', true, 'min="0"')}${field('sale', 'سعر البيع', book.sale ?? 0, 'number', true, 'min="0"')}${field('supplierPaid', 'مدفوع للمورد حتى الآن', book.supplierPaid ?? 0, 'number', false, 'min="0"')}</div>`, data => { const item = { ...book, id: book.id || 'b-' + uid(), name: data.get('name'), stage: data.get('stage'), supplierId: data.get('supplierId'), qty: Number(data.get('qty') || 0), totalPurchased: book.totalPurchased ?? Number(data.get('qty') || 0), purchase: Number(data.get('purchase') || 0), sale: Number(data.get('sale') || 0), supplierPaid: Number(data.get('supplierPaid') || 0), deliveries: book.deliveries || [] }; if (book.id) Object.assign(book, item); else db.books.push(item); save(); closeModal(); render(); toast('تم حفظ بيانات الكتاب.'); }); }
  function deliverBook(id) { const b = find('books', id); modal(`تسليم — ${esc(b.name)}`, `<div class="notice">المتاح بالمخزون: <b>${b.qty}</b> — سعر البيع ${money(b.sale)}. عملية البيع تُسجل تلقائياً في الدخل المالي.</div><div class="form-grid">${selectField('studentId', 'الطالب', activeStudents(), activeStudents()[0]?.id, true, '', x => [x.id, x.name])}${selectField('type', 'نوع التسليم', ['بيع', 'حجز', 'مجاني'], 'بيع', true)}${field('amount', 'المبلغ المسدد', b.sale, 'number', true, 'min="0"')}</div>`, data => { if (data.get('type') === 'بيع' && b.qty <= 0) return toast('لا توجد كمية متاحة في المخزون.', 'error'); const student = find('students', data.get('studentId')); b.deliveries.push({ id: 'd-' + uid(), studentId: data.get('studentId'), type: data.get('type'), amount: Number(data.get('amount')), date: date() }); if (data.get('type') === 'بيع') { b.qty--; if (Number(data.get('amount')) > 0) db.incomes.push({ id: 'i-' + uid(), amount: Number(data.get('amount')), reason: `بيع كتاب «${b.name}» — ${student?.name || ''}`, createdAt: date(), user: who() }); } logAct('تسليم كتاب', `${b.name} — ${data.get('type')} — ${student?.name || ''}`); save(); closeModal(); render(); toast('تم تسجيل تسليم الكتاب.'); }); }
  function stockBook(id) { const b = find('books', id); modal(`إضافة كمية — ${esc(b.name)}`, `<div class="form-grid">${field('qty', 'الكمية الواردة', 1, 'number', true, 'min="1"')}${field('payment', 'دفعة للمورد', 0, 'number', false, 'min="0"')}</div>`, data => { const q = Number(data.get('qty') || 0), pay = Number(data.get('payment') || 0); b.qty += q; b.totalPurchased = (b.totalPurchased ?? b.qty - q) + q; b.supplierPaid += pay; if (pay > 0) db.expenses.push({ id: 'x-' + uid(), amount: pay, reason: `دفعة مورد — ${b.name}`, createdAt: date(), user: who() }); logAct('تحديث مخزون', b.name + ' +' + q); save(); closeModal(); render(); toast('تم تحديث المخزون وحساب المورد.'); }); }
  function bookStats(id) { const b = find('books', id), sold = b.deliveries.filter(x => x.type === 'بيع'), profit = sold.reduce((a, x) => a + (x.amount - b.purchase), 0); modal(`إحصائيات — ${esc(b.name)}`, `<div class="grid stats"><div class="stat-card"><span class="label">المتبقي</span><strong>${b.qty}</strong></div><div class="stat-card"><span class="label">مبيعات</span><strong>${sold.length}</strong></div><div class="stat-card"><span class="label">ربح ظاهر</span><strong>${money(profit)}</strong></div><div class="stat-card"><span class="label">حجوزات</span><strong>${b.deliveries.filter(x => x.type === 'حجز').length}</strong></div></div><ul class="list">${b.deliveries.map(d => `<li><span>${esc(studentName(d.studentId))} — ${esc(d.type)}<br><small>${esc(d.date)}</small></span><b>${money(d.amount)}</b></li>`).join('') || '<li>لا توجد تسليمات.</li>'}</ul>`, () => closeModal(), 'إغلاق'); }

  /* ===== مقرات الدروس: الإيجار والمشرفون وأرباح كل مقر ===== */
  function venueStats(v, m = month()) {
    const vGroups = db.groups.filter(g => g.venueId === v.id);
    const gids = vGroups.map(g => g.id);
    const revenue = db.payments.filter(p => !p.archived && p.period === m && gids.some(gid => find('students', p.studentId)?.groupIds.includes(gid))).reduce((a, p) => a + Number(p.amount), 0);
    const supCost = (v.supervisorIds || []).map(sid => find('supervisors', sid)).filter(Boolean).reduce((a, sp) => { const adj = supAdjustments(sp, m); return a + Number(sp.salary || 0) + adj.bonus - adj.deduct; }, 0);
    const costs = Number(v.rent || 0) + supCost;
    return { revenue, costs, profit: revenue - costs, groups: vGroups.length, supCost };
  }
  function venues() {
    const rows = db.venues.map(v => { const s = venueStats(v); const sups = (v.supervisorIds || []).map(id => find('supervisors', id)?.name).filter(Boolean).join('، '); return `<tr data-search="${esc(v.name + ' ' + (v.location || ''))}"><td><b>${esc(v.name)}</b><br><small>${esc(v.location || '—')}</small></td><td>${money(v.rent || 0)}</td><td>${sups || '—'}</td><td>${s.groups}</td><td style="color:var(--success)"><b>${money(s.revenue)}</b></td><td>${money(s.costs)}<br><small>إيجار ${money(v.rent || 0)} + رواتب ${money(s.supCost)}</small></td><td style="color:${s.profit >= 0 ? 'var(--success)' : 'var(--danger)'}"><b>${money(s.profit)}</b></td><td><div class="actions">${btn('✎', 'edit-venue', v.id)}${btn('⌫', 'delete-venue', v.id)}</div></td></tr>`; }).join('');
    const T = db.venues.reduce((a, v) => { const s = venueStats(v); return { revenue: a.revenue + s.revenue, costs: a.costs + s.costs, profit: a.profit + s.profit }; }, { revenue: 0, costs: 0, profit: 0 });
    return pageHead('مقرات الدروس', 'أضف مقراتك وحدد إيجارها الشهري والمشرفين المسؤولين عنها وراقب أرباح كل مقر (إيراد مجموعاته − إيجاره − رواتب مشرفيه)', `<button class="btn btn-primary" data-action="add-venue">＋ إضافة مقر</button>`) + `<div class="grid stats"><div class="stat-card"><span class="label">عدد المقرات</span><strong>${db.venues.length}</strong></div><div class="stat-card"><span class="label">إيراد الشهر من كل المقرات</span><strong style="color:var(--success)">${money(T.revenue)}</strong></div><div class="stat-card"><span class="label">التكاليف (إيجارات ورواتب)</span><strong style="color:var(--danger)">${money(T.costs)}</strong></div><div class="stat-card"><span class="label">صافي أرباح المقرات</span><strong>${money(T.profit)}</strong></div></div><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>المقر</th><th>الإيجار الشهري</th><th>المشرفون المسؤولون</th><th>مجموعات</th><th>إيراد ${month()}</th><th>التكاليف</th><th>الربح</th><th>إجراءات</th></tr></thead><tbody>${rows || `<tr><td colspan="8" class="empty">لا توجد مقرات — أضف أول مقر</td></tr>`}</tbody></table></div>`;
  }
  function venueForm(v = {}) {
    modal(v.id ? 'تعديل مقر' : 'إضافة مقر', `<div class="form-grid">${field('name', 'اسم المقر', v.name, 'text', true)}${field('location', 'العنوان / المنطقة', v.location || '', 'text')}${field('rent', 'الإيجار الشهري', v.rent ?? 0, 'number', true, 'min="0"')}<div class="field" style="grid-column:1/-1"><label>المشرفون المسؤولون عن المقر (اختياري — تُحسب رواتبهم ضمن تكاليف المقر)</label><div class="permission-grid">${db.supervisors.map(sp => `<label><input type="checkbox" name="supervisorIds" value="${esc(sp.id)}" ${(v.supervisorIds || []).includes(sp.id) ? 'checked' : ''}> ${esc(sp.name)} — ${esc(teacherName(sp.teacherId))}</label>`).join('') || '<span class="empty" style="padding:8px">لا يوجد مشرفون بعد.</span>'}</div></div></div><div class="notice">اربط المجموعات بالمقر من نموذج المجموعة (حقل «المقر») ليُحسب إيرادها ضمن أرباح المقر.</div>`, data => {
      const item = { ...v, id: v.id || 'vn-' + uid(), name: data.get('name'), location: data.get('location'), rent: Number(data.get('rent') || 0), supervisorIds: data.getAll('supervisorIds') };
      if (!item.name) return toast('اكتب اسم المقر.', 'error');
      if (v.id) Object.assign(v, item); else db.venues.push(item);
      logAct(v.id ? 'تعديل مقر' : 'إضافة مقر', item.name);
      save(); closeModal(); render(); toast('تم حفظ المقر.');
    });
  }

  /* ===== الموظفون بوظائف حرة (مسئول سوشيال ميديا…) ===== */
  function staffPage() {
    const rows = db.staff.map(st => { const adj = personAdjustments('staff', st.id); const paid = personPaid('staff', st.id); const net = Math.max(0, Number(st.salary || 0) + adj.bonus - adj.deduct - paid); return `<tr data-search="${esc(st.name + ' ' + (st.jobTitle || ''))}"><td><b>${esc(st.name)}</b><br><small>${esc(st.username)}</small></td><td>${badge(st.jobTitle || 'موظف', 'info')}</td><td>${esc(st.phone || '—')}</td><td>${money(st.salary || 0)}${adj.bonus ? ` <small style="color:var(--success)">+${money(adj.bonus)}</small>` : ''}${adj.deduct ? ` <small style="color:var(--danger)">-${money(adj.deduct)}</small>` : ''}</td><td>${st.subscriptionEnd ? subBadge(st.subscriptionEnd) : badge('دائم', 'success')}</td><td><div class="actions">${btn('± خصم/بونص', 'adjust-staff', st.id, 'btn btn-sm btn-light')}${btn('صرف', 'pay-staff', st.id, 'btn btn-sm btn-primary')}${btn('✎', 'edit-staff', st.id)}${btn('⌫', 'delete-staff', st.id)}</div></td></tr>`; }).join('');
    return pageHead('الموظفون', 'أضف موظفين بوظائف حرة مثل مسئول السوشيال ميديا — لكل موظف اسم مستخدم وكلمة مرور للدخول وراتب مع خصومات وبونص', `<button class="btn btn-primary" data-action="add-staff">＋ إضافة موظف</button>`) + `<div class="table-wrap"><table><thead><tr><th>الموظف</th><th>الوظيفة</th><th>الهاتف</th><th>الراتب (مع التعديلات)</th><th>صلاحية الوصول</th><th>إجراءات</th></tr></thead><tbody>${rows || `<tr><td colspan="6" class="empty">لا يوجد موظفون بعد</td></tr>`}</tbody></table></div>`;
  }
  function staffForm(st = {}) {
    modal(st.id ? 'تعديل موظف' : 'إضافة موظف', `<div class="form-grid">${field('name', 'الاسم', st.name, 'text', true)}${field('jobTitle', 'الوظيفة (مثال: مسئول السوشيال ميديا)', st.jobTitle || '', 'text', true)}${field('phone', 'رقم الهاتف', st.phone || '', 'tel')}${field('username', 'اسم المستخدم للدخول', st.username || '', 'text', true)}${field('password', 'كلمة المرور', st.password || '', 'text', true)}${field('salary', 'الراتب الشهري', st.salary ?? 0, 'number', true, 'min="0"')}${field('subscriptionEnd', 'صلاحية الوصول حتى (اختياري — فارغ = دائم)', st.subscriptionEnd || '', 'date')}</div><div class="notice">الموظف يدخل باسم المستخدم وكلمة المرور ويرى لوحته الشخصية براتبه ومستحقاته فقط. يمكن إضافة خصم أو بونص له بسبب يظهر في لوحته.</div>`, data => {
      const username = String(data.get('username') || '').trim();
      const item = { ...st, id: st.id || 'st-' + uid(), name: data.get('name'), jobTitle: data.get('jobTitle'), phone: data.get('phone'), username, password: String(data.get('password') || '').trim(), salary: Number(data.get('salary') || 0), subscriptionEnd: data.get('subscriptionEnd') || '' };
      const dup = checkUniqueCredentials(item.username, item.phone, { kind: 'staff', id: st.id || '' }, item.password, item.password !== (st.password || ''));
      if (dup) return toast(dup, 'error');
      if (!item.name || !item.username) return toast('الاسم واسم المستخدم مطلوبان.', 'error');
      if (st.id) Object.assign(st, item); else db.staff.push(item);
      logAct(st.id ? 'تعديل موظف' : 'إضافة موظف', item.name + ' — ' + (item.jobTitle || ''));
      save(); closeModal(); render(); toast('تم حفظ بيانات الموظف — يمكنه الدخول الآن.');
    });
  }

  /* ===== المطبوعات ===== */
  function chooseGroupDoc(title, then) { const gs = myGroups(); modal(title, `<div class="form-grid">${selectField('groupId', 'المجموعة', gs, gs[0]?.id, true, '', x => [x.id, x.name])}</div>`, data => { const g = data.get('groupId'); closeModal(); if (g) then(g); }, 'طباعة'); }
  function printAbsenceSheet(groupId) {
    const g = find('groups', groupId); const [y, m] = month().split('-'); const days = new Date(+y, +m, 0).getDate();
    const students = activeStudents().filter(s => s.groupIds.includes(groupId));
    printDoc(`كشف غياب — ${g.name} (${month()})`, printTable(['الطالب', ...Array.from({ length: days }, (_, i) => i + 1), 'إجمالي'], students.map(s => [s.name, ...Array(days).fill(''), ''])), 'window.print();');
  }
  function printNamesSheet(groupId) { const g = find('groups', groupId); printDoc(`كشف أسماء — ${g.name}`, printTable(['م', 'اسم الطالب', 'الكود', 'هاتف الطالب', 'هاتف ولي الأمر'], activeStudents().filter(s => s.groupIds.includes(groupId)).map((s, i) => [i + 1, s.name, s.code, s.phone || '—', s.parentPhone || '—'])), 'window.print();'); }
  function printBarcodes() {
    const cards = activeStudents().map(s => `<div class="barcode-card"><b>${esc(s.name)}</b><div class="code">${esc(s.code)}</div><svg class="bc" data-code="${esc(s.code)}"></svg></div>`).join('');
    printDoc('باركود الطلاب', `<div class="barcode-grid">${cards}</div>`, `
      var s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
      s.onload=function(){document.querySelectorAll('.bc').forEach(function(svg){try{JsBarcode(svg,svg.dataset.code,{format:'CODE128',height:44,width:1.6,fontSize:0,margin:2});}catch(e){}});setTimeout(function(){window.print();},300);};
      s.onerror=function(){setTimeout(function(){window.print();},300);};
      document.head.append(s);`);
  }
  function printCards() {
    const cards = activeStudents().map(s => `<div class="id-card"><div class="ic-head">${esc(db.settings.centerName)}</div><div class="ic-name">${esc(s.name)}</div><div class="ic-meta">${esc(s.stage)} — كود: ${esc(s.code)}</div><div class="ic-qr" data-code="${esc(s.code)}"></div><div class="ic-code">${esc(s.code)}</div></div>`).join('');
    printDoc('بطاقات الطلاب', `<div class="id-grid">${cards}</div>`, `
      var s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs@master/qrcode.min.js';
      s.onload=function(){document.querySelectorAll('.ic-qr').forEach(function(el){try{new QRCode(el,{text:el.dataset.code,width:80,height:80,correctLevel:QRCode.CorrectLevel.M});}catch(e){}});setTimeout(function(){window.print();},400);};
      s.onerror=function(){setTimeout(function(){window.print();},300);};
      document.head.append(s);`);
  }
  function prints() { return pageHead('المطبوعات', 'الكشوف والتقارير القابلة للطباعة') + `<div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr))"><section class="panel"><h2>كشف غياب</h2><p>كشف فارغ لأيام الشهر الحالي لطلاب المجموعة المختارة.</p><button class="btn btn-primary" data-action="print-absence">طباعة الكشف</button></section><section class="panel"><h2>كشف أسماء</h2><p>أسماء الطلاب وأكوادهم وهواتفهم في المجموعة المختارة.</p><button class="btn btn-primary" data-action="print-names">طباعة الأسماء</button></section><section class="panel"><h2>باركود الطلاب</h2><p>باركود حقيقي (CODE128) لكل طالب يصلح للطباعة على ملصقات وقارئ الكارت.</p><button class="btn btn-primary" data-action="print-barcode">طباعة الباركود</button></section><section class="panel"><h2>بطاقات الطلاب QR</h2><p>بطاقة هوية لكل طالب تحمل QR بكوده — تصلح للتثبيت على الكراسات أو الكارت.</p><button class="btn btn-primary" data-action="print-cards">طباعة البطاقات</button></section></div>`; }

  /* ===== الإشعارات ===== */
  function notifications() { return pageHead('الإشعارات', 'إرسال رسالة خاصة جماعية للطلاب أو أولياء الأمور عبر واتساب') + `<section class="panel"><div class="form-grid"><div class="field" style="grid-column:1/-1"><label>نص الرسالة</label><textarea id="notify-message" placeholder="اكتب الرسالة… استخدم $ لاسم الطالب حسب القالب"></textarea></div>${selectField('recipient', 'إرسال إلى', ['ولي الأمر', 'الطالب'], 'ولي الأمر', false, 'id="notify-recipient"')}${selectField('stage', 'المرحلة', ['كل المراحل', ...db.stages.map(s => s.name)], 'كل المراحل', false, 'id="notify-stage"')}${selectField('group', 'المجموعة', ['كل المجموعات', ...myGroups().map(g => g.name)], 'كل المجموعات', false, 'id="notify-group"')}${field('limit', 'حد الإرسال', 100, 'number', false, 'id="notify-limit" min="1"')}${field('skip', 'تخطي من البداية', 0, 'number', false, 'id="notify-skip" min="0"')}</div><div class="notice">استخدم $ داخل النص ليُستبدل باسم كل طالب. بعد الضغط سيُفتح ملخص بروابط واتساب جاهزة لكل مستلم.</div><button class="btn btn-primary" data-action="send-notification">إرسال الرسالة</button></section><section class="panel" style="margin-top:16px"><h2>آخر الإرسالات</h2><ul class="list">${db.notifications.slice(-8).reverse().map(n => `<li><span>${esc(n.message)}<br><small>${n.count} مستلم — ${n.createdAt}</small></span><small>${esc(n.recipient || '')}</small></li>`).join('') || '<li>لا توجد رسائل مرسلة بعد.</li>'}</ul></section>`; }

  /* ===== الإعدادات (للإدارة) ===== */
  function settings() {
    const tabs = [['system', 'إعدادات النظام'], ['forms', 'نماذج التسجيل'], ['stages', 'المراحل والمواد'], ['students', 'الطلاب'], ['money', 'الأموال'], ['attendance', 'الغياب'], ['groups', 'المجموعات'], ['notifications', 'الإشعارات'], ['registration', 'التقديم الإلكتروني'], ['integration', 'الربط الإلكتروني']];
    let body = '';
    if (settingsTab === 'system') body = `<div class="form-grid">${field('centerName', 'اسم المعلم/السنتر', db.settings.centerName, 'text', true)}${session.kind === 'admin' ? selectField('type', 'نوع النسخة', [['teacher', 'معلم مفرد'], ['center', 'سنتر']], db.settings.type, true) : `<div class="field"><label>نوع النسخة</label><input value="سنتر (يحددها مدير النظام فقط)" disabled></div>`}${field('monthlyFee', 'المصروف الشهري الافتراضي (لمن لا سعر لمرحلته)', db.settings.monthlyFee, 'number', true)}${checkField('confirmDelete', 'تأكيد عمليات الحذف', db.settings.confirmDelete)}${checkField('dark', 'الوضع الداكن', db.settings.dark)}</div>`;
    if (settingsTab === 'forms') return formsTabBody();
    if (settingsTab === 'stages') body = `<div class="section-title" style="margin-bottom:10px">المراحل الدراسية وسعرها الشهري</div><div class="table-wrap"><table style="min-width:0"><thead><tr><th>المرحلة</th><th>المصروف الشهري</th><th>طلاب</th><th>مجموعات</th><th>إجراءات</th></tr></thead><tbody>${db.stages.map(st => `<tr><td><b>${esc(st.name)}</b></td><td>${money(st.fee)}</td><td>${db.students.filter(s => s.status === 'active' && s.stage === st.name).length}</td><td>${db.groups.filter(g => g.stage === st.name).length}</td><td><div class="actions">${btn('✎', 'edit-stage', st.id)}${btn('⌫', 'delete-stage', st.id)}</div></td></tr>`).join('') || '<tr><td colspan="5" class="empty">لا توجد مراحل — أضف واحدة.</td></tr>'}</tbody></table></div><div style="margin:12px 0 22px">${btn('＋ إضافة مرحلة', 'add-stage', '', 'btn btn-primary')}</div><div class="section-title" style="margin-bottom:10px">المواد الدراسية</div><div class="toolbar" style="margin-bottom:12px"><div class="search"><input id="new-subject" placeholder="اكتب اسم المادة الجديدة ثم Enter"></div><button class="btn btn-primary btn-sm" data-action="add-subject">＋ إضافة مادة</button></div><div class="permission-grid">${db.subjects.map((s, i) => `<label style="display:flex;justify-content:space-between;align-items:center;gap:6px"><span>${esc(s)}</span><button type="button" class="action" data-action="del-subject" data-id="${i}" title="حذف المادة">⌫</button></label>`).join('') || '<span class="empty" style="padding:12px">لا توجد مواد.</span>'}</div><div class="notice">تغيير اسم المرحلة يحدّث الطلاب والمجموعات والاختبارات المرتبطة بها تلقائياً، ولا يمكن حذف مرحلة مستخدمة.</div>`;
    if (settingsTab === 'students') body = `<div class="form-grid">${checkField('allowMakeup', 'السماح للطالب بالحضور في موعد آخر (تعويض)', db.settings.allowMakeup)}${checkField('multiGroup', 'ربط الطالب بأكثر من مجموعة', db.settings.multiGroup)}${checkField('showAbsence', 'عرض حالة الغياب في قائمة الطلاب', db.settings.showAbsence)}</div>`;
    if (settingsTab === 'money') body = `<div class="form-grid">${selectField('paymentMode', 'نوع الدفع الافتراضي', [['monthly', 'شهري'], ['lesson', 'بالحصة'], ['both', 'كلاهما'], ['none', 'إيقاف الدفع']], db.settings.paymentMode)}${checkField('printReceipt', 'طباعة إيصال بعد الدفع', db.settings.printReceipt)}${checkField('feeNotify', 'إشعار ولي الأمر بالدفع (واتساب)', db.settings.feeNotify)}</div>`;
    if (settingsTab === 'attendance') body = `<div class="form-grid">${selectField('attendanceMode', 'طريقة الحضور', [['card', 'كارت ID'], ['barcode', 'Sticker Barcode'], ['manual', 'إدخال يدوي']], db.settings.attendanceMode || 'card')}${checkField('autoPay', 'دفع المصروف تلقائياً عند حضور الطالب', db.settings.autoPay)}${checkField('absenceNotify', 'إشعار ولي الأمر بالغياب (واتساب)', db.settings.absenceNotify)}${field('absenceLimit', 'عدد حصص تمييز الانقطاع', db.settings.absenceLimit, 'number', true)}</div>`;
    if (settingsTab === 'groups') body = `<div class="form-grid">${field('capacity', 'السعة الافتراضية للمجموعة', db.settings.capacity, 'number', true)}${checkField('allowOverCapacity', 'السماح بتعدي عدد الطلاب', db.settings.allowOverCapacity)}${checkField('subGroups', 'تفعيل المجموعات الفرعية', db.settings.subGroups)}</div>`;
    if (settingsTab === 'notifications') body = `<div class="form-grid">${selectField('channel', 'قناة الإشعارات الافتراضية', ['WhatsApp', 'Telegram', 'SMS', 'إيقاف الإشعارات'], db.settings.channel || 'WhatsApp')}${checkField('welcome', 'إرسال رسالة ترحيب', db.settings.welcome)}${checkField('absenceNotify', 'إشعار غياب الطالب', db.settings.absenceNotify)}${checkField('gradeNotify', 'إشعار الدرجة', db.settings.gradeNotify)}${checkField('feeNotify', 'إشعار المصروفات', db.settings.feeNotify)}</div>`;
    if (settingsTab === 'registration') body = `<div class="notice">رابط التقديم وأكواد QR موثقان في المواصفات؛ هذه النسخة المحلية لا تنشر رابطاً عاماً بعد.</div><div class="form-grid">${selectField('closeMode', 'إغلاق المجموعة عند', ['عدد التقديمات', 'عدد الموافقين'], db.settings.closeMode || 'عدد التقديمات')}${checkField('codesOnly', 'تفعيل التقديم بنظام الأكواد فقط', db.settings.codesOnly)}<div class="field" style="grid-column:1/-1"><label>نص قبل التقديم</label><textarea name="registrationText">${esc(db.settings.registrationText || 'التقديم مسموح مرة واحدة.')}</textarea></div></div>`;
    if (settingsTab === 'integration') body = `<div class="notice">الربط الإلكتروني «عند الطلب» فقط في المصدر. لا توجد API أو بيانات اعتماد محددة لكي تُبنى أو تُفعل هنا.</div>`;
    return pageHead('الإعدادات', 'تخصيص سلوك النظام — للأدارة فقط') + `<section class="panel"><div class="tabs">${tabs.map(x => `<button type="button" class="tab ${settingsTab === x[0] ? 'active' : ''}" data-settings-tab="${x[0]}">${x[1]}</button>`).join('')}</div><form id="settings-form">${body}<div class="modal-foot"><button class="btn btn-light" type="button" data-action="rollover">🎓 سنة دراسية جديدة</button><button class="btn btn-light" type="button" data-action="clear-queue">إلغاء الرسائل المخزنة</button><button class="btn btn-light" type="button" data-action="backup">أخذ نسخة احتياطية</button><button class="btn btn-light" type="button" data-action="restore">استعادة نسخة</button><input type="file" id="restore-file" accept=".json,application/json" hidden><button class="btn btn-primary">حفظ الإعدادات</button></div></form></section>`;
  }
  function stageForm(stage = {}) {
    modal(stage.id ? 'تعديل مرحلة' : 'إضافة مرحلة', `<div class="form-grid">${field('name', 'اسم المرحلة', stage.name, 'text', true)}${field('fee', 'المصروف الشهري للمرحلة', stage.fee ?? db.settings.monthlyFee, 'number', true, 'min="0"')}</div><label class="check" style="margin:6px 0"><input type="checkbox" name="apply" ${stage.id ? '' : 'disabled'}> تحديث رسوم الطلاب الحاليين في هذه المرحلة لهذا السعر</label><div class="notice">تغيير اسم المرحلة يحدّث الطلاب والمجموعات والاختبارات المرتبطة بها تلقائياً.</div>`, data => {
      const name = String(data.get('name') || '').trim(); const fee = Number(data.get('fee') || 0);
      if (!name) return toast('اكتب اسم المرحلة.', 'error');
      if (db.stages.some(s => s.name === name && s.id !== stage.id)) return toast('يوجد مرحلة بهذا الاسم بالفعل.', 'error');
      if (stage.id) {
        const oldName = stage.name;
        stage.name = name; stage.fee = fee;
        if (oldName !== name) { db.students.forEach(s => { if (s.stage === oldName) s.stage = name; }); db.groups.forEach(g => { if (g.stage === oldName) g.stage = name; }); db.exams.forEach(e => { if (e.stage === oldName) e.stage = name; }); }
        if (data.get('apply')) { db.students.forEach(s => { if (s.stage === name) s.fee = fee; }); toast('تم تحديث رسوم طلاب المرحلة.'); }
      } else db.stages.push({ id: 'st-' + uid(), name, fee });
      logAct(stage.id ? 'تعديل مرحلة' : 'إضافة مرحلة', name + ' — ' + money(fee));
      save(); closeModal(); render(); toast('تم حفظ المرحلة.');
    });
  }
  function rolloverModal() {
    modal('بدء سنة دراسية جديدة', `<div class="notice">عملية كبيرة على البيانات — يُنصح بأخذ نسخة احتياطية أولاً. الترقية تتبع ترتيب المراحل في النظام.</div><div class="form-grid">${checkField('promote', 'ترقية الطلاب إلى المرحلة التالية', true)}${checkField('archiveLast', 'أرشفة طلاب المرحلة الأخيرة (التخرج)', true)}${checkField('clearAtt', 'تصفير سجل الحضور والغياب', true)}${checkField('clearPay', 'تصفير سجل الدفعات', false)}</div>`, data => {
      const promote = data.get('promote'), archiveLast = data.get('archiveLast'), clearAtt = data.get('clearAtt'), clearPay = data.get('clearPay');
      let promoted = 0, archived = 0;
      if (promote) { for (let i = db.stages.length - 2; i >= 0; i--) { db.students.forEach(s => { if (s.status === 'active' && s.stage === db.stages[i].name) { s.stage = db.stages[i + 1].name; promoted++; } }); } }
      if (archiveLast && db.stages.length) { const last = db.stages[db.stages.length - 1].name; db.students.forEach(s => { if (s.status === 'active' && s.stage === last) { s.status = 'archived'; db.archivedStudents.push({ ...s, archivedAt: date(), reason: 'نهاية سنة دراسية' }); archived++; } }); }
      if (clearAtt) db.attendance = [];
      if (clearPay) db.payments.forEach(p => p.archived = true);
      logAct('بدء سنة دراسية جديدة', `ترقية ${promoted} — أرشفة ${archived}`);
      save(); closeModal(); render(); toast(`تمت العملية: ترقية ${promoted} طالب، أرشفة ${archived}.`);
    }, 'تنفيذ');
  }
  function saveSettings(e) { e.preventDefault(); const data = new FormData(e.currentTarget); for (const [k, v] of data.entries()) db.settings[k] = v; ['confirmDelete', 'dark', 'allowMakeup', 'multiGroup', 'showAbsence', 'printReceipt', 'autoPay', 'allowOverCapacity', 'subGroups', 'welcome', 'absenceNotify', 'gradeNotify', 'feeNotify', 'codesOnly'].forEach(k => db.settings[k] = data.has(k)); db.settings.monthlyFee = Number(db.settings.monthlyFee || 0); db.settings.capacity = Number(db.settings.capacity || 0); db.settings.absenceLimit = Number(db.settings.absenceLimit || 0); logAct('تعديل الإعدادات', ''); save(); render(); toast('تم تحديث إعدادات النظام بنجاح.'); }

  /* ===== الحسابات والأدوار ===== */
  function ownerForm(o = {}) {
    modal(o.id ? 'تعديل حساب صاحب السنتر' : 'إضافة صاحب سنتر', `<div class="form-grid">${field('name', 'الاسم', o.name, 'text', true)}${field('phone', 'رقم الهاتف', o.phone || '', 'tel')}${field('username', 'اسم المستخدم للدخول', o.username, 'text', true)}${field('password', 'كلمة المرور', o.password, 'text', true)}${field('subscriptionEnd', 'تاريخ انتهاء اشتراك السنتر', o.subscriptionEnd || dateAfter(30), 'date', true)}</div><div class="notice">صاحب السنتر يدير كل شئون سنتره (المعلمون والمشرفون والموظفون والطلاب والأموال). عند انتهاء اشتراكه يُمنع هو من الدخول ويتوقف دخول كل المعلمين والمشرفين والطلاب وأولياء الأمور حتى التجديد.</div>`, data => {
      const username = String(data.get('username') || '').trim();
      const item = { ...o, id: o.id || 'ow-' + uid(), name: data.get('name'), phone: data.get('phone'), username, password: String(data.get('password') || '').trim(), subscriptionEnd: data.get('subscriptionEnd') || '' };
      const dup = checkUniqueCredentials(item.username, item.phone, { kind: 'owner', id: o.id || '' }, item.password, item.password !== (o.password || ''));
      if (dup) return toast(dup, 'error');
      if (!item.name || !item.username || !item.password) return toast('الاسم واسم المستخدم وكلمة المرور مطلوبة.', 'error');
      if (!item.subscriptionEnd) return toast('حدد تاريخ انتهاء الاشتراك.', 'error');
      if (o.id) Object.assign(o, item); else db.owners.push(item);
      logAct(o.id ? 'تعديل صاحب سنتر' : 'إضافة صاحب سنتر', item.name + ' — حتى ' + item.subscriptionEnd);
      save(); closeModal(); render(); toast('تم حفظ حساب صاحب السنتر — يمكنه الدخول الآن من دور «صاحب السنتر».');
    });
  }
  function users() {
    const admin = db.users.find(u => u.roleId === 'manager');
    const isOwner = session.kind === 'owner';
    const rolesInfo = [
      ['مدير النظام (الأدمن)', 'يضيف كل الفئات ويحدد اشتراكاتها وحقول نماذج التسجيل ويتحكم في كل البيانات', 'success'],
      ['صاحب السنتر', 'دور خاص بنظام السنتر: يدير كل شئون سنتره، وعند انتهاء اشتراكه يتوقف دخول كل العاملين والطلاب', 'info'],
      ['معلم', 'يضيفه الأدمن أو صاحب السنتر باشتراك محدد — يرى طلابه فقط ويضيف مشرفيه ويحدد طرق الدفع ومواعيد مشرفيه', 'info'],
      ['مشرف', 'يضيفه المعلم ويربطه بمجموعات — يرى طلاب مجموعاته فقط، ولوله راتب ومواعيد حضور وخصومات وبونص', 'warning'],
      ['طالب', 'يدخل بكود الطالب وكلمة مرور الطالب — بوابة دراسية: حضوره ودرجاته وتقاريره', 'neutral'],
      ['ولي الأمر', 'دخول منفصل عن الطالب: بكود الطالب أو هاتفه وكلمة مرور ولي الأمر — متابعة تشمل المصروفات وطرق الدفع', 'neutral']
    ];
    let html = pageHead('الحسابات والأدوار', 'جميع أدوار النظام وحساباتها — الأدارة تتحكم في كل منها') + `<section class="panel"><h2>أدوار النظام</h2><ul class="list">${rolesInfo.map(r => `<li><span><b>${esc(r[0])}</b><br><small>${esc(r[1])}</small></span>${badge(r[0].split(' (')[0], r[2])}</li>`).join('')}</ul></section>`;
    /* حسابات أصحاب السنترات — يديرها مدير النظام فقط */
    if (!isOwner) {
      html += `<section class="panel" style="margin-top:16px"><h2>حسابات أصحاب السنترات (${db.owners.length})</h2><p style="color:var(--muted);font-size:12px;margin:0 0 10px">دور «صاحب السنتر» يظهر في شاشة الدخول بنظام السنتر فقط. عند انتهاء اشتراك صاحب السنتر يُمنع من الدخول ويتوقف دخول كل من تحته: المعلمون والمشرفون والموظفون والطلاب وأولياء الأمور.</p><ul class="list">${db.owners.map(o => `<li><span><b>${esc(o.name)}</b><br><small>دخول: ${esc(o.username)}${o.phone ? ' — ' + esc(o.phone) : ''}</small></span><span>${subBadge(o.subscriptionEnd)} ${btn('تجديد', 'renew-owner', o.id, 'btn btn-sm btn-primary')} ${btn('✎', 'edit-owner', o.id)} ${btn('⌫', 'delete-owner', o.id)}</span></li>`).join('') || '<li>لا يوجد أصحاب سنترات — أضف واحداً ليظهر دوره في شاشة الدخول.</li>'}</ul><div style="margin-top:10px">${btn('＋ إضافة صاحب سنتر', 'add-owner', '', 'btn btn-primary')}</div></section>`;
    } else {
      const me = find('owners', session.id);
      html += `<section class="panel" style="margin-top:16px"><h2>اشتراك سنتري</h2><ul class="list"><li><span><b>${esc(me?.name || who())}</b><br><small>صلاحية دخولك تتحكم في دخول كل العاملين والطلاب في سنترك — انتهاؤها يوقف الموقع عن الجميع</small></span>${me ? subBadge(me.subscriptionEnd) : ''}</li></ul><div class="notice">تجديد الاشتراك يتم عبر مدير النظام.</div></section>`;
    }
    html += `
    <section class="panel" style="margin-top:16px"><h2>مدير النظام</h2><ul class="list"><li><span><b>${esc(admin.name)}</b><br><small>اسم المستخدم: ${esc(admin.username)}</small></span>${!isOwner ? btn('✎ تعديل', 'edit-admin', admin.id, 'btn btn-sm btn-light') : badge('حساب مدير النظام', 'neutral')}</li></ul></section>
    <section class="panel" style="margin-top:16px"><h2>حسابات المعلمين (${db.teachers.length})</h2><ul class="list">${db.teachers.map(t => `<li><span><b>${esc(t.name)}</b><br><small>دخول: ${esc(t.username)} — ${(t.payMethods || []).length} طرق دفع</small></span><span>${subBadge(t.subscriptionEnd)} ${!isOwner || isCenter() ? btn('✎', 'edit-teacher', t.id) : ''}</span></li>`).join('') || '<li>لا يوجد معلمون.</li>'}</ul><div style="margin-top:10px">${btn('＋ تسجيل معلم جديد', 'add-teacher', '', 'btn btn-primary')} <button class="btn btn-light" data-page="teachers">إدارة كاملة و التجديد</button></div></section>
    <section class="panel" style="margin-top:16px"><h2>حسابات المشرفين (${visibleSupervisors().length})</h2><ul class="list">${visibleSupervisors().map(sp => `<li><span><b>${esc(sp.name)}</b><br><small>دخول: ${esc(sp.username)} — ${esc(teacherName(sp.teacherId))} — راتب ${money(sp.salary || 0)}</small></span><span>${subBadge(sp.subscriptionEnd)} ${btn('✎', 'edit-supervisor', sp.id)}</span></li>`).join('') || '<li>لا يوجد مشرفون — يضيفهم المعلم من صفحة المشرفين.</li>'}</ul><div style="margin-top:10px">${btn('＋ تسجيل مشرف جديد', 'add-supervisor', '', 'btn btn-primary')} <button class="btn btn-light" data-page="supervisors">إدارة كاملة</button></div></section>
    <section class="panel" style="margin-top:16px"><h2>حسابات دخول الطلاب وأولياء الأمور (${db.students.length})</h2><p style="color:var(--muted);font-size:12px;margin:0 0 10px">دخول الطالب منفصل عن ولي الأمر: الطالب بكوده وكلمة مرور الطالب، وولي الأمر بكود الطالب أو هاتفه وكلمة مرور ولي الأمر — وكل منهما له بوابة مختلفة.</p><div class="table-wrap"><table style="min-width:0"><thead><tr><th>الطالب</th><th>كود الدخول</th><th>حماية الطالب</th><th>حماية ولي الأمر</th><th></th></tr></thead><tbody>${db.students.map(s => `<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.code)}</td><td>${s.password ? badge('بكلمة مرور', 'success') : badge('بالكود فقط', 'neutral')}</td><td>${s.guardianPassword ? badge('بكلمة مرور', 'success') : badge('بدون كلمة مرور', 'warning')}</td><td>${btn('✎', 'edit-student', s.id)}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="panel" style="margin-top:16px"><h2>نماذج التسجيل</h2><p style="color:var(--muted);font-size:12px;margin:0 0 10px">لكل دور نموذج تسجيل منفصل، والأدارة هي من تحدد الحقول الظاهرة فيه وحقولها الإجبارية ويمكنها إضافة حقول مخصصة.</p><button class="btn btn-primary" data-action="goto-forms">⚙ إعداد حقول نماذج التسجيل</button></section>`;
    return html;
  }
  function adminForm(user) {
    modal('تعديل حساب مدير النظام', `<div class="form-grid">${field('name', 'الاسم', user.name, 'text', true)}${field('username', 'اسم المستخدم للدخول', user.username, 'text', true)}${field('password', 'كلمة المرور', user.password, 'text', true)}</div><div class="notice">هذا الحساب يتحكم في كل شيء — احفظ كلمة المرور جيداً.</div>`, data => {
      const username = String(data.get('username') || '').trim();
      const dup = checkUniqueCredentials(username, user.phone, { kind: 'user', id: user.id }, password, password !== (user.password || ''));
      if (dup) return toast(dup, 'error');
      user.name = data.get('name'); user.username = username; user.password = String(data.get('password') || '').trim();
      logAct('تعديل حساب الأدمن', user.username);
      save(); closeModal(); render(); toast('تم تحديث حساب مدير النظام.');
    });
  }
  function formsTabBody() {
    const roles = [['teacher', 'نموذج تسجيل المعلم'], ['supervisor', 'نموذج تسجيل المشرف'], ['student', 'نموذج تسجيل الطالب']];
    const typeLabel = { text: 'نص', number: 'رقم', tel: 'هاتف', date: 'تاريخ', email: 'بريد', textarea: 'نص طويل', select: 'اختيار' };
    return pageHead('نماذج التسجيل', 'لكل دور نموذج منفصل — الأدارة تحدد الحقول الظاهرة والإجبارية وتضيف حقولاً مخصصة') + loginFieldsSection() + roles.map(([r, label]) => `<section class="panel" style="margin-bottom:16px"><h2>${label}</h2><div class="table-wrap"><table style="min-width:0"><thead><tr><th>الحقل</th><th>النوع</th><th>ظاهر</th><th>إجباري</th><th></th></tr></thead><tbody>${db.formFields[r].map(f => `<tr><td><b>${esc(f.label)}</b></td><td>${typeLabel[f.type] || esc(f.type)}${f.custom ? ' ' + badge('مخصص', 'info') : ''}</td><td><input type="checkbox" data-action="toggle-field" data-id="${r}::${f.key}" ${f.enabled ? 'checked' : ''}></td><td><input type="checkbox" data-action="req-field" data-id="${r}::${f.key}" ${f.required ? 'checked' : ''}></td><td>${f.custom ? btn('⌫', 'del-field', r + '::' + f.key) : ''}</td></tr>`).join('')}</tbody></table></div><div class="toolbar" style="margin-top:10px"><input id="nf-label-${r}" placeholder="اسم حقل مخصص جديد" style="flex:1;min-width:150px"><select id="nf-type-${r}"><option value="text">نص</option><option value="number">رقم</option><option value="tel">هاتف</option><option value="date">تاريخ</option><option value="textarea">نص طويل</option></select><button class="btn btn-primary btn-sm" data-action="add-field" data-id="${r}">＋ إضافة حقل مخصص</button></div></section>`).join('') + `<div class="notice">حقول الربط الأساسية (المجموعة للطالب والمشرف، ومراحل المعلم) تظهر دائماً ولا يمكن إخفاؤها لأن النظام يعتمد عليها. إخفاء حقل لا يحذف بياناته المحفوظة سابقاً.</div>`;
  }
  function loginFieldsSection() {
    const allowed = { admin: ['username', 'phone', 'password'], teacher: ['username', 'phone', 'password'], supervisor: ['username', 'phone', 'password'], staff: ['username', 'phone', 'password'], owner: ['username', 'phone', 'password'], student: ['code', 'phone', 'spassword'], guardian: ['code', 'phone', 'gpassword'] };
    const roleLabels = { admin: 'مدير النظام', teacher: 'معلم', supervisor: 'مشرف', staff: 'موظف', owner: 'صاحب السنتر', student: 'طالب', guardian: 'ولي الأمر' };
    const identityKeys = ['username', 'phone', 'code'];
    const roleNote = { student: 'الهاتف = هاتف الطالب', guardian: 'الهاتف = هاتف ولي الأمر، والكود = كود الطالب (ابنك)', owner: 'دور يظهر في نظام السنتر فقط' };
    return `<section class="panel" style="margin-bottom:16px"><h2>🔑 بابة الدخول — حقول كل دور</h2><p style="color:var(--muted);font-size:12px;margin:0 0 10px">حدد البيانات التي تظهر عند اختيار كل دور في شاشة الدخول (تظهر له فوراً). يجب بقاء حقل تعريف واحد على الأقل لكل دور. تحذير: إخفاء «كلمة المرور» يسمح بالدخول بدونها. دخول الطالب منفصل تماماً عن دخول ولي الأمر.</p><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">${Object.keys(allowed).map(role => `<div class="card" style="padding:12px"><b>${esc(roleLabels[role] || role)}</b>${roleNote[role] ? `<small style="display:block;color:var(--muted);font-size:10.5px;margin-top:2px">${esc(roleNote[role])}</small>` : ''}<div style="margin-top:8px;display:grid;gap:6px">${allowed[role].map(k => `<label class="check" style="font-size:12px"><input type="checkbox" data-action="toggle-login-field" data-id="${role}::${k}" ${db.loginFields[role]?.includes(k) ? 'checked' : ''}> ${esc(loginFieldLabel(role, k))}</label>`).join('')}</div></div>`).join('')}</div></section>`;
  }
  function helpModal() { modal('الدعم الفني — دليل سريع', `<ul class="list"><li><span>🔐 بابة الدخول</span><small>الإدارة وصاحب السنتر والمعلمون والمشرفون: اسم مستخدم + كلمة مرور — الطالب: كوده وكلمة مرور الطالب — ولي الأمر: كود الطالب أو هاتفه وكلمة مرور ولي الأمر (دخول منفصل لكل منهما)</small></li><li><span>⏳ الاشتراكات</span><small>الأدارة تجدد اشتراك المعلمين وأصحاب السنترات، وصاحب السنتر أو المعلم يجدد اشتراك مشرفيه — عند انتهاء اشتراك المعلم المفرد أو صاحب السنتر يُمنع هو من الدخول ويتوقف دخول طلابه ومشرفيه وأولياء أموره حتى التجديد</small></li><li><span>👁 العزل</span><small>المعلم يرى طلابه فقط، والمشرف يرى طلاب مجموعاته فقط</small></li><li><span>💵 طرق الدفع</span><small>المعلم يحددها من صفحة الأموال — يدوي أو تحويل مع رقم الحساب، وتظهر لولي الأمر في بوابته</small></li><li><span>📊 التقارير</span><small>18 تقريراً بينها «ملف طالب شامل» و«مصادر التحصيل» — ولكل طالب وولي أمر تقارير طباعة في بوابته (حضور، درجات، مالي، شامل)</small></li></ul><div class="notice">جميع البيانات محفوظة محلياً في متصفحك وتتزامن بين التبويبات المفتوحة.</div>`, () => closeModal(), 'إغلاق'); }

  /* ===== بوابات الطالب وولي الأمر — منفصلتان مع تبويبات وتقارير قابلة للطباعة ===== */
  function portalStats(s) {
    const records = db.attendance.filter(a => a.studentId === s.id);
    const grades = db.exams.flatMap(e => e.grades.filter(g => g.studentId === s.id).map(g => ({ ...g, exam: e.name, date: e.date, kind: e.kind })));
    const present = records.filter(r => r.status === 'present').length;
    return {
      records, grades, present, absent: records.filter(r => r.status === 'absent').length,
      attRate: pct(present, records.length),
      avg: grades.length ? Math.round(grades.reduce((a, g) => a + g.score / g.max * 100, 0) / grades.length) : 0,
      pays: db.payments.filter(p => p.studentId === s.id && !p.archived).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      totalPaid: db.payments.filter(p => p.studentId === s.id && !p.archived).reduce((a, p) => a + Number(p.amount), 0),
      best: grades.length ? grades.reduce((a, g) => (g.score / g.max > a.score / a.max ? g : a)) : null,
      worst: grades.length ? grades.reduce((a, g) => (g.score / g.max < a.score / a.max ? g : a)) : null
    };
  }
  function portalAttendanceMonthly(records) {
    const months = [...new Set(records.map(r => r.date.slice(0, 7)))].sort().reverse();
    return months.map(m => { const rs = records.filter(r => r.date.startsWith(m)); const p = rs.filter(r => r.status === 'present').length; return { m, p, a: rs.length - p, rate: pct(p, rs.length) }; });
  }
  function portal() {
    const s = find('students', session.ref);
    if (!s) { setSession(null); render(); return; }
    const isGuardian = session.kind === 'guardian' || session.kind === 'viewer';
    const st = portalStats(s);
    const methods = studentPayMethods(s);
    const tabs = isGuardian
      ? [['ov', 'نظرة عامة'], ['att', 'الحضور'], ['grd', 'الدرجات'], ['mon', 'المصروفات'], ['rep', 'التقارير']]
      : [['ov', 'نظرة عامة'], ['att', 'الحضور'], ['grd', 'الدرجات'], ['rep', 'تقاريري']];
    const sec = (k, active, html) => `<div class="file-section ${active ? 'active' : ''}" data-file-section="${k}">${html}</div>`;
    /* نظرة عامة */
    const ovStats = isGuardian
      ? `<div class="grid stats"><div class="stat-card"><span class="label">المصروف الشهري</span><strong>${money(studentFee(s))}</strong></div><div class="stat-card"><span class="label">المدفوع هذا الشهر</span><strong>${money(studentPaid(s))}</strong></div><div class="stat-card"><span class="label">المتبقي</span><strong style="color:${studentDue(s) ? 'var(--danger)' : 'var(--success)'}">${money(studentDue(s))}</strong></div><div class="stat-card"><span class="label">الكود (ID)</span><strong style="font-size:18px">${esc(s.code)}</strong></div></div>`
      : `<div class="grid stats"><div class="stat-card"><span class="label">معدل درجاتي</span><strong>${st.grades.length ? st.avg + '%' : '—'}</strong></div><div class="stat-card"><span class="label">نسبة حضوري</span><strong>${st.records.length ? st.attRate + '%' : '—'}</strong></div><div class="stat-card"><span class="label">اختبارات مرصودة</span><strong>${st.grades.length}</strong></div><div class="stat-card"><span class="label">الكود (ID)</span><strong style="font-size:18px">${esc(s.code)}</strong></div></div>`;
    const ov = sec('ov', true, ovStats + `<div class="grid" style="grid-template-columns:1fr 1fr;margin-top:16px">
      <section class="panel"><h2>مؤشرات سريعة</h2><ul class="list"><li><span>المجموعات</span><b>${esc(s.groupIds.map(groupName).join('، ') || '—')}</b></li><li><span>المعلمون</span><b>${esc([...new Set([...(s.teacherIds || []), ...s.groupIds.flatMap(g => find('groups', g)?.teacherIds || [])])].map(teacherName).join('، ') || '—')}</b></li><li><span>عدد الغيابات</span><b>${st.absent}</b></li><li><span>آخر ملاحظة</span><b>${esc(s.note || '—')}</b></li></ul></section>
      ${isGuardian ? `<section class="panel"><h2>طرق الدفع المتاحة</h2><ul class="list">${methods.map(m => `<li><span><b>${esc(m.name)}</b>${m.kind === 'transfer' ? `<br><small>تحويل إلى: <b>${esc(m.destination || 'سيتم إبلاغكم به')}</b></small>` : '<br><small>تسليم نقدي في السنتر</small>'}</span>${badge(m.kind === 'transfer' ? 'تحويل' : 'يدوي', m.kind === 'transfer' ? 'info' : 'success')}</li>`).join('')}</ul></section>`
      : `<section class="panel"><h2>نتيجتي الأخيرة</h2>${st.grades.length ? `<ul class="list"><li><span>أعلى نتيجة — ${esc(st.best.exam)}</span><b>${st.best.score}/${st.best.max} (${pct(st.best.score, st.best.max)}%)</b></li><li><span>أدنى نتيجة — ${esc(st.worst.exam)}</span><b>${st.worst.score}/${st.worst.max} (${pct(st.worst.score, st.worst.max)}%)</b></li><li><span>معدلي العام</span><b>${st.avg}%</b></li></ul>` : '<p class="empty" style="padding:10px">لم تُرصد درجات بعد.</p>'}</section>`}
    </div>`);
    /* الحضور: ملخص شهري + سجل */
    const monthly = portalAttendanceMonthly(st.records);
    const att = sec('att', false, `<div class="grid stats"><div class="stat-card"><span class="label">إجمالي الحضور</span><strong>${st.present}</strong></div><div class="stat-card"><span class="label">إجمالي الغياب</span><strong>${st.absent}</strong></div><div class="stat-card"><span class="label">نسبة الحضور</span><strong>${st.records.length ? st.attRate + '%' : '—'}</strong></div><div class="stat-card"><span class="label">سجلات مسجلة</span><strong>${st.records.length}</strong></div></div>${monthly.length ? `<section class="panel" style="margin-top:14px"><h2>ملخص شهري</h2><div class="table-wrap"><table style="min-width:0"><thead><tr><th>الشهر</th><th>حضور</th><th>غياب</th><th>النسبة</th></tr></thead><tbody>${monthly.map(m => `<tr><td><b>${esc(m.m)}</b></td><td>${m.p}</td><td>${m.a}</td><td><div class="progress" style="min-width:90px"><i style="width:${m.rate}%"></i></div> ${m.rate}%</td></tr>`).join('')}</tbody></table></div></section>` : ''}<section class="panel" style="margin-top:14px"><h2>سجل الحضور الكامل</h2><ul class="list">${st.records.map(r => `<li><span>${esc(r.date)} — ${esc(groupName(r.groupId))}${r.makeup ? ' (تعويضي)' : ''}${r.departure ? '<br><small>انصراف: ' + esc(r.departure) + '</small>' : ''}</span>${badge(r.status === 'present' ? 'حاضر ' + (r.time || '') : 'غائب', r.status === 'present' ? 'success' : 'danger')}</li>`).join('') || '<li>لا توجد سجلات بعد.</li>'}</ul></section>`);
    /* الدرجات */
    const grd = sec('grd', false, `<div class="grid stats"><div class="stat-card"><span class="label">عدد الاختبارات</span><strong>${st.grades.length}</strong></div><div class="stat-card"><span class="label">معدلي العام</span><strong>${st.grades.length ? st.avg + '%' : '—'}</strong></div><div class="stat-card"><span class="label">أعلى نتيجة</span><strong>${st.best ? pct(st.best.score, st.best.max) + '%' : '—'}</strong></div><div class="stat-card"><span class="label">أدنى نتيجة</span><strong>${st.worst ? pct(st.worst.score, st.worst.max) + '%' : '—'}</strong></div></div><section class="panel" style="margin-top:14px"><h2>سجل الدرجات</h2><div class="table-wrap"><table style="min-width:0"><thead><tr><th>الاختبار</th><th>التاريخ</th><th>الدرجة</th><th>النسبة</th><th>التقدير</th></tr></thead><tbody>${st.grades.map(g => { const p = pct(g.score, g.max); return `<tr><td><b>${esc(g.exam)}</b></td><td>${esc(g.date)}</td><td>${g.score}/${g.max}</td><td><div class="progress" style="min-width:80px"><i style="width:${p}%"></i></div> ${p}%</td><td>${p >= 85 ? badge('ممتاز', 'success') : p >= 70 ? badge('جيد جداً', 'success') : p >= 50 ? badge('مقبول', 'warning') : badge('يحتاج متابعة', 'danger')}</td></tr>`; }).join('') || '<tr><td colspan="5" class="empty">لا توجد درجات بعد.</td></tr>'}</tbody></table></div></section>`);
    /* المصروفات — لولي الأمر فقط */
    const mon = sec('mon', false, `<div class="grid stats"><div class="stat-card"><span class="label">المصروف الشهري</span><strong>${money(studentFee(s))}</strong></div><div class="stat-card"><span class="label">إجمالي المدفوع</span><strong>${money(st.totalPaid)}</strong></div><div class="stat-card"><span class="label">المتبقي هذا الشهر</span><strong style="color:${studentDue(s) ? 'var(--danger)' : 'var(--success)'}">${money(studentDue(s))}</strong></div><div class="stat-card"><span class="label">طريقة الدفع</span><strong style="font-size:15px">${esc(studentPayMode(s))}</strong></div></div>${(s.installments || []).length ? `<section class="panel" style="margin-top:14px"><h2>خطة الأقساط</h2><ul class="list">${s.installments.map(i => `<li><span>قسط ${esc(i.month)}</span>${i.paid ? badge('مدفوع', 'success') : (i.month < month() ? badge('متأخر ' + money(i.amount), 'danger') : badge('غير مدفوع ' + money(i.amount), 'warning'))}</li>`).join('')}</ul></section>` : ''}<section class="panel" style="margin-top:14px"><h2>سجل الدفعات الكامل</h2><ul class="list">${st.pays.map(p => `<li><span>${esc(p.period)} — ${esc(p.method || 'يدوي')}${p.kind === 'transfer' ? ' → ' + esc(p.destination || '') : ''}<br><small>حصّله: ${esc(p.collectedBy || '—')} — ${esc(p.createdAt)}</small></span><b>${money(p.amount)}</b></li>`).join('') || '<li>لا توجد دفعات بعد.</li>'}</ul></section>`);
    /* التقارير */
    const reportCards = [
      ['attendance', '📊 تقرير الحضور', 'نسبة الحضور الشهرية وملخص كل حصة وحصص الغياب والانصراف'],
      ['grades', '📝 تقرير الدرجات', 'كل الاختبارات والدرجات والمعدل العام وأعلى وأدنى نتيجة']
    ];
    if (isGuardian) {
      reportCards.push(['money', '💰 التقرير المالي', 'المصروفات والمدفوع والمتبقي وخطة الأقساط وسجل الدفعات كاملاً']);
    }
    reportCards.push(['full', '🧾 التقرير الشامل', isGuardian ? 'صفحة واحدة تجمع الحضور والدرجات والمصروفات — مناسبة للطباعة والتوقيع' : 'صفحة واحدة تجمع الحضور والدرجات — مناسبة للطباعة والتوقيع']);
    const rep = sec('rep', false, pageHead(`تقاريري — ${esc(s.name)}`, 'تقارير جاهزة للطباعة أو التصدير CSV') + `<div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">${reportCards.map(([k, t, d]) => `<section class="panel"><h2>${t}</h2><p style="color:var(--muted);font-size:12.5px">${esc(d)}</p><div class="actions"><button class="btn btn-primary btn-sm" data-action="print-portal-report" data-id="${k}">▤ طباعة</button><button class="btn btn-light btn-sm" data-action="export-portal-report" data-id="${k}">⇩ تصدير CSV</button></div></section>`).join('')}</div>`);    return pageHead(`أهلاً بكم — ${esc(isGuardian ? 'ولي أمر ' + s.name : s.name)}`, isGuardian ? 'بوابة متابعة ولي الأمر: المصروفات والحضور والدرجات والتقارير' : 'بوابة الطالب: حضورك ودرجاتك وتقاريرك') + `<div class="tabs" style="margin-bottom:14px">${tabs.map(([k, l], i) => `<button type="button" class="tab ${i ? '' : 'active'}" data-file-tab="${k}">${l}</button>`).join('')}</div>${ov}${att}${grd}${isGuardian ? mon : ''}${rep}`;
  }
  /* طباعة وتصدير تقارير البوابة */
  function printPortalReport(kind) {
    const s = find('students', session.ref);
    if (!s) return toast('انتهت الجلسة — سجل الدخول من جديد.', 'error');
    const isGuardian = session.kind === 'guardian' || session.kind === 'viewer';
    const st = portalStats(s);
    const monthly = portalAttendanceMonthly(st.records);
    if (kind === 'attendance') {
      return printDoc(`تقرير حضور — ${s.name}`, attRateStats(st.present, st.absent) + (monthly.length ? `<h3>الملخص الشهري</h3>` + printTable(['الشهر', 'حضور', 'غياب', 'نسبة الحضور'], monthly.map(m => [m.m, m.p, m.a, m.rate + '%'])) : '') + `<h3 style="margin-top:12px">السجل التفصيلي (آخر 40 سجل)</h3>` + printTable(['التاريخ', 'المجموعة', 'الحالة', 'الحضور', 'الانصراف'], st.records.slice(0, 40).map(r => [r.date, groupName(r.groupId) + (r.makeup ? ' (تعويضي)' : ''), r.status === 'present' ? 'حاضر' : 'غائب', r.time || '—', r.departure || '—'])));
    }
    if (kind === 'grades') {
      return printDoc(`تقرير درجات — ${s.name}`, `<div class="grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">${[['عدد الاختبارات', st.grades.length], ['المعدل العام', st.grades.length ? st.avg + '%' : '—'], ['أعلى نتيجة', st.best ? pct(st.best.score, st.best.max) + '%' : '—'], ['أدنى نتيجة', st.worst ? pct(st.worst.score, st.worst.max) + '%' : '—']].map(x => `<div style="border:1px solid #c7d2e4;border-radius:8px;padding:8px"><small>${x[0]}</small><br><b>${x[1]}</b></div>`).join('')}</div>` + printTable(['الاختبار', 'التاريخ', 'الدرجة', 'النسبة', 'التقدير'], st.grades.map(g => { const p = pct(g.score, g.max); return [g.exam, g.date, `${g.score}/${g.max}`, p + '%', p >= 85 ? 'ممتاز' : p >= 70 ? 'جيد جداً' : p >= 50 ? 'مقبول' : 'يحتاج متابعة']; })));
    }
    if (kind === 'money') {
      if (!isGuardian) return toast('التقرير المالي لولي الأمر فقط.', 'error');
      const inst = (s.installments || []).map(i => [i.month, money(i.amount), i.paid ? 'مدفوع' : (i.month < month() ? 'متأخر' : 'غير مدفوع')]);
      return printDoc(`التقرير المالي — ${s.name}`, `<div class="grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">${[['المصروف الشهري', money(studentFee(s))], ['إجمالي المدفوع', money(st.totalPaid)], ['المتبقي هذا الشهر', money(studentDue(s))], ['طريقة الدفع', studentPayMode(s)]].map(x => `<div style="border:1px solid #c7d2e4;border-radius:8px;padding:8px"><small>${x[0]}</small><br><b>${esc(x[1])}</b></div>`).join('')}</div>` + (inst.length ? `<h3>خطة الأقساط</h3>` + printTable(['شهر القسط', 'المبلغ', 'الحالة'], inst) : '') + `<h3 style="margin-top:12px">سجل الدفعات</h3>` + printTable(['التاريخ', 'شهر الرسوم', 'المبلغ', 'الطريقة', 'حصّله'], st.pays.map(p => [p.createdAt, p.period, money(p.amount), (p.method || 'يدوي') + (p.kind === 'transfer' ? ' → ' + (p.destination || '') : ''), p.collectedBy || '—'])));
    }
    if (kind === 'full') {
      const parts = [`<div class="grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">${[['الطالب', s.name], ['الكود', s.code], ['المرحلة', s.stage], ['المجموعات', s.groupIds.map(groupName).join('، ') || '—']].map(x => `<div style="border:1px solid #c7d2e4;border-radius:8px;padding:8px"><small>${x[0]}</small><br><b>${esc(x[1])}</b></div>`).join('')}</div>`];
      parts.push(`<h3>الحضور</h3>` + printTable(['إجمالي الحضور', 'إجمالي الغياب', 'نسبة الحضور'], [[st.present, st.absent, (st.records.length ? st.attRate : 0) + '%']]));
      if (monthly.length) parts.push(printTable(['الشهر', 'حضور', 'غياب', 'النسبة'], monthly.map(m => [m.m, m.p, m.a, m.rate + '%'])));
      parts.push(`<h3 style="margin-top:12px">الدرجات</h3>` + printTable(['الاختبار', 'التاريخ', 'الدرجة', 'النسبة'], st.grades.map(g => [g.exam, g.date, `${g.score}/${g.max}`, pct(g.score, g.max) + '%'])));
      if (isGuardian) parts.push(`<h3 style="margin-top:12px">المصروفات</h3>` + printTable(['البيان', 'القيمة'], [['المصروف الشهري', money(studentFee(s))], ['إجمالي المدفوع', money(st.totalPaid)], ['المتبقي هذا الشهر', money(studentDue(s))]]) + printTable(['تاريخ الدفعة', 'شهر الرسوم', 'المبلغ', 'الطريقة'], st.pays.map(p => [p.createdAt, p.period, money(p.amount), p.method || 'يدوي'])));
      return printDoc(`التقرير الشامل — ${s.name}`, parts.join(''));
    }
  }
  function exportPortalReport(kind) {
    const s = find('students', session.ref);
    if (!s) return toast('انتهت الجلسة — سجل الدخول من جديد.', 'error');
    const isGuardian = session.kind === 'guardian' || session.kind === 'viewer';
    const st = portalStats(s);
    const monthly = portalAttendanceMonthly(st.records);
    if (kind === 'attendance') return exportCSV('تقرير-حضور-' + s.name, ['التاريخ', 'المجموعة', 'الحالة', 'وقت الحضور', 'الانصراف'], st.records.map(r => [r.date, groupName(r.groupId) + (r.makeup ? ' (تعويضي)' : ''), r.status === 'present' ? 'حاضر' : 'غائب', r.time || '', r.departure || '']));
    if (kind === 'grades') return exportCSV('تقرير-درجات-' + s.name, ['الاختبار', 'التاريخ', 'الدرجة', 'النهائية', 'النسبة %'], st.grades.map(g => [g.exam, g.date, g.score, g.max, pct(g.score, g.max)]));
    if (kind === 'money') { if (!isGuardian) return toast('التقرير المالي لولي الأمر فقط.', 'error'); return exportCSV('التقرير-المالي-' + s.name, ['البند', 'التفاصيل', 'المبلغ', 'التاريخ'], [...st.pays.map(p => ['دفعة', p.period + ' — ' + (p.method || 'يدوي'), p.amount, p.createdAt]), ...(s.installments || []).map(i => ['قسط ' + (i.paid ? 'مدفوع' : 'غير مدفوع'), i.month, i.amount, '']), ['إجمالي المدفوع', '', st.totalPaid, ''], ['المتبقي هذا الشهر', '', studentDue(s), '']]); }
    if (kind === 'full') {
      const rows = [...monthly.map(m => ['حضور ' + m.m, `حاضر ${m.p} / غائب ${m.a}`, '', m.rate + '%']), ...st.grades.map(g => ['درجة — ' + g.exam, g.date, `${g.score}/${g.max}`, pct(g.score, g.max) + '%'])];
      if (isGuardian) rows.push(...st.pays.map(p => ['دفعة — ' + p.period, p.method || 'يدوي', p.amount, p.createdAt]));
      return exportCSV('التقرير-الشامل-' + s.name, ['البند', 'التفاصيل', 'القيمة', 'النسبة/التاريخ'], rows);
    }
  }

  /* ===== التصدير العام ===== */
  function exportCurrent() {
    if (page === 'reports') return exportReport(reportTab);
    if (page === 'students') return exportCSV('الطلاب', ['الاسم', 'الكود', 'المرحلة', 'النوع', 'المجموعات', 'المعلمون', 'الهاتف', 'هاتف ولي الأمر', 'المصروف', 'المدفوع هذا الشهر', 'المتبقي', 'سجّله'], activeStudents().map(s => [s.name, s.code, s.stage, s.gender, s.groupIds.map(groupName).join(' / '), [...new Set([...(s.teacherIds || []), ...s.groupIds.flatMap(g => find('groups', g)?.teacherIds || [])])].map(teacherName).join(' / '), s.phone, s.parentPhone, studentFee(s), studentPaid(s), studentDue(s), s.registeredBy || '']));
    if (page === 'teachers') return exportCSV('المعلمون', ['الاسم', 'المادة', 'المراحل', 'الهاتف', 'مجموعات', 'الاشتراك حتى'], db.teachers.map(t => [t.name, t.subject, t.stages.join(' / '), t.phone, db.groups.filter(g => (g.teacherIds || []).includes(t.id)).length, t.subscriptionEnd]));
    if (page === 'supervisors') return exportCSV('المشرفون', ['الاسم', 'الهاتف', 'المعلم', 'المجموعات', 'الراتب', 'الاشتراك حتى'], visibleSupervisors().map(sp => [sp.name, sp.phone, teacherName(sp.teacherId), (sp.groupIds || []).map(groupName).join(' / '), sp.salary || 0, sp.subscriptionEnd]));
    if (page === 'groups') return exportCSV('المجموعات', ['المجموعة', 'المعلمون', 'المرحلة', 'الموعد', 'المسجلون', 'السعة'], myGroups().map(g => [g.name, (g.teacherIds || []).map(teacherName).join(' / '), g.stage, g.schedule, db.students.filter(s => s.status === 'active' && s.groupIds.includes(g.id)).length, g.capacity]));
    if (page === 'exams') return exportCSV('الاختبارات', ['الاختبار', 'النوع', 'المرحلة', 'التاريخ', 'درجات مرصودة', 'الحالة'], myExams().map(e => [e.name, e.kind, e.stage, e.date, e.grades.length, e.status === 'open' ? 'مفتوح' : 'مغلق']));
    if (page === 'finance') return exportCSV('الحركة-المالية', ['النوع', 'البيان', 'التاريخ', 'القيمة'], ledger(financeMonth).map(x => [x.type, x.name, x.date, (x.plus ? '' : '-') + x.amount]));
    if (page === 'books') return exportCSV('الكتب', ['الكتاب', 'المرحلة', 'المورد', 'الكمية', 'سعر البيع', 'متبقي المورد', 'مبيعات'], db.books.map(b => [b.name, b.stage, find('suppliers', b.supplierId)?.name || '', b.qty, b.sale, bookDebt(b), b.deliveries.filter(d => d.type === 'بيع').length]));
    if (page === 'attendance-report') return exportCSV('تقرير-الغياب-اليومي', ['الطالب', 'المجموعة', 'الحالة', 'الحضور', 'الانصراف'], db.attendance.filter(a => a.date === date() && activeStudents().some(s => s.id === a.studentId)).map(a => [studentName(a.studentId), groupName(a.groupId), a.status === 'present' ? 'حاضر' : 'غائب', a.time || '', a.departure || '']));
    toast('لا يوجد جدول قابل للتصدير في هذه الصفحة.');
  }

  /* ===== العرض والربط ===== */
  function renderPage() { if (page === 'dashboard') return dashboard(); if (page === 'students') return students(); if (page === 'teachers') return teachers(); if (page === 'supervisors') return supervisorsPage(); if (page === 'staff') return staffPage(); if (page === 'venues') return venues(); if (page === 'groups') return groups(); if (page === 'attendance') return attendance(); if (page === 'attendance-report') return attendanceReport(); if (page === 'exams') return exams(); if (page === 'finance') return finance(); if (page === 'reports') return reports(); if (page === 'notifications') return notifications(); if (page === 'books') return books(); if (page === 'prints') return prints(); if (page === 'settings') return settings(); if (page === 'users') return users(); return dashboard(); }
  function render() {
    if (!session) { renderLogin(); return; }
    const kick = msg => { setSession(null); renderLogin(msg); };
    /* بوابة الاشتراك: عند انتهاء اشتراك المالك (معلم مفرد أو صاحب سنتر) تُطفأ كل الجلسات تحته */
    if (session.kind === 'owner') {
      const o = find('owners', session.id);
      if (!o) return kick('الحساب لم يعد موجوداً — راجع مدير النظام.');
      if (o.subscriptionEnd && subDays(o.subscriptionEnd) < 0) return kick('انتهت فترة اشتراكك — راجع مدير النظام للتجديد. لا يمكن استخدام الموقع حتى التجديد.');
    }
    if (session.kind === 'teacher') {
      const t = sessionTeacher();
      if (!t) return kick('الحساب لم يعد موجوداً — راجع الإدارة.');
      if (t.subscriptionEnd && subDays(t.subscriptionEnd) < 0) return kick('انتهت فترة الاشتراك — راجع الإدارة للتجديد. لا يمكن استخدام الموقع حتى التجديد.');
      if (isCenter() && subscriptionGateBlocked()) return kick(centerGateMsg());
    }
    if (session.kind === 'supervisor') {
      const sp = sessionSupervisor();
      if (!sp) return kick('الحساب لم يعد موجوداً — راجع الإدارة.');
      const blocked = supervisorAccessBlocked(sp);
      if (blocked) return kick(blocked);
    }
    if (session.kind === 'employee') {
      const st = find('staff', session.id);
      if (!st) return kick('الحساب لم يعد موجوداً — راجع الإدارة.');
      const blocked = staffAccessBlocked(st);
      if (blocked) return kick(blocked);
    }
    if (isPortalUser()) {
      const s = find('students', session.ref);
      if (!s || s.status !== 'active') return kick('انتهت الجلسة — سجّل الدخول من جديد.');
      if (studentAccessBlocked(s)) return kick('انتهت فترة اشتراك النظام — الدخول متوقف مؤقتاً. راجع الإدارة.');
      document.body.classList.toggle('dark', !!db.settings.dark);
      $('#app').innerHTML = viewerLayout(portal());
      return;
    }
    const allowed = navFor().map(n => n[0]);
    if (!allowed.includes(page)) page = 'dashboard';
    document.body.classList.toggle('dark', !!db.settings.dark);
    $('#app').innerHTML = layout(renderPage());
    bindDynamic();
  }
  function bindDynamic() {
    const global = $('#global-code'); if (global) global.addEventListener('keydown', e => { if (e.key === 'Enter') { const s = visStudents().find(x => x.code === global.value.trim()); if (s) { page = 'students'; render(); setTimeout(() => studentFile(s.id)); } else toast('لا يوجد طالب بهذا الكود في نطاقك.', 'error'); } });
    const group = $('#attendance-group'); if (group) group.addEventListener('change', e => { attendanceGroup = e.target.value; render(); });
    const code = $('#attendance-code'); if (code) code.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); markAttendance(); } });
    const sf = $('[data-stage-filter]'); if (sf) sf.addEventListener('change', () => filterTable());
    const filter = $('[data-filter="table"]'); if (filter) filter.addEventListener('input', filterTable);
    const form = $('#settings-form'); if (form) form.addEventListener('submit', saveSettings);
    const on = (q, ev, fn) => { const el = $(q); if (el) el.addEventListener(ev, fn); };
    on('#report-month', 'change', e => { reportMonth = e.target.value || month(); render(); });
    on('#report-from', 'change', e => { reportFrom = e.target.value || monthStart(); render(); });
    on('#report-to', 'change', e => { reportTo = e.target.value || date(); render(); });
    on('#report-group', 'change', e => { reportGroup = e.target.value || 'all'; render(); });
    on('#report-exam', 'change', e => { reportExam = e.target.value; render(); });
    on('#report-student', 'change', e => { reportStudent = e.target.value || 'all'; render(); });
    on('#report-method', 'change', e => { reportMethod = e.target.value || 'all'; render(); });
    on('#report-day', 'change', e => { reportDay = e.target.value || date(); render(); });
    on('#finance-month', 'change', e => { financeMonth = e.target.value || 'all'; render(); });
    on('#pm-teacher', 'change', e => { pmTeacher = e.target.value; const panel = $('[data-pm-panel]'); if (panel) { render(); } });
    on('#new-subject', 'keydown', e => { if (e.key === 'Enter') { e.preventDefault(); document.querySelector('[data-action="add-subject"]')?.click(); } });
    on('#restore-file', 'change', e => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { try { const data = JSON.parse(reader.result); if (!data || !Array.isArray(data.students) || !data.settings) throw 0; db = data; localStorage.setItem(KEY, JSON.stringify(db)); render(); toast('تمت استعادة النسخة الاحتياطية بنجاح.'); } catch { toast('ملف غير صالح — تعذر الاستعادة.', 'error'); } };
      reader.readAsText(file);
    });
  }
  window.addEventListener('storage', e => { if (e.key !== KEY || !e.newValue) return; try { const fresh = JSON.parse(e.newValue); if (JSON.stringify(fresh) === JSON.stringify(db)) return; db = fresh; render(); } catch {} });
  function filterTable() { const q = $('[data-filter="table"]')?.value.toLowerCase() || ''; const stage = $('[data-stage-filter]')?.value || 'الكل'; document.querySelectorAll('tbody tr[data-search]').forEach(r => { r.style.display = (r.dataset.search.toLowerCase().includes(q) && (stage === 'الكل' || r.children[1]?.textContent.includes(stage))) ? '' : 'none'; }); }
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
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action],[data-page],[data-settings-tab],[data-report-tab],[data-file-tab],[data-close-modal],[data-sortable],[data-login-role]');
    if (!el) return;
    if (el.dataset.closeModal !== undefined) return closeModal();
    if (el.dataset.loginRole) { loginRole = el.dataset.loginRole; renderLogin(); return; }
    if (!session) return;
    if (el.dataset.page) { page = el.dataset.page; $('#sidebar')?.classList.remove('open'); render(); return; }
    if (el.dataset.settingsTab) { settingsTab = el.dataset.settingsTab; render(); return; }
    if (el.dataset.reportTab) { reportTab = el.dataset.reportTab; render(); return; }
    if (el.dataset.sortable !== undefined) return sortTable(el);
    if (el.dataset.fileTab) {
      /* التبويبات تعمل في النافذة المنبثقة وفي بوابات الطالب/ولي الأمر */
      const modalRoot = $('#modal-root');
      const root = modalRoot && modalRoot.contains(el) ? modalRoot : document;
      root.querySelectorAll('[data-file-tab]').forEach(t => t.classList.toggle('active', t === el));
      root.querySelectorAll('[data-file-section]').forEach(s => s.classList.toggle('active', s.dataset.fileSection === el.dataset.fileTab));
      return;
    }
    const a = el.dataset.action, id = el.dataset.id;
    if (a === 'logout') { logAct('تسجيل خروج', who()); save(); setSession(null); loginRole = 'admin'; render(); toast('تم تسجيل الخروج.'); return; }
    if (a === 'theme') { db.settings.dark = !db.settings.dark; save(); render(); return; }
    if (a === 'print') { page === 'reports' ? printReport(reportTab) : window.print(); return; }
    if (a === 'support') { helpModal(); return; }
    if (a === 'toggle-sidebar') { $('#sidebar').classList.toggle('open'); return; }
    /* تقارير بوابة الطالب/ولي الأمر — متاحة لأصحاب البوابات */
    if (a === 'print-portal-report') return printPortalReport(id);
    if (a === 'export-portal-report') return exportPortalReport(id);
    if (isPortalUser()) return;
    /* إدارة الطلاب */
    if (a === 'add-student') { if (!(can('students.create') || session.kind === 'teacher')) return toast('لا تملك صلاحية إضافة طلاب.', 'error'); studentForm(); }
    if (a === 'edit-student') { const s = find('students', id); if (!(can('students.edit') || session.kind === 'teacher') || !canTouchStudent(s)) return toast('لا تملك صلاحية تعديل هذا الطالب.', 'error'); studentForm(s); }
    if (a === 'student-file') studentFile(id);
    if (a === 'view-archive') archiveView();
    if (a === 'import-students') importStudentsModal();
    if (a === 'import-template') exportCSV('قالب-الطلاب', ['الاسم', 'الكود', 'المرحلة', 'هاتف الطالب', 'هاتف ولي الأمر', 'المصروف'], [['اسم الطالب', '1001', db.stages[0]?.name || '', '01000000000', '01000000000', 200]]);
    if (a === 'students-prev') { studentsPage = Math.max(0, studentsPage - 1); render(); }
    if (a === 'students-next') { studentsPage++; render(); }
    if (a === 'restore-student') { const s = find('students', id); if (s && (can('students.edit') || session.kind === 'teacher')) { s.status = 'active'; db.archivedStudents = db.archivedStudents.filter(x => x.id !== id); logAct('استعادة طالب', s.name); save(); closeModal(); render(); toast('تمت استعادة الطالب إلى القائمة النشطة.'); } }
    if (a === 'archive-student') { const s = find('students', id); if (!s || (!can('students.delete') && session.kind !== 'teacher') || !canTouchStudent(s)) return toast('لا تملك صلاحية أرشفة هذا الطالب.', 'error'); const go = reason => { s.status = 'archived'; db.archivedStudents.push({ ...s, archivedAt: date(), reason }); logAct('أرشفة طالب', s.name + (reason ? ' — ' + reason : '')); save(); render(); toast('تم نقل الطالب إلى الأرشيف.'); }; if (db.settings.confirmDelete) modal('تأكيد حذف الطالب', `<p>هل تريد أرشفة الطالب <b>${esc(s.name)}</b>؟ تبقى بياناته قابلة للاستعادة.</p><div class="field"><label>سبب الحذف (اختياري)</label><input name="reason" placeholder="منقطع، سحب…"></div>`, d => { go(d.get('reason') || ''); closeModal(); }, 'أرشفة'); else go(''); }
    if (a === 'pay') paymentForm(id);
    if (a === 'pay-installment') { const [sid, iid] = id.split('::'); const s = find('students', sid); const inst = (s?.installments || []).find(x => x.id === iid); if (!s || !inst || inst.paid || !canTouchStudent(s)) return toast('غير مسموح.', 'error'); db.payments.push({ id: 'p-' + uid(), studentId: sid, amount: inst.amount, due: studentFee(s), period: inst.month, receivedBy: who(), collectedBy: who(), method: 'يدوي', kind: 'manual', destination: '', createdAt: date(), archived: false }); inst.paid = true; logAct('تحصيل قسط', `${s.name} — ${inst.month} — ${money(inst.amount)}`); save(); render(); toast(`تم تحصيل القسط ${money(inst.amount)}.`); }
    if (a === 'pay-teacher') { const t = find('teachers', id); const adj = personAdjustments('teacher', t.id); const net = Math.max(0, teacherDues(t) + adj.bonus - adj.deduct - personPaid('teacher', t.id)); modal(`صرف مستحقات — ${esc(t.name)}`, `<div class="notice">الصافي المستحق هذا الشهر (مستحق + بونص − خصم − المصروف): <b>${money(net)}</b>. يُسجل كمصروف مالي.</div>${field('amount', 'المبلغ المصروف', net, 'number', true, 'min="1"')}`, data => { const amount = Number(data.get('amount')); if (!amount) return toast('أدخل مبلغاً صحيحاً.', 'error'); db.expenses.push({ id: 'x-' + uid(), amount, reason: `مستحقات معلم — ${t.name}`, teacherId: t.id, payKind: 'teacher', payId: t.id, month: month(), createdAt: date(), user: who() }); logAct('صرف مستحقات معلم', `${t.name} — ${money(amount)}`); save(); closeModal(); render(); toast(`تم تسجيل صرف ${money(amount)} لـ ${t.name}.`); }); }
    if (a === 'adjust-teacher') { const t = find('teachers', id); if (!isCenter()) return toast('الخصومات والبونص للمعلمين في نظام السنتر فقط.', 'error'); payAdjustForm('teacher', t.id, t.name); }
    if (a === 'pay-staff') { const st = find('staff', id); const adj = personAdjustments('staff', st.id); const net = Math.max(0, Number(st.salary || 0) + adj.bonus - adj.deduct - personPaid('staff', st.id)); modal(`صرف راتب — ${esc(st.name)}`, `<div class="notice">الصافي المستحق هذا الشهر: <b>${money(net)}</b>. يُسجل كمصروف مالي.</div>${field('amount', 'المبلغ المصروف', net, 'number', true, 'min="1"')}`, data => { const amount = Number(data.get('amount')); if (!amount) return toast('أدخل مبلغاً صحيحاً.', 'error'); db.expenses.push({ id: 'x-' + uid(), amount, reason: `راتب موظف — ${st.name}${st.jobTitle ? ' (' + st.jobTitle + ')' : ''}`, staffId: st.id, payKind: 'staff', payId: st.id, month: month(), createdAt: date(), user: who() }); logAct('صرف راتب موظف', `${st.name} — ${money(amount)}`); save(); closeModal(); render(); toast(`تم تسجيل صرف ${money(amount)} لـ ${st.name}.`); }); }
    if (a === 'salary-statement') { const [kind, pid] = id.split('::'); const ent = kind === 'teacher' ? find('teachers', pid) : kind === 'supervisor' ? find('supervisors', pid) : find('staff', pid); if (!ent) return; personSalaryModal(kind, pid, ent.name); }
    /* المقرات */
    if (a === 'add-venue') { if (!(isStaffLevel() || (session.kind === 'teacher' && !isCenter()))) return toast('غير مسموح.', 'error'); venueForm(); }
    if (a === 'edit-venue') { if (!(isStaffLevel() || (session.kind === 'teacher' && !isCenter()))) return toast('غير مسموح.', 'error'); venueForm(find('venues', id)); }
    if (a === 'delete-venue') { if (!(isStaffLevel() || (session.kind === 'teacher' && !isCenter()))) return toast('غير مسموح.', 'error'); const v = find('venues', id); db.groups.forEach(g => { if (g.venueId === id) g.venueId = ''; }); db.venues = db.venues.filter(x => x.id !== id); logAct('حذف مقر', v?.name || id); save(); render(); toast('تم حذف المقر وفُصلت مجموعاته عنه.'); }
    /* الموظفون */
    if (a === 'add-staff') { if (!isStaffLevel() && !(session.kind === 'teacher' && !isCenter())) return toast('غير مسموح.', 'error'); staffForm(); }
    if (a === 'edit-staff') { const st = find('staff', id); if (!isStaffLevel() && !(session.kind === 'teacher' && !isCenter())) return toast('غير مسموح.', 'error'); staffForm(st); }
    if (a === 'delete-staff') { const st = find('staff', id); if (!isStaffLevel() && !(session.kind === 'teacher' && !isCenter())) return toast('غير مسموح.', 'error'); db.staff = db.staff.filter(x => x.id !== id); db.payAdjustments = db.payAdjustments.filter(x => !(x.personKind === 'staff' && x.personId === id)); logAct('حذف موظف', st?.name || id); save(); render(); toast('تم حذف الموظف.'); }
    if (a === 'adjust-staff') { const st = find('staff', id); if (!isStaffLevel() && !(session.kind === 'teacher' && !isCenter())) return toast('غير مسموح.', 'error'); payAdjustForm('staff', st.id, st.name); }
    if (a === 'pay-supervisor') { const sp = find('supervisors', id); const net = supNet(sp); modal(`صرف راتب — ${esc(sp.name)}`, `<div class="notice">الصافي المستحق هذا الشهر (راتب + بونص − خصومات − المصروف): <b>${money(net)}</b>. يُسجل كمصروف مالي في حركة النقدية.</div>${field('amount', 'المبلغ المصروف', net, 'number', true, 'min="1"')}`, data => { const amount = Number(data.get('amount')); if (!amount) return toast('أدخل مبلغاً صحيحاً.', 'error'); db.expenses.push({ id: 'x-' + uid(), amount, reason: `راتب مشرف — ${sp.name}`, supervisorId: sp.id, month: month(), createdAt: date(), user: who() }); logAct('صرف راتب مشرف', `${sp.name} — ${money(amount)}`); save(); closeModal(); render(); toast(`تم تسجيل صرف ${money(amount)} لـ ${sp.name}.`); }); }
    /* المعلمون والمشرفون */
    if (a === 'add-teacher') { if (!isStaffLevel()) return toast('إضافة المعلمين لإدارة السنتر والأدارة.', 'error'); teacherForm(); }
    if (a === 'edit-teacher') { if (!isStaffLevel()) return toast('إدارة المعلمين لإدارة السنتر والأدارة.', 'error'); teacherForm(find('teachers', id)); }
    if (a === 'delete-teacher') { if (!isStaffLevel()) return toast('إدارة المعلمين لإدارة السنتر والأدارة.', 'error'); if (db.groups.some(g => (g.teacherIds || []).includes(id))) return toast('لا يمكن حذف معلم مرتبط بمجموعات؛ عدّل المجموعات أولاً.', 'error'); const t = find('teachers', id); db.teachers = db.teachers.filter(x => x.id !== id); logAct('حذف معلم', t?.name || id); save(); render(); toast('تم حذف المعلم.'); }
    if (a === 'renew-teacher') { if (!isStaffLevel()) return toast('تجديد اشتراكات المعلمين لإدارة السنتر والأدارة.', 'error'); renewModal('teacher', id); }
    if (a === 'add-supervisor') { if (session.kind === 'teacher' && isCenter()) return toast('إدارة المشرفين لإدارة السنتر في نظام السنتر.', 'error'); if (!(isStaffLevel() || session.kind === 'teacher')) return toast('المعلم أو إدارة السنتر فقط.', 'error'); if (session.kind === 'teacher' && !myGroups().length) return toast('أضف مجموعة أولاً لربط المشرف بها.', 'error'); supervisorForm(); }
    if (a === 'edit-supervisor') { const sp = find('supervisors', id); if (session.kind === 'teacher' && isCenter()) return toast('إدارة المشرفين لإدارة السنتر في نظام السنتر.', 'error'); if (!(isStaffLevel() || (session.kind === 'teacher' && sp.teacherId === session.id))) return toast('غير مسموح.', 'error'); supervisorForm(sp); }
    if (a === 'delete-supervisor') { const sp = find('supervisors', id); if (session.kind === 'teacher' && isCenter()) return toast('إدارة المشرفين لإدارة السنتر في نظام السنتر.', 'error'); if (!(isStaffLevel() || (session.kind === 'teacher' && sp.teacherId === session.id))) return toast('غير مسموح.', 'error'); db.supervisors = db.supervisors.filter(x => x.id !== id); db.payAdjustments = db.payAdjustments.filter(x => !(x.personKind === 'supervisor' && x.personId === id)); logAct('حذف مشرف', sp.name); save(); render(); toast('تم حذف المشرف.'); }
    if (a === 'renew-supervisor') { const sp = find('supervisors', id); if (session.kind === 'teacher' && isCenter()) return toast('إدارة المشرفين لإدارة السنتر في نظام السنتر.', 'error'); if (!(isStaffLevel() || (session.kind === 'teacher' && sp.teacherId === session.id))) return toast('غير مسموح.', 'error'); renewModal('supervisor', id); }
    if (a === 'sup-schedule') { const sp = find('supervisors', id); if (session.kind === 'teacher' && isCenter()) return toast('إدارة المشرفين لإدارة السنتر في نظام السنتر.', 'error'); if (!(isStaffLevel() || (session.kind === 'teacher' && sp.teacherId === session.id))) return toast('غير مسموح.', 'error'); supScheduleForm(sp); }
    if (a === 'sup-adjust') { const sp = find('supervisors', id); if (session.kind === 'teacher' && isCenter()) return toast('إدارة المشرفين لإدارة السنتر في نظام السنتر.', 'error'); if (!(isStaffLevel() || (session.kind === 'teacher' && sp.teacherId === session.id))) return toast('غير مسموح.', 'error'); supAdjustForm(sp); }
    /* المجموعات */
    if (a === 'add-group') { if (session.kind === 'supervisor' || (session.kind === 'teacher' && isCenter())) return toast('إدارة المجموعات للأدارة في نظام السنتر.', 'error'); groupForm(); }
    if (a === 'edit-group') { const g = find('groups', id); if (!canTouchGroup(g) || session.kind === 'supervisor' || (session.kind === 'teacher' && isCenter())) return toast('إدارة المجموعات للأدارة في نظام السنتر.', 'error'); groupForm(g); }
    if (a === 'delete-group') { const g = find('groups', id); if (!canTouchGroup(g) || session.kind === 'supervisor' || (session.kind === 'teacher' && isCenter())) return toast('إدارة المجموعات للأدارة في نظام السنتر.', 'error'); if (db.students.some(s => s.status === 'active' && s.groupIds.includes(id))) return toast('لا يمكن حذف مجموعة بها طلاب.', 'error'); db.groups = db.groups.filter(x => x.id !== id); logAct('حذف مجموعة', g?.name || id); save(); render(); toast('تم حذف المجموعة.'); }
    /* المراحل والمواد */
    if (a === 'add-stage') { if (!can('settings.view')) return toast('الأدارة فقط.', 'error'); stageForm(); }
    if (a === 'edit-stage') { if (!can('settings.view')) return toast('الأدارة فقط.', 'error'); stageForm(find('stages', id)); }
    if (a === 'delete-stage') { if (!can('settings.view')) return toast('الأدارة فقط.', 'error'); const st = find('stages', id); if (db.students.some(s => s.status === 'active' && s.stage === st.name) || db.groups.some(g => g.stage === st.name) || db.exams.some(ex => ex.stage === st.name)) return toast('لا يمكن حذف مرحلة مرتبطة بطلاب أو مجموعات أو اختبارات.', 'error'); db.stages = db.stages.filter(x => x.id !== id); logAct('حذف مرحلة', st.name); save(); render(); toast('تم حذف المرحلة.'); }
    if (a === 'add-subject') { if (!can('settings.view')) return toast('الأدارة فقط.', 'error'); const inp = $('#new-subject'); const v = inp?.value.trim(); if (!v) return toast('اكتب اسم المادة أولاً.', 'error'); if (db.subjects.includes(v)) return toast('المادة موجودة بالفعل.', 'error'); db.subjects.push(v); logAct('إضافة مادة', v); save(); render(); toast('تمت إضافة المادة.'); }
    if (a === 'del-subject') { if (!can('settings.view')) return toast('الأدارة فقط.', 'error'); const i = Number(id); const subj = db.subjects[i]; if (db.teachers.some(t => t.subject === subj)) return toast('المادة مستخدمة لدى معلم؛ عدّل المعلم أولاً.', 'error'); db.subjects.splice(i, 1); logAct('حذف مادة', subj); save(); render(); toast('تم حذف المادة.'); }
    /* الحضور */
    if (a === 'mark-attendance') { if (session.kind === 'teacher' && isCenter()) return toast('تسجيل الحضور يقوم به المشرف — أنت تتابع التقارير وتحدد موعد غلق الدخول.', 'error'); markAttendance(); }
    if (a === 'set-entry-close') { const g = find('groups', id); if (!canTouchGroup(g)) return toast('غير مسموح.', 'error'); g.entryCloseTime = $('#entry-close')?.value || ''; logAct('تعديل موعد غلق الدخول', g.name + ' — ' + (g.entryCloseTime || 'بدون')); save(); render(); toast(g.entryCloseTime ? `سيُغلق الدخول لحصة ${g.name} بعد ${g.entryCloseTime}.` : 'أُلغي موعد غلق الدخول.'); }
    if (a === 'close-session') { if (session.kind === 'teacher' && isCenter()) return toast('إغلاق الحصة يقوم به المشرف.', 'error'); closeSession(); }
    if (a === 'departure') { if (session.kind === 'teacher' && isCenter()) return toast('تسجيل الانصراف يقوم به المشرف.', 'error'); departureForm(); }
    /* الاختبارات */
    if (a === 'add-exam') { if (session.kind === 'supervisor') return toast('غير مسموح.', 'error'); examForm(); }
    if (a === 'edit-exam') { const ex = find('exams', id); if (session.kind === 'teacher' && ex.teacherId !== session.id) return toast('لا تملك صلاحية تعديل اختبار معلم آخر.', 'error'); if (session.kind === 'supervisor') return toast('غير مسموح.', 'error'); examForm(ex); }
    if (a === 'delete-exam') { const ex = find('exams', id); if (session.kind === 'teacher' && ex.teacherId !== session.id) return toast('لا تملك صلاحية حذف اختبار معلم آخر.', 'error'); if (session.kind === 'supervisor') return toast('غير مسموح.', 'error'); const go2 = () => { db.exams = db.exams.filter(x => x.id !== id); logAct('حذف اختبار', ex.name); save(); render(); toast('تم حذف الاختبار.'); }; if (db.settings.confirmDelete) modal('تأكيد حذف الاختبار', `<p>حذف <b>${esc(ex.name)}</b> سيمحو درجاته (${ex.grades.length}). هل أنت متأكد؟</p>`, () => { go2(); closeModal(); }, 'حذف'); else go2(); }
    if (a === 'grades') { const ex = find('exams', id); if (session.kind === 'teacher' && ex.teacherId !== session.id) return toast('لا تملك صلاحية رصد درجات اختبار معلم آخر.', 'error'); if (session.kind === 'supervisor') return toast('غير مسموح.', 'error'); gradeForm(id); }
    if (a === 'exam-stats') examStats(id);
    /* الأموال وطرق الدفع */
    if (a === 'add-income') { if (!(can('finance.view') || (session.kind === 'teacher' && !isCenter()))) return toast('غير مسموح.', 'error'); moneyForm('income'); }
    if (a === 'add-expense') { if (!(can('finance.view') || (session.kind === 'teacher' && !isCenter()))) return toast('غير مسموح.', 'error'); moneyForm('expense'); }
    if (a === 'add-paymethod') { if (session.kind === 'teacher' && isCenter()) return toast('طرق الدفع للأدارة في نظام السنتر.', 'error'); const tId = session.kind === 'teacher' ? session.id : (pmTeacher || db.teachers[0]?.id); const t = find('teachers', tId); const name = $('#pm-name')?.value.trim(); if (!t || !name) return toast('اكتب اسم الطريقة أولاً.', 'error'); const kind = $('#pm-kind')?.value || 'manual'; const destination = $('#pm-dest')?.value.trim() || ''; if (kind === 'transfer' && !destination) return toast('أدخل رقم الحساب/المحفظة للتحويل.', 'error'); t.payMethods.push({ id: 'pm-' + uid(), name, kind, destination }); logAct('إضافة طريقة دفع', `${t.name} — ${name}`); save(); render(); toast('تمت إضافة طريقة الدفع.'); }
    if (a === 'del-paymethod') { const [tId, mId] = id.split('::'); const t = find('teachers', tId); if (!t) return; if (session.kind === 'teacher' && tId !== session.id) return toast('غير مسموح.', 'error'); t.payMethods = t.payMethods.filter(m => m.id !== mId); logAct('حذف طريقة دفع', t.name); save(); render(); toast('تم حذف طريقة الدفع.'); }
    /* الإشعارات */
    if (a === 'send-notification') {
      const message = $('#notify-message')?.value.trim(); if (!message) return toast('اكتب نص الرسالة أولاً.', 'error');
      const stageV = $('#notify-stage').value, groupV = $('#notify-group').value, recipient = $('#notify-recipient').value;
      const g = myGroups().find(x => x.name === groupV);
      const list = visStudents().filter(s => (stageV === 'كل المراحل' || s.stage === stageV) && (!g || s.groupIds.includes(g.id)));
      const skip = Number($('#notify-skip').value || 0), limit = Number($('#notify-limit').value || 100);
      const targets = list.slice(skip, skip + limit);
      db.notifications.push({ id: 'n-' + uid(), message, recipient, count: targets.length, createdAt: date() });
      logAct('إرسال إشعارات', `${targets.length} مستلم — ${recipient}`);
      save(); render();
      if (!targets.length) return toast('لا يوجد مستلمون مطابقون للفلاتر المختارة.', 'error');
      notificationResults(targets.map(s => ({ name: s.name + (recipient === 'ولي الأمر' ? ' — ولي الأمر' : ''), phone: recipient === 'ولي الأمر' ? s.parentPhone : s.phone, text: message.split('$').join(s.name) })));
    }
    /* الكتب */
    if (a === 'add-supplier' && can('books.view')) supplierForm();
    if (a === 'add-book' && can('books.view')) bookForm();
    if (a === 'edit-book' && can('books.view')) bookForm(find('books', id));
    if (a === 'delete-book' && can('books.view')) { db.books = db.books.filter(x => x.id !== id); save(); render(); toast('تم حذف الكتاب.'); }
    if (a === 'deliver-book' && can('books.view')) deliverBook(id);
    if (a === 'stock-book' && can('books.view')) stockBook(id);
    if (a === 'book-stats' && can('books.view')) bookStats(id);
    /* الحسابات والنماذج */
    if (a === 'edit-admin') { if (session.kind !== 'admin') return toast('مدير النظام فقط.', 'error'); adminForm(find('users', session.id)); }
    /* أصحاب السنترات — مدير النظام فقط */
    if (a === 'add-owner') { if (session.kind !== 'admin') return toast('مدير النظام فقط يضيف أصحاب السنترات.', 'error'); ownerForm(); }
    if (a === 'edit-owner') { if (session.kind !== 'admin') return toast('مدير النظام فقط.', 'error'); ownerForm(find('owners', id)); }
    if (a === 'renew-owner') { if (session.kind !== 'admin') return toast('مدير النظام فقط يجدد اشتراك أصحاب السنترات.', 'error'); renewModal('owner', id); }
    if (a === 'delete-owner') { if (session.kind !== 'admin') return toast('مدير النظام فقط.', 'error'); const o = find('owners', id); db.owners = db.owners.filter(x => x.id !== id); logAct('حذف صاحب سنتر', o?.name || id); save(); render(); toast('تم حذف حساب صاحب السنتر.'); }
    if (a === 'goto-forms') { if (!can('settings.view')) return toast('الأدارة فقط.', 'error'); page = 'settings'; settingsTab = 'forms'; render(); }
    if (a === 'toggle-login-field') { if (!can('settings.view')) return toast('الأدارة فقط.', 'error'); const [role, k] = id.split('::'); const list = db.loginFields[role] || []; const identity = ['username', 'phone', 'code']; if (list.includes(k)) { if (identity.includes(k) && !list.some(x => x !== k && identity.includes(x))) return toast('يجب بقاء حقل تعريف واحد على الأقل لهذا الدور.', 'error'); db.loginFields[role] = list.filter(x => x !== k); } else db.loginFields[role] = [...list, k]; logAct('تعديل حقول الدخول', `${role} — ${k}`); save(); render(); }
    if (a === 'toggle-field') { if (!can('settings.view')) return toast('الأدارة فقط.', 'error'); const [r, k] = id.split('::'); const f = db.formFields[r].find(x => x.key === k); f.enabled = !f.enabled; logAct('تعديل نموذج تسجيل', `${r} — ${f.label} ${f.enabled ? 'ظاهر' : 'مخفي'}`); save(); render(); }
    if (a === 'req-field') { if (!can('settings.view')) return toast('الأدارة فقط.', 'error'); const [r, k] = id.split('::'); const f = db.formFields[r].find(x => x.key === k); f.required = !f.required; save(); render(); }
    if (a === 'del-field') { if (!can('settings.view')) return toast('الأدارة فقط.', 'error'); const [r, k] = id.split('::'); db.formFields[r] = db.formFields[r].filter(x => x.key !== k); logAct('حذف حقل مخصص', `${r} — ${k}`); save(); render(); toast('تم حذف الحقل المخصص.'); }
    if (a === 'add-field') { if (!can('settings.view')) return toast('الأدارة فقط.', 'error'); const r = id; const label = $(`#nf-label-${r}`)?.value.trim(); if (!label) return toast('اكتب اسم الحقل.', 'error'); const type = $(`#nf-type-${r}`)?.value || 'text'; db.formFields[r].push({ key: 'cf-' + uid(), label, type, required: false, enabled: true, custom: true }); logAct('إضافة حقل مخصص', `${r} — ${label}`); save(); render(); toast('تمت إضافة الحقل المخصص إلى النموذج.'); }
    /* المعلمون والمشرفون */
    if (a === 'print-report') printReport(reportTab);
    if (a === 'print-absence') chooseGroupDoc('طباعة كشف غياب', printAbsenceSheet);
    if (a === 'print-names') chooseGroupDoc('طباعة كشف أسماء', printNamesSheet);
    if (a === 'print-barcode') printBarcodes();
    if (a === 'print-cards') printCards();
    if (a === 'export') exportCurrent();
    if (a === 'refresh') render();
    /* أدوات النظام */
    if (a === 'rollover') { if (!can('settings.view')) return toast('الأدارة فقط.', 'error'); rolloverModal(); }
    if (a === 'clear-queue') { if (!can('settings.view')) return toast('الأدارة فقط.', 'error'); db.notifications = []; save(); toast('تم إلغاء الرسائل المخزنة محلياً.'); }
    if (a === 'restore') { if (!can('settings.view')) return toast('الأدارة فقط.', 'error'); $('#restore-file')?.click(); }
    if (a === 'backup') { if (!can('settings.view')) return toast('الأدارة فقط.', 'error'); const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'smart-center-backup-' + date() + '.json'; link.click(); URL.revokeObjectURL(url); toast('تم تنزيل نسخة احتياطية للبيانات.'); }
  });
  /* ترقيم صفحات الطلاب — إعادة تعيين عند تغيير الصفحة */
  let reportMethod = 'all', pmTeacher = null;
  let page = 'dashboard', settingsTab = 'system', studentsPage = 0;
  let reportTab = 'finance', reportMonth = month(), reportFrom = monthStart(), reportTo = date(), reportGroup = 'all', reportExam = '', reportStudent = 'all', reportDay = date();
  let financeMonth = 'all', lastScanned = null, sortDir = {}, attendanceGroup = null;
  render();
})();

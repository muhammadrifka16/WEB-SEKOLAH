'use strict';

/* ══════════ CONFIG ══════════ */
const CFG={
  GURU_SECRET:'SMPN3GARUT2025',
  SESSION_SHORT:1*24*60*60*1000,SESSION_LONG:7*24*60*60*1000,
  INACTIVITY:30*60*1000,BF_LIMIT:5,BF_LOCKOUT:15*60*1000,
  QR_VALIDITY:5*60*1000,
  SEEDED:'smpn3_seeded_v4'
};

/* ══════════ SECURITY ══════════ */
const Sec={
  randHex(b=16){const a=new Uint8Array(b);crypto.getRandomValues(a);return Array.from(a).map(x=>x.toString(16).padStart(2,'0')).join('')},
  randAlpha(l=6){const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<l;i++)s+=c[Math.floor(Math.random()*c.length)];return s},
  async sha256(m){const b=new TextEncoder().encode(m);const h=await crypto.subtle.digest('SHA-256',b);return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,'0')).join('')},
  async hashPwd(p){const s=this.randHex(16);const h=await this.sha256(s+p+'SMPN3GARUT_PEPPER_2025');return s+':'+h},
  async verifyPwd(p,stored){if(!stored||!stored.includes(':'))return false;const[s,h]=stored.split(':');return(await this.sha256(s+p+'SMPN3GARUT_PEPPER_2025'))===h},
  sanitize(s){if(typeof s!=='string')return'';return s.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]))},
  checkStrength(pwd){let s=0;if(pwd.length>=8)s+=20;if(pwd.length>=12)s+=10;if(pwd.length>=16)s+=10;if(/[A-Z]/.test(pwd))s+=15;if(/[a-z]/.test(pwd))s+=10;if(/[0-9]/.test(pwd))s+=15;if(/[^A-Za-z0-9]/.test(pwd))s+=20;const lvl=[{min:0,label:'Sangat Lemah',color:'#e24b4a'},{min:25,label:'Lemah',color:'#e8832a'},{min:45,label:'Sedang',color:'#e8b84b'},{min:65,label:'Kuat',color:'#3a9b7a'},{min:80,label:'Sangat Kuat',color:'#1a6b4a'}];return{score:Math.min(s,100),...([...lvl].reverse().find(l=>s>=l.min)||lvl[0])}}
};

/* ══════════ DB ══════════ */
const DB={
  _k:t=>'smpn3_'+t,
  get(t){try{return JSON.parse(localStorage.getItem(this._k(t))||'[]')}catch{return[]}},
  set(t,d){localStorage.setItem(this._k(t),JSON.stringify(d))},
  getObj(t){try{return JSON.parse(localStorage.getItem(this._k(t))||'{}')}catch{return{}}},
  setObj(t,d){localStorage.setItem(this._k(t),JSON.stringify(d))},
  randId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)},
  genStudentId(){const y=new Date().getFullYear().toString().slice(2);const n=String(DB.getUsers().filter(u=>u.role==='murid').length+1).padStart(3,'0');return`${y}${n}${Sec.randHex(2).toUpperCase().slice(0,2)}`},

  getUsers(){return this.get('users')},
  findUser(u){return this.getUsers().find(x=>x.username===u.toLowerCase())},
  findUserById(id){return this.getUsers().find(u=>u.id===id)},
  addUser(u){const us=this.getUsers();const nu={...u,id:this.randId(),created_at:Date.now()};us.push(nu);this.set('users',us);return nu},
  updateUser(id,upd){this.set('users',this.getUsers().map(u=>u.id===id?{...u,...upd,updated_at:Date.now()}:u))},
  userExists(u){return!!this.findUser(u)},

  getSessions(){return this.get('sessions')},
  addSession(s){const ss=this.getSessions();ss.push(s);this.set('sessions',ss)},
  findSession(t){const ss=this.getSessions().filter(s=>s.expires>Date.now());this.set('sessions',ss);return ss.find(s=>s.token===t)||null},
  removeSession(t){this.set('sessions',this.getSessions().filter(s=>s.token!==t))},
  removeUserSessions(uid){this.set('sessions',this.getSessions().filter(s=>s.userId!==uid))},

  getBF(){return this.getObj('bf')},setBF(d){this.setObj('bf',d)},
  recordFail(u){const bf=this.getBF();const k=u.toLowerCase();if(!bf[k])bf[k]={attempts:0,lastFail:0,lockedUntil:0};bf[k].attempts++;bf[k].lastFail=Date.now();if(bf[k].attempts>=CFG.BF_LIMIT)bf[k].lockedUntil=Date.now()+CFG.BF_LOCKOUT;this.setBF(bf);return bf[k]},
  clearFail(u){const bf=this.getBF();delete bf[u.toLowerCase()];this.setBF(bf)},
  checkLock(u){const rec=this.getBF()[u.toLowerCase()];if(!rec)return{locked:false,remaining:0,attempts:0};if(rec.lockedUntil&&rec.lockedUntil>Date.now())return{locked:true,remaining:Math.ceil((rec.lockedUntil-Date.now())/1000),attempts:rec.attempts};return{locked:false,remaining:0,attempts:rec?rec.attempts:0}},

  getNilai(){return this.get('nilai')},
  addNilai(n){const all=this.getNilai();all.push({...n,id:this.randId(),created_at:Date.now()});this.set('nilai',all)},
  getNilaiMurid(uid){return this.getNilai().filter(n=>n.murid_id===uid)},
  deleteNilai(id){this.set('nilai',this.getNilai().filter(n=>n.id!==id))},

  getAbsensi(){return this.get('absensi')},
  addAbsensi(a){const all=this.getAbsensi();all.push({...a,id:this.randId(),created_at:Date.now()});this.set('absensi',all)},
  getAbsensiMurid(uid){return this.getAbsensi().filter(a=>a.murid_id===uid)},
  deleteAbsensiByDate(kelas,tgl){this.set('absensi',this.getAbsensi().filter(a=>!(a.kelas===kelas&&a.tanggal===tgl)))},

  getKelas(){return this.get('kelas_info')},
  getAllKelasNames(){
    const db=this.getKelas().map(k=>k.nama);
    const murid=this.getUsers().filter(u=>u.role==='murid').map(u=>u.kelas).filter(Boolean);
    const combined=[...new Set([...db,...murid])].sort();
    return combined.length?combined:['7A','7B','8A','8B','9A','9B','9C'];
  },
  getJadwal(){return this.get('jadwal')},

  log(action,userId,detail=''){const logs=this.get('logs');logs.unshift({id:this.randId(),action,userId,detail,ts:Date.now()});if(logs.length>300)logs.splice(300);this.set('logs',logs)},
  getLogs(){return this.get('logs')},

  getQRSession(){try{return JSON.parse(localStorage.getItem('smpn3_qr_active')||'null')}catch{return null}},
  setQRSession(d){localStorage.setItem('smpn3_qr_active',JSON.stringify(d))},
  clearQRSession(){localStorage.removeItem('smpn3_qr_active')}
};

/* ══════════ AUTH ══════════ */
const Auth={
  TOKEN_KEY:'smpn3_token',
  async login(username,password,remember){
    const u=username.trim().toLowerCase();
    if(!u||!password)throw new Error('Username dan password wajib diisi.');
    const lock=DB.checkLock(u);
    if(lock.locked){const m=Math.ceil(lock.remaining/60);throw new Error('LOCKED:Akun terkunci '+m+' menit lagi.')}
    const user=DB.findUser(u);
    if(!user){DB.recordFail(u);throw new Error('Username tidak ditemukan.')}
    if(user.is_suspended)throw new Error('Akun dinonaktifkan. Hubungi administrator.');
    const ok=await Sec.verifyPwd(password,user.password_hash);
    if(!ok){const info=DB.recordFail(u);const left=CFG.BF_LIMIT-info.attempts;if(left<=0)throw new Error('LOCKED:Akun terkunci 15 menit.');throw new Error('Password salah. '+left+' percobaan tersisa.')}
    DB.clearFail(u);
    const token=Sec.randHex(32);
    const expires=Date.now()+(remember?CFG.SESSION_LONG:CFG.SESSION_SHORT);
    DB.addSession({token,userId:user.id,expires,remember,ua:navigator.userAgent.slice(0,80),ip:'local'});
    DB.updateUser(user.id,{last_login:Date.now(),login_count:(user.login_count||0)+1});
    DB.log('LOGIN',user.id,'Login berhasil');
    localStorage.setItem(this.TOKEN_KEY,token);
    return user;
  },
  async register(data){
    const{name,username,role,nipnis,kelas,password,confirm,secret}=data;
    if(!name||!username||!password||!confirm)throw new Error('Semua kolom wajib diisi.');
    const u=username.trim().toLowerCase();
    if(u.length<5)throw new Error('Username minimal 5 karakter.');
    if(!/^[a-z0-9._-]+$/.test(u))throw new Error('Username hanya huruf kecil, angka, titik, strip.');
    if(DB.userExists(u))throw new Error('Username sudah digunakan.');
    if(password!==confirm)throw new Error('Konfirmasi password tidak cocok.');
    const s=Sec.checkStrength(password);
    if(s.score<45)throw new Error('Password terlalu lemah.');
    if(!/[A-Z]/.test(password))throw new Error('Password harus ada huruf kapital.');
    if(!/[0-9]/.test(password))throw new Error('Password harus ada angka.');
    if(!/[^A-Za-z0-9]/.test(password))throw new Error('Password harus ada simbol.');
    if(role==='guru'&&secret!==CFG.GURU_SECRET)throw new Error('Kode guru tidak valid.');
    const hash=await Sec.hashPwd(password);
    const studentId=role==='murid'?DB.genStudentId():null;
    const finalNipNis=nipnis||studentId||'';
    const user=DB.addUser({
      username:u,name:Sec.sanitize(name.trim()),password_hash:hash,role,
      nipnis:Sec.sanitize(finalNipNis.trim()),kelas:role==='murid'?kelas:null,
      mapel:[],kelas_ajar:[],is_suspended:false,login_count:0,
      student_id:studentId,is_new:true
    });
    DB.log('REGISTER',user.id,'Akun baru: '+role+(role==='murid'?` — Kelas ${kelas}`:''));
    const token=Sec.randHex(32);
    const expires=Date.now()+CFG.SESSION_SHORT;
    DB.addSession({token,userId:user.id,expires,remember:false,ua:navigator.userAgent.slice(0,80),ip:'local'});
    DB.updateUser(user.id,{last_login:Date.now(),login_count:1});
    localStorage.setItem(this.TOKEN_KEY,token);
    return user;
  },
  logout(){const t=localStorage.getItem(this.TOKEN_KEY);if(t){const s=DB.findSession(t);if(s)DB.log('LOGOUT',s.userId,'Logout manual');DB.removeSession(t)}localStorage.removeItem(this.TOKEN_KEY)},
  getCurrentUser(){const t=localStorage.getItem(this.TOKEN_KEY);if(!t)return null;const s=DB.findSession(t);if(!s){localStorage.removeItem(this.TOKEN_KEY);return null}return DB.findUserById(s.userId)||null},
  getSession(){const t=localStorage.getItem(this.TOKEN_KEY);if(!t)return null;return DB.findSession(t)},
  isAuth(){return!!this.getCurrentUser()}
};

/* ══════════ SEED ══════════ */
async function seedIfNeeded(){
  if(localStorage.getItem(CFG.SEEDED))return;
  const accounts=[
    {username:'admin',name:'Administrator Sistem',role:'guru',nipnis:'ADMIN001',password:'Admin@2025!',is_admin:true,mapel:[],kelas_ajar:['7A','8A','9C']},
    {username:'pak.budi',name:'Budi Nugraha, S.Pd',role:'guru',nipnis:'198501012010011001',password:'Guru@2025!',mapel:['Matematika','IPA'],kelas_ajar:['7A','8A','9C'],wali_kelas:'8A'},
    {username:'bu.ani',name:'Ani Lestari, S.Pd',role:'guru',nipnis:'198703012012012002',password:'Guru@2025!',mapel:['Bahasa Indonesia','Bahasa Inggris'],kelas_ajar:['7A','8A','9C'],wali_kelas:'9C'},
    {username:'pak.dedy',name:'Dedy Iskandar, S.Pd',role:'guru',nipnis:'198902152015011003',password:'Guru@2025!',mapel:['IPS','PJOK','Seni Budaya'],kelas_ajar:['7A','8A','9C'],wali_kelas:'7A'},
    {username:'wahyu.s',name:'Wahyu Setiawan',role:'murid',nipnis:'2025001',kelas:'7A',password:'Murid@2025!'},
    {username:'dinda.r',name:'Dinda Ramadhani',role:'murid',nipnis:'2025002',kelas:'7A',password:'Murid@2025!'},
    {username:'rafi.af',name:'Rafi Ahmad Fauzi',role:'murid',nipnis:'2025003',kelas:'7A',password:'Murid@2025!'},
    {username:'sella.a',name:'Sella Agustina',role:'murid',nipnis:'2025004',kelas:'7A',password:'Murid@2025!'},
    {username:'bagas.d',name:'Bagas Dwi Pratama',role:'murid',nipnis:'2025005',kelas:'7A',password:'Murid@2025!'},
    {username:'lina.m',name:'Lina Marliana',role:'murid',nipnis:'2025006',kelas:'7A',password:'Murid@2025!'},
    {username:'annisa.p',name:'Annisa Putri Rahayu',role:'murid',nipnis:'2025007',kelas:'8A',password:'Murid@2025!'},
    {username:'rizky.m',name:'Rizky Maulana Akbar',role:'murid',nipnis:'2025008',kelas:'8A',password:'Murid@2025!'},
    {username:'siti.r',name:'Siti Rahmadhani',role:'murid',nipnis:'2025009',kelas:'8A',password:'Murid@2025!'},
    {username:'farhan.a',name:'Farhan Adriansyah',role:'murid',nipnis:'2025010',kelas:'8A',password:'Murid@2025!'},
    {username:'maya.sd',name:'Maya Sari Dewi',role:'murid',nipnis:'2025011',kelas:'8A',password:'Murid@2025!'},
    {username:'andi.f',name:'Andi Firmansyah',role:'murid',nipnis:'2025012',kelas:'8A',password:'Murid@2025!'},
    {username:'hendra.g',name:'Hendra Gunawan',role:'murid',nipnis:'2025013',kelas:'9C',password:'Murid@2025!'},
    {username:'putri.nf',name:'Putri Nur Fadilah',role:'murid',nipnis:'2025014',kelas:'9C',password:'Murid@2025!'},
    {username:'doni.k',name:'Doni Kusuma',role:'murid',nipnis:'2025015',kelas:'9C',password:'Murid@2025!'},
    {username:'wulan.p',name:'Wulan Permatasari',role:'murid',nipnis:'2025016',kelas:'9C',password:'Murid@2025!'},
    {username:'yusuf.af',name:'Yusuf Al-Farisi',role:'murid',nipnis:'2025017',kelas:'9C',password:'Murid@2025!'},
    {username:'nisa.ar',name:'Nisa Aulia Rahman',role:'murid',nipnis:'2025018',kelas:'9C',password:'Murid@2025!'},
  ];
  for(const a of accounts){
    const hash=await Sec.hashPwd(a.password);
    DB.addUser({username:a.username,name:a.name,role:a.role,nipnis:a.nipnis,kelas:a.kelas||null,password_hash:hash,is_admin:!!a.is_admin,is_suspended:false,login_count:0,mapel:a.mapel||[],kelas_ajar:a.kelas_ajar||[],wali_kelas:a.wali_kelas||null});
  }
  const guruBudi=DB.findUser('pak.budi'),guruAni=DB.findUser('bu.ani'),guruDedy=DB.findUser('pak.dedy');
  DB.set('kelas_info',[
    {id:'k7a',nama:'7A',wali_kelas_id:guruDedy?.id,tahun_ajaran:'2024/2025'},
    {id:'k8a',nama:'8A',wali_kelas_id:guruBudi?.id,tahun_ajaran:'2024/2025'},
    {id:'k9c',nama:'9C',wali_kelas_id:guruAni?.id,tahun_ajaran:'2024/2025'},
  ]);
  const muridList=DB.getUsers().filter(u=>u.role==='murid');
  const rng=(min,max)=>min+Math.floor(Math.random()*(max-min+1));
  muridList.forEach(m=>{
    ['Matematika','IPA'].forEach(mp=>DB.addNilai({murid_id:m.id,guru_id:guruBudi?.id,mata_pelajaran:mp,kelas:m.kelas,nilai_tugas:rng(68,95),nilai_uts:rng(62,92),nilai_uas:rng(65,95),semester:'Ganjil 2024/2025'}));
    ['Bahasa Indonesia','Bahasa Inggris'].forEach(mp=>DB.addNilai({murid_id:m.id,guru_id:guruAni?.id,mata_pelajaran:mp,kelas:m.kelas,nilai_tugas:rng(70,95),nilai_uts:rng(68,93),nilai_uas:rng(70,96),semester:'Ganjil 2024/2025'}));
    ['IPS','PJOK','Seni Budaya'].forEach(mp=>DB.addNilai({murid_id:m.id,guru_id:guruDedy?.id,mata_pelajaran:mp,kelas:m.kelas,nilai_tugas:rng(65,90),nilai_uts:rng(60,88),nilai_uas:rng(63,90),semester:'Ganjil 2024/2025'}));
  });
  const statuses=['Hadir','Hadir','Hadir','Hadir','Hadir','Hadir','Sakit','Izin','Alpha'];
  muridList.forEach(m=>{
    for(let i=0;i<30;i++){
      const d=new Date();d.setDate(d.getDate()-i);
      if(d.getDay()===0||d.getDay()===6)continue;
      DB.addAbsensi({murid_id:m.id,guru_id:guruBudi?.id,kelas:m.kelas,tanggal:d.toISOString().split('T')[0],status:statuses[Math.floor(Math.random()*statuses.length)],catatan:''});
    }
  });
  const jadwal=[
    {guru_id:guruBudi?.id,hari:'Senin',jam:'07:30 – 09:00',kelas:'7A',mapel:'Matematika'},
    {guru_id:guruBudi?.id,hari:'Senin',jam:'09:15 – 10:45',kelas:'8A',mapel:'Matematika'},
    {guru_id:guruBudi?.id,hari:'Selasa',jam:'07:30 – 09:00',kelas:'9C',mapel:'Matematika'},
    {guru_id:guruBudi?.id,hari:'Rabu',jam:'07:30 – 09:00',kelas:'7A',mapel:'IPA'},
    {guru_id:guruBudi?.id,hari:'Kamis',jam:'09:15 – 10:45',kelas:'8A',mapel:'IPA'},
    {guru_id:guruBudi?.id,hari:'Jumat',jam:'07:30 – 09:00',kelas:'9C',mapel:'IPA'},
    {guru_id:guruAni?.id,hari:'Senin',jam:'10:00 – 11:30',kelas:'7A',mapel:'Bahasa Indonesia'},
    {guru_id:guruAni?.id,hari:'Selasa',jam:'09:15 – 10:45',kelas:'8A',mapel:'Bahasa Indonesia'},
    {guru_id:guruAni?.id,hari:'Rabu',jam:'10:00 – 11:30',kelas:'9C',mapel:'Bahasa Indonesia'},
    {guru_id:guruAni?.id,hari:'Kamis',jam:'07:30 – 09:00',kelas:'7A',mapel:'Bahasa Inggris'},
    {guru_id:guruAni?.id,hari:'Kamis',jam:'10:00 – 11:30',kelas:'8A',mapel:'Bahasa Inggris'},
    {guru_id:guruAni?.id,hari:'Jumat',jam:'09:15 – 10:45',kelas:'9C',mapel:'Bahasa Inggris'},
    {guru_id:guruDedy?.id,hari:'Selasa',jam:'10:00 – 11:30',kelas:'7A',mapel:'IPS'},
    {guru_id:guruDedy?.id,hari:'Rabu',jam:'09:15 – 10:45',kelas:'8A',mapel:'IPS'},
    {guru_id:guruDedy?.id,hari:'Selasa',jam:'11:45 – 13:15',kelas:'9C',mapel:'IPS'},
    {guru_id:guruDedy?.id,hari:'Kamis',jam:'11:45 – 13:15',kelas:'7A',mapel:'PJOK'},
    {guru_id:guruDedy?.id,hari:'Jumat',jam:'07:30 – 09:00',kelas:'8A',mapel:'PJOK'},
    {guru_id:guruDedy?.id,hari:'Jumat',jam:'10:00 – 11:30',kelas:'9C',mapel:'PJOK'},
    {guru_id:guruDedy?.id,hari:'Rabu',jam:'11:45 – 13:15',kelas:'7A',mapel:'Seni Budaya'},
    {guru_id:guruDedy?.id,hari:'Senin',jam:'11:45 – 13:15',kelas:'8A',mapel:'Seni Budaya'},
    {guru_id:guruDedy?.id,hari:'Kamis',jam:'09:15 – 10:45',kelas:'9C',mapel:'Seni Budaya'},
  ];
  DB.set('jadwal',jadwal);
  DB.log('SYSTEM','system','Database v4 diinisialisasi');
  localStorage.setItem(CFG.SEEDED,'1');
}

/* ══════════ ROUTER ══════════ */
function showPage(page){
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('page-register').classList.remove('active');
  document.getElementById('page-app').style.display='none';
  if(page==='login')document.getElementById('page-login').classList.add('active');
  else if(page==='register')document.getElementById('page-register').classList.add('active');
  else if(page==='app')document.getElementById('page-app').style.display='flex';
}

/* ══════════ TOAST ══════════ */
function toast(msg,type='info',dur=3200){
  const icons={info:'ℹ️',success:'✅',error:'❌',warning:'⚠️'};
  const el=document.createElement('div');
  el.className='toast '+type;
  el.innerHTML=`<span class="toast-icon">${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  document.getElementById('toast-wrap').appendChild(el);
  setTimeout(()=>{el.style.opacity='0';el.style.transform='translateX(120px)';el.style.transition='all .4s';setTimeout(()=>el.remove(),400)},dur);
}

/* ══════════ UI HELPERS ══════════ */
function togglePwd(id,btn){const i=document.getElementById(id);if(i.type==='password'){i.type='text';btn.textContent='🙈'}else{i.type='password';btn.textContent='👁'}}
function setLoading(btnId,on){const b=document.getElementById(btnId);if(on){b.classList.add('loading');b.disabled=true}else{b.classList.remove('loading');b.disabled=false}}
function fieldError(inputEl,msgId,msg){inputEl.classList.add('error');const e=document.getElementById(msgId);if(e){e.textContent=msg;e.classList.add('show')}}
function clearFieldError(inputEl){inputEl.classList.remove('error','success');const n=inputEl.parentElement?.nextElementSibling||inputEl.nextElementSibling;if(n&&n.classList.contains('form-error'))n.classList.remove('show')}
function rata(n){return n.nilai_tugas*0.3+n.nilai_uts*0.3+n.nilai_uas*0.4}

function predikat(avg){
  const a=Number(avg);
  if(!isFinite(a))return 'E';
  if(a>=90) return 'A';
  if(a>=80) return 'B';
  if(a>=70) return 'C';
  if(a>=60) return 'D';
  return 'E';
}

function predikatLabel(p){
  switch(p){
    case 'A': return 'A — Sangat Baik';
    case 'B': return 'B — Baik';
    case 'C': return 'C — Cukup';
    case 'D': return 'D — Kurang';
    default: return 'E — Perlu Bimbingan';
  }
}

function fmtDate(d){return new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}
function initials(name){if(!name)return'?';return name.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase()}
function fillLogin(u,p){document.getElementById('loginUsername').value=u;document.getElementById('loginPassword').value=p}

/* SIDEBAR MOBILE */
function toggleSidebar(){const s=document.getElementById('sidebarEl');const o=document.getElementById('sidebarOverlay');s.classList.toggle('open');o.classList.toggle('show')}
function closeSidebar(){document.getElementById('sidebarEl').classList.remove('open');document.getElementById('sidebarOverlay').classList.remove('show')}

/* CHARTS */
let _charts={};
function destroyCharts(){Object.values(_charts).forEach(c=>{try{c.destroy()}catch{}});_charts={}}
function safeChart(id,cfg){
  if(_charts[id])try{_charts[id].destroy()}catch{}
  const el=document.getElementById(id);if(!el)return;
  Chart.defaults.font.family="'Plus Jakarta Sans',sans-serif";
  _charts[id]=new Chart(el,cfg);
}

/* ══════════ LOGIN ══════════ */
function loginOnEnter(e){if(e.key==='Enter')handleLogin()}
let lockTimer=null;
function updateLockoutBanner(){
  const u=document.getElementById('loginUsername')?.value||'';
  if(!u)return;
  const lock=DB.checkLock(u.toLowerCase());
  const banner=document.getElementById('lockoutBanner');
  if(lock.locked){
    document.getElementById('lockoutMsg').textContent=`🔒 Terkunci. Coba lagi dalam ${Math.ceil(lock.remaining/60)} menit.`;
    banner.classList.add('show');
    if(!lockTimer)lockTimer=setInterval(()=>{const l=DB.checkLock(u.toLowerCase());if(!l.locked){banner.classList.remove('show');clearInterval(lockTimer);lockTimer=null}},1000);
  }else banner.classList.remove('show');
}

async function handleLogin(){
  const u=document.getElementById('loginUsername').value.trim();
  const p=document.getElementById('loginPassword').value;
  const r=document.getElementById('rememberMe').checked;
  if(!u){fieldError(document.getElementById('loginUsername'),'loginUsernameErr','Username wajib diisi.');return}
  if(!p){fieldError(document.getElementById('loginPassword'),'loginPasswordErr','Password wajib diisi.');return}
  if(DB.checkLock(u.toLowerCase()).locked){updateLockoutBanner();return}
  setLoading('btnLogin',true);
  try{
    const user=await Auth.login(u,p,r);
    toast(`Selamat datang, ${user.name.split(' ')[0]}! 🎉`,'success');
    setTimeout(()=>{showPage('app');initDashboard(user)},400);
  }catch(e){
    const msg=e.message||'';
    if(msg.startsWith('LOCKED:')){updateLockoutBanner();toast(msg.replace('LOCKED:',''),'error',5000)}
    else{toast(msg,'error');if(msg.includes('assword')){document.getElementById('loginPassword').classList.add('error');document.getElementById('loginPasswordErr').textContent=msg;document.getElementById('loginPasswordErr').classList.add('show')}else{document.getElementById('loginUsername').classList.add('error');document.getElementById('loginUsernameErr').textContent=msg;document.getElementById('loginUsernameErr').classList.add('show')}}
  }finally{setLoading('btnLogin',false)}
}
function showForgotInfo(){toast('Hubungi administrator sekolah untuk reset password.','info',5000)}

/* ══════════ REGISTER ══════════ */
let currentRegRole='guru';
function switchRegRole(r){
  currentRegRole=r;
  document.getElementById('regRoleGuru').classList.toggle('active',r==='guru');
  document.getElementById('regRoleMurid').classList.toggle('active',r==='murid');
  document.getElementById('regKelasGroup').style.display=r==='murid'?'':'none';
  document.getElementById('regSecretGroup').style.display=r==='guru'?'':'none';
  document.getElementById('regNipNisLabel').innerHTML=(r==='guru'?'NIP Guru':'NIS Murid')+'<span class="required">*</span>';
}
function validateUsername(){
  const el=document.getElementById('regUsername');
  const v=el.value.trim().toLowerCase();
  el.classList.remove('error','success');
  document.getElementById('regUsernameErr').classList.remove('show');
  if(v.length<5){fieldError(el,'regUsernameErr','Min 5 karakter.');return}
  if(!/^[a-z0-9._-]+$/.test(v)){fieldError(el,'regUsernameErr','Hanya huruf kecil, angka, titik, strip.');return}
  if(DB.userExists(v)){fieldError(el,'regUsernameErr','Username sudah digunakan.');return}
  el.classList.add('success');
}
function checkStrength(){
  const p=document.getElementById('regPassword').value;
  const fill=document.getElementById('strengthFill');
  const label=document.getElementById('strengthLabel');
  if(!p){fill.style.width='0';label.textContent='Masukkan password';label.style.color='var(--muted)';return}
  const s=Sec.checkStrength(p);
  fill.style.width=s.score+'%';fill.style.background=s.color;label.textContent=s.label;label.style.color=s.color;
}
function checkConfirm(){
  const p=document.getElementById('regPassword').value;
  const c=document.getElementById('regConfirm');
  c.classList.remove('error','success');
  if(c.value&&c.value!==p){c.classList.add('error');document.getElementById('regConfirmErr').textContent='Tidak cocok.';document.getElementById('regConfirmErr').classList.add('show')}
  else if(c.value===p&&c.value){c.classList.add('success');document.getElementById('regConfirmErr').classList.remove('show')}
}

async function handleRegister(){
  if(!document.getElementById('agreeTerms').checked){toast('Centang persetujuan ketentuan.','warning');return}
  const data={
    name:document.getElementById('regName').value,
    username:document.getElementById('regUsername').value,
    role:currentRegRole,
    nipnis:document.getElementById('regNipNis').value,
    kelas:document.getElementById('regKelas').value,
    password:document.getElementById('regPassword').value,
    confirm:document.getElementById('regConfirm').value,
    secret:document.getElementById('regSecret')?.value||''
  };
  if(currentRegRole==='murid'&&!data.kelas){toast('Pilih kelas terlebih dahulu.','warning');return}
  setLoading('btnRegister',true);
  try{
    const user=await Auth.register(data);
    toast(`🎉 Selamat datang di Sistem SMP Negeri 3 Garut, ${user.name.split(' ')[0]}!`,'success',5000);
    if(currentRegRole==='murid'){
      toast(`📚 Kamu terdaftar di Kelas ${user.kelas} — ID: ${user.student_id||user.nipnis}`,'info',4000);
    }
    setTimeout(()=>{
      const freshUser=Auth.getCurrentUser();
      if(freshUser){showPage('app');initDashboard(freshUser)}
      else{showPage('login')}
    },1200);
  }catch(e){toast(e.message,'error',5000)}
  finally{setLoading('btnRegister',false)}
}

/* ══════════ DASHBOARD INIT ══════════ */
let currentUser=null,inactivityTimer=null,clockTimer=null;
function resetInactivity(){clearTimeout(inactivityTimer);inactivityTimer=setTimeout(()=>{toast('Sesi berakhir karena tidak aktif.','warning',4000);setTimeout(()=>{Auth.logout();showPage('login');clearTimers()},2000)},CFG.INACTIVITY)}
function clearTimers(){clearTimeout(inactivityTimer);clearInterval(clockTimer)}

function initDashboard(user){
  currentUser=user;
  ['mousemove','keydown','click','touchstart'].forEach(e=>document.addEventListener(e,resetInactivity,{passive:true}));
  resetInactivity();
  document.getElementById('sidebarName').textContent=user.name;
  const roleLabel=user.is_admin?'🔐 Admin':user.role==='guru'?'👨‍🏫 Guru':'🎓 Murid';
  document.getElementById('sidebarRole').textContent=roleLabel;
  document.getElementById('sidebarAvatar').textContent=initials(user.name);
  buildSidebarNav(user);
  function tick(){
    const now=new Date();
    document.getElementById('topbarTime').textContent=now.toLocaleString('id-ID',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    const sess=Auth.getSession();
    if(sess){const l=Math.max(0,sess.expires-Date.now());const h=Math.floor(l/3600000);const m=Math.floor((l%3600000)/60000);document.getElementById('sessionInfo').textContent=h>0?`Sesi ${h}j ${m}m`:`Sesi ${m}m`}
  }
  tick();clearInterval(clockTimer);clockTimer=setInterval(tick,30000);
  updateNotifBadge();
  navigate(user.is_admin?'admin-home':'home');
}

function updateNotifBadge(){
  const murid=DB.getUsers().filter(u=>u.role==='murid');
  const today=new Date().toISOString().split('T')[0];
  let alpha=0;
  murid.forEach(m=>{alpha+=DB.getAbsensiMurid(m.id).filter(a=>a.tanggal===today&&a.status==='Alpha').length});
  const badge=document.getElementById('notifCount');
  if(badge){badge.textContent=alpha;badge.classList.toggle('show',alpha>0)}
}
function showNotifToast(){
  const murid=DB.getUsers().filter(u=>u.role==='murid');
  const today=new Date().toISOString().split('T')[0];
  const alphas=[];
  murid.forEach(m=>{if(DB.getAbsensiMurid(m.id).filter(a=>a.tanggal===today&&a.status==='Alpha').length)alphas.push(m.name)});
  if(alphas.length===0)toast('Tidak ada murid Alpha hari ini. ✅','success');
  else toast(`⚠️ ${alphas.length} murid Alpha: ${alphas.slice(0,3).join(', ')}${alphas.length>3?'...':''}`, 'warning',5000);
}

function buildSidebarNav(user){
  const admin=user.is_admin,guru=user.role==='guru',murid=user.role==='murid';
  let nav=[];
  if(admin){
    nav=[{label:'Admin Panel',items:[
      {id:'admin-home',icon:'🏠',text:'Dashboard Admin'},
      {id:'admin-guru',icon:'👨‍🏫',text:'Kelola Guru'},
      {id:'admin-murid',icon:'🎓',text:'Kelola Murid'},
      {id:'admin-kelas',icon:'🏫',text:'Kelola Kelas'},
      {id:'admin-nilai',icon:'📊',text:'Rekap Nilai'},
      {id:'admin-absensi',icon:'✅',text:'Rekap Absensi'},
      {id:'audit',icon:'📋',text:'Audit Log',badge:'Admin'},
    ]},{label:'Akun',items:[{id:'profil',icon:'👤',text:'Profil'},{id:'keamanan',icon:'🔐',text:'Keamanan'}]}];
  }else if(guru){
    nav=[{label:'Menu',items:[
      {id:'home',icon:'🏠',text:'Dashboard Guru'},
      {id:'nilai',icon:'📊',text:'Data Nilai Murid'},
      {id:'input-nilai',icon:'✏️',text:'Input Nilai'},
      {id:'absensi',icon:'✅',text:'Kelola Absensi'},
      {id:'qr-absensi',icon:'📱',text:'QR Absensi'},
      {id:'jadwal',icon:'📅',text:'Jadwal Mengajar'},
    ]},{label:'Akun',items:[{id:'profil',icon:'👤',text:'Profil'},{id:'keamanan',icon:'🔐',text:'Keamanan'}]}];
  }else{
    nav=[{label:'Menu',items:[
      {id:'home',icon:'🏠',text:'Dashboard Murid'},
      {id:'nilai',icon:'📊',text:'Nilai Saya'},
      {id:'absensi',icon:'✅',text:'Absensi Saya'},
      {id:'scan-qr',icon:'📷',text:'Scan QR Absensi'},
    ]},{label:'Akun',items:[{id:'profil',icon:'👤',text:'Profil'},{id:'keamanan',icon:'🔐',text:'Keamanan'}]}];
  }
  const navEl=document.getElementById('sidebarNav');
  navEl.innerHTML=nav.map(sec=>`
    <div class="nav-section-label">${sec.label}</div>
    ${sec.items.map(item=>`<button class="nav-item" id="navItem_${item.id}" onclick="navigate('${item.id}')">
      <span class="ni">${item.icon}</span>${item.text}${item.badge?`<span class="nav-badge">${item.badge}</span>`:''}
    </button>`).join('')}
  `).join('');
}

/* VIEW TIMERS */
let viewTimers=[];
function clearViewTimers(){viewTimers.forEach(t=>{try{clearInterval(t);clearTimeout(t)}catch{}});viewTimers=[]}

/* QR scanner cleanup */
function cleanupQRScanner(){if(window._html5QrCode){try{window._html5QrCode.stop().catch(()=>{}).finally(()=>{window._html5QrCode=null})}catch{window._html5QrCode=null}}}

function navigate(view){
  cleanupQRScanner();
  clearViewTimers();destroyCharts();
  closeSidebar();
  document.querySelectorAll('.nav-item').forEach(e=>e.classList.remove('active'));
  const navEl=document.getElementById('navItem_'+view);
  if(navEl)navEl.classList.add('active');
  const titles={home:'Dashboard','admin-home':'Dashboard Admin','admin-guru':'Kelola Guru','admin-murid':'Kelola Murid','admin-kelas':'Kelola Kelas','admin-nilai':'Rekap Nilai','admin-absensi':'Rekap Absensi',nilai:'Data Nilai','input-nilai':'Input Nilai',absensi:'Kelola Absensi','qr-absensi':'QR Absensi',jadwal:'Jadwal Mengajar','scan-qr':'Scan QR Absensi',profil:'Profil Saya',keamanan:'Info Keamanan',audit:'Audit Log'};
  document.getElementById('topbarTitle').textContent=titles[view]||'Dashboard';
  document.getElementById('mainContent').innerHTML=renderView(view);
  setTimeout(()=>{initViewCharts(view);initViewEvents(view)},80);
}

function renderView(v){
  const u=currentUser,guru=u.role==='guru';
  if(v==='admin-home')return renderAdminHome();
  if(v==='admin-guru')return renderAdminGuru();
  if(v==='admin-murid')return renderAdminMurid();
  if(v==='admin-kelas')return renderAdminKelas();
  if(v==='admin-nilai')return renderAdminNilai();
  if(v==='admin-absensi')return renderAdminAbsensi();
  if(v==='home')return guru?renderGuruHome():renderMuridHome();
  if(v==='nilai')return guru?renderGuruNilai():renderMuridNilai();
  if(v==='input-nilai'&&guru)return renderInputNilai();
  if(v==='absensi')return guru?renderGuruAbsensi():renderMuridAbsensi();
  if(v==='qr-absensi'&&guru)return renderQRAbsensi();
  if(v==='scan-qr')return renderScanQR();
  if(v==='jadwal')return renderJadwal();
  if(v==='profil')return renderProfil();
  if(v==='keamanan')return renderKeamanan();
  if(v==='audit')return renderAudit();
  return '<p>View tidak ditemukan.</p>';
}

/* ══════════ ADMIN VIEWS ══════════ */
function renderAdminHome(){
  const users=DB.getUsers();
  const guru=users.filter(u=>u.role==='guru'&&!u.is_admin);
  const murid=users.filter(u=>u.role==='murid');
  const kelas=DB.getKelas();
  const semua_nilai=DB.getNilai();
  const avg=semua_nilai.length?(semua_nilai.reduce((s,n)=>s+rata(n),0)/semua_nilai.length).toFixed(1):'-';
  const abs=DB.getAbsensi();
  const pctHadir=abs.length?Math.round(abs.filter(a=>a.status==='Hadir').length/abs.length*100):0;
  const mapelSet=new Set(semua_nilai.map(n=>n.mata_pelajaran));
  return `
  <div class="admin-hero">
    <div class="admin-hero-title">🏫 Dashboard Administrator</div>
    <div class="admin-hero-sub">SMP Negeri 3 Garut — Sistem Informasi Sekolah 2025</div>
    <div class="admin-quick">
      <div class="admin-quick-btn" onclick="navigate('admin-guru')"><div class="admin-quick-icon">👨‍🏫</div>Kelola Guru</div>
      <div class="admin-quick-btn" onclick="navigate('admin-murid')"><div class="admin-quick-icon">🎓</div>Kelola Murid</div>
      <div class="admin-quick-btn" onclick="navigate('admin-kelas')"><div class="admin-quick-icon">🏫</div>Kelola Kelas</div>
      <div class="admin-quick-btn" onclick="navigate('admin-nilai')"><div class="admin-quick-icon">📊</div>Rekap Nilai</div>
      <div class="admin-quick-btn" onclick="navigate('admin-absensi')"><div class="admin-quick-icon">✅</div>Absensi</div>
      <div class="admin-quick-btn" onclick="navigate('audit')"><div class="admin-quick-icon">📋</div>Audit Log</div>
    </div>
  </div>
  <div class="stats-row">
    <div class="stat-card"><div class="stat-icon">👨‍🏫</div><div class="stat-label">Total Guru</div><div class="stat-value">${guru.length}</div><div class="stat-sub">Guru aktif</div></div>
    <div class="stat-card"><div class="stat-icon">🎓</div><div class="stat-label">Total Murid</div><div class="stat-value">${murid.length}</div><div class="stat-sub">Terdaftar</div></div>
    <div class="stat-card"><div class="stat-icon">🏫</div><div class="stat-label">Total Kelas</div><div class="stat-value">${kelas.length}</div><div class="stat-sub">Kelas aktif</div></div>
    <div class="stat-card"><div class="stat-icon">📚</div><div class="stat-label">Mata Pelajaran</div><div class="stat-value">${mapelSet.size}</div><div class="stat-sub">Semester ini</div></div>
    <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-label">Rata-rata Nilai</div><div class="stat-value" style="color:var(--green)">${avg}</div><div class="stat-sub">Seluruh sekolah</div></div>
    <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-label">Kehadiran</div><div class="stat-value">${pctHadir}%</div><div class="stat-sub">Total ${abs.length} data</div></div>
  </div>
  <div class="grid-2">
    <div class="card"><div class="card-header"><div class="card-title">📊 Rata-rata Nilai per Mapel</div></div><div class="card-body"><div class="chart-wrap"><canvas id="chartAdminNilai"></canvas></div></div></div>
    <div class="card"><div class="card-header"><div class="card-title">✅ Statistik Kehadiran</div></div><div class="card-body"><div class="chart-wrap"><canvas id="chartAdminAbs"></canvas></div></div></div>
  </div>`;
}

function renderAdminGuru(){
  const users=DB.getUsers();
  const guru=users.filter(u=>u.role==='guru'&&!u.is_admin);
  return `<div class="card">
    <div class="card-header"><div class="card-title">👨‍🏫 Daftar Guru (${guru.length})</div></div>
    <div class="table-wrap"><table>
      <tr><th>#</th><th>Nama Guru</th><th>NIP</th><th>Mata Pelajaran</th><th>Wali Kelas</th><th>Status</th><th>Aksi</th></tr>
      ${guru.map((g,i)=>`<tr>
        <td>${i+1}</td>
        <td><b>${g.name}</b><div style="font-size:11px;color:var(--muted)">@${g.username}</div></td>
        <td style="font-family:monospace;font-size:12px">${g.nipnis||'—'}</td>
        <td>${(g.mapel||[]).join(', ')||'—'}</td>
        <td>${g.wali_kelas?`<span class="badge badge-amber" style="background:var(--gold-dim);color:var(--gold)">${g.wali_kelas}</span>`:'—'}</td>
        <td>${g.is_suspended?'<span class="badge badge-red">Nonaktif</span>':'<span class="badge badge-green">Aktif</span>'}</td>
        <td><button class="btn-action btn-sm ${g.is_suspended?'btn-green':'btn-red'}" onclick="toggleSuspend('${g.id}','${g.is_suspended}')">${g.is_suspended?'Aktifkan':'Nonaktifkan'}</button></td>
      </tr>`).join('')}
    </table></div>
  </div>`;
}

function renderAdminMurid(){
  const allKelas=DB.getAllKelasNames();
  return `
  <div class="filter-bar">
    <label>Kelas:</label>
    <select id="filterKelasAdmin" onchange="filterMuridAdmin()" style="min-width:140px">
      <option value="">Semua Kelas</option>
      ${allKelas.map(k=>`<option value="${k}">${k}</option>`).join('')}
    </select>
    <label>Cari:</label>
    <input type="text" id="searchMuridAdmin" oninput="filterMuridAdmin()" placeholder="Nama / NIS..." style="padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;outline:none;min-height:40px;min-width:160px;background:var(--off)">
    <span id="muridCount" class="badge badge-blue">Loading...</span>
  </div>
  <div id="muridAdminTable" class="filter-fade">${buildMuridAdminTable('','')}</div>`;
}

function buildMuridAdminTable(filterKelas,search){
  let murid=DB.getUsers().filter(u=>u.role==='murid');
  if(filterKelas)murid=murid.filter(m=>m.kelas===filterKelas);
  if(search){const s=search.toLowerCase();murid=murid.filter(m=>m.name.toLowerCase().includes(s)||m.nipnis?.toLowerCase().includes(s)||m.username.toLowerCase().includes(s))}
  const countEl=document.getElementById('muridCount');
  if(countEl)countEl.textContent=`${murid.length} murid`;
  return `<div class="card">
    <div class="card-header"><div class="card-title">🎓 Daftar Murid</div><span class="badge badge-blue">${murid.length} murid</span></div>
    <div class="table-wrap"><table>
      <tr><th>#</th><th>Nama</th><th>NIS</th><th>Kelas</th><th>Rata-rata</th><th>Kehadiran</th><th>Status</th><th>Aksi</th></tr>
      ${murid.length?murid.map((m,i)=>{
        const nils=DB.getNilaiMurid(m.id);
        const avg=nils.length?(nils.reduce((s,n)=>s+rata(n),0)/nils.length).toFixed(1):'-';
        const abs=DB.getAbsensiMurid(m.id);
        const pct=abs.length?Math.round(abs.filter(a=>a.status==='Hadir').length/abs.length*100):0;
        const bc=avg>=80?'badge-green':avg>=70?'badge-blue':avg>=60?'badge-amber':'badge-red';
        return`<tr>
          <td>${i+1}</td>
          <td><b>${m.name}</b>${m.is_new?'<br><span class="new-student-badge">✨ Baru</span>':''}<div style="font-size:11px;color:var(--muted)">@${m.username}</div></td>
          <td style="font-family:monospace;font-size:12px">${m.nipnis}</td>
          <td><span class="badge badge-navy">${m.kelas}</span></td>
          <td><span class="badge ${bc}">${avg}</span></td>
          <td>${pct}%</td>
          <td>${m.is_suspended?'<span class="badge badge-red">Nonaktif</span>':'<span class="badge badge-green">Aktif</span>'}</td>
          <td><button class="btn-action btn-sm ${m.is_suspended?'btn-green':'btn-red'}" onclick="toggleSuspend('${m.id}','${m.is_suspended}')">${m.is_suspended?'Aktifkan':'Nonaktifkan'}</button></td>
        </tr>`;
      }).join(''):`<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted)">Tidak ada murid ditemukan.</td></tr>`}
    </table></div>
  </div>`;
}

window.filterMuridAdmin=function(){
  const kelas=document.getElementById('filterKelasAdmin')?.value||'';
  const search=document.getElementById('searchMuridAdmin')?.value||'';
  const tbl=document.getElementById('muridAdminTable');
  if(tbl){tbl.classList.remove('filter-fade');void tbl.offsetWidth;tbl.classList.add('filter-fade');tbl.innerHTML=buildMuridAdminTable(kelas,search)}
}

function renderAdminKelas(){
  const kelas=DB.getKelas();
  const murid=DB.getUsers().filter(u=>u.role==='murid');
  return `<div class="card">
    <div class="card-header"><div class="card-title">🏫 Daftar Kelas</div></div>
    <div class="table-wrap"><table>
      <tr><th>Kelas</th><th>Wali Kelas</th><th>Murid</th><th>Rata-rata Nilai</th><th>Kehadiran</th></tr>
      ${kelas.map(k=>{
        const wk=DB.findUserById(k.wali_kelas_id);
        const km=murid.filter(m=>m.kelas===k.nama);
        const allNil=km.flatMap(m=>DB.getNilaiMurid(m.id));
        const avg=allNil.length?(allNil.reduce((s,n)=>s+rata(n),0)/allNil.length).toFixed(1):'-';
        const allAbs=km.flatMap(m=>DB.getAbsensiMurid(m.id));
        const pct=allAbs.length?Math.round(allAbs.filter(a=>a.status==='Hadir').length/allAbs.length*100):0;
        const bc=avg>=80?'badge-green':avg>=70?'badge-blue':avg>=60?'badge-amber':'badge-red';
        return`<tr>
          <td><b style="font-size:20px;font-family:'Playfair Display',serif;color:var(--navy)">${k.nama}</b></td>
          <td>${wk?wk.name:'—'}</td><td><b>${km.length}</b> murid</td>
          <td><span class="badge ${bc}">${avg}</span></td><td>${pct}%</td>
        </tr>`;
      }).join('')}
    </table></div>
  </div>
  <div class="card"><div class="card-header"><div class="card-title">📊 Perbandingan Nilai Antar Kelas</div></div><div class="card-body"><div class="chart-wrap"><canvas id="chartKelas"></canvas></div></div></div>`;
}

function renderAdminNilai(){
  const rows=DB.getNilai().slice(0,60);
  return `<div class="card">
    <div class="card-header"><div class="card-title">📊 Rekap Nilai</div><span class="badge badge-blue">${rows.length} entri</span></div>
    <div class="table-wrap"><table>
      <tr><th>Murid</th><th>Kelas</th><th>Mapel</th><th>Guru</th><th>Tugas</th><th>UTS</th><th>UAS</th><th>Rata-rata</th></tr>
      ${rows.map(n=>{const m=DB.findUserById(n.murid_id);const g=DB.findUserById(n.guru_id);const r=rata(n).toFixed(1);const bc=r>=80?'badge-green':r>=70?'badge-blue':r>=60?'badge-amber':'badge-red';return`<tr><td>${m?.name||'—'}</td><td>${n.kelas||'—'}</td><td>${n.mata_pelajaran}</td><td style="font-size:12px;color:var(--muted)">${g?.name||'—'}</td><td>${n.nilai_tugas}</td><td>${n.nilai_uts}</td><td>${n.nilai_uas}</td><td><span class="badge ${bc}">${r}</span></td></tr>`}).join('')}
    </table></div>
  </div>`;
}

function renderAdminAbsensi(){
  const abs=DB.getAbsensi();
  const murid=DB.getUsers().filter(u=>u.role==='murid');
  const h=abs.filter(a=>a.status==='Hadir').length,s=abs.filter(a=>a.status==='Sakit').length,iz=abs.filter(a=>a.status==='Izin').length,al=abs.filter(a=>a.status==='Alpha').length;
  return `<div class="stats-row">
    <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-label">Hadir</div><div class="stat-value" style="color:var(--green)">${h}</div><div class="stat-sub">${abs.length?Math.round(h/abs.length*100):0}%</div></div>
    <div class="stat-card"><div class="stat-icon">🏥</div><div class="stat-label">Sakit</div><div class="stat-value" style="color:var(--amber)">${s}</div></div>
    <div class="stat-card"><div class="stat-icon">📝</div><div class="stat-label">Izin</div><div class="stat-value" style="color:var(--blue-text)">${iz}</div></div>
    <div class="stat-card"><div class="stat-icon">❌</div><div class="stat-label">Alpha</div><div class="stat-value" style="color:var(--red)">${al}</div></div>
  </div>
  <div class="grid-2">
    <div class="card"><div class="card-header"><div class="card-title">Distribusi Kehadiran</div></div><div class="card-body"><div class="chart-wrap-md"><canvas id="chartAbsAdmin"></canvas></div></div></div>
    <div class="card"><div class="card-header"><div class="card-title">Murid Paling Sering Alpha</div></div>
    <div class="table-wrap"><table>
      <tr><th>Murid</th><th>Kelas</th><th>Alpha</th><th>%</th></tr>
      ${murid.map(m=>{const ma=DB.getAbsensiMurid(m.id);const al=ma.filter(a=>a.status==='Alpha').length;return{m,al,total:ma.length}}).sort((a,b)=>b.al-a.al).slice(0,8).map(({m,al,total})=>`<tr><td>${m.name}</td><td>${m.kelas}</td><td><b style="color:var(--red)">${al}</b></td><td>${total?Math.round(al/total*100):0}%</td></tr>`).join('')}
    </table></div></div>
  </div>`;
}

/* ══════════ GURU VIEWS ══════════ */
function renderGuruHome(){
  const u=currentUser;
  const muridSemua=DB.getUsers().filter(m=>m.role==='murid');
  const kelasDiajar=(u.kelas_ajar||[]);
  const muridKelas=muridSemua.filter(m=>kelasDiajar.includes(m.kelas));
  const semua_nilai=DB.getNilai().filter(n=>n.guru_id===u.id);
  const avg=semua_nilai.length?(semua_nilai.reduce((s,n)=>s+rata(n),0)/semua_nilai.length).toFixed(1):'-';
  const semua_abs=DB.getAbsensi();
  const pct=semua_abs.length?Math.round(semua_abs.filter(a=>a.status==='Hadir').length/semua_abs.length*100):0;
  const today=new Date().toISOString().split('T')[0];
  const alphaToday=semua_abs.filter(a=>a.tanggal===today&&a.status==='Alpha');
  return `<div class="stats-row">
    <div class="stat-card"><div class="stat-icon">🎓</div><div class="stat-label">Murid Diajar</div><div class="stat-value">${muridKelas.length}</div><div class="stat-sub">${kelasDiajar.join(', ')}</div></div>
    <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-label">Rata-rata Nilai</div><div class="stat-value" style="color:var(--green)">${avg}</div><div class="stat-sub">Mapel saya</div></div>
    <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-label">Kehadiran</div><div class="stat-value">${pct}%</div><div class="stat-sub">Keseluruhan</div></div>
    <div class="stat-card"><div class="stat-icon">📚</div><div class="stat-label">Mata Pelajaran</div><div class="stat-value">${(u.mapel||[]).length}</div><div class="stat-sub">${(u.mapel||[]).join(', ')}</div></div>
  </div>
  ${alphaToday.length?`<div class="card" style="border-color:var(--red);margin-bottom:20px"><div class="card-header" style="background:var(--red-bg)"><div class="card-title" style="color:var(--red)">⚠️ Murid Alpha Hari Ini (${alphaToday.length})</div></div><div class="card-body" style="padding:12px 20px;display:flex;gap:10px;flex-wrap:wrap">${alphaToday.map(a=>{const m=DB.findUserById(a.murid_id);return`<span class="badge badge-red">❌ ${m?.name||'?'} — ${m?.kelas||'?'}</span>`}).join('')}</div></div>`:''}

  <div class="card" style="margin-bottom:20px">
    <div class="card-header">
      <div class="card-title">🏆 Ranking Murid Terbaik</div>
      <span class="badge badge-gold" style="background:rgba(201,149,42,.12);color:var(--gold);border:1px solid rgba(201,149,42,.18)">Top 5</span>
    </div>
    <div class="card-body" style="padding:0">
      ${(() => {
        const allMurid=DB.getUsers().filter(m=>m.role==='murid');
        const ranking=allMurid.map(m=>{
          const ns=DB.getNilaiMurid(m.id);
          const avg=ns.length?ns.reduce((s,n)=>s+rata(n),0)/ns.length:0;
          return {...m,avg};
        }).sort((a,b)=>b.avg-a.avg);
        const top=ranking.filter(x=>x.avg>0).slice(0,5);
        if(!top.length){
          return `<div style="padding:28px;text-align:center;color:var(--muted);font-weight:700">Belum ada data nilai untuk ranking.</div>`;
        }
        const badgeFor=(idx)=>{
          if(idx===0)return 'gold';
          if(idx===1)return 'silver';
          if(idx===2)return 'bronze';
          return '';
        };
        return `<div style="padding:8px 12px">
          <div class="table-wrap">
            <table>
              <tr><th style="width:60px">Rank</th><th>Murid</th><th>Kelas</th><th style="width:140px">Rata-rata</th></tr>
              ${top.map((m,i)=>{
                const avgStr=m.avg.toFixed(1);
                const rankCls=badgeFor(i);
                return `<tr>
                  <td><div class="rank-badge ${rankCls}">${i+1}</div></td>
                  <td><b>${m.name}</b><div style="font-size:11px;color:var(--muted)">ID: ${m.student_id||m.nipnis||'-'}</div></td>
                  <td><span class="badge badge-navy">${m.kelas||'-'}</span></td>
                  <td><span class="badge ${m.avg>=80?'badge-green':m.avg>=70?'badge-blue':m.avg>=60?'badge-amber':'badge-red'}" style="font-size:11px">${avgStr}</span></td>
                </tr>`;
              }).join('')}
            </table>
          </div>
        </div>`;
      })()}
    </div>
  </div>

  <div class="grid-2">
    <div class="card"><div class="card-header"><div class="card-title">📊 Distribusi Nilai Mapel Saya</div></div><div class="card-body"><div class="chart-wrap"><canvas id="chartGuruNilai"></canvas></div></div></div>
  </div>`;
}

function renderGuruNilai(){
  const u=currentUser;
  const kelasDiajar=(u.kelas_ajar||['7A','8A','9C']);
  return `<div class="filter-bar">
    <label>Kelas:</label>
    <select id="filterKelasNilai" onchange="reRenderNilaiGuru()">
      <option value="">Semua Kelas</option>
      ${kelasDiajar.map(k=>`<option>${k}</option>`).join('')}
    </select>
    <label>Mapel:</label>
    <select id="filterMapelNilai" onchange="reRenderNilaiGuru()">
      <option value="">Semua Mapel</option>
      ${(u.mapel||[]).map(m=>`<option>${m}</option>`).join('')}
    </select>
    <button class="btn-action btn-gold btn-sm" onclick="navigate('input-nilai')">+ Input Nilai</button>
  </div>
  <div id="nilaiGuruTable">${buildNilaiGuruTable('','')}</div>`;
}

window.reRenderNilaiGuru=function(){
  const k=document.getElementById('filterKelasNilai')?.value||'';
  const m=document.getElementById('filterMapelNilai')?.value||'';
  document.getElementById('nilaiGuruTable').innerHTML=buildNilaiGuruTable(k,m);
}

function buildNilaiGuruTable(filterKelas,filterMapel){
  const murid=DB.getUsers().filter(u=>u.role==='murid');
  let rows=murid.flatMap(m=>DB.getNilaiMurid(m.id).map(n=>({...n,_murid:m})));
  if(filterKelas)rows=rows.filter(r=>r._murid.kelas===filterKelas);
  if(filterMapel)rows=rows.filter(r=>r.mata_pelajaran===filterMapel);
  return`<div class="card"><div class="card-header"><div class="card-title">📊 Data Nilai Murid</div><span class="badge badge-blue">${rows.length} data</span></div>
  <div class="table-wrap"><table>
    <tr><th>Murid</th><th>Kelas</th><th>Mapel</th><th>Tugas</th><th>UTS</th><th>UAS</th><th>Rata-rata</th><th>Aksi</th></tr>
    ${rows.length?rows.map(n=>{const r=rata(n).toFixed(1);const bc=r>=80?'badge-green':r>=70?'badge-blue':r>=60?'badge-amber':'badge-red';return`<tr><td><b>${n._murid.name}</b></td><td>${n._murid.kelas}</td><td>${n.mata_pelajaran}</td><td>${n.nilai_tugas}</td><td>${n.nilai_uts}</td><td>${n.nilai_uas}</td><td><span class="badge ${bc}">${r}</span></td><td><button class="btn-action btn-red btn-xs" onclick="deleteNilai('${n.id}')">🗑</button></td></tr>`}).join(''):`<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:32px">Belum ada data nilai.</td></tr>`}
  </table></div></div>`;
}

function renderInputNilai(){
  const u=currentUser;
  const kelasDiajar=(u.kelas_ajar||['7A','8A','9C']);
  const mapel=(u.mapel||['Matematika','IPA','IPS','Bahasa Indonesia','Bahasa Inggris','PJOK','Seni Budaya']);
  return `<div class="card inner-form">
    <div class="card-header"><div class="card-title">✏️ Input Nilai Murid</div></div>
    <div class="card-body">
      <div class="form-group"><label class="form-label">Kelas<span class="required">*</span></label>
        <select class="select-input" id="inpKelas" onchange="loadMuridByKelas()">
          <option value="">Pilih kelas...</option>${kelasDiajar.map(k=>`<option>${k}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">Murid<span class="required">*</span></label>
        <select class="select-input" id="inpMurid"><option value="">Pilih kelas dulu...</option></select></div>
      <div class="form-group"><label class="form-label">Mata Pelajaran<span class="required">*</span></label>
        <select class="select-input" id="inpMapel"><option value="">Pilih mata pelajaran...</option>${mapel.map(m=>`<option>${m}</option>`).join('')}</select></div>
      <div class="form-section-title" style="margin-top:20px">Nilai (0–100)</div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Nilai Tugas (30%)</label><input type="number" class="form-input" id="inpTugas" min="0" max="100" placeholder="0-100" oninput="updatePreview()"></div>
        <div class="form-group"><label class="form-label">Nilai UTS (30%)</label><input type="number" class="form-input" id="inpUts" min="0" max="100" placeholder="0-100" oninput="updatePreview()"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Nilai UAS (40%)</label><input type="number" class="form-input" id="inpUas" min="0" max="100" placeholder="0-100" oninput="updatePreview()"></div>
        <div class="form-group"><label class="form-label">Preview Nilai Akhir</label>
          <div style="background:var(--off);border:1.5px solid var(--border);border-radius:10px;padding:11px 14px;font-size:26px;font-weight:900;color:var(--navy);font-family:'Playfair Display',serif" id="nilaiPreview">—</div></div>
      </div>
      <div class="form-group"><label class="form-label">Semester</label>
        <select class="select-input" id="inpSemester"><option>Ganjil 2024/2025</option><option>Genap 2024/2025</option><option>Ganjil 2025/2026</option></select></div>
      <button class="btn-action btn-navy" style="width:100%;justify-content:center;padding:14px" onclick="submitNilai()">💾 Simpan Nilai</button>
    </div>
  </div>`;
}

/* ══════════ ABSENSI GURU ══════════ */
let absState={kelas:'',tanggal:'',entries:{}};

function renderGuruAbsensi(){
  const u=currentUser;
  const kelasDiajar=(u.kelas_ajar||['7A','8A','9C']);
  const today=new Date().toISOString().split('T')[0];
  if(!absState.kelas)absState.kelas=kelasDiajar[0]||'';
  if(!absState.tanggal)absState.tanggal=today;
  return `<div class="filter-bar">
    <label>Kelas:</label>
    <select id="filterAbsKelas" onchange="changeAbsKelas(this.value)">
      ${kelasDiajar.map(k=>`<option ${absState.kelas===k?'selected':''}>${k}</option>`).join('')}
    </select>
    <label>Tanggal:</label>
    <input type="date" id="filterAbsTanggal" value="${absState.tanggal}" onchange="changeAbsTanggal(this.value)" max="${today}">
    <label>Filter:</label>
    <select id="filterAbsStatus" onchange="filterAbsCards()">
      <option value="">Semua</option><option>Hadir</option><option>Sakit</option><option>Izin</option><option>Alpha</option><option value="belum">Belum</option>
    </select>
  </div>
  <div class="abs-summary" id="absSummary">${buildAbsSummary()}</div>
  <div class="abs-action-bar">
    <button class="btn-action btn-green btn-sm" onclick="markAllStatus('Hadir')">✅ Semua Hadir</button>
    <button class="btn-action btn-sm" style="background:var(--amber);color:#fff;border:none" onclick="markAllStatus('Sakit')">🏥 Semua Sakit</button>
    <button class="btn-action btn-outline btn-sm" onclick="resetAbsState()">↺ Reset</button>
    <div style="flex:1"></div>
    <button class="btn-action btn-navy" onclick="saveAbsensi()">💾 Simpan Absensi</button>
  </div>
  <div class="abs-grid" id="absGrid">${buildAbsCards()}</div>
  <div class="card"><div class="card-header"><div class="card-title">📋 Rekap Absensi 14 Hari</div></div><div class="card-body"><div class="chart-wrap-sm"><canvas id="chartAbsGuru"></canvas></div></div></div>`;
}

function buildAbsSummary(){
  const entries=absState.entries;
  const h=Object.values(entries).filter(s=>s==='Hadir').length;
  const s=Object.values(entries).filter(s=>s==='Sakit').length;
  const iz=Object.values(entries).filter(s=>s==='Izin').length;
  const al=Object.values(entries).filter(s=>s==='Alpha').length;
  const murid=DB.getUsers().filter(u=>u.role==='murid'&&u.kelas===absState.kelas);
  const belum=Math.max(0,murid.length-Object.keys(entries).length);
  return`<div class="abs-sum-item"><div class="abs-sum-dot" style="background:var(--green)"></div>Hadir: <b>${h}</b></div>
    <div class="abs-sum-item"><div class="abs-sum-dot" style="background:var(--amber)"></div>Sakit: <b>${s}</b></div>
    <div class="abs-sum-item"><div class="abs-sum-dot" style="background:var(--navy-light)"></div>Izin: <b>${iz}</b></div>
    <div class="abs-sum-item"><div class="abs-sum-dot" style="background:var(--red)"></div>Alpha: <b>${al}</b></div>
    <div class="abs-sum-item"><div class="abs-sum-dot" style="background:var(--border)"></div>Belum: <b>${belum}</b></div>`;
}

function buildAbsCards(){
  const murid=DB.getUsers().filter(u=>u.role==='murid'&&u.kelas===absState.kelas);
  const existing=DB.getAbsensi().filter(a=>a.kelas===absState.kelas&&a.tanggal===absState.tanggal);
  existing.forEach(a=>{if(!absState.entries[a.murid_id])absState.entries[a.murid_id]=a.status});
  if(!murid.length)return'<div class="empty-state"><div class="empty-icon">🎓</div><div class="empty-text">Tidak ada murid di kelas ini.</div></div>';
  return murid.map(m=>{
    const status=absState.entries[m.id]||'';
    const cls=status?'s-'+status.toLowerCase():'';
    const isExist=existing.find(a=>a.murid_id===m.id);
    return`<div class="abs-card ${cls}" id="abs-card-${m.id}">
      <div class="abs-card-top">
        <div class="abs-avatar" id="abs-av-${m.id}">${initials(m.name)}</div>
        <div>
          <div class="abs-info-name">${m.name}</div>
          <div class="abs-info-sub">${m.kelas} · NIS ${m.nipnis}</div>
          <span class="abs-status-badge" id="abs-badge-${m.id}">${status||'Belum Diabsen'}</span>
          ${isExist?'<span style="font-size:10px;color:var(--muted);margin-left:6px">📀</span>':''}
        </div>
      </div>
      <div class="abs-btns">
        <button class="abs-btn ${status==='Hadir'?'active-hadir':''}" onclick="setAbsStatus('${m.id}','Hadir')">✅ Hadir</button>
        <button class="abs-btn ${status==='Sakit'?'active-sakit':''}" onclick="setAbsStatus('${m.id}','Sakit')">🏥 Sakit</button>
        <button class="abs-btn ${status==='Izin'?'active-izin':''}" onclick="setAbsStatus('${m.id}','Izin')">📝 Izin</button>
        <button class="abs-btn ${status==='Alpha'?'active-alpha':''}" onclick="setAbsStatus('${m.id}','Alpha')">✗ Alpha</button>
      </div>
    </div>`;
  }).join('');
}

window.setAbsStatus=function(muridId,status){
  absState.entries[muridId]=status;
  const card=document.getElementById('abs-card-'+muridId);if(!card)return;
  card.classList.remove('s-hadir','s-sakit','s-izin','s-alpha');
  card.classList.add('s-'+status.toLowerCase());
  const badge=document.getElementById('abs-badge-'+muridId);if(badge)badge.textContent=status;
  const btns=card.querySelectorAll('.abs-btn');
  ['Hadir','Sakit','Izin','Alpha'].forEach((s,i)=>{btns[i].className='abs-btn';if(s===status)btns[i].classList.add('active-'+s.toLowerCase())});
  const sum=document.getElementById('absSummary');if(sum)sum.innerHTML=buildAbsSummary();
}
window.changeAbsKelas=function(k){absState.kelas=k;absState.entries={};const g=document.getElementById('absGrid');const s=document.getElementById('absSummary');if(g)g.innerHTML=buildAbsCards();if(s)s.innerHTML=buildAbsSummary()}
window.changeAbsTanggal=function(t){absState.tanggal=t;absState.entries={};const g=document.getElementById('absGrid');const s=document.getElementById('absSummary');if(g)g.innerHTML=buildAbsCards();if(s)s.innerHTML=buildAbsSummary()}
window.filterAbsCards=function(){
  const f=document.getElementById('filterAbsStatus')?.value||'';
  document.querySelectorAll('.abs-card').forEach(card=>{
    if(!f){card.style.display='';return}
    const badgeText=card.querySelector('.abs-status-badge')?.textContent||'';
    card.style.display=(f==='belum'?badgeText==='Belum Diabsen':badgeText===f)?'':'none';
  });
}
window.markAllStatus=function(status){DB.getUsers().filter(u=>u.role==='murid'&&u.kelas===absState.kelas).forEach(m=>setAbsStatus(m.id,status))}
window.resetAbsState=function(){absState.entries={};const g=document.getElementById('absGrid');const s=document.getElementById('absSummary');if(g)g.innerHTML=buildAbsCards();if(s)s.innerHTML=buildAbsSummary();toast('Absensi di-reset.','info')}
window.saveAbsensi=function(){
  const entries=absState.entries;
  if(!Object.keys(entries).length){toast('Belum ada status yang dipilih.','warning');return}
  DB.deleteAbsensiByDate(absState.kelas,absState.tanggal);
  let saved=0;
  Object.entries(entries).forEach(([muridId,status])=>{
    DB.addAbsensi({murid_id:muridId,guru_id:currentUser.id,kelas:absState.kelas,tanggal:absState.tanggal,status,catatan:''});saved++;
  });
  DB.log('ABSENSI',currentUser.id,`Simpan absensi kelas ${absState.kelas} tgl ${absState.tanggal}, ${saved} murid`);
  updateNotifBadge();
  toast(`✅ Absensi ${saved} murid kelas ${absState.kelas} disimpan!`,'success');
  setTimeout(()=>navigate('absensi'),400);
}

/* ══════════ QR ABSENSI GURU ══════════ */
let qrInterval=null,qrCountdown=null;

function renderQRAbsensi(){
  const u=currentUser;
  const kelasDiajar=(u.kelas_ajar||['7A','8A','9C']);
  const qr=DB.getQRSession();
  const active=qr&&qr.expires>Date.now()&&qr.guruId===u.id;
  return `<div class="grid-2">
    <div class="card">
      <div class="card-header"><div class="card-title">📱 Generate QR Absensi</div></div>
      <div class="card-body">
        <div class="form-group"><label class="form-label">Kelas<span class="required">*</span></label>
          <select class="select-input" id="qrKelas">${kelasDiajar.map(k=>`<option ${active&&qr.kelasId===k?'selected':''}>${k}</option>`).join('')}</select></div>
        <div class="qr-container">
          <div class="qr-box ${active?'active-qr':''}" id="qrBox">
            <div class="qr-code-wrap" id="qrCodeWrap">
              ${active?'<div id="qrRender"></div>':'<div class="qr-placeholder"><span style="font-size:40px">📱</span><span style="font-size:14px;font-weight:600">Klik Generate</span></div>'}
            </div>
          </div>
          <div class="qr-token-display" id="qrTokenDisplay">${active?qr.token:'— — — —'}</div>
          <div class="qr-countdown" id="qrCountdown">${active?'QR Aktif':'QR belum digenerate'}</div>
          <div class="btn-group" style="justify-content:center;flex-wrap:wrap">
            <button class="btn-action btn-navy" onclick="generateQR()">${active?'🔄 Perbarui QR':'📱 Generate QR'}</button>
            ${active?`<button class="btn-action btn-outline" onclick="copyQRToken()" title="Copy token">📋 Salin Token</button><button class="btn-action btn-red" onclick="cancelQR()">✕ Batalkan</button>`:''}
          </div>
          <div style="margin-top:14px;font-size:12px;color:var(--muted);text-align:center">QR berlaku 5 menit · Murid scan atau ketik token untuk absen</div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">🎯 Live — Murid Sudah Scan</div><span class="badge badge-green" id="scanCountBadge">0 scan</span></div>
      <div class="card-body" style="padding:12px">
        <div id="liveScanList"><div class="empty-state"><div class="empty-icon">📡</div><div class="empty-text">Menunggu scan murid...</div></div></div>
      </div>
    </div>
  </div>`;
}

window.generateQR=function(){
  const kelas=document.getElementById('qrKelas')?.value;
  if(!kelas){toast('Pilih kelas terlebih dahulu.','warning');return}
  const token=Sec.randAlpha(6);
  const qrData={token,kelasId:kelas,guruId:currentUser.id,tanggal:new Date().toISOString().split('T')[0],jam:new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}),expires:Date.now()+CFG.QR_VALIDITY,scanned:[]};
  DB.setQRSession(qrData);
  const wrap=document.getElementById('qrCodeWrap');
  if(wrap){
    wrap.innerHTML='<div id="qrRender" style="width:220px;height:220px"></div>';
    try{new QRCode(document.getElementById('qrRender'),{text:`SMPN3:${token}:${kelas}:${qrData.tanggal}`,width:200,height:200,colorDark:'#0b1f3a',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H})}catch(e){document.getElementById('qrRender').innerHTML=`<div style="font-size:40px;padding:60px;color:var(--muted)">📱</div>`}
  }
  document.getElementById('qrBox')?.classList.add('active-qr');
  document.getElementById('qrTokenDisplay').textContent=token;
  toast(`✅ QR dibuat untuk kelas ${kelas}! Token: ${token}`,'success',4000);
  startQRCountdown();startQRLivePoll();
}

window.copyQRToken=function(){
  const qr=DB.getQRSession();
  if(!qr)return;
  navigator.clipboard?.writeText(qr.token).then(()=>toast('Token disalin ke clipboard!','success')).catch(()=>{toast('Token: '+qr.token,'info',5000)});
}

function startQRCountdown(){
  clearInterval(qrCountdown);
  qrCountdown=setInterval(()=>{
    const qr=DB.getQRSession();const el=document.getElementById('qrCountdown');
    if(!el){clearInterval(qrCountdown);return}
    if(!qr||qr.expires<=Date.now()){el.textContent='⏰ QR Kadaluarsa';el.className='qr-countdown urgent';document.getElementById('qrBox')?.classList.remove('active-qr');clearInterval(qrCountdown);return}
    const rem=Math.ceil((qr.expires-Date.now())/1000);
    const min=Math.floor(rem/60);const sec=rem%60;
    el.textContent=`⏱ Berlaku ${min}:${sec.toString().padStart(2,'0')} lagi`;
    el.className='qr-countdown'+(rem<60?' urgent':'');
  },1000);
  viewTimers.push(qrCountdown);
}

function startQRLivePoll(){
  clearInterval(qrInterval);
  qrInterval=setInterval(()=>{
    const qr=DB.getQRSession();const listEl=document.getElementById('liveScanList');const badge=document.getElementById('scanCountBadge');
    if(!listEl)return;
    if(!qr||!qr.scanned||!qr.scanned.length){listEl.innerHTML='<div class="empty-state"><div class="empty-icon">📡</div><div class="empty-text">Menunggu scan murid...</div></div>';if(badge)badge.textContent='0 scan';return}
    if(badge)badge.textContent=`${qr.scanned.length} scan`;
    listEl.innerHTML=qr.scanned.map(uid=>{const m=DB.findUserById(uid);return`<div class="qr-live-item"><span style="font-size:20px">✅</span><div><div style="font-weight:700;font-size:14px;color:var(--navy)">${m?.name||uid}</div><div style="font-size:11px;color:var(--green-text)">${m?.kelas||'?'} · Hadir</div></div><span style="margin-left:auto;font-size:11px;color:var(--muted)">${new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</span></div>`}).join('');
  },2000);
  viewTimers.push(qrInterval);
}

window.cancelQR=function(){DB.clearQRSession();toast('QR absensi dibatalkan.','info');navigate('qr-absensi')}

/* ══════════ SCAN QR MURID (CAMERA) ══════════ */
function renderScanQR(){
  const u=currentUser;
  const qr=DB.getQRSession();
  const active=qr&&qr.expires>Date.now();
  const recent=DB.getAbsensiMurid(u.id).sort((a,b)=>b.tanggal.localeCompare(a.tanggal)).slice(0,5);
  return `<div style="max-width:520px;margin:0 auto">
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><div class="card-title">📷 Scan QR Absensi</div>${active?'<span class="badge badge-green">QR Aktif</span>':'<span class="badge badge-gray">Tidak ada QR</span>'}</div>
      <div class="card-body" style="padding:16px">
        <div id="scannerWrap" style="display:none;margin-bottom:16px">
          <div class="scanner-container" id="qrScannerBox">
            <div class="scanner-header">
              <span class="scanner-title">📷 Kamera Aktif — Arahkan ke QR</span>
              <button onclick="stopQRScanner()" style="background:rgba(255,255,255,.15);border:none;color:#fff;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700">✕ Stop</button>
            </div>
            <div id="html5-qrcode-reader"></div>
            <div class="scanner-success-glow" id="scannerGlow"></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px;justify-content:center">
            <button class="btn-action btn-outline btn-sm" onclick="switchCamera()" id="switchCamBtn">🔄 Ganti Kamera</button>
          </div>
        </div>
        <div id="scannerActions" style="text-align:center;margin-bottom:16px">
          <div style="font-size:42px;margin-bottom:10px">📱</div>
          <div style="font-size:15px;font-weight:700;color:var(--navy);margin-bottom:6px">Scan QR Absensi</div>
          <div style="font-size:13px;color:var(--muted);margin-bottom:16px">Aktifkan kamera untuk scan QR dari guru</div>
          <div class="btn-group" style="justify-content:center">
            <button class="btn-action btn-navy" onclick="startQRScanner()">📷 Aktifkan Kamera</button>
            ${active?`<button class="btn-action btn-gold" onclick="autoScanDemo()" title="Demo scan">⚡ Demo Scan</button>`:''}
          </div>
        </div>
        <div style="border-top:1px solid var(--border);padding-top:16px;margin-top:8px">
          <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:10px;text-align:center;letter-spacing:1px;text-transform:uppercase">Atau masukkan kode manual</div>
          <div style="display:flex;gap:8px">
            <input type="text" id="qrCodeInput" class="form-input" placeholder="Token 6 karakter" maxlength="6" oninput="this.value=this.value.toUpperCase()" style="font-family:monospace;font-size:18px;letter-spacing:6px;text-align:center;flex:1">
            <button class="btn-action btn-navy" onclick="submitQRScan()" style="flex-shrink:0">✓ Verifikasi</button>
          </div>
        </div>
        ${active?`<div style="margin-top:12px;background:var(--green-bg);border:1px solid var(--green);border-radius:10px;padding:10px 14px;font-size:13px;color:var(--green-text);font-weight:600">✅ QR Aktif — Kelas ${qr.kelasId} · Token: <b>${qr.token}</b></div>`:'<div style="margin-top:12px;background:var(--off);border-radius:10px;padding:10px 14px;font-size:13px;color:var(--muted);text-align:center">Belum ada QR aktif dari guru.</div>'}
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">📋 Riwayat Absensi</div></div>
      <div class="table-wrap"><table>
        <tr><th>Tanggal</th><th>Status</th><th>Keterangan</th></tr>
        ${recent.map(a=>{const bc=a.status==='Hadir'?'badge-green':a.status==='Sakit'?'badge-amber':a.status==='Izin'?'badge-blue':'badge-red';return`<tr><td>${a.tanggal}</td><td><span class="badge ${bc}">${a.status}</span></td><td style="font-size:11px;color:var(--muted)">${a.catatan||'—'}</td></tr>`}).join('')||'<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:20px">Belum ada riwayat.</td></tr>'}
      </table></div>
    </div>
  </div>`;
}

/* QR CAMERA SCANNER */
let _scannerFacing='environment';

window.startQRScanner=function(){
  if(!window.Html5Qrcode){toast('Library scanner tidak tersedia.','error');return}
  document.getElementById('scannerWrap').style.display='block';
  document.getElementById('scannerActions').style.display='none';
  const reader=document.getElementById('html5-qrcode-reader');
  if(!reader)return;
  reader.innerHTML='';
  window._html5QrCode=new Html5Qrcode('html5-qrcode-reader');
  window._html5QrCode.start(
    {facingMode:_scannerFacing},
    {fps:10,qrbox:{width:220,height:220},aspectRatio:1.0,disableFlip:false},
    (decodedText)=>{handleCameraScan(decodedText)},
    (errMsg)=>{}
  ).catch(err=>{
    toast('Kamera tidak dapat diakses. Gunakan input manual.','error');
    document.getElementById('scannerWrap').style.display='none';
    document.getElementById('scannerActions').style.display='block';
    window._html5QrCode=null;
  });
}

window.stopQRScanner=function(){
  if(window._html5QrCode){
    window._html5QrCode.stop().then(()=>{window._html5QrCode=null}).catch(()=>{window._html5QrCode=null});
  }
  document.getElementById('scannerWrap').style.display='none';
  document.getElementById('scannerActions').style.display='block';
}

window.switchCamera=function(){
  _scannerFacing=_scannerFacing==='environment'?'user':'environment';
  stopQRScanner();
  setTimeout(startQRScanner,400);
}

function handleCameraScan(decodedText){
  let token=decodedText.trim().toUpperCase();
  if(token.startsWith('SMPN3:')){const parts=token.split(':');token=parts[1]||''}
  if(token.length>=4&&token.length<=8){
    playBeep();
    const glow=document.getElementById('scannerGlow');
    if(glow){glow.style.display='block';setTimeout(()=>{glow.style.display='none'},500)}
    if(window._html5QrCode){window._html5QrCode.pause&&window._html5QrCode.pause(true)}
    const input=document.getElementById('qrCodeInput');
    if(input)input.value=token;
    setTimeout(()=>submitQRScan(),300);
  }
}

function playBeep(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const osc=ctx.createOscillator();const gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    osc.type='sine';osc.frequency.setValueAtTime(880,ctx.currentTime);
    gain.gain.setValueAtTime(0.3,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+0.2);
    osc.start();osc.stop(ctx.currentTime+0.2);
  }catch(e){}
}

window.autoScanDemo=function(){
  const qr=DB.getQRSession();if(!qr)return;
  const input=document.getElementById('qrCodeInput');
  if(input)input.value=qr.token;
  submitQRScan();
}

window.submitQRScan=function(){
  const inputCode=(document.getElementById('qrCodeInput')?.value||'').trim().toUpperCase();
  if(!inputCode||inputCode.length<4){toast('Masukkan kode QR yang valid.','warning');return}
  const qr=DB.getQRSession();
  if(!qr){toast('Tidak ada QR aktif saat ini.','error');return}
  if(qr.expires<=Date.now()){toast('QR sudah kadaluarsa. Minta guru generate ulang.','error');return}
  if(qr.token!==inputCode){toast('Kode QR tidak cocok. Periksa kembali.','error');if(window._html5QrCode)window._html5QrCode.resume&&window._html5QrCode.resume();return}
  const u=currentUser;
  if(u.kelas&&qr.kelasId!==u.kelas){toast(`QR ini untuk kelas ${qr.kelasId}, bukan kelas ${u.kelas}.`,'error');return}
  if(qr.scanned&&qr.scanned.includes(u.id)){toast('Kamu sudah scan QR ini! ✅','warning');return}
  DB.deleteAbsensiByDate(u.kelas,qr.tanggal);
  DB.addAbsensi({murid_id:u.id,guru_id:qr.guruId,kelas:u.kelas,tanggal:qr.tanggal,status:'Hadir',catatan:'Via QR Scan'});
  DB.log('ABSENSI',u.id,'Absensi via QR scan');
  const updated={...qr,scanned:[...(qr.scanned||[]),u.id]};
  DB.setQRSession(updated);
  cleanupQRScanner();
  document.getElementById('qrSuccessName').textContent=u.name;
  document.getElementById('qrSuccessSub').textContent=`Kelas ${u.kelas} · ${qr.tanggal} · Hadir ✅`;
  document.getElementById('qrSuccessOverlay').classList.add('show');
  setTimeout(()=>{document.getElementById('qrSuccessOverlay').classList.remove('show');navigate('scan-qr')},3000);
}

/* ══════════ JADWAL ══════════ */
function renderJadwal(){
  const u=currentUser;
  const jadwal=DB.getJadwal().filter(j=>j.guru_id===u.id);
  const hariOrder=['Senin','Selasa','Rabu','Kamis','Jumat'];
  const grouped={};
  jadwal.forEach(j=>{if(!grouped[j.hari])grouped[j.hari]=[];grouped[j.hari].push(j)});
  hariOrder.forEach(h=>{if(grouped[h])grouped[h].sort((a,b)=>a.jam.localeCompare(b.jam))});
  const hariIniId=new Date().toLocaleDateString('id-ID',{weekday:'long'});
  const hariIni=hariIniId.charAt(0).toUpperCase()+hariIniId.slice(1);
  return`<div class="card">
    <div class="card-header">
      <div class="card-title">📅 Jadwal Mengajar</div>
      <div class="btn-group">${(u.mapel||[]).map(m=>`<span class="badge badge-navy">${m}</span>`).join('')}</div>
    </div>
    <div class="card-body">
      ${hariOrder.map(hari=>`<div style="margin-bottom:20px">
        <div style="font-size:12px;font-weight:700;color:var(--muted);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:8px">
          ${hari}${hari===hariIni?'<span class="badge badge-green" style="font-size:9px">HARI INI</span>':''}
        </div>
        ${(grouped[hari]||[]).map(j=>`<div class="jadwal-item" style="${hari===hariIni?'border-left-color:var(--gold);background:var(--gold-dim)':''}">
          <div class="jadwal-hari">${j.kelas}</div>
          <div class="jadwal-jam">⏰ ${j.jam}</div>
          <div><div class="jadwal-kelas">${j.mapel}</div><div class="jadwal-mapel">Kelas ${j.kelas}</div></div>
          <div class="jadwal-badge"><span class="badge badge-blue">${j.kelas}</span></div>
        </div>`).join('')||`<div style="color:var(--muted);font-size:13px;padding:8px;background:var(--off);border-radius:8px">Tidak ada jadwal</div>`}
      </div>`).join('')}
    </div>
  </div>`;
}

/* ══════════ MURID VIEWS ══════════ */
function renderMuridHome(){
  const u=currentUser;
  const nils=DB.getNilaiMurid(u.id);
  const avg=nils.length?(nils.reduce((s,n)=>s+rata(n),0)/nils.length).toFixed(1):'-';
  const abs=DB.getAbsensiMurid(u.id);
  const hadir=abs.filter(a=>a.status==='Hadir').length;
  const pct=abs.length?Math.round(hadir/abs.length*100):0;
  const allMurid=DB.getUsers().filter(m=>m.role==='murid');
  const ranking=allMurid.map(m=>{const ns=DB.getNilaiMurid(m.id);return{...m,avg:ns.length?ns.reduce((s,n)=>s+rata(n),0)/ns.length:0}}).sort((a,b)=>b.avg-a.avg);
  const rank=ranking.findIndex(m=>m.id===u.id)+1;
  const pr=predikat(avg);
  const isNew=u.is_new;
  return`${isNew?`<div class="admin-hero" style="margin-bottom:20px">
    <div class="admin-hero-title">🎉 Selamat Datang di SMPN 3 Garut!</div>
    <div class="admin-hero-sub">Hai ${u.name.split(' ')[0]}, kamu terdaftar di Kelas ${u.kelas}. ID Siswa: ${u.student_id||u.nipnis}</div>
  </div>`:''}
  <div class="stats-row">
    <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-label">Rata-rata Nilai</div><div class="stat-value" style="color:var(--green)">${avg}</div><div class="stat-sub">Predikat ${pr}</div></div>
    <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-label">Kehadiran</div><div class="stat-value">${pct}%</div><div class="stat-sub">${hadir} dari ${abs.length} hari</div></div>
    <div class="stat-card"><div class="stat-icon">📚</div><div class="stat-label">Mata Pelajaran</div><div class="stat-value">${nils.length}</div><div class="stat-sub">Semester ini</div></div>
  </div>

  <div class="grid-2">
    <div class="card"><div class="card-header"><div class="card-title">📊 Radar Nilai</div></div><div class="card-body"><div class="chart-wrap"><canvas id="chartMuridRadar"></canvas></div></div></div>
    <div class="card"><div class="card-header"><div class="card-title">📊 Nilai Per Mapel</div></div>
    <div class="table-wrap"><table>
      <tr><th>Mapel</th><th>Tugas</th><th>UTS</th><th>UAS</th><th>Akhir</th></tr>
      ${nils.map(n=>{const r=rata(n).toFixed(1);const bc=r>=80?'badge-green':r>=70?'badge-blue':r>=60?'badge-amber':'badge-red';return`<tr><td><b>${n.mata_pelajaran}</b></td><td>${n.nilai_tugas}</td><td>${n.nilai_uts}</td><td>${n.nilai_uas}</td><td><span class="badge ${bc}">${r}</span></td></tr>`}).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">Belum ada nilai.</td></tr>'}
    </table></div></div>
  </div>`;
}

function renderMuridNilai(){
  const u=currentUser;
  const nils=DB.getNilaiMurid(u.id);
  const avg=nils.length?(nils.reduce((s,n)=>s+rata(n),0)/nils.length).toFixed(1):'-';
  const pr=avg>=90?'A — Sangat Baik':avg>=80?'B — Baik':avg>=70?'C — Cukup':avg>=60?'D — Kurang':'E — Perlu Bimbingan';
  return`<div class="card" style="margin-bottom:20px">
    <div class="card-header"><div class="card-title">📊 Nilai Saya</div><div class="btn-group"><span class="badge badge-navy">Kelas ${u.kelas}</span><span class="badge badge-blue">Rata-rata: ${avg}</span><span class="badge badge-green">${pr}</span></div></div>
    <div class="table-wrap"><table>
      <tr><th>Mata Pelajaran</th><th>Tugas (30%)</th><th>UTS (30%)</th><th>UAS (40%)</th><th>Nilai Akhir</th><th>Predikat</th></tr>
      ${nils.map(n=>{const r=rata(n).toFixed(1);const p=r>=90?'A':r>=80?'B':r>=70?'C':r>=60?'D':'E';const bc=r>=80?'badge-green':r>=70?'badge-blue':r>=60?'badge-amber':'badge-red';return`<tr><td><b>${n.mata_pelajaran}</b></td><td>${n.nilai_tugas}</td><td>${n.nilai_uts}</td><td>${n.nilai_uas}</td><td style="font-size:18px;font-weight:900;color:var(--navy);font-family:'Playfair Display',serif">${r}</td><td><span class="badge ${bc}">${p}</span></td></tr>`}).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:32px">Belum ada nilai.</td></tr>'}
    </table></div>
  </div>
  <div class="card"><div class="card-header"><div class="card-title">📈 Grafik Nilai</div></div><div class="card-body"><div class="chart-wrap"><canvas id="chartMuridNilai"></canvas></div></div></div>`;
}

function renderMuridAbsensi(){
  const u=currentUser;
  const abs=DB.getAbsensiMurid(u.id).sort((a,b)=>b.tanggal.localeCompare(a.tanggal));
  const hadir=abs.filter(a=>a.status==='Hadir').length;
  const sakit=abs.filter(a=>a.status==='Sakit').length;
  const izin=abs.filter(a=>a.status==='Izin').length;
  const alpha=abs.filter(a=>a.status==='Alpha').length;
  const pct=abs.length?Math.round(hadir/abs.length*100):0;
  return`<div class="stats-row">
    <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-label">Hadir</div><div class="stat-value" style="color:var(--green)">${hadir}</div><div class="stat-sub">${pct}%</div></div>
    <div class="stat-card"><div class="stat-icon">🏥</div><div class="stat-label">Sakit</div><div class="stat-value" style="color:var(--amber)">${sakit}</div></div>
    <div class="stat-card"><div class="stat-icon">📝</div><div class="stat-label">Izin</div><div class="stat-value" style="color:var(--blue-text)">${izin}</div></div>
    <div class="stat-card"><div class="stat-icon">❌</div><div class="stat-label">Alpha</div><div class="stat-value" style="color:var(--red)">${alpha}</div></div>
  </div>
  <div class="grid-2">
    <div class="card"><div class="card-header"><div class="card-title">Distribusi Kehadiran</div></div><div class="card-body"><div class="chart-wrap-md"><canvas id="chartMuridAbs"></canvas></div></div></div>
    <div class="card"><div class="card-header"><div class="card-title">📋 Riwayat Absensi</div></div>
    <div class="table-wrap"><table>
      <tr><th>Tanggal</th><th>Status</th><th>Ket</th></tr>
      ${abs.slice(0,20).map(a=>{const bc=a.status==='Hadir'?'badge-green':a.status==='Sakit'?'badge-amber':a.status==='Izin'?'badge-blue':'badge-red';return`<tr><td>${a.tanggal}</td><td><span class="badge ${bc}">${a.status}</span></td><td style="font-size:11px;color:var(--muted)">${a.catatan==='Via QR Scan'?'📱 QR':a.catatan||'—'}</td></tr>`}).join('')||'<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:24px">Belum ada data.</td></tr>'}
    </table></div></div>
  </div>`;
}

/* ══════════ SHARED VIEWS ══════════ */
function renderProfil(){
  const u=currentUser;const sess=Auth.getSession();
  return`<div class="profile-card">
    <div class="profile-avatar-area">
      <div class="profile-avatar">${initials(u.name)}</div>
      <div class="profile-name">${u.name}</div>
      <div class="profile-role-tag">${u.is_admin?'🔐 Administrator':u.role==='guru'?'👨‍🏫 Guru':'🎓 Murid'}</div>
      ${u.kelas?`<div style="margin-top:8px;font-size:13px;color:var(--muted)">Kelas ${u.kelas}</div>`:''}
      ${u.student_id?`<div style="margin-top:6px;font-size:11px;font-family:monospace;color:var(--navy);background:var(--gold-dim);padding:3px 8px;border-radius:6px">ID: ${u.student_id}</div>`:''}
      ${(u.mapel||[]).length?`<div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap;justify-content:center">${u.mapel.map(m=>`<span class="badge badge-navy" style="font-size:10px">${m}</span>`).join('')}</div>`:''}
    </div>
    <div>
      <div class="form-section-title">Informasi Akun</div>
      <div class="profile-detail-grid">
        <div><div class="profile-detail-label">Username</div><div class="profile-detail-value" style="font-family:monospace">@${u.username}</div></div>
        <div><div class="profile-detail-label">${u.role==='guru'?'NIP':'NIS'}</div><div class="profile-detail-value">${u.nipnis||'—'}</div></div>
        <div><div class="profile-detail-label">Login Terakhir</div><div class="profile-detail-value">${u.last_login?fmtDate(u.last_login):'—'}</div></div>
        <div><div class="profile-detail-label">Total Login</div><div class="profile-detail-value">${u.login_count||1}×</div></div>
        <div><div class="profile-detail-label">Sesi Berakhir</div><div class="profile-detail-value">${sess?new Date(sess.expires).toLocaleString('id-ID'):'—'}</div></div>
        <div><div class="profile-detail-label">Terdaftar</div><div class="profile-detail-value">${fmtDate(u.created_at)}</div></div>
        <div><div class="profile-detail-label">Status</div><div class="profile-detail-value"><span class="badge badge-green">✅ Aktif</span></div></div>
      </div>
    </div>
  </div>`;
}

function renderKeamanan(){
  const sess=Auth.getSession();
  const rem=sess?.remember;
  const exp=sess?new Date(sess.expires).toLocaleString('id-ID'):'—';
  return`<div class="security-info">
    <div class="sec-title">🔐 Status Keamanan Sistem</div>
    <div class="sec-row"><span class="sec-icon">🔒</span><span class="sec-text">Hashing Password</span><span class="sec-value sec-ok">SHA-256 + Salt + Pepper ✓</span></div>
    <div class="sec-row"><span class="sec-icon">🎟</span><span class="sec-text">Session Token</span><span class="sec-value sec-ok">32-byte Random Hex ✓</span></div>
    <div class="sec-row"><span class="sec-icon">⏰</span><span class="sec-text">Sesi Berakhir</span><span class="sec-value sec-warn">${exp}</span></div>
    <div class="sec-row"><span class="sec-icon">💾</span><span class="sec-text">Ingat Saya</span><span class="sec-value ${rem?'sec-ok':'sec-warn'}">${rem?'Aktif (7 hari)':'Tidak aktif (1 hari)'}</span></div>
    <div class="sec-row"><span class="sec-icon">🚫</span><span class="sec-text">Brute Force Protection</span><span class="sec-value sec-ok">5 Percobaan → Lockout 15 menit ✓</span></div>
    <div class="sec-row"><span class="sec-icon">⌛</span><span class="sec-text">Auto-logout Inaktif</span><span class="sec-value sec-ok">30 Menit ✓</span></div>
    <div class="sec-row"><span class="sec-icon">📱</span><span class="sec-text">QR Absensi</span><span class="sec-value sec-ok">Token 6-char · Expires 5 menit ✓</span></div>
    <div class="sec-row"><span class="sec-icon">📷</span><span class="sec-text">Scan Camera</span><span class="sec-value sec-ok">html5-qrcode · Realtime ✓</span></div>
  </div>
  <div class="card"><div class="card-header"><div class="card-title">🔑 Ganti Password</div></div>
  <div class="card-body"><div class="inner-form">
    <div class="form-group"><label class="form-label">Password Saat Ini</label>
      <div class="input-wrap"><input type="password" class="form-input" id="chgCurrent" placeholder="Password lama"><button class="input-toggle" onclick="togglePwd('chgCurrent',this)" type="button">👁</button></div></div>
    <div class="form-group"><label class="form-label">Password Baru</label>
      <div class="input-wrap"><input type="password" class="form-input" id="chgNew" placeholder="Min 8 karakter" oninput="chkStrNew()"><button class="input-toggle" onclick="togglePwd('chgNew',this)" type="button">👁</button></div>
      <div class="strength-bar"><div class="strength-fill" id="sfNew"></div></div>
      <div class="strength-label" id="slNew" style="color:var(--muted)">Masukkan password baru</div></div>
    <div class="form-group"><label class="form-label">Konfirmasi Password Baru</label>
      <div class="input-wrap"><input type="password" class="form-input" id="chgConfirm" placeholder="Ulangi"><button class="input-toggle" onclick="togglePwd('chgConfirm',this)" type="button">👁</button></div></div>
    <button class="btn-action btn-navy" onclick="changePassword()">🔐 Ubah Password</button>
  </div></div></div>`;
}

function renderAudit(){
  const logs=DB.getLogs();
  const icons={LOGIN:'🔐',LOGOUT:'🚪',REGISTER:'👤',SYSTEM:'⚙️',NILAI:'📊',ABSENSI:'✅',CHANGE_PWD:'🔑',SUSPEND:'🚫',ACTIVATE:'✅'};
  return`<div class="card">
    <div class="card-header"><div class="card-title">📋 Audit Log Sistem</div><span class="badge badge-blue">${logs.length} entri</span></div>
    <div class="card-body" style="padding:12px 20px">
      ${logs.length?logs.slice(0,100).map(l=>{const u=DB.findUserById(l.userId);return`<div class="log-item">
        <div class="log-icon">${icons[l.action]||'📌'}</div>
        <div class="log-body"><div class="log-action">${l.action} — ${u?u.name:l.userId}</div><div class="log-detail">${l.detail}</div></div>
        <div class="log-time">${new Date(l.ts).toLocaleString('id-ID')}</div>
      </div>`}).join(''):`<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">Belum ada log.</div></div>`}
    </div>
  </div>`;
}

/* ══════════ CHART INIT ══════════ */
function initViewCharts(view){
  const navy='#0b1f3a',gold='#c9952a',green='#1a6b4a',red='#9b2020',amber='#b97c0a',blue='#1e3d6b';
  const opts={responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{font:{family:"'Plus Jakarta Sans',sans-serif",size:12},color:navy}}}};

  if(view==='admin-home'){
    const nilai=DB.getNilai();
    const mapels=[...new Set(nilai.map(n=>n.mata_pelajaran))].sort();
    const avgPerMapel=mapels.map(mp=>{const ns=nilai.filter(n=>n.mata_pelajaran===mp);return ns.length?(ns.reduce((s,n)=>s+rata(n),0)/ns.length).toFixed(1):0});
    safeChart('chartAdminNilai',{type:'bar',data:{labels:mapels,datasets:[{label:'Rata-rata',data:avgPerMapel,backgroundColor:mapels.map((_,i)=>[gold,navy,green,amber,blue,red][i%6]+'cc'),borderRadius:8,borderSkipped:false}]},options:{...opts,scales:{y:{beginAtZero:true,max:100,grid:{color:'rgba(0,0,0,.05)'},ticks:{color:navy}},x:{ticks:{color:navy,font:{size:10}},grid:{display:false}}}}});
    const abs=DB.getAbsensi();
    safeChart('chartAdminAbs',{type:'doughnut',data:{labels:['Hadir','Sakit','Izin','Alpha'],datasets:[{data:[abs.filter(a=>a.status==='Hadir').length,abs.filter(a=>a.status==='Sakit').length,abs.filter(a=>a.status==='Izin').length,abs.filter(a=>a.status==='Alpha').length],backgroundColor:[green,amber,blue,red],borderWidth:0}]},options:{...opts,cutout:'65%',plugins:{legend:{position:'bottom',labels:{boxWidth:12,padding:16,font:{size:12}}}}}});
  }
  if(view==='admin-kelas'){
    const kelas=DB.getKelas();const murid=DB.getUsers().filter(u=>u.role==='murid');
    const avgs=kelas.map(k=>{const km=murid.filter(m=>m.kelas===k.nama);const ns=km.flatMap(m=>DB.getNilaiMurid(m.id));return ns.length?(ns.reduce((s,n)=>s+rata(n),0)/ns.length).toFixed(1):0});
    safeChart('chartKelas',{type:'bar',data:{labels:kelas.map(k=>k.nama),datasets:[{label:'Rata-rata Nilai',data:avgs,backgroundColor:[gold+'cc',navy+'cc',green+'cc'],borderRadius:12,borderSkipped:false}]},options:{...opts,scales:{y:{beginAtZero:true,max:100,grid:{color:'rgba(0,0,0,.05)'},ticks:{color:navy}},x:{ticks:{color:navy},grid:{display:false}}}}});
  }
  if(view==='admin-absensi'){
    const abs=DB.getAbsensi();
    safeChart('chartAbsAdmin',{type:'doughnut',data:{labels:['Hadir','Sakit','Izin','Alpha'],datasets:[{data:[abs.filter(a=>a.status==='Hadir').length,abs.filter(a=>a.status==='Sakit').length,abs.filter(a=>a.status==='Izin').length,abs.filter(a=>a.status==='Alpha').length],backgroundColor:[green,amber,blue,red],borderWidth:0}]},options:{...opts,cutout:'60%',plugins:{legend:{position:'bottom',labels:{boxWidth:12,padding:14}}}}});
  }
  if(view==='home'&&currentUser.role==='guru'){
    const nilai=DB.getNilai().filter(n=>n.guru_id===currentUser.id);
    const mapels=[...new Set(nilai.map(n=>n.mata_pelajaran))].sort();
    safeChart('chartGuruNilai',{type:'bar',data:{labels:mapels,datasets:[{label:'Rata-rata Nilai',data:mapels.map(mp=>{const ns=nilai.filter(n=>n.mata_pelajaran===mp);return ns.length?(ns.reduce((s,n)=>s+rata(n),0)/ns.length).toFixed(1):0}),backgroundColor:gold+'cc',borderRadius:8,borderSkipped:false,borderColor:gold,borderWidth:2}]},options:{...opts,scales:{y:{beginAtZero:true,max:100,grid:{color:'rgba(0,0,0,.04)'},ticks:{color:navy}},x:{ticks:{color:navy},grid:{display:false}}}}});
  }
  if(view==='absensi'&&currentUser.role==='guru'){
    const abs=DB.getAbsensi().filter(a=>a.kelas===absState.kelas);
    const days=[],hadirData=[],alphaData=[];
    for(let i=13;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const ds=d.toISOString().split('T')[0];days.push(ds.slice(5));const da=abs.filter(a=>a.tanggal===ds);hadirData.push(da.filter(a=>a.status==='Hadir').length);alphaData.push(da.filter(a=>a.status==='Alpha').length)}
    safeChart('chartAbsGuru',{type:'line',data:{labels:days,datasets:[{label:'Hadir',data:hadirData,borderColor:green,backgroundColor:green+'22',fill:true,tension:.4,pointRadius:3},{label:'Alpha',data:alphaData,borderColor:red,backgroundColor:red+'22',fill:true,tension:.4,pointRadius:3}]},options:{...opts,scales:{y:{beginAtZero:true,grid:{color:'rgba(0,0,0,.04)'},ticks:{color:navy}},x:{ticks:{color:navy,maxTicksLimit:8},grid:{display:false}}}}});
  }
  if(view==='home'&&currentUser.role==='murid'){
    const nils=DB.getNilaiMurid(currentUser.id);
    safeChart('chartMuridRadar',{type:'radar',data:{labels:nils.map(n=>n.mata_pelajaran),datasets:[{label:'Nilai Kamu',data:nils.map(n=>rata(n).toFixed(1)),borderColor:gold,backgroundColor:gold+'33',pointBackgroundColor:gold,pointRadius:5}]},options:{...opts,scales:{r:{beginAtZero:true,max:100,ticks:{color:navy,font:{size:10}},grid:{color:'rgba(0,0,0,.06)'},pointLabels:{color:navy,font:{size:11}}}}}});
  }
  if(view==='nilai'&&currentUser.role==='murid'){
    const nils=DB.getNilaiMurid(currentUser.id);
    safeChart('chartMuridNilai',{type:'bar',data:{labels:nils.map(n=>n.mata_pelajaran),datasets:[{label:'Tugas',data:nils.map(n=>n.nilai_tugas),backgroundColor:gold+'cc',borderRadius:6},{label:'UTS',data:nils.map(n=>n.nilai_uts),backgroundColor:navy+'cc',borderRadius:6},{label:'UAS',data:nils.map(n=>n.nilai_uas),backgroundColor:green+'cc',borderRadius:6}]},options:{...opts,scales:{y:{beginAtZero:true,max:100,grid:{color:'rgba(0,0,0,.04)'},ticks:{color:navy}},x:{ticks:{color:navy,font:{size:10}},grid:{display:false}}}}});
  }
  if(view==='absensi'&&currentUser.role==='murid'){
    const abs=DB.getAbsensiMurid(currentUser.id);
    safeChart('chartMuridAbs',{type:'doughnut',data:{labels:['Hadir','Sakit','Izin','Alpha'],datasets:[{data:[abs.filter(a=>a.status==='Hadir').length,abs.filter(a=>a.status==='Sakit').length,abs.filter(a=>a.status==='Izin').length,abs.filter(a=>a.status==='Alpha').length],backgroundColor:[green,amber,blue,red],borderWidth:0}]},options:{...opts,cutout:'60%',plugins:{legend:{position:'bottom',labels:{boxWidth:12,padding:14}}}}});
  }
}

/* ══════════ VIEW EVENTS ══════════ */
function initViewEvents(view){
  if(view==='keamanan'){
    window.chkStrNew=function(){
      const p=document.getElementById('chgNew')?.value||'';
      const s=Sec.checkStrength(p);
      const fill=document.getElementById('sfNew');const label=document.getElementById('slNew');
      if(fill){fill.style.width=s.score+'%';fill.style.background=s.color}
      if(label){label.textContent=p?s.label:'Masukkan password baru';label.style.color=s.color}
    };
  }
  if(view==='qr-absensi'){
    const qr=DB.getQRSession();
    if(qr&&qr.expires>Date.now()&&qr.guruId===currentUser.id){
      setTimeout(()=>{
        try{new QRCode(document.getElementById('qrRender'),{text:`SMPN3:${qr.token}:${qr.kelasId}:${qr.tanggal}`,width:200,height:200,colorDark:'#0b1f3a',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H})}catch(e){}
        startQRCountdown();startQRLivePoll();
      },100);
    }
  }
}

/* ══════════ EVENT HANDLERS ══════════ */
window.loadMuridByKelas=function(){
  const k=document.getElementById('inpKelas')?.value;
  const sel=document.getElementById('inpMurid');
  if(!sel)return;
  if(!k){sel.innerHTML='<option value="">Pilih kelas dulu...</option>';return}
  const murid=DB.getUsers().filter(u=>u.role==='murid'&&u.kelas===k);
  sel.innerHTML=`<option value="">Pilih murid...</option>${murid.map(m=>`<option value="${m.id}">${m.name}</option>`).join('')}`;
}

window.updatePreview=function(){
  const t=parseFloat(document.getElementById('inpTugas')?.value||0);
  const u=parseFloat(document.getElementById('inpUts')?.value||0);
  const a=parseFloat(document.getElementById('inpUas')?.value||0);
  const p=document.getElementById('nilaiPreview');
  if(p&&(t||u||a)){const v=(t*0.3+u*0.3+a*0.4).toFixed(1);p.textContent=v;p.style.color=v>=80?'var(--green)':v>=70?'var(--navy)':v>=60?'var(--amber)':'var(--red)'}
}

window.submitNilai=function(){
  const mid=document.getElementById('inpMurid')?.value;
  const mp=document.getElementById('inpMapel')?.value;
  const t=parseInt(document.getElementById('inpTugas')?.value);
  const u=parseInt(document.getElementById('inpUts')?.value);
  const a=parseInt(document.getElementById('inpUas')?.value);
  const sm=document.getElementById('inpSemester')?.value;
  const kl=document.getElementById('inpKelas')?.value;
  if(!mid||!mp||isNaN(t)||isNaN(u)||isNaN(a)){toast('Lengkapi semua kolom.','warning');return}
  if([t,u,a].some(v=>v<0||v>100)){toast('Nilai harus 0–100.','error');return}
  DB.addNilai({murid_id:mid,guru_id:currentUser.id,mata_pelajaran:mp,kelas:kl,nilai_tugas:t,nilai_uts:u,nilai_uas:a,semester:sm});
  DB.log('NILAI',currentUser.id,`Input nilai ${mp} untuk ${DB.findUserById(mid)?.name||mid}`);
  toast('✅ Nilai berhasil disimpan!','success');
  navigate('nilai');
}

window.deleteNilai=function(id){
  showDialog('🗑️','Hapus Nilai','Yakin ingin menghapus data nilai ini?',()=>{
    DB.deleteNilai(id);DB.log('NILAI',currentUser.id,'Hapus nilai');toast('Data nilai dihapus.','success');navigate('nilai');
  });
}

window.toggleSuspend=function(id,suspended){
  const isSusp=suspended==='true';
  showDialog(isSusp?'✅':'⚠️',isSusp?'Aktifkan Akun':'Nonaktifkan Akun',isSusp?'Aktifkan akun ini?':'Yakin nonaktifkan akun ini?',()=>{
    DB.updateUser(id,{is_suspended:!isSusp});
    DB.log(isSusp?'ACTIVATE':'SUSPEND',currentUser.id,(isSusp?'Aktifkan':'Nonaktifkan')+' akun '+id);
    toast(isSusp?'Akun diaktifkan.':'Akun dinonaktifkan.','success');
    navigate(currentUser.is_admin?'admin-guru':'admin-guru');
  });
}

async function changePassword(){
  const cur=document.getElementById('chgCurrent')?.value;
  const np=document.getElementById('chgNew')?.value;
  const cnf=document.getElementById('chgConfirm')?.value;
  if(!cur||!np||!cnf){toast('Semua kolom wajib diisi.','warning');return}
  if(np!==cnf){toast('Konfirmasi password tidak cocok.','error');return}
  if(Sec.checkStrength(np).score<45){toast('Password baru terlalu lemah.','error');return}
  const ok=await Sec.verifyPwd(cur,currentUser.password_hash);
  if(!ok){toast('Password saat ini tidak benar.','error');return}
  const hash=await Sec.hashPwd(np);
  DB.updateUser(currentUser.id,{password_hash:hash});
  DB.removeUserSessions(currentUser.id);
  DB.log('CHANGE_PWD',currentUser.id,'Password diubah');
  toast('Password berhasil diubah! Login kembali.','success',4000);
  setTimeout(()=>{Auth.logout();showPage('login');clearTimers()},2000);
}

function handleLogout(){
  showDialog('🚪','Konfirmasi Keluar','Yakin ingin keluar dari sistem?',()=>{
    cleanupQRScanner();Auth.logout();clearTimers();showPage('login');toast('Berhasil keluar.','success');
  });
}

/* ══════════ DIALOG ══════════ */
let dialogCb=null;
function showDialog(icon,title,msg,cb){
  document.getElementById('dialogIcon').textContent=icon;
  document.getElementById('dialogTitle').textContent=title;
  document.getElementById('dialogMsg').textContent=msg;
  dialogCb=cb;
  document.getElementById('dialogOverlay').classList.add('active');
}
function dialogCancel(){document.getElementById('dialogOverlay').classList.remove('active');dialogCb=null}
document.getElementById('dialogOk').addEventListener('click',()=>{
  document.getElementById('dialogOverlay').classList.remove('active');
  if(dialogCb){dialogCb();dialogCb=null}
});

/* ══════════ APP INIT ══════════ */
async function appInit(){
  await seedIfNeeded();
  const user=Auth.getCurrentUser();
  if(user){showPage('app');initDashboard(user);if(!user.is_new)toast(`Selamat datang kembali, ${user.name.split(' ')[0]}! 👋`,'success',3000)}
  else showPage('login');
}

/* ── Splash screen dismiss ── */
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('splashScreen')?.classList.add('hidden');
    setTimeout(() => document.getElementById('splashScreen')?.remove(), 600);
  }, 1400);
});

/* ── Scroll-to-top button ── */
document.querySelector('.content') && (() => {
  const content = document.getElementById('mainContent');
  const btn = document.getElementById('scrollTopBtn');
  if (!content || !btn) return;
  const parent = content.closest('.content');
  if (!parent) return;
  parent.addEventListener('scroll', () => {
    btn.classList.toggle('show', parent.scrollTop > 300);
  }, { passive: true });
})();

/* ── Hamburger aria-expanded sync ── */
const _origToggle = window.toggleSidebar;
window.toggleSidebar = function () {
  _origToggle && _origToggle();
  const btn = document.getElementById('hamburgerBtn');
  if (btn) btn.setAttribute('aria-expanded', document.getElementById('sidebarEl')?.classList.contains('open') ? 'true' : 'false');
};
appInit();
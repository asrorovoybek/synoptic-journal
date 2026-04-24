import './style.css';
import { createClient } from '@supabase/supabase-js';

// --- Supabase Config ---
const supabaseUrl = 'https://lmhqneinkzpxfhahvcvx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtaHFuZWlua3pweGZoYWh2Y3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDY2NDMsImV4cCI6MjA5MjYyMjY0M30.gF5LkfzuDFywZ7iFJh5kEqwaCpu91ixrIHPBa_YxxL4';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- State ---
let siteInfo = {};
let announcements = [];
let issues = [];
let articles = [];
let submissions = [];
let editorialTeam = [
  { name: "Dr. Robert Chen", role: "Editor-in-Chief", institution: "Oxford University, UK" },
  { name: "Prof. Sarah Johnson", role: "Associate Editor", institution: "MIT, USA" },
  { name: "Dr. Akmal Karimov", role: "Editorial Board Member", institution: "National University of Uzbekistan" },
  { name: "Prof. Elena Rossi", role: "Reviewer", institution: "University of Bologna, Italy" },
  { name: "Dr. Wei Zhang", role: "Section Editor", institution: "Tsinghua University, China" },
  { name: "Dr. Linda Murphy", role: "Board Member", institution: "University of Sydney, Australia" },
  { name: "Prof. Ahmed Mansour", role: "Ethics Committee", institution: "Cairo University, Egypt" },
  { name: "Dr. Yuki Tanaka", role: "Technical Editor", institution: "University of Tokyo, Japan" },
  { name: "Prof. Maria Garcia", role: "Humanities Advisor", institution: "Complutense University of Madrid" },
  { name: "Dr. David Smith", role: "Board Member", institution: "Stanford University, USA" },
  { name: "Dr. Nilufar Aliyeva", role: "Reviewer", institution: "Tashkent Medical Academy" },
  { name: "Prof. Hans Müller", role: "Advisory Board", institution: "Technical University of Munich" },
  { name: "Dr. Fatima Zahra", role: "Social Sciences Editor", institution: "University of Casablanca" },
  { name: "Prof. James Wilson", role: "Linguistics Advisor", institution: "Yale University, USA" },
  { name: "Dr. Sun-Hwa Kim", role: "Bio-Sciences Board", institution: "Seoul National University" }
];

let isAdminLoggedIn = localStorage.getItem('msje_admin_auth') === 'true';

// --- Data Fetching ---
async function loadData() {
  const { data: sInfo } = await supabase.from('site_info').select('*').single();
  const { data: ann } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
  const { data: iss } = await supabase.from('issues').select('*').order('year', { ascending: false });
  const { data: art } = await supabase.from('articles').select('*').order('created_at', { ascending: false });
  const { data: sub } = await supabase.from('submissions').select('*').order('created_at', { ascending: false });

  if (sInfo) siteInfo = sInfo;
  if (ann) announcements = ann;
  if (iss) issues = iss;
  if (art) articles = art;
  if (sub) submissions = sub;

  handleRoute();
}

// --- Meta Tag Manager ---
function updateMetaTags(article) {
  document.querySelectorAll('meta[name^="citation_"]').forEach(el => el.remove());
  if (!article) { document.title = siteInfo.name; return; }
  
  const issue = issues.find(i => i.id === article.issue_id) || {};
  
  const dateParts = (article.publication_date || '').split(/[\.\-\/]/);
  let formattedDate = article.publication_date;
  if (dateParts.length === 3) {
    if (dateParts[2].length === 4) formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    else if (dateParts[0].length === 4) formattedDate = `${dateParts[0]}/${dateParts[1]}/${dateParts[2]}`;
  }

  const tags = [{ name: 'citation_title', content: article.title }];
  (article.authors || []).forEach(auth => {
    tags.push({ name: 'citation_author', content: auth.fullName });
    if (auth.affiliation) tags.push({ name: 'citation_author_institution', content: auth.affiliation });
  });

  tags.push(
    { name: 'citation_publication_date', content: formattedDate },
    { name: 'citation_journal_title', content: siteInfo.name },
    { name: 'citation_issn', content: siteInfo.issn },
    { name: 'citation_volume', content: issue.volume || '1' },
    { name: 'citation_issue', content: issue.issue_number || '1' },
    { name: 'citation_firstpage', content: article.first_page || '1' },
    { name: 'citation_lastpage', content: article.last_page || '10' },
    { name: 'citation_abstract_html_url', content: window.location.href },
    { name: 'citation_pdf_url', content: article.pdf_path },
    { name: 'citation_language', content: 'en' }
  );

  if (article.doi) tags.push({ name: 'citation_doi', content: article.doi });

  tags.forEach(tag => {
    if (tag.content) {
      const meta = document.createElement('meta');
      meta.name = tag.name;
      meta.content = tag.content;
      document.head.appendChild(meta);
    }
  });
  document.title = `${article.title} | ${siteInfo.name}`;
}

// --- Router ---
const app = document.getElementById('app');
function navigate(path) {
  window.history.pushState({}, '', path);
  window.scrollTo(0, 0);
  handleRoute();
}
window.onpopstate = handleRoute;
window.msje_navigate = navigate;

function handleRoute() {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  
  if (path.startsWith('/admin')) {
    if (!isAdminLoggedIn && path !== '/admin/login') { navigate('/admin/login'); return; }
    renderAdmin(path, params);
  } else {
    renderPublic(path, params);
  }
}

// --- Public Templates ---
function getPublicHeader() {
  return `
    <header class="glass-header">
      <div class="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
        <div class="flex items-center gap-4 cursor-pointer" onclick="window.msje_navigate('/')">
          <div class="w-14 h-14 bg-primary rounded-2xl shadow-xl flex items-center justify-center text-white font-serif text-3xl font-bold ring-4 ring-white/10">${(siteInfo.short_name || 'S').charAt(0)}</div>
          <div class="flex flex-col">
            <span class="font-serif text-2xl font-bold text-primary tracking-tight leading-none">${siteInfo.short_name || 'Synoptic'}</span>
            <span class="text-[10px] text-accent font-black uppercase tracking-[0.3em] mt-1">International Platform</span>
          </div>
        </div>
        <nav class="hidden lg:flex gap-12 text-sm font-bold text-slate-600 uppercase tracking-widest">
          <button onclick="window.msje_navigate('/')" class="hover:text-primary transition-all relative group">Home<span class="absolute -bottom-2 left-0 w-0 h-1 bg-accent transition-all group-hover:w-full rounded-full"></span></button>
          <button onclick="window.msje_navigate('/archive')" class="hover:text-primary transition-all relative group">Archive<span class="absolute -bottom-2 left-0 w-0 h-1 bg-accent transition-all group-hover:w-full rounded-full"></span></button>
          <button onclick="window.msje_navigate('/about')" class="hover:text-primary transition-all relative group">About<span class="absolute -bottom-2 left-0 w-0 h-1 bg-accent transition-all group-hover:w-full rounded-full"></span></button>
          <button onclick="window.msje_navigate('/editorial')" class="hover:text-primary transition-all relative group">Editorial<span class="absolute -bottom-2 left-0 w-0 h-1 bg-accent transition-all group-hover:w-full rounded-full"></span></button>
          <button onclick="window.msje_navigate('/submissions')" class="hover:text-primary transition-all relative group">Submissions<span class="absolute -bottom-2 left-0 w-0 h-1 bg-accent transition-all group-hover:w-full rounded-full"></span></button>
        </nav>
        <div class="flex items-center gap-6">
          <button onclick="window.msje_navigate('/admin/login')" class="text-xs font-black text-slate-400 hover:text-primary border-2 border-slate-200 px-6 py-2.5 rounded-full transition-all tracking-[0.1em] uppercase">SIGN IN</button>
        </div>
      </div>
    </header>
  `;
}

function renderPublic(path, params) {
  if (path === '/' || path === '/home') {
    app.innerHTML = `${getPublicHeader()}
      <main class="animate-fade-in">
        <section class="relative py-20 md:py-24 overflow-hidden bg-slate-950/30 text-white">
          <div class="absolute inset-0 bg-gradient-to-b from-slate-950 via-transparent to-slate-950 z-0 opacity-70"></div>
          <div class="max-w-7xl mx-auto px-6 relative z-10 text-center">
             <div class="inline-block px-3 py-1 bg-accent/20 border border-accent/20 rounded-full mb-6 backdrop-blur-sm">
                <span class="text-accent font-black text-[9px] uppercase tracking-[0.4em] block">ISSN: ${siteInfo.issn} | Open Access</span>
             </div>
             <h1 class="text-4xl md:text-5xl font-serif font-bold mb-6 leading-tight max-w-4xl mx-auto text-white drop-shadow-xl">${siteInfo.name}</h1>
             <p class="text-base md:text-lg text-slate-300 mb-10 max-w-2xl mx-auto font-light leading-relaxed">International Journal for advanced multi-disciplinary scientific research and development.</p>
             <div class="flex flex-wrap justify-center items-center gap-4">
                <button onclick="window.msje_navigate('/archive')" class="btn-primary px-8 py-3.5 rounded-xl text-sm font-bold shadow-lg shadow-accent/20 transition-all">Explore Archive</button>
                <button onclick="window.msje_navigate('/submissions')" class="bg-slate-800/40 hover:bg-slate-800/60 backdrop-blur-xl text-white px-8 py-3.5 rounded-xl border border-white/10 text-sm font-bold transition-all">Guidelines</button>
             </div>
          </div>
        </section>
        
        <section class="max-w-7xl mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-3 gap-20">
           <div class="lg:col-span-2 space-y-12">
              <h2 class="text-4xl font-serif font-bold flex items-center gap-4 text-primary">Latest Published Research</h2>
              <div class="grid gap-8">
                ${articles.slice(0, 10).map(art => `
                  <div class="card-scientific group cursor-pointer" onclick="window.msje_navigate('/article?id=${art.id}')">
                     <span class="academic-label">${art.type}</span>
                     <h3 class="text-3xl font-serif font-bold mt-2 group-hover:text-accent transition-colors leading-snug">${art.title}</h3>
                     <p class="text-base text-slate-400 mt-6 font-medium">${(art.authors || []).map(a => a.fullName).join(' • ')}</p>
                     <div class="mt-10 pt-8 border-t border-slate-50 flex items-center justify-between">
                        <span class="text-[10px] font-black text-slate-300 uppercase tracking-widest">DOI: ${art.doi || 'N/A'}</span>
                        <span class="text-xs font-black text-primary uppercase tracking-[0.2em] group-hover:translate-x-2 transition-transform">Read Full Text &rarr;</span>
                     </div>
                  </div>
                `).join('')}
              </div>
           </div>
           <div class="space-y-12">
              <div class="bg-primary text-white p-8 rounded-2xl shadow-2xl relative overflow-hidden">
                 <h3 class="text-xl font-bold mb-4">Announcements</h3>
                 <div class="space-y-6">
                   ${announcements.map(ann => `
                     <div class="border-b border-white/20 pb-4">
                        <p class="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">${new Date(ann.created_at).toLocaleDateString()}</p>
                        <p class="font-bold text-sm mb-1">${ann.title}</p>
                        <p class="text-xs text-white/70">${ann.content}</p>
                     </div>
                   `).join('')}
                 </div>
                 <button onclick="window.msje_navigate('/submissions')" class="w-full mt-8 bg-white text-primary font-bold py-4 rounded-xl hover:bg-gray-100 transition-all uppercase tracking-widest text-xs">Submission Portal</button>
              </div>
           </div>
        </section>
      </main>
    `;
  } else if (path === '/article') {
     const art = articles.find(a => a.id === params.get('id'));
     if (!art) return app.innerHTML = 'Not Found';
     updateMetaTags(art);
     app.innerHTML = `${getPublicHeader()}
       <main class="max-w-4xl mx-auto px-4 py-12">
          <article class="bg-white p-8 md:p-14 border border-gray-100 rounded-3xl shadow-sm">
             <header class="mb-10 text-center border-b border-slate-50 pb-10">
               <span class="inline-block px-3 py-1 bg-accent/10 text-accent text-[10px] font-bold rounded-full mb-4 uppercase tracking-widest">${art.type}</span>
               <h1 class="text-2xl md:text-3xl font-serif font-bold mb-6 leading-tight text-primary max-w-3xl mx-auto">${art.title}</h1>
               <div class="flex flex-wrap justify-center gap-8">
                  ${(art.authors || []).map(a => `
                    <div class="text-center">
                       <p class="text-lg font-serif font-bold text-slate-800">${a.fullName}</p>
                       <p class="text-xs text-slate-500 font-medium italic mb-2">${a.affiliation || ''}</p>
                       <div class="flex flex-wrap justify-center gap-3">
                          ${a.email ? `<span class="text-[10px] text-slate-400 border border-slate-100 px-2 py-0.5 rounded italic">📧 ${a.email}</span>` : ''}
                          ${a.orcid ? `<span class="text-[10px] text-accent border border-accent/10 px-2 py-0.5 rounded">🆔 ${a.orcid}</span>` : ''}
                          ${a.phone ? `<span class="text-[10px] text-slate-400 border border-slate-100 px-2 py-0.5 rounded">📞 ${a.phone}</span>` : ''}
                       </div>
                    </div>
                  `).join('')}
               </div>
               <div class="mt-8 flex justify-center gap-4">
                  <button onclick="window.togglePdfViewer()" class="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2">👁️ View PDF</button>
                  <a href="${art.pdf_path}" target="_blank" download class="bg-slate-100 text-slate-700 px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all flex items-center gap-2">📥 Download</a>
                  <button onclick="window.copyCitation()" class="bg-white border border-slate-200 text-slate-700 px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">📋 Cite Article</button>
               </div>
             </header>
             <div class="space-y-10">
                <section>
                   <h2 class="text-sm font-black text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><span class="w-1 h-4 bg-accent"></span> Abstract</h2>
                   <p class="text-sm text-gray-600 leading-relaxed text-justify">${art.abstract}</p>
                   ${art.keywords ? `<div class="mt-4 flex flex-wrap gap-2 items-center pt-2"><span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Keywords:</span><p class="text-sm text-accent italic">${art.keywords}</p></div>` : ''}
                </section>
                <section class="border-t border-slate-50 pt-10">
                   <h2 class="text-sm font-black text-primary uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><span class="w-1 h-4 bg-accent"></span> References</h2>
                   <div class="space-y-4 text-sm text-gray-500 leading-relaxed text-justify">
                     ${(art.bib_refs || []).map((r, i) => `<p class="pl-6 relative"><span class="absolute left-0 font-bold text-accent">${i+1}.</span> ${r}</p>`).join('')}
                   </div>
                </section>
                <section class="mt-12 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                   <div class="flex flex-col md:row justify-between gap-6">
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
                         ${art.doi ? `<div><p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">DOI</p><p class="text-xs font-bold text-primary break-all">https://doi.org/${art.doi}</p></div>` : ''}
                         <div><p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Page Range</p><p class="text-xs font-bold text-slate-700">pp. ${art.first_page}-${art.last_page}</p></div>
                      </div>
                   </div>
                </section>
             </div>
             <div id="pdf-viewer-container" class="hidden fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-sm flex flex-col">
                <div class="flex justify-between items-center p-4 bg-slate-800 text-white"><button onclick="window.togglePdfViewer()" class="bg-white/10 px-4 py-2 rounded-lg text-sm font-bold">&larr; Back</button></div>
                <iframe src="${art.pdf_path}" class="flex-1 w-full border-none"></iframe>
             </div>
          </article>
       </main>
     `;
  } else if (path === '/archive') {
    app.innerHTML = `${getPublicHeader()}<main class="max-w-7xl mx-auto px-4 py-16"><h1 class="text-4xl font-bold mb-12">Archive</h1><div class="grid grid-cols-1 md:grid-cols-3 gap-10">
      ${issues.map(iss => `
        <div class="bg-white border rounded-2xl overflow-hidden hover:shadow-xl transition-all cursor-pointer group" onclick="window.msje_navigate('/issue?id=${iss.id}')">
          <img src="${iss.cover}" class="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-700">
          <div class="p-6"><p class="text-xs font-bold text-accent mb-2">${iss.year} ${iss.month}</p><h3 class="font-bold">Vol. ${iss.volume} No. ${iss.issue_number}</h3></div>
        </div>
      `).join('')}
    </div></main>`;
  } else if (path === '/editorial') {
    app.innerHTML = `${getPublicHeader()}<main class="max-w-5xl mx-auto px-4 py-20"><h1 class="text-4xl font-bold mb-12">Editorial Board</h1><div class="grid grid-cols-1 md:grid-cols-2 gap-12">
      ${editorialTeam.map(ed => `<div class="flex gap-6 p-6 bg-white border border-gray-100 rounded-2xl shadow-sm"><div class="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white font-bold">${ed.name.charAt(0)}</div><div><h3 class="font-bold">${ed.name}</h3><p class="text-accent text-xs font-bold uppercase">${ed.role}</p><p class="text-sm text-gray-500">${ed.institution}</p></div></div>`).join('')}
    </div></main>`;
  } else if (path === '/submissions') {
    app.innerHTML = `${getPublicHeader()}<main class="max-w-4xl mx-auto px-4 py-20"><h1 class="text-4xl font-bold mb-12">Submissions</h1><div class="bg-gray-50 p-10 rounded-3xl border border-gray-100 mb-12"><h2 class="text-2xl font-bold mb-6">Author Guidelines</h2><p>${siteInfo.submission_info || 'Please follow our submission guidelines.'}</p></div><button onclick="window.msje_navigate('/submission-portal')" class="btn-primary w-full py-6 text-xl font-bold shadow-2xl shadow-primary/30">Online Submission Portal</button></main>`;
  } else if (path === '/submission-portal') {
    app.innerHTML = `${getPublicHeader()}<main class="max-w-4xl mx-auto px-4 py-20"><form id="submission-form" class="bg-white p-10 rounded-3xl border shadow-xl space-y-10">
      <h1 class="text-4xl font-serif font-bold mb-8">Submit Manuscript</h1>
      <div><label class="block font-bold mb-2">Manuscript Title</label><input id="sub-title" required class="w-full p-4 border rounded-xl"></div>
      <div id="sub-author-fields" class="space-y-4">
        <div class="sub-author-row p-6 bg-slate-50 rounded-2xl border relative">
          <input required class="sub-auth-name w-full p-3 border rounded-lg mb-4" placeholder="Full Name">
          <input type="email" required class="sub-auth-email w-full p-3 border rounded-lg mb-4" placeholder="Email">
          <input required class="sub-auth-aff w-full p-3 border rounded-lg" placeholder="Affiliation">
        </div>
      </div>
      <button type="button" onclick="window.addSubAuthorField()" class="text-accent font-bold">+ Add Author</button>
      <div><label class="block font-bold mb-2">Abstract</label><textarea id="sub-abstract" rows="6" required class="w-full p-4 border rounded-xl"></textarea></div>
      <div><label class="block font-bold mb-2">Keywords</label><input id="sub-keywords" required class="w-full p-4 border rounded-xl"></div>
      <div><label class="block font-bold mb-2">References</label><textarea id="sub-refs" rows="6" required class="w-full p-4 border rounded-xl"></textarea></div>
      <div><label class="block font-bold mb-2">Manuscript File</label><input type="file" id="sub-file" required class="w-full p-4 border rounded-xl"></div>
      <button type="submit" class="btn-primary w-full py-6 text-xl font-bold">Submit</button>
    </form></main>`;
    attachSubmissionEvent();
  }
  app.innerHTML += getPublicFooter();
}

function getPublicFooter() {
  return `<footer class="bg-slate-900 text-white pt-24 pb-12 mt-20 border-t-4 border-primary"><div class="max-w-7xl mx-auto px-4 text-center"><p>&copy; ${new Date().getFullYear()} ${siteInfo.name}. All Rights Reserved.</p><div class="mt-4"><a href="/admin/login" class="text-gray-500 hover:text-white text-xs">Admin Login</a></div></div></footer>`;
}

function attachSubmissionEvent() {
  const form = document.getElementById('submission-form');
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.innerHTML = 'Submitting...';
    try {
      const file = document.getElementById('sub-file').files[0];
      let filePath = '';
      if (file) {
        const { data, error } = await supabase.storage.from('pdfs').upload('submissions/' + Date.now() + '-' + file.name, file);
        if (error) throw error;
        filePath = supabaseUrl + '/storage/v1/object/public/pdfs/' + data.path;
      }
      const authors = Array.from(document.querySelectorAll('.sub-author-row')).map(row => ({
        fullName: row.querySelector('.sub-auth-name').value,
        email: row.querySelector('.sub-auth-email').value,
        affiliation: row.querySelector('.sub-auth-aff').value
      }));
      const { error: dbError } = await supabase.from('submissions').insert([{
        id: 'sub-' + Date.now(),
        title: document.getElementById('sub-title').value,
        abstract: document.getElementById('sub-abstract').value,
        keywords: document.getElementById('sub-keywords').value,
        bib_refs: document.getElementById('sub-refs').value,
        authors: authors,
        file_path: filePath
      }]);
      if (dbError) throw dbError;
      alert('Success!'); navigate('/');
    } catch (err) { alert('Error: ' + err.message); } finally { btn.disabled = false; btn.innerHTML = 'Submit'; }
  };
}

// --- Admin Panel ---
function renderAdmin(path, params) {
  if (path === '/admin/login') { renderAdminLogin(); return; }
  app.innerHTML = `
    <div class="flex min-h-screen bg-gray-50">
      <aside class="w-64 bg-slate-900 text-white p-6 sticky top-0 h-screen">
        <nav class="space-y-4">
          <button onclick="window.msje_navigate('/admin/dashboard')" class="w-full text-left p-3 rounded hover:bg-slate-800">Dashboard</button>
          <button onclick="window.msje_navigate('/admin/issues')" class="w-full text-left p-3 rounded hover:bg-slate-800">Issues</button>
          <button onclick="window.msje_navigate('/admin/articles')" class="w-full text-left p-3 rounded hover:bg-slate-800">Articles</button>
          <button onclick="window.msje_navigate('/admin/submissions')" class="w-full text-left p-3 rounded hover:bg-slate-800">Submissions</button>
          <button onclick="localStorage.removeItem('msje_admin_auth'); window.location.reload()" class="w-full text-left p-3 rounded hover:bg-red-900 mt-20">Logout</button>
        </nav>
      </aside>
      <main class="flex-1 p-10">${renderAdminContent(path, params)}</main>
    </div>
  `;
  attachAdminEvents(path, params);
}

function renderAdminLogin() {
  app.innerHTML = `<div class="min-h-screen flex items-center justify-center bg-slate-900 p-6"><form id="login-form" class="bg-white p-10 rounded-2xl w-full max-w-md"><h1 class="text-2xl font-bold mb-6">Login</h1><input id="u" placeholder="User" class="w-full p-3 border rounded mb-4"><input type="password" id="p" placeholder="Pass" class="w-full p-3 border rounded mb-6"><button type="submit" class="btn-primary w-full py-4">Enter</button></form></div>`;
  document.getElementById('login-form').onsubmit = (e) => { e.preventDefault(); if (document.getElementById('u').value === 'Oybek' && document.getElementById('p').value === '250795') { isAdminLoggedIn = true; localStorage.setItem('msje_admin_auth', 'true'); navigate('/admin/dashboard'); } else alert('Error'); };
}

function renderAdminContent(path, params) {
  if (path === '/admin/dashboard') return `<h1 class="text-2xl font-bold">Dashboard</h1><p class="mt-4">Welcome to the admin panel.</p>`;
  if (path === '/admin/issues') return `<div class="flex justify-between items-center mb-8"><h1>Issues</h1><button onclick="window.msje_navigate('/admin/issue/new')" class="btn-primary">+ New Issue</button></div><table class="w-full bg-white border"><thead><tr class="bg-slate-50 border-b"><th class="p-4">Name</th><th class="p-4 text-center">Actions</th></tr></thead><tbody>${issues.map(iss => `<tr class="border-b"><td class="p-4">Vol. ${iss.volume} No. ${iss.issue_number}</td><td class="p-4 text-center"><button onclick="window.msje_navigate('/admin/issue/edit?id=${iss.id}')" class="text-accent mr-3">Edit</button><button onclick="window.deleteIssue('${iss.id}')" class="text-red-500">Delete</button></td></tr>`).join('')}</tbody></table>`;
  if (path === '/admin/articles') return `<div class="flex justify-between items-center mb-8"><h1>Articles</h1><button onclick="window.msje_navigate('/admin/article/new')" class="btn-primary">+ New Article</button></div><table class="w-full bg-white border"><thead><tr class="bg-slate-50 border-b"><th class="p-4">Title</th><th class="p-4 text-center">Actions</th></tr></thead><tbody>${articles.map(art => `<tr class="border-b"><td class="p-4 text-sm font-bold">${art.title}</td><td class="p-4 text-center"><button onclick="window.msje_navigate('/admin/article/edit?id=${art.id}')" class="text-accent mr-3">Edit</button><button onclick="window.deleteArticle('${art.id}')" class="text-red-500">Delete</button></td></tr>`).join('')}</tbody></table>`;
  if (path === '/admin/submissions') return `<h1 class="mb-8">Submissions</h1><table class="w-full bg-white border"><thead><tr class="bg-slate-50 border-b"><th class="p-4">Title</th><th class="p-4 text-center">Actions</th></tr></thead><tbody>${submissions.map(sub => `<tr class="border-b"><td class="p-4">${sub.title}</td><td class="p-4 text-center"><button onclick="window.deleteSubmission('${sub.id}')" class="text-red-500">Delete</button></td></tr>`).join('')}</tbody></table>`;
  if (path === '/admin/issue/new' || path === '/admin/issue/edit') {
    const id = params.get('id');
    const iss = issues.find(i => i.id === id) || { volume: '', issue_number: '', year: '2026', month: 'April', cover: '' };
    return `<form id="issue-form" class="bg-white p-8 border space-y-6"><h1 class="text-2xl font-bold">${id ? 'Edit Issue' : 'New Issue'}</h1><input type="hidden" id="i-id" value="${id || ''}"><div class="grid grid-cols-2 gap-4"><div><label>Vol</label><input id="i-vol" value="${iss.volume}" class="w-full p-3 border"></div><div><label>Num</label><input id="i-num" value="${iss.issue_number}" class="w-full p-3 border"></div></div><div><label>Cover</label><input type="file" id="i-file" class="w-full p-3 border"></div><button type="submit" class="btn-primary w-full py-4">Save</button></form>`;
  }
  if (path === '/admin/article/new' || path === '/admin/article/edit') {
    const id = params.get('id');
    const art = articles.find(a => a.id === id) || { title: '', issue_id: issues[0]?.id, abstract: '', doi: '', keywords: '', authors: [{fullName:'', email:'', affiliation:''}], bib_refs: [], type: 'Original Research' };
    return `<form id="art-form" class="bg-white p-8 border space-y-6"><h1 class="text-2xl font-bold">Article Details</h1><input type="hidden" id="a-id" value="${id || ''}"><div><label>Title</label><input id="a-title" value="${art.title}" class="w-full p-3 border"></div><div><label>Issue</label><select id="a-issue" class="w-full p-3 border">${issues.map(i => `<option value="${i.id}" ${art.issue_id===i.id?'selected':''}>Vol ${i.volume} No ${i.issue_number}</option>`).join('')}</select></div><div><label>PDF</label><input type="file" id="a-pdf" class="w-full p-3 border"></div><button type="submit" class="btn-primary w-full py-4">Save Article</button></form>`;
  }
  return 'Not Found';
}

function attachAdminEvents(path, params) {
  const issForm = document.getElementById('issue-form');
  if (issForm) {
    issForm.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('i-id').value;
      const file = document.getElementById('i-file').files[0];
      let cover = issues.find(i => i.id === id)?.cover || '';
      if (file) {
        const { data, error } = await supabase.storage.from('covers').upload(Date.now() + '-' + file.name, file);
        if (error) { alert(error.message); return; }
        cover = supabaseUrl + '/storage/v1/object/public/covers/' + data.path;
      }
      const data = {
        id: id || 'iss-' + Date.now(),
        volume: document.getElementById('i-vol').value,
        issue_number: document.getElementById('i-num').value,
        year: '2026', month: 'April', cover: cover
      };
      const { error } = await supabase.from('issues').upsert([data]);
      if (error) alert(error.message); else { await loadData(); navigate('/admin/issues'); }
    };
  }

  const artForm = document.getElementById('art-form');
  if (artForm) {
    artForm.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('a-id').value;
      const file = document.getElementById('a-pdf').files[0];
      let pdf_path = articles.find(a => a.id === id)?.pdf_path || '';
      if (file) {
        const { data, error } = await supabase.storage.from('pdfs').upload('articles/' + Date.now() + '-' + file.name, file);
        if (error) { alert(error.message); return; }
        pdf_path = supabaseUrl + '/storage/v1/object/public/pdfs/' + data.path;
      }
      const data = {
        id: id || 'art-' + Date.now(),
        title: document.getElementById('a-title').value,
        issue_id: document.getElementById('a-issue').value,
        pdf_path: pdf_path,
        authors: [{fullName: 'Admin', email: '', affiliation: ''}], // Soddalashtirilgan
        publication_date: new Date().toISOString()
      };
      const { error } = await supabase.from('articles').upsert([data]);
      if (error) alert(error.message); else { await loadData(); navigate('/admin/articles'); }
    };
  }
}

window.deleteArticle = async (id) => { if (confirm('Sure?')) { await supabase.from('articles').delete().eq('id', id); await loadData(); } };
window.deleteIssue = async (id) => { if (confirm('Sure?')) { await supabase.from('issues').delete().eq('id', id); await loadData(); } };
window.deleteSubmission = async (id) => { if (confirm('Sure?')) { await supabase.from('submissions').delete().eq('id', id); await loadData(); } };

loadData();

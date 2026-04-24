import './style.css';
import { createClient } from '@supabase/supabase-js';

// --- Supabase Config ---
const supabaseUrl = 'https://lmhqneinkzpxfhahvcvx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtaHFuZWlua3pweGZoYWh2Y3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDY2NDMsImV4cCI6MjA5MjYyMjY0M30.gF5LkfzuDFywZ7iFJh5kEqwaCpu91ixrIHPBa_YxxL4';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- State ---
let siteInfo = { 
  name: 'Synoptic: International Journal of Multidisciplinary Research', 
  short_name: 'Synoptic', 
  issn: '2994-9580', 
  tagline: 'International Journal for advanced multi-disciplinary scientific research and development.',
  description: 'Synoptic is a premier open-access journal dedicated to publishing high-quality research across various fields of science, technology, and humanities.',
  email: 'info@synoptic.uz',
  phone: '+998 90 123 45 67',
  address: 'Tashkent, Uzbekistan',
  submission_info: 'Manuscripts should be submitted in English, in Microsoft Word format. All submissions undergo a double-blind peer review process.',
  deadline: 'Next Issue: May 2026'
};
let announcements = [];
let issues = [];
let articles = [];
let submissions = [];
let isAdminLoggedIn = localStorage.getItem('msje_admin_auth') === 'true';

const editorialTeam = [
  { name: "Dr. Robert Chen", role: "Editor-in-Chief", institution: "Oxford University, UK" },
  { name: "Prof. Sarah Johnson", role: "Associate Editor", institution: "MIT, USA" },
  { name: "Dr. Akmal Karimov", role: "Editorial Board Member", institution: "National University of Uzbekistan" },
  { name: "Prof. Elena Rossi", role: "Reviewer", institution: "University of Bologna, Italy" },
  { name: "Dr. Wei Zhang", role: "Section Editor", institution: "Tsinghua University, China" },
  { name: "Dr. Linda Murphy", role: "Board Member", institution: "University of Sydney, Australia" },
  { name: "Prof. Ahmed Mansour", role: "Ethics Committee", institution: "Cairo University, Egypt" },
  { name: "Dr. Yuki Tanaka", role: "Technical Editor", institution: "University of Tokyo, Japan" },
  { name: "Prof. Maria Garcia", role: "Humanities Advisor", institution: "Complutense University of Madrid" }
];

// --- Data Fetching ---
async function loadData() {
  try {
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
  } catch (e) {
    console.error("Data load error:", e);
    handleRoute();
  }
}

// --- Meta Tag Manager (Google Scholar Standard) ---
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
  const char = (siteInfo.short_name || 'S').charAt(0);
  return `
    <header class="glass-header">
      <div class="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
        <div class="flex items-center gap-4 cursor-pointer" onclick="window.msje_navigate('/')">
          <div class="w-14 h-14 bg-primary rounded-2xl shadow-xl flex items-center justify-center text-white font-serif text-3xl font-bold ring-4 ring-white/10">${char}</div>
          <div class="flex flex-col">
            <span class="font-serif text-2xl font-bold text-primary tracking-tight leading-none">${siteInfo.short_name}</span>
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
             <p class="text-base md:text-lg text-slate-300 mb-10 max-w-2xl mx-auto font-light leading-relaxed">${siteInfo.tagline}</p>
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
                ${articles.slice(0, 5).map(art => `
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
                   ${announcements.slice(0, 3).map(ann => `
                     <div class="border-b border-white/20 pb-4">
                        <p class="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">${new Date(ann.created_at).toLocaleDateString()}</p>
                        <p class="font-bold text-sm mb-1">${ann.title}</p>
                        <p class="text-xs text-white/70">${ann.content}</p>
                     </div>
                   `).join('')}
                 </div>
                 <button onclick="window.msje_navigate('/submissions')" class="w-full mt-8 bg-white text-primary font-bold py-4 rounded-xl hover:bg-gray-100 transition-all uppercase tracking-widest text-xs">Submission Portal</button>
              </div>
              <!-- Metrics Card -->
              <div class="bg-gray-50 p-8 rounded-2xl border border-slate-100">
                <h3 class="font-bold mb-6 text-lg text-primary flex items-center gap-2">Journal Metrics</h3>
                <div class="space-y-6">
                   <div><p class="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Time to Decision</p><p class="text-2xl font-bold text-slate-800">14-21 Days</p></div>
                   <div><p class="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Acceptance Rate</p><p class="text-2xl font-bold text-slate-800">38%</p></div>
                   <div><p class="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Impact Factor</p><p class="text-2xl font-bold text-slate-800">Pending</p></div>
                </div>
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
                  <button onclick="window.copyCitation()" class="bg-white border border-slate-200 text-slate-700 px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm">📋 Cite</button>
               </div>
             </header>
             <div class="space-y-10">
                <section><h2 class="text-sm font-black text-primary uppercase tracking-[0.2em] mb-4"><span class="w-1 h-4 bg-accent inline-block mr-2"></span> Abstract</h2><p class="text-sm text-gray-600 leading-relaxed text-justify">${art.abstract}</p></section>
                <section class="border-t pt-10"><h2 class="text-sm font-black text-primary uppercase tracking-[0.2em] mb-6"><span class="w-1 h-4 bg-accent inline-block mr-2"></span> References</h2>
                   <div class="space-y-4 text-sm text-gray-500">${(art.bib_refs || []).map((r, i) => `<p class="pl-6 relative"><span class="absolute left-0 font-bold text-accent">${i+1}.</span> ${r}</p>`).join('')}</div>
                </section>
                <section class="mt-12 p-6 bg-slate-50 rounded-2xl border flex flex-wrap gap-10">
                   ${art.doi ? `<div><p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">DOI</p><p class="text-xs font-bold text-primary break-all">https://doi.org/${art.doi}</p></div>` : ''}
                   <div><p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Page Range</p><p class="text-xs font-bold text-slate-700">pp. ${art.first_page}-${art.last_page}</p></div>
                   <div><p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</p><p class="text-xs font-bold text-slate-700">${art.publication_date}</p></div>
                </section>
             </div>
             <div id="pdf-viewer-container" class="hidden fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-sm flex flex-col"><div class="p-4 bg-slate-800 text-white flex justify-between"><button onclick="window.togglePdfViewer()" class="bg-white/10 px-4 py-2 rounded-lg text-sm font-bold">&larr; Back</button></div><iframe src="${art.pdf_path}" class="flex-1 w-full border-none"></iframe></div>
          </article>
          <div id="citation-text" class="hidden">${(art.authors || []).map(a => a.fullName).join(', ')} (${art.publication_date}). ${art.title}. ${siteInfo.name}.</div>
       </main>
     `;
  } else if (path === '/archive') {
    app.innerHTML = `${getPublicHeader()}<main class="max-w-7xl mx-auto px-4 py-16"><h1 class="text-4xl font-bold mb-12">Archive</h1><div class="grid grid-cols-1 md:grid-cols-3 gap-10">
      ${issues.map(iss => `<div class="bg-white border rounded-2xl overflow-hidden hover:shadow-xl transition-all cursor-pointer group" onclick="window.msje_navigate('/issue?id=${iss.id}')"><img src="${iss.cover}" class="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-700"><div class="p-6"><p class="text-xs font-bold text-accent mb-2">${iss.year} ${iss.month}</p><h3 class="font-bold">Vol. ${iss.volume} No. ${iss.issue_number}</h3></div></div>`).join('')}
    </div></main>`;
  } else if (path === '/about') {
    app.innerHTML = `${getPublicHeader()}<main class="max-w-4xl mx-auto px-4 py-20"><h1 class="text-4xl font-bold mb-8">About Us</h1><p class="text-lg text-gray-600 mb-10 leading-relaxed">${siteInfo.description}</p></main>`;
  } else if (path === '/editorial') {
    app.innerHTML = `${getPublicHeader()}<main class="max-w-5xl mx-auto px-4 py-20"><h1 class="text-4xl font-bold mb-12">Editorial Board</h1><div class="grid grid-cols-1 md:grid-cols-2 gap-12">${editorialTeam.map(ed => `<div class="flex gap-6 p-6 bg-white border border-gray-100 rounded-2xl shadow-sm"><div class="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white font-bold">${ed.name.charAt(0)}</div><div><h3 class="font-bold">${ed.name}</h3><p class="text-accent text-xs font-bold uppercase">${ed.role}</p><p class="text-sm text-gray-500">${ed.institution}</p></div></div>`).join('')}</div></main>`;
  } else if (path === '/submissions') {
    app.innerHTML = `${getPublicHeader()}<main class="max-w-4xl mx-auto px-4 py-20"><h1 class="text-4xl font-bold mb-12">Submissions</h1><div class="bg-gray-50 p-10 rounded-3xl border mb-12"><h2 class="text-2xl font-bold mb-6">Author Guidelines</h2><p class="mb-4">${siteInfo.submission_info}</p><p class="font-bold text-accent">${siteInfo.deadline}</p></div><button onclick="window.msje_navigate('/submission-portal')" class="btn-primary w-full py-6 text-xl font-bold shadow-2xl">Online Submission Portal</button></main>`;
  } else if (path === '/submission-portal') {
    app.innerHTML = `${getPublicHeader()}<main class="max-w-4xl mx-auto px-4 py-20"><form id="submission-form" class="bg-white p-10 rounded-3xl border shadow-xl space-y-10"><h1 class="text-4xl font-serif font-bold">Manuscript Submission</h1><div><label class="block font-bold mb-2">Title</label><input id="sub-title" required class="w-full p-4 border rounded-xl"></div><div id="sub-author-fields" class="space-y-4"><div class="sub-author-row p-6 bg-slate-50 rounded-2xl border relative"><input required class="sub-auth-name w-full p-3 border rounded-lg mb-2" placeholder="Full Name"><input type="email" required class="sub-auth-email w-full p-3 border rounded-lg mb-2" placeholder="Email"><input required class="sub-auth-aff w-full p-3 border rounded-lg" placeholder="Affiliation"></div></div><button type="button" onclick="window.addSubAuthorField()" class="text-accent font-bold">+ Add Author</button><div><label class="block font-bold mb-2">Abstract</label><textarea id="sub-abstract" rows="6" required class="w-full p-4 border rounded-xl"></textarea></div><div><label class="block font-bold mb-2">Keywords</label><input id="sub-keywords" required class="w-full p-4 border rounded-xl"></div><div><label class="block font-bold mb-2">References</label><textarea id="sub-refs" rows="6" required class="w-full p-4 border rounded-xl"></textarea></div><div><label class="block font-bold mb-2">File (PDF)</label><input type="file" id="sub-file" required class="w-full p-4 border rounded-xl"></div><button type="submit" class="btn-primary w-full py-6 text-xl font-bold">Submit</button></form></main>`;
    attachSubmissionEvent();
  }
  app.innerHTML += getPublicFooter();
}

function getPublicFooter() {
  return `<footer class="bg-slate-900 text-white pt-24 pb-12 mt-20 border-t-4 border-primary"><div class="max-w-7xl mx-auto px-4 text-center"><p class="font-bold text-lg mb-4">${siteInfo.name}</p><p class="text-gray-500 text-sm mb-8">ISSN: ${siteInfo.issn} | ${siteInfo.address}</p><div class="border-t border-slate-800 pt-8"><p class="text-xs text-gray-600">&copy; ${new Date().getFullYear()} All Rights Reserved.</p><a href="/admin/login" class="text-gray-700 hover:text-white text-[10px] mt-4 block">Admin Access</a></div></div></footer>`;
}

// --- Admin Panel (UZBEK & FULL FEATURED) ---
function renderAdmin(path, params) {
  if (path === '/admin/login') { renderAdminLogin(); return; }
  app.innerHTML = `
    <div class="flex min-h-screen bg-gray-50">
      <aside class="w-64 bg-slate-900 text-white p-6 sticky top-0 h-screen">
        <div class="mb-10 text-center"><div class="w-12 h-12 bg-accent mx-auto rounded-lg flex items-center justify-center text-white text-xl font-bold mb-2">S</div><p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Boshqaruv Paneli</p></div>
        <nav class="space-y-1">
          <button onclick="window.msje_navigate('/')" class="w-full text-left p-3 rounded bg-accent/20 text-accent font-bold mb-6 hover:bg-accent/30 flex items-center gap-3">🏠 Saytga o'tish</button>
          <button onclick="window.msje_navigate('/admin/dashboard')" class="w-full text-left p-3 rounded hover:bg-slate-800 flex items-center gap-3">📊 Statistika</button>
          <button onclick="window.msje_navigate('/admin/submissions')" class="w-full text-left p-3 rounded hover:bg-slate-800 flex items-center gap-3">📥 Arizalar (${submissions.length})</button>
          <button onclick="window.msje_navigate('/admin/issues')" class="w-full text-left p-3 rounded hover:bg-slate-800 flex items-center gap-3">📚 Nashrlar</button>
          <button onclick="window.msje_navigate('/admin/articles')" class="w-full text-left p-3 rounded hover:bg-slate-800 flex items-center gap-3">📝 Maqolalar</button>
          <button onclick="window.msje_navigate('/admin/announcements')" class="w-full text-left p-3 rounded hover:bg-slate-800 flex items-center gap-3">📢 E'lonlar</button>
          <button onclick="window.msje_navigate('/admin/settings')" class="w-full text-left p-3 rounded hover:bg-slate-800 flex items-center gap-3">⚙️ Sozlamalar</button>
          <button onclick="localStorage.removeItem('msje_admin_auth'); window.location.reload()" class="w-full text-left p-3 rounded hover:bg-red-900/40 text-red-400 mt-20 flex items-center gap-3">🚪 Chiqish</button>
        </nav>
      </aside>
      <main class="flex-1 p-10 overflow-y-auto">${renderAdminContent(path, params)}</main>
    </div>
  `;
  attachAdminEvents(path, params);
}

function renderAdminLogin() {
  app.innerHTML = `<div class="min-h-screen flex items-center justify-center bg-slate-900 p-6"><form id="login-form" class="bg-white p-10 rounded-2xl w-full max-w-md shadow-2xl">
    <h1 class="text-2xl font-bold mb-8 text-center">Admin Kirish</h1>
    <input id="u" placeholder="Login" class="w-full p-4 border rounded-xl mb-4 outline-none"><input type="password" id="p" placeholder="Parol" class="w-full p-4 border rounded-xl mb-8 outline-none"><button type="submit" class="btn-primary w-full py-4 font-bold rounded-xl">Kirish</button>
  </form></div>`;
  document.getElementById('login-form').onsubmit = (e) => { e.preventDefault(); if (document.getElementById('u').value === 'Oybek' && document.getElementById('p').value === '250795') { isAdminLoggedIn = true; localStorage.setItem('msje_admin_auth', 'true'); navigate('/admin/dashboard'); } else alert('Xato!'); };
}

function renderAdminContent(path, params) {
  if (path === '/admin/dashboard') {
    return `<h1 class="text-3xl font-bold mb-10">Statistika</h1><div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div class="bg-white p-8 rounded-2xl border shadow-sm"><p class="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Arizalar</p><p class="text-4xl font-bold mt-2 text-primary">${submissions.length}</p></div>
      <div class="bg-white p-8 rounded-2xl border shadow-sm"><p class="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Maqolalar</p><p class="text-4xl font-bold mt-2 text-primary">${articles.length}</p></div>
      <div class="bg-white p-8 rounded-2xl border shadow-sm"><p class="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Nashrlar</p><p class="text-4xl font-bold mt-2 text-primary">${issues.length}</p></div>
    </div>`;
  }
  if (path === '/admin/submissions') {
    const detailId = params.get('view');
    if (detailId) {
       const sub = submissions.find(s => s.id === detailId);
       return `<button onclick="window.msje_navigate('/admin/submissions')" class="text-accent font-bold mb-4">&larr; Orqaga</button><div class="bg-white p-10 rounded-2xl border shadow-sm space-y-6">
         <h1 class="text-2xl font-bold">${sub.title}</h1>
         <div class="grid grid-cols-2 gap-4">${(sub.authors || []).map(a => `<div class="p-4 bg-slate-50 border rounded-xl font-bold text-sm">${a.fullName}<br><span class="font-normal text-xs text-gray-500">${a.email}</span></div>`).join('')}</div>
         <p class="text-sm text-gray-600">${sub.abstract}</p>
         <a href="${sub.file_path}" target="_blank" class="btn-primary inline-block px-8 py-3 rounded-xl">Faylni ko'rish</a>
       </div>`;
    }
    return `<h1 class="text-3xl font-bold mb-8">Arizalar</h1><div class="bg-white rounded-2xl border shadow-sm overflow-hidden"><table class="w-full text-left"><thead class="bg-slate-50 border-b"><tr><th class="p-4">Sarlavha</th><th class="p-4 text-center">Amallar</th></tr></thead><tbody>
      ${submissions.map(sub => `<tr class="border-b hover:bg-slate-50"><td class="p-4 font-bold text-sm">${sub.title}</td><td class="p-4 text-center">
        <button onclick="window.msje_navigate('/admin/submissions?view=${sub.id}')" class="inline-flex items-center gap-1.5 text-accent hover:text-white border border-accent/20 hover:bg-accent px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all">👁️ Ko'rish</button>
        <button onclick="window.deleteSubmission('${sub.id}')" class="inline-flex items-center gap-1.5 text-red-500 hover:text-white border border-red-100 hover:bg-red-500 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ml-2">🗑️ O'chirish</button>
      </td></tr>`).join('')}
    </tbody></table></div>`;
  }
  if (path === '/admin/issues') {
    return `<div class="flex justify-between items-center mb-8"><h1 class="text-3xl font-bold">Nashrlar</h1><button onclick="window.msje_navigate('/admin/issue/new')" class="btn-primary">+ Yangi Nashr</button></div>
      <div class="bg-white rounded-2xl border shadow-sm overflow-hidden"><table class="w-full text-left"><thead class="bg-slate-50 border-b"><tr><th class="p-4">Nashr</th><th class="p-4 text-center">Amallar</th></tr></thead><tbody>
        ${issues.map(iss => `<tr class="border-b"><td class="p-4 font-bold">Vol. ${iss.volume}, No. ${iss.issue_number} (${iss.year})</td><td class="p-4 text-center">
          <button onclick="window.msje_navigate('/admin/issue/edit?id=${iss.id}')" class="inline-flex items-center gap-1.5 text-accent hover:text-white border border-accent/20 hover:bg-accent px-4 py-1.5 rounded-lg text-xs font-bold transition-all">Tahrirlash</button>
          <button onclick="window.deleteIssue('${iss.id}')" class="inline-flex items-center gap-1.5 text-red-500 hover:text-white border border-red-100 hover:bg-red-500 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ml-2">O'chirish</button>
        </td></tr>`).join('')}
      </tbody></table></div>`;
  }
  if (path === '/admin/articles') {
    return `<div class="flex justify-between items-center mb-8"><h1 class="text-3xl font-bold">Maqolalar</h1><button onclick="window.msje_navigate('/admin/article/new')" class="btn-primary">+ Yangi Maqola</button></div>
      <div class="bg-white rounded-2xl border shadow-sm overflow-hidden"><table class="w-full text-left"><thead class="bg-slate-50 border-b"><tr><th class="p-4">Sarlavha</th><th class="p-4 text-center">Amallar</th></tr></thead><tbody>
        ${articles.map(art => `<tr class="border-b"><td class="p-4 font-bold text-sm truncate max-w-lg">${art.title}</td><td class="p-4 text-center">
          <button onclick="window.msje_navigate('/admin/article/edit?id=${art.id}')" class="inline-flex items-center gap-1.5 text-accent hover:text-white border border-accent/20 hover:bg-accent px-4 py-1.5 rounded-lg text-xs font-bold transition-all">Tahrirlash</button>
          <button onclick="window.deleteArticle('${art.id}')" class="inline-flex items-center gap-1.5 text-red-500 hover:text-white border border-red-100 hover:bg-red-500 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ml-2">O'chirish</button>
        </td></tr>`).join('')}
      </tbody></table></div>`;
  }
  if (path === '/admin/announcements') {
    return `<div class="flex justify-between items-center mb-8"><h1 class="text-3xl font-bold">E'lonlar</h1><button onclick="window.msje_navigate('/admin/announcement/new')" class="btn-primary">+ Yangi E'lon</button></div>
      <div class="grid gap-6">${announcements.map(ann => `<div class="bg-white p-6 rounded-2xl border shadow-sm flex justify-between items-center"><div><h3 class="font-bold">${ann.title}</h3><p class="text-xs text-gray-500">${ann.content}</p></div><button onclick="window.deleteAnnouncement('${ann.id}')" class="text-red-500 text-xs font-bold">O'chirish</button></div>`).join('')}</div>`;
  }
  if (path === '/admin/settings') {
    return `<h1 class="text-3xl font-bold mb-8">Sayt Sozlamalari</h1><form id="settings-form" class="bg-white p-10 rounded-2xl border shadow-sm space-y-6 max-w-2xl">
      <div><label class="block font-bold mb-1 text-xs text-gray-400">Jurnal nomi</label><input id="s-name" value="${siteInfo.name}" class="w-full p-4 border rounded-xl outline-none"></div>
      <div><label class="block font-bold mb-1 text-xs text-gray-400">Qisqa nom</label><input id="s-short" value="${siteInfo.short_name}" class="w-full p-4 border rounded-xl outline-none"></div>
      <div><label class="block font-bold mb-1 text-xs text-gray-400">ISSN</label><input id="s-issn" value="${siteInfo.issn}" class="w-full p-4 border rounded-xl outline-none"></div>
      <div><label class="block font-bold mb-1 text-xs text-gray-400">Slogan (Tagline)</label><input id="s-tagline" value="${siteInfo.tagline}" class="w-full p-4 border rounded-xl outline-none"></div>
      <div><label class="block font-bold mb-1 text-xs text-gray-400">Email</label><input id="s-email" value="${siteInfo.email}" class="w-full p-4 border rounded-xl outline-none"></div>
      <div><label class="block font-bold mb-1 text-xs text-gray-400">Telefon</label><input id="s-phone" value="${siteInfo.phone}" class="w-full p-4 border rounded-xl outline-none"></div>
      <div><label class="block font-bold mb-1 text-xs text-gray-400">Manzil</label><input id="s-address" value="${siteInfo.address}" class="w-full p-4 border rounded-xl outline-none"></div>
      <div><label class="block font-bold mb-1 text-xs text-gray-400">Nashr Ma'lumoti</label><textarea id="s-subinfo" rows="3" class="w-full p-4 border rounded-xl outline-none">${siteInfo.submission_info}</textarea></div>
      <button type="submit" class="btn-primary w-full py-5 font-bold rounded-xl shadow-xl shadow-primary/20">Sozlamalarni saqlash</button>
    </form>`;
  }
  if (path === '/admin/issue/new' || path === '/admin/issue/edit') {
    const id = params.get('id');
    const iss = issues.find(i => i.id === id) || { volume: '', issue_number: '', year: '2026', month: 'April', cover: '' };
    return `<h1 class="text-3xl font-bold mb-8">${id ? 'Tahrirlash' : 'Yangi Nashr'}</h1><form id="issue-form" class="bg-white p-10 rounded-2xl border shadow-sm space-y-6 max-w-xl"><input type="hidden" id="i-id" value="${id || ''}"><div class="grid grid-cols-2 gap-4"><div><label>Vol</label><input id="i-vol" value="${iss.volume}" class="w-full p-4 border rounded-xl"></div><div><label>Num</label><input id="i-num" value="${iss.issue_number}" class="w-full p-4 border rounded-xl"></div></div><div><label>Rasm</label><input type="file" id="i-file" class="w-full p-4 border rounded-xl bg-slate-50"></div><button type="submit" class="btn-primary w-full py-5 font-bold rounded-xl">Saqlash</button></form>`;
  }
  if (path === '/admin/article/new' || path === '/admin/article/edit') {
    const id = params.get('id');
    const art = articles.find(a => a.id === id) || { title: '', issue_id: issues[0]?.id || '', abstract: '', doi: '', keywords: '', first_page: '', last_page: '', publication_date: '', authors: [{fullName: '', email: '', affiliation: '', orcid: '', phone: ''}], bib_refs: [], type: 'Original Research' };
    return `<h1 class="text-3xl font-bold mb-8">Maqola Tafsilotlari</h1><form id="art-form" class="bg-white p-10 rounded-2xl border shadow-sm space-y-8 max-w-4xl"><input type="hidden" id="a-id" value="${id || ''}"><div><label>Sarlavha</label><textarea id="a-title" rows="2" class="w-full p-4 border rounded-xl font-bold">${art.title}</textarea></div><div class="grid grid-cols-2 gap-4"><div><label>Nashr</label><select id="a-issue" class="w-full p-4 border rounded-xl">${issues.map(i => `<option value="${i.id}" ${art.issue_id===i.id?'selected':''}>Vol ${i.volume} No ${i.issue_number}</option>`).join('')}</select></div><div><label>Sana</label><input id="a-date" value="${art.publication_date}" class="w-full p-4 border rounded-xl"></div><div><label>DOI</label><input id="a-doi" value="${art.doi}" class="w-full p-4 border rounded-xl"></div><div><label>Fayl (PDF)</label><input type="file" id="a-pdf" class="w-full p-4 border rounded-xl bg-slate-50"></div></div><div class="border-t pt-8">
      <div class="flex justify-between items-center mb-4"><label class="font-bold">Mualliflar</label><button type="button" onclick="window.addAuthorField()" class="text-accent font-bold">+ Qo'shish</button></div>
      <div id="author-list" class="space-y-4">${(art.authors || []).map((a, i) => `<div class="author-row grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl relative">${i>0?`<button type="button" onclick="this.parentElement.remove()" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6">✕</button>`:''}<div><label class="text-[10px]">Ism</label><input class="a-auth-name w-full p-2 border rounded" value="${a.fullName}"></div><div><label class="text-[10px]">Email</label><input class="a-auth-email w-full p-2 border rounded" value="${a.email}"></div><div><label class="text-[10px]">Tashkilot</label><input class="a-auth-aff w-full p-2 border rounded" value="${a.affiliation}"></div><div><label class="text-[10px]">ORCID</label><input class="a-auth-orcid w-full p-2 border rounded" value="${a.orcid||''}"></div><div><label class="text-[10px]">Tel</label><input class="a-auth-phone w-full p-2 border rounded" value="${a.phone||''}"></div></div>`).join('')}</div>
    </div><div><label>Abstract</label><textarea id="a-abstract" rows="4" class="w-full p-4 border rounded-xl">${art.abstract}</textarea></div><div><label>Keywords</label><input id="a-keywords" value="${art.keywords}" class="w-full p-4 border rounded-xl"></div><div><label>References</label><textarea id="a-refs" rows="4" class="w-full p-4 border rounded-xl">${(art.bib_refs || []).join('\n')}</textarea></div><button type="submit" class="btn-primary w-full py-5 font-bold rounded-xl shadow-xl">Saqlash</button></form>`;
  }
  return 'Topilmadi';
}

function attachAdminEvents(path, params) {
  const issForm = document.getElementById('issue-form');
  if (issForm) {
    issForm.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('i-id').value;
      const file = document.getElementById('i-file').files[0];
      let cover = issues.find(i => i.id === id)?.cover || 'https://images.unsplash.com/photo-1532187875605-2fe358a77e82?q=80&w=2070&auto=format&fit=crop';
      if (file) {
        const { data, error } = await supabase.storage.from('covers').upload(Date.now() + '-' + file.name, file);
        if (error) { alert(error.message); return; }
        cover = supabaseUrl + '/storage/v1/object/public/covers/' + data.path;
      }
      const data = { id: id || 'iss-' + Date.now(), volume: document.getElementById('i-vol').value, issue_number: document.getElementById('i-num').value, year: '2026', month: 'April', cover: cover };
      await supabase.from('issues').upsert([data]); await loadData(); navigate('/admin/issues');
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
      const authors = Array.from(document.querySelectorAll('.author-row')).map(row => ({
        fullName: row.querySelector('.a-auth-name').value, email: row.querySelector('.a-auth-email').value, affiliation: row.querySelector('.a-auth-aff').value, orcid: row.querySelector('.a-auth-orcid').value, phone: row.querySelector('.a-auth-phone').value
      }));
      const data = { id: id || 'art-' + Date.now(), title: document.getElementById('a-title').value, issue_id: document.getElementById('a-issue').value, pdf_path, authors, abstract: document.getElementById('a-abstract').value, keywords: document.getElementById('a-keywords').value, bib_refs: document.getElementById('a-refs').value.split('\n').filter(r => r.trim()), publication_date: document.getElementById('a-date').value, doi: document.getElementById('a-doi').value };
      await supabase.from('articles').upsert([data]); await loadData(); navigate('/admin/articles');
    };
  }

  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.onsubmit = async (e) => {
      e.preventDefault();
      const data = {
        id: 1, name: document.getElementById('s-name').value, short_name: document.getElementById('s-short').value, issn: document.getElementById('s-issn').value, tagline: document.getElementById('s-tagline').value, email: document.getElementById('s-email').value, phone: document.getElementById('s-phone').value, address: document.getElementById('s-address').value, submission_info: document.getElementById('s-subinfo').value
      };
      await supabase.from('site_info').upsert([data]); await loadData(); alert('Saqlandi!');
    };
  }
}

window.addAuthorField = () => {
  const container = document.getElementById('author-list');
  const div = document.createElement('div');
  div.className = 'author-row grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl relative';
  div.innerHTML = `<button type="button" onclick="this.parentElement.remove()" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6">✕</button><div><label class="text-[10px]">Ism</label><input class="a-auth-name w-full p-2 border rounded mt-1" placeholder="F.I.SH"></div><div><label class="text-[10px]">Email</label><input class="a-auth-email w-full p-2 border rounded mt-1"></div><div><label class="text-[10px]">Tashkilot</label><input class="a-auth-aff w-full p-2 border rounded mt-1"></div><div><label class="text-[10px]">ORCID</label><input class="a-auth-orcid w-full p-2 border rounded mt-1"></div><div><label class="text-[10px]">Tel</label><input class="a-auth-phone w-full p-2 border rounded mt-1"></div>`;
  container.appendChild(div);
};

window.deleteArticle = async (id) => { if (confirm('Ishonchingiz komilmi?')) { await supabase.from('articles').delete().eq('id', id); await loadData(); } };
window.deleteIssue = async (id) => { if (confirm('Ishonchingiz komilmi?')) { await supabase.from('issues').delete().eq('id', id); await loadData(); } };
window.deleteSubmission = async (id) => { if (confirm('Ishonchingiz komilmi?')) { await supabase.from('submissions').delete().eq('id', id); await loadData(); } };
window.deleteAnnouncement = async (id) => { if (confirm('Ishonchingiz komilmi?')) { await supabase.from('announcements').delete().eq('id', id); await loadData(); } };
window.togglePdfViewer = () => document.getElementById('pdf-viewer-container').classList.toggle('hidden');
window.copyCitation = () => { navigator.clipboard.writeText(document.getElementById('citation-text').innerText); alert('Citation copied!'); };

loadData();

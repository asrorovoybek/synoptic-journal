import './style.css';
import { createClient } from '@supabase/supabase-js';
import { initialArticles, initialIssues, initialSiteInfo, initialAnnouncements, editorialTeam } from './data.js';

// --- Supabase Config ---
const supabaseUrl = 'https://lmhqneinkzpxfhahvcvx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtaHFuZWlua3pweGZoYWh2Y3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDY2NDMsImV4cCI6MjA5MjYyMjY0M30.gF5LkfzuDFywZ7iFJh5kEqwaCpu91ixrIHPBa_YxxL4';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- State Management ---
let siteInfo = initialSiteInfo;
let announcements = initialAnnouncements;
let issues = initialIssues;
let articles = initialArticles;
let submissions = [];
let isAdminLoggedIn = localStorage.getItem('msje_admin_auth') === 'true';

async function loadData() {
  console.log('Syncing data with Supabase...');
  try {
    const { data: sInfo, error: sErr } = await supabase.from('site_info').select('*').single();
    const { data: ann, error: aErr } = await supabase.from('announcements').select('*');
    const { data: iss, error: iErr } = await supabase.from('issues').select('*');
    const { data: art, error: rErr } = await supabase.from('articles').select('*');
    const { data: sub, error: uErr } = await supabase.from('submissions').select('*');

    if (sErr) console.warn('Site Info not found, using default.');
    if (sInfo) siteInfo = { ...initialSiteInfo, ...sInfo, shortName: sInfo.short_name || initialSiteInfo.shortName, submissionInfo: sInfo.submission_info || initialSiteInfo.submissionInfo };
    
    if (ann) announcements = ann;
    if (iss) issues = iss.map(i => ({ ...i, issueNumber: i.issuenumber || i.issueNumber }));
    if (art) articles = art.map(a => ({ ...a, issueId: a.issue_id, firstPage: a.first_page, lastPage: a.last_page, publicationDate: a.publication_date, pdfPath: a.pdf_path, references: a.refs || a.references }));
    if (sub) submissions = sub.map(s => ({ ...s, filePath: s.file_path }));
    
    console.log('Sync complete. Articles loaded:', articles.length);
  } catch (e) { 
    console.error('Critical Data Load Error:', e); 
  }
  handleRoute();
}

const saveState = async (table, data) => {
  try {
    if (table && data) {
      // PostgreSQL uchun nomlarni moslash (camelCase -> snake_case)
      const dbData = { ...data };
      if (table === 'issues') {
        if (data.issueNumber) { dbData.issuenumber = data.issueNumber; delete dbData.issueNumber; }
      }
      if (table === 'articles') {
        if (data.references) { dbData.refs = data.references; delete dbData.references; }
        if (data.pdfPath) { dbData.pdf_path = data.pdfPath; delete dbData.pdfPath; }
      }
      
      const { error } = await supabase.from(table).upsert([dbData]);
      if (error) {
        console.error(`Supabase Save Error (${table}):`, error);
        alert(`Xatolik yuz berdi (${table}): ` + error.message);
        return false;
      }
      console.log(`Successfully saved to ${table}`);
      return true;
    }
    localStorage.setItem('msje_site_info', JSON.stringify(siteInfo));
    localStorage.setItem('msje_announcements', JSON.stringify(announcements));
    localStorage.setItem('msje_issues', JSON.stringify(issues));
    localStorage.setItem('msje_articles', JSON.stringify(articles));
    localStorage.setItem('msje_submissions', JSON.stringify(submissions));
    return true;
  } catch (e) { 
    console.error('Critical Save Error:', e);
    alert('Kutilmagan xatolik: ' + e.message);
    return false;
  }
};

// --- Meta Tag Manager (Google Scholar) ---
function updateMetaTags(article) {
  // Eski taglarni tozalash
  document.querySelectorAll('meta[name^="citation_"]').forEach(el => el.remove());
  if (!article) { document.title = siteInfo.name; return; }
  
  const issue = issues.find(i => i.id === article.issueId) || {};
  
  // Sanani qat'iy YYYY/MM/DD formatiga o'tkazish (nuqta yoki chiziqni to'g'irlaydi)
  const dateParts = article.publicationDate.split(/[\.\-\/]/);
  let formattedDate = article.publicationDate;
  if (dateParts.length === 3) {
    // Agar sana DD.MM.YYYY formatida bo'lsa
    if (dateParts[2].length === 4) formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    // Agar sana YYYY.MM.DD formatida bo'lsa
    else if (dateParts[0].length === 4) formattedDate = `${dateParts[0]}/${dateParts[1]}/${dateParts[2]}`;
  }

  const tags = [
    { name: 'citation_title', content: article.title },
  ];

  // Mualliflar sarlavhadan keyin darhol kelishi kerak
  article.authors.forEach(auth => {
    tags.push({ name: 'citation_author', content: auth.fullName });
    if (auth.affiliation) tags.push({ name: 'citation_author_institution', content: auth.affiliation });
  });

  tags.push(
    { name: 'citation_publication_date', content: formattedDate },
    { name: 'citation_journal_title', content: siteInfo.name },
    { name: 'citation_issn', content: siteInfo.issn },
    { name: 'citation_volume', content: issue.volume || '1' },
    { name: 'citation_issue', content: issue.issueNumber || '1' },
    { name: 'citation_firstpage', content: article.firstPage || '1' },
    { name: 'citation_lastpage', content: article.lastPage || '10' },
    { name: 'citation_abstract_html_url', content: window.location.href },
    { name: 'citation_pdf_url', content: article.pdfPath },
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
    if (!isAdminLoggedIn && path !== '/admin/login') {
      navigate('/admin/login');
      return;
    }
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
          <div class="w-14 h-14 bg-primary rounded-2xl shadow-xl flex items-center justify-center text-white font-serif text-3xl font-bold ring-4 ring-white/10">${siteInfo.shortName.charAt(0)}</div>
          <div class="flex flex-col">
            <span class="font-serif text-2xl font-bold text-primary tracking-tight leading-none">${siteInfo.shortName}</span>
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
                <button onclick="window.msje_navigate('/submission-portal')" class="bg-white text-slate-950 hover:bg-slate-100 px-8 py-3.5 rounded-xl text-sm font-bold transition-all shadow-xl">🚀 Author Portal</button>
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
                     <p class="text-base text-slate-400 mt-6 font-medium">${art.authors.map(a => a.fullName).join(' • ')}</p>
                     <div class="mt-10 pt-8 border-t border-slate-50 flex items-center justify-between">
                        <span class="text-[10px] font-black text-slate-300 uppercase tracking-widest">DOI: ${art.doi || 'N/A'}</span>
                        <span class="text-xs font-black text-primary uppercase tracking-[0.2em] group-hover:translate-x-2 transition-transform">Read Full Text &rarr;</span>
                     </div>
                  </div>
                `).join('')}
                ${articles.length > 5 ? `
                  <button onclick="window.msje_navigate('/archive')" class="w-full py-6 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-bold hover:border-accent hover:text-accent transition-all uppercase tracking-widest text-xs">View all articles in Archive &rarr;</button>
                ` : ''}
              </div>
           </div>
           <div class="space-y-12">
              <div class="bg-primary text-white p-8 rounded-2xl shadow-2xl relative overflow-hidden">
                 <h3 class="text-xl font-bold mb-4">Announcements</h3>
                 <div class="space-y-6">
                   ${announcements.map(ann => `
                     <div class="border-b border-white/20 pb-4">
                        <p class="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">${ann.date}</p>
                        <p class="font-bold text-sm mb-1">${ann.title}</p>
                        <p class="text-xs text-white/70">${ann.content}</p>
                     </div>
                   `).join('')}
                 </div>
                 <button onclick="window.msje_navigate('/submissions')" class="w-full mt-8 bg-white text-primary font-bold py-4 rounded-xl hover:bg-gray-100 transition-all uppercase tracking-widest text-xs">Submission Portal</button>
              </div>
              <div class="bg-gray-50 p-8 rounded-2xl border border-slate-100">
                  <h3 class="font-bold mb-6 text-lg text-primary flex items-center gap-2">
                     <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                     Journal Metrics
                  </h3>
                  <div class="space-y-6">
                     <div>
                        <p class="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Time to First Decision</p>
                        <p class="text-2xl font-bold text-slate-800">14 - 21 Days</p>
                        <p class="text-[10px] text-slate-400 mt-1">Average time for peer-review</p>
                     </div>
                     <div>
                        <p class="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Acceptance Rate</p>
                        <p class="text-2xl font-bold text-slate-800">38%</p>
                        <p class="text-[10px] text-slate-400 mt-1">Quality-based selection</p>
                     </div>
                     <div>
                        <p class="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Frequency</p>
                        <p class="text-xl font-bold text-slate-800">Monthly</p>
                        <p class="text-[10px] text-slate-400 mt-1">12 Issues per year</p>
                     </div>
                     <div class="pt-6 border-t border-slate-200">
                        <p class="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-2">Open Access</p>
                        <p class="text-xs font-bold text-accent">Full Gold Open Access (CC BY 4.0)</p>
                     </div>
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
             <!-- Centered Header -->
             <header class="mb-10 text-center border-b border-slate-50 pb-10">
               <span class="inline-block px-3 py-1 bg-accent/10 text-accent text-[10px] font-bold rounded-full mb-4 uppercase tracking-widest">${art.type}</span>
               <h1 class="text-2xl md:text-3xl font-serif font-bold mb-6 leading-tight text-primary max-w-3xl mx-auto">${art.title}</h1>
               <div class="flex flex-wrap justify-center gap-8">
                  ${art.authors.map(a => `
                    <div class="text-center">
                       <p class="text-lg font-serif font-bold text-slate-800">${a.fullName}</p>
                       <p class="text-xs text-slate-500 font-medium italic mb-2">${a.affiliation || 'Scientific Institution'}</p>
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
                  <a href="${art.pdfPath}" download class="bg-slate-100 text-slate-700 px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all flex items-center gap-2">📥 Download</a>
                  <button onclick="window.copyCitation()" class="bg-white border border-slate-200 text-slate-700 px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">📋 Cite Article</button>
               </div>
             </header>

             <!-- Content Sections -->
             <div class="space-y-10">
                <section>
                   <h2 class="text-sm font-black text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><span class="w-1 h-4 bg-accent"></span> Abstract</h2>
                   <p class="text-sm text-gray-600 leading-relaxed text-justify">${art.abstract}</p>
                   
                   ${art.keywords ? `
                     <div class="mt-4 flex flex-wrap gap-2 items-center pt-2">
                        <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Keywords:</span>
                        <p class="text-sm text-accent italic">${art.keywords}</p>
                     </div>
                   ` : ''}
                </section>

                <section class="border-t border-slate-50 pt-10">
                   <h2 class="text-sm font-black text-primary uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><span class="w-1 h-4 bg-accent"></span> References</h2>
                   <div class="space-y-4 text-sm text-gray-500 leading-relaxed text-justify">
                     ${art.references.map((r, i) => `<p class="pl-6 relative"><span class="absolute left-0 font-bold text-accent">${i+1}.</span> ${r}</p>`).join('')}
                   </div>
                </section>
                
                <!-- Metadata/Citation Footer -->
                <section class="mt-12 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                   <div class="flex flex-col md:flex-row justify-between gap-6">
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
                         ${art.doi ? `
                           <div>
                              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">DOI</p>
                              <p class="text-xs font-bold text-primary break-all">https://doi.org/${art.doi}</p>
                           </div>
                         ` : ''}
                         <div>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Page Range</p>
                            <p class="text-xs font-bold text-slate-700">${art.firstPage && art.lastPage ? `pp. ${art.firstPage}-${art.lastPage}` : 'N/A'}</p>
                         </div>
                      </div>
                   </div>
                </section>
             </div>

             <!-- PDF Viewer Overlay -->
             <div id="pdf-viewer-container" class="hidden fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-sm flex flex-col">
                <div class="flex justify-between items-center p-4 bg-slate-800 text-white shadow-2xl">
                   <div class="flex items-center gap-4">
                      <button onclick="window.togglePdfViewer()" class="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-bold">
                         &larr; Back to Article
                      </button>
                      <span class="text-xs text-slate-400 border-l border-slate-700 pl-4 truncate max-w-md">${art.title}</span>
                   </div>
                   <div class="text-[10px] font-black uppercase tracking-widest text-accent">${siteInfo.shortName} Reader</div>
                </div>
                <div class="flex-1">
                   <iframe src="${art.pdfPath}" class="w-full h-full border-none" title="PDF Document Viewer"></iframe>
                </div>
             </div>
          </article>
          <div id="citation-text" class="hidden">
             ${art.authors.map(a => a.fullName.split(' ').pop() + ', ' + a.fullName.charAt(0) + '.').join(', ')} (${art.publicationDate.split('/')[0]}). ${art.title}. ${siteInfo.name}.
          </div>
       </main>
     `;
  } else if (path === '/issue') {
     const id = params.get('id');
     const iss = issues.find(i => i.id === id);
     if (!iss) return app.innerHTML = 'Not Found';
     const issueArticles = articles.filter(a => a.issueId === id);
     app.innerHTML = `${getPublicHeader()}
       <main class="max-w-7xl mx-auto px-4 py-16">
          <div class="flex flex-col md:flex-row gap-12 mb-16">
            <div class="w-full md:w-1/3"><img src="${iss.cover}" class="w-full rounded-2xl shadow-2xl border"></div>
            <div class="flex-1 py-4">
               <span class="text-accent font-bold uppercase tracking-widest text-sm">Issue Archive</span>
               <h1 class="text-4xl md:text-5xl font-bold mt-4 mb-6 text-primary">Vol. ${iss.volume}, No. ${iss.issueNumber}</h1>
               <p class="text-xl text-gray-500 mb-8">${iss.month} ${iss.year}</p>
            </div>
          </div>
          <h2 class="text-3xl font-bold mb-10 border-b pb-6">Table of Contents</h2>
          <div class="space-y-10">
            ${issueArticles.map(art => `
              <div class="group cursor-pointer bg-white p-8 rounded-2xl border border-gray-100 hover:shadow-lg transition-all" onclick="window.msje_navigate('/article?id=${art.id}')">
                <h3 class="text-2xl font-bold group-hover:text-primary transition-colors">${art.title}</h3>
                <p class="text-sm text-gray-600 mt-4">${art.authors.map(a => a.fullName).join(', ')}</p>
                <p class="mt-4 text-xs font-bold text-accent">READ MORE &rarr;</p>
              </div>
            `).join('')}
          </div>
       </main>
     `;
  } else if (path === '/archive') {
    app.innerHTML = `${getPublicHeader()}
      <main class="max-w-7xl mx-auto px-4 py-16">
        <h1 class="text-4xl font-bold mb-12">Archive</h1>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          ${issues.map(iss => `
            <div class="bg-white border rounded-2xl overflow-hidden hover:shadow-xl transition-all cursor-pointer group" onclick="window.msje_navigate('/issue?id=${iss.id}')">
              <div class="relative h-64 overflow-hidden">
                <img src="${iss.cover}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700">
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                  <span class="text-white font-bold text-lg">Vol. ${iss.volume} No. ${iss.issueNumber}</span>
                </div>
              </div>
              <div class="p-6">
                <p class="text-xs font-bold text-accent uppercase tracking-widest mb-2">${iss.year} ${iss.month}</p>
                <button class="text-primary font-bold text-sm border-b-2 border-primary pb-1">Browse Content</button>
              </div>
            </div>
          `).join('')}
        </div>
      </main>
    `;
  } else if (path === '/about') {
    app.innerHTML = `${getPublicHeader()}
      <main class="max-w-4xl mx-auto px-4 py-20">
        <header class="text-center mb-20">
           <span class="text-accent font-black text-xs uppercase tracking-[0.3em] mb-4 block">About the Journal</span>
           <h1 class="text-5xl font-serif font-bold text-primary mb-6">${siteInfo.name}</h1>
           <div class="w-20 h-1.5 bg-accent mx-auto rounded-full"></div>
        </header>

        <div class="space-y-16">
           <section class="prose prose-slate max-w-none">
              <h2 class="text-3xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                 <span class="w-2 h-8 bg-primary rounded-full"></span> Mission & Vision
              </h2>
              <p class="text-gray-600 leading-relaxed text-lg italic border-l-4 border-slate-200 pl-6 py-2">
                 "${siteInfo.description}"
              </p>
              <p class="text-gray-600 leading-relaxed text-lg mt-6">
                 Our mission is to provide a world-class platform for researchers, academicians, and professionals to share their innovative ideas and research findings across multiple disciplines. We strive to maintain the highest standards of academic integrity and contribute to the global knowledge economy.
              </p>
           </section>

           <section class="bg-slate-50 p-10 rounded-3xl border border-slate-100 shadow-sm">
              <h2 class="text-3xl font-bold text-slate-800 mb-6">Aims & Scope</h2>
              <p class="text-gray-600 leading-relaxed mb-8">
                 ${siteInfo.name} accepts original research papers, review articles, and case studies in the following broad areas:
              </p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div class="flex items-start gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 transition-transform hover:-translate-y-1">
                    <div class="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">🔬</div>
                    <div><p class="font-bold text-sm text-slate-800">Natural Sciences</p><p class="text-[11px] text-slate-400 leading-tight mt-1">Physics, Chemistry, Biology, Space Sciences, Geology</p></div>
                 </div>
                 <div class="flex items-start gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 transition-transform hover:-translate-y-1">
                    <div class="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">⚖️</div>
                    <div><p class="font-bold text-sm text-slate-800">Social Sciences</p><p class="text-[11px] text-slate-400 leading-tight mt-1">Sociology, Psychology, Economics, Law, Education, Political Science</p></div>
                 </div>
                 <div class="flex items-start gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 transition-transform hover:-translate-y-1">
                    <div class="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">💻</div>
                    <div><p class="font-bold text-sm text-slate-800">Technology & Engineering</p><p class="text-[11px] text-slate-400 leading-tight mt-1">Computer Science, AI, Robotics, Civil, Mechanical, Electrical Engineering</p></div>
                 </div>
                 <div class="flex items-start gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 transition-transform hover:-translate-y-1">
                    <div class="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">📚</div>
                    <div><p class="font-bold text-sm text-slate-800">Humanities</p><p class="text-[11px] text-slate-400 leading-tight mt-1">Literature, History, Arts, Philosophy, Linguistics, Culture</p></div>
                 </div>
                 <div class="flex items-start gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 transition-transform hover:-translate-y-1">
                    <div class="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">🏥</div>
                    <div><p class="font-bold text-sm text-slate-800">Medicine & Health Sciences</p><p class="text-[11px] text-slate-400 leading-tight mt-1">Clinical Medicine, Pharmacy, Nursing, Public Health, Neuroscience</p></div>
                 </div>
                 <div class="flex items-start gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 transition-transform hover:-translate-y-1">
                    <div class="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">🌱</div>
                    <div><p class="font-bold text-sm text-slate-800">Agriculture & Life Sciences</p><p class="text-[11px] text-slate-400 leading-tight mt-1">Agronomy, Veterinary Medicine, Food Science, Ecology, Biotechnology</p></div>
                 </div>
                 <div class="flex items-start gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 transition-transform hover:-translate-y-1">
                    <div class="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">📈</div>
                    <div><p class="font-bold text-sm text-slate-800">Business & Management</p><p class="text-[11px] text-slate-400 leading-tight mt-1">Finance, Marketing, Human Resources, Strategy, Innovation Management</p></div>
                 </div>
                 <div class="flex items-start gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 transition-transform hover:-translate-y-1">
                    <div class="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">📐</div>
                    <div><p class="font-bold text-sm text-slate-800">Formal Sciences</p><p class="text-[11px] text-slate-400 leading-tight mt-1">Mathematics, Statistics, Systems Science, Logic, Decision Theory</p></div>
                 </div>
              </div>
           </section>

           <section>
              <h2 class="text-3xl font-bold text-slate-800 mb-6">Peer Review Process</h2>
              <p class="text-gray-600 leading-relaxed text-lg">
                 All submitted manuscripts undergo a rigorous **double-blind peer review** process. This ensures unbiased evaluation and maintains the highest quality of published work.
              </p>
              <div class="mt-8 flex flex-wrap gap-8 items-center border-l-4 border-accent pl-8 py-4 bg-accent/5 rounded-r-2xl">
                 <div><p class="text-2xl font-bold text-accent font-serif">14-21 Days</p><p class="text-[10px] text-slate-500 uppercase font-black tracking-widest">Avg. Review Time</p></div>
                 <div class="h-10 w-px bg-accent/20"></div>
                 <div><p class="text-2xl font-bold text-accent font-serif">Double-Blind</p><p class="text-[10px] text-slate-500 uppercase font-black tracking-widest">Review Method</p></div>
              </div>
           </section>

           <section class="border-t pt-16">
              <h2 class="text-3xl font-bold text-slate-800 mb-6">Open Access Policy</h2>
              <p class="text-gray-600 leading-relaxed text-lg">
                 This journal provides immediate open access to its content on the principle that making research freely available to the public supports a greater global exchange of knowledge. All articles are published under the **Creative Commons Attribution 4.0 International (CC BY 4.0)** license.
              </p>
              <div class="mt-8 p-4 bg-slate-50 border rounded-xl inline-flex items-center gap-3">
                 <span class="text-2xl">🔓</span>
                 <span class="text-sm font-bold text-slate-700 underline underline-offset-4">Full Gold Open Access</span>
              </div>
           </section>
        </div>
      </main>
    `;
  } else if (path === '/editorial') {
    app.innerHTML = `${getPublicHeader()}
      <main class="max-w-5xl mx-auto px-4 py-20">
        <h1 class="text-4xl font-bold mb-12">Editorial Board</h1>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-12">
          ${editorialTeam.map(ed => `
            <div class="flex gap-6 p-6 bg-white border border-gray-100 rounded-2xl shadow-sm">
               <div class="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white text-xl font-bold">${ed.name.charAt(0)}</div>
               <div><h3 class="text-xl font-bold text-primary">${ed.name}</h3><p class="text-accent font-bold text-xs uppercase tracking-wide mb-1">${ed.role}</p><p class="text-sm text-gray-500">${ed.institution}</p></div>
            </div>
          `).join('')}
        </div>
      </main>
    `;
  } else if (path === '/submissions') {
    app.innerHTML = `${getPublicHeader()}
      <main class="max-w-4xl mx-auto px-4 py-20">
        <h1 class="text-4xl font-bold mb-12">Submissions</h1>
        <div class="bg-gray-50 p-10 rounded-3xl border border-gray-100 mb-12">
          <h2 class="text-2xl font-bold text-primary mb-6">Author Guidelines</h2>
          <p class="mb-4">${siteInfo.submissionInfo}</p>
          <p class="font-bold text-accent">${siteInfo.deadline}</p>
        </div>
        <button onclick="window.msje_navigate('/submission-portal')" class="btn-primary w-full py-6 text-xl font-bold shadow-2xl shadow-primary/30">Go to Online Submission Portal</button>
      </main>
    `;
  } else if (path === '/submission-portal') {
    app.innerHTML = `${getPublicHeader()}
      <main class="max-w-4xl mx-auto px-4 py-20">
        <div class="flex justify-between items-center mb-10">
          <h1 class="text-4xl font-serif font-bold">Online Submission Portal</h1>
          <a href="https://t.me/GlobalJournals_site" target="_blank" class="bg-[#0088cc] text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold hover:opacity-90">
             <span>Support (Telegram)</span>
          </a>
        </div>
        <form id="submission-form" class="bg-white p-10 rounded-3xl border border-slate-100 shadow-xl space-y-10">
           
           <div class="space-y-6">
              <h3 class="text-lg font-bold border-b pb-2 text-primary">📌 Manuscript Title</h3>
              <div><label class="block font-bold mb-2 text-sm">Full Title of the Article</label><input id="sub-title" required class="w-full p-4 border rounded-xl shadow-inner bg-slate-50" placeholder="Enter the full title of your research paper"></div>
           </div>

           <div class="space-y-6">
              <div class="flex justify-between items-center border-b pb-2">
                 <h3 class="text-lg font-bold text-primary flex items-center gap-2">👥 Author Information</h3>
                 <button type="button" onclick="window.addSubAuthorField()" class="bg-accent text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-md hover:bg-emerald-700 transition-colors">+ Add Author</button>
              </div>
              <div id="sub-author-fields" class="space-y-4">
                 <div class="sub-author-row grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100 relative">
                    <div><label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name</label><input required class="sub-auth-name w-full p-3 border rounded-lg mt-1" placeholder="e.g. John Doe"></div>
                    <div><label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</label><input type="email" required class="sub-auth-email w-full p-3 border rounded-lg mt-1" placeholder="john@example.com"></div>
                    <div class="md:col-span-2"><label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Affiliation (University/Org)</label><input required class="sub-auth-aff w-full p-3 border rounded-lg mt-1" placeholder="University of Science, Department of Physics"></div>
                 </div>
              </div>
           </div>

           <div class="space-y-8">
              <h3 class="text-lg font-bold border-b pb-2 text-primary">📄 Abstract & Keywords</h3>
              <div><label class="block font-bold mb-2 text-sm">Abstract</label><textarea id="sub-abstract" rows="6" required class="w-full p-4 border rounded-xl shadow-inner bg-slate-50" placeholder="Brief summary of your research..."></textarea></div>
              <div><label class="block font-bold mb-2 text-sm">Keywords</label><input id="sub-keywords" required class="w-full p-4 border rounded-xl shadow-inner bg-slate-50" placeholder="e.g. Artificial Intelligence, Data Science, Ethics (comma separated)"></div>
           </div>

           <div class="space-y-8">
              <h3 class="text-lg font-bold border-b pb-2 text-primary">📚 References & File</h3>
              <div><label class="block font-bold mb-2 text-sm">References (APA Style)</label><textarea id="sub-refs" rows="6" required class="w-full p-4 border rounded-xl shadow-inner bg-slate-50" placeholder="1. Author, A. (Year). Title..."></textarea></div>
              <div>
                 <label class="block font-bold mb-2 text-sm">Upload Manuscript (Word/PDF - Max 10MB)</label>
                 <div class="flex items-center gap-4">
                    <input type="file" id="sub-file" required class="flex-1 p-3 border rounded-xl bg-slate-50 text-sm">
                    <button type="button" onclick="document.getElementById('sub-file').value=''" class="bg-red-100 text-red-500 p-3 rounded-xl hover:bg-red-200">✕</button>
                 </div>
              </div>
           </div>

           <div class="p-6 bg-blue-50 text-blue-800 rounded-2xl text-sm italic border-l-4 border-blue-500">
             Note: By clicking "Submit", you confirm that this work is original and complies with our ethical guidelines.
           </div>
           <button type="submit" class="btn-primary w-full py-6 text-xl font-serif font-bold rounded-2xl shadow-2xl shadow-primary/20">Submit Manuscript</button>
        </form>
      </main>
    `;
  }
  app.innerHTML += getPublicFooter();

  // MUHIM: Hamma HTML chizib bo'lingandan keyin eventlarni ulaymiz
  if (path === '/submission-portal') attachSubmissionEvent();
}

function getPublicFooter() {
  return `
    <footer class="bg-slate-900 text-white pt-24 pb-12 mt-20 border-t-4 border-primary">
      <div class="max-w-7xl mx-auto px-4">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-20">
          <div class="lg:col-span-1">
             <div class="flex items-center gap-3 mb-8">
                <div class="w-10 h-10 bg-white text-slate-900 rounded flex items-center justify-center font-bold text-xl">${siteInfo.shortName.charAt(0)}</div>
                <span class="font-bold text-xl tracking-tight">${siteInfo.shortName}</span>
             </div>
             <p class="text-gray-400 text-sm leading-relaxed mb-8">${siteInfo.description.substring(0, 150)}...</p>
          </div>
          <div>
             <h4 class="font-bold text-sm uppercase tracking-widest text-accent mb-8">Quick Links</h4>
             <ul class="space-y-4 text-sm text-gray-400">
                <li><button onclick="window.msje_navigate('/about')" class="hover:text-white">About</button></li>
                <li><button onclick="window.msje_navigate('/editorial')" class="hover:text-white">Editorial Board</button></li>
                <li><button onclick="window.msje_navigate('/submissions')" class="hover:text-white">Submissions</button></li>
                <li><button onclick="window.msje_navigate('/archive')" class="hover:text-white">Archive</button></li>
             </ul>
          </div>
          <div>
             <h4 class="font-bold text-sm uppercase tracking-widest text-accent mb-8">Indexing</h4>
             <ul class="space-y-4 text-sm text-gray-400 font-bold">
                <li class="flex items-center gap-2"><span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Google Scholar</li>
                <li class="flex items-center gap-2"><span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span> CrossRef DOI</li>
                <li class="flex items-center gap-2"><span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span> DOAJ Index</li>
             </ul>
          </div>
          <div>
             <h4 class="font-bold text-sm uppercase tracking-widest text-accent mb-8">Contact</h4>
             <p class="text-sm text-gray-400 leading-relaxed">
                ${siteInfo.address}<br>
                Email: <a href="mailto:${siteInfo.email}" class="hover:text-white underline decoration-accent/30">${siteInfo.email}</a><br>
                Tel: <a href="tel:${siteInfo.phone}" class="hover:text-white underline decoration-accent/30">${siteInfo.phone}</a><br><br>
                <span class="text-[10px] font-bold text-accent">ISSN: ${siteInfo.issn}</span>
             </p>
          </div>
        </div>
        <div class="border-t border-slate-800 pt-12 flex justify-between items-center text-xs text-gray-500">
           <p>&copy; ${new Date().getFullYear()} ${siteInfo.name}.</p>
           <div class="flex gap-6"><a href="/admin/login" class="hover:text-white uppercase tracking-widest">Admin Login</a></div>
        </div>
      </div>
    </footer>
  `;
}

function attachSubmissionEvent() {
  const form = document.getElementById('submission-form');
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="flex items-center justify-center gap-3">
      <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      Uploading manuscript...
    </span>`;

    try {
      const fileInput = document.getElementById('sub-file');
      const file = fileInput.files[0];

      if (file && file.size > 10 * 1024 * 1024) {
        alert('Error: File size too large! Maximum 10MB allowed.');
        return;
      }

      let filePath = '';
      if (file) {
        const { data, error } = await supabase.storage.from('pdfs').upload('submissions/' + Date.now() + '-' + file.name, file);
        if (error) throw error;
        filePath = supabaseUrl + '/storage/v1/object/public/pdfs/' + data.path;
      }

      const authorList = Array.from(document.querySelectorAll('.sub-author-row')).map(row => ({
         fullName: row.querySelector('.sub-auth-name').value,
         email: row.querySelector('.sub-auth-email').value,
         affiliation: row.querySelector('.sub-auth-aff').value
      }));

      const newSub = {
        id: 'sub-' + Date.now(),
        title: document.getElementById('sub-title').value,
        authors: authorList,
        abstract: document.getElementById('sub-abstract').value,
        keywords: document.getElementById('sub-keywords').value,
        references: document.getElementById('sub-refs').value,
        file_path: filePath,
        status: 'Pending',
        date: new Date().toLocaleDateString()
      };
      submissions.unshift({ ...newSub, filePath: newSub.file_path });
      const success = await saveState('submissions', newSub);
      if (success) {
        alert('Your manuscript has been successfully submitted. The editorial team will contact you soon.');
        navigate('/');
      }
    } catch (err) {
      console.error('Submission Error:', err);
      alert('Submission failed: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalBtnText;
    }
  };
}

window.addSubAuthorField = () => {
  const container = document.getElementById('sub-author-fields');
  const div = document.createElement('div');
  div.className = 'sub-author-row grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100 relative';
  div.innerHTML = `
    <button type="button" onclick="this.parentElement.remove()" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs shadow-md">×</button>
    <div><label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name</label><input required class="sub-auth-name w-full p-3 border rounded-lg mt-1" placeholder="Co-author Name"></div>
    <div><label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</label><input type="email" required class="sub-auth-email w-full p-3 border rounded-lg mt-1" placeholder="email@example.com"></div>
    <div class="md:col-span-2"><label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Affiliation (University/Org)</label><input required class="sub-auth-aff w-full p-3 border rounded-lg mt-1" placeholder="Department, University"></div>
  `;
  container.appendChild(div);
};

// --- Admin Panel ---
function renderAdmin(path, params) {
  if (path === '/admin/login') { renderAdminLogin(); return; }
  app.innerHTML = `
    <div class="flex min-h-screen bg-gray-50">
      <aside class="w-64 bg-slate-900 text-white p-6 sticky top-0 h-screen">
        <div class="mb-10 text-center"><div class="w-12 h-12 bg-accent mx-auto rounded-lg flex items-center justify-center text-white text-xl font-bold mb-2">S</div><p class="text-xs font-bold text-gray-400">ADMIN PANEL</p></div>
        <nav class="space-y-1">
          <button onclick="window.msje_navigate('/')" class="w-full text-left p-3 rounded bg-accent/20 text-accent font-bold mb-6 hover:bg-accent/30 flex items-center gap-3">🏠 Saytni ko'rish</button>
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
  app.innerHTML = `<div class="min-h-screen flex items-center justify-center bg-slate-900"><div class="max-w-md w-full bg-white p-10 rounded-2xl shadow-2xl">
    <h1 class="text-2xl font-bold text-center mb-8 text-slate-800">Journal Management</h1>
    <form id="login-form" class="space-y-6">
        <div><label class="block text-sm font-bold mb-2">Username</label><input type="text" id="username" required class="w-full px-4 py-3 border rounded-lg outline-none"></div>
        <div><label class="block text-sm font-bold mb-2">Password</label><input type="password" id="password" required class="w-full px-4 py-3 border rounded-lg outline-none"></div>
        <button type="submit" class="w-full bg-primary text-white py-4 rounded-lg font-bold">Authentication</button>
    </form></div></div>`;
  document.getElementById('login-form').onsubmit = (e) => {
    e.preventDefault();
    if (document.getElementById('username').value === 'Oybek' && document.getElementById('password').value === '250795') {
      isAdminLoggedIn = true; localStorage.setItem('msje_admin_auth', 'true'); navigate('/admin/dashboard');
    } else { alert('Invalid credentials!'); }
  };
}

function renderAdminContent(path, params) {
  if (path === '/admin/dashboard') {
    return `<h1 class="text-3xl font-bold mb-10">Boshqaruv Paneli</h1><div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div class="bg-white p-8 rounded-xl border"> <p class="text-gray-400 text-xs font-bold uppercase">Yangi Arizalar</p><p class="text-4xl font-bold mt-2">${submissions.length}</p></div>
      <div class="bg-white p-8 rounded-xl border"> <p class="text-gray-400 text-xs font-bold uppercase">Jami Maqolalar</p><p class="text-4xl font-bold mt-2">${articles.length}</p></div>
      <div class="bg-white p-8 rounded-xl border"> <p class="text-gray-400 text-xs font-bold uppercase">Jami Nashrlar</p><p class="text-4xl font-bold mt-2">${issues.length}</p></div>
    </div>`;
  } else if (path === '/admin/submissions') {
    const detailId = params.get('view');
    if (detailId) {
       const sub = submissions.find(s => s.id === detailId);
       if (!sub) return 'Ariza topilmadi';
       return `
         <div class="mb-8 flex items-center gap-4">
           <button onclick="window.msje_navigate('/admin/submissions')" class="text-accent font-bold">&larr; Orqaga</button>
           <h1 class="text-3xl font-bold text-primary">Ariza tafsilotlari</h1>
         </div>
         <div class="bg-white p-10 rounded-2xl border shadow-sm space-y-8">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div class="md:col-span-2">
                  <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Maqola sarlavhasi</p>
                  <p class="text-2xl font-bold text-primary">${sub.title}</p>
               </div>
               <div class="md:col-span-2">
                  <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Mualliflar</p>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${sub.authors.map(a => `
                      <div class="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <p class="font-bold text-sm">${a.fullName}</p>
                        <p class="text-xs text-slate-500">${a.email}</p>
                        <p class="text-[10px] text-slate-400 mt-1">${a.affiliation}</p>
                      </div>
                    `).join('')}
                  </div>
               </div>
            </div>
            <div class="border-t pt-8">
               <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Abstract</p>
               <p class="text-sm leading-relaxed text-slate-600">${sub.abstract}</p>
            </div>
            <div>
               <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Keywords</p>
               <p class="text-sm font-bold text-accent">${sub.keywords || 'Noma\'lum'}</p>
            </div>
            <div>
               <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">References</p>
               <pre class="text-xs bg-slate-50 p-4 rounded-xl whitespace-pre-wrap font-sans text-slate-500 border border-slate-100">${sub.references || 'Noma\'lum'}</pre>
            </div>
            <div class="flex gap-4 pt-6">
               <a href="${sub.file_path}" target="_blank" class="btn-primary flex-1 text-center py-4 flex items-center justify-center gap-2">📥 Faylni ko'rish</a>
               <button onclick="window.deleteSubmission('${sub.id}')" class="bg-red-50 text-red-500 px-6 py-4 rounded-xl font-bold border border-red-100 hover:bg-red-500 hover:text-white transition-all active:scale-95 flex items-center gap-2">🗑️ Arizani o'chirish</button>
            </div>
         </div>
       `;
    }
    return `<h1 class="text-3xl font-bold mb-8 text-primary">Kelib tushgan Arizalar</h1>
      <div class="bg-white rounded-xl border overflow-hidden shadow-sm"><table class="w-full text-left"><thead class="bg-slate-50 border-b"><tr><th class="p-4">Sarlavha</th><th class="p-4 text-center">Amallar</th></tr></thead><tbody>
        ${submissions.map(sub => `<tr class="border-b hover:bg-slate-50 transition-colors"> <td class="p-4 font-bold text-sm truncate max-w-md">${sub.title}</td><td class="p-4 text-center">
          <button onclick="window.msje_navigate('/admin/submissions?view=${sub.id}')" class="inline-flex items-center gap-1.5 text-accent hover:text-white border border-accent/20 hover:bg-accent px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:scale-105 active:scale-95">
             👁️ Ko'rish
          </button>
          <a href="${sub.file_path}" target="_blank" class="inline-flex items-center gap-1.5 text-blue-600 hover:text-white border border-blue-100 hover:bg-blue-600 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:scale-105 active:scale-95 ml-2">
             📥 Fayl
          </a>
          <button onclick="window.deleteSubmission('${sub.id}')" class="inline-flex items-center gap-1.5 text-red-500 hover:text-white border border-red-100 hover:bg-red-500 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:scale-105 active:scale-95 ml-2">
             🗑️ O'chirish
          </button></td></tr>`).join('')}
      </tbody></table></div>`;
  } else if (path === '/admin/issues') {
    return `<div class="flex justify-between items-center mb-8"><h1 class="text-3xl font-bold">Nashrlar</h1><button onclick="window.msje_navigate('/admin/issue/new')" class="btn-primary">+ Yangi Nashr</button></div>
      <div class="bg-white rounded-xl border overflow-hidden shadow-sm"><table class="w-full text-left"><thead class="bg-slate-50 border-b"><tr><th class="p-4">Nashr</th><th class="p-4 text-center">Amallar</th></tr></thead><tbody>
        ${issues.map(iss => `<tr class="border-b"> <td class="p-4 font-bold">Vol ${iss.volume}, No ${iss.issueNumber} (${iss.year})</td><td class="p-4 text-center">
          <button onclick="window.msje_navigate('/admin/issue/edit?id=${iss.id}')" class="inline-flex items-center gap-1.5 text-accent hover:text-white border border-accent/20 hover:bg-accent px-4 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-sm">
            Tahrirlash
          </button>
          <button onclick="window.deleteIssue('${iss.id}')" class="inline-flex items-center gap-1.5 text-red-500 hover:text-white border border-red-100 hover:bg-red-500 px-4 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-sm ml-2">
            O'chirish
          </button></td></tr>`).join('')}
      </tbody></table></div>`;
  } else if (path === '/admin/issue/new' || path === '/admin/issue/edit') {
    const id = params.get('id');
    const iss = issues.find(i => i.id === id) || { volume: '', issueNumber: '', year: new Date().getFullYear(), month: 'January', cover: '' };
    return `<h1 class="text-3xl font-bold mb-8">${id ? 'Nashrni Tahrirlash' : 'Yangi Nashr'}</h1>
      <form id="issue-form" class="bg-white p-8 rounded-xl border space-y-6 max-w-3xl">
        <input type="hidden" id="i-id" value="${id || ''}">
        <div class="grid grid-cols-2 gap-6">
           <div><label class="block font-bold mb-1">Volume</label><input id="i-vol" value="${iss.volume}" required class="w-full p-3 border rounded"></div>
           <div><label class="block font-bold mb-1">Number</label><input id="i-num" value="${iss.issueNumber}" required class="w-full p-3 border rounded"></div>
           <div><label class="block font-bold mb-1">Yil</label><input id="i-year" value="${iss.year}" required class="w-full p-3 border rounded"></div>
           <div><label class="block font-bold mb-1">Oy</label><select id="i-month" class="w-full p-3 border rounded">${['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => `<option ${iss.month===m?'selected':''}>${m}</option>`).join('')}</select></div>
        </div>
        <div><label class="block font-bold mb-1">Muqova rasmi</label><div class="flex gap-4"><input type="text" id="i-cover-url" value="${iss.cover}" placeholder="URL" class="flex-1 p-3 border rounded"><input type="file" id="i-cover-file" class="hidden"><button type="button" onclick="document.getElementById('i-cover-file').click()" class="btn-secondary text-xs">Fayl Yuklash</button></div></div>
        <button type="submit" class="btn-primary w-full py-4 font-bold">Saqlash</button></form>`;
  } else if (path === '/admin/articles') {
    return `<div class="flex justify-between items-center mb-8"><h1 class="text-3xl font-bold">Maqolalar</h1><button onclick="window.msje_navigate('/admin/article/new')" class="btn-primary">+ Yangi Maqola</button></div>
      <div class="bg-white rounded-xl border overflow-hidden shadow-sm"><table class="w-full text-left"><thead class="bg-slate-50 border-b"><tr><th class="p-4">Sarlavha</th><th class="p-4 text-center">Amallar</th></tr></thead><tbody>
        ${articles.map(art => `<tr class="border-b"> <td class="p-4 font-bold text-sm truncate max-w-lg">${art.title}</td><td class="p-4 text-center">
          <button onclick="window.msje_navigate('/admin/article/edit?id=${art.id}')" class="inline-flex items-center gap-1.5 text-accent hover:text-white border border-accent/20 hover:bg-accent px-4 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-sm">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
            Tahrirlash
          </button>
          <button onclick="window.deleteArticle('${art.id}')" class="inline-flex items-center gap-1.5 text-red-500 hover:text-white border border-red-100 hover:bg-red-500 px-4 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-sm ml-2">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            O'chirish
          </button></td></tr>`).join('')}
      </tbody></table></div>`;
  } else if (path === '/admin/article/new' || path === '/admin/article/edit') {
    const id = params.get('id');
    const art = articles.find(a => a.id === id) || { 
      title: '', issueId: issues[0]?.id, abstract: '', doi: '', keywords: '',
      authors: [{fullName:'', email:'', affiliation:'', orcid:''}], 
      references: '', type: 'Original Research' 
    };
    return `<h1 class="text-3xl font-bold mb-8">Maqola Ma'lumotlarini Kiritish</h1>
      <form id="article-form" class="bg-white p-10 border rounded-2xl shadow-sm space-y-10">
        <input type="hidden" id="a-id" value="${id || ''}">
        
        <div class="space-y-6">
           <h3 class="text-lg font-bold border-b pb-2 flex items-center gap-2 text-primary">📌 Asosiy ma'lumotlar</h3>
           <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="md:col-span-2"><label class="block font-bold mb-1 text-sm">Maqola Sarlavhasi (Full Title)</label><input id="a-title" value="${art.title}" required class="w-full p-3 border rounded-xl"></div>
              <div><label class="block font-bold mb-1 text-sm">Nashr (Issue Selection)</label><select id="a-issue" class="w-full p-3 border rounded-xl">${issues.map(iss => `<option value="${iss.id}" ${art.issueId===iss.id?'selected':''}>Vol ${iss.volume}, No ${iss.issueNumber} (${iss.year})</option>`).join('')}</select></div>
              <div><label class="block font-bold mb-1 text-sm">Maqola Turi</label><select id="a-type" class="w-full p-3 border rounded-xl"><option>Original Research</option><option>Review Article</option><option>Case Study</option></select></div>
              <div><label class="block font-bold mb-1 text-sm">DOI (Agar bo'lsa)</label><input id="a-doi" value="${art.doi}" placeholder="10.xxxx/xxxxx" class="w-full p-3 border rounded-xl"></div>
              <div class="grid grid-cols-2 gap-4">
                <div><label class="block font-bold mb-1 text-sm">First Page</label><input type="number" id="a-fpage" value="${art.firstPage || ''}" class="w-full p-3 border rounded-xl" placeholder="10"></div>
                <div><label class="block font-bold mb-1 text-sm">Last Page</label><input type="number" id="a-lpage" value="${art.lastPage || ''}" class="w-full p-3 border rounded-xl" placeholder="25"></div>
              </div>
              <div><label class="block font-bold mb-1 text-sm">Publication Date</label><input type="date" id="a-pdate" value="${art.publicationDate && !isNaN(new Date(art.publicationDate)) ? new Date(art.publicationDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}" class="w-full p-3 border rounded-xl"></div>
              <div>
                <label class="block font-bold mb-1 text-sm">Maqola PDF fayli</label>
                <div class="flex items-center gap-2">
                  <input type="file" id="a-pdf" class="flex-1 p-2 border rounded-xl text-xs">
                  <button type="button" onclick="document.getElementById('a-pdf').value=''" class="bg-red-100 text-red-500 p-2 rounded-xl hover:bg-red-200" title="Faylni tozalash">✕</button>
                </div>
              </div>
           </div>
        </div>

        <div class="space-y-6">
           <div class="flex justify-between items-center border-b pb-2">
              <h3 class="text-lg font-bold flex items-center gap-2 text-primary">👥 Mualliflar</h3>
              <button type="button" onclick="window.addAuthorField()" class="bg-accent text-white px-4 py-1.5 rounded-full text-xs font-bold hover:opacity-90">+ Muallif qo'shish</button>
           </div>
           <div id="author-fields" class="space-y-4">
              ${art.authors.map((auth, idx) => `
                <div class="author-row grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-slate-50 rounded-2xl relative border border-slate-100">
                  ${idx>0?`<button type="button" onclick="this.parentElement.remove()" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs shadow-md">×</button>`:''}
                  <div><label class="text-[10px] font-bold text-gray-400 uppercase">To'liq Ismi</label><input placeholder="Full Name" value="${auth.fullName}" required class="a-auth-name w-full p-2.5 border rounded-lg mt-1"></div>
                  <div><label class="text-[10px] font-bold text-gray-400 uppercase">Email</label><input placeholder="Email" value="${auth.email || ''}" class="a-auth-email w-full p-2.5 border rounded-lg mt-1"></div>
                  <div><label class="text-[10px] font-bold text-gray-400 uppercase">Ish joyi (Affiliation)</label><input placeholder="University / Organization" value="${auth.affiliation || ''}" class="a-auth-aff w-full p-2.5 border rounded-lg mt-1"></div>
                  <div><label class="text-[10px] font-bold text-gray-400 uppercase">ORCID</label><input placeholder="0000-0000-0000-0000" value="${auth.orcid || ''}" class="a-auth-orcid w-full p-2.5 border rounded-lg mt-1"></div>
                  <div><label class="text-[10px] font-bold text-gray-400 uppercase">Phone Number</label><input placeholder="+998 90..." value="${auth.phone || ''}" class="a-auth-phone w-full p-2.5 border rounded-lg mt-1"></div>
                </div>
              `).join('')}
           </div>
        </div>

        <div class="space-y-6">
           <h3 class="text-lg font-bold border-b pb-2 text-primary">📄 Annotatsiya va Adabiyotlar</h3>
           <div><label class="block font-bold mb-1 text-sm">Abstract</label><textarea id="a-abstract" rows="6" required class="w-full p-4 border rounded-2xl">${art.abstract}</textarea></div>
           <div><label class="block font-bold mb-1 text-sm">Kalit so'zlar (Keywords - vergul bilan ajrating)</label><input id="a-keywords" value="${art.keywords || ''}" placeholder="AI, Quantum Physics, Healthcare..." class="w-full p-3 border rounded-xl"></div>
           <div><label class="block font-bold mb-1 text-sm">References (Har birini yangi qatordan yozing)</label><textarea id="a-refs" rows="8" class="w-full p-4 border rounded-2xl" placeholder="1. Smith, J. (2023)...">${Array.isArray(art.references) ? art.references.join('\n') : art.references || ''}</textarea></div>
        </div>

        <button type="submit" class="btn-primary w-full py-5 text-xl shadow-xl shadow-primary/20">Saqlash va Nashr etish</button>
      </form>`;
  } else if (path === '/admin/announcements') {
    return `<div class="flex justify-between items-center mb-8"><h1 class="text-3xl font-bold">E'lonlar</h1><button onclick="window.msje_navigate('/admin/announcement/new')" class="btn-primary">+ Yangi E'lon</button></div>
      <div class="bg-white rounded-xl border overflow-hidden shadow-sm"><table class="w-full text-left"><thead class="bg-slate-50 border-b"><tr><th class="p-4">Sarlavha</th><th class="p-4 text-center">Amallar</th></tr></thead><tbody>
        ${announcements.map(ann => `<tr class="border-b"> <td class="p-4 font-bold">${ann.title}</td><td class="p-4 text-center">
          <button onclick="window.msje_navigate('/admin/announcement/edit?id=${ann.id}')" class="inline-flex items-center gap-1.5 text-accent hover:text-white border border-accent/20 hover:bg-accent px-4 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95">
            Tahrirlash
          </button>
          <button onclick="window.deleteAnnouncement('${ann.id}')" class="inline-flex items-center gap-1.5 text-red-500 hover:text-white border border-red-100 hover:bg-red-500 px-4 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95 ml-2">
            O'chirish
          </button></td></tr>`).join('')}
      </tbody></table></div>`;
  } else if (path === '/admin/announcement/new' || path === '/admin/announcement/edit') {
    const id = params.get('id');
    const ann = announcements.find(a => a.id === id) || { title: '', content: '' };
    return `<h1 class="text-3xl font-bold mb-8">E'lonni Boshqarish</h1><form id="ann-form" class="bg-white p-8 border rounded-xl space-y-6 max-w-2xl">
      <input type="hidden" id="ann-id" value="${id || ''}">
      <div><label class="block font-bold mb-1">Sarlavha</label><input id="ann-title" value="${ann.title}" required class="w-full p-3 border rounded"></div>
      <div><label class="block font-bold mb-1">Matn</label><textarea id="ann-content" rows="4" class="w-full p-3 border rounded">${ann.content}</textarea></div>
      <button type="submit" class="btn-primary w-full py-4 font-bold">Saqlash</button></form>`;
  } else if (path === '/admin/settings') {
    return `<h1 class="text-3xl font-bold mb-8">Sozlamalar</h1><form id="settings-form" class="bg-white p-8 border rounded-xl space-y-6">
        <div class="grid grid-cols-2 gap-6">
           <div><label class="block font-bold mb-1">Jurnal Nomi</label><input id="s-name" value="${siteInfo.name}" required class="w-full p-3 border rounded"></div>
           <div><label class="block font-bold mb-1">Qisqa Nomi</label><input id="s-short" value="${siteInfo.shortName}" required class="w-full p-3 border rounded"></div>
           <div><label class="block font-bold mb-1">ISSN</label><input id="s-issn" value="${siteInfo.issn}" required class="w-full p-3 border rounded"></div>
           <div><label class="block font-bold mb-1">Email</label><input id="s-email" value="${siteInfo.email}" required class="w-full p-3 border rounded"></div>
        </div>
        <button type="submit" class="btn-primary w-full py-4 font-bold">Saqlash</button></form>`;
  }
  return `404`;
}

function attachAdminEvents(path, params) {
  const setForm = document.getElementById('settings-form');
  if (setForm) {
    setForm.onsubmit = async (e) => {
      e.preventDefault();
      siteInfo.name = document.getElementById('s-name').value;
      siteInfo.shortName = document.getElementById('s-short').value;
      siteInfo.issn = document.getElementById('s-issn').value;
      siteInfo.email = document.getElementById('s-email').value;
      const dbData = {
        id: 'settings',
        name: siteInfo.name,
        short_name: siteInfo.shortName,
        issn: siteInfo.issn,
        email: siteInfo.email,
        description: siteInfo.description,
        address: siteInfo.address,
        phone: siteInfo.phone,
        tagline: siteInfo.tagline,
        submission_info: siteInfo.submissionInfo,
        deadline: siteInfo.deadline
      };
      const success = await saveState('site_info', dbData);
      if (success) {
        alert('Saqlandi');
        handleRoute();
      }
    };
  }

  const annForm = document.getElementById('ann-form');
  if (annForm) {
    annForm.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('ann-id').value;
      const data = { id: id || 'ann-' + Date.now(), title: document.getElementById('ann-title').value, content: document.getElementById('ann-content').value, date: new Date().toLocaleDateString() };
      if (id) announcements = announcements.map(a => a.id === id ? data : a); else announcements.unshift(data);
      const success = await saveState('announcements', data);
      if (success) navigate('/admin/announcements');
    };
  }

  const issueForm = document.getElementById('issue-form');
  if (issueForm) {
    issueForm.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('i-id').value;
      const fileInput = document.getElementById('i-cover-file');
      let coverPath = document.getElementById('i-cover-url').value;
      if (fileInput && fileInput.files[0]) {
        const file = fileInput.files[0];
        const { data, error } = await supabase.storage.from('pdfs').upload('covers/' + Date.now() + '-' + file.name, file);
        if (error) throw error;
        coverPath = supabaseUrl + '/storage/v1/object/public/pdfs/' + data.path;
      }
      const data = { id: id || 'iss-' + Date.now(), volume: document.getElementById('i-vol').value, issueNumber: document.getElementById('i-num').value, year: document.getElementById('i-year').value, month: document.getElementById('i-month').value, cover: coverPath || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80' };
      if (id) issues = issues.map(i => i.id === id ? data : i); else issues.unshift(data);
      const success = await saveState('issues', data);
      if (success) navigate('/admin/issues');
    };
  }

  const artForm = document.getElementById('article-form');
  if (artForm) {
    artForm.onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      const originalBtnText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="flex items-center justify-center gap-3"><svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Fayl yuklanmoqda...</span>`;

      try {
        const id = document.getElementById('a-id').value;
        const art = articles.find(a => a.id === id) || {};
        let pdfPath = art.pdfPath || 'uploads/sample.pdf';
        const fileInput = document.getElementById('a-pdf');
        const file = fileInput.files[0];
        if (file) {
          const { data, error } = await supabase.storage.from('pdfs').upload('articles/' + Date.now() + '-' + file.name, file);
          if (error) throw error;
          pdfPath = supabaseUrl + '/storage/v1/object/public/pdfs/' + data.path;
        }

        const authorList = Array.from(document.querySelectorAll('.author-row')).map(row => ({ 
          fullName: row.querySelector('.a-auth-name').value, 
          email: row.querySelector('.a-auth-email').value,
          affiliation: row.querySelector('.a-auth-aff').value,
          orcid: row.querySelector('.a-auth-orcid').value,
          phone: row.querySelector('.a-auth-phone').value
        }));

        const refList = document.getElementById('a-refs').value.split('\n').filter(r => r.trim() !== '');
        const data = { 
          id: id || 'art-' + Date.now(), 
          title: document.getElementById('a-title').value, 
          issue_id: document.getElementById('a-issue').value, 
          doi: document.getElementById('a-doi').value, 
          first_page: document.getElementById('a-fpage').value,
          last_page: document.getElementById('a-lpage').value,
          keywords: document.getElementById('a-keywords').value,
          type: document.getElementById('a-type').value, 
          abstract: document.getElementById('a-abstract').value, 
          references: refList, 
          authors: authorList, 
          publication_date: document.getElementById('a-pdate').value, 
          pdf_path: pdfPath 
        };

        if (id) articles = articles.map(a => a.id === id ? { ...data, issueId: data.issue_id, firstPage: data.first_page, lastPage: data.last_page, publicationDate: data.publication_date, pdfPath: data.pdf_path } : a);
        else articles.unshift({ ...data, issueId: data.issue_id, firstPage: data.first_page, lastPage: data.last_page, publicationDate: data.publication_date, pdfPath: data.pdf_path });

        const success = await saveState('articles', data);
        if (success) {
          alert('Maqola muvaffaqiyatli saqlandi va nashr etildi!');
          navigate('/admin/articles');
        }
      } catch (err) {
        console.error('Save error:', err);
        alert('Saqlashda xatolik yuz berdi: ' + err.message);
      } finally {
        btn.disabled = false; btn.innerHTML = originalBtnText;
      }
    };
  }
}

// --- Global functions ---
const deleteFromServer = async (filePath) => {
  if (!filePath || !filePath.includes('/storage/v1/object/public/pdfs/')) return;
  try {
    const pathInBucket = filePath.split('/storage/v1/object/public/pdfs/')[1];
    const { error } = await supabase.storage.from('pdfs').remove([pathInBucket]);
    if (error) throw error;
  } catch (e) { console.error('Error deleting file:', e); }
};

window.deleteIssue = async (id) => {
  if (confirm('Ushbu nashr va uning muqovasi o\'chirilsinmi?')) {
    const iss = issues.find(i => i.id === id);
    if (iss) await deleteFromServer(iss.cover);
    issues = issues.filter(i => i.id !== id);
    await supabase.from('issues').delete().eq('id', id);
    handleRoute();
  }
};

window.deleteArticle = async (id) => {
  if (confirm('Ushbu maqola va uning PDF fayli o\'chirilsinmi?')) {
    const art = articles.find(a => a.id === id);
    if (art) await deleteFromServer(art.pdfPath);
    articles = articles.filter(a => a.id !== id);
    await supabase.from('articles').delete().eq('id', id);
    handleRoute();
  }
};

window.deleteAnnouncement = async (id) => {
  if (confirm('Ushbu e\'lon o\'chirilsinmi?')) {
    announcements = announcements.filter(a => a.id !== id);
    await supabase.from('announcements').delete().eq('id', id);
    handleRoute();
  }
};

window.deleteSubmission = async (id) => {
  if (confirm('Ushbu ariza va uning fayli o\'chirilsinmi?')) {
    const sub = submissions.find(s => s.id === id);
    if (sub) await deleteFromServer(sub.filePath);
    submissions = submissions.filter(s => s.id !== id);
    await supabase.from('submissions').delete().eq('id', id);
    handleRoute();
  }
};

window.addAuthorField = () => {
  const container = document.getElementById('author-fields'); const div = document.createElement('div');
  div.className = 'author-row grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-slate-50 rounded-2xl relative border border-slate-100';
  div.innerHTML = `
    <button type="button" onclick="this.parentElement.remove()" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs shadow-md">×</button>
    <div><label class="text-[10px] font-bold text-gray-400 uppercase">To'liq Ismi</label><input placeholder="Full Name" required class="a-auth-name w-full p-2.5 border rounded-lg mt-1"></div>
    <div><label class="text-[10px] font-bold text-gray-400 uppercase">Email</label><input placeholder="Email" class="a-auth-email w-full p-2.5 border rounded-lg mt-1"></div>
    <div><label class="text-[10px] font-bold text-gray-400 uppercase">Ish joyi (Affiliation)</label><input placeholder="University / Organization" class="a-auth-aff w-full p-2.5 border rounded-lg mt-1"></div>
    <div><label class="text-[10px] font-bold text-gray-400 uppercase">ORCID</label><input placeholder="0000-0000-0000-0000" class="a-auth-orcid w-full p-2.5 border rounded-lg mt-1"></div>
    <div><label class="text-[10px] font-bold text-gray-400 uppercase">Phone Number</label><input placeholder="+998 90..." class="a-auth-phone w-full p-2.5 border rounded-lg mt-1"></div>
  `;
  container.appendChild(div);
};
window.togglePdfViewer = () => { const c = document.getElementById('pdf-viewer-container'); if (c) c.classList.toggle('hidden'); };
window.copyCitation = () => {
  const text = document.getElementById('citation-text').innerText;
  navigator.clipboard.writeText(text).then(() => {
    alert('Citation copied to clipboard!');
  });
};

// --- Neural Network Background Engine ---
function initNeuralBackground() {
  const canvas = document.createElement('canvas');
  canvas.id = 'bg-canvas';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let particles = [];
  let mouse = { x: null, y: null, radius: 150 };

  window.addEventListener('mousemove', (e) => { mouse.x = e.x; mouse.y = e.y; });
  window.addEventListener('resize', () => { resizeCanvas(); initParticles(); });

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  class Particle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 2 + 0.5;
      this.baseX = this.x;
      this.baseY = this.y;
      this.density = (Math.random() * 30) + 1;
      this.velocity = { x: (Math.random() - 0.5) * 0.3, y: (Math.random() - 0.5) * 0.3 };
    }
    draw() {
      ctx.fillStyle = 'rgba(45, 212, 191, 0.4)'; // Cyan/Teal glow
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    }
    update() {
      this.x += this.velocity.x;
      this.y += this.velocity.y;
      if (this.x > canvas.width) this.x = 0; else if (this.x < 0) this.x = canvas.width;
      if (this.y > canvas.height) this.y = 0; else if (this.y < 0) this.y = canvas.height;

      let dx = mouse.x - this.x;
      let dy = mouse.y - this.y;
      let distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < mouse.radius) {
        const forceDirectionX = dx / distance;
        const forceDirectionY = dy / distance;
        const force = (mouse.radius - distance) / mouse.radius;
        const directionX = forceDirectionX * force * 5;
        const directionY = forceDirectionY * force * 5;
        this.x -= directionX;
        this.y -= directionY;
      }
    }
  }

  function initParticles() {
    particles = [];
    let numberOfParticles = (canvas.width * canvas.height) / 10000;
    for (let i = 0; i < numberOfParticles; i++) {
      particles.push(new Particle());
    }
  }

  function connect() {
    for (let a = 0; a < particles.length; a++) {
      for (let b = a; b < particles.length; b++) {
        let dx = particles[a].x - particles[b].x;
        let dy = particles[a].y - particles[b].y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 150) {
          let opacity = 1 - (distance / 150);
          ctx.strokeStyle = `rgba(45, 212, 191, ${opacity * 0.2})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(particles[a].x, particles[a].y);
          ctx.lineTo(particles[b].x, particles[b].y);
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
      particles[i].draw();
      particles[i].update();
    }
    connect();
    requestAnimationFrame(animate);
  }

  resizeCanvas();
  initParticles();
  animate();
}

initNeuralBackground();
loadData();

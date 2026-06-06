import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lmhqneinkzpxfhahvcvx.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtaHFuZWlua3pweGZoYWh2Y3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDY2NDMsImV4cCI6MjA5MjYyMjY0M30.gF5LkfzuDFywZ7iFJh5kEqwaCpu91ixrIHPBa_YxxL4';
const supabase = createClient(supabaseUrl, supabaseKey);

function cleanHomoglyphs(text) {
  if (typeof text !== 'string') return text;
  
  const homoglyphs = {
    // Uppercase
    '\u0410': 'A', // Cyrillic А
    '\u0412': 'B', // Cyrillic В
    '\u0421': 'C', // Cyrillic С
    '\u0415': 'E', // Cyrillic Е
    '\u041d': 'H', // Cyrillic Н
    '\u0406': 'I', // Cyrillic І
    '\u041a': 'K', // Cyrillic К
    '\u041c': 'M', // Cyrillic М
    '\u041e': 'O', // Cyrillic О
    '\u0420': 'P', // Cyrillic Р
    '\u0422': 'T', // Cyrillic Т
    '\u0425': 'X', // Cyrillic Х
    '\u04AE': 'Y', // Cyrillic Ү
    '\u0405': 'S', // Cyrillic Ѕ
    
    // Lowercase
    '\u0430': 'a', // Cyrillic а
    '\u0441': 'c', // Cyrillic с
    '\u0435': 'e', // Cyrillic е
    '\u0456': 'i', // Cyrillic і
    '\u043e': 'o', // Cyrillic о
    '\u0440': 'p', // Cyrillic р
    '\u0445': 'x', // Cyrillic х
    '\u0443': 'y', // Cyrillic у
    '\u04af': 'y', // Cyrillic ү
    '\u0455': 's', // Cyrillic ѕ
    
    // Punctuation & other characters
    '\u2013': '-', // En-dash –
    '\u2014': '-', // Em-dash —
    '\u201c': '"', // Smart double quote open “
    '\u201d': '"', // Smart double quote close ”
    '\u2018': "'", // Smart single quote open ‘
    '\u2019': "'", // Smart single quote close ’
    '\u00a0': ' ', // Non-breaking space
  };

  return text.split('').map(char => homoglyphs[char] || char).join('');
}


export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const file = req.query.file || '';
  console.log("Requested RePEc file:", file);

  try {
    const { data: sInfo } = await supabase.from('site_info').select('*').single();
    const { data: articles } = await supabase.from('articles').select('*');
    const { data: issues } = await supabase.from('issues').select('*');

    const email = sInfo?.email || 'info@synoptic.uz';
    const siteUrl = 'https://synoptic-journal.vercel.app';

    // 1. Root Archive Index
    if (file === '' || file === '/' || file === 'snp' || file === 'snp/' || file === 'snp/index.html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(`
        <html>
        <body>
          <h1>RePEc Archive: snp</h1>
          <ul>
            <li><a href="snparch.rdf">snparch.rdf</a> (Archive Template)</li>
            <li><a href="snpseri.rdf">snpseri.rdf</a> (Series Template)</li>
            <li><a href="journl/">journl/</a> (Subdirectory for Articles)</li>
          </ul>
        </body>
        </html>
      `);
    }

    // 2. Archive Template
    if (file === 'snp/snparch.rdf') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(`Template-type: ReDIF-Archive 1.0
Handle: RePEc:snp
Name: Synoptic Journal Archive
Maintainer-Name: Editor
Maintainer-Email: ${email}
Description: This archive collects articles from Synoptic: International Journal of Multidisciplinary Research.
URL: ${siteUrl}/repec/snp/
`);
    }

    // 3. Series Template
    if (file === 'snp/snpseri.rdf') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(`Template-type: ReDIF-Series 1.0
Name: Synoptic: International Journal of Multidisciplinary Research
Provider-Name: Synoptic Publisher
Provider-Homepage: ${siteUrl}/
Maintainer-Name: Editor
Maintainer-Email: ${email}
Type: ReDIF-Article
Handle: RePEc:snp:journl
`);
    }

    // 4. Subdirectory Index (journl/)
    // Switch links to .redif so RePEc parses them as UTF-8 (Unicode) and resolves Windows-1252 character warnings!
    if (file === 'snp/journl' || file === 'snp/journl/' || file === 'snp/journl/index.html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      let links = (articles || []).map(art => `<li><a href="${art.id}.redif">${art.id}.redif</a></li>`).join('');
      return res.status(200).send(`
        <html>
        <body>
          <h1>Series: journl</h1>
          <ul>
            ${links}
          </ul>
        </body>
        </html>
      `);
    }

    // 5. Article Templates (Support both legacy .rdf and modern .redif)
    if (file.startsWith('snp/journl/') && (file.endsWith('.redif') || file.endsWith('.rdf'))) {
      const artId = file.split('/').pop().replace(/\.redif|\.rdf/, '');
      const art = (articles || []).find(a => a.id === artId);
      
      if (!art) {
        return res.status(404).send('Article not found');
      }

      const issue = (issues || []).find(i => i.id === (art.issue_id || art.issueId)) || {};
      
      let rdf = `Template-Type: ReDIF-Article 1.0\n`;
      rdf += `Title: ${cleanHomoglyphs(art.title || '')}\n`;
      
      const authors = art.authors || [];
      authors.forEach(a => {
        rdf += `Author-Name: ${cleanHomoglyphs(a.fullName || '')}\n`;
        if (a.email) rdf += `Author-Email: ${a.email}\n`;
        if (a.affiliation) rdf += `Author-Workplace-Name: ${cleanHomoglyphs(a.affiliation || '')}\n`;
      });
      
      if (art.abstract) rdf += `Abstract: ${cleanHomoglyphs(art.abstract.replace(/\r?\n/g, ' ') || '')}\n`;
      if (art.keywords) rdf += `Keywords: ${cleanHomoglyphs(art.keywords || '')}\n`;
      
      let pubDate = art.publication_date || art.publicationDate || '';
      if (pubDate.includes('.')) pubDate = pubDate.replace(/\./g, '-');
      if (pubDate.includes('/')) pubDate = pubDate.replace(/\//g, '-');
      
      rdf += `Creation-Date: ${pubDate || '2026'}\n`;
      rdf += `Journal: Synoptic: International Journal of Multidisciplinary Research\n`;
      rdf += `Volume: ${issue.volume || '1'}\n`;
      rdf += `Issue: ${issue.issue_number || issue.issueNumber || issue.issuenumber || '1'}\n`;
      if (art.first_page || art.firstPage) rdf += `Pages: ${(art.first_page || art.firstPage)}-${(art.last_page || art.lastPage)}\n`;
      
      let pdfPath = art.pdf_path || art.pdfPath;
      if (pdfPath && !pdfPath.startsWith('http')) {
        pdfPath = `${supabaseUrl}/storage/v1/object/public/pdfs/${pdfPath}`;
      }
      if (pdfPath) {
        rdf += `File-URL: ${pdfPath}\n`;
        rdf += `File-Format: Application/pdf\n`;
      }
      

      rdf += `Handle: RePEc:snp:journl:${art.id}\n`;

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(rdf);
    }

    res.status(404).send('Not Found');

  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating ReDIF');
  }
}

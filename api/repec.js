import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lmhqneinkzpxfhahvcvx.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtaHFuZWlua3pweGZoYWh2Y3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDY2NDMsImV4cCI6MjA5MjYyMjY0M30.gF5LkfzuDFywZ7iFJh5kEqwaCpu91ixrIHPBa_YxxL4';
const supabase = createClient(supabaseUrl, supabaseKey);

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
            <li><a href="/repec/snp/snparch.rdf">snparch.rdf</a> (Archive Template)</li>
            <li><a href="/repec/snp/snpseri.rdf">snpseri.rdf</a> (Series Template)</li>
            <li><a href="/repec/snp/journl/">journl/</a> (Subdirectory for Articles)</li>
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
    if (file === 'snp/journl' || file === 'snp/journl/' || file === 'snp/journl/index.html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      let links = (articles || []).map(art => `<li><a href="/repec/snp/journl/${art.id}.rdf">${art.id}.rdf</a></li>`).join('');
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

    // 5. Article Templates
    if (file.startsWith('snp/journl/') && file.endsWith('.rdf')) {
      const artId = file.split('/').pop().replace('.rdf', '');
      const art = (articles || []).find(a => a.id === artId);
      
      if (!art) {
        return res.status(404).send('Article not found');
      }

      const issue = (issues || []).find(i => i.id === (art.issue_id || art.issueId)) || {};
      
      let rdf = `Template-Type: ReDIF-Article 1.0\n`;
      rdf += `Title: ${art.title}\n`;
      
      const authors = art.authors || [];
      authors.forEach(a => {
        rdf += `Author-Name: ${a.fullName}\n`;
        if (a.email) rdf += `Author-Email: ${a.email}\n`;
        if (a.affiliation) rdf += `Author-Workplace-Name: ${a.affiliation}\n`;
      });
      
      if (art.abstract) rdf += `Abstract: ${art.abstract.replace(/\r?\n/g, ' ')}\n`;
      if (art.keywords) rdf += `Keywords: ${art.keywords}\n`;
      
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

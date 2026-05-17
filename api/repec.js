import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lmhqneinkzpxfhahvcvx.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtaHFuZWlua3pweGZoYWh2Y3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDY2NDMsImV4cCI6MjA5MjYyMjY0M30.gF5LkfzuDFywZ7iFJh5kEqwaCpu91ixrIHPBa_YxxL4';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');

  try {
    const { data: sInfo } = await supabase.from('site_info').select('*').single();
    const { data: articles } = await supabase.from('articles').select('*');
    const { data: issues } = await supabase.from('issues').select('*');

    let rdf = '';
    
    // Archive Template
    rdf += `Template-type: ReDIF-Archive 1.0\n`;
    rdf += `Handle: RePEc:snp\n`;
    rdf += `Name: Synoptic Journal Archive\n`;
    rdf += `Maintainer-Name: Editor\n`;
    rdf += `Maintainer-Email: ${sInfo?.email || 'editor@synoptic-journal.com'}\n`;
    rdf += `Description: This archive collects articles from Synoptic: International Journal of Multidisciplinary Research.\n`;
    rdf += `URL: https://synoptic-journal.vercel.app/\n\n`;

    // Series Template
    rdf += `Template-type: ReDIF-Series 1.0\n`;
    rdf += `Name: Synoptic: International Journal of Multidisciplinary Research\n`;
    rdf += `Provider-Name: Synoptic Publisher\n`;
    rdf += `Provider-Homepage: https://synoptic-journal.vercel.app/\n`;
    rdf += `Maintainer-Name: Editor\n`;
    rdf += `Maintainer-Email: ${sInfo?.email || 'editor@synoptic-journal.com'}\n`;
    rdf += `Type: ReDIF-Article\n`;
    rdf += `Handle: RePEc:snp:journl\n\n`;

    if (articles && articles.length > 0) {
      articles.forEach(art => {
        const issue = (issues || []).find(i => i.id === (art.issue_id || art.issueId)) || {};
        rdf += `Template-Type: ReDIF-Article 1.0\n`;
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
        
        rdf += `Handle: RePEc:snp:journl:${art.id}\n\n`;
      });
    }
    
    res.status(200).send(rdf);

  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating ReDIF');
  }
}

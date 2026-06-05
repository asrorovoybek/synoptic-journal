import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://lmhqneinkzpxfhahvcvx.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtaHFuZWlua3pweGZoYWh2Y3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDY2NDMsImV4cCI6MjA5MjYyMjY0M30.gF5LkfzuDFywZ7iFJh5kEqwaCpu91ixrIHPBa_YxxL4';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  const { id } = req.query;

  // If no ID, just serve the normal index.html
  if (!id) {
    let indexPath = path.join(process.cwd(), 'dist', 'index.html');
    if (!fs.existsSync(indexPath)) indexPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(indexPath, 'utf-8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  }

  try {
    const { data: art } = await supabase.from('articles').select('*').eq('id', id).single();
    const { data: sInfo } = await supabase.from('site_info').select('*').single();
    
    if (!art) {
      let indexPath = path.join(process.cwd(), 'dist', 'index.html');
      if (!fs.existsSync(indexPath)) indexPath = path.join(process.cwd(), 'index.html');
      const html = fs.readFileSync(indexPath, 'utf-8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    }

    const { data: issue } = await supabase.from('issues').select('*').eq('id', art.issue_id || art.issueId).single();

    // Prepare references
    let refsArray = [];
    if (art.refs) {
      if (typeof art.refs === 'string') {
         refsArray = art.refs.split(/\r?\n/).filter(r => r.trim() !== '');
      } else if (Array.isArray(art.refs)) {
         refsArray = art.refs;
      }
    } else if (art.references) {
      if (typeof art.references === 'string') {
         refsArray = art.references.split(/\r?\n/).filter(r => r.trim() !== '');
      } else if (Array.isArray(art.references)) {
         refsArray = art.references;
      }
    }

    // Format date
    let formattedDate = art.publication_date || art.publicationDate || '';
    if (formattedDate) {
      const dateParts = formattedDate.split(/[\.\-\/]/);
      if (dateParts.length === 3) {
        if (dateParts[0].length === 4) formattedDate = `${dateParts[0]}/${dateParts[1]}/${dateParts[2]}`;
        else if (dateParts[2].length === 4) formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
      }
    }

    let pdfPath = art.pdf_path || art.pdfPath;
    if (pdfPath && !pdfPath.startsWith('http')) {
      pdfPath = `${supabaseUrl}/storage/v1/object/public/pdfs/${pdfPath}`;
    }

    const siteName = sInfo?.name || 'Synoptic: International Journal of Multidisciplinary Research';
    const authors = art.authors || [];
    
    let metaTags = `
      <title>${art.title} | ${siteName}</title>
      <meta name="description" content="${(art.abstract || '').replace(/"/g, '&quot;')}">
      <meta name="citation_title" content="${(art.title || '').replace(/"/g, '&quot;')}">
      <meta name="citation_journal_title" content="${siteName}">
      <meta name="citation_volume" content="${issue?.volume || '1'}">
      <meta name="citation_issue" content="${issue?.issue_number || issue?.issueNumber || '1'}">
      <meta name="citation_publication_date" content="${formattedDate}">
      <meta name="citation_date" content="${formattedDate}">
      <meta name="citation_pdf_url" content="${pdfPath}">
      <meta name="citation_abstract_html_url" content="https://${req.headers.host}/article?id=${id}">
      <meta name="citation_language" content="en">
    `;

    if (art.doi) {
      metaTags += `\n      <meta name="citation_doi" content="${art.doi}">`;
    }

    authors.forEach(a => {
      metaTags += `\n      <meta name="citation_author" content="${(a.fullName || '').replace(/"/g, '&quot;')}">`;
      if (a.affiliation) {
        metaTags += `\n      <meta name="citation_author_institution" content="${(a.affiliation || '').replace(/"/g, '&quot;')}">`;
      }
    });

    // Add references as citation_reference tags!
    refsArray.forEach(ref => {
      metaTags += `\n      <meta name="citation_reference" content="${(ref || '').replace(/"/g, '&quot;')}">`;
    });

    // We also generate an HTML-only structure inside a <noscript> block 
    // or a hidden div so crawlers that don't read citation_* tags can parse the HTML directly.
    const refsHtml = refsArray.map(r => `<li>${r}</li>`).join('');
    const authorsHtml = authors.map(a => a.fullName).join(', ');

    const seoContent = `
      <div id="seo-content" style="display: none;">
        <h1>${art.title}</h1>
        <p><strong>Authors:</strong> ${authorsHtml}</p>
        <p><strong>Abstract:</strong> ${art.abstract}</p>
        <h2>References</h2>
        <ol>
          ${refsHtml}
        </ol>
      </div>
    `;

    // Read index.html and inject
    let indexPath = path.join(process.cwd(), 'dist', 'index.html');
    if (!fs.existsSync(indexPath)) indexPath = path.join(process.cwd(), 'index.html');
    let html = fs.readFileSync(indexPath, 'utf-8');
    
    // Inject <meta> tags into <head>
    html = html.replace('</head>', `${metaTags}\n</head>`);
    // Inject SEO content into <body> before <div id="app">
    html = html.replace('<div id="app">', `${seoContent}\n<div id="app">`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);

  } catch (error) {
    console.error('Error generating article HTML:', error);
    // Fallback to normal index.html
    let indexPath = path.join(process.cwd(), 'dist', 'index.html');
    if (!fs.existsSync(indexPath)) indexPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(indexPath, 'utf-8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  }
}

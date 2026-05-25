import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lmhqneinkzpxfhahvcvx.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtaHFuZWlua3pweGZoYWh2Y3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDY2NDMsImV4cCI6MjA5MjYyMjY0M30.gF5LkfzuDFywZ7iFJh5kEqwaCpu91ixrIHPBa_YxxL4';
const supabase = createClient(supabaseUrl, supabaseKey);

function xmlEscape(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function oaiError(code, message, verb, requestUrl) {
  const responseDate = new Date().toISOString().split('.')[0] + 'Z';
  const verbAttr = verb ? ` verb="${xmlEscape(verb)}"` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${responseDate}</responseDate>
  <request${verbAttr}>${requestUrl}</request>
  <error code="${code}">${xmlEscape(message)}</error>
</OAI-PMH>`;
}

function getRecordMetadataXml(art, siteUrl, supabaseUrl) {
  let dcXml = `
      <oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/"
                 xmlns:dc="http://purl.org/dc/elements/1.1/"
                 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd">
        <dc:title>${xmlEscape(art.title || '')}</dc:title>`;

  const authors = art.authors || [];
  authors.forEach(a => {
    dcXml += `\n        <dc:creator>${xmlEscape(a.fullName || '')}</dc:creator>`;
  });

  if (art.keywords) {
    const kwList = art.keywords.split(',').map(k => k.trim());
    kwList.forEach(k => {
      dcXml += `\n        <dc:subject>${xmlEscape(k)}</dc:subject>`;
    });
  }

  if (art.abstract) {
    dcXml += `\n        <dc:description>${xmlEscape(art.abstract.replace(/\r?\n/g, ' ') || '')}</dc:description>`;
  }

  dcXml += `\n        <dc:publisher>Synoptic Publisher</dc:publisher>`;
  
  let pubDate = art.publication_date || art.publicationDate || '2026-04-01';
  if (pubDate.includes('.')) pubDate = pubDate.replace(/\./g, '-');
  if (pubDate.includes('/')) pubDate = pubDate.replace(/\//g, '-');
  dcXml += `\n        <dc:date>${xmlEscape(pubDate)}</dc:date>`;
  
  dcXml += `\n        <dc:type>info:eu-repo/semantics/article</dc:type>`;
  dcXml += `\n        <dc:format>application/pdf</dc:format>`;
  
  // Article detail page URL
  dcXml += `\n        <dc:identifier>${siteUrl}/article/${art.id}</dc:identifier>`;
  
  // PDF download URL
  let pdfPath = art.pdf_path || art.pdfPath;
  if (pdfPath && !pdfPath.startsWith('http')) {
    pdfPath = `${supabaseUrl}/storage/v1/object/public/pdfs/${pdfPath}`;
  }
  if (pdfPath) {
    dcXml += `\n        <dc:identifier>${xmlEscape(pdfPath)}</dc:identifier>`;
  }
  
  dcXml += `\n        <dc:language>eng</dc:language>`;
  dcXml += `\n        <dc:rights>info:eu-repo/semantics/openAccess</dc:rights>`;
  dcXml += `\n      </oai_dc:dc>`;
  
  return dcXml;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/xml; charset=utf-8');

  const siteUrl = 'https://synoptic-journal.vercel.app';
  const requestUrl = `${siteUrl}/oai`;
  const responseDate = new Date().toISOString().split('.')[0] + 'Z';

  const { verb, metadataPrefix, identifier, set } = req.query;

  // Validate verb
  const validVerbs = ['Identify', 'ListMetadataFormats', 'ListSets', 'ListIdentifiers', 'ListRecords', 'GetRecord'];
  if (!verb) {
    return res.status(200).send(oaiError('badVerb', 'Missing verb parameter', null, requestUrl));
  }
  if (!validVerbs.includes(verb)) {
    return res.status(200).send(oaiError('badVerb', `Illegal verb: ${verb}`, null, requestUrl));
  }

  try {
    const { data: sInfo } = await supabase.from('site_info').select('*').single();
    const { data: articles } = await supabase.from('articles').select('*');

    const email = sInfo?.email || 'info@synoptic.uz';
    const repoName = 'Synoptic: International Journal of Multidisciplinary Research';

    // 1. Identify
    if (verb === 'Identify') {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${responseDate}</responseDate>
  <request verb="Identify">${requestUrl}</request>
  <Identify>
    <repositoryName>${xmlEscape(repoName)}</repositoryName>
    <baseURL>${requestUrl}</baseURL>
    <protocolVersion>2.0</protocolVersion>
    <adminEmail>${xmlEscape(email)}</adminEmail>
    <earliestDatestamp>2026-04-01T00:00:00Z</earliestDatestamp>
    <deletedRecord>no</deletedRecord>
    <granularity>YYYY-MM-DDThh:mm:ssZ</granularity>
  </Identify>
</OAI-PMH>`;
      return res.status(200).send(xml);
    }

    // 2. ListMetadataFormats
    if (verb === 'ListMetadataFormats') {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${responseDate}</responseDate>
  <request verb="ListMetadataFormats">${requestUrl}</request>
  <ListMetadataFormats>
    <metadataFormat>
      <metadataPrefix>oai_dc</metadataPrefix>
      <schema>http://www.openarchives.org/OAI/2.0/oai_dc.xsd</schema>
      <metadataNamespace>http://www.openarchives.org/OAI/2.0/oai_dc/</metadataNamespace>
    </metadataFormat>
  </ListMetadataFormats>
</OAI-PMH>`;
      return res.status(200).send(xml);
    }

    // 3. ListSets
    if (verb === 'ListSets') {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${responseDate}</responseDate>
  <request verb="ListSets">${requestUrl}</request>
  <ListSets>
    <set>
      <setSpec>journl</setSpec>
      <setName>Synoptic Journal Articles</setName>
    </set>
  </ListSets>
</OAI-PMH>`;
      return res.status(200).send(xml);
    }

    // 4. ListIdentifiers
    if (verb === 'ListIdentifiers') {
      if (!metadataPrefix) {
        return res.status(200).send(oaiError('badArgument', 'Missing metadataPrefix parameter', verb, requestUrl));
      }
      if (metadataPrefix !== 'oai_dc') {
        return res.status(200).send(oaiError('cannotDisseminateFormat', `Format not supported: ${metadataPrefix}`, verb, requestUrl));
      }

      let recordsXml = '';
      (articles || []).forEach(art => {
        const datestamp = art.created_at ? new Date(art.created_at).toISOString().split('.')[0] + 'Z' : '2026-04-01T00:00:00Z';
        recordsXml += `
    <header>
      <identifier>oai:synoptic:${art.id}</identifier>
      <datestamp>${datestamp}</datestamp>
      <setSpec>journl</setSpec>
    </header>`;
      });

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${responseDate}</responseDate>
  <request verb="ListIdentifiers" metadataPrefix="${xmlEscape(metadataPrefix)}">${requestUrl}</request>
  <ListIdentifiers>${recordsXml}
  </ListIdentifiers>
</OAI-PMH>`;
      return res.status(200).send(xml);
    }

    // 5. ListRecords
    if (verb === 'ListRecords') {
      if (!metadataPrefix) {
        return res.status(200).send(oaiError('badArgument', 'Missing metadataPrefix parameter', verb, requestUrl));
      }
      if (metadataPrefix !== 'oai_dc') {
        return res.status(200).send(oaiError('cannotDisseminateFormat', `Format not supported: ${metadataPrefix}`, verb, requestUrl));
      }

      let recordsXml = '';
      (articles || []).forEach(art => {
        const datestamp = art.created_at ? new Date(art.created_at).toISOString().split('.')[0] + 'Z' : '2026-04-01T00:00:00Z';
        recordsXml += `
  <record>
    <header>
      <identifier>oai:synoptic:${art.id}</identifier>
      <datestamp>${datestamp}</datestamp>
      <setSpec>journl</setSpec>
    </header>
    <metadata>${getRecordMetadataXml(art, siteUrl, supabaseUrl)}
    </metadata>
  </record>`;
      });

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${responseDate}</responseDate>
  <request verb="ListRecords" metadataPrefix="${xmlEscape(metadataPrefix)}">${requestUrl}</request>
  <ListRecords>${recordsXml}
  </ListRecords>
</OAI-PMH>`;
      return res.status(200).send(xml);
    }

    // 6. GetRecord
    if (verb === 'GetRecord') {
      if (!identifier) {
        return res.status(200).send(oaiError('badArgument', 'Missing identifier parameter', verb, requestUrl));
      }
      if (!metadataPrefix) {
        return res.status(200).send(oaiError('badArgument', 'Missing metadataPrefix parameter', verb, requestUrl));
      }
      if (metadataPrefix !== 'oai_dc') {
        return res.status(200).send(oaiError('cannotDisseminateFormat', `Format not supported: ${metadataPrefix}`, verb, requestUrl));
      }

      const artId = identifier.replace('oai:synoptic:', '');
      const art = (articles || []).find(a => a.id === artId);

      if (!art) {
        return res.status(200).send(oaiError('idDoesNotExist', `Identifier not found: ${identifier}`, verb, requestUrl));
      }

      const datestamp = art.created_at ? new Date(art.created_at).toISOString().split('.')[0] + 'Z' : '2026-04-01T00:00:00Z';
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${responseDate}</responseDate>
  <request verb="GetRecord" identifier="${xmlEscape(identifier)}" metadataPrefix="${xmlEscape(metadataPrefix)}">${requestUrl}</request>
  <GetRecord>
    <record>
      <header>
        <identifier>oai:synoptic:${art.id}</identifier>
        <datestamp>${datestamp}</datestamp>
        <setSpec>journl</setSpec>
      </header>
      <metadata>${getRecordMetadataXml(art, siteUrl, supabaseUrl)}
      </metadata>
    </record>
  </GetRecord>
</OAI-PMH>`;
      return res.status(200).send(xml);
    }

  } catch (error) {
    console.error("OAI-PMH Error:", error);
    return res.status(200).send(oaiError('badArgument', 'Internal server error processing request', verb, requestUrl));
  }
}

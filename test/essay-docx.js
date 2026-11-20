'use strict';
(() => {
  const encoder = new TextEncoder();
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const relationships = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const packageRelationships = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const escapes = {'&': '&amp;', '<': '&lt;', '>': '&gt;'};
  const escapeXml = text => text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/[&<>]/g, character => escapes[character]);

  function crc32(bytes) {
    let value = 0xffffffff;
    for (const byte of bytes) {
      value ^= byte;
      for (let bit = 0; bit < 8; bit++) {
        value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
      }
    }
    return (value ^ 0xffffffff) >>> 0;
  }

  // A DOCX is a ZIP package. Store its small UTF-8 XML parts without compression.
  function zip(parts) {
    const localParts = [];
    const directory = [];
    let offset = 0;
    let directorySize = 0;
    for (const [path, xml] of Object.entries(parts)) {
      const name = encoder.encode(path);
      const data = encoder.encode(xmlHeader + xml);
      const crc = crc32(data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(12, 33, true); // DOS date 1980-01-01
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      localParts.push(local.buffer, name, data);

      const entry = new DataView(new ArrayBuffer(46));
      entry.setUint32(0, 0x02014b50, true);
      entry.setUint16(4, 20, true);
      entry.setUint16(6, 20, true);
      entry.setUint16(14, 33, true);
      entry.setUint32(16, crc, true);
      entry.setUint32(20, data.length, true);
      entry.setUint32(24, data.length, true);
      entry.setUint16(28, name.length, true);
      entry.setUint32(42, offset, true);
      directory.push(entry.buffer, name);

      offset += local.byteLength + name.length + data.length;
      directorySize += entry.byteLength + name.length;
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, directory.length / 2, true);
    end.setUint16(10, directory.length / 2, true);
    end.setUint32(12, directorySize, true);
    end.setUint32(16, offset, true);
    return new Blob([...localParts, ...directory, end.buffer], {type: mimeType});
  }

  function paragraph(text, style = 'Normal') {
    const content = text.split('\t').map(part => `<w:t xml:space="preserve">${escapeXml(part)}</w:t>`).join('<w:tab/>');
    return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r>${content}</w:r></w:p>`;
  }

  function create(question, source, essay) {
    const body = [
      paragraph('Сочинение ЕГЭ по русскому языку', 'Title'),
      paragraph(`Руса Лингво · Задание 27 · ${source}`, 'Metadata'),
      question.problem ? paragraph(question.problem, 'Problem') : '',
      ...essay.split(/\r\n|\r|\n/).map(line => paragraph(line)),
    ].join('');
    const types = {
      document: mimeType.replace('.document', '.document.main+xml'),
      styles: 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml',
    };
    return zip({
      '[Content_Types].xml': `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/word/document.xml" ContentType="${types.document}"/>
        <Override PartName="/word/styles.xml" ContentType="${types.styles}"/>
      </Types>`,
      '_rels/.rels': `<Relationships xmlns="${packageRelationships}">
        <Relationship Id="rId1" Type="${relationships}/officeDocument" Target="word/document.xml"/>
      </Relationships>`,
      'word/document.xml': `<w:document xmlns:w="${word}"><w:body>${body}
        <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>
      </w:body></w:document>`,
      'word/_rels/document.xml.rels': `<Relationships xmlns="${packageRelationships}">
        <Relationship Id="rId1" Type="${relationships}/styles" Target="styles.xml"/>
      </Relationships>`,
      'word/styles.xml': `<w:styles xmlns:w="${word}">
        <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>
          <w:pPr><w:spacing w:after="120" w:line="330" w:lineRule="auto"/></w:pPr>
          <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="24"/><w:lang w:val="ru-RU"/></w:rPr>
        </w:style>
        <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/>
          <w:pPr><w:keepNext/><w:spacing w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/></w:rPr>
        </w:style>
        <w:style w:type="paragraph" w:styleId="Metadata"><w:name w:val="Metadata"/><w:basedOn w:val="Normal"/>
          <w:pPr><w:keepNext/><w:spacing w:after="240"/></w:pPr>
          <w:rPr><w:color w:val="4C4C4C"/><w:sz w:val="20"/></w:rPr>
        </w:style>
        <w:style w:type="paragraph" w:styleId="Problem"><w:name w:val="Problem"/><w:basedOn w:val="Normal"/>
          <w:pPr><w:keepNext/><w:spacing w:after="300"/></w:pPr><w:rPr><w:b/></w:rPr>
        </w:style>
      </w:styles>`,
    });
  }

  function download(question, source, essay) {
    if (!essay.trim()) return;
    const url = URL.createObjectURL(create(question, source, essay));
    const link = document.createElement('a');
    link.href = url;
    link.download = question.essayYear
      ? `sochinenie-${question.essayYear}-variant-${question.source.variant}.docx`
      : `sochinenie-27-${question.displayId}.docx`;
    document.body.append(link);
    try {
      link.click();
    } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  window.EGE_ESSAY_DOCX = {create, download};
})();

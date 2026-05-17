import { type ReactNode } from 'react';

// ── Inline formatting (bold, italic, code) ──────────────────────────────────

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  // Matches **bold**, *italic*, `code` — ordered so ** takes priority over *
  const re = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={m.index}>{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={m.index}>{m[4]}</em>);
    else if (m[5]) parts.push(<code key={m.index}>{m[6]}</code>);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : [text];
}

// ── Block-level markdown parser ────────────────────────────────────────────

export function renderMarkdown(text: string): ReactNode {
  if (!text) return null;

  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block — collect until closing ```
    if (line.trimStart().startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push(
        <pre key={i} className="ai-code-block">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Blank line — paragraph break
    if (!line.trim()) {
      i++;
      continue;
    }

    // Heading (# → h3, ## → h4, etc.)
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length + 2; // #=3 (h3), ##=4 (h4), ###=5 (h5), ####=6 (h6)
      const content = renderInline(headingMatch[2]);
      if (level === 3) blocks.push(<h3 key={i} className="ai-heading">{content}</h3>);
      else if (level === 4) blocks.push(<h4 key={i} className="ai-heading">{content}</h4>);
      else if (level === 5) blocks.push(<h5 key={i} className="ai-heading">{content}</h5>);
      else blocks.push(<h6 key={i} className="ai-heading">{content}</h6>);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line)) {
      blocks.push(<hr key={i} className="ai-hr" />);
      i++;
      continue;
    }

    // Bullet list — collect consecutive items
    const bulletMatch = line.match(/^(\s*)[-*]\s+(?!\*)(.+)$/);
    if (bulletMatch) {
      const items: ReactNode[] = [];
      while (i < lines.length) {
        const bl = lines[i].match(/^(\s*)[-*]\s+(?!\*)(.+)$/);
        if (!bl) break;
        const indent = bl[1].length >= 2;
        items.push(
          <li key={i} className={indent ? 'ai-li-nested' : ''}>
            {renderInline(bl[2])}
          </li>
        );
        i++;
      }
      blocks.push(<ul key={i} className="ai-list">{items}</ul>);
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      const items: ReactNode[] = [];
      while (i < lines.length) {
        const nl = lines[i].match(/^(\d+)\.\s+(.+)$/);
        if (!nl) break;
        items.push(<li key={i}>{renderInline(nl[2])}</li>);
        i++;
      }
      blocks.push(<ol key={i} className="ai-list">{items}</ol>);
      continue;
    }

    // Regular paragraph — collect consecutive non-empty lines
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|[-*]\s+(?!\*)|\d+\.\s+|[-*_]{3,})/.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push(
        <p key={i} className="ai-para">
          {paraLines.map((pl, pi) => (
            <span key={pi}>
              {pi > 0 && <br />}
              {renderInline(pl)}
            </span>
          ))}
        </p>
      );
    }
  }

  return <div className="ai-response">{blocks}</div>;
}

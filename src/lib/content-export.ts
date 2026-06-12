/**
 * Conversores para exportar el contenido (markdown) de un content_item a
 * distintos formatos pegables en herramientas externas:
 *
 *   - exportClientifyHTML(): HTML con estilos INLINE en cada elemento.
 *     Clientify (email editor + landings) no carga CSS externo de forma fiable,
 *     así que inyectamos estilos directamente. Diseñado para email-safe markup
 *     (tablas/párrafos sin clases).
 *
 *   - exportWordPressHTML(): HTML SEMÁNTICO limpio (sin clases ni estilos).
 *     WordPress aplica el tema del sitio, no queremos pisarlo. Usa <h2>/<h3>,
 *     <p>, <ul>, <strong>, <em>, <a>, <img> sin atributos extra.
 *
 *   - exportMarkdown(): el markdown crudo, por si se va a otra app que lo
 *     entiende nativamente (Notion, Linear, etc.).
 *
 *   - exportPlainText(): solo texto sin marcas, para borradores o pegar en
 *     WhatsApp / Slack rápidos.
 *
 * Las funciones aceptan opcionalmente un objeto extra con título, imagen
 * asignada y atribución para enriquecer la salida.
 */

export interface ExportContext {
  title?:       string | null
  imageUrl?:    string | null
  imageAlt?:    string | null
  channel?:     string | null
  authorName?:  string | null
}

// ─── Markdown parser mínimo (sin dependencias externas) ──────────────────

type Block =
  | { kind: 'h1' | 'h2' | 'h3' | 'h4'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'hr' }
  | { kind: 'blockquote'; text: string }

/** Divide el markdown en bloques de párrafos / listas / cabeceras. */
function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trimEnd()

    // Línea vacía → salta
    if (!line.trim()) { i++; continue }

    // Heading 1-4
    const hMatch = /^(#{1,4})\s+(.*)$/.exec(line)
    if (hMatch) {
      const level = hMatch[1].length as 1 | 2 | 3 | 4
      const kind = (`h${level}`) as 'h1' | 'h2' | 'h3' | 'h4'
      blocks.push({ kind, text: hMatch[2].trim() })
      i++
      continue
    }

    // Separador horizontal (---, ***, ___)
    if (/^[-*_]{3,}\s*$/.test(line)) {
      blocks.push({ kind: 'hr' })
      i++
      continue
    }

    // Lista no ordenada
    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s+/, ''))
        i++
      }
      blocks.push({ kind: 'ul', items })
      continue
    }

    // Lista ordenada
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push({ kind: 'ol', items })
      continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const buf: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        buf.push(lines[i].slice(2))
        i++
      }
      blocks.push({ kind: 'blockquote', text: buf.join('\n') })
      continue
    }

    // Párrafo: junta líneas no vacías hasta una vacía
    const buf: string[] = [line]
    i++
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|[-*+]\s|\d+\.\s|>\s|[-*_]{3,}\s*$)/.test(lines[i])) {
      buf.push(lines[i].trimEnd())
      i++
    }
    blocks.push({ kind: 'p', text: buf.join('\n') })
  }
  return blocks
}

/** Procesa inlines (bold, italic, links, code) sobre un fragmento ya escapado. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function applyInlines(text: string, opts: { linkColor?: string } = {}): string {
  let html = escapeHtml(text)
  // [text](url)
  html = html.replace(
    /\[([^\]]+?)\]\(([^)]+?)\)/g,
    (_m, label, url) => {
      const safeUrl = /^(https?:\/\/|mailto:|#|\/)/i.test(url) ? url : '#'
      const styleAttr = opts.linkColor ? ` style="color:${opts.linkColor};text-decoration:underline"` : ''
      return `<a href="${safeUrl}"${styleAttr}>${label}</a>`
    },
  )
  // **bold** y __bold__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')
  // *italic* y _italic_ (no doble guion bajo)
  html = html.replace(/(^|[^*])\*(?!\*)([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')
  html = html.replace(/(^|[^_])_(?!_)([^_\n]+?)_(?!_)/g, '$1<em>$2</em>')
  // `code`
  html = html.replace(/`([^`]+?)`/g, '<code>$1</code>')
  // Saltos de línea internos del párrafo → <br>
  html = html.replace(/\n/g, '<br>')
  return html
}

// ─── Helpers de portada ──────────────────────────────────────────────────

function imageHtmlInline(ctx: ExportContext): string {
  if (!ctx.imageUrl) return ''
  const alt = escapeHtml(ctx.imageAlt ?? ctx.title ?? 'Imagen del contenido')
  return `<p style="margin:0 0 18px 0;"><img src="${escapeHtml(ctx.imageUrl)}" alt="${alt}" style="max-width:100%;height:auto;border-radius:8px;display:block;" /></p>`
}

function imageHtmlSemantic(ctx: ExportContext): string {
  if (!ctx.imageUrl) return ''
  const alt = escapeHtml(ctx.imageAlt ?? ctx.title ?? 'Imagen del contenido')
  return `<figure><img src="${escapeHtml(ctx.imageUrl)}" alt="${alt}" /></figure>`
}

// ─── Exporters públicos ─────────────────────────────────────────────────

/**
 * HTML con estilos INLINE para Clientify (email-safe).
 * Diseñado para pegarse directamente en un editor de Clientify.
 */
export function exportClientifyHTML(markdown: string, ctx: ExportContext = {}): string {
  const linkColor = '#ea580c'  // naranja iGEO
  const baseFont = 'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;color:#111827;line-height:1.6;'
  const wrap = (kind: string, content: string, extra = '') =>
    `<${kind} style="${extra}">${content}</${kind}>`

  const blocks = parseBlocks(markdown)
  const parts: string[] = []

  // Title como H1 si lo hay y no empieza ya el contenido con uno
  if (ctx.title && !(blocks[0]?.kind === 'h1')) {
    parts.push(`<h1 style="${baseFont}font-size:24px;font-weight:700;margin:0 0 16px 0;line-height:1.25;">${escapeHtml(ctx.title)}</h1>`)
  }

  // Imagen primero si existe
  parts.push(imageHtmlInline(ctx))

  for (const b of blocks) {
    switch (b.kind) {
      case 'h1':
        parts.push(`<h1 style="${baseFont}font-size:24px;font-weight:700;margin:24px 0 12px 0;line-height:1.25;">${applyInlines(b.text, { linkColor })}</h1>`)
        break
      case 'h2':
        parts.push(`<h2 style="${baseFont}font-size:20px;font-weight:700;margin:22px 0 10px 0;line-height:1.3;">${applyInlines(b.text, { linkColor })}</h2>`)
        break
      case 'h3':
        parts.push(`<h3 style="${baseFont}font-size:17px;font-weight:700;margin:20px 0 8px 0;line-height:1.35;">${applyInlines(b.text, { linkColor })}</h3>`)
        break
      case 'h4':
        parts.push(`<h4 style="${baseFont}font-size:15px;font-weight:700;margin:18px 0 8px 0;line-height:1.4;">${applyInlines(b.text, { linkColor })}</h4>`)
        break
      case 'p':
        parts.push(wrap('p', applyInlines(b.text, { linkColor }), `${baseFont}font-size:15px;margin:0 0 14px 0;`))
        break
      case 'ul':
        parts.push(
          `<ul style="${baseFont}font-size:15px;margin:0 0 14px 0;padding-left:22px;">` +
          b.items.map(it => `<li style="margin:0 0 6px 0;">${applyInlines(it, { linkColor })}</li>`).join('') +
          `</ul>`
        )
        break
      case 'ol':
        parts.push(
          `<ol style="${baseFont}font-size:15px;margin:0 0 14px 0;padding-left:22px;">` +
          b.items.map(it => `<li style="margin:0 0 6px 0;">${applyInlines(it, { linkColor })}</li>`).join('') +
          `</ol>`
        )
        break
      case 'hr':
        parts.push('<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />')
        break
      case 'blockquote':
        parts.push(`<blockquote style="${baseFont}font-size:15px;border-left:4px solid ${linkColor};margin:0 0 14px 0;padding:6px 0 6px 14px;color:#374151;font-style:italic;">${applyInlines(b.text, { linkColor })}</blockquote>`)
        break
    }
  }

  // Footer ligero con atribución
  const footerParts: string[] = []
  if (ctx.channel || ctx.authorName) {
    const bits: string[] = []
    if (ctx.channel) bits.push(`Canal: ${escapeHtml(ctx.channel)}`)
    if (ctx.authorName) bits.push(`Por ${escapeHtml(ctx.authorName)}`)
    footerParts.push(`<p style="${baseFont}font-size:11px;color:#9ca3af;margin:24px 0 0 0;">${bits.join(' · ')}</p>`)
  }

  return `<div style="${baseFont}max-width:680px;">${parts.filter(Boolean).join('\n')}${footerParts.join('')}</div>`
}

/**
 * HTML SEMÁNTICO sin clases ni estilos, ideal para WordPress (que aplica el tema).
 * Funciona bien tanto en Gutenberg como en el editor clásico.
 */
export function exportWordPressHTML(markdown: string, ctx: ExportContext = {}): string {
  const blocks = parseBlocks(markdown)
  const parts: string[] = []

  if (ctx.title && !(blocks[0]?.kind === 'h1')) {
    parts.push(`<h1>${escapeHtml(ctx.title)}</h1>`)
  }
  parts.push(imageHtmlSemantic(ctx))

  for (const b of blocks) {
    switch (b.kind) {
      case 'h1': parts.push(`<h1>${applyInlines(b.text)}</h1>`); break
      case 'h2': parts.push(`<h2>${applyInlines(b.text)}</h2>`); break
      case 'h3': parts.push(`<h3>${applyInlines(b.text)}</h3>`); break
      case 'h4': parts.push(`<h4>${applyInlines(b.text)}</h4>`); break
      case 'p':  parts.push(`<p>${applyInlines(b.text)}</p>`); break
      case 'ul': parts.push(`<ul>${b.items.map(it => `<li>${applyInlines(it)}</li>`).join('')}</ul>`); break
      case 'ol': parts.push(`<ol>${b.items.map(it => `<li>${applyInlines(it)}</li>`).join('')}</ol>`); break
      case 'hr': parts.push(`<hr />`); break
      case 'blockquote': parts.push(`<blockquote><p>${applyInlines(b.text)}</p></blockquote>`); break
    }
  }
  return parts.filter(Boolean).join('\n')
}

/**
 * Markdown con título y atribución añadidos al principio si aplica.
 * Útil para pegar en Notion, Linear, Obsidian, etc.
 */
export function exportMarkdown(markdown: string, ctx: ExportContext = {}): string {
  const parts: string[] = []
  if (ctx.title) parts.push(`# ${ctx.title}\n`)
  if (ctx.imageUrl) parts.push(`![${ctx.imageAlt ?? ctx.title ?? 'Imagen'}](${ctx.imageUrl})\n`)
  parts.push(markdown)
  if (ctx.channel || ctx.authorName) {
    const bits: string[] = []
    if (ctx.channel) bits.push(`Canal: ${ctx.channel}`)
    if (ctx.authorName) bits.push(`Por ${ctx.authorName}`)
    parts.push(`\n---\n*${bits.join(' · ')}*`)
  }
  return parts.join('\n')
}

/**
 * Texto plano sin marcas. Para pegar en WhatsApp, Slack o como borrador.
 */
export function exportPlainText(markdown: string, ctx: ExportContext = {}): string {
  // Strip de marcas básicas
  const text = markdown
    .replace(/^#{1,6}\s+/gm, '')           // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')       // bold
    .replace(/__(.+?)__/g, '$1')           // bold
    .replace(/(^|[^*])\*(?!\*)([^*\n]+?)\*(?!\*)/g, '$1$2')  // italic
    .replace(/(^|[^_])_(?!_)([^_\n]+?)_(?!_)/g, '$1$2')      // italic
    .replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, '$1 ($2)')       // links
    .replace(/`([^`]+?)`/g, '$1')          // code
    .replace(/^[-*+]\s+/gm, '· ')          // listas
    .replace(/^\d+\.\s+/gm, m => m)        // listas numeradas (las dejamos)
    .replace(/^>\s+/gm, '')                // blockquotes
    .replace(/^[-*_]{3,}\s*$/gm, '———')    // hr

  const parts: string[] = []
  if (ctx.title) parts.push(ctx.title, '')
  parts.push(text)
  if (ctx.imageUrl) parts.push('', `Imagen: ${ctx.imageUrl}`)
  if (ctx.channel || ctx.authorName) {
    const bits: string[] = []
    if (ctx.channel) bits.push(`Canal: ${ctx.channel}`)
    if (ctx.authorName) bits.push(`Por ${ctx.authorName}`)
    parts.push('', `— ${bits.join(' · ')}`)
  }
  return parts.join('\n')
}

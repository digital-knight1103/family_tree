import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({ html: false, linkify: false })

md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  const token = tokens[idx]!
  token.attrSet('target', '_blank')
  token.attrSet('rel', 'noopener noreferrer')
  return self.renderToken(tokens, idx, options)
}

export function renderMarkdown(source: string): string {
  return md.render(source)
}

import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

const MARKDOWN_TO_HTML = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkHtml);

export async function renderMarkdownToHtml (markdown: string): Promise<string> {
  const result = await MARKDOWN_TO_HTML.process(markdown);
  return result.toString();
}

export function renderMarkdownToHtmlSync (markdown: string): string {
  const result = MARKDOWN_TO_HTML.processSync(markdown);
  return result.toString();
}

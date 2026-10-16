// 文章內文斷詞：在中文「詞與詞之間」插 <wbr>，配合 CSS word-break:keep-all，
// 長段落在手機上只會在詞的交界換行，不會把一個詞拆成兩行（Miles 10/16「我不要一句話被斷句」）。
// 只給 build.py 用：從 stdin 讀一段 HTML、寫回 stdout。標題（h1～h4）不插，維持只在標點換行。
import fs from 'node:fs';
const seg = new Intl.Segmenter('zh-Hant', { granularity: 'word' });
const CJK = /[㐀-鿿豈-﫿]{2,}/g;
const SKIP = /<(h[1-4]|script|style|pre|code)\b[\s\S]*?<\/\1>/gi;
let s = fs.readFileSync(0, 'utf8');
const keep = [];
s = s.replace(SKIP, m => { keep.push(m); return `\u0000${keep.length - 1}\u0000`; });
s = s.replace(/>([^<]*)</g, (m, t) => '>' + t.replace(CJK, r => [...seg.segment(r)].map(x => x.segment).join('<wbr>')) + '<');
s = s.replace(/^([^<]+)/, (m, t) => t.replace(CJK, r => [...seg.segment(r)].map(x => x.segment).join('<wbr>')));
s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[+i]);
process.stdout.write(s);

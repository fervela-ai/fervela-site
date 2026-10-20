import { ASSETS } from './assets.js';

const FONT = '"PingFang TC","Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif';
const PCT_BASE = [30, 48, 66, 82, 97];  // 用前「多氣」1～5 換算成鼓脹 %，再 ±3 隨機（產品長 10/17 驗收意見）

export function levelBand(level) {
  return level <= 2 ? 'low' : level === 3 ? 'mid' : 'high';
}

export function timeSlot(date) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'noon';
  if (hour >= 14 && hour < 19) return 'evening';
  return 'night';
}

export function dateKey(date) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

export function displayDate(date) {
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export function selectTemplate(templates, { category, level, date, usedIds = [] }) {
  const band = levelBand(level);
  const slot = timeSlot(date);
  const own = templates.filter(template => template.category === category);
  const generic = templates.filter(template => template.category === 'any');
  const tiers = [
    own.filter(t => t.level === band && t.slot === slot),
    own.filter(t => t.level === band && t.slot === 'any'),
    own.filter(t => t.slot === slot),
    own,
    generic.filter(t => t.level === band && t.slot === slot),
    generic.filter(t => t.level === band && t.slot === 'any'),
    generic,
  ];
  for (const tier of tiers) {
    const unused = tier.find(template => !usedIds.includes(template.id));
    if (unused) return unused;
  }
  return tiers.find(tier => tier.length)?.[0] ?? null;
}

export function fillTemplate(template, { n, date }) {
  const replace = text => text.replaceAll('{n}', String(n)).replaceAll('{date}', displayDate(date));
  return { ...template, title: replace(template.title), body: replace(template.body), reward: replace(template.reward) };
}

export function makeSerial(date, count) {
  return `${dateKey(date).slice(4)}${String(count).padStart(3, '0')}`;
}

export function inflatePercent(level, rand = Math.random) {
  const base = PCT_BASE[Math.max(1, Math.min(5, Math.round(level))) - 1];
  return Math.max(1, Math.min(100, base + Math.floor(rand() * 7) - 3));
}

export function durationText(sec) {
  const total = Math.max(1, Math.round(sec));
  return total < 60 ? `${total} 秒` : `${Math.floor(total / 60)} 分 ${String(total % 60).padStart(2, '0')} 秒`;
}

export function statementText({ categoryLabel, pct, sec }) {
  return `茲證明本河豚於本日因『${categoryLabel}』氣到鼓脹 ${pct}%，經慢慢吹氣 ${durationText(sec)}，已完全消氣。`;
}

// 分三行寫，避免折行把「『開會』」或數字拆開
export function statementLines({ categoryLabel, pct, sec }) {
  return [`茲證明本河豚於本日因『${categoryLabel}』`, `氣到鼓脹 ${pct}%，經慢慢吹氣 ${durationText(sec)}，`, '已完全消氣。'];
}

const NO_LINE_START = '，。、；：！？」』）,.;:!?)';

// 逐字折行；標點不放行首（寧可那行多擠一個字）
function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const char of paragraph) {
      if (line && ctx.measureText(line + char).width > maxWidth && !NO_LINE_START.includes(char)) {
        lines.push(line);
        line = char;
      } else line += char;
    }
    lines.push(line);
  }
  return lines;
}

// 均衡折行：行數不變下盡量縮窄，避免最後一行只剩一兩個字
function balancedLines(ctx, text, maxWidth) {
  let best = wrapLines(ctx, text, maxWidth);
  for (let w = maxWidth - 20; w >= maxWidth * 0.62; w -= 20) {
    const lines = wrapLines(ctx, text, w);
    if (lines.length > best.length) break;
    best = lines;
  }
  return best;
}

function drawLines(ctx, lines, x, y, lineHeight, maxWidth, maxLines = lines.length) {
  const shown = lines.slice(0, maxLines);
  shown.forEach((line, i) => {
    if (i === maxLines - 1 && lines.length > maxLines) {
      while (line && ctx.measureText(line + '…').width > maxWidth) line = line.slice(0, -1);
      line += '…';
    }
    ctx.fillText(line, x, y + i * lineHeight);
  });
  return y + (shown.length - 1) * lineHeight;  // 最後一行的基線
}

function loadFrame(path) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = path;
  });
}

const INK = '#4a3526';
const BROWN = '#6b3f26';
const TERRA = '#c45f3b';
const LAST_BASELINE = 1085;  // 正文最後一行不能碰到右下角印章

// 證明書 1080×1350。內文在框內自動縮字（正文不低於 44px）、縮行距；標題 104px、正文 44～48px，
// 手機上看（卡片寬約 340px）正文約 14px，比視覺稿的 12.5px 還大。
export async function drawCertificate({ template, categoryLabel, date, serial, n, pct, sec }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fbf3df';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const frame = await loadFrame(ASSETS.certificateFrame);
  if (frame) ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);

  const copy = fillTemplate(template, { n, date });
  const set = (size, bold = false) => { ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`; };
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // 類別小標籤（保留在標題上方）
  set(32, true);
  const tag = `#${categoryLabel}`;
  const tagW = ctx.measureText(tag).width + 56;
  ctx.fillStyle = '#f9dccb';
  ctx.beginPath();
  ctx.roundRect(540 - tagW / 2, 108, tagW, 54, 27);
  ctx.fill();
  ctx.fillStyle = '#a8492d';
  ctx.fillText(tag, 540, 147);

  ctx.fillStyle = BROWN;
  set(106, true);
  ctx.fillText('消氣證明書', 540, 282);
  ctx.fillStyle = '#6f5b49';
  set(36);
  ctx.fillText(`氣噗噗字第 ${serial} 號`, 540, 345);
  ctx.strokeStyle = '#d9b99a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(300, 378);
  ctx.lineTo(780, 378);
  ctx.stroke();

  // 這次的真實數字（鼓脹 %、吹氣秒數）
  ctx.fillStyle = INK;
  set(44, true);
  const statement = statementLines({ categoryLabel, pct, sec }).flatMap(line => wrapLines(ctx, line, 860));
  let y = drawLines(ctx, statement, 540, 458, 66, 860);

  // 範本標題（14 字內，一行放得下；放不下就縮字）
  ctx.fillStyle = TERRA;
  let titleSize = 58;
  set(titleSize, true);
  while (titleSize > 40 && ctx.measureText(copy.title).width > 840) { titleSize -= 2; set(titleSize, true); }
  const titleBase = y + 92;
  ctx.fillText(copy.title, 540, titleBase);

  // 範本內文＋獎賞：由大到小試，直到最後一行不超過 LAST_BASELINE
  let layout = null;
  for (const size of [48, 46, 44]) {
    for (const lh of [68, 64, 60, 56]) {
      set(size);
      const bodyLines = balancedLines(ctx, copy.body, 820);
      set(40, true);
      const rewardLines = wrapLines(ctx, `今日獎賞：${copy.reward}`, 800);
      const bodyTop = titleBase + 78;
      const bodyLast = bodyTop + (bodyLines.length - 1) * lh;
      const rewardTop = bodyLast + 74;
      const last = rewardTop + (rewardLines.length - 1) * 54;
      globalThis.__certLast?.push(last);
      layout = { size, lh, bodyLines, rewardLines, bodyTop, rewardTop, last };
      if (last <= LAST_BASELINE) break;
    }
    if (layout.last <= LAST_BASELINE) break;
  }
  ctx.fillStyle = INK;
  set(layout.size);
  drawLines(ctx, layout.bodyLines, 540, layout.bodyTop, layout.lh, 820, 7);
  ctx.fillStyle = '#287d9c';
  set(40, true);
  drawLines(ctx, layout.rewardLines, 540, layout.rewardTop, 54, 800, 2);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#5b4a3c';
  set(38);
  ctx.fillText(`${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`, 250, 1236);
  ctx.strokeStyle = '#d9b99a';
  ctx.beginPath();
  ctx.moveTo(250, 1252);
  ctx.lineTo(610, 1252);
  ctx.stroke();

  const stamp = await loadFrame(ASSETS.stamp);
  ctx.save();
  ctx.translate(820, 1190);
  ctx.rotate(-0.12);
  ctx.globalAlpha = 0.93;
  if (stamp) ctx.drawImage(stamp, -100, -100, 200, 200);
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9a8a7a';
  set(28);
  ctx.fillText('用 Fervela 氣噗噗 做的・fervela.ai/qipupu', 540, 1292);  // 0.18 推廣：朋友看到圖知道去哪裡（決策 1047）
  return canvas.toDataURL('image/png');
}

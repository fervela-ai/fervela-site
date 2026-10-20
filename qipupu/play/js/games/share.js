import { GAME_ASSETS } from './assets.js';

function image(path) {
  return new Promise(resolve => {
    const item = new Image();
    item.onload = () => resolve(item);
    item.onerror = () => resolve(null);
    item.src = path;
  });
}

export function gameStatement(game, result) {
  if (game === 'candles') return `茲證明本人一口氣吹熄蠟燭 ${result.maxOneBreath} 根，肺活量經河豚鑑定所認證。`;
  if (game === 'soup') return `茲證明本人慢慢吹涼${result.config.food}，連續吐氣 ${(result.longestBreathMs / 1000).toFixed(1)} 秒，經河豚鑑定所認證。`;
  if (game === 'socks') return `我找回了洗衣機吞掉的第 ${result.foundTotal} 隻襪子。`;
  if (game === 'truck') return '垃圾車一響，我家河豚自動排隊。';
  if (game === 'meeting') return `本日視訊會議狀態：${result.expression ?? '專心'}臉很懂，腦袋在${result.background ?? '乾淨書櫃'}。`;
  return `茲證明本人一口氣吹走便利貼 ${result.maxOneBreath} 張，待辦事項經河豚鑑定所核銷。`;
}

export async function drawGameCard(game, levelNo, result) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fbf3df'; ctx.fillRect(0, 0, 1080, 1350);
  const frame = await image(GAME_ASSETS.frame);
  if (frame) ctx.drawImage(frame, 0, 0, 1080, 1350);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#6b3f26';
  ctx.font = 'bold 94px "PingFang TC","Noto Sans TC",sans-serif';
  ctx.fillText('挑戰紀錄證明書', 540, 290);
  ctx.font = 'bold 56px "PingFang TC","Noto Sans TC",sans-serif';
  const name = { candles: '吹蠟燭', soup: '吹涼熱湯', notes: '吹走便利貼',
    socks: '襪子失蹤案', truck: '垃圾車節拍長', meeting: '視訊會議濾鏡就位' }[game];
  ctx.fillText(`${name}・第 ${levelNo} 關`, 540, 430);
  ctx.fillStyle = '#d9714e';
  ctx.font = '84px sans-serif';
  ctx.fillText('★'.repeat(result.stars), 540, 565);
  ctx.fillStyle = '#4a3526';
  ctx.font = 'bold 46px "PingFang TC","Noto Sans TC",sans-serif';
  const statement = gameStatement(game, result);
  const lines = [];
  let line = '';
  for (const char of statement) {
    if (line && ctx.measureText(line + char).width > 830) { lines.push(line); line = char; }
    else line += char;
  }
  if (line) lines.push(line);
  lines.forEach((part, index) => ctx.fillText(part, 540, 680 + index * 76));
  if (game === 'socks') {
    const press = await image(GAME_ASSETS.socks.press);
    if (press) ctx.drawImage(press, 395, 820, 290, 290);
  }
  const date = new Date();
  ctx.font = '38px "PingFang TC","Noto Sans TC",sans-serif';
  ctx.fillText(`${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`, 540, 1180);
  const stamp = await image(GAME_ASSETS.stamp);
  if (stamp) ctx.drawImage(stamp, 755, 1090, 180, 180);
  ctx.fillStyle = '#9a8a7a';
  ctx.font = '26px "PingFang TC","Noto Sans TC",sans-serif';
  ctx.fillText('用 Fervela 氣噗噗 做的・fervela.ai/qipupu', 470, 1245);  // 0.18：避開底框線與右邊印章
  return canvas.toDataURL('image/png');
}

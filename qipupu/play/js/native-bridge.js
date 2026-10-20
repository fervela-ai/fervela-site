// App 殼的訊息通道（太守 10/17）：殼在頁面載完後用 postWebMessage 交來一個 port（訊息 "qipupu-port"），
// 這裡把它包成 window.qipupuNative，app.js 用它送證明書 PNG（存圖／分享）。一般瀏覽器沒有殼，什麼都不做。
// 殼在 App 切到背景時會送 {"type":"pause"}（資安長 10/17 建議②），轉成 qipupu-pause 事件讓 app.js 停麥克風。
if (window.webkit?.messageHandlers?.qipupu) {
  window.qipupuNative = {
    postMessage: text => window.webkit.messageHandlers.qipupu.postMessage(text),
    ios: true,
  };
}
window.addEventListener('message', event => {
  if (event.data !== 'qipupu-port' || !event.ports || !event.ports[0]) return;
  const port = event.ports[0];
  port.onmessage = msg => {
    try {
      if (JSON.parse(msg.data).type === 'pause') window.dispatchEvent(new Event('qipupu-pause'));
    } catch (e) { /* 只認得 pause */ }
  };
  if (!window.qipupuNative?.ios) window.qipupuNative = { postMessage: text => port.postMessage(text) };
});

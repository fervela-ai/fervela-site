// 只在初始化時決定設定列是否出現，避免切到設定頁後才撐開版面。
export function setupInstallRow(browser, device, button, hint) {
  const nativeShell = Boolean(browser.qipupuNative)
    || browser.location.protocol === 'app:'
    || browser.location.host === 'appassets.androidplatform.net';
  const standalone = browser.matchMedia?.('(display-mode: standalone)').matches
    || device.standalone === true;
  if (nativeShell || standalone) return false;

  button.hidden = false;
  let installPrompt = null;
  browser.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
  });
  button.addEventListener('click', async () => {
    if (installPrompt) {
      const prompt = installPrompt;
      installPrompt = null;
      try {
        await prompt.prompt();
        return;
      } catch { /* 提示無法開啟時，改顯示手動步驟 */ }
    }
    hint.textContent = '點瀏覽器下方的分享鈕，選『加入主畫面』';
  });
  return true;
}

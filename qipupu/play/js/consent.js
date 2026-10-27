const PREFIX = 'ffunnel:qipupu:';

export function createConsentGate({ platform, storage, funnel, initFunnel, showPrompt }) {
  const ios = platform === 'ios';
  let initialized = false;
  let consent = ios ? storage.getItem(PREFIX + 'consent') : null;

  function start() {
    if (!ios) { initialized = true; return initFunnel(); }
    if (consent === 'yes') { storage.removeItem(PREFIX + 'optout'); initialized = true; return initFunnel(); }
    if (consent !== 'no') showPrompt();
  }

  async function setEnabled(on) {
    if (!ios) return funnel.setEnabled(on);
    consent = on ? 'yes' : 'no';
    storage.setItem(PREFIX + 'consent', consent);
    if (on) {
      storage.removeItem(PREFIX + 'optout');
      if (!initialized) { initialized = true; await initFunnel(); }
      else await funnel.setEnabled(true);
    } else {
      storage.setItem(PREFIX + 'optout', '1');
      if (initialized) await funnel.setEnabled(false);
      else storage.removeItem(PREFIX + 'queue');
    }
  }

  return {
    start,
    setEnabled,
    respond: setEnabled,
    step(name) { if (!ios || (consent === 'yes' && initialized)) return funnel.step(name); },
    get checked() {
      return storage.getItem(PREFIX + 'off') !== '1' && storage.getItem(PREFIX + 'optout') !== '1' &&
        (!ios || consent === 'yes');
    },
  };
}

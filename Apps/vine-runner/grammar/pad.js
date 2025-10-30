// grammar/pad.js
export function registerPadGrammar(dbg, _engine, _levels, extras = {}) {
  const overlay = extras.padOverlay;
  const gpGetter = extras.getActiveGamepad; // function returning {index, gamepad}

  dbg.extend(
    'pad',
    () => 'Type "pad help" for controller commands.',
    'Gamepad tools',
  );

  dbg.extend('pad', (args) => {
    const sub = (args[0] || '').toLowerCase();

    if (!sub || sub === 'help') {
      return [
        'pad map     — show/hide controller overlay',
        'pad info    — report active pad + axes/buttons snapshot',
        'pad show    — show overlay',
        'pad hide    — hide overlay',
      ];
    }

    if (sub === 'map' || sub === 'show') { overlay?.show?.(); return 'overlay shown'; }
    if (sub === 'hide') { overlay?.hide?.(); return 'overlay hidden'; }

    if (sub === 'info') {
      const { index, gamepad } = gpGetter ? gpGetter() : { index: null, gamepad: null };
      if (!gamepad) return 'No active gamepad.';
      const axes  = Array.from(gamepad.axes || []).map(v => +v.toFixed(2));
      const btns  = Array.from(gamepad.buttons || []).map(b => (b?.pressed ? 1 : 0));
      return [
        `index: ${index}`,
        `id: ${gamepad.id || '(no id)'}`,
        `axes: [${axes.join(', ')}]`,
        `buttons pressed: [${btns.join(', ')}]`
      ];
    }

    return 'Unknown "pad" subcommand (try "pad help").';
  });
}

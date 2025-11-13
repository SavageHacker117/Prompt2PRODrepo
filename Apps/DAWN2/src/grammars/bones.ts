// bones.ts
type Dbg = {
  extend: (name: string, fn: (args: string[]) => string | string[], help: string) => void;
};

export function registerBonesGrammar(dbg: Dbg) {
  const handler = (args: string[]) => {
    const sub = (args[0] || '').toLowerCase();
    const helper = (window as any).__engine?.skeletonHelper as { visible: boolean } | undefined;

    if (!sub || sub === 'help') {
      return [
        'bones toggle   — show/hide skeleton helper',
        'bones on       — show helper',
        'bones off      — hide helper'
      ];
    }

    if (!helper) return '(no skeleton helper yet)';

    if (sub === 'toggle') { helper.visible = !helper.visible; return helper.visible ? 'bones: on' : 'bones: off'; }
    if (sub === 'on')     { helper.visible = true;  return 'bones: on'; }
    if (sub === 'off')    { helper.visible = false; return 'bones: off'; }

    return 'Unknown "bones" subcommand (try "bones help")';
  };

  dbg.extend('bones', handler, 'Skeleton helper controls (type "bones help").');
}

// src/grammar/controllerMap.js
// Small "grammar-like" config for actions and default keyboard mapping.
// You can expand this later or generate it from a richer DSL.

export function loadControllerMap() {
  return {
    actions: [
      'moveForward','moveBack','moveLeft','moveRight',
      'jump','sprint','build','remove','toggleView'
    ],
    keyboardDefaults: {
      moveForward: 'KeyW',
      moveBack:    'KeyS',
      moveLeft:    'KeyA',
      moveRight:   'KeyD',
      jump:        'Space',
      sprint:      'ShiftLeft',
      build:       'MouseLeft',
      remove:      'MouseRight',
      toggleView:  'KeyC'
    }
  };
}

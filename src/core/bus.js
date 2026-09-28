import mitt from 'mitt'

export const bus = mitt()

// The only cross-layer channel between phaser/ and vue/ (see doc/13 §3).
// Event names are `domain:action` style and MUST come from this table;
// string literals elsewhere are a lint-level error. Payload contracts for
// each entry live in doc/13 §3.2 and must not be invented ad hoc.
export const EVT = {
  GAME_START: 'game:start',
  DIALOG_OPEN: 'dialog:open',
  DIALOG_CHOICE: 'dialog:choice',
  DIALOG_CLOSE: 'dialog:close',
  MENU_TOGGLE: 'menu:toggle',
  BATTLE_START: 'battle:start',
  BATTLE_COMMAND: 'battle:command',
  BATTLE_TURN: 'battle:turn',
  BATTLE_END: 'battle:end',
  STAT_CHANGED: 'stat:changed',
  ITEM_GAINED: 'item:gained',
  QUEST_UPDATED: 'quest:updated',
  SAVE_REQUEST: 'save:request',
  SAVE_WRITTEN: 'save:written',
  TOAST: 'ui:toast',
  SCENE_TRANSITION: 'world:transition',
}

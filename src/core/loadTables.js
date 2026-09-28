// Browser-side table bundle: imports every JSON table through Vite's JSON
// plugin (no import attributes needed) and initializes the registry.
// Imported FIRST in BootScene (doc/12 §5.2); Node tools never load this file.
import { initRegistry } from './registry.js'
import enemiesJson from '../data/enemies.json'
import skillsJson from '../data/skills.json'
import encountersJson from '../data/encounters.json'
import itemsJson from '../data/items.json'
import gongfaJson from '../data/gongfa.json'
import npcsJson from '../data/npcs.json'
import dialoguesJson from '../data/dialogues.json'
import questsJson from '../data/quests.json'
import eventsJson from '../data/events.json'

export const TABLES = {
  enemies: enemiesJson,
  skills: skillsJson,
  encounters: encountersJson,
  items: itemsJson,
  gongfa: gongfaJson,
  npcs: npcsJson,
  dialogues: dialoguesJson,
  quests: questsJson,
  events: eventsJson,
}

initRegistry(TABLES)

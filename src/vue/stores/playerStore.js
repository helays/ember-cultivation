import { defineStore } from 'pinia'

// Realm ladder per doc/01 §5: index 0-10, each realm has 4 stages.
export const REALM_NAMES = ['凡人', '炼气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫', '仙人']
export const STAGE_NAMES = ['初期', '中期', '后期', '圆满']

// Character state only; world state (position/time) lives in worldStore.
// Persistence shape follows doc/12 §3.4 (player block minus location/position/time).
export const usePlayerStore = defineStore('player', {
  state: () => ({
    name: '无名',
    realmIndex: 0,
    stageIndex: 1,
    exp: 0,
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    mind: 70,
    attrs: { attack: 8, defense: 6, speed: 10 },
    wuxing: 5,
    gengu: 5,
    shenshi: 5,
    spiritualRoot: ['火'],
  }),
  getters: {
    realm: (state) => REALM_NAMES[state.realmIndex] ?? REALM_NAMES[0],
    stage: (state) => STAGE_NAMES[state.stageIndex - 1] ?? STAGE_NAMES[0],
  },
  actions: {
    toSave() {
      return {
        name: this.name,
        realm: this.realm,
        realmIndex: this.realmIndex,
        stage: this.stage,
        stageIndex: this.stageIndex,
        exp: this.exp,
        hp: this.hp,
        maxHp: this.maxHp,
        mp: this.mp,
        maxMp: this.maxMp,
        mind: this.mind,
        attrs: { ...this.attrs },
        wuxing: this.wuxing,
        gengu: this.gengu,
        shenshi: this.shenshi,
        spiritualRoot: [...this.spiritualRoot],
      }
    },
    fromSave(player) {
      this.name = player.name
      this.realmIndex = player.realmIndex
      this.stageIndex = player.stageIndex
      this.exp = player.exp
      this.hp = player.hp
      this.maxHp = player.maxHp
      this.mp = player.mp
      this.maxMp = player.maxMp
      this.mind = player.mind
      this.attrs = { ...player.attrs }
      this.wuxing = player.wuxing
      this.gengu = player.gengu
      this.shenshi = player.shenshi
      this.spiritualRoot = [...player.spiritualRoot]
    },
  },
})

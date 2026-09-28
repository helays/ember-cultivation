<script setup>
import { useUiStore } from './stores/uiStore.js'

const ui = useUiStore()
</script>

<template>
  <!-- Blank overlay host: menus/dialogs mount here from M1 on. While no
       blocking UI is open the layer is click-through so the Phaser canvas
       below keeps receiving input (doc/13 §3.2 single-blocking-UI rule). -->
  <div class="ui-overlay" :class="{ blocking: ui.blocking }"></div>
</template>

<style scoped>
.ui-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

.ui-overlay.blocking {
  pointer-events: auto;
}
</style>

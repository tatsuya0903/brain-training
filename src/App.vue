<template>
  <v-app>
    <router-view />
  </v-app>
</template>

<style>
* {
  box-sizing: border-box;
}

html {
  background: #fdf8ff;
}

html,
body,
#app {
  min-width: 320px;
  min-height: 100%;
  margin: 0;
}

body {
  overflow-x: hidden;
}
</style>

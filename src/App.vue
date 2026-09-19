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
  width: 100%;
  min-height: 100%;
  margin: 0;
}

body {
  overflow-x: hidden;
  overscroll-behavior-x: none;
}

button,
[role='button'] {
  -webkit-tap-highlight-color: transparent;
}
</style>

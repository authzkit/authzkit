<template>
  <Layout>
    <template #layout-bottom>
      <Footer />
    </template>
  </Layout>

</template>

<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import Footer from './components/Footer.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #doc-after>
      <Footer />
    </template>
    <template #layout-bottom>
      <Footer />
    </template>
  </Layout>
</template>

<script setup>
import DefaultTheme from 'vitepress/theme'
import Footer from './components/Footer.vue'

const { Layout } = DefaultTheme
</script>
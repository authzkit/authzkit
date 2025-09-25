<template>
  <Layout>
    <template #layout-bottom>
      <Footer :class="{ 'footer-docs': !isHome }" />
    </template>
  </Layout>
</template>

<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import Footer from './components/Footer.vue'
import { useData } from 'vitepress'
import { computed } from 'vue'

const { Layout } = DefaultTheme
const { frontmatter } = useData()
const isHome = computed(() => frontmatter.value.layout === 'home')
</script>

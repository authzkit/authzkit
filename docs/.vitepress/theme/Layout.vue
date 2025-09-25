<template>
  <Layout>
    <template #doc-after>
      <Footer v-if="!isHome" />
    </template>
    <template #layout-bottom>
      <Footer v-if="isHome" />
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

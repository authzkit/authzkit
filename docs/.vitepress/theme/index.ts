import DefaultTheme from 'vitepress/theme'
import CustomHero from './components/CustomHero.vue'
import Footer from './components/Footer.vue'
import Layout from './Layout.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('CustomHero', CustomHero)
    app.component('Footer', Footer)
  }
}
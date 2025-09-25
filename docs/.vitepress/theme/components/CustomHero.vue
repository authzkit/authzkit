<template>
  <div class="hero-container">
    <div class="hero-content">
      <!-- Left side - Text content -->
      <div class="hero-text">
        <h1 class="hero-title">{{ text }}</h1>
        <p class="hero-tagline">{{ tagline }}</p>
        <div class="hero-actions">
          <a
            v-for="action in actions"
            :key="action.text"
            :href="action.link"
            :class="['hero-action', `hero-action-${action.theme}`]"
          >
            {{ action.text }}
          </a>
        </div>
      </div>

      <!-- Right side - Code snippet -->
      <div class="hero-code">
        <div class="code-window">
          <div class="code-header">
            <div class="code-dots">
              <span class="dot red"></span>
              <span class="dot yellow"></span>
              <span class="dot green"></span>
            </div>
            <span class="code-title">policy.ts</span>
          </div>
          <div class="code-content" v-html="highlightedCode"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, computed } from 'vue'

defineProps<{
  text: string
  tagline: string
  actions: Array<{
    text: string
    link: string
    theme: string
  }>
}>()

const codeSnippet = `// Define policies once
const policy = definePolicy({
  rules: [{
    action: 'post.edit',
    effect: 'allow',
    when: ({ subject, resource }) =>
      subject.id === resource.authorId
  }]
})

// Use everywhere
const canEdit = policy.check(
  'post.edit',
  { subject: user, resource: post }
)

const decision = policy.checkDetailed(
  'post.edit',
  { subject: user, resource: post }
)
`

const highlightedCode = computed(() => {
  return `<pre><code class="language-typescript">${codeSnippet
    .replace(/\/\/.*$/gm, '<span class="token comment">$&</span>')
    .replace(/\b(const|when|subject|resource|action|effect|allow|user|data)\b/g, '<span class="token keyword">$1</span>')
    .replace(/'([^']*)'/g, '<span class="token string">\'$1\'</span>')
    .replace(/\b(definePolicy|check|filters|mask)\b/g, '<span class="token function">$1</span>')
    .replace(/\b(policy|canEdit|filters|maskedData|post|Post)\b/g, '<span class="token variable">$1</span>')
  }</code></pre>`
})
</script>

<style scoped>
.hero-container {
  padding: 32px 24px 48px 24px;
  max-width: 1152px;
  margin: 0 auto;
  overflow-x: hidden;
}

.hero-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  align-items: start;
  min-height: 50vh;
  padding-top: 20px;
}

.hero-text {
  max-width: 600px;
}

.hero-title {
  font-size: 3.5rem;
  font-weight: 800;
  line-height: 1.1;
  color: var(--vp-c-text-1);
  margin: 0 0 24px 0;
}

.hero-tagline {
  font-size: 1.25rem;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  margin: 0 0 32px 0;
}

.hero-actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.hero-action {
  display: inline-block;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.3s ease;
}

.hero-action-brand {
  background: var(--vp-c-brand-1);
  color: white;
}

.hero-action-brand:hover {
  background: var(--vp-c-brand-2);
}

.hero-action-alt {
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
}

.hero-action-alt:hover {
  background: var(--vp-c-gray-light-4);
}

.hero-code {
  display: flex;
  justify-content: center;
  align-self: start;
  margin-top: -40px;
}

.code-window {
  background: #1e1e1e;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 500px;
  box-sizing: border-box;
}

.code-header {
  background: #2d2d2d;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #404040;
}

.code-dots {
  display: flex;
  gap: 6px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.dot.red { background: #ff5f56; }
.dot.yellow { background: #ffbd2e; }
.dot.green { background: #27ca3f; }

.code-title {
  color: #a6a6a6;
  font-size: 0.875rem;
  font-family: 'SF Mono', Monaco, Inconsolata, 'Roboto Mono', Consolas, 'Courier New', monospace;
}

.code-content {
  padding: 20px;
  font-family: 'SF Mono', Monaco, Inconsolata, 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  overflow-x: auto;
  max-width: 100%;
  text-align: left;
}

.code-content pre {
  margin: 0;
  color: #d4d4d4;
  overflow-x: auto;
  white-space: pre;
}

.code-content code {
  color: #d4d4d4;
  display: block;
  width: 100%;
  box-sizing: border-box;
}

/* Responsive design */
@media (max-width: 960px) {
  .hero-content {
    grid-template-columns: 1fr;
    gap: 32px;
    text-align: center;
    min-height: auto;
  }

  .hero-title {
    font-size: 2.5rem;
  }

  .hero-code {
    margin-top: 24px;
    display: flex;
    justify-content: center;
    padding: 0;
  }

  .code-window {
    width: 90%;
    max-width: none;
    margin: 0 auto;
  }
}

@media (max-width: 640px) {
  .hero-container {
    padding: 32px 16px;
    width: 100%;
    box-sizing: border-box;
  }

  .hero-content {
    width: 100%;
    box-sizing: border-box;
    min-height: auto;
  }

  .hero-title {
    font-size: 2rem;
  }

  .hero-tagline {
    font-size: 1.125rem;
  }

  .hero-actions {
    justify-content: center;
  }

  .hero-code {
    display: flex;
    justify-content: center;
    padding: 0;
  }

  .code-window {
    width: 98%;
    max-width: none;
  }

  .code-content {
    padding: 16px;
    font-size: 0.8rem;
    word-wrap: break-word;
    white-space: pre-wrap;
    text-align: left;
  }
}

@media (max-width: 480px) {
  .hero-actions {
    flex-direction: column;
    align-items: center;
  }

  .hero-action {
    width: 100%;
    max-width: 200px;
    text-align: center;
  }
}
</style>
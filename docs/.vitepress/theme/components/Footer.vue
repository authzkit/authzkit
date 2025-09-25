<template>
  <footer class="authzkit-footer">
    <div class="footer-content">
      <div class="footer-section">
        <h3>AuthzKit</h3>
        <p>The last authorization library you'll need.</p>
      </div>

      <div class="footer-section">
        <h4>Documentation</h4>
        <ul>
          <li><a href="/guides/getting-started">Getting Started</a></li>
          <li><a href="/concepts/">Core Concepts</a></li>
          <li><a href="/examples/">Examples</a></li>
          <li><a href="/recipes/">Recipes</a></li>
        </ul>
      </div>

      <div class="footer-section">
        <h4>Tools</h4>
        <ul>
          <li><a href="/tenant-guard/">Tenant Guard</a></li>
          <li><a href="/reference/cli">CLI Reference</a></li>
          <li><a href="/reference/migrations">Migrations</a></li>
        </ul>
      </div>

      <div class="footer-section">
        <h4>Community</h4>
        <ul>
          <li><a href="https://github.com/authzkit/authzkit" target="_blank">GitHub</a></li>
          <li><a href="/roadmap">Roadmap</a></li>
        </ul>
      </div>
    </div>

    <div class="footer-bottom">
      <p>&copy; {{ new Date().getFullYear() }} AuthzKit. Built with security in mind.</p>
    </div>
  </footer>
</template>

<style scoped>
.authzkit-footer {
  background: var(--vp-c-bg-alt);
  border-top: 1px solid var(--vp-c-divider);
  padding: 48px 24px 24px 24px;
  margin-top: 64px;
}

.footer-content {
  max-width: 1152px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 48px;
}

.footer-section h3 {
  color: var(--vp-c-text-1);
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 16px 0;
}

.footer-section h4 {
  color: var(--vp-c-text-1);
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 16px 0;
}

.footer-section p {
  color: var(--vp-c-text-2);
  margin: 0;
  line-height: 1.6;
}

.footer-section ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.footer-section li {
  margin-bottom: 8px;
}

.footer-section a {
  color: var(--vp-c-text-2);
  text-decoration: none;
  transition: color 0.3s ease;
}

.footer-section a:hover {
  color: var(--vp-c-brand-1);
}

.footer-bottom {
  max-width: 1152px;
  margin: 32px auto 0 auto;
  padding-top: 24px;
  border-top: 1px solid var(--vp-c-divider);
  text-align: center;
}

.footer-bottom p {
  color: var(--vp-c-text-2);
  margin: 0;
  font-size: 0.875rem;
}

@media (max-width: 960px) {
  .footer-content {
    grid-template-columns: 1fr 1fr;
    gap: 32px;
  }
}

@media (max-width: 640px) {
  .authzkit-footer {
    padding: 32px 16px 16px 16px;
  }

  .footer-content {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}
</style>
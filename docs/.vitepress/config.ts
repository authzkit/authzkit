import { defineConfig } from 'vitepress'

export default defineConfig({
  // Base path required for GitHub Pages project sites (authzkit/authzkit)
  // If switching to a custom domain, update this to '/' and add CNAME in docs/public
  base: '/authzkit/',
  title: 'AuthzKit',
  description: 'The last authorization library you\'ll need',
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }]
  ],
  themeConfig: {
    nav: [
      { text: 'Roadmap', link: '/roadmap' }
    ],
    sidebar: [
      {
        text: 'Guides',
        collapsed: false,
        items: [
          { text: 'Getting Started', link: '/guides/getting-started' },
          { text: 'Policy Masks', link: '/guides/policy-masks' },
          { text: 'React UI', link: '/guides/react-ui' },
          { text: 'Tenant Guard', link: '/guides/tenant-guard' }
        ]
      },
      {
        text: 'Core Concepts',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/concepts/' },
          { text: 'Policies', link: '/concepts/policies' },
          { text: 'Actions', link: '/concepts/actions' },
          { text: 'Decisions', link: '/concepts/decisions' },
          { text: 'Field Permissions', link: '/concepts/field-permissions' },
          { text: 'Type Safety', link: '/concepts/type-safety' }
        ]
      },
      {
        text: 'Examples',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/examples/' },
          { text: 'Next.js + Prisma', link: '/examples/nextjs-prisma' },
          { text: 'Prisma', link: '/examples/prisma' },
          { text: 'Drizzle', link: '/examples/drizzle' },
          { text: 'Kysely', link: '/examples/kysely' },
          { text: 'RPC', link: '/examples/rpc' }
        ]
      },
      {
        text: 'Recipes',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/recipes/' },
          { text: 'Data Masking', link: '/recipes/masking' },
          { text: 'Multi-tenancy', link: '/recipes/multitenancy' },
          { text: 'Prisma RLS', link: '/recipes/prisma-rls' },
          { text: 'UI Guards', link: '/recipes/ui-guards' }
        ]
      },
      {
        text: 'Tenant Guard',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/tenant-guard/' },
          { text: 'Installation', link: '/tenant-guard/installation' },
          { text: 'Quick Start', link: '/tenant-guard/quick-start' },
          { text: 'Configuration', link: '/tenant-guard/configuration' },
          { text: 'Concepts', link: '/tenant-guard/concepts' },
          { text: 'Generator', link: '/tenant-guard/generator' },
          { text: 'Auto Injection', link: '/tenant-guard/auto-injection' },
          { text: 'Modes', link: '/tenant-guard/modes' },
          { text: 'Nested Operations', link: '/tenant-guard/nested-operations' },
          { text: 'Migration', link: '/tenant-guard/migration' },
          { text: 'Security Testing', link: '/tenant-guard/security-testing' },
          { text: 'Best Practices', link: '/tenant-guard/best-practices' },
          { text: 'Troubleshooting', link: '/tenant-guard/troubleshooting' }
        ]
      },
      {
        text: 'Reference',
        collapsed: false,
        items: [
          { text: 'CLI', link: '/reference/cli' },
          { text: 'Migrations', link: '/reference/migrations' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/authzkit/authzkit' }
    ]
  }
})

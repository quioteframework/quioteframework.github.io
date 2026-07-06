// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://quioteframework.github.io',
	integrations: [
		starlight({
			title: 'Quiote',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/quioteframework/quiote' }],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'getting-started/introduction' },
						{ label: 'Design philosophy', slug: 'getting-started/philosophy' },
						{ label: 'Installation', slug: 'getting-started/installation' },
						{ label: 'Your first application', slug: 'getting-started/your-first-app' },
						{ label: 'The command-line tool', slug: 'getting-started/cli' },
						{ label: 'The AI assistant (MCP)', slug: 'getting-started/mcp-assistant' },
					],
				},
				{
					label: 'Architecture',
					items: [
						{ label: 'The request lifecycle', slug: 'architecture/request-lifecycle' },
						{ label: 'The middleware pipeline', slug: 'architecture/middleware-pipeline' },
						{ label: 'Middleware reference', slug: 'architecture/middleware-reference' },
						{ label: 'Actions and views', slug: 'architecture/actions-and-views' },
						{ label: 'Configuration', slug: 'architecture/configuration' },
						{ label: 'Settings reference', slug: 'architecture/settings-reference' },
						{ label: 'The DI container', slug: 'architecture/container' },
						{ label: 'Events', slug: 'architecture/events' },
						{ label: 'Error handling', slug: 'architecture/error-handling' },
						{ label: 'Logging', slug: 'architecture/logging' },
						{ label: 'Telemetry', slug: 'architecture/telemetry' },
						{ label: 'Worker mode & deployment', slug: 'architecture/deployment' },
					],
				},
				{
					label: 'Plugins',
					items: [
						{ label: 'Overview', slug: 'plugins/overview' },
						{ label: 'Official packages', slug: 'plugins/official-packages' },
						{ label: 'Writing a plugin', slug: 'architecture/plugins' },
						{ label: 'Plugins & middleware quickstart', slug: 'plugins/quickstart' },
					],
				},
				{
					label: 'The Basics',
					items: [
						{ label: 'Modules', slug: 'basics/modules' },
						{ label: 'Routing', slug: 'basics/routing' },
						{ label: 'Requests and responses', slug: 'basics/requests-and-responses' },
						{ label: 'Input validation', slug: 'basics/validation' },
						{ label: 'Output types & negotiation', slug: 'basics/output-types-and-content-negotiation' },
						{ label: 'Templates and rendering', slug: 'basics/templates-and-rendering' },
						{ label: 'Services and models', slug: 'basics/services-and-models' },
						{ label: 'Databases', slug: 'basics/databases' },
						{ label: 'Caching', slug: 'basics/caching' },
						{ label: 'Sessions and storage', slug: 'basics/sessions' },
						{ label: 'Translation and i18n', slug: 'basics/i18n' },
						{ label: 'HTTP client', slug: 'basics/http-client' },
					],
				},
				{
					label: 'Advanced',
					items: [
						{ label: 'Writing custom middleware', slug: 'advanced/custom-middleware' },
						{ label: 'Writing a custom renderer', slug: 'advanced/custom-renderers' },
						{ label: 'Authentication & authorization', slug: 'advanced/authentication-authorization' },
						{ label: 'Advanced validation', slug: 'advanced/advanced-validation' },
						{ label: 'Writing a custom validator', slug: 'advanced/custom-validators' },
						{ label: 'Testing your application', slug: 'advanced/testing' },
						{ label: 'Migrating from Agavi', slug: 'advanced/migrating-from-agavi' },
					],
				},
			],
		}),
	],
});

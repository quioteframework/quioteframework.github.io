// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightSidebarTopics from 'starlight-sidebar-topics';

// https://astro.build/config
export default defineConfig({
	site: 'https://quioteframework.github.io',
	integrations: [
		starlight({
			title: 'Quiote',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/quioteframework/quiote' }],
			plugins: [
				starlightSidebarTopics([
					{
						id: 'quiote',
						label: 'Quiote',
						link: '/',
						icon: 'seti:php',
						items: [
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
									{ label: 'Exposing your app as an MCP server', slug: 'advanced/mcp-server' },
									{ label: 'Advanced validation', slug: 'advanced/advanced-validation' },
									{ label: 'Writing a custom validator', slug: 'advanced/custom-validators' },
									{ label: 'Testing your application', slug: 'advanced/testing' },
									{ label: 'Migrating from Agavi', slug: 'advanced/migrating-from-agavi' },
								],
							},
						],
					},
					{
						id: 'propulsion',
						label: 'Propulsion',
						link: '/propulsion/',
						icon: 'seti:db',
						items: [
							{
								label: 'Getting Started',
								items: [
									{ label: 'Introduction', slug: 'propulsion' },
									{ label: 'Installation', slug: 'propulsion/getting-started/installation' },
									{ label: 'Building your schema', slug: 'propulsion/getting-started/schema-and-build-time' },
									{ label: 'Basic CRUD', slug: 'propulsion/getting-started/basic-crud' },
									{ label: 'Migrating from Propel 1', slug: 'propulsion/getting-started/migrating-from-propel' },
								],
							},
							{
								label: 'Working with data',
								items: [
									{ label: 'Relationships', slug: 'propulsion/basics/relationships' },
									{ label: 'Validators', slug: 'propulsion/basics/validators' },
									{ label: 'Transactions', slug: 'propulsion/basics/transactions' },
									{ label: 'Inheritance', slug: 'propulsion/basics/inheritance' },
									{ label: 'Schema migrations', slug: 'propulsion/basics/migrations' },
									{ label: 'Logging', slug: 'propulsion/basics/logging' },
									{ label: 'Configuration', slug: 'propulsion/basics/configuration' },
								],
							},
							{
								label: 'Behaviors',
								items: [
									{ label: 'Overview', slug: 'propulsion/behaviors' },
									{ label: 'Aggregate column', slug: 'propulsion/behaviors/aggregate-column' },
									{ label: 'Archivable', slug: 'propulsion/behaviors/archivable' },
									{ label: 'Auto add PK', slug: 'propulsion/behaviors/auto-add-pk' },
									{ label: 'Delegate', slug: 'propulsion/behaviors/delegate' },
									{ label: 'I18n', slug: 'propulsion/behaviors/i18n' },
									{ label: 'Nested set', slug: 'propulsion/behaviors/nested-set' },
									{ label: 'Query cache', slug: 'propulsion/behaviors/query-cache' },
									{ label: 'Sluggable', slug: 'propulsion/behaviors/sluggable' },
									{ label: 'Sortable', slug: 'propulsion/behaviors/sortable' },
									{ label: 'Timestampable', slug: 'propulsion/behaviors/timestampable' },
									{ label: 'Versionable', slug: 'propulsion/behaviors/versionable' },
								],
							},
							{
								label: 'Cookbook',
								items: [
									{ label: 'Overview', slug: 'propulsion/cookbook' },
									{ label: 'Working with existing databases', slug: 'propulsion/cookbook/working-with-existing-databases' },
									{ label: 'Using SQL schemas', slug: 'propulsion/cookbook/using-sql-schemas' },
									{ label: 'Namespaces', slug: 'propulsion/cookbook/namespaces' },
									{ label: 'Multi-component data models', slug: 'propulsion/cookbook/multi-component-data-model' },
									{ label: 'Advanced column types', slug: 'propulsion/cookbook/working-with-advanced-column-types' },
									{ label: 'Copying persisted objects', slug: 'propulsion/cookbook/copying-persisted-objects' },
									{ label: 'Runtime introspection', slug: 'propulsion/cookbook/runtime-introspection' },
									{ label: 'Additional SQL files', slug: 'propulsion/cookbook/adding-additional-sql-files' },
									{ label: 'Replication', slug: 'propulsion/cookbook/replication' },
									{ label: 'Writing a behavior', slug: 'propulsion/cookbook/writing-behavior' },
									{ label: 'Working with the test suite', slug: 'propulsion/cookbook/working-with-test-suite' },
								],
							},
							{
								label: 'Reference',
								items: [
									{ label: 'Active Record', slug: 'propulsion/reference/active-record' },
									{ label: 'ModelCriteria & Query', slug: 'propulsion/reference/model-criteria' },
									{ label: 'Schema reference', slug: 'propulsion/reference/schema' },
									{ label: 'Configuration file', slug: 'propulsion/reference/configuration-file' },
									{ label: 'UUID & binary columns', slug: 'propulsion/reference/uuid-binary-columns' },
								],
							},
						],
					},
				]),
			],
		}),
	],
});

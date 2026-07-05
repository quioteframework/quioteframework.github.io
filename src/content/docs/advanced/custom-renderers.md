---
title: Writing a custom renderer
description: The renderer contract, initialize/render/reset, worker-mode reuse, wiring it into an output type, and shipping it as a package.
---

A **renderer** turns a template into an output string. The kernel ships one — `Quiote\Renderer\PhpRenderer`, for plain PHP templates — and PHPTAL, XSLT, and Twig are opt-in [packages](/plugins/official-packages/#template-renderers). [Templates and rendering](/basics/templates-and-rendering/) covers *using* them. This page is about *writing your own* — for a template language none of those cover (Blade, Markdown, Mustache), or a bespoke output format.

Renderers are chosen per [output type](/basics/output-types-and-content-negotiation/) through a plain config registry — **there is no renderer plugin class**. Writing one is two steps: implement the contract, then name your class in `output_types.xml`.

## The contract

A renderer extends the abstract `Quiote\Renderer\Renderer` (which lives in the kernel and is never extracted). Only `render()` is abstract; everything else has a working default:

```php
abstract class Renderer extends ParameterHolder implements ResetInterface
{
    public function initialize(Context $context, array $parameters = []): void;
    public function getDefaultExtension(): string;

    abstract public function render(
        TemplateLayer $layer,
        array &$attributes = [],    // template variables, by reference
        array &$slots = [],         // slot output, by reference
        array &$moreAssigns = [],   // extra assigns (e.g. 'inner'), by reference
    ): string;

    public function reset(): void;  // worker-mode reuse (ResetInterface)
}
```

The smallest possible renderer:

```php
<?php
namespace App\Renderer;

use Quiote\Renderer\Renderer;
use Quiote\View\TemplateLayer;

final class MyRenderer extends Renderer
{
    protected $defaultExtension = '.my';

    public function render(TemplateLayer $layer, array &$attributes = [], array &$slots = [], array &$moreAssigns = []): string
    {
        return 'rendered: ' . $layer->getResourceStreamIdentifier();
    }
}
```

`render()` returns the produced output as a **string** — it must never `echo` or `exit`. Returning a string rather than writing to output is what makes renderers safe under [worker mode](/architecture/deployment/).

## The four inputs to `render()`

- **`$layer`** — the [layer](/basics/templates-and-rendering/#layouts-and-layers) being rendered. Call `$layer->getResourceStreamIdentifier()` for the resolved template path — already extension-resolved and existence-checked. **Never do your own template-file lookup**; resolution (search paths, i18n fallback) is the layer's job, and a renderer that reimplements it will diverge from the rest of the app.
- **`$attributes`** — the view's data (what your template renders). Respect `$this->extractVars` / `$this->varName` (below) rather than hardcoding how the data is exposed — apps configure this per renderer and expect every engine to honour the same choice.
- **`$slots`** — already-rendered output of any [embedded actions](/basics/templates-and-rendering/#slots-embedding-one-action-in-another), keyed by slot name. Expose under `$this->slotsVarName`.
- **`$moreAssigns`** — extra caller-injected values; `$moreAssigns['inner']` is the rendered inner layer that an outer shell wraps. Filter/rename it through the protected helper `self::buildMoreAssigns($moreAssigns, $this->moreAssignNames)`.

## Configuration: what `initialize()` gives you

Calling `parent::initialize()` (or simply not overriding it) reads the `<parameter>` children of your `<renderer>` config block into these properties, so you don't reinvent them:

| Property | Config key | Default | Meaning |
|---|---|---|---|
| `$this->varName` | `var_name` | `template` | Key the whole `$attributes` array is exposed under (when not extracting). |
| `$this->slotsVarName` | `slots_var_name` | `slots` | Key `$slots` is exposed under. |
| `$this->extractVars` | `extract_vars` | `false` | If true, each attribute becomes its own top-level variable instead of one array under `$varName`. |
| `$this->defaultExtension` | `default_extension` | class default | Template file extension, **including the dot**. |
| `$this->assigns` | `assigns` | `[]` | Maps template-variable names to `Context` getters (see below). |

`initialize()` throws a `QuioteException` if `extractVars` is false and `varName === slotsVarName` — they would collide in the template namespace.

### Exposing `Context` getters with `assigns`

An `assigns` block maps a short template variable name to a `Context` getter. `initialize()` camel-cases the config key into a getter name (`request_data` → `getRequestData`) and keeps only the ones that are real, callable `Context` getters; the rest fall through to `moreAssignNames` (renaming `$moreAssigns` keys instead). In `render()`:

```php
foreach ($this->assigns as $variable => $getter) {
    $engine->set($variable, $this->getContext()->$getter());
}
```

```xml
<parameter name="assigns">
    <parameter name="routing">ro</parameter>   <!-- $ro = $context->getRouting() -->
    <parameter name="request">rq</parameter>   <!-- $rq = $context->getRequest() -->
</parameter>
```

## Worker-mode reuse: `IReusableRenderer` and `reset()`

Under a persistent worker ([FrankenPHP](/architecture/deployment/), RoadRunner) a renderer instance can outlive a single request, so state hygiene matters.

- **`Quiote\Renderer\IReusableRenderer`** is an empty marker interface. Implement it only when your instance is safe to reuse across `render()` calls in the same worker — it holds no per-render mutable state, or clears it every call. `OutputType::getRenderer()` checks for the marker: with it, one instance is built and reused; without it, a fresh instance (and a fresh `initialize()`) is constructed per render. The kernel's `PhpRenderer` and the `XsltRenderer` package implement it; PHPTAL's does not.
- **`reset()`** runs between requests on a reused instance. Null out anything that must not leak into the next request — a stateful engine, per-render temp arrays — and always call `parent::reset()`.

If in doubt, skip the marker and accept per-render construction; it's the safe default.

## Wiring it into an output type

Renderer selection is a plain config-driven registry, unrelated to the [plugin system](/architecture/plugins/) — no registrar call. Declare your class per output type in `output_types.xml`:

```xml
<output_type name="html">
    <renderers default="md">
        <renderer name="php" class="Quiote\Renderer\PhpRenderer" />
        <renderer name="md" class="App\Renderer\MarkdownRenderer">
            <parameter name="var_name">data</parameter>
        </renderer>
    </renderers>
</output_type>
```

- `renderers[default]` picks the renderer an output type uses when a view doesn't name one explicitly; a layer can override with a `renderer` attribute, so one output type can mix engines (an XSLT export beside PHP-rendered HTML).
- Any `<parameter>` children become the array passed to `initialize()` — this is how `var_name`, `encoding`, `assigns`, etc. reach your renderer.
- At runtime `Quiote\Controller\OutputType::getRenderer($name = null)` does `new $class()`, calls `initialize($context, $parameters)`, and caches the instance only if it implements `IReusableRenderer`.

No schema change is needed — `<renderer>` with arbitrary nested `<parameter>` blocks is already open-ended. A third-party renderer therefore needs **zero core integration** beyond installing its package and adding these few lines.

## A worked example

A renderer that runs a PHP template to produce Markdown, then converts it to HTML:

```php
<?php
namespace App\Renderer;

use Quiote\Renderer\{Renderer, IReusableRenderer};
use Quiote\View\TemplateLayer;

final class MarkdownRenderer extends Renderer implements IReusableRenderer
{
    protected $defaultExtension = '.md.php';

    public function render(
        TemplateLayer $layer,
        array &$attributes = [],
        array &$slots = [],
        array &$moreAssigns = [],
    ): string {
        $template = $layer->getResourceStreamIdentifier();
        if ($template === null || $template === '') {
            return '';
        }

        // Build the template scope, honouring extract_vars / var_name / slots.
        $scope = $this->extractVars ? $attributes : [$this->varName => $attributes];
        $scope[$this->slotsVarName] = $slots;

        // Run the PHP template to Markdown source in an isolated scope.
        $markdown = (static function () use ($template, $scope) {
            extract($scope, EXTR_SKIP);
            ob_start();
            require $template;
            return ob_get_clean();
        })();

        return $this->toHtml($markdown);
    }

    private function toHtml(string $markdown): string { /* ... */ }
}
```

Because it holds no per-render state, it's safe to mark `IReusableRenderer`. Nothing in your actions or views changes — they set attributes and return a view name; the configured renderer decides how that becomes bytes.

## Shipping it as a package

The official renderers — [`quioteframework/phptal`](/plugins/official-packages/#quioteframeworkphptal), [`quioteframework/xslt`](/plugins/official-packages/#quioteframeworkxslt), and [`quioteframework/twig`](/plugins/official-packages/#quioteframeworktwig) — are just renderer classes packaged for Composer, and yours can follow the same shape:

- **`composer.json`** — `type: library`, and `require` the kernel (`quioteframework/quiote`) plus your engine library. PSR-4 autoload a namespace like `Vendor\Renderer\Engine\` → `src/`.
- **`src/EngineRenderer.php`** — the renderer class (nothing more is required; there's no plugin to register).
- **`README.md`** — the `output_types.xml` snippet to enable it, and any renderer-specific parameters (`encoding`, an `envelope` toggle, …).
- **`tests/`** — extend `Quiote\Testing\UnitTestCase`, build a real `Quiote\View\FileTemplateLayer` pointed at a temp template, `$layer->setRenderer($renderer)`, then call `$renderer->render(...)` (or `$layer->execute(...)`) and assert on the output.

:::caution[Template path gotcha in tests]
`FileTemplateLayer` appends `getDefaultExtension()` itself, so set its `template` parameter to an absolute path **without** the extension — a path that already includes it gets the extension doubled.
:::

The three shipped renderers make good references: **phptal** wraps `phptal/phptal` with a compiled-template cache under `<core.cache_dir>/templates/phptal/`; **xslt** wraps `ext-xsl`/`ext-dom` with no external library and envelope-wraps the inner content plus slots into one XML document (opt out via `envelope=false`); **twig** wraps `twig/twig` with a small `TemplateLayerLoader` that adapts Twig's loader to Quiote's layer resolution so i18n/fallback rules still apply.

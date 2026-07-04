---
title: Writing a custom renderer
description: The renderer contract, the built-in PHP/PHPTAL/XSLT renderers, and how to write and register your own.
---

A **renderer** turns a template into output. Quiote ships three, and [Templates and rendering](/basics/templates-and-rendering/) covers using them. This page is about writing your own — for a template language the framework doesn't include (Twig, Blade, Markdown), or a bespoke output format.

## The contract

A renderer extends `Quiote\Renderer\Renderer` and implements one method:

```php
abstract public function render(
    TemplateLayer $layer,
    array &$attributes = [],    // template variables, by reference
    array &$slots = [],         // slot output, by reference
    array &$moreAssigns = [],   // extra assigns (e.g. 'inner'), by reference
): string;
```

- **`$layer`** is the [layer](/basics/templates-and-rendering/#layouts-and-layers) being rendered. Call `$layer->getResourceStreamIdentifier()` to get the template file path.
- **`$attributes`** are the view's attributes — the data your template renders.
- **`$slots`** hold the output of any [embedded actions](/basics/templates-and-rendering/#slots-embedding-one-action-in-another).
- **`$moreAssigns`** carries extra values; `$moreAssigns['inner']` is the rendered content of the inner layer, which an outer shell layer wraps.

`render()` returns the produced output as a **string** — it must not echo or exit. Returning a string (rather than writing to output) is what makes renderers safe under [worker mode](/architecture/deployment/).

### Configuration hooks

The base class reads several parameters in `initialize()`, which you can honour or ignore:

- `var_name` (default `template`) — the variable name the attributes are exposed under.
- `slots_var_name` (default `slots`), `extract_vars` (extract attributes into individual variables), `default_extension`, and `assigns` (map context getters to template variable names).

Set `protected $defaultExtension` so the framework knows your template file extension when it resolves the template path.

### Reusable renderers

If your renderer is stateless and safe to reuse across renders, implement the marker interface `Quiote\Renderer\IReusableRenderer`. The output type then builds one instance and reuses it; without it, a fresh instance is created per render. The built-in `PhpRenderer` and `XsltRenderer` are reusable; `PhptalRenderer` is not.

## The built-in renderers

| Renderer | Extension | Notes |
|---|---|---|
| `Quiote\Renderer\PhpRenderer` | `.php` | Plain PHP templates — the default; reusable. Also used for JSON/XML output types (a PHP template that emits the format). |
| `Quiote\Renderer\PhptalRenderer` | `.tal` | PHPTAL; compiles templates into the cache dir. |
| `Quiote\Renderer\XsltRenderer` | `.xsl` | XSLT; loads the inner content as a DOM and runs an `XSLTProcessor`. Reusable. |

Note there is no separate `JsonRenderer` — JSON and XML output are produced by a PHP template under `PhpRenderer` with the appropriate `Content-Type`. `PhpRenderer` is the best model to read when writing your own.

## Writing one

A renderer that runs Markdown-in-PHP templates, start to finish:

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

        // Render the PHP template to Markdown source, then convert to HTML.
        $markdown = (function () use ($template, $attributes) {
            ob_start();
            $data = $attributes;      // exposed as $data in the template
            require $template;
            return ob_get_clean();
        })();

        return $this->toHtml($markdown);
    }

    private function toHtml(string $markdown): string { /* ... */ }
}
```

## Registering it

Renderers are configured per [output type](/basics/output-types-and-content-negotiation/) in `output_types.xml`. Add your class under the output type's `<renderers>` and, if it should be the one used, name it as the `default`:

```xml
<output_type name="html">
    <renderers default="md">
        <renderer name="md" class="App\Renderer\MarkdownRenderer">
            <ae:parameter name="var_name">data</ae:parameter>
        </renderer>
    </renderers>
</output_type>
```

The framework instantiates your renderer, calls `initialize()` with those parameters, and (if it implements `IReusableRenderer`) caches the instance. A layer can also name a non-default renderer with a `renderer` attribute, so one output type can mix renderers — an XSLT document export alongside PHP-rendered HTML, for instance. Nothing in your actions or views changes; they set attributes and return a view name, and the configured renderer decides how that becomes bytes.

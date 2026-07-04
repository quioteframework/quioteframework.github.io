---
title: Templates and rendering
description: How renderers, layouts, layers, and template variables produce a view's output.
---

Once a view has decided what to show, a **renderer** turns a **template** into output. Quiote's default renderer runs plain PHP templates; layouts and layers let you compose a page from nested pieces. Nothing here is opinionated about your front end — the default is PHP files, and swapping in another renderer is a config change.

## Renderers

A renderer implements `Quiote\Renderer\Renderer`. The framework ships several:

| Renderer | Templates |
|---|---|
| `Quiote\Renderer\PhpRenderer` | Plain PHP (`.php`) — the default |
| `Quiote\Renderer\PhptalRenderer` | PHPTAL |
| `Quiote\Renderer\XsltRenderer` | XSLT |

You select the renderer per output type in `output_types` (see [Output types](/basics/output-types-and-content-negotiation/)):

```xml
<renderers default="php">
    <renderer name="php" class="Quiote\Renderer\PhpRenderer" />
</renderers>
```

## Template variables

The `PhpRenderer` exposes the view's attributes to the template as a single array — `$template` by default:

```php
<!DOCTYPE html>
<html lang="en">
<head>
    <title><?php echo htmlspecialchars($template['title'] ?? '', ENT_QUOTES, 'UTF-8'); ?></title>
</head>
<body>
    <h1><?php echo htmlspecialchars($template['post']['heading'], ENT_QUOTES, 'UTF-8'); ?></h1>
</body>
</html>
```

Where do those values come from? Everything the action set with `setAttribute()`, plus everything the view set, is visible in `$template`. The attribute the action set as `post` is `$template['post']` in the template.

:::caution[Escaping is your job]
The PHP renderer does not auto-escape. Escape output yourself with `htmlspecialchars()` (or an escaper of your choice). This is a deliberate consequence of the plain-PHP renderer — it does not stand between you and PHP.
:::

The variable name is configurable per renderer (`var_name`, default `template`), as are `extract_vars` (extract attributes into individual variables), `slots_var_name`, and `default_extension`.

## Layouts and layers

A view rarely renders a single file. A page is usually a **layout** made of **layers** — for example, an outer HTML shell wrapping an inner content layer. Layouts and their layers are declared in the output type:

```xml
<layouts default="default">
    <layout name="default">
        <layer name="content" />
    </layout>
</layouts>
```

In the view, `loadLayout()` reads this layout for the current output type and prepares its layers:

```php
public function executeHtml(WebRequest $rd)
{
    $this->loadLayout();          // prepare the "content" layer
    $this->setAttribute('title', 'Home');
    // returning null → the prepared layers render
}
```

When `executeHtml()` returns nothing but layers are loaded, the framework renders each layer in order. The output of an inner layer is passed to the next as `$inner` — so an outer shell layer can wrap the content:

```php
<!-- shell layer template -->
<!DOCTYPE html>
<html>
<body>
    <?php echo $inner; ?>   <!-- rendered content layer -->
</body>
</html>
```

This is why `loadLayout()` matters: without it, `executeHtml()` returning nothing produces an empty body, because there are no layers to render.

## Template location

Templates live in the module's `Templates/` directory, named after the action and view. An `Index` action returning the `Success` view renders `Modules/Default/Templates/IndexSuccess.php`. Keeping the names aligned is what keeps the wiring implicit — see [Actions and views](/architecture/actions-and-views/).

## Slots: embedding one action in another

A view can render the output of *another* action inline — a "slot". Use it for shared fragments like a navigation bar or a sidebar widget that has its own action and view:

```php
public function executeHtml(WebRequest $rd)
{
    $this->loadLayout();
    $this->setAttribute('nav', $this->renderSlot('Default', 'Navigation'));
}
```

`renderSlot($module, $action, $arguments = null, $outputType = null)` runs the named action through the framework (its own validation, view, and template) and returns the rendered string, which you can then place in the parent template. Slots are prepared by `SlotMiddleware` in the pipeline, so they participate in the normal execution model rather than being a side channel.

## Choosing a different renderer

Because the renderer is per output type, you can render HTML with PHP templates and, say, a document export with XSLT — in the same app — by declaring each output type with its own renderer. Nothing in the action or view changes; they set attributes and return content, and the configured renderer decides how that becomes bytes.

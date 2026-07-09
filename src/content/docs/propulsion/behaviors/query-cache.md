---
title: Query Cache Behavior
description: Cache the SQL translation of a query object to speed up repeated queries.
---

The `query_cache` behavior gives a speed boost to Propulsion queries by caching the transformation of a PHP query object into reusable SQL code.

## Basic usage

In `schema.xml`, use the `<behavior>` tag to add the `query_cache` behavior to a table:

```xml
<table name="book">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="title" type="varchar" required="true" primaryString="true" />
  <behavior name="query_cache" />
</table>
```

After you rebuild your model, all queries on this object can be cached. To trigger the query cache on a particular query, give it a query key using `setQueryKey()` — a unique identifier of your choosing, used for cache lookups:

```php
$title = 'War And Peace';
$books = BookQuery::create()
    ->setQueryKey('search book by title')
    ->filterByTitle($title)
    ->findOne();
```

The first time Propulsion executes the termination method, it computes the SQL translation of the query object and stores it in a cache backend (APC by default). The next time you run the same query, it executes faster, even with different parameters:

```php
$title = 'Anna Karenina';
$books = BookQuery::create()
    ->setQueryKey('search book by title')
    ->filterByTitle($title)
    ->findOne();
```

:::note
The more complex the query, the greater the boost you get from the query cache behavior.
:::

## Parameters

You can change the cache backend and the cache lifetime (in seconds) with the `backend` and `lifetime` parameters:

```xml
<table name="book">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="title" type="varchar" required="true" primaryString="true" />
  <behavior name="query_cache">
    <parameter name="backend" value="custom" />
    <parameter name="lifetime" value="600" />
  </behavior>
</table>
```

To implement a custom cache backend, override the generated `cacheContains()`, `cacheFetch()`, and `cacheStore()` methods in the query object. For instance, to implement query caching with a PSR-16 cache and memcached:

```php
class BookQuery extends BaseBookQuery
{
    private static ?\Psr\SimpleCache\CacheInterface $cacheBackend = null;

    public function cacheContains($key): bool
    {
        return $this->getCacheBackend()->has($key);
    }

    public function cacheFetch($key): mixed
    {
        return $this->getCacheBackend()->get($key);
    }

    public function cacheStore($key, $value): bool
    {
        return $this->getCacheBackend()->set($key, $value, 7200);
    }

    protected function getCacheBackend(): \Psr\SimpleCache\CacheInterface
    {
        return self::$cacheBackend ??= new \Symfony\Component\Cache\Psr16Cache(
            new \Symfony\Component\Cache\Adapter\MemcachedAdapter(
                \Symfony\Component\Cache\Adapter\MemcachedAdapter::createConnection('memcached://localhost:11211'),
            ),
        );
    }
}
```

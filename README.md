# @lp-labs/allocation-market

Allocates finite integer capacity by descending priority, then proportionally shares each priority tier with exact largest-remainder arithmetic and input-order tie breaking. Results explain quota and capacity shortfalls.

## Install

```sh
npm install @lp-labs/allocation-market
```

## Quickstart

```js
import { allocateMarket } from '@lp-labs/allocation-market';

const result = allocateMarket(10, [
  { id: 'urgent', demand: 8, priority: 2, quota: 6 },
  { id: 'standard', demand: 8, priority: 1 },
]);
console.log(result.requests.map(({ id, allocated, reasons }) => ({ id, allocated, reasons })));
```

CommonJS: `const { allocateMarket } = require('@lp-labs/allocation-market');`.

## API and types

- Runtime export `allocateMarket(capacity, requests, options?): AllocationMarketResult`.
- `MarketRequest` contains unique `id`, nonnegative integer `demand`, nonnegative integer `priority` (larger values are served first), and optional nonnegative integer `quota`. A quota caps a request's eligible amount; it is not a reservation or guarantee.
- `AllocationOptions.maxRequests` optionally lowers the default request bound.
- `AllocationMarketResult` reports total `capacity`, total `allocated`, `unusedCapacity`, and input-ordered `RequestAllocation` entries.
- Each `RequestAllocation` gives `demand`, `allocated`, `unfilled`, and immutable `reasons`: `quota`, `capacity`, or `lower-priority`.

## Rules, errors, and limits

Counts are exact safe integers bounded to 1,000,000,000; combined demand is also capped at that value. Up to 100,000 requests are allowed by default. Within one priority, the allocator apportions available capacity proportional to `min(demand, quota)` (or demand without a quota), using integer largest remainders; equal remainders favor earlier input rows. A lower tier receives capacity only after higher tiers' eligible demand is fully met. Zero demand/capacity is valid. The output preserves input order and never allocates more than demand, quota, or remaining capacity.

Malformed/duplicate records throw `TypeError`; negative, fractional, unsafe, or oversized counts throw `RangeError`. `capacity` is a single shared pool and priorities are nonnegative integers. The policy is deterministic, not a market-clearing price model, entitlement decision, or optimum for other objectives. To customize fairness, pre-group or reorder equal-priority requests to establish the documented stable tie order, and encode per-request ceilings with `quota`.

`npm run build`, `npm run typecheck`, `npm test`, `npm run format`, and `npm run format:check` are available. Node.js 18+; no runtime or peer dependencies.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.

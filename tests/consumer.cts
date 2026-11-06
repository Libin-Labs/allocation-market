import market = require('@lp-labs/allocation-market');

const result: market.AllocationMarketResult = market.allocateMarket(2, [
  { id: 'x', demand: 3, priority: 0 },
]);
void result.requests[0]?.allocated;

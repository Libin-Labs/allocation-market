import {
  allocateMarket,
  type AllocationMarketResult,
  type AllocationOptions,
  type MarketRequest,
} from '@lp-labs/allocation-market';

const requests: MarketRequest[] = [{ id: 'a', demand: 4, priority: 2, quota: 3 }];
const options: AllocationOptions = { maxRequests: 10 };
const result: AllocationMarketResult = allocateMarket(3, requests, options);
void result.unusedCapacity;
// @ts-expect-error priorities are integer counts.
const invalid: MarketRequest = { id: 'bad', demand: 1, priority: 'high' };
void invalid;

export interface MarketRequest {
  id: string;
  demand: number;
  priority: number;
  quota?: number;
}

export interface AllocationOptions {
  maxRequests?: number;
}

export interface RequestAllocation {
  readonly id: string;
  readonly priority: number;
  readonly demand: number;
  readonly quota?: number;
  readonly allocated: number;
  readonly unfilled: number;
  readonly reasons: readonly ('capacity' | 'quota' | 'lower-priority')[];
}

export interface AllocationMarketResult {
  readonly capacity: number;
  readonly allocated: number;
  readonly unusedCapacity: number;
  readonly requests: readonly RequestAllocation[];
}

const MAX_REQUESTS = 100_000;
const MAX_COUNT = 1_000_000_000;

function plainRecord(value: unknown, fields: readonly string[], label: string) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    throw new TypeError(`${label} must be a plain object.`);
  }
  const result: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    const descriptor =
      typeof key === 'string' ? Object.getOwnPropertyDescriptor(value, key) : undefined;
    if (
      typeof key !== 'string' ||
      !fields.includes(key) ||
      !descriptor?.enumerable ||
      !('value' in descriptor)
    ) {
      throw new TypeError(`${label} contains an unsupported or non-data property.`);
    }
    result[key] = descriptor.value;
  }
  return result;
}

function count(value: unknown, label: string, maximum = MAX_COUNT): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    throw new RangeError(`${label} must be a safe integer from 0 to ${maximum}.`);
  }
  return value as number;
}

function id(value: unknown): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 128) {
    throw new TypeError('Request ID must contain 1..128 characters.');
  }
  return value;
}

export function allocateMarket(
  capacityInput: number,
  inputRequests: readonly MarketRequest[],
  options: AllocationOptions = {},
): AllocationMarketResult {
  const capacity = count(capacityInput, 'capacity');
  if (!Array.isArray(inputRequests)) throw new TypeError('requests must be an array.');
  const parsedOptions = plainRecord(options, ['maxRequests'], 'options');
  const maxRequests = count(parsedOptions.maxRequests ?? MAX_REQUESTS, 'maxRequests', MAX_REQUESTS);
  if (maxRequests < 1 || inputRequests.length > maxRequests) {
    throw new RangeError(`requests must contain at most ${maxRequests} entries.`);
  }
  const seen = new Set<string>();
  let totalDemand = 0;
  const requests = Array.from(inputRequests, (value, index) => {
    const request = plainRecord(value, ['id', 'demand', 'priority', 'quota'], 'request');
    const requestId = id(request.id);
    if (seen.has(requestId)) throw new TypeError(`Duplicate request ID: ${requestId}`);
    seen.add(requestId);
    const demand = count(request.demand, 'demand');
    const priority = count(request.priority, 'priority', Number.MAX_SAFE_INTEGER);
    const quota = request.quota === undefined ? undefined : count(request.quota, 'quota');
    totalDemand += demand;
    if (!Number.isSafeInteger(totalDemand) || totalDemand > MAX_COUNT) {
      throw new RangeError(`Combined demand must not exceed ${MAX_COUNT}.`);
    }
    const eligible = Math.min(demand, quota ?? demand);
    return { id: requestId, demand, priority, quota, eligible, allocated: 0, index };
  });
  const priorities = [...new Set(requests.map((request) => request.priority))].sort(
    (a, b) => b - a,
  );
  const tiers = new Map<number, typeof requests>();
  for (const request of requests) {
    const tier = tiers.get(request.priority);
    if (tier) tier.push(request);
    else tiers.set(request.priority, [request]);
  }
  let remainingCapacity = capacity;
  for (const priority of priorities) {
    const tier = tiers.get(priority)!;
    const eligibleTotal = tier.reduce((sum, request) => sum + request.eligible, 0);
    if (remainingCapacity === 0 || eligibleTotal === 0) continue;
    const amount = Math.min(remainingCapacity, eligibleTotal);
    const denominator = BigInt(eligibleTotal);
    const shares = tier.map((request) => {
      const numerator = BigInt(amount) * BigInt(request.eligible);
      return {
        request,
        share: Number(numerator / denominator),
        remainder: numerator % denominator,
      };
    });
    let leftover = amount - shares.reduce((sum, share) => sum + share.share, 0);
    const ranked = [...shares].sort((left, right) =>
      left.remainder === right.remainder
        ? left.request.index - right.request.index
        : left.remainder > right.remainder
          ? -1
          : 1,
    );
    for (const share of ranked) {
      if (leftover === 0) break;
      share.share++;
      leftover--;
    }
    for (const share of shares) share.request.allocated = share.share;
    remainingCapacity -= amount;
  }
  const maxFundedPriority = requests.reduce(
    (maximum, request) => (request.allocated > 0 ? Math.max(maximum, request.priority) : maximum),
    -1,
  );
  const resultRequests = requests.map((request) => {
    const unfilled = request.demand - request.allocated;
    const reasons: ('capacity' | 'quota' | 'lower-priority')[] = [];
    if (request.quota !== undefined && request.quota < request.demand) reasons.push('quota');
    if (request.allocated < request.eligible) {
      const capacityUsedByHigherPriority = maxFundedPriority > request.priority;
      reasons.push(
        request.allocated === 0 && capacityUsedByHigherPriority ? 'lower-priority' : 'capacity',
      );
    }
    return Object.freeze({
      id: request.id,
      priority: request.priority,
      demand: request.demand,
      ...(request.quota === undefined ? {} : { quota: request.quota }),
      allocated: request.allocated,
      unfilled,
      reasons: Object.freeze(reasons),
    });
  });
  const allocated = capacity - remainingCapacity;
  return Object.freeze({
    capacity,
    allocated,
    unusedCapacity: remainingCapacity,
    requests: Object.freeze(resultRequests),
  });
}

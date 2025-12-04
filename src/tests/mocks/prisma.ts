/**
 * Prisma Mock
 * In-memory mock for Prisma Client with full type safety
 */

import { vi } from 'vitest';

// =============================================================================
// Types
// =============================================================================

type MockData = Record<string, unknown[]>;

interface MockPrismaModel {
  findUnique: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  createMany: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  aggregate: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
}

// =============================================================================
// Create Mock Model
// =============================================================================

function createMockModel(modelName: string, store: MockData): MockPrismaModel {
  if (!store[modelName]) {
    store[modelName] = [];
  }

  const getStore = () => store[modelName];

  return {
    findUnique: vi.fn().mockImplementation(async ({ where }) => {
      const items = getStore();
      return items.find((item) => {
        const record = item as Record<string, unknown>;
        return Object.entries(where).every(
          ([key, value]) => record[key] === value
        );
      }) || null;
    }),

    findFirst: vi.fn().mockImplementation(async ({ where }) => {
      const items = getStore();
      if (!where) return items[0] || null;
      return items.find((item) => {
        const record = item as Record<string, unknown>;
        return Object.entries(where).every(
          ([key, value]) => record[key] === value
        );
      }) || null;
    }),

    findMany: vi.fn().mockImplementation(async ({ where, take, skip, orderBy } = {}) => {
      let items = [...getStore()];

      if (where) {
        items = items.filter((item) => {
          const record = item as Record<string, unknown>;
          return Object.entries(where).every(
            ([key, value]) => record[key] === value
          );
        });
      }

      if (orderBy) {
        const [field, order] = Object.entries(orderBy)[0] as [string, 'asc' | 'desc'];
        items.sort((a, b) => {
          const aVal = (a as Record<string, unknown>)[field];
          const bVal = (b as Record<string, unknown>)[field];
          if (aVal === bVal) return 0;
          const comparison = aVal! > bVal! ? 1 : -1;
          return order === 'desc' ? -comparison : comparison;
        });
      }

      if (skip) {
        items = items.slice(skip);
      }

      if (take) {
        items = items.slice(0, take);
      }

      return items;
    }),

    create: vi.fn().mockImplementation(async ({ data }) => {
      const newItem = {
        id: `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      getStore().push(newItem);
      return newItem;
    }),

    createMany: vi.fn().mockImplementation(async ({ data }) => {
      const items = data.map((item: Record<string, unknown>) => ({
        id: `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...item,
      }));
      getStore().push(...items);
      return { count: items.length };
    }),

    update: vi.fn().mockImplementation(async ({ where, data }) => {
      const items = getStore();
      const index = items.findIndex((item) => {
        const record = item as Record<string, unknown>;
        return Object.entries(where).every(
          ([key, value]) => record[key] === value
        );
      });

      if (index === -1) {
        throw new Error('Record not found');
      }

      const updated = {
        ...items[index],
        ...data,
        updatedAt: new Date(),
      };
      items[index] = updated;
      return updated;
    }),

    updateMany: vi.fn().mockImplementation(async ({ where, data }) => {
      const items = getStore();
      let count = 0;

      items.forEach((item, index) => {
        const record = item as Record<string, unknown>;
        const matches = Object.entries(where).every(
          ([key, value]) => record[key] === value
        );
        if (matches) {
          items[index] = { ...record, ...data, updatedAt: new Date() };
          count++;
        }
      });

      return { count };
    }),

    upsert: vi.fn().mockImplementation(async ({ where, create, update }) => {
      const items = getStore();
      const existing = items.find((item) => {
        const record = item as Record<string, unknown>;
        return Object.entries(where).every(
          ([key, value]) => record[key] === value
        );
      });

      if (existing) {
        const index = items.indexOf(existing);
        const updated = {
          ...existing,
          ...update,
          updatedAt: new Date(),
        };
        items[index] = updated;
        return updated;
      }

      const newItem = {
        id: `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...create,
      };
      items.push(newItem);
      return newItem;
    }),

    delete: vi.fn().mockImplementation(async ({ where }) => {
      const items = getStore();
      const index = items.findIndex((item) => {
        const record = item as Record<string, unknown>;
        return Object.entries(where).every(
          ([key, value]) => record[key] === value
        );
      });

      if (index === -1) {
        throw new Error('Record not found');
      }

      const deleted = items[index];
      items.splice(index, 1);
      return deleted;
    }),

    deleteMany: vi.fn().mockImplementation(async ({ where } = {}) => {
      const items = getStore();
      let count = 0;

      if (!where) {
        count = items.length;
        store[modelName] = [];
        return { count };
      }

      const toKeep = items.filter((item) => {
        const record = item as Record<string, unknown>;
        const matches = Object.entries(where).every(
          ([key, value]) => record[key] === value
        );
        if (matches) count++;
        return !matches;
      });

      store[modelName] = toKeep;
      return { count };
    }),

    count: vi.fn().mockImplementation(async ({ where } = {}) => {
      const items = getStore();
      if (!where) return items.length;

      return items.filter((item) => {
        const record = item as Record<string, unknown>;
        return Object.entries(where).every(
          ([key, value]) => record[key] === value
        );
      }).length;
    }),

    aggregate: vi.fn().mockImplementation(async () => ({
      _count: { _all: getStore().length },
      _sum: {},
      _avg: {},
      _min: {},
      _max: {},
    })),

    groupBy: vi.fn().mockImplementation(async () => []),
  };
}

// =============================================================================
// Create Mock Prisma Client
// =============================================================================

export function createMockPrismaClient() {
  const store: MockData = {};

  const mockPrisma = {
    // Models
    user: createMockModel('user', store),
    circle: createMockModel('circle', store),
    membership: createMockModel('membership', store),
    subscription: createMockModel('subscription', store),
    post: createMockModel('post', store),
    comment: createMockModel('comment', store),
    transaction: createMockModel('transaction', store),
    refund: createMockModel('refund', store),
    dispute: createMockModel('dispute', store),
    auditLog: createMockModel('auditLog', store),
    processedWebhook: createMockModel('processedWebhook', store),

    // Connection methods
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),

    // Raw query methods
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(0),
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),

    // Transaction
    $transaction: vi.fn().mockImplementation(async (fn) => {
      if (Array.isArray(fn)) {
        return Promise.all(fn);
      }
      return fn(mockPrisma);
    }),

    // Store access for testing
    _store: store,
    _reset: () => {
      Object.keys(store).forEach((key) => {
        store[key] = [];
      });
    },
    _seed: (modelName: string, data: unknown[]) => {
      store[modelName] = [...data];
    },
  };

  return mockPrisma;
}

// =============================================================================
// Default Export
// =============================================================================

export const mockPrisma = createMockPrismaClient();

// Mock the actual prisma module
vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

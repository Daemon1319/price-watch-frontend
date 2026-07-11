export type Site = "UNIQLO";

export type StockStatus = "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";

export type TrackedItemStatus = "ACTIVE" | "PAUSED";

/** Access JWT only — refresh is HttpOnly cookie, not in JSON. */
export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
}

export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  fieldErrors?: Record<string, string>;
  timestamp?: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
}

export interface TrackedItem {
  id: string;
  productId: string;
  productName: string | null;
  url: string;
  site: Site;
  lastKnownPrice: number | null;
  lastKnownStockStatus: StockStatus | null;
  thumbnailUrl: string | null;
  priceThreshold: number | null;
  notifyOnRestockOnly: boolean;
  status: TrackedItemStatus;
  createdAt: string;
}

export interface CreateTrackedItemRequest {
  url: string;
  priceThreshold?: number | null;
  notifyOnRestockOnly: boolean;
}

export interface UpdateTrackedItemRequest {
  priceThreshold?: number | null;
  notifyOnRestockOnly?: boolean;
  status?: TrackedItemStatus;
}

export interface Product {
  id: string;
  name: string | null;
  url: string;
  site: Site;
  lastKnownPrice: number | null;
  lastKnownStockStatus: StockStatus | null;
  thumbnailUrl: string | null;
  lastCheckedAt: string | null;
  healthy: boolean;
}

export interface PriceHistoryPoint {
  price: number | null;
  stockStatus: StockStatus | null;
  recordedAt: string;
}

export interface DashboardSummary {
  totalTrackedItems: number;
  recentPriceDrops: PriceDropEntry[];
  unhealthyCount: number;
}

export interface PriceDropEntry {
  trackedItemId: string;
  productName: string | null;
  oldPrice: number;
  newPrice: number;
  changedAt: string;
}

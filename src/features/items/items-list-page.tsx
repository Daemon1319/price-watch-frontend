"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorAlert,
  FilterChip,
  Input,
  Label,
  PageHeader,
  Skeleton,
  Spinner,
} from "@/components/ui";
import {
  createTrackedItem,
  listTrackedItems,
} from "@/lib/api/tracked-items";
import { formatPrice, stockLabel } from "@/lib/format";
import type { TrackedItem, TrackedItemStatus } from "@/lib/types";
import { useRetryCooldown } from "@/lib/hooks/use-retry-cooldown";

function ItemsContent() {
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<TrackedItemStatus | "ALL">(
    "ALL",
  );
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const [url, setUrl] = useState("");
  const [threshold, setThreshold] = useState("");
  const [restockOnly, setRestockOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<unknown>(null);
  const [formOpen, setFormOpen] = useState(true);
  const createCooldown = useRetryCooldown(createError);
  const createBlocked = creating || createCooldown > 0;

  const size = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listTrackedItems({
        page,
        size,
        status: statusFilter === "ALL" ? undefined : [statusFilter],
      });
      setItems(res.content);
      setTotal(res.totalElements);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (createBlocked) return;
    setCreateError(null);
    setCreating(true);
    try {
      const priceThreshold =
        threshold.trim() === "" ? null : Number(threshold);
      if (priceThreshold != null && Number.isNaN(priceThreshold)) {
        throw new Error("Minimum drop amount must be a number");
      }
      if (priceThreshold != null && priceThreshold < 0) {
        throw new Error("Minimum drop amount cannot be negative");
      }
      await createTrackedItem({
        url: url.trim(),
        priceThreshold,
        notifyOnRestockOnly: restockOnly,
      });
      setUrl("");
      setThreshold("");
      setRestockOnly(false);
      setPage(0);
      await load();
    } catch (err) {
      setCreateError(err);
    } finally {
      setCreating(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / size));

  return (
    <>
      <PageHeader
        title="Tracked items"
        description="Paste a Uniqlo product URL. Optional minimum drop amount filters price-drop alerts."
        actions={
          <Button
            variant="secondary"
            size="sm"
            className="sm:hidden"
            onClick={() => setFormOpen((o) => !o)}
          >
            {formOpen ? "Hide form" : "Track new"}
          </Button>
        }
      />

      <Card className={formOpen ? "mb-6" : "mb-6 hidden sm:block"}>
        <div className="mb-4">
          <h2 className="font-semibold">Track a product</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Supported: Uniqlo product pages
          </p>
        </div>
        <form onSubmit={onCreate} className="space-y-4">
          <div>
            <Label htmlFor="url">Product URL</Label>
            <Input
              id="url"
              type="url"
              required
              inputMode="url"
              autoComplete="url"
              placeholder="https://www.uniqlo.com/ph/en/products/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="threshold">
                Min. price drop to notify (optional)
              </Label>
              <Input
                id="threshold"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="e.g. 200 — leave empty for any drop"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-[var(--muted)]">
                Not a target price. Example: 200 means “email me only if the
                price fell by at least 200.”
              </p>
            </div>
            <div className="flex items-end">
              <Checkbox
                label="Notify on restock only"
                checked={restockOnly}
                onChange={(e) => setRestockOnly(e.target.checked)}
              />
            </div>
          </div>
          <ErrorAlert error={createError} />
          <Button
            type="submit"
            disabled={createBlocked}
            className="w-full sm:w-auto"
          >
            {creating ? (
              <>
                <Spinner /> Tracking…
              </>
            ) : createCooldown > 0 ? (
              `Try again in ${createCooldown}s`
            ) : (
              "Start tracking"
            )}
          </Button>
        </form>
      </Card>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["ALL", "ACTIVE", "PAUSED"] as const).map((s) => (
          <FilterChip
            key={s}
            active={statusFilter === s}
            onClick={() => {
              setStatusFilter(s);
              setPage(0);
            }}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </FilterChip>
        ))}
        <span className="ml-auto text-xs text-[var(--muted)] tabular-nums">
          {total} total
        </span>
      </div>

      <ErrorAlert error={error} />

      {loading && items.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="Nothing tracked yet"
            description="Add a Uniqlo product URL above to start watching price and stock."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-[var(--border)]">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/items/${item.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--surface-muted)]/60 sm:gap-4 sm:px-5 sm:py-4"
                >
                  {item.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      className="size-14 shrink-0 rounded-xl object-cover bg-[var(--surface-muted)] sm:size-16"
                    />
                  ) : (
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[0.65rem] font-semibold text-[var(--muted)] sm:size-16">
                      {item.site}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-snug">
                      {item.productName || item.url}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                      {item.site} · {stockLabel(item.lastKnownStockStatus)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatPrice(item.lastKnownPrice)}
                      </span>
                      <Badge
                        tone={item.status === "ACTIVE" ? "success" : "neutral"}
                      >
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="font-semibold tabular-nums">
                      {formatPrice(item.lastKnownPrice)}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {stockLabel(item.lastKnownStockStatus)}
                    </p>
                  </div>
                  <Badge
                    className="hidden sm:inline-flex"
                    tone={item.status === "ACTIVE" ? "success" : "neutral"}
                  >
                    {item.status}
                  </Badge>
                  <span className="hidden text-[var(--muted)] sm:inline" aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-[var(--muted)]">
            Page {page + 1} of {totalPages}
          </span>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              variant="secondary"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="w-full sm:w-auto"
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="w-full sm:w-auto"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export default function ItemsPage() {
  return (
    <RequireAuth>
      <ItemsContent />
    </RequireAuth>
  );
}

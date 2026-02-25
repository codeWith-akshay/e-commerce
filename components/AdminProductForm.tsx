"use client";

// AdminProductForm — unified create + edit form.
//
// Create mode (no props):        calls createProductAction, blank fields.
// Edit mode (productId provided): calls updateProductAction, pre-filled fields.
//
// Previously two separate components (AdminProductForm + AdminProductEditForm)
// with duplicated helpers.  Merging them halves the admin-page chunk size and
// keeps the shared helpers (Label, FieldError, inputClass) in one place.

import { useActionState } from "react";
import {
  createProductAction,
  updateProductAction,
  type ProductFormState,
} from "@/lib/actions/product";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

// ── Shared types ──────────────────────────────────────────────────────────────

export interface ProductDefaults {
  title:       string;
  description: string;
  price:       number;
  stock:       number;
  categoryId:  string;
  rating:      number;
  images:      string[];
}

// ── Shared field helpers ──────────────────────────────────────────────────────

function Label({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-500">{message}</p>;
}

function inputClass(hasError?: boolean) {
  return `mt-1 block w-full rounded-lg border px-3 py-2 text-sm text-slate-800 shadow-sm transition
    placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400
    ${
      hasError
        ? "border-red-400 bg-red-50 focus:border-red-400 focus:ring-red-300"
        : "border-slate-200 bg-white focus:border-indigo-400"
    }`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  /** Omit for create mode; provide to switch into edit mode. */
  productId?: string;
  /** Pre-filled values for edit mode; omit for create mode. */
  defaults?: ProductDefaults;
  /** All available categories fetched from the DB. */
  categories?: { id: string; name: string }[];
}

// ── Form ──────────────────────────────────────────────────────────────────────

export default function AdminProductForm({ productId, defaults, categories = [] }: Props = {}) {
  const isEdit = !!productId;
  const serverAction = isEdit
    ? updateProductAction.bind(null, productId)
    : createProductAction;

  const [state, action, pending] = useActionState<ProductFormState, FormData>(
    serverAction,
    {}
  );
  const e = state.errors ?? {};

  return (
    <form action={action} noValidate className="space-y-6">
      {/* Top-level form error */}
      {e._form && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {e._form}
        </div>
      )}

      {/* ── Row 1: Title ── */}
      <div>
        <Label htmlFor="title" required>Title</Label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={200}
          placeholder={isEdit ? undefined : "e.g. Wireless Noise-Cancelling Headphones"}
          defaultValue={defaults?.title ?? ""}
          className={inputClass(!!e.title)}
          aria-describedby={e.title ? "title-err" : undefined}
        />
        <FieldError message={e.title} />
      </div>

      {/* ── Row 2: Description ── */}
      <div>
        <Label htmlFor="description" required>Description</Label>
        <textarea
          id="description"
          name="description"
          required
          rows={4}
          placeholder={isEdit ? undefined : "Detailed product description…"}
          defaultValue={defaults?.description ?? ""}
          className={inputClass(!!e.description)}
          aria-describedby={e.description ? "desc-err" : undefined}
        />
        <FieldError message={e.description} />
      </div>

      {/* ── Row 3: Price + Stock ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="price" required>Price ($)</Label>
          <input
            id="price"
            name="price"
            type="number"
            required
            min={0}
            step="0.01"
            placeholder={isEdit ? undefined : "29.99"}
            defaultValue={defaults?.price ?? ""}
            className={inputClass(!!e.price)}
          />
          <FieldError message={e.price} />
        </div>

        <div>
          <Label htmlFor="stock" required>Stock</Label>
          <input
            id="stock"
            name="stock"
            type="number"
            required
            min={0}
            step={1}
            placeholder={isEdit ? undefined : "100"}
            defaultValue={defaults?.stock ?? ""}
            className={inputClass(!!e.stock)}
          />
          <FieldError message={e.stock} />
        </div>
      </div>

      {/* ── Row 4: Category + Rating ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="categoryId" required>Category</Label>
          <select
            id="categoryId"
            name="categoryId"
            required
            defaultValue={defaults?.categoryId ?? ""}
            className={inputClass(!!e.categoryId)}
            aria-describedby={e.categoryId ? "category-err" : undefined}
          >
            <option value="" disabled>Select a category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <FieldError message={e.categoryId} />
        </div>

        <div>
          <Label htmlFor="rating">Rating (0 – 5)</Label>
          <input
            id="rating"
            name="rating"
            type="number"
            min={0}
            max={5}
            step="0.1"
            placeholder={isEdit ? undefined : "4.5"}
            defaultValue={defaults?.rating ?? "0"}
            className={inputClass(!!e.rating)}
          />
          <FieldError message={e.rating} />
        </div>
      </div>

      {/* ── Row 5: Images ── */}
      <div>
        <Label htmlFor="images">Image URLs</Label>
        <textarea
          id="images"
          name="images"
          rows={3}
          placeholder={isEdit ? undefined : "https://example.com/image1.jpg\nhttps://example.com/image2.jpg"}
          defaultValue={defaults?.images.join("\n") ?? ""}
          className={inputClass(!!e.images)}
        />
        <p className="mt-1 text-xs text-slate-400">One URL per line. Must start with http:// or https://</p>
        <FieldError message={e.images} />
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
        <Link
          href="/admin/products"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          {pending
            ? isEdit ? "Saving…"        : "Creating…"
            : isEdit ? "Save Changes" : "Create Product"
          }
        </button>
      </div>
    </form>
  );
}

import { useMemo, useState } from "react";
import ProductCard from "./ProductCard";

export default function ProductGrid({ products, stockMap, onAddToCart }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");

  const categories = useMemo(() => {
    const unique = new Set(products.map((item) => item.category));
    return ["ALL", ...Array.from(unique)];
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = category === "ALL" || product.category === category;
      const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, search, category]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search products..."
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 transition focus:ring-2"
        />
        <div className="flex flex-wrap gap-2">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                item === category
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-14 text-center text-sm text-slate-500">
          No products found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              stockQty={stockMap[product.id] ?? 0}
              onAdd={onAddToCart}
            />
          ))}
        </div>
      )}
    </section>
  );
}

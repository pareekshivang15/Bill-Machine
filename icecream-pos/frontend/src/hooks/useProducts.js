import { useEffect } from "react";
import { useProductStore } from "../store/productStore";
import { useStockStore } from "../store/stockStore";

export function useProducts() {
  const { products, loading: productsLoading, fetchProducts } = useProductStore();
  const { stockMap, loading: stockLoading, fetchStock } = useStockStore();

  useEffect(() => {
    fetchProducts();
    fetchStock();
  }, [fetchProducts, fetchStock]);

  return {
    products,
    stockMap,
    loading: productsLoading || stockLoading,
  };
}

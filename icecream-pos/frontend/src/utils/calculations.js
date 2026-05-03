export function getItemSubtotal(unitPrice, quantity) {
  return Number(unitPrice || 0) * Number(quantity || 0);
}

export function getSubtotal(cartItems = []) {
  return cartItems.reduce((sum, item) => sum + getItemSubtotal(item.unit_price, item.quantity), 0);
}

export function getDiscountAmount(subtotal, discountType, discountValue) {
  const safeSubtotal = Number(subtotal || 0);
  const safeValue = Number(discountValue || 0);

  if (safeValue <= 0) return 0;
  if (discountType === "PERCENT") {
    return Math.min((safeSubtotal * safeValue) / 100, safeSubtotal);
  }
  return Math.min(safeValue, safeSubtotal);
}

export function getBillTotals(cartItems, discountType, discountValue) {
  const subtotal = getSubtotal(cartItems);
  const discountAmount = getDiscountAmount(subtotal, discountType, discountValue);
  const total = Math.max(subtotal - discountAmount, 0);

  return {
    subtotal: Number(subtotal.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    cgst: 0,
    sgst: 0,
    total: Number(total.toFixed(2)),
  };
}

// AdminProductEditForm — deprecated shim.
//
// The component has been merged into AdminProductForm which now handles
// both create and edit modes via optional productId + defaults props.
// This re-export keeps any stale imports working without breaking changes.
// Update new code to import AdminProductForm directly.
export { default } from "./AdminProductForm";
export type { ProductDefaults } from "./AdminProductForm";
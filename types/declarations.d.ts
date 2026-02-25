// Allow side-effect CSS imports (e.g. `import "./globals.css"`) without
// TypeScript raising "Cannot find module" errors.
// Next.js handles the actual bundling; this file only satisfies the type checker.
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

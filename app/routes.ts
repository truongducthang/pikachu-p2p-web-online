// app/routes.ts
import { type RouteConfig } from "@react-router/dev/routes";

export default [
  // ... các routes hiện tại của bạn
  {
    path: ".well-known/*",
    file: "routes/well-known.tsx" // tạo file này
  },
  {
    path: "/",
    file: "routes/home.tsx"
  }
] satisfies RouteConfig;
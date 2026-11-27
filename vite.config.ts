import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// mode "solo": 서버 없이 '혼자 해보기'만 들어간 HTML 한 장 (미리보기용)
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === "solo" ? [viteSingleFile()] : [])],
  define: { __SOLO_ONLY__: JSON.stringify(mode === "solo") },
  build: {
    outDir: mode === "solo" ? "dist/solo" : "dist/client",
    emptyOutDir: true,
    // 왜무새 파티(index.html) + 왜무새 테이블(intro.html) 두 페이지
    rollupOptions: mode === "solo" ? undefined : { input: { main: "index.html", intro: "intro.html" } },
  },
  server: { proxy: { "/socket.io": { target: "http://localhost:3000", ws: true } } },
}));

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

const certPath = path.resolve(__dirname, "..", "backend-new", "ssl");

export default defineConfig({
  plugins: [
    react()
  ],
  server: {
    host: true,
    https: fs.existsSync(path.join(certPath, "cert.pem"))
      ? {
          cert: fs.readFileSync(path.join(certPath, "cert.pem")),
          key: fs.readFileSync(path.join(certPath, "key.pem")),
        }
      : true,
    port: 5173
  }
});

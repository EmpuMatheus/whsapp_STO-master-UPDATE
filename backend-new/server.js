// ===== FIX TIMEZONE WIB =====
process.env.TZ = "Asia/Jakarta";

const express = require("express");
const cors = require("cors");
const https = require("https");
const fs = require("fs");
const path = require("path");

const authRoutes = require("./routes/auth");
const verRoutes = require("./routes/verifiers");
const whsRoutes = require("./routes/whsDigital");
const warehouseRoutes = require("./routes/warehouses");
const itemOnHandRoutes = require("./routes/itemOnHand");
const counterRoutes = require("./routes/counters");
const myStoTagsRoutes = require("./routes/myStoTags");
const stoTagsRoutes = require("./routes/stoTags");
const ListTagsRoutes = require("./routes/listTags");
const locatedRoutes = require("./routes/located");
const dashboardRoutes = require("./routes/dashboard");
const generateRoutes = require("./routes/generate");
const serahTerimaRoutes = require("./routes/serahTerima");
const settingsRoutes = require("./routes/settings");

const app = express();
app.set("trust proxy", true);

/* ======= LIMIT BODY (PENTING) ======= */
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/* ======= CORS (PENTING) ======= */
app.use(cors({
  origin: true,
  credentials: true
}));
app.use("/api/auth", authRoutes);
app.use("/api/verifiers", verRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/whs", whsRoutes);
app.use("/api/item-on-hand", itemOnHandRoutes);
app.use("/api/counters", counterRoutes);
app.use("/api/my-sto-tags", myStoTagsRoutes);
app.use("/api/sto-tags", stoTagsRoutes);
app.use("/api/list-tags", ListTagsRoutes);
app.use("/api/located", locatedRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/generate", generateRoutes);
app.use("/api/serah-terima", serahTerimaRoutes);
app.use("/api/settings", settingsRoutes);

/* ======= HTTPS SERVER ======= */
const sslPath = path.join(__dirname, "ssl");
const certFile = path.join(sslPath, "cert.pem");
const keyFile = path.join(sslPath, "key.pem");

if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
  const httpsOptions = {
    cert: fs.readFileSync(certFile),
    key: fs.readFileSync(keyFile),
  };

  https.createServer(httpsOptions, app).listen(3443, "0.0.0.0", () => {
    console.log(" Server (HTTPS) running on https://0.0.0.0:3443");
  });
} else {
  console.warn(" SSL cert not found — run: node scripts/generate-ssl.js");
}

/* ======= HTTP SERVER (fallback / local) ======= */
const server = app.listen(3000, "0.0.0.0", () => {
  console.log("Server (HTTP) running on http://0.0.0.0:3000");
  console.log("Timezone:", new Date().toString());
});

server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;

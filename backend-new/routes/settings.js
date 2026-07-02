const express = require("express");
const router = express.Router();
const dbPromise = require("../db");
const auth = require("../middleware/authMiddleware");

/* =====================================================
   GET /api/settings/info — statistik database
===================================================== */
router.get("/info", auth, async (req, res) => {
  if (req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Hanya Super Admin" });
  }
  try {
    const db = await dbPromise;

    const [tagStats, userCount, whsCount, locCount, counterCount] = await Promise.all([
      db.get(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status IN ('COMPLETED','RECOUNT') THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) AS open,
          SUM(CASE WHEN status = 'RECOUNT' THEN 1 ELSE 0 END) AS recount,
          SUM(CASE WHEN status = 'RECOUNT_REQUEST' THEN 1 ELSE 0 END) AS pending_approval
        FROM sto_tags
      `),
      db.get(`SELECT COUNT(*) AS count FROM verifiers`),
      db.get(`SELECT COUNT(*) AS count FROM warehouse_master`),
      db.get(`SELECT COUNT(*) AS count FROM located`),
      db.get(`SELECT COUNT(*) AS count FROM counters`),
    ]);

    res.json({
      tags: tagStats || { total: 0, completed: 0, open: 0, recount: 0, pending_approval: 0 },
      users: userCount?.count || 0,
      warehouses: whsCount?.count || 0,
      locations: locCount?.count || 0,
      counters: counterCount?.count || 0,
    });
  } catch (err) {
    console.error("SETTINGS INFO ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* =====================================================
   POST /api/settings/reset-sto — reset seluruh data STO
===================================================== */
router.post("/reset-sto", auth, async (req, res) => {
  if (req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Hanya Super Admin" });
  }
  try {
    const db = await dbPromise;

    await db.exec("BEGIN TRANSACTION");

    // Hapus semua data transaksi STO
    await db.exec("DELETE FROM sto_tags");
    await db.exec("DELETE FROM whs_digital");
    await db.exec("DELETE FROM activity_log");
    await db.exec("DELETE FROM generate_history");
    await db.exec("DELETE FROM access_log");

    // Reset AUTOINCREMENT sequence
    const tables = ["sto_tags", "whs_digital", "activity_log", "generate_history", "access_log"];
    for (const t of tables) {
      try {
        await db.exec(`DELETE FROM sqlite_sequence WHERE name = '${t}'`);
      } catch { /* ignore if no sequence */ }
    }

    await db.exec("COMMIT");

    // Catat log reset
    try {
      const now = await db.get("SELECT datetime('now','+7 hours') AS now");
      await db.run(
        `INSERT INTO activity_log (tag_qr, whs_code, item_code, description, activity_type, pcs, m3, batch, kualitas, remark, location_name, verificator_name, created_at)
         VALUES (?, ?, ?, ?, ?, 0, 0, '', '', ?, '', ?, ?)`,
        ["SYSTEM", "SYSTEM", "SYSTEM", "SYSTEM", "RESET STO",
         `Super Admin melakukan reset Stock Opname oleh ${req.user.name}`,
         req.user.name, now.now]
      );
    } catch (logErr) {
      console.error("RESET LOG ERROR:", logErr.message);
    }

    res.json({ success: true, message: "Stock Opname berhasil di-reset" });
  } catch (err) {
    try {
      const db = await dbPromise;
      await db.exec("ROLLBACK");
    } catch {}
    console.error("RESET STO ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

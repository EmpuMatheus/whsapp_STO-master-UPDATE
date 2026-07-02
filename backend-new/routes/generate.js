const express = require("express");
const router = express.Router();
const dbPromise = require("../db");
const auth = require("../middleware/authMiddleware");

/* =====================================================
   POST /api/generate/preview
   Validasi data Excel sebelum generate
===================================================== */
router.post("/preview", auth, async (req, res) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: "Hanya admin yang bisa generate tag" });
  }

  const { rows } = req.body;
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "Data tidak valid" });
  }

  try {
    const db = await dbPromise;

    const [warehouses, locations, counters, verifiers] = await Promise.all([
      db.all("SELECT whs_code FROM warehouse_master"),
      db.all("SELECT id, loc_name FROM located"),
      db.all("SELECT id, name FROM counters"),
      db.all("SELECT id, name FROM verifiers")
    ]);

    const whsSet = new Set(warehouses.map(w => w.whs_code));
    const locMap = new Map(locations.map(l => [l.loc_name.toLowerCase(), l.id]));
    const counterMap = new Map(counters.map(c => [c.name.toLowerCase(), c.id]));
    const verifierMap = new Map(verifiers.map(v => [v.name.toLowerCase(), v.id]));

    const preview = rows.map((r, i) => {
      const whsCode = (r.Warehouse || "").toString().trim();
      const itemCode = (r["Item Code"] || "").toString().trim();
      const locName = (r.Location || "").toString().trim();
      const counterName = (r.Counter || "").toString().trim();
      const verifName = (r.Verificator || "").toString().trim();
      const detailLoc = (r["Detail Location"] || "").toString().trim();
      const jumlah = parseInt(r["Jumlah Tag"]) || 0;

      const errors = [];

      if (!whsCode) errors.push("Warehouse wajib diisi");
      else if (!whsSet.has(whsCode)) errors.push(`Warehouse "${whsCode}" tidak ditemukan`);

      if (!itemCode) errors.push("Item Code wajib diisi");

      if (!locName) errors.push("Location wajib diisi");
      else if (!locMap.has(locName.toLowerCase())) errors.push(`Location "${locName}" tidak ditemukan`);

      if (detailLoc && detailLoc.length > 30) errors.push("Detail Location melebihi 30 karakter.");

      if (!counterName) errors.push("Counter wajib diisi");
      else if (!counterMap.has(counterName.toLowerCase())) errors.push(`Counter "${counterName}" tidak ditemukan`);

      if (!verifName) errors.push("Verificator wajib diisi");
      else if (!verifierMap.has(verifName.toLowerCase())) errors.push(`Verificator "${verifName}" tidak ditemukan`);

      if (jumlah < 1) errors.push("Jumlah Tag minimal 1");

      return {
        row: i + 1,
        whs_code: whsCode,
        item_code: itemCode,
        description: r.Description || "",
        location_name: locName,
        detail_location: detailLoc,
        counter_name: counterName,
        verificator_name: verifName,
        jumlah_tag: jumlah,
        errors,
        valid: errors.length === 0
      };
    });

    const allValid = preview.every(p => p.valid);

    res.json({
      preview,
      allValid,
      totalRow: preview.length,
      totalTag: preview.reduce((sum, p) => sum + p.jumlah_tag, 0)
    });

  } catch (err) {
    console.error("PREVIEW ERROR:", err);
    res.status(500).json({ error: "Gagal validasi data" });
  }
});

/* =====================================================
   POST /api/generate/bulk
   Generate tag dari data yang sudah divalidasi
===================================================== */
router.post("/bulk", auth, async (req, res) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: "Hanya admin yang bisa generate tag" });
  }

  const { rows, filename } = req.body;
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "Data tidak valid" });
  }

  try {
    const db = await dbPromise;

    const [locations, counters, verifiers] = await Promise.all([
      db.all("SELECT id, loc_name FROM located"),
      db.all("SELECT id, name FROM counters"),
      db.all("SELECT id, name FROM verifiers")
    ]);

    const locMap = new Map(locations.map(l => [l.loc_name.toLowerCase(), l.id]));
    const counterMap = new Map(counters.map(c => [c.name.toLowerCase(), c.id]));
    const verifierMap = new Map(verifiers.map(v => [v.name.toLowerCase(), v.id]));

    let totalGenerated = 0;
    const allTags = [];

    await db.exec("BEGIN TRANSACTION");

    try {
      for (const r of rows) {
        const whsCode = (r.whs_code || "").toString().trim();
        const itemCode = (r.item_code || "").toString().trim();
        const desc = (r.description || "").toString().trim();
        const locName = (r.location_name || "").toString().trim();
        const detailLoc = (r.detail_location || "").toString().trim();
        const counterName = (r.counter_name || "").toString().trim();
        const verifName = (r.verificator_name || "").toString().trim();
        const locId = locMap.get(locName.toLowerCase()) || null;
        const counterId = counterMap.get(counterName.toLowerCase());
        const verifId = verifierMap.get(verifName.toLowerCase());
        const jumlah = parseInt(r.jumlah_tag) || 0;

        if (!counterId || !verifId || jumlah < 1) continue;
        if (detailLoc && detailLoc.length > 30) continue;

        for (let i = 0; i < jumlah; i++) {
          const prefix = Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
          const tempTag = `__TEMP__${prefix}`;

          const result = await db.run(
            `INSERT INTO sto_tags (whs_code, item_code, seq, tag_qr, verificator_id, counter_id, located_id, location_detail, status)
             VALUES (?, ?, 0, ?, ?, ?, ?, ?, 'OPEN')`,
            [whsCode, itemCode, tempTag, verifId, counterId, locId, detailLoc || null]
          );

          const newId = result.lastID;
          const seqPad = String(newId).padStart(5, "0");
          const tagQr = `${whsCode}-${itemCode}-${seqPad}`;

          await db.run(
            `UPDATE sto_tags SET tag_qr = ?, seq = ? WHERE id = ?`,
            [tagQr, newId, newId]
          );

          totalGenerated++;
          allTags.push({
            id: newId,
            tag_qr: tagQr,
            whs_code: whsCode,
            item_code: itemCode,
            description: desc,
            counter_name: counterName,
            verificator_name: verifName,
            location_name: locName,
            detail_location: detailLoc
          });
        }
      }

      // Simpan ke history
      await db.run(
        `INSERT INTO generate_history (filename, generated_by, total_row, total_tag)
         VALUES (?, ?, ?, ?)`,
        [filename || "upload.xlsx", req.user.id, rows.length, totalGenerated]
      );

      await db.exec("COMMIT");

      res.json({
        success: true,
        totalRow: rows.length,
        totalTag: totalGenerated,
        tags: allTags
      });

    } catch (err) {
      await db.exec("ROLLBACK");
      throw err;
    }

  } catch (err) {
    console.error("BULK GENERATE ERROR:", err);
    res.status(500).json({ error: "Gagal generate tag", detail: err.message });
  }
});

/* =====================================================
   GET /api/generate/history
   Riwayat generate tag
===================================================== */
router.get("/history", auth, async (req, res) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: "Akses ditolak" });
  }

  try {
    const db = await dbPromise;
    const rows = await db.all(
      `SELECT gh.*, v.name AS generated_by_name
       FROM generate_history gh
       LEFT JOIN verifiers v ON v.id = gh.generated_by
       ORDER BY gh.created_at DESC
       LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    console.error("HISTORY ERROR:", err);
    res.status(500).json({ error: "Gagal mengambil riwayat" });
  }
});

module.exports = router;

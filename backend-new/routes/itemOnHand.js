const express = require("express");
const router = express.Router();
const multer = require("multer");
const { parse } = require("csv-parse/sync");
const dbPromise = require("../db");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

/* =====================================================
   CLEAR ALL ITEM ON HAND
===================================================== */
router.post("/clear", async (req, res) => {
  try {
    const db = await dbPromise;
    await db.run("DELETE FROM item_on_hand");
    await db.run("VACUUM");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =====================================================
   IMPORT CSV ITEM ON HAND (STABLE & AUTO DELIMITER)
===================================================== */
router.post("/import-csv", upload.single("file"), async (req, res) => {
  let db;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "File tidak ditemukan" });
    }

    const clearFirst =
      String(req.body.clear || "").toLowerCase() === "true";

    /* ================= READ FILE ================= */
    let csvText = req.file.buffer.toString("utf8");
    if (csvText.includes("\u0000")) {
      csvText = req.file.buffer.toString("utf16le");
    }

    /* ================= DETECT DELIMITER ================= */
    let delimiter = ";";
    const headerLine = csvText.split(/\r?\n/)[0];
    if (headerLine.includes(";")) delimiter = ";";
    else if (headerLine.includes(",")) delimiter = ",";
    else if (headerLine.includes("\t")) delimiter = "\t";

    /* ================= PARSE CSV ================= */
    const rawRecords = parse(csvText, {
      delimiter,
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true
    });

    if (!rawRecords.length) {
      return res.status(400).json({
        error: "CSV kosong atau header tidak valid"
      });
    }

    /* ================= NORMALIZE HEADERS ================= */
    const rows = rawRecords.map(r => {
      const o = {};
      for (const k of Object.keys(r)) {
        const nk = k
          .replace(/^\uFEFF/, "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_");
        o[nk] = r[k];
      }
      return o;
    });

    db = await dbPromise;

    if (clearFirst) {
      await db.run("DELETE FROM item_on_hand");
      await db.run("VACUUM");
    }

    await db.run("BEGIN TRANSACTION");

    const stmt = await db.prepare(`
      INSERT INTO item_on_hand (
        item_code,
        description,
        item_group,
        whs_code,
        uom,
        bvolume,
        onhand_qty_pcs,
        onhand_qty_m3
      ) VALUES (?,?,?,?,?,?,?,?)
    `);

    let inserted = 0;
    let skipped = 0;

    for (const r of rows) {
      if (!r.item_code || !r.whs_code) {
        skipped++;
        continue;
      }

      await stmt.run(
        String(r.item_code).trim(),
        r.description || "",
        r.item_group || "",
        String(r.whs_code).trim(),
        r.uom || "",
        Number(r.bvolume || 0),
        Number(r.onhand_qty_pcs || 0),
        Number(r.onhand_qty_m3 || 0)
      );

      inserted++;
    }

    await stmt.finalize();
    await db.run("COMMIT");

    res.json({
      ok: true,
      delimiter,
      cleared: clearFirst,
      total: rows.length,
      inserted,
      skipped
    });

  } catch (e) {
    try {
      if (db) await db.run("ROLLBACK");
    } catch {}
    res.status(500).json({
      error: "Gagal import CSV",
      detail: e.message
    });
  }
});

/* =====================================================
   GET ALL ITEM ON HAND
===================================================== */
router.get("/", async (req, res) => {
  try {
    const db = await dbPromise;
    const rows = await db.all(`
      SELECT
        id,
        item_code,
        description,
        item_group,
        whs_code,
        uom,
        bvolume,
        onhand_qty_pcs,
        onhand_qty_m3,
        created_at
      FROM item_on_hand
      ORDER BY whs_code, item_code
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =====================================================
   LOOKUP ITEM BY QR
   FORMAT QR: WHS-ITEMCODE-SEQ
===================================================== */
router.get("/by-qr/:whs_code/:item_code", async (req, res) => {
  const { whs_code, item_code } = req.params;

  try {
    const db = await dbPromise;

    const row = await db.get(`
      SELECT
        item_code,
        description,
        item_group,
        whs_code,
        uom,
        bvolume,
        onhand_qty_pcs,
        onhand_qty_m3
      FROM item_on_hand
      WHERE TRIM(UPPER(whs_code)) = TRIM(UPPER(?))
        AND TRIM(UPPER(item_code)) = TRIM(UPPER(?))
      LIMIT 1
    `, [whs_code, item_code]);

    if (!row) {
      return res.status(404).json({
        error: "Item tidak ditemukan di Item On Hand"
      });
    }

    res.json(row);

  } catch (e) {
    res.status(500).json({
      error: "Gagal lookup item",
      detail: e.message
    });
  }
});

module.exports = router;

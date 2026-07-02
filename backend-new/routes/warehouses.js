const express = require("express");
const router = express.Router();
const dbPromise = require("../db");
const multer = require("multer");
const { parse } = require("csv-parse/sync");

const upload = multer({ storage: multer.memoryStorage() });

/* =========================
   LIST ALL
========================= */
router.get("/", async (req, res) => {
  try {
    const db = await dbPromise;
    const rows = await db.all(
      "SELECT * FROM warehouse_master ORDER BY id"
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   CREATE
========================= */
router.post("/", async (req, res) => {
  try {
    const db = await dbPromise;
    const { whs_code, whs_name } = req.body;

    if (!whs_code || !whs_name) {
      return res.status(400).json({
        error: "whs_code & whs_name required"
      });
    }

    await db.run(
      "INSERT INTO warehouse_master (whs_code, whs_name) VALUES (?, ?)",
      [whs_code.trim(), whs_name.trim()]
    );

    res.json({ ok: true });
  } catch (e) {
    if (e.message && e.message.includes("UNIQUE")) {
      return res.status(400).json({
        error: "whs_code already exists"
      });
    }
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   UPDATE
========================= */
router.put("/:id", async (req, res) => {
  try {
    const db = await dbPromise;
    const { whs_name } = req.body;

    await db.run(
      "UPDATE warehouse_master SET whs_name = ? WHERE id = ?",
      [whs_name.trim(), req.params.id]
    );

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   DELETE ONE
========================= */
router.delete("/:id", async (req, res) => {
  try {
    const db = await dbPromise;
    await db.run(
      "DELETE FROM warehouse_master WHERE id = ?",
      req.params.id
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   CLEAR ALL
========================= */
router.post("/clear", async (req, res) => {
  try {
    const db = await dbPromise;
    await db.run("DELETE FROM warehouse_master");
    await db.run("VACUUM");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =====================================================
   IMPORT CSV (FIXED & STABLE)
===================================================== */
router.post("/import-csv", upload.single("file"), async (req, res) => {
  let db;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const clearFirst =
      String(req.body.clear || "").toLowerCase() === "true";

    // =====================
    // READ FILE (UTF-8 / UTF-16)
    // =====================
    let csvText = req.file.buffer.toString("utf8");
    if (csvText.includes("\u0000")) {
      csvText = req.file.buffer.toString("utf16le");
    }

    // =====================
    // TRY PARSE WITH MULTI DELIMITER
    // =====================
    const tryParse = (delimiter) =>
      parse(csvText, {
        delimiter,
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true
      });

    let recordsRaw = [];
    let usedDelimiter = null;

    for (const d of ["\t", ";", ","]) {
      const test = tryParse(d);
      if (test.length && Object.keys(test[0]).length > 1) {
        recordsRaw = test;
        usedDelimiter = d;
        break;
      }
    }

    if (!recordsRaw.length) {
      return res.status(400).json({
        error: "CSV format not recognized (delimiter/header invalid)"
      });
    }

    // =====================
    // NORMALIZE HEADER
    // =====================
    const records = recordsRaw.map(row => {
      const obj = {};
      for (const k of Object.keys(row)) {
        const key = k
          .replace(/^\uFEFF/, "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_");
        obj[key] = row[k];
      }
      return obj;
    });

    db = await dbPromise;

    if (clearFirst) {
      await db.run("DELETE FROM warehouse_master");
    }

    await db.run("BEGIN TRANSACTION");

    let inserted = 0;
    let skipped = 0;

    for (const r of records) {
      const whs_code = (r.whs_code || "").trim();
      const whs_name = (r.whs_name || "").trim();

      if (!whs_code) {
        skipped++;
        continue;
      }

      await db.run(
        "INSERT OR REPLACE INTO warehouse_master (whs_code, whs_name) VALUES (?, ?)",
        [whs_code, whs_name]
      );

      inserted++;
    }

    await db.run("COMMIT");

    res.json({
      ok: true,
      encoding: csvText.includes("\u0000") ? "UTF-16" : "UTF-8",
      delimiter:
        usedDelimiter === "\t"
          ? "TAB"
          : usedDelimiter,
      total: records.length,
      inserted,
      skipped
    });

  } catch (e) {
    try { if (db) await db.run("ROLLBACK"); } catch {}
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

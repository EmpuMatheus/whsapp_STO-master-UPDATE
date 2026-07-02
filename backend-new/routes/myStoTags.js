const express = require("express");
const router = express.Router();
const dbPromise = require("../db");
const auth = require("../middleware/authMiddleware");

/* ===============================
   GET MY STO TAGS (FINAL)
================================ */
router.get("/", auth, async (req, res) => {
  try {
    const db = await dbPromise;

    const rows = await db.all(
      `
      SELECT
        s.id,
        s.tag_qr,
        s.whs_code,
        s.item_code,
        COALESCE(ioh.description, '-') AS description,
        v.name AS verificator_name,
        c.name AS counter_name,
        l.loc_name AS location_name,
        s.location_detail,

        CASE
          WHEN w.tag_qr IS NOT NULL THEN 'CLOSED'
          ELSE 'READY'
        END AS status,

        w.created_at AS scanned_at,
        s.created_at

      FROM sto_tags s

      LEFT JOIN verifiers v ON v.id = s.verificator_id
      LEFT JOIN counters c ON c.id = s.counter_id
      LEFT JOIN located l ON l.id = s.located_id
      LEFT JOIN item_on_hand ioh
        ON TRIM(ioh.item_code) = TRIM(s.item_code)
       AND TRIM(ioh.whs_code) = TRIM(s.whs_code)
      LEFT JOIN whs_digital w ON w.tag_qr = s.tag_qr

      WHERE s.verificator_id = ?
      ORDER BY s.created_at DESC
      `,
      [req.user.id]
    );

    res.json(rows);
  } catch (err) {
    console.error("My STO TAGS error:", err);
    res.status(500).json({
      error: "Failed load STO tags",
      detail: err.message
    });
  }
});

/* ===============================
   SCAN → INSERT KE whs_digital
================================ */
router.post("/:id/scan", auth, async (req, res) => {
  try {
    const db = await dbPromise;

    const tag = await db.get(
      `SELECT * FROM sto_tags WHERE id = ?`,
      [req.params.id]
    );

    if (!tag) {
      return res.status(404).json({
        error: "Tag tidak ditemukan"
      });
    }

    if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role) && tag.verificator_id !== req.user.id) {
      return res.status(403).json({
        error: "Tag tidak ditemukan / bukan milikmu"
      });
    }

    // 🔥 CEK SUDAH PERNAH SCAN
    const exist = await db.get(
      `SELECT * FROM whs_digital WHERE tag_qr = ?`,
      [tag.tag_qr]
    );

    if (exist) {
      return res.status(400).json({
        error: "Tag sudah di scan"
      });
    }

    // 🔥 INSERT KE whs_digital
    await db.run(
      `
      INSERT INTO whs_digital (
        tag_qr,
        whs_code,
        item_code,
        count_pcs,
        count_m3,
        counter_id,
        verificator_id,
        lokasi,
        kualitas
      )
      VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?)
      `,
      [
        tag.tag_qr,
        tag.whs_code,
        tag.item_code,
        tag.counter_id,
        tag.verificator_id,
        null,
        null
      ]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("SCAN ERROR:", err);
    res.status(500).json({
      error: "Failed scan tag",
      detail: err.message
    });
  }
});

/* ===============================
   INPUT QTY → UPDATE whs_digital
================================ */
router.put("/:id/input", auth, async (req, res) => {
  try {
    const { qty, lokasi, kualitas } = req.body;
    const db = await dbPromise;

    if (!qty) {
      return res.status(400).json({ error: "Qty wajib" });
    }

    const tag = await db.get(
      `SELECT * FROM sto_tags WHERE id = ?`,
      [req.params.id]
    );

    if (!tag) {
      return res.status(404).json({ error: "Tag tidak ditemukan" });
    }

    if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role) && tag.verificator_id !== req.user.id) {
      return res.status(403).json({ error: "Tag tidak valid" });
    }

    // 🔥 ambil volume
    const item = await db.get(
      `
      SELECT bvolume
      FROM item_on_hand
      WHERE item_code = ? AND whs_code = ?
      `,
      [tag.item_code, tag.whs_code]
    );

    const bvolume = Number(item?.bvolume || 0);
    const count_m3 = qty * bvolume;

    // 🔥 update whs_digital
    await db.run(
      `
      UPDATE whs_digital
      SET
        count_pcs = ?,
        count_m3  = ?,
        lokasi    = ?,
        kualitas  = ?
      WHERE tag_qr = ?
      `,
      [
        qty,
        count_m3,
        lokasi || null,
        kualitas || null,
        tag.tag_qr
      ]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("INPUT ERROR:", err);
    res.status(500).json({
      error: "Failed input qty",
      detail: err.message
    });
  }
});

module.exports = router;
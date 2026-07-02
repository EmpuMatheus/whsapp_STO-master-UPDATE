const express = require("express");
const router = express.Router();
const dbPromise = require("../db");
const auth = require("../middleware/authMiddleware");

/* =====================================================
   GET /api/whs
   AMBIL DATA WHS DIGITAL
===================================================== */
router.get("/", auth, async (req, res) => {
  try {
    const db = await dbPromise;

    const rows = await db.all(`
      SELECT
        w.id,
        w.tag_qr,
        w.whs_code,
        w.item_code,
        w.description,
        w.count_pcs,
        w.count_m3,
        w.batch,
        w.kualitas,
        w.remark,
        c.name AS counter_name,
        v.name AS verificator_name,
        l.loc_name AS location_name,
        w.created_at
      FROM whs_digital w
      LEFT JOIN counters c ON c.id = w.counter_id
      LEFT JOIN verifiers v ON v.id = w.verificator_id
      LEFT JOIN located l ON l.id = w.located_id
      ORDER BY w.created_at DESC
    `);

    res.json(rows);

  } catch (err) {
    console.error("GET WHS ERROR:", err);
    res.status(500).json({
      error: "Gagal mengambil data WHS Digital"
    });
  }
});

/* =====================================================
   POST /api/whs
   INPUT WHS DIGITAL
===================================================== */
router.post("/", auth, async (req, res) => {
  console.log("BODY:", req.body);
  console.log("USER:", req.user);

  const {
    tag_qr,
    whs_code,
    item_code,
    count_pcs,
    batch,
    remark,
    kualitas,
    counter_id,
    located_id
  } = req.body;

  const db = await dbPromise;

  try {
    await db.run("BEGIN");

    /* ================= VALIDASI TAG ================= */
    const tag = await db.get(
      `SELECT * FROM sto_tags WHERE tag_qr = ?`,
      [tag_qr]
    );

    console.log("TAG DB:", tag);

    if (!tag) {
      await db.run("ROLLBACK");
      return res.status(400).json({
        error: "Tag tidak terdaftar"
      });
    }

    // 🔥 sementara disable auth check biar debug
    // if (tag.verificator_id !== req.user.id) {
    //   return res.status(403).json({ error: "Tag bukan untuk Anda" });
    // }

    if (tag.status === "CLOSED") {
      await db.run("ROLLBACK");
      return res.status(400).json({
        error: "Tag sudah diinput"
      });
    }

    /* ================= VALIDASI QTY ================= */
    const pcs = Number(count_pcs);

    console.log("PCS:", pcs);

    if (isNaN(pcs) || pcs <= 0) {
      await db.run("ROLLBACK");
      return res.status(400).json({
        error: "Qty tidak valid"
      });
    }

    /* ================= ITEM ================= */
    const item = await db.get(
      `
      SELECT bvolume, description
      FROM item_on_hand
      WHERE item_code = ?
        AND whs_code = ?
      `,
      [item_code, whs_code]
    );

    console.log("ITEM:", item);

    const bvolume = Number(item?.bvolume || 0);
    const count_m3 = pcs * bvolume;

    /* ================= INSERT ================= */
    await db.run(
      `
      INSERT INTO whs_digital (
        tag_qr,
        whs_code,
        item_code,
        description,
        count_pcs,
        count_m3,
        batch,
        remark,
        kualitas,
        counter_id,
        located_id,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','+7 hours'))
      `,
      [
        tag_qr,
        whs_code,
        item_code,
        item?.description || "",
        pcs,
        count_m3,
        batch || "",
        remark || "",
        kualitas || "",
        counter_id,
        located_id
      ]
    );

    /* ================= UPDATE STATUS ================= */
    await db.run(
      `UPDATE sto_tags SET status='CLOSED' WHERE tag_qr = ?`,
      [tag_qr]
    );

    await db.run("COMMIT");

    res.json({ success: true });

  } catch (err) {
    await db.run("ROLLBACK");

    console.error("ERROR SAVE WHS:", err);

    res.status(500).json({
      error: err.message
    });
  }
});
module.exports = router;
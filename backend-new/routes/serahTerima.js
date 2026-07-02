const express = require("express");
const router = express.Router();
const dbPromise = require("../db");
const auth = require("../middleware/authMiddleware");

/* =====================================================
   GET /api/serah-terima
   Mengambil data tag untuk Serah Terima Tag
   Query:
     verificator_id (required)
     counter_id     (optional)
     whs_code       (optional)
     status         (optional, default OPEN)
   Response:
     { tags: [...], summary: { ... }, verifier: { ... } }
   Order: seq ASC
===================================================== */
router.get("/", auth, async (req, res) => {
  try {
    const db = await dbPromise;

    const { verificator_id, counter_id, whs_code, status } = req.query;

    if (!verificator_id) {
      return res.status(400).json({ error: "verificator_id wajib diisi" });
    }

    const verifier = await db.get(
      "SELECT id, username, name FROM verifiers WHERE id = ?",
      [parseInt(verificator_id)]
    );
    if (!verifier) {
      return res.status(404).json({ error: "Verificator tidak ditemukan" });
    }

    const conditions = ["s.verificator_id = ?"];
    const params = [parseInt(verificator_id)];

    if (counter_id) {
      conditions.push("s.counter_id = ?");
      params.push(parseInt(counter_id));
    }

    if (whs_code) {
      conditions.push("s.whs_code = ?");
      params.push(whs_code);
    }

    const statusFilter = status || "OPEN";
    if (statusFilter !== "ALL") {
      conditions.push("s.status = ?");
      params.push(statusFilter);
    }

    const whereClause = "WHERE " + conditions.join(" AND ");

    const rows = await db.all(
      `
      SELECT
        s.id,
        s.seq,
        s.tag_qr,
        s.whs_code,
        s.item_code,
        COALESCE(ioh.description, '-') AS description,
        COALESCE(ioh.uom, '') AS uom,
        l.loc_name AS location_name,
        s.location_detail,
        c.name AS counter_name,
        v.name AS verificator_name,
        COALESCE(w.count_pcs, 0) AS qty_pcs,
        COALESCE(w.first_count_pcs, 0) AS first_count_pcs,
        COALESCE(w.recount_pcs, 0) AS recount_pcs,
        COALESCE(w.batch, '') AS batch,
        s.status,
        COALESCE(w.remark, '') AS remark,
        s.created_at
      FROM sto_tags s
      LEFT JOIN verifiers v ON v.id = s.verificator_id
      LEFT JOIN counters c ON c.id = s.counter_id
      LEFT JOIN located l ON l.id = s.located_id
      LEFT JOIN item_on_hand ioh
        ON TRIM(ioh.item_code) = TRIM(s.item_code)
       AND TRIM(ioh.whs_code) = TRIM(s.whs_code)
      LEFT JOIN whs_digital w ON w.tag_qr = s.tag_qr
      ${whereClause}
      ORDER BY s.seq ASC
      `,
      params
    );

    const total = rows.length;
    const open = rows.filter(r => r.status === "OPEN").length;
    const completed = rows.filter(r => r.status === "COMPLETED").length;
    const approvalSuccess = rows.filter(r => r.status === "APPROVAL_SUCCESS").length;
    const recount = rows.filter(r => r.status === "RECOUNT").length;

    const minus = rows.filter(r => {
      return r.status === "COMPLETED" && r.qty_pcs < 0;
    }).length;

    const over = rows.filter(r => {
      return r.status === "COMPLETED" && r.qty_pcs > 0;
    }).length;

    res.json({
      tags: rows,
      summary: {
        total,
        open,
        completed,
        approvalSuccess,
        recount,
        minus,
        over
      },
      verifier: {
        id: verifier.id,
        name: verifier.name
      }
    });

  } catch (e) {
    console.error("SERAH TERIMA ERROR:", e);
    res.status(500).json({
      error: "Gagal mengambil data serah terima",
      detail: e.message
    });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const dbPromise = require("../db")
const auth = require("../middleware/authMiddleware");

/* =====================================================
   GET LIST STO TAGS — monitoring dengan filter
   Query params:
     ?verificator_id=N  — filter by user
     ?status=OPEN|COMPLETED|RECOUNT_REQUEST|RECOUNT — filter by status
     ?located_id=N      — filter by location
   Response:
     { tags: [...], summary: { total, completed, pending, percentage } }
===================================================== */
router.get("/", auth, async (req, res) => {
  try {
    const db = await dbPromise;

    const { verificator_id, status, located_id } = req.query;

    const conditions = [];
    const params = [];

    if (verificator_id) {
      conditions.push("s.verificator_id = ?");
      params.push(parseInt(verificator_id));
    }

    if (status === "OPEN") {
      conditions.push("s.status = 'OPEN'");
    } else if (status === "COMPLETED") {
      conditions.push("s.status = 'COMPLETED'");
    } else if (status === "RECOUNT_REQUEST") {
      conditions.push("s.status = 'RECOUNT_REQUEST'");
    } else if (status === "RECOUNT") {
      conditions.push("s.status = 'RECOUNT'");
    } else if (status === "APPROVAL_SUCCESS") {
      conditions.push("s.status = 'APPROVAL_SUCCESS'");
    }

    if (located_id) {
      conditions.push("s.located_id = ?");
      params.push(parseInt(located_id));
    }

    // Role-based filtering
    if (req.user.role === 'USER') {
      conditions.push("s.verificator_id = ?");
      params.push(req.user.id);
    } else if (req.user.role === 'ADMIN') {
      conditions.push("(s.verificator_id = ? OR s.verificator_id IN (SELECT id FROM verifiers WHERE parent_admin_id = ?))");
      params.push(req.user.id, req.user.id);
    }
    // SUPER_ADMIN — no filter

    const finalWhere = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

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
        s.status,
        s.approval_status,
        adm.name AS recount_admin_name,
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
      LEFT JOIN verifiers adm ON adm.id = s.recount_admin_id
      ${finalWhere}
      ORDER BY s.id ASC
      `,
      params
    );

    const total = rows.length;
    const completed = rows.filter(r => r.status === "COMPLETED").length;
    const pending = rows.filter(r => r.status === "OPEN").length;
    const recount = rows.filter(r => r.status === "RECOUNT").length;
    const recountRequest = rows.filter(r => r.status === "RECOUNT_REQUEST").length;
    const percentage = total > 0 ? Math.round(((completed + recount) / total) * 100) : 0;

    res.json({
      tags: rows,
      summary: { total, completed, pending, recount, recountRequest, percentage }
    });

  } catch (e) {
    console.error("LIST TAGS ERROR:", e);
    res.status(500).json({
      error: "Failed get STO tags",
      detail: e.message
    });
  }
});

module.exports = router;

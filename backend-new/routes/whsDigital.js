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
        w.first_count_pcs,
        w.first_count_m3,
        w.recount_pcs,
        w.recount_m3,
        w.recount_by,
        w.recount_at,
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
   INPUT WHS DIGITAL — First Count (OPEN→CLOSED) / Recount (CLOSED|RECOUNT→RECOUNT)
===================================================== */
router.post("/", auth, async (req, res) => {
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

  console.log('=== WHS DIGITAL POST PAYLOAD ===', {
    tag_qr, whs_code, item_code, count_pcs, batch, remark, kualitas, counter_id, located_id,
    user: req.user
  });
  console.log('req.user.name =', req.user.name);
  console.log('req.user keys =', Object.keys(req.user));

  const db = await dbPromise;

  try {
    await db.run("BEGIN");

    /* ================= VALIDASI TAG ================= */
    const tag = await db.get(
      `SELECT * FROM sto_tags WHERE tag_qr = ?`,
      [tag_qr]
    );

    if (!tag) {
      await db.run("ROLLBACK");
      return res.status(400).json({ error: "Tag tidak terdaftar" });
    }

    /* ================= VALIDASI KEPEMILIKAN ================= */
    if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role) && tag.verificator_id !== req.user.id) {
      await db.run("ROLLBACK");

      const ownerRow = await db.get(`SELECT name FROM verifiers WHERE id = ?`, [tag.verificator_id]);
      const ownerName = ownerRow?.name || "Unknown";

      try {
        await db.run(
          `INSERT INTO access_log (tag_qr, whs_code, item_code, user_id, user_name, owner_name, action)
           VALUES (?, ?, ?, ?, ?, ?, 'UNAUTHORIZED SCAN')`,
          [tag_qr, whs_code, item_code, req.user.id, req.user.name, ownerName]
        );
      } catch (logErr) {
        console.error("ACCESS_LOG insert error:", logErr.message);
      }

      return res.status(403).json({
        error: "Tag bukan milik Anda",
        owner_name: ownerName
      });
    }

    if (tag.status === "COMPLETED") {
      await db.run("ROLLBACK");
      return res.status(400).json({ error: "Tag sudah selesai dihitung. Ajukan Recount terlebih dahulu." });
    }

    if (tag.status === "RECOUNT_REQUEST") {
      await db.run("ROLLBACK");
      return res.status(400).json({ error: "Tag sedang menunggu Approval Admin." });
    }

    if (tag.status !== "OPEN" && tag.status !== "RECOUNT" && tag.status !== "APPROVAL_SUCCESS") {
      await db.run("ROLLBACK");
      return res.status(400).json({ error: "Status tag tidak valid untuk input" });
    }

    /* ================= VALIDASI QTY ================= */
    const pcs = Number(count_pcs);

    if (isNaN(pcs) || pcs < 0) {
      await db.run("ROLLBACK");
      return res.status(400).json({
        error: "Qty PCS wajib diisi dan tidak boleh negatif"
      });
    }

    /* ================= AMBIL ITEM ================= */
    const item = await db.get(
      `
      SELECT bvolume, description
      FROM item_on_hand
      WHERE item_code = ?
        AND whs_code = ?
      `,
      [item_code, whs_code]
    );

    const bvolume = Number(item?.bvolume || 0);
    const count_m3 = pcs * bvolume;

    /* ================= AMBIL NAMA LOKASI & VERIFICATOR ================= */
    const locRow = located_id ? await db.get(`SELECT loc_name FROM located WHERE id = ?`, [located_id]) : null;
    const location_name = locRow?.loc_name || "";
    const userRow = await db.get(`SELECT name FROM verifiers WHERE id = ?`, [req.user.id]);
    const verificator_name = userRow?.name || "Unknown";

    if (tag.status === "OPEN") {
      /* ================= FIRST COUNT ================= */
      await db.run(
        `
        INSERT INTO whs_digital (
          tag_qr, whs_code, item_code, description,
          count_pcs, count_m3,
          first_count_pcs, first_count_m3,
          batch, remark, kualitas,
          counter_id, located_id, verificator_id,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','+7 hours'))
        `,
        [
          tag_qr, whs_code, item_code, item?.description || "",
          pcs, count_m3,
          pcs, count_m3,
          batch || "", remark || "", kualitas || "",
          counter_id, located_id, req.user.id
        ]
      );

      await db.run(
        `UPDATE sto_tags SET status = 'COMPLETED', scanned_at = datetime('now','+7 hours') WHERE tag_qr = ?`,
        [tag_qr]
      );

    } else {
      /* ================= RECOUNT (status CLOSED / RECOUNT) ================= */
      await db.run(
        `
        UPDATE whs_digital SET
          count_pcs = ?,
          count_m3 = ?,
          recount_pcs = ?,
          recount_m3 = ?,
          recount_by = ?,
          recount_at = datetime('now','+7 hours'),
          batch = ?,
          remark = ?,
          kualitas = ?
        WHERE tag_qr = ?
        `,
        [
          pcs, count_m3,
          pcs, count_m3,
          req.user.id,
          batch || "", remark || "", kualitas || "",
          tag_qr
        ]
      );

      await db.run(
        `UPDATE sto_tags SET status = 'RECOUNT' WHERE tag_qr = ?`,
        [tag_qr]
      );
    }

    await db.run("COMMIT");

    /* ================= INSERT ACTIVITY LOG (di luar transaction — gagal tidak apa) ================= */
    const activityType = tag.status === "OPEN" ? "FIRST_COUNT" : "RECOUNT";
    try {
      await db.run(
        `INSERT INTO activity_log (tag_qr, whs_code, item_code, description, activity_type, pcs, m3, batch, kualitas, remark, location_name, verificator_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','+7 hours'))`,
        [tag_qr, whs_code, item_code, item?.description || "", activityType, pcs, count_m3, batch || "", kualitas || "", remark || "", location_name, verificator_name]
      );
    } catch (logErr) {
      console.error('=== ACTIVITY_LOG INSERT GAGAL (tidak mempengaruhi whs_digital) ===');
      console.error('activity_type:', activityType);
      console.error('pcs:', pcs);
      console.error('m3:', count_m3);
      console.error('verificator_name:', verificator_name);
      console.error('Error:', logErr.message);
    }

    res.json({
      success: true,
      message: "WHS Digital berhasil disimpan"
    });

  } catch (err) {
    await db.run("ROLLBACK");

    console.error('=== WHS DIGITAL ERROR ===');
    console.error('Full error:', err);
    console.error('Message:', err.message);
    console.error('Code:', err.code);
    console.error('Errno:', err.errno);
    if (err.message?.includes('NOT NULL')) {
      console.error('DETAIL: NOT NULL constraint failed — kemungkinan ada field undefined');
    }
    if (err.message?.includes('SQLITE_CONSTRAINT')) {
      console.error('DETAIL: SQLITE_CONSTRAINT — kemungkinan duplicate atau foreign key');
    }

    res.status(500).json({
      error: "Gagal simpan WHS Digital",
      detail: err.message
    });
  }
});

/* =====================================================
   GET /api/whs/by-tag/:tagQr
   AMBIL DATA WHS DIGITAL BERDASARKAN TAG QR (untuk recount)
===================================================== */
router.get("/by-tag/:tagQr", auth, async (req, res) => {
  try {
    const db = await dbPromise;

    /* ================= CEK TAG UNTUK VALIDASI KEPEMILIKAN ================= */
    const tag = await db.get(`SELECT * FROM sto_tags WHERE tag_qr = ?`, [req.params.tagQr]);

    if (tag) {
      if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role) && tag.verificator_id !== req.user.id) {
        const ownerRow = await db.get(`SELECT name FROM verifiers WHERE id = ?`, [tag.verificator_id]);
        const ownerName = ownerRow?.name || "Unknown";

        try {
          await db.run(
            `INSERT INTO access_log (tag_qr, whs_code, item_code, user_id, user_name, owner_name, action)
             VALUES (?, ?, ?, ?, ?, ?, 'UNAUTHORIZED SCAN')`,
            [tag.tag_qr, tag.whs_code, tag.item_code, req.user.id, req.user.name, ownerName]
          );
        } catch (logErr) {
          console.error("ACCESS_LOG insert error:", logErr.message);
        }

        return res.status(403).json({
          error: "Tag bukan milik Anda",
          owner_name: ownerName
        });
      }
    }

    const row = await db.get(`
      SELECT
        w.id,
        w.tag_qr,
        w.whs_code,
        w.item_code,
        w.description,
        w.count_pcs,
        w.count_m3,
        w.first_count_pcs,
        w.first_count_m3,
        w.recount_pcs,
        w.recount_m3,
        w.recount_by,
        w.recount_at,
        w.batch,
        w.kualitas,
        w.remark,
        c.name AS counter_name,
        v.name AS verificator_name,
        l.loc_name AS location_name,
        rv.name AS recount_by_name,
        w.created_at
      FROM whs_digital w
      LEFT JOIN counters c ON c.id = w.counter_id
      LEFT JOIN verifiers v ON v.id = w.verificator_id
      LEFT JOIN located l ON l.id = w.located_id
      LEFT JOIN verifiers rv ON rv.id = w.recount_by
      WHERE w.tag_qr = ?
    `, [req.params.tagQr]);

    if (!row) {
      return res.status(404).json({ error: "Data WHS Digital tidak ditemukan" });
    }

    res.json(row);

  } catch (err) {
    console.error("GET WHS BY TAG ERROR:", err);
    res.status(500).json({ error: "Gagal mengambil data WHS Digital", detail: err.message });
  }
});

/* =====================================================
   GET /api/whs/summary
   REKAP STOCK OPNAME per Item + Warehouse (dengan pagination)
   Query params: ?page=1&pageSize=50&search=&whs_code=
===================================================== */
router.get("/summary", auth, async (req, res) => {
  try {
    const db = await dbPromise;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 50));
    const search = (req.query.search || "").trim();
    const whsCodeFilter = (req.query.whs_code || "").trim();
    const offset = (page - 1) * pageSize;

    const conditions = [];
    const params = [];

    if (req.user.role === 'USER') {
      conditions.push("wd.verificator_id = ?");
      params.push(req.user.id);
    } else if (req.user.role === 'ADMIN') {
      conditions.push("(wd.verificator_id = ? OR wd.verificator_id IN (SELECT id FROM verifiers WHERE parent_admin_id = ?))");
      params.push(req.user.id, req.user.id);
    }

    if (search) {
      conditions.push("(wd.whs_code LIKE ? OR wd.item_code LIKE ? OR ioh.description LIKE ?)");
      const likeVal = `%${search}%`;
      params.push(likeVal, likeVal, likeVal);
    }

    if (whsCodeFilter) {
      conditions.push("wd.whs_code = ?");
      params.push(whsCodeFilter);
    }

    const joinClause = `
      LEFT JOIN item_on_hand ioh
        ON ioh.item_code = wd.item_code AND ioh.whs_code = wd.whs_code
    `;
    const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    // Hitung total (tanpa LIMIT)
    const countSql = `
      SELECT COUNT(*) AS cnt FROM (
        SELECT wd.whs_code, wd.item_code
        FROM whs_digital wd
        ${joinClause}
        ${whereClause}
        GROUP BY wd.whs_code, wd.item_code
      )
    `;
    const countRow = await db.get(countSql, params);
    const total = countRow?.cnt || 0;

    // Ambil data dengan pagination
    const rows = await db.all(`
      SELECT
        wd.whs_code,
        wd.item_code,
        COALESCE(ioh.description, '-') AS description,
        COALESCE(ioh.item_group, '-') AS item_group,
        COALESCE(ioh.uom, '') AS uom,
        COALESCE(ioh.onhand_qty_pcs, 0) AS qty_sap,
        SUM(COALESCE(wd.recount_pcs, wd.count_pcs)) AS qty_sto
      FROM whs_digital wd
      ${joinClause}
      ${whereClause}
      GROUP BY wd.whs_code, wd.item_code, ioh.rowid
      ORDER BY wd.whs_code ASC, wd.item_code ASC
      LIMIT ? OFFSET ?
    `, [...params, pageSize, offset]);

    const data = rows.map((r, i) => {
      const qtySap = r.qty_sap || 0;
      const qtySto = r.qty_sto || 0;
      const selisih = qtySto - qtySap;

      return {
        no: offset + i + 1,
        whs_code: r.whs_code,
        item_code: r.item_code,
        description: r.description,
        item_group: r.item_group,
        uom: r.uom,
        qty_sap: qtySap,
        qty_sto: qtySto,
        selisih,
        status: selisih === 0 ? "PASS" : selisih < 0 ? "MINUS" : "OVER"
      };
    });

    res.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });

  } catch (err) {
    console.error("GET WHS SUMMARY ERROR:", err);
    res.status(500).json({
      error: "Gagal mengambil rekap stock opname",
      detail: err.message
    });
  }
});

/* =====================================================
   GET /api/whs/export-report
   DATA UNTUK EXPORT EXCEL 3 SHEET
===================================================== */
router.get("/export-report", auth, async (req, res) => {
  try {
    const db = await dbPromise;

    // Role-based filters
    let whsFilter = "";
    let whsParams = [];
    let actFilter = "";
    let actParams = [];
    let tagFilter = "";
    let tagParams = [];

    if (req.user.role === 'USER') {
      whsFilter = "WHERE wd.verificator_id = ?";
      whsParams = [req.user.id];
      actFilter = "WHERE verificator_name = (SELECT name FROM verifiers WHERE id = ?)";
      actParams = [req.user.id];
      tagFilter = "WHERE s.verificator_id = ?";
      tagParams = [req.user.id];
    } else if (req.user.role === 'ADMIN') {
      whsFilter = "WHERE (wd.verificator_id = ? OR wd.verificator_id IN (SELECT id FROM verifiers WHERE parent_admin_id = ?))";
      whsParams = [req.user.id, req.user.id];
      actFilter = "WHERE (verificator_name IN (SELECT name FROM verifiers WHERE id = ? OR parent_admin_id = ?))";
      actParams = [req.user.id, req.user.id];
      tagFilter = "WHERE (s.verificator_id = ? OR s.verificator_id IN (SELECT id FROM verifiers WHERE parent_admin_id = ?))";
      tagParams = [req.user.id, req.user.id];
    }

    const [stockOpnameSummary, recentActivity, detailTags] = await Promise.all([

      /* ── Sheet 1 : Stock Opname Summary (per Item Code) ── */
      db.all(`
        SELECT
          wd.whs_code,
          wd.item_code,
          COALESCE(ioh.description, '-') AS description,
          COALESCE(ioh.item_group, '-') AS item_group,
          COALESCE(ioh.uom, '') AS uom,
          COALESCE(ioh.onhand_qty_pcs, 0) AS qty_sap,
          SUM(COALESCE(wd.recount_pcs, wd.count_pcs)) AS qty_sto
        FROM whs_digital wd
        LEFT JOIN item_on_hand ioh
          ON ioh.item_code = wd.item_code
         AND ioh.whs_code = wd.whs_code
        ${whsFilter}
        GROUP BY wd.whs_code, wd.item_code, ioh.rowid
        ORDER BY wd.whs_code ASC, wd.item_code ASC
      `, whsParams),

      /* ── Sheet 2 : Recent Activity (all, no limit) ── */
      db.all(`
        SELECT
          id, tag_qr, whs_code, item_code, description,
          activity_type, pcs, m3, batch, kualitas, remark,
          location_name, verificator_name, created_at
        FROM activity_log
        ${actFilter}
        ORDER BY created_at DESC
      `, actParams),

      /* ── Sheet 3 : Detail Tags ── */
      db.all(`
        SELECT
          s.id,
          s.seq,
          s.tag_qr,
          s.whs_code,
          s.item_code,
          COALESCE(ioh.description, '-') AS description,
          c.name AS counter_name,
          v.name AS verificator_name,
          l.loc_name AS location_name,
          s.location_detail,
          s.status,
          s.created_at AS assigned_date,
          wd.count_pcs,
          wd.first_count_pcs,
          wd.recount_pcs,
          wd.created_at AS scan_date,
          wd.remark,
          adm.name AS approval_by,
          s.approval_status,
          s.recount_requested_at,
          s.recount_approved_at
        FROM sto_tags s
        LEFT JOIN item_on_hand ioh
          ON TRIM(ioh.item_code) = TRIM(s.item_code)
         AND TRIM(ioh.whs_code) = TRIM(s.whs_code)
        LEFT JOIN counters c ON s.counter_id = c.id
        LEFT JOIN verifiers v ON s.verificator_id = v.id
        LEFT JOIN located l ON s.located_id = l.id
        LEFT JOIN whs_digital wd ON wd.tag_qr = s.tag_qr
        LEFT JOIN verifiers adm ON adm.id = s.recount_admin_id
        ${tagFilter}
        ORDER BY s.seq ASC
      `, tagParams)
    ]);

    res.json({ stockOpnameSummary, recentActivity, detailTags });

  } catch (err) {
    console.error("EXPORT REPORT ERROR:", err);
    res.status(500).json({
      error: "Gagal mengambil data export",
      detail: err.message
    });
  }
});

module.exports = router;
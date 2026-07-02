const express = require("express");
const router = express.Router();
const dbPromise = require("../db");
const auth = require("../middleware/authMiddleware"); // ✅ tambah ini

/* =====================================================
   GET STO TAG BY QR
===================================================== */
router.get("/by-qr/:tag", auth, async (req, res) => {
  try {
    const db = await dbPromise;
    const tag_qr = req.params.tag;

    const row = await db.get(
      `
      SELECT 
        s.*,
        c.name as counter_name,
        v.name as verificator_name,
        l.loc_name,
        l.loc_code
      FROM sto_tags s
      LEFT JOIN counters c ON s.counter_id = c.id
      LEFT JOIN verifiers v ON s.verificator_id = v.id
      LEFT JOIN located l ON s.located_id = l.id
      WHERE s.tag_qr = ?
      `,
      [tag_qr]
    );

    if (!row) {
      return res.status(404).json({ error: "Tag tidak ditemukan" });
    }

    /* ================= VALIDASI KEPEMILIKAN ================= */
    if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role) && row.verificator_id !== req.user.id) {
      try {
        await db.run(
          `INSERT INTO access_log (tag_qr, whs_code, item_code, user_id, user_name, owner_name, action)
           VALUES (?, ?, ?, ?, ?, ?, 'UNAUTHORIZED SCAN')`,
          [row.tag_qr, row.whs_code, row.item_code, req.user.id, req.user.name, row.verificator_name]
        );
      } catch (logErr) {
        console.error("ACCESS_LOG insert error:", logErr.message);
      }

      return res.status(403).json({
        error: "Tag bukan milik Anda",
        owner_name: row.verificator_name
      });
    }

    res.json(row);

  } catch (err) {
    console.error("GET TAG BY QR ERROR:", err);
    res.status(500).json({ error: "Gagal mengambil data tag" });
  }
});

/* =====================================================
   GET MY STO TAGS (FIXED 🔥)
===================================================== */
router.get("/my", auth, async (req, res) => {
  try {
    const db = await dbPromise;

    const verificator_id = req.user.id; // ✅ dari login

    const rows = await db.all(
      `
      SELECT 
        s.id,
        s.tag_qr,
        s.whs_code,
        s.item_code,

        COALESCE(ioh.description, '-') AS description,

        c.name as counter_name,
        l.loc_name as location_name,
        s.location_detail,

        s.status,
        s.approval_status,
        s.recount_requested_at,
        s.recount_admin_id,
        adm.name AS recount_admin_name,

        s.created_at,
        s.scanned_at,

        wd.count_pcs,
        wd.first_count_pcs,
        wd.recount_pcs

      FROM sto_tags s

      LEFT JOIN item_on_hand ioh
        ON TRIM(ioh.item_code) = TRIM(s.item_code)
       AND TRIM(ioh.whs_code) = TRIM(s.whs_code)

      LEFT JOIN counters c ON s.counter_id = c.id
      LEFT JOIN located l ON s.located_id = l.id

      LEFT JOIN whs_digital wd ON wd.tag_qr = s.tag_qr

      LEFT JOIN verifiers adm ON adm.id = s.recount_admin_id

      WHERE s.verificator_id = ?
      ORDER BY s.seq ASC
      `,
      [verificator_id]
    );

    res.json(rows);

  } catch (err) {
    console.error("GET MY TAGS ERROR:", err);
    res.status(500).json({
      error: "Failed load tags",
      detail: err.message
    });
  }
});

/* =====================================================
   GENERATE STO TAG — menggunakan ID database sebagai sequence
===================================================== */
router.post("/generate", async (req, res) => {
  try {
    const db = await dbPromise;

    const {
      whs_code,
      item_code,
      jumlah_tag,
      verificator_id,
      counter_id,
      located_id,
      location_detail
    } = req.body;

    const count = parseInt(jumlah_tag);

    if (!whs_code || !item_code) {
      return res.status(400).json({
        error: "Warehouse & Item wajib"
      });
    }

    if (!verificator_id || !counter_id) {
      return res.status(400).json({
        error: "Verificator & Counter wajib"
      });
    }

    if (isNaN(count) || count < 1) {
      return res.status(400).json({
        error: "Jumlah tag tidak valid"
      });
    }

    if (location_detail && location_detail.length > 30) {
      return res.status(400).json({
        error: "Detail Location maksimal 30 karakter."
      });
    }

    const createdTags = [];
    const prefix = Date.now().toString(36);

    await db.exec("BEGIN TRANSACTION");

    for (let i = 0; i < count; i++) {
      const tempTag = `__TEMP__${prefix}_${i}`;

      const result = await db.run(
        `
        INSERT INTO sto_tags (
          whs_code,
          item_code,
          seq,
          tag_qr,
          verificator_id,
          counter_id,
          located_id,
          location_detail,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')
        `,
        [
          whs_code,
          item_code,
          0,
          tempTag,
          verificator_id,
          counter_id,
          located_id || null,
          location_detail || null
        ]
      );

      const newId = result.lastID;

      if (!newId) {
        throw new Error(`lastID为空 — insert gagal untuk iterasi ke-${i}`);
      }

      const seqPad = String(newId).padStart(5, "0");
      const tagQr = `${whs_code}-${item_code}-${seqPad}`;

      const updateResult = await db.run(
        `
        UPDATE sto_tags
        SET tag_qr = ?,
            seq    = ?
        WHERE id = ?
        `,
        [tagQr, newId, newId]
      );

      if (updateResult.changes !== 1) {
        console.error(`UPDATE tag_qr warning: id=${newId}, changes=${updateResult.changes}`);
      }

      createdTags.push({
        id: newId,
        tag_qr: tagQr
      });
    }

    await db.exec("COMMIT");

    console.log(`GENERATE OK: ${count} tag for ${whs_code}-${item_code}, IDs ${createdTags[0]?.id}..${createdTags[createdTags.length-1]?.id}`);

    res.json({
      success: true,
      total: count,
      tags: createdTags
    });

  } catch (err) {
    console.error("=== GENERATE STO TAG ERROR ===");
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);

    try {
      const db = await dbPromise;
      await db.exec("ROLLBACK");
      console.log("ROLLBACK sukses setelah error");
    } catch (rbErr) {
      console.error("ROLLBACK gagal:", rbErr.message);
    }

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* =====================================================
   UPDATE STATUS → SCANNED
===================================================== */
router.put("/scan-by-tag", async (req, res) => {
  try {
    const db = await dbPromise;
    const { tag_qr } = req.body;

    await db.run(
      `
      UPDATE sto_tags
      SET status = 'SCANNED',
          scanned_at = datetime('now','+7 hours')
      WHERE tag_qr = ?
      `,
      [tag_qr]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("SCAN ERROR:", err);
    res.status(500).json({
      error: "Failed update scan"
    });
  }
});

/* =====================================================
   GET ADMINS — daftar user role admin
===================================================== */
router.get("/admins", auth, async (req, res) => {
  try {
    const db = await dbPromise;
    let rows;
    if (req.user.role === 'USER' && req.user.parent_admin_id) {
      rows = await db.all(
        `SELECT id, name FROM verifiers WHERE id = ? ORDER BY name ASC`,
        [req.user.parent_admin_id]
      );
    } else {
      rows = await db.all(
        `SELECT id, name FROM verifiers WHERE role = 'ADMIN' ORDER BY name ASC`
      );
    }
    res.json(rows);
  } catch (err) {
    console.error("GET ADMINS ERROR:", err);
    res.status(500).json({ error: "Gagal mengambil daftar admin" });
  }
});

/* =====================================================
   REQUEST RECOUNT — operator mengajukan recount
===================================================== */
router.post("/request-recount", auth, async (req, res) => {
  const { tag_qr, admin_id } = req.body;

  if (!tag_qr || !admin_id) {
    return res.status(400).json({ error: "tag_qr dan admin_id wajib diisi" });
  }

  try {
    const db = await dbPromise;

    const tag = await db.get(`SELECT * FROM sto_tags WHERE tag_qr = ?`, [tag_qr]);
    if (!tag) {
      return res.status(404).json({ error: "Tag tidak ditemukan" });
    }

    if (tag.status !== "COMPLETED") {
      return res.status(400).json({ error: "Hanya tag berstatus COMPLETED yang bisa diajukan recount" });
    }

    // USER only can request recount to their parent admin
    if (req.user.role === 'USER') {
      const userInfo = await db.get(`SELECT parent_admin_id FROM verifiers WHERE id = ?`, [req.user.id]);
      if (!userInfo || userInfo.parent_admin_id !== parseInt(admin_id)) {
        return res.status(403).json({ error: "Anda hanya bisa request recount ke admin yang ditentukan" });
      }
    }

    await db.run(
      `
      UPDATE sto_tags SET
        status = 'RECOUNT_REQUEST',
        approval_status = 'PENDING',
        recount_requested_by = ?,
        recount_requested_at = datetime('now','+7 hours'),
        recount_admin_id = ?
      WHERE tag_qr = ?
      `,
      [req.user.id, admin_id, tag_qr]
    );

    /* ================= ACTIVITY LOG ================= */
    try {
      const userRow = await db.get(`SELECT name FROM verifiers WHERE id = ?`, [req.user.id]);
      const adminRow = await db.get(`SELECT name FROM verifiers WHERE id = ?`, [admin_id]);
      const whsRow = await db.get(`SELECT count_pcs, location_name FROM whs_digital WHERE tag_qr = ?`, [tag_qr]);
      const pcs = whsRow?.count_pcs || 0;
      const locationName = whsRow?.location_name || "";
      const adminName = adminRow?.name || "Unknown";
      const operatorName = userRow?.name || req.user.name;
      await db.run(
        `INSERT INTO activity_log (tag_qr, whs_code, item_code, description, activity_type, pcs, m3, batch, kualitas, remark, location_name, verificator_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, '', '', ?, ?, ?, datetime('now','+7 hours'))`,
        [tag_qr, tag.whs_code, tag.item_code, tag.item_code || '', 'REQUEST_RECOUNT', pcs, `Request recount to ${adminName}`, locationName, operatorName]
      );
    } catch (logErr) {
      console.error("ACTIVITY_LOG insert error:", logErr.message);
    }

    res.json({ success: true, message: "Permintaan recount berhasil dikirim" });

  } catch (err) {
    console.error("REQUEST RECOUNT ERROR:", err);
    res.status(500).json({ error: "Gagal mengajukan recount" });
  }
});

/* =====================================================
   APPROVE RECOUNT — admin menyetujui recount
===================================================== */
router.post("/approve-recount", auth, async (req, res) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: "Hanya admin yang bisa approve recount" });
  }

  const { tag_qr } = req.body;
  if (!tag_qr) {
    return res.status(400).json({ error: "tag_qr wajib diisi" });
  }

  try {
    const db = await dbPromise;

    const tag = await db.get(`SELECT * FROM sto_tags WHERE tag_qr = ?`, [tag_qr]);
    if (!tag) {
      return res.status(404).json({ error: "Tag tidak ditemukan" });
    }

    if (tag.status !== "RECOUNT_REQUEST" || tag.approval_status !== "PENDING") {
      return res.status(400).json({ error: "Tag tidak dalam status menunggu approval" });
    }

    // ADMIN only can approve recount for users under them
    if (req.user.role === 'ADMIN') {
      const tagOwner = await db.get(`SELECT parent_admin_id FROM verifiers WHERE id = ?`, [tag.verificator_id]);
      if (!tagOwner || tagOwner.parent_admin_id !== req.user.id) {
        return res.status(403).json({ error: "Anda hanya bisa approve recount untuk user dibawah anda" });
      }
    }

    await db.run(
      `
      UPDATE sto_tags SET
        status = 'APPROVAL_SUCCESS',
        approval_status = 'APPROVED',
        recount_approved_by = ?,
        recount_approved_at = datetime('now','+7 hours')
      WHERE tag_qr = ?
      `,
      [req.user.id, tag_qr]
    );

    /* ================= ACTIVITY LOG ================= */
    try {
      const whsRow = await db.get(`SELECT count_pcs FROM whs_digital WHERE tag_qr = ?`, [tag_qr]);
      const pcs = whsRow?.count_pcs || 0;
      await db.run(
        `INSERT INTO activity_log (tag_qr, whs_code, item_code, description, activity_type, pcs, m3, batch, kualitas, remark, location_name, verificator_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, '', '', ?, '', ?, datetime('now','+7 hours'))`,
        [tag_qr, tag.whs_code, tag.item_code, tag.item_code || '', 'APPROVE_RECOUNT', pcs, `Approved by ${req.user.name}`, req.user.name]
      );
    } catch (logErr) {
      console.error("ACTIVITY_LOG insert error:", logErr.message);
    }

    res.json({ success: true, message: "Recount disetujui" });

  } catch (err) {
    console.error("APPROVE RECOUNT ERROR:", err);
    res.status(500).json({ error: "Gagal approve recount" });
  }
});

/* =====================================================
   REJECT RECOUNT — admin menolak recount
===================================================== */
router.post("/reject-recount", auth, async (req, res) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: "Hanya admin yang bisa reject recount" });
  }

  const { tag_qr } = req.body;
  if (!tag_qr) {
    return res.status(400).json({ error: "tag_qr wajib diisi" });
  }

  try {
    const db = await dbPromise;

    const tag = await db.get(`SELECT * FROM sto_tags WHERE tag_qr = ?`, [tag_qr]);
    if (!tag) {
      return res.status(404).json({ error: "Tag tidak ditemukan" });
    }

    if (tag.status !== "RECOUNT_REQUEST" || tag.approval_status !== "PENDING") {
      return res.status(400).json({ error: "Tag tidak dalam status menunggu approval" });
    }

    // ADMIN only can reject recount for users under them
    if (req.user.role === 'ADMIN') {
      const tagOwner = await db.get(`SELECT parent_admin_id FROM verifiers WHERE id = ?`, [tag.verificator_id]);
      if (!tagOwner || tagOwner.parent_admin_id !== req.user.id) {
        return res.status(403).json({ error: "Anda hanya bisa reject recount untuk user dibawah anda" });
      }
    }

    await db.run(
      `
      UPDATE sto_tags SET
        status = 'COMPLETED',
        approval_status = 'REJECTED',
        recount_rejected_by = ?,
        recount_rejected_at = datetime('now','+7 hours')
      WHERE tag_qr = ?
      `,
      [req.user.id, tag_qr]
    );

    /* ================= ACTIVITY LOG ================= */
    try {
      await db.run(
        `INSERT INTO activity_log (tag_qr, whs_code, item_code, description, activity_type, pcs, m3, batch, kualitas, remark, location_name, verificator_name, created_at)
         VALUES (?, ?, ?, ?, ?, 0, 0, '', '', ?, '', ?, datetime('now','+7 hours'))`,
        [tag_qr, tag.whs_code, tag.item_code, tag.item_code || '', 'REJECT_RECOUNT', `Rejected by ${req.user.name}`, req.user.name]
      );
    } catch (logErr) {
      console.error("ACTIVITY_LOG insert error:", logErr.message);
    }

    res.json({ success: true, message: "Permintaan recount ditolak" });

  } catch (err) {
    console.error("REJECT RECOUNT ERROR:", err);
    res.status(500).json({ error: "Gagal reject recount" });
  }
});

module.exports = router;
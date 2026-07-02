const express = require("express");
const router = express.Router();
const dbPromise = require("../db");
const auth = require("../middleware/authMiddleware");

/**
 * GET /api/dashboard/sto — STO vs On Hand comparison
 */
router.get("/sto", auth, async (req, res) => {
  try {
    const db = await dbPromise;

    const rows = await db.all(`
      SELECT
        ioh.whs_code,
        ioh.item_code,
        ioh.description,
        SUM(ioh.onhand_qty_pcs) AS onhand_qty_pcs,
        SUM(wd.count_pcs) AS sto_pcs,
        SUM(wd.count_pcs) - SUM(ioh.onhand_qty_pcs) AS selisih
      FROM whs_digital wd
      INNER JOIN item_on_hand ioh
        ON ioh.item_code = wd.item_code
       AND ioh.whs_code = wd.whs_code
      GROUP BY ioh.whs_code, ioh.item_code, ioh.description
      ORDER BY ioh.whs_code, ioh.item_code
    `);

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed load dashboard STO", detail: e.message });
  }
});

/**
 * GET /api/dashboard/summary — Dashboard utama STO BBP
 * Mengembalikan data statistik dalam satu request.
 */
router.get("/summary", auth, async (req, res) => {
  try {
    const db = await dbPromise;

    /* ================= FILTER PARAMS ================= */
    const { search, user, activity_type, date_from, date_to } = req.query;
    const hasFilters = search || user || activity_type || date_from || date_to;

    /* ================= BUILD RECENT ACTIVITY QUERY ================= */
    const logConditions = [];
    const logParams = [];

    if (search) {
      const kw = `%${search}%`;
      logConditions.push(`(tag_qr LIKE ? OR item_code LIKE ? OR description LIKE ? OR whs_code LIKE ? OR verificator_name LIKE ?)`);
      logParams.push(kw, kw, kw, kw, kw);
    }
    if (user) {
      logConditions.push(`verificator_name = ?`);
      logParams.push(user);
    }
    if (activity_type) {
      logConditions.push(`activity_type = ?`);
      logParams.push(activity_type);
    }
    if (date_from) {
      logConditions.push(`created_at >= ?`);
      logParams.push(date_from);
    }
    if (date_to) {
      logConditions.push(`created_at <= ?`);
      logParams.push(date_to);
    }

    // Role-based filter for activity_log
    if (req.user.role === 'USER') {
      logConditions.push("al.verificator_name = (SELECT name FROM verifiers WHERE id = ?)");
      logParams.push(req.user.id);
    } else if (req.user.role === 'ADMIN') {
      logConditions.push("(al.verificator_name IN (SELECT name FROM verifiers WHERE id = ? OR parent_admin_id = ?))");
      logParams.push(req.user.id, req.user.id);
    }

    const logWhere = logConditions.length > 0 ? "WHERE " + logConditions.join(" AND ") : "";
    const logLimit = hasFilters ? "" : "LIMIT 20";

    const recentQuery = `
      SELECT
        id, tag_qr, whs_code, item_code, description,
        activity_type, pcs, batch, kualitas, remark,
        location_name, verificator_name, created_at
      FROM activity_log al
      ${logWhere}
      ORDER BY created_at DESC
      ${logLimit}
    `;

    /* ── Build role-based filter for sto_tags ── */
    let tagFilter = "";
    let tagFilterParams = [];
    if (req.user.role === 'USER') {
      tagFilter = "WHERE s.verificator_id = ?";
      tagFilterParams = [req.user.id];
    } else if (req.user.role === 'ADMIN') {
      tagFilter = "WHERE (s.verificator_id = ? OR s.verificator_id IN (SELECT id FROM verifiers WHERE parent_admin_id = ?))";
      tagFilterParams = [req.user.id, req.user.id];
    }

    const [
      tagStats,
      userStats,
      warehouseStats,
      allVerifiers,
      recentActivity,
      users,
      warehouses
    ] = await Promise.all([

      /* ── Tag Stats ── */
      db.get(`
        SELECT
          COUNT(*) AS total_tags,
          SUM(CASE WHEN s.status IN ('COMPLETED', 'RECOUNT') THEN 1 ELSE 0 END) AS completed_tags,
          SUM(CASE WHEN s.status = 'OPEN' THEN 1 ELSE 0 END) AS open_tags,
          SUM(CASE WHEN s.status = 'RECOUNT' THEN 1 ELSE 0 END) AS recount_tags
        FROM sto_tags s
        ${tagFilter}
      `, tagFilterParams),

      /* ── Progress Per User ── */
      db.all(`
        SELECT
          v.id AS user_id,
          v.name AS user_name,
          COUNT(s.id) AS total,
          SUM(CASE WHEN s.status IN ('COMPLETED', 'RECOUNT') THEN 1 ELSE 0 END) AS completed
        FROM verifiers v
        LEFT JOIN sto_tags s ON s.verificator_id = v.id
        ${req.user.role === 'ADMIN' ? 'WHERE v.id = ? OR v.parent_admin_id = ?' : ''}
        GROUP BY v.id, v.name
        HAVING total > 0
        ORDER BY completed DESC
      `, req.user.role === 'ADMIN' ? [req.user.id, req.user.id] : []),

      /* ── Progress Per Warehouse ── */
      db.all(`
        SELECT
          s.whs_code,
          COUNT(s.id) AS total,
          SUM(CASE WHEN s.status IN ('COMPLETED', 'RECOUNT') THEN 1 ELSE 0 END) AS completed
        FROM sto_tags s
        ${tagFilter}
        GROUP BY s.whs_code
        ORDER BY completed DESC
      `, tagFilterParams),

      /* ── All verifiers (untuk filter dropdown user) ── */
      db.all(`SELECT id, name FROM verifiers ORDER BY name ASC`),

      /* ── Recent Activity (dengan filter dinamis) ── */
      db.all(recentQuery, logParams),

      /* ── Total Users ── */
      db.get(`SELECT COUNT(*) AS count FROM verifiers`),

      /* ── Total Warehouses ── */
      db.get(`SELECT COUNT(*) AS count FROM warehouse_master`)
    ]);

    const stats = {
      total_tags: tagStats?.total_tags || 0,
      completed_tags: tagStats?.completed_tags || 0,
      open_tags: tagStats?.open_tags || 0,
      recount_tags: tagStats?.recount_tags || 0,
      progress_pct: tagStats?.total_tags > 0
        ? Math.round(((tagStats?.completed_tags || 0) / tagStats.total_tags) * 100)
        : 0,
      total_users: users?.count || 0,
      total_warehouses: warehouses?.count || 0
    };

    const perUser = (userStats || []).map(u => ({
      user_id: u.user_id,
      user_name: u.user_name,
      total: u.total,
      completed: u.completed,
      progress_pct: u.total > 0 ? Math.round((u.completed / u.total) * 100) : 0
    }));

    const perWarehouse = (warehouseStats || []).map(w => ({
      whs_code: w.whs_code,
      total: w.total,
      completed: w.completed,
      progress_pct: w.total > 0 ? Math.round((w.completed / w.total) * 100) : 0
    }));

    res.json({
      stats,
      per_user: perUser,
      per_warehouse: perWarehouse,
      verifiers: allVerifiers || [],
      recent: recentActivity || []
    });

  } catch (e) {
    console.error("DASHBOARD SUMMARY ERROR:", e);
    res.status(500).json({ error: "Failed load dashboard summary", detail: e.message });
  }
});

/**
 * GET /api/dashboard/location-progress — Progress per location
 */
router.get("/location-progress", auth, async (req, res) => {
  try {
    const db = await dbPromise;

    let locFilter = "";
    let locFilterParams = [];
    if (req.user.role === 'USER') {
      locFilter = "WHERE s.verificator_id = ?";
      locFilterParams = [req.user.id];
    } else if (req.user.role === 'ADMIN') {
      locFilter = "WHERE (s.verificator_id = ? OR s.verificator_id IN (SELECT id FROM verifiers WHERE parent_admin_id = ?))";
      locFilterParams = [req.user.id, req.user.id];
    }

    let assignFilter = "";
    let assignFilterParams = [];
    if (req.user.role === 'USER') {
      assignFilter = "AND v.id = ?";
      assignFilterParams = [req.user.id];
    } else if (req.user.role === 'ADMIN') {
      assignFilter = "AND (v.id = ? OR v.parent_admin_id = ?)";
      assignFilterParams = [req.user.id, req.user.id];
    }

    const [locationStats, verificatorAssignments] = await Promise.all([
      db.all(`
        SELECT
          l.id AS located_id,
          l.loc_code,
          l.loc_name,
          COUNT(s.id) AS total_tags,
          SUM(CASE WHEN s.status IN ('COMPLETED', 'RECOUNT') THEN 1 ELSE 0 END) AS completed_tags,
          SUM(CASE WHEN s.status = 'OPEN' THEN 1 ELSE 0 END) AS open_tags,
          SUM(CASE WHEN s.status = 'RECOUNT' THEN 1 ELSE 0 END) AS recount_tags
        FROM located l
        LEFT JOIN sto_tags s ON s.located_id = l.id
        ${locFilter}
        GROUP BY l.id, l.loc_name
        ORDER BY l.loc_name ASC
      `, locFilterParams),
      db.all(`
        SELECT
          s.located_id,
          v.id AS verificator_id,
          v.name AS verificator_name,
          COUNT(s.id) AS tag_count
        FROM sto_tags s
        JOIN verifiers v ON v.id = s.verificator_id
        WHERE s.located_id IS NOT NULL ${assignFilter}
        GROUP BY s.located_id, v.id, v.name
        ORDER BY s.located_id, tag_count DESC
      `, assignFilterParams)
    ]);

    const grouped = (locationStats || []).map(loc => {
      const assignments = (verificatorAssignments || [])
        .filter(a => a.located_id === loc.located_id)
        .map(a => ({
          verificator_id: a.verificator_id,
          verificator_name: a.verificator_name,
          tag_count: a.tag_count
        }));
      return { ...loc, assignments };
    });

    res.json(grouped);
  } catch (e) {
    console.error("LOCATION PROGRESS ERROR:", e);
    res.status(500).json({ error: "Failed load location progress", detail: e.message });
  }
});

module.exports = router;

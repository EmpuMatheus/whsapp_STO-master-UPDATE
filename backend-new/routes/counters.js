const express = require("express");
const router = express.Router();
const dbPromise = require("../db");
const authMiddleware = require("../middleware/authMiddleware");

/**
 * GET /api/counters
 * Optional query: verificator_id
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const db = await dbPromise;
    const { verificator_id } = req.query;

    let rows;

    if (verificator_id) {
      rows = await db.all(
        `
        SELECT
          c.id,
          c.name,
          c.verificator_id,
          v.name AS verificator_name
        FROM counters c
        JOIN verifiers v ON v.id = c.verificator_id
        WHERE c.verificator_id = ?
        ORDER BY c.name
        `,
        [verificator_id]
      );
    } else {
      rows = await db.all(
        `
        SELECT
          c.id,
          c.name,
          c.verificator_id,
          v.name AS verificator_name
        FROM counters c
        LEFT JOIN verifiers v ON v.id = c.verificator_id
        ORDER BY c.name
        `
      );
    }

    res.json(rows);
  } catch (err) {
    console.error("Get counters error:", err);
    res.status(500).json({ error: "Failed to load counters" });
  }
});

/**
 * POST /api/counters
 */
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, verificator_id } = req.body;

    if (!name || !verificator_id) {
      return res.status(400).json({ error: "Name & verificator required" });
    }

    const db = await dbPromise;

    await db.run(
      "INSERT INTO counters (name, verificator_id) VALUES (?, ?)",
      [name.trim(), verificator_id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("Create counter error:", err);
    res.status(500).json({ error: "Failed to create counter" });
  }
});

/**
 * DELETE /api/counters/:id
 */
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const db = await dbPromise;
    await db.run("DELETE FROM counters WHERE id = ?", req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete counter error:", err);
    res.status(500).json({ error: "Failed to delete counter" });
  }
});

module.exports = router;

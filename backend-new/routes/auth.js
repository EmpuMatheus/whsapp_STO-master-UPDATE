const express = require('express');
const router = express.Router();
const dbPromise = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = "whs_secret_key"; // 🔴 HARUS SAMA DENGAN authMiddleware

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const db = await dbPromise;

    const row = await db.get(
      "SELECT * FROM verifiers WHERE username = ?",
      username
    );

    if (!row) {
      return res.status(401).json({ error: "Invalid user" });
    }

    const valid = bcrypt.compareSync(password, row.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = jwt.sign(
      { id: row.id, username: row.username, role: row.role, name: row.name, parent_admin_id: row.parent_admin_id },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      user: {
        id: row.id,
        name: row.name,
        username: row.username,
        role: row.role,
        parent_admin_id: row.parent_admin_id
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

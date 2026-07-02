const express = require('express');
const router = express.Router();
const dbPromise = require('../db');
const bcrypt = require('bcrypt');
const auth = require('../middleware/authMiddleware');

// LIST ALL — role-aware
router.get('/', auth, async (req, res) => {
  try {
    const db = await dbPromise;
    let rows;

    if (req.user.role === 'SUPER_ADMIN') {
      rows = await db.all(
        `SELECT v.id, v.username, v.name, v.role, v.parent_admin_id,
                COALESCE(p.name, '-') AS parent_admin_name,
                (SELECT COUNT(*) FROM sto_tags WHERE verificator_id = v.id) AS tag_count
         FROM verifiers v
         LEFT JOIN verifiers p ON p.id = v.parent_admin_id
         ORDER BY v.name ASC`
      );
    } else if (req.user.role === 'ADMIN') {
      rows = await db.all(
        `SELECT v.id, v.username, v.name, v.role, v.parent_admin_id,
                COALESCE(p.name, '-') AS parent_admin_name,
                (SELECT COUNT(*) FROM sto_tags WHERE verificator_id = v.id) AS tag_count
         FROM verifiers v
         LEFT JOIN verifiers p ON p.id = v.parent_admin_id
         WHERE v.id = ? OR v.parent_admin_id = ?
         ORDER BY v.name ASC`,
        [req.user.id, req.user.id]
      );
    } else {
      // USER — only see self
      rows = await db.all(
        `SELECT v.id, v.username, v.name, v.role, v.parent_admin_id,
                COALESCE(p.name, '-') AS parent_admin_name,
                (SELECT COUNT(*) FROM sto_tags WHERE verificator_id = v.id) AS tag_count
         FROM verifiers v
         LEFT JOIN verifiers p ON p.id = v.parent_admin_id
         WHERE v.id = ?
         ORDER BY v.id`,
        [req.user.id]
      );
    }

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET ONE
router.get('/:id', auth, async (req, res) => {
  try {
    const db = await dbPromise;
    const row = await db.get(
      `SELECT v.id, v.username, v.name, v.role, v.parent_admin_id,
              COALESCE(p.name, '-') AS parent_admin_name
       FROM verifiers v
       LEFT JOIN verifiers p ON p.id = v.parent_admin_id
       WHERE v.id = ?`,
      req.params.id
    );
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// LIST USERS BY ROLE (for dropdowns)
router.get('/by-role/:role', auth, async (req, res) => {
  try {
    const db = await dbPromise;
    const rows = await db.all(
      `SELECT id, username, name FROM verifiers WHERE role = ? ORDER BY name ASC`,
      req.params.role
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// LIST ADMIN (for parent_admin dropdown — only SUPER_ADMIN can see all ADMINs)
router.get('/admins/list', auth, async (req, res) => {
  try {
    const db = await dbPromise;
    let rows;
    if (req.user.role === 'SUPER_ADMIN') {
      rows = await db.all(
        `SELECT id, name FROM verifiers WHERE role = 'ADMIN' ORDER BY name ASC`
      );
    } else {
      rows = [];
    }
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// CREATE
router.post('/', auth, async (req, res) => {
  try {
    const db = await dbPromise;
    const { username, password, name, role, parent_admin_id } = req.body;
    if (!username || !password || !name || !role) {
      return res.status(400).json({ error: 'username, password, name, role required' });
    }

    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'USER'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'role must be SUPER_ADMIN, ADMIN, or USER' });
    }

    // Only SUPER_ADMIN can create SUPER_ADMIN
    if (role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only Super Admin can create Super Admin' });
    }

    let parentId = null;
    if (role === 'USER') {
      if (!parent_admin_id) {
        return res.status(400).json({ error: 'parent_admin_id wajib untuk role USER' });
      }
      parentId = parseInt(parent_admin_id);
      // Verify parent is ADMIN
      const parent = await db.get(`SELECT id FROM verifiers WHERE id = ? AND role = 'ADMIN'`, [parentId]);
      if (!parent) {
        return res.status(400).json({ error: 'Parent Admin tidak valid' });
      }
      // If current user is ADMIN, only allow creating users under them
      if (req.user.role === 'ADMIN') {
        const child = await db.get(
          `SELECT id FROM verifiers WHERE id = ? AND parent_admin_id = ?`,
          [parentId, req.user.id]
        );
        if (!child && parentId !== req.user.id) {
          return res.status(403).json({ error: 'Anda hanya bisa menambah user untuk admin dibawah anda' });
        }
      }
    } else if (role === 'ADMIN') {
      parentId = null;
    } else if (role === 'SUPER_ADMIN') {
      parentId = null;
    }

    const hash = bcrypt.hashSync(password, 10);
    await db.run(
      'INSERT INTO verifiers (username, password_hash, name, role, parent_admin_id) VALUES (?,?,?,?,?)',
      [username, hash, name, role, parentId]
    );
    res.json({ ok: true });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'username already exists' });
    }
    res.status(500).json({ error: e.message });
  }
});

// UPDATE
router.put('/:id', auth, async (req, res) => {
  try {
    const db = await dbPromise;
    const { username, password, name, role, parent_admin_id } = req.body;

    const existing = await db.get('SELECT * FROM verifiers WHERE id = ?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const updates = [];
    const params = [];

    if (username) { updates.push('username = ?'); params.push(username); }
    if (name) { updates.push('name = ?'); params.push(name); }
    if (role) {
      const validRoles = ['SUPER_ADMIN', 'ADMIN', 'USER'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'role must be SUPER_ADMIN, ADMIN, or USER' });
      }
      if (role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Only Super Admin can set SUPER_ADMIN role' });
      }
      updates.push('role = ?');
      params.push(role);
    }
    if (password && String(password).trim() !== '') {
      const hash = bcrypt.hashSync(password, 10);
      updates.push('password_hash = ?');
      params.push(hash);
    }
    if (parent_admin_id !== undefined) {
      const pid = parent_admin_id ? parseInt(parent_admin_id) : null;
      updates.push('parent_admin_id = ?');
      params.push(pid);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    params.push(req.params.id);
    const sql = `UPDATE verifiers SET ${updates.join(', ')} WHERE id = ?`;
    await db.run(sql, params);

    res.json({ ok: true });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'username already exists' });
    }
    res.status(500).json({ error: e.message });
  }
});

// DELETE
router.delete('/:id', auth, async (req, res) => {
  try {
    const db = await dbPromise;
    const existing = await db.get('SELECT * FROM verifiers WHERE id = ?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    // Prevent deleting SUPER_ADMIN
    if (existing.role === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Cannot delete Super Admin' });
    }

    await db.run('DELETE FROM verifiers WHERE id = ?', req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

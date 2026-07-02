const express = require("express");
const router = express.Router();
const dbPromise = require("../db");

/* =====================================================
   GET ALL LOCATED
   GET /api/located
===================================================== */
router.get("/", async (req, res) => {
  try {
    const db = await dbPromise;

    const rows = await db.all(`
      SELECT
        id,
        loc_code,
        loc_name
      FROM located
      ORDER BY loc_code
    `);

    res.json(rows);
  } catch (e) {
    console.error("GET LOCATED ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

/* =====================================================
   ADD LOCATED
   POST /api/located
===================================================== */
router.post("/", async (req, res) => {
  const { loc_code, loc_name } = req.body;

  if (!loc_code || !loc_name) {
    return res.status(400).json({
      error: "loc_code & loc_name wajib diisi"
    });
  }

  try {
    const db = await dbPromise;

    await db.run(
      `
      INSERT INTO located (loc_code, loc_name)
      VALUES (?, ?)
      `,
      [loc_code.trim(), loc_name.trim()]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error("ADD LOCATED ERROR:", e);

    if (e.message.includes("UNIQUE")) {
      return res.status(400).json({
        error: "Kode lokasi sudah ada"
      });
    }

    res.status(500).json({ error: e.message });
  }
});

/* =====================================================
   DELETE LOCATED
   DELETE /api/located/:id
===================================================== */
router.delete("/:id", async (req, res) => {
  try {
    const db = await dbPromise;
    await db.run("DELETE FROM located WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE LOCATED ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

/* =====================================================
   GENERATE DEFAULT LOCATIONS
   POST /api/located/generate-default
===================================================== */
const DEFAULT_LOCATIONS = [
  { code: "SATPAM", name: "SATPAM" },
  { code: "PRM", name: "PRM" },
  { code: "STAFING", name: "STAFING" },
  { code: "MUSHOLA", name: "MUSHOLA" },
  { code: "RISTIRAHAT", name: "R. ISTIRAHAT" },
  { code: "BEACUKAI", name: "BEA CUKAI" },
  { code: "LOGISTIK", name: "LOGISTIK" },
  { code: "PSM", name: "PSM" },
  { code: "KOLAM", name: "KOLAM" },
  { code: "REVISIVENEER", name: "REVISI VENEER" },
  { code: "TEPUNG", name: "TEPUNG" },
  { code: "PROD2", name: "PRODUKSI 2" },
  { code: "PROD3", name: "PRODUKSI 3" },
  { code: "PROD4", name: "PRODUKSI 4" },
  { code: "PROD5", name: "PRODUKSI 5" },
  { code: "GUDANGWHS", name: "GUDANG WHS" },
  { code: "GUDANGP5", name: "GUDANG P5" },
  { code: "FINISHING", name: "FINISHING" },
  { code: "QC", name: "QC" },
  { code: "RMP", name: "RMP" },
  { code: "TEKNIK", name: "TEKNIK" },
  { code: "INCOMING", name: "INCOMING" },
  { code: "P4", name: "P4" },
  { code: "KEDIA", name: "KEDI A" },
  { code: "KEDIB", name: "KEDI B" },
  { code: "BOILER", name: "BOILER" },
  { code: "KM", name: "KM" }
];

router.post("/generate-default", async (req, res) => {
  try {
    const db = await dbPromise;

    const existingCount = await db.get(`SELECT COUNT(*) AS cnt FROM located`);
    if (existingCount.cnt > 0) {
      return res.json({
        ok: true,
        message: "Default location sudah tersedia.",
        total: existingCount.cnt
      });
    }

    let inserted = 0;
    for (const loc of DEFAULT_LOCATIONS) {
      await db.run(`INSERT INTO located (loc_code, loc_name) VALUES (?, ?)`, [loc.code, loc.name]);
      inserted++;
    }

    res.json({
      ok: true,
      message: `${inserted} default location berhasil dibuat.`,
      total: inserted
    });

  } catch (e) {
    console.error("GENERATE DEFAULT LOCATION ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

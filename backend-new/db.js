const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");

async function initDB() {
  const db = await open({
    filename: "data.db",
    driver: sqlite3.Database,
  });

  await db.exec(`
    PRAGMA foreign_keys = ON;

    /* =======================
       MASTER WAREHOUSE
    ======================== */
    CREATE TABLE IF NOT EXISTS warehouse_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      whs_code TEXT UNIQUE NOT NULL,
      whs_name TEXT NOT NULL
    );

    /* =======================
       VERIFICATORS
    ======================== */
    CREATE TABLE IF NOT EXISTS verifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user'
    );

    /* =======================
       COUNTERS (↔ VERIFICATOR)
    ======================== */
    CREATE TABLE IF NOT EXISTS counters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      verificator_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT (datetime('now','+7 hours')),
      FOREIGN KEY (verificator_id) REFERENCES verifiers(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    );

    /* =======================
       ITEM ON HAND
    ======================== */
    CREATE TABLE IF NOT EXISTS item_on_hand (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_code TEXT NOT NULL,
      description TEXT,
      item_group TEXT,
      whs_code TEXT NOT NULL,
      uom TEXT,
      bvolume REAL,
      onhand_qty_pcs INTEGER,
      onhand_qty_m3 REAL,
      created_at DATETIME DEFAULT (datetime('now','+7 hours'))
    );

    /* =======================
       WHS DIGITAL (STO)
    ======================== */
    CREATE TABLE IF NOT EXISTS whs_digital (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_qr TEXT NOT NULL UNIQUE,
      whs_code TEXT NOT NULL,
      item_code TEXT NOT NULL,
      description TEXT,

      sto_date DATETIME DEFAULT (datetime('now','+7 hours')),

      count_pcs INTEGER NOT NULL,
      count_m3 REAL NOT NULL,

      batch TEXT,

      counter_id INTEGER NOT NULL,
      verificator_id INTEGER NOT NULL,

      located_id INTEGER,
      kualitas TEXT,

      remark TEXT CHECK (length(remark) <= 500),

      created_at DATETIME DEFAULT (datetime('now','+7 hours')),

      FOREIGN KEY (counter_id) REFERENCES counters(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

      FOREIGN KEY (verificator_id) REFERENCES verifiers(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
      FOREIGN KEY (located_id) REFERENCES located(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    );
/*
    CREATE TABLE IF NOT EXISTS sto_tags (
*/
    CREATE TABLE IF NOT EXISTS sto_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  whs_code TEXT NOT NULL,
  item_code TEXT NOT NULL,
  seq INTEGER NOT NULL DEFAULT 0,  -- 🟡 DEPRECATED: akan dihapus di versi berikutnya. Gunakan id sebagai sequence.

  tag_qr TEXT UNIQUE NOT NULL,

  verificator_id INTEGER NOT NULL,
  counter_id INTEGER NOT NULL,
  located_id INTEGER,

  status TEXT DEFAULT 'OPEN', -- OPEN | CLOSED
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  scanned_at DATETIME ,

  FOREIGN KEY (verificator_id) REFERENCES verifiers(id),
  FOREIGN KEY (counter_id) REFERENCES counters(id),
  FOREIGN KEY (located_id) REFERENCES located(id)
);



    CREATE TABLE IF NOT EXISTS located (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loc_code TEXT UNIQUE NOT NULL,
    loc_name TEXT NOT NULL
    );

    /* =======================
       ACTIVITY LOG — untuk Recent Activity
    ======================== */
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_qr TEXT NOT NULL,
      whs_code TEXT NOT NULL,
      item_code TEXT NOT NULL,
      description TEXT DEFAULT '',
      activity_type TEXT NOT NULL,
      pcs INTEGER NOT NULL,
      m3 REAL NOT NULL,
      batch TEXT DEFAULT '',
      kualitas TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      location_name TEXT DEFAULT '',
      verificator_name TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now','+7 hours'))
    );

    CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);

    /* =======================
       ACCESS LOG — untuk log akses tidak sah
    ======================== */
    CREATE TABLE IF NOT EXISTS access_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_qr TEXT NOT NULL,
      whs_code TEXT DEFAULT '',
      item_code TEXT DEFAULT '',
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      action TEXT NOT NULL DEFAULT 'UNAUTHORIZED SCAN',
      created_at DATETIME DEFAULT (datetime('now','+7 hours'))
    );

    /* =======================
       GENERATE HISTORY
    ======================== */
    CREATE TABLE IF NOT EXISTS generate_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      generated_by INTEGER NOT NULL,
      total_row INTEGER NOT NULL DEFAULT 0,
      total_tag INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now','+7 hours'))
    );

  `);

  /* =======================
     MIGRASI: tambah kolom role jika belum ada
  ======================== */
  try {
    await db.exec("ALTER TABLE verifiers ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  } catch {
    // kolom sudah ada — abaikan
  }

  /* =======================
     MIGRASI: tambah kolom parent_admin_id jika belum ada
  ======================== */
  try {
    await db.exec("ALTER TABLE verifiers ADD COLUMN parent_admin_id INTEGER DEFAULT NULL REFERENCES verifiers(id)");
  } catch {
    // kolom sudah ada — abaikan
  }

  /* =======================
     MIGRASI ROLE: lama 'admin' / 'user' → baru SUPER_ADMIN / ADMIN / USER
  ======================== */
  // theo → SUPER_ADMIN
  await db.run(
    `UPDATE verifiers SET role = 'SUPER_ADMIN', name = 'Theo Super Admin' WHERE username = 'theo'`
  );
  // admin lain (jika ada) → ADMIN
  await db.run(
    `UPDATE verifiers SET role = 'ADMIN' WHERE role = 'admin' AND username != 'theo'`
  );
  // user → USER
  await db.run(
    `UPDATE verifiers SET role = 'USER' WHERE role NOT IN ('SUPER_ADMIN', 'ADMIN', 'ADMIN') AND username != 'theo'`
  );
  // pastikan semua parent_admin_id = NULL untuk data lama
  await db.run(`UPDATE verifiers SET parent_admin_id = NULL WHERE parent_admin_id IS NOT NULL`);

  /* =======================
     SEED / UPDATE VERIFICATOR
  ======================== */
  let verificator = await db.get("SELECT * FROM verifiers WHERE username = ?", [
    "theo",
  ]);

  if (!verificator) {
    const hash = bcrypt.hashSync("123456", 10);
    const res = await db.run(
      "INSERT INTO verifiers (username, password_hash, name, role) VALUES (?, ?, ?, ?)",
      ["theo", hash, "Theo Super Admin", "SUPER_ADMIN"]
    );
    verificator = { id: res.lastID };
  } else {
    await db.run(
      "UPDATE verifiers SET role = 'SUPER_ADMIN', name = ? WHERE username = ?",
      ["Theo Super Admin", "theo"]
    );
    verificator = await db.get("SELECT * FROM verifiers WHERE username = ?", ["theo"]);
  }

  // seed a default user for testing
  let userTest = await db.get("SELECT * FROM verifiers WHERE username = ?", [
    "user",
  ]);
  if (!userTest) {
    const hash = bcrypt.hashSync("123456", 10);
    await db.run(
      "INSERT INTO verifiers (username, password_hash, name, role) VALUES (?, ?, ?, ?)",
      ["user", hash, "Regular User", "USER"]
    );
  }

  /* =======================
     DUMMY COUNTERS (LINKED)
  ======================== */
  await db.run(
    `
    INSERT OR IGNORE INTO counters (id, name, verificator_id)
    VALUES
      (1, 'Counter A', ?),
      (2, 'Counter B', ?)
  `,
    [verificator.id, verificator.id]
  );

  /* =======================
     MIGRASI: normalisasi seq = id untuk record lama
  ======================== */
  const result = await db.run(`
    UPDATE sto_tags SET seq = id WHERE seq != id
  `);
  if (result.changes > 0) {
    console.log(`MIGRASI: ${result.changes} record sto_tags diset seq = id`);
  }

  /* =======================
     MIGRASI: update format tag_qr ke 5 digit
  ======================== */
  const mig2 = await db.run(`
    UPDATE sto_tags
    SET tag_qr = whs_code || '-' || item_code || '-' || SUBSTRING('00000' || id, -5)
    WHERE tag_qr != whs_code || '-' || item_code || '-' || SUBSTRING('00000' || id, -5)
      AND id > 0
  `);
  if (mig2.changes > 0) {
    console.log(`MIGRASI: ${mig2.changes} record tag_qr diupdate ke format 5 digit`);
  }

  /* =======================
     MIGRASI: tambah kolom recount untuk whs_digital
  ======================== */
  const recountColumns = [
    "first_count_pcs INTEGER",
    "first_count_m3 REAL",
    "recount_pcs INTEGER",
    "recount_m3 REAL",
    "recount_by INTEGER REFERENCES verifiers(id)",
    "recount_at DATETIME"
  ];
  for (const colDef of recountColumns) {
    try {
      await db.exec(`ALTER TABLE whs_digital ADD COLUMN ${colDef}`);
      console.log(`MIGRASI: kolom ${colDef.split(" ")[0]} ditambahkan`);
    } catch {
      // kolom sudah ada
    }
  }

  /* =======================
      MIGRASI: tambah kolom approval recount
  ======================== */
  const recountApprovalColumns = [
    "approval_status TEXT DEFAULT NULL",
    "recount_requested_by INTEGER REFERENCES verifiers(id)",
    "recount_requested_at DATETIME",
    "recount_admin_id INTEGER REFERENCES verifiers(id)",
    "recount_approved_by INTEGER REFERENCES verifiers(id)",
    "recount_approved_at DATETIME",
    "recount_rejected_by INTEGER REFERENCES verifiers(id)",
    "recount_rejected_at DATETIME"
  ];
  for (const colDef of recountApprovalColumns) {
    try {
      await db.exec(`ALTER TABLE sto_tags ADD COLUMN ${colDef}`);
      console.log(`MIGRASI: kolom ${colDef.split(" ")[0]} ditambahkan ke sto_tags`);
    } catch {
      // kolom sudah ada
    }
  }

  /* =======================
      MIGRASI: update status CLOSED → COMPLETED
  ======================== */
  const closedMig = await db.run(`
    UPDATE sto_tags SET status = 'COMPLETED' WHERE status = 'CLOSED'
  `);
  if (closedMig.changes > 0) {
    console.log(`MIGRASI: ${closedMig.changes} record sto_tags diupdate dari CLOSED ke COMPLETED`);
  }

  /* =======================
      MIGRASI: update status RECOUNT untuk data lama (jika ada)
  ======================== */
  const recountMig = await db.run(`
    UPDATE sto_tags
    SET status = 'RECOUNT'
    WHERE status = 'CLOSED'
      AND tag_qr IN (
        SELECT tag_qr FROM whs_digital WHERE recount_pcs IS NOT NULL
      )
  `);
  if (recountMig.changes > 0) {
    console.log(`MIGRASI: ${recountMig.changes} record sto_tags diset status = RECOUNT`);
  }

  /* =======================
      MIGRASI: tambah kolom location_detail ke sto_tags
  ======================== */
  try {
    await db.exec("ALTER TABLE sto_tags ADD COLUMN location_detail TEXT DEFAULT NULL");
    console.log("MIGRASI: kolom location_detail ditambahkan ke sto_tags");
  } catch {
    // kolom sudah ada
  }

  /* =======================
      MIGRASI: seed default location dari layout_pabrik.svg
  ======================== */
  const newLocations = [
    { code: "PRM", name: "PRM" },
    { code: "TEKNIK", name: "TEKNIK" },
    { code: "ADMIN", name: "ADMIN" },
    { code: "BASUKI1", name: "BASUKI 1" },
    { code: "BASUKI2", name: "BASUKI 2" },
    { code: "JUMBOP1", name: "JUMBO P1" },
    { code: "JUMBOP2", name: "JUMBO P2" },
    { code: "A1", name: "A1" },
    { code: "A2", name: "A2" },
    { code: "A4", name: "A4" },
    { code: "A5", name: "A5" },
    { code: "B3", name: "B3" },
    { code: "B4", name: "B4" },
    { code: "C1", name: "C1" },
    { code: "C2", name: "C2" },
    { code: "LORONGBOILER", name: "LORONG BOILER" },
    { code: "FINISHING", name: "FINISHING" },
    { code: "QC", name: "QC" },
    { code: "RMP", name: "RMP" },
    { code: "PRODUKSI2", name: "PRODUKSI 2" },
    { code: "PRODUKSI3", name: "PRODUKSI 3" },
    { code: "PRODUKSI4", name: "PRODUKSI 4" },
    { code: "PRODUKSI5", name: "PRODUKSI 5" },
    { code: "GUDANGWHS", name: "GUDANG WHS" },
    { code: "GUDANGP5", name: "GUDANG P5" },
    { code: "LOGISTIK", name: "LOGISTIK" },
    { code: "PSM", name: "PSM" },
    { code: "MUSHOLA", name: "MUSHOLA" },
    { code: "BEACUKAI", name: "BEA CUKAI" },
    { code: "RISTIRAHAT", name: "R. ISTIRAHAT" },
    { code: "REVISIVENEER", name: "REVISI VENEER" },
    { code: "TEPUNG", name: "TEPUNG" },
    { code: "SATPAM", name: "SATPAM" },
    { code: "KOLAM", name: "KOLAM" },
    { code: "STAFING", name: "STAFING" },
  ];
  const newCodeSet = new Set(newLocations.map(l => l.code));

  // Hapus location lama yang tidak ada di SVG baru
  const oldLocations = await db.all(`SELECT id, loc_code FROM located`);
  for (const old of oldLocations) {
    if (!newCodeSet.has(old.loc_code)) {
      // Lepas relasi sto_tags yang masih mengacu ke location ini
      await db.run(`UPDATE sto_tags SET located_id = NULL WHERE located_id = ?`, [old.id]);
      await db.run(`UPDATE whs_digital SET located_id = NULL WHERE located_id = ?`, [old.id]);
      await db.run(`DELETE FROM located WHERE id = ?`, [old.id]);
      console.log(`MIGRASI: location ${old.loc_code} dihapus (tidak ada di SVG baru)`);
    }
  }

  // Insert location baru yang belum ada
  let seededCount = 0;
  for (const loc of newLocations) {
    const existing = await db.get(`SELECT id FROM located WHERE loc_code = ?`, [loc.code]);
    if (!existing) {
      await db.run(`INSERT INTO located (loc_code, loc_name) VALUES (?, ?)`, [loc.code, loc.name]);
      seededCount++;
    }
  }
  if (seededCount > 0) {
    console.log(`MIGRASI: ${seededCount} default location berhasil ditambahkan`);
  }

  /* =======================
     TEST TIMEZONE
  ======================== */
  const now = await db.get("SELECT datetime('now','+7 hours') AS now");
  console.log("DB TIME (WIB):", now.now);

  return db;
}

module.exports = initDB();

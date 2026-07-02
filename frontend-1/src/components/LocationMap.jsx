import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import api from "../api";
import svgRaw from "../assets/layout_pabrik.svg?raw";

/* ================= NORMALISASI ================= */
function normalize(s) {
  return (s || "").toUpperCase().replace(/[\s.\-_]/g, "");
}

/* ================= LOCATION MAP ================= */
export const LOCATION_MAP = [
  { id: "PRODUKSI3", x: 60,  y: 20,  width: 350, height: 205 },
  { id: "GUDANG_WHS", x: 60,  y: 225, width: 350, height: 225 },
  { id: "PRODUKSI4", x: 60,  y: 450, width: 350, height: 180 },
  { id: "GUDANG_P5", x: 60,  y: 630, width: 350, height: 145 },
  { id: "PRODUKSI5", x: 60,  y: 775, width: 350, height: 150 },

  { id: "SATPAM", x: 350, y: 965, width: 120, height: 55 },

  { id: "KOLAM", x: 485, y: 20, width: 270, height: 120 },

  { id: "REVISI_VENEER", x: 560, y: 215, width: 230, height: 335 },
  { id: "TEPUNG", x: 675, y: 420, width: 115, height: 130 },

  { id: "RISTIRAHAT", x: 600, y: 595, width: 170, height: 60 },
  { id: "LOGISTIK", x: 600, y: 655, width: 170, height: 70 },
  { id: "PSM", x: 600, y: 725, width: 170, height: 65 },
  { id: "MUSHOLA", x: 600, y: 790, width: 170, height: 60 },
  { id: "BEACUKAI", x: 600, y: 850, width: 170, height: 80 },

  { id: "PRM", x: 920, y: 20, width: 260, height: 90 },

  { id: "TEKNIK", x: 930, y: 145, width: 125, height: 145 },
  { id: "ADMIN", x: 930, y: 290, width: 60, height: 110 },
  { id: "BASUKI2", x: 990, y: 220, width: 65, height: 70 },
  { id: "BASUKI1", x: 990, y: 290, width: 65, height: 110 },

  { id: "C2", x: 1085, y: 145, width: 55, height: 35 },
  { id: "B4", x: 1140, y: 145, width: 55, height: 35 },
  { id: "C1", x: 1085, y: 180, width: 55, height: 45 },
  { id: "B3", x: 1140, y: 180, width: 55, height: 45 },

  { id: "JUMBOP2", x: 1085, y: 225, width: 110, height: 95 },
  { id: "JUMBOP1", x: 1085, y: 320, width: 110, height: 95 },

  { id: "A4", x: 1230, y: 145, width: 95, height: 60 },
  { id: "A5", x: 1230, y: 205, width: 95, height: 60 },
  { id: "LORONG_BOILER", x: 1230, y: 265, width: 95, height: 60 },
  { id: "A2", x: 1230, y: 325, width: 95, height: 60 },
  { id: "A1", x: 1230, y: 385, width: 95, height: 60 },

  { id: "FINISHING", x: 900, y: 405, width: 455, height: 255 },

  { id: "STAFING", x: 870, y: 660, width: 270, height: 275 },

  { id: "QC", x: 1185, y: 660, width: 115, height: 155 },
  { id: "RMP", x: 1235, y: 815, width: 70, height: 70 },

  { id: "PRODUKSI2", x: 845, y: 885, width: 460, height: 140 },
];

const VIEWBOX_W = 1400;
const VIEWBOX_H = 1100;

/* ================= DISPLAY NAMES (LOCATION_MAP id → tooltip name) ================= */
const DISPLAY_NAMES = {
  PRODUKSI3: "PRODUKSI 3",
  GUDANG_WHS: "GUDANG WHS",
  PRODUKSI4: "PRODUKSI 4",
  GUDANG_P5: "GUDANG P5",
  PRODUKSI5: "PRODUKSI 5",
  SATPAM: "SATPAM",
  KOLAM: "KOLAM",
  REVISI_VENEER: "REVISI VENEER",
  TEPUNG: "TEPUNG",
  RISTIRAHAT: "R. ISTIRAHAT",
  LOGISTIK: "LOGISTIK",
  PSM: "PSM",
  MUSHOLA: "MUSHOLA",
  BEACUKAI: "BEA CUKAI",
  PRM: "PRM",
  TEKNIK: "TEKNIK",
  ADMIN: "ADMIN",
  BASUKI2: "BASUKI 2",
  BASUKI1: "BASUKI 1",
  C2: "C2",
  B4: "B4",
  C1: "C1",
  B3: "B3",
  JUMBOP2: "JUMBO P2",
  JUMBOP1: "JUMBO P1",
  A4: "A4",
  A5: "A5",
  LORONG_BOILER: "LORONG BOILER",
  A2: "A2",
  A1: "A1",
  FINISHING: "FINISHING",
  STAFING: "STAFING",
  QC: "QC",
  RMP: "RMP",
  PRODUKSI2: "PRODUKSI 2",
};

/* ================= ALIAS: old DB name → new LOCATION_MAP id ================= */
const NAME_ALIAS = {
  "PEMBAHANAN": "A1",
};

/* ================= HIDE SVG TEXT LABELS ================= */
const hideTextStyle = `
  .loc-label { opacity: 0 !important; pointer-events: none !important; }
`;

export default function LocationMap() {
  const [dbLocations, setDbLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeLoc, setActiveLoc] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState(null);
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const scaleRef = useRef({ sx: 1, sy: 1 });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/dashboard/location-progress");
        const data = Array.isArray(res.data) ? res.data : [];
        setDbLocations(data);
      } catch { setDbLocations([]); }
      setLoading(false);
    })();
  }, []);

  /* ================= BUILD LOOKUP ================= */
  const lookup = useMemo(() => {
    const map = {};
    for (const loc of dbLocations) {
      if (loc.loc_code) map[normalize(loc.loc_code)] = loc;
      if (loc.loc_name) map[normalize(loc.loc_name)] = loc;
    }
    // Aliases: jika DB masih pakai nama lama, mapping ke id baru
    for (const [oldName, newId] of Object.entries(NAME_ALIAS)) {
      const oldNorm = normalize(oldName);
      const newNorm = normalize(newId);
      if (map[oldNorm] && !map[newNorm]) {
        map[newNorm] = map[oldNorm];
      }
    }
    return map;
  }, [dbLocations]);

  /* ================= FIND LOCATION DATA ================= */
  const findLoc = useCallback((id) => {
    const key = normalize(id);
    return lookup[key] || null;
  }, [lookup]);

  /* ================= UPDATE SCALE ================= */
  const updateScale = useCallback(() => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width === 0) return;
    scaleRef.current = { sx: rect.width / VIEWBOX_W, sy: rect.height / VIEWBOX_H };
  }, []);

  useEffect(() => {
    if (loading) return;
    const el = wrapRef.current;
    if (!el) return;
    const svgEl = el.querySelector("svg");
    if (svgEl) {
      svgRef.current = svgEl;
      requestAnimationFrame(updateScale);
    }
  }, [loading, updateScale]);

  useEffect(() => {
    const onResize = () => updateScale();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [updateScale]);

  /* ================= COMPUTE STYLES FOR OVERLAY RECT ================= */
  const getOverlayStyle = useCallback((area) => {
    const { sx, sy } = scaleRef.current;
    return {
      position: "absolute",
      left: area.x * sx,
      top: area.y * sy,
      width: area.width * sx,
      height: area.height * sy,
      cursor: "pointer",
      pointerEvents: "auto",
    };
  }, []);

  /* ================= HANDLE HOVER ================= */
  const handleMouseEnter = useCallback((area, e) => {
    const loc = findLoc(area.id);
    const total = loc?.total_tags || 0;
    const completed = loc?.completed_tags || 0;
    const open = loc?.open_tags || 0;
    const recount = loc?.recount_tags || 0;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    setHoveredId(area.id);
    setActiveLoc({
      name: DISPLAY_NAMES[area.id] || area.id,
      total,
      completed,
      open,
      recount,
      pct,
      hasData: !!loc,
      assignments: loc?.assignments || [],
    });
    setMousePos({ x: e.clientX, y: e.clientY });
  }, [findLoc]);

  const handleMouseMove = useCallback((e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredId(null);
    setActiveLoc(null);
  }, []);

  /* ================= TOOLTIP POSITION ================= */
  const tipStyle = useMemo(() => {
    if (!activeLoc) return {};
    let l = mousePos.x + 16, t = mousePos.y + 16;
    if (l + 260 > window.innerWidth - 10) l = mousePos.x - 270;
    if (t + 200 > window.innerHeight - 10) t = mousePos.y - 210;
    if (l < 10) l = 10; if (t < 10) t = 10;
    return { left: l, top: t, position: "fixed", zIndex: 9999 };
  }, [activeLoc, mousePos]);

  /* ================= SVG HTML ================= */
  const svgHtml = useMemo(() => {
    return svgRaw
      .replace("viewBox=\"0 0 1400 1100\"", "viewBox=\"0 0 1400 1100\" preserveAspectRatio=\"xMidYMid meet\"")
      .replace("<svg", "<svg style=\"width:100%;height:auto;display:block\"");
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <style>{hideTextStyle}</style>
      <h3 className="font-semibold text-gray-800 mb-4">Peta Progress Location</h3>
      {loading ? (
        <div className="text-center py-8 text-gray-400">Memuat data location...</div>
      ) : (
        <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
          <div
            style={{ width: "100%" }}
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {LOCATION_MAP.map((area) => (
              <div
                key={area.id}
                style={getOverlayStyle(area)}
                onMouseEnter={(e) => handleMouseEnter(area, e)}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              />
            ))}
          </div>
        </div>
      )}

      {activeLoc && (
        <div
          className="bg-white text-gray-800 text-xs rounded-lg shadow-xl border border-gray-200 p-3 pointer-events-none"
          style={tipStyle}
        >
          <div className="font-bold text-sm mb-1 border-b border-gray-100 pb-1">{activeLoc.name}</div>
          {activeLoc.hasData ? (
            <React.Fragment>
              <div className="space-y-0.5">
                <div className="flex justify-between gap-4"><span className="text-gray-500">Progress</span><span className="font-bold">{activeLoc.pct}%</span></div>
                <div className="flex justify-between gap-4"><span className="text-gray-500">Total Tag</span><span className="font-semibold">{activeLoc.total}</span></div>
                <div className="flex justify-between gap-4"><span className="text-gray-500">Open</span><span className="font-semibold text-amber-600">{activeLoc.open}</span></div>
                <div className="flex justify-between gap-4"><span className="text-gray-500">Completed</span><span className="font-semibold text-green-600">{activeLoc.completed}</span></div>
                <div className="flex justify-between gap-4"><span className="text-gray-500">Recount</span><span className="font-semibold text-purple-600">{activeLoc.recount}</span></div>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="text-gray-500 font-medium mb-1">Assigned To</div>
                {activeLoc.assignments.length > 0 ? (
                  <div className="space-y-0.5">
                    {activeLoc.assignments.map(a => (
                      <div key={a.verificator_id} className="flex justify-between gap-4 text-[11px]">
                        <span className="text-gray-700">{a.verificator_name}</span>
                        <span className="font-semibold text-blue-600">({a.tag_count})</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-400 italic">-</div>
                )}
              </div>
            </React.Fragment>
          ) : (
            <div className="text-gray-400 italic py-1">Belum ada tag pada location ini.</div>
          )}
        </div>
      )}
    </div>
  );
}

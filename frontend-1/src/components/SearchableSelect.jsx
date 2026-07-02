import React, { useState, useRef, useEffect, useMemo } from "react";

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Cari...",
  labelKey = "name",
  searchKeys = ["name", "username"],
  renderOption,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) =>
      searchKeys.some((k) => (o[k] || "").toLowerCase().includes(q))
    );
  }, [options, search, searchKeys]);

  useEffect(() => {
    if (open) {
      setSearch("");
      setHighlightIdx(-1);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if (!open) return;
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((p) => (p < filtered.length - 1 ? p + 1 : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((p) => (p > 0 ? p - 1 : filtered.length - 1));
        return;
      }
      if (e.key === "Enter" && highlightIdx >= 0 && highlightIdx < filtered.length) {
        e.preventDefault();
        onChange(filtered[highlightIdx].id);
        setOpen(false);
        return;
      }
      if (e.key === "Tab") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, filtered, highlightIdx, onChange]);

  useEffect(() => {
    if (open && listRef.current && highlightIdx >= 0) {
      const el = listRef.current.children[highlightIdx];
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx, open]);

  useEffect(() => {
    const handler = (e) => {
      if (open && !e.target.closest("[data-searchable-select]")) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" data-searchable-select>
      <div
        className="border rounded w-full bg-white cursor-pointer flex items-center min-h-[38px]"
        onClick={() => setOpen((p) => !p)}
      >
        {selected ? (
          <div className="flex-1 px-2 py-1 text-sm truncate">
            {renderOption ? renderOption(selected, false) : selected[labelKey]}
          </div>
        ) : (
          <span className="flex-1 px-2 py-1 text-sm text-gray-400">{placeholder}</span>
        )}
        {value ? (
          <button
            type="button"
            className="px-1.5 text-gray-400 hover:text-gray-700 text-sm"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              setOpen(false);
            }}
          >
            ✕
          </button>
        ) : null}
        <span className="px-2 text-gray-400 text-xs">▼</span>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded shadow-lg max-h-64 overflow-hidden flex flex-col">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ketik nama atau username..."
            className="w-full px-3 py-2 text-sm border-b outline-none"
          />
          <div ref={listRef} className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="p-3 text-sm text-gray-400 text-center">Tidak ditemukan</div>
            ) : (
              filtered.map((o, i) => (
                <div
                  key={o.id}
                  className={`px-3 py-2 text-sm cursor-pointer border-b last:border-b-0 ${
                    i === highlightIdx ? "bg-blue-100" : "hover:bg-gray-50"
                  } ${o.id === value ? "font-semibold" : ""}`}
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                  onMouseEnter={() => setHighlightIdx(i)}
                >
                  {renderOption ? renderOption(o, true) : o[labelKey]}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

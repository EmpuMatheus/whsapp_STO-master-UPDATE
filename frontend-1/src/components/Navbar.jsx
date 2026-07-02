import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [open, setOpen] = useState(false);
  const [openMaster, setOpenMaster] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const closeAll = () => {
    setOpen(false);
    setOpenMaster(false);
  };

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";

  const MenuLinks = ({ mobile = false }) => (
    <>
      <NavLink to="/sto-tags" onClick={closeAll}>
        List Tags
      </NavLink>

      <NavLink to="/my-tags" onClick={closeAll}>
        My Tags
      </NavLink>

      {/* WHS DIGITAL — SUPER_ADMIN & ADMIN */}
      {isAdmin && (
        <NavLink to="/whs" onClick={closeAll}>
          WHS Digital
        </NavLink>
      )}

      {/* GENERATED — SUPER_ADMIN & ADMIN */}
      {isAdmin && (
        <NavLink to="/generate" onClick={closeAll}>
          Generated
        </NavLink>
      )}

      {/* MASTER DATA — SUPER_ADMIN only */}
      {isSuperAdmin && (
        <div className="relative">
          <button
            onClick={() => setOpenMaster(!openMaster)}
            className="flex items-center gap-1 hover:text-blue-600"
          >
            Master Data
            <span className="text-xs">▼</span>
          </button>

          {!mobile && openMaster && (
            <div
              className="absolute mt-2 bg-white border rounded shadow w-52 z-50"
              onMouseLeave={() => setOpenMaster(false)}
            >
              <SubLink to="/warehouses" label="Warehouses" />
              <SubLink to="/onhand" label="Item On Hand & Print Tag" />
              <SubLink to="/counters" label="Counters" />
              <SubLink to="/user" label="User Management" />
              <SubLink to="/located" label="Locations" />
              <SubLink to="/settings" label="Settings" />
            </div>
          )}

          {mobile && openMaster && (
            <div className="ml-4 mt-2 flex flex-col gap-2 text-sm text-gray-600">
              <SubLink to="/warehouses" label="Warehouses" mobile />
              <SubLink to="/onhand" label="Item On Hand & Print Tag" mobile />
              <SubLink to="/counters" label="Counters" mobile />
              <SubLink to="/user" label="User Management" mobile />
              <SubLink to="/located" label="Locations" mobile />
              <SubLink to="/settings" label="Settings" mobile />
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      <nav className="bg-white shadow h-14 flex items-center px-4 justify-between relative z-50">

        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            className="md:hidden text-2xl"
          >
            ☰
          </button>

          <Link
            to="/sto-tags"
            onClick={closeAll}
            className="text-xl font-bold text-green-600"
          >
            STO BBP
          </Link>

          <div className="hidden md:flex gap-6 ml-6 text-sm text-gray-700">
            <MenuLinks />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <span className="hidden md:flex items-center gap-1 text-sm text-gray-700">
              👤 <b>{user.name}</b>
            </span>
          )}

          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </nav>

      <div
        onClick={closeAll}
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300
          ${open ? "opacity-100 visible" : "opacity-0 invisible"}`}
      />

      <div
        className={`fixed top-0 left-0 h-full w-64 bg-white z-50
          transform transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b">
          <span className="font-bold text-blue-600">Menu</span>
          <button onClick={closeAll} className="text-xl">✕</button>
        </div>

        {user && (
          <div className="px-4 py-3 border-b text-sm text-gray-700">
            👤 Logged in as <b>{user.name}</b>
          </div>
        )}

        <div className="flex flex-col px-4 py-4 gap-4 text-gray-700 text-sm">
          <MenuLinks mobile />
        </div>
      </div>
    </>
  );
}

function NavLink({ to, children, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="hover:text-blue-600 transition-colors"
    >
      {children}
    </Link>
  );
}

function SubLink({ to, label, mobile }) {
  return (
    <Link
      to={to}
      className={`px-4 py-2 hover:bg-blue-50 hover:text-blue-600 ${
        mobile ? "" : "block"
      }`}
    >
      {label}
    </Link>
  );
}

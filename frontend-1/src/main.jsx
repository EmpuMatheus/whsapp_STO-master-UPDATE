import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";

import UserManagement from "./pages/UserManagement";
import AddUser from "./pages/AddUser";
import EditUser from "./pages/EditUser";

import Items from "./pages/Items";
import Warehouses from "./pages/Warehouses";
import Counters from "./pages/Counters";

import WhsDigital from "./pages/WhsDigital";
import InputWhsDigital from "./pages/InputWhsDigital";
import ItemOnHand from "./pages/ItemOnHand";

import MyStoTags from "./pages/MyStoTags";
import StoTags from "./pages/StoTags";
import Located from "./pages/Located";
import GenerateTags from "./pages/GenerateTags";
import Settings from "./pages/Settings";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";

import "./index.css";

function RootRedirect() {
  const { user, token, loading } = React.useMemo(
    () => {
      try {
        const savedToken = localStorage.getItem("token");
        const savedUser = localStorage.getItem("user");
        if (savedToken && savedUser) {
          const payload = JSON.parse(atob(savedToken.split(".")[1]));
          if (payload.exp * 1000 < Date.now()) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            return { user: null, token: null, loading: false };
          }
          return { user: JSON.parse(savedUser), token: savedToken, loading: false };
        }
        return { user: null, token: null, loading: false };
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        return { user: null, token: null, loading: false };
      }
    },
    []
  );

  if (loading) return null;

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "USER") {
    return <Navigate to="/my-tags" replace />;
  }

  return <Navigate to="/sto-tags" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ================= LOGIN ================= */}
          <Route path="/login" element={<Login />} />

          {/* ================= ROOT ================= */}
          <Route path="/" element={<RootRedirect />} />

          {/* ================= MASTER DATA (admin only) ================= */}
          <Route
            path="/verificator"
            element={
              <ProtectedRoute adminOnly>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/verificator/add"
            element={
              <ProtectedRoute adminOnly>
                <AddUser />
              </ProtectedRoute>
            }
          />
          <Route
            path="/verificator/edit/:id"
            element={
              <ProtectedRoute adminOnly>
                <EditUser />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user"
            element={
              <ProtectedRoute adminOnly>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/add"
            element={
              <ProtectedRoute adminOnly>
                <AddUser />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/edit/:id"
            element={
              <ProtectedRoute adminOnly>
                <EditUser />
              </ProtectedRoute>
            }
          />

          <Route
            path="/items"
            element={
              <ProtectedRoute adminOnly>
                <Items />
              </ProtectedRoute>
            }
          />

          <Route
            path="/warehouses"
            element={
              <ProtectedRoute adminOnly>
                <Warehouses />
              </ProtectedRoute>
            }
          />

          <Route
            path="/counters"
            element={
              <ProtectedRoute adminOnly>
                <Counters />
              </ProtectedRoute>
            }
          />

          <Route
            path="/onhand"
            element={
              <ProtectedRoute adminOnly>
                <ItemOnHand />
              </ProtectedRoute>
            }
          />

          <Route
            path="/located"
            element={
              <ProtectedRoute adminOnly>
                <Located />
              </ProtectedRoute>
            }
          />

          {/* ================= WHS DIGITAL ================= */}
          <Route
            path="/whs"
            element={
              <ProtectedRoute>
                <WhsDigital />
              </ProtectedRoute>
            }
          />
          <Route
            path="/input-whs-digital"
            element={
              <ProtectedRoute>
                <InputWhsDigital />
              </ProtectedRoute>
            }
          />
          <Route
            path="/generate"
            element={
              <ProtectedRoute adminOnly>
                <GenerateTags />
              </ProtectedRoute>
            }
          />
          {/* ================= VERIFICATOR TAGS ================= */}
          <Route
            path="/my-tags"
            element={
              <ProtectedRoute>
                <MyStoTags />
              </ProtectedRoute>
            }
          />

          {/* ================= TAGS LIST (semua user) ================= */}
          <Route
            path="/sto-tags"
            element={
              <ProtectedRoute>
                <StoTags />
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute superAdminOnly>
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* ================= FALLBACK ================= */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")).render(<App />);

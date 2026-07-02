import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import logo from "../assets/logo-bahana.png";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { login } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await api.post("/auth/login", {
        username,
        password
      });

      login(res.data.token, res.data.user);

      const role = res.data.user?.role;
      if (role === "USER") {
        nav("/my-tags", { replace: true });
      } else {
        nav("/sto-tags", { replace: true });
      }

    } catch (err) {
      alert(err.response?.data?.error || "Login gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      {/* OVERLAY */}
      <div className="login-overlay" />

      {/* LOGIN FORM */}
      <form
        onSubmit={submit}
        className="login-card"
      >
        <h2 className="text-xl font-bold mb-4 text-center">
          STOCK OPNAME BBP
        </h2>

        <input
          className="border w-full p-2 mb-3 rounded"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          className="border w-full p-2 mb-4 rounded"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          disabled={loading}
          className="bg-green-600 text-white w-full py-2 rounded"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      {/* STYLE KHUSUS LOGIN */}
      <style>{`
        .login-bg {
          position: fixed;
          inset: 0;
          background-image: url(${logo});
          background-repeat: repeat;
          background-size: 160px;
          animation: bgMove 45s linear infinite;
        }

        .login-overlay {
          position: absolute;
          inset: 0;
          background: rgba(245, 247, 250, 0.78);
          backdrop-filter: blur(2px);
        }

        .login-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 320px;
          background: white;
          padding: 24px;
          border-radius: 8px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
          margin: auto;
          top: 50%;
          transform: translateY(-50%);
        }

        @keyframes bgMove {
          from {
            background-position: 0 0;
          }
          to {
            background-position: 1000px 1000px;
          }
        }
      `}</style>
    </div>
  );
}

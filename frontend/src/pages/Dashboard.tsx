import React, { useEffect, useState, useRef } from "react";
import { api } from "../api";
import { useNavigate } from "react-router-dom";
import {
  FaSchool,
  FaUserGraduate,
  FaIdCard,
  FaClock,
  FaUserCircle,
} from "react-icons/fa";
import "../sidebar.css";

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    api
      .get("/dashboard/")
      .then((res) => setData(res.data))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  if (!data) return <div className="app-container card">Loading...</div>;

  const logout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    location.replace("/login");
  };

  return (
  
      <div className="dashboard-content">
        <div className="dashboard-line"></div>
        <h2 className="dashboard-title">Admin Dashboard</h2>

        <div className="dashboard-cards">
          <div
            className="info-card schools"
            onClick={() => nav("/admin/schools")}
          >
            <FaSchool className="card-icon" />
            <p className="card-label">Schools</p>
            <h3 className="card-value">{data.schools}</h3>
          </div>

          <div
            className="info-card students"
            onClick={() => nav("/admin/submissions")}
          >
            <FaUserGraduate className="card-icon" />
            <p className="card-label">Total Students</p>
            <h3 className="card-value">{data.students}</h3>
          </div>


          
             <div
            className="info-card pending"
            onClick={() => nav("/admin/submissions")}
          >
            <FaClock className="card-icon" />
            <p className="card-label">ID Cards Pending</p>
            <h3 className="card-value">{data.id_pending}</h3>
          </div>

           <div
            className="info-card generated"
            onClick={() => nav("/admin/submissions")}
          >
            <FaIdCard className="card-icon" />
            <p className="card-label">ID Cards Generated</p>
            <h3 className="card-value">{data.id_generated}</h3>
          </div>

          
        </div>
      </div>
  );
}

import { useEffect, useState } from "react";
import { api } from "../api";
import * as XLSX from "xlsx";

export default function AdminSubmissions() {
  const [schools, setSchools] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);

  useEffect(() => {
    api.get("/schools/").then((res) => setSchools(res.data));
    setClasses([]);
  }, []);

  async function loadClasses(sid: number) {
    try {
      const { data } = await api.get(`/classes/?school=${sid}`);
      const list = data.results ?? data ?? [];
      const filtered = (list || []).filter((c: any) => {
        const sMatch =
          c.school === sid ||
          (c.school && typeof c.school === "object" && c.school.id === sid) ||
          c.school_id === sid;
        return sMatch;
      });
      setClasses(filtered);
    } catch (err) {
      console.error("Failed loading classes", err);
      setClasses([]);
    }
  }

  async function loadSubmissions() {
    if (!schoolId || !classId) {
      alert("Select school and class");
      return;
    }

    const { data } = await api.get(
      `/students/submissions/?school=${schoolId}&classroom=${classId}`
    );
    const list = data.results ?? data ?? [];
    const filtered = (list || []).filter((s: any) => {
      const schoolMatch =
        s.school === schoolId ||
        (s.school && s.school.id === schoolId) ||
        s.school_id === schoolId;

      const classroomId =
        typeof s.classroom === "number"
          ? s.classroom
          : s.classroom && (s.classroom.id ?? s.classroom.pk ?? null);

      const classMatch = classroomId === classId;
      return schoolMatch && classMatch;
    });

    setStudents(filtered);
  }

    async function downloadPDF() {
    if (!schoolId || !classId) return;
    if (
      !window.confirm(
        "Are you sure you want to generate ID cards for this class?"
      )
    )
      return;

    try {
      // 1️⃣ Generate and download PDF
      const res = await api.get(
        `/students/generate_ids/?school=${schoolId}&classroom=${classId}`,
        { responseType: "blob" }
      );

      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "idcards.pdf");
      document.body.appendChild(link);
      link.click();
      link.remove();

      // 2️⃣ Mark each verified student as ID_GENERATED
      const verified = students.filter((s) => s.status === "VERIFIED");
      if (verified.length) {
        for (const stu of verified) {
          try {
            await api.post(`/students/${stu.id}/mark-id-generated/`);
          } catch (err) {
            console.warn(`Failed to update status for student ${stu.id}`, err);
          }
        }
        alert("All verified students have been marked as ID_GENERATED.");
      } else {
        alert("No verified students found to mark as ID_GENERATED.");
      }

      // 3️⃣ Reload list to reflect updated status
      await loadSubmissions();
    } catch (err) {
      console.error("Failed to generate or update status:", err);
      alert("Failed to generate ID cards or update student status.");
    }
  }


  function getClassName(idOrObj: number | any) {
    if (!idOrObj) return "";
    if (typeof idOrObj === "number") {
      const c = classes.find((c) => c.id === idOrObj);
      return c ? c.class_name : "";
    }
    if (typeof idOrObj === "object") {
      return idOrObj.class_name || idOrObj.name || "";
    }
    return "";
  }

  async function exportToExcel() {
    const worksheet = XLSX.utils.json_to_sheet(
      students.map((s) => ({
        Name: s.full_name,
        Class: getClassName(s.classroom),
        Phone: s.parent_phone,
        Status: s.status,
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
    XLSX.writeFile(workbook, "students.xlsx");
  }

  return (
    <div style={{ padding: 20, paddingLeft: 0, paddingRight: 0 }}>
      {/* Full-width top line */}
      <div
        style={{
          height: 2,
          width: "100%",
          backgroundColor: "#2c7be5",
          marginTop: 30,
          borderRadius: 2,
        }}
      ></div>

      {/* Header */}
      <h2
        style={{
          margin: 0,
          marginTop: 45,
          marginBottom: 20,
          color: "#2c7be5",
          fontSize: "26px",
          fontWeight: "bold",
        }}
      >
        Admin Submissions
      </h2>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <select
          value={schoolId ?? ""}
          onChange={(e) => {
            const sid = Number(e.target.value) || null;
            setSchoolId(sid);
            setClassId(null);
            setStudents([]);
            setClasses([]);
            if (sid) loadClasses(sid);
          }}
          style={inputStyle}
        >
          <option value="">Select School</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={classId ?? ""}
          onChange={(e) => setClassId(Number(e.target.value))}
          style={inputStyle}
        >
          <option value="">Select Class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.class_name || c.name || `Class ${c.id}`}
            </option>
          ))}
        </select>

        <button style={buttonStyle} onClick={loadSubmissions}>
          Load Submissions
        </button>
        <button style={buttonStyle} onClick={downloadPDF}>
          Generate ID Cards
        </button>
        <button style={buttonStyle} onClick={exportToExcel}>
          Export to Excel
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
          <thead>
            <tr style={{ backgroundColor: "#f1f1f1", textAlign: "left" }}>
              {["Name", "Class", "Phone", "Status"].map((h) => (
                <th key={h} style={{ padding: "10px 8px" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: "24px", color: "#777" }}>
                  No submissions found/ID Cards Generated
                </td>
              </tr>
            ) : (
              students.map((s) => (
                <tr
                  key={s.id}
                  style={{
                    borderBottom: "1px solid #eee",
                    cursor: "default",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fafafa")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <td style={tdStyle}>{s.full_name}</td>
                  <td style={tdStyle}>{getClassName(s.classroom)}</td>
                  <td style={tdStyle}>{s.parent_phone}</td>
                  <td style={tdStyle}>{s.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #ccc",
  fontSize: 15,
  outline: "none",
  minWidth: 160,
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 6,
  border: "none",
  backgroundColor: "#2c7be5",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 500,
  transition: "all 0.2s",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 8px",
};

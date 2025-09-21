// AdminSubmissions.tsx
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
    // ensure classes cleared on mount
    setClasses([]);
  }, []);

  // Robust loader: normalizes response and client-side filters classes by schoolId
  async function loadClasses(sid: number) {
    try {
      const { data } = await api.get(`/classes/?school=${sid}`);
      const list = data.results ?? data ?? [];

      // Filter classes so only those that belong to the selected school are kept.
      // Support various shapes: c.school (number), c.school.id (object), c.school_id
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
      setClasses([]); // safe fallback
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

    const res = await api.get(
      `/students/generate_ids/?school=${schoolId}&classroom=${classId}`,
      {
        responseType: "blob",
      }
    );
    const url = URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "idcards.pdf");
    document.body.appendChild(link);
    link.click();
    link.remove();
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
    <div className="app-container">
      <div className="card">
        <h2>Admin Submissions</h2>

        <select
          value={schoolId ?? ""}
          onChange={(e) => {
            const sid = Number(e.target.value) || null;
            setSchoolId(sid);
            // Clear previous class & students to avoid stale selections
            setClassId(null);
            setStudents([]);
            setClasses([]);

            if (sid) {
              loadClasses(sid);
            }
          }}
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
        >
          <option value="">Select Class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.class_name || c.name || `Class ${c.id}`}
            </option>
          ))}
        </select>

        <button onClick={loadSubmissions}>Load Submissions</button>
        <button onClick={downloadPDF}>Generate ID Cards</button>
        <button onClick={exportToExcel}>Export to Excel</button>

        <table
          className="table"
          border={1}
          style={{ marginTop: 20, width: "100%" }}
        >
          <thead>
            <tr>
              <th>Name</th>
              <th>Class</th>
              <th>Phone</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>{s.full_name}</td>
                <td>{getClassName(s.classroom)}</td>
                <td>{s.parent_phone}</td>
                <td>{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

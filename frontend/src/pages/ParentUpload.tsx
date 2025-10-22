import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

type Field = {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
};

export default function ParentUpload() {
  const { token } = useParams();
  const [schema, setSchema] = useState<Field[]>([]);
  const [meta, setMeta] = useState<any>({});
  const [status, setStatus] = useState<string>("Loading...");
  const [schoolInfo, setSchoolInfo] = useState<{ school: string; class: string; section?: string } | null>(null);
  const [fileMap, setFileMap] = useState<Record<string, File | null>>({});
    const [errors, setErrors] = useState<Record<string,string>>({});


  // Fetch form schema
  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`/api/public/form/${token}/`);
        setSchema(data.fields || []);
        setSchoolInfo({ school: data.school, class: data.class, section: data.section });
        setStatus("");
      } catch (e: any) {
        setStatus(e?.response?.data?.detail || "Invalid or expired link.");
      }
    })();
  }, [token]);
  // Format phone number as XXX-XXX-XXXX (keeps only digits, max 10)
  function formatPhone(value: string) {
    const digits = (value || "").replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0,3)}-${digits.slice(3)}`;
    return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
  }


    function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, files, type } = e.target as HTMLInputElement;

    // file input
    if (files && files.length) {
      setFileMap((prev) => ({ ...prev, [name]: files[0] }));
      // remove any prior error for this field
      setErrors(prev => { const p = { ...prev }; delete p[name]; return p; });
      return;
    }

    // detect phone fields by input type or name containing "phone"
    const isPhoneField = type === "tel" || /phone/i.test(name);

    if (isPhoneField) {
      // store formatted value for display
      const digits = (value || "").replace(/\D/g, "").slice(0, 10);
      setMeta((prev: any) => ({ ...prev, [name]: formatPhone(digits) }));

      // live validation: require exactly 10 digits
      if (digits.length === 10) {
        setErrors(prev => { const p = { ...prev }; delete p[name]; return p; });
      } else {
        setErrors(prev => ({ ...prev, [name]: "Please enter a valid 10-digit number." }));
      }
      return;
    }

    // default non-file, non-phone
    setMeta((prev: any) => ({ ...prev, [name]: value }));
    setErrors(prev => { const p = { ...prev }; delete p[name]; return p; });
  }


  async function submit(e: React.FormEvent) {
    e.preventDefault();
        // final validation for required fields and phone fields
    const newErrors: Record<string,string> = {};
    for (const f of schema) {
      const isPhoneField = f.type === "tel" || /phone/i.test(f.name);
      const raw = meta[f.name] ?? "";
      const digits = String(raw).replace(/\D/g, "");

      if (f.required) {
        if (f.type === "file") {
          if (!fileMap[f.name]) {
            newErrors[f.name] = `${f.label || f.name} is required.`;
            continue;
          }
        } else if (!raw || String(raw).trim() === "") {
          newErrors[f.name] = `${f.label || f.name} is required.`;
          continue;
        }
      }

      if (isPhoneField && digits.length !== 10) {
        newErrors[f.name] = "Please enter a valid 10-digit number.";
      }
    }

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      setStatus("❌ Please fix highlighted errors before submitting.");
      return;
    }

    setStatus("Submitting...");
    
    try {
  const fd = new FormData();
  schema.forEach((f) => {
    if (f.type === "file") {
      // append uploaded files as usual
      if (fileMap[f.name]) fd.append(f.name, fileMap[f.name] as File);
    } else {
      // handle normal and phone fields
      let value = meta[f.name];
      if (f.type === "tel" || /phone/i.test(f.name)) {
        // clean up phone number — only digits
        value = (value || "").replace(/\D/g, "");
      }
      if (value !== undefined) {
        fd.append(f.name, value);
      }
    }
  });

      await axios.post(`/api/public/upload/${token}/`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setStatus("✅ Thanks! Your details were submitted successfully.");
    } catch (err: any) {
      setStatus(err?.response?.data?.detail || "❌ Submission failed. Please try again.");
    }
  }

  if (status && !schema.length)
    return (
      <div style={{ maxWidth: 600, margin: "3rem auto", textAlign: "center", fontSize: 18, fontFamily: "'Inter', sans-serif" }}>
        {status}
      </div>
    );

  return (
    <div
      style={{
        maxWidth: 650,
        margin: "3rem auto",
        background: "#fff",
        padding: "2rem 2.5rem",
        borderRadius: 10,
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
        fontFamily: "'Inter', sans-serif",
        color: "#333",
      }}
    >
      <h2
        style={{
          textAlign: "center",
          color: "#2c7be5",
          fontWeight: 700,
          marginBottom: 10,
          letterSpacing: "0.5px",
        }}
      >
        Upload Student Details
      </h2>

      {schoolInfo && (
        <p
          style={{
            textAlign: "center",
            color: "#555",
            marginBottom: 25,
            fontSize: 16,
          }}
        >
          <b>{schoolInfo.school}</b> | Class: <b>{schoolInfo.class}</b>
          {schoolInfo.section ? ` - ${schoolInfo.section}` : ""}
        </p>
      )}

      <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
        {schema.map((f) => {

          const common = {
            name: f.name,
            required: !!f.required,
            onChange,
            style: {
              padding: "10px 12px",
              borderRadius: 6,
              border: "1px solid #ccc",
              outline: "none",
              fontSize: 15,
              transition: "border-color 0.2s, box-shadow 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              fontFamily: "'Inter', sans-serif",
              width: "100%",              
              boxSizing: "border-box",    
            },
            onFocus: (e: any) => (e.target.style.borderColor = "#2c7be5"),
            onBlur: (e: any) => (e.target.style.borderColor = "#ccc"),
          } as any; 
          
          switch (f.type) {
            case "text":
            case "email":
            case "tel":
            case "date":
              return (
                <div key={f.name}>
                  <input
                    type={f.type}
                    placeholder={f.label + (f.required ? " *" : "")}
                    {...common}
                    value={meta[f.name] ?? ""}
                    inputMode={f.type === "tel" || /phone/i.test(f.name) ? "numeric" : undefined}
                  />
                  {errors[f.name] && (
                    <div style={{ color: "crimson", fontSize: 13, marginTop: 6 }}>
                      {errors[f.name]}
                    </div>
                  )}
                </div>
              );

            case "textarea":
              return (
                <textarea
                  key={f.name}
                  placeholder={f.label + (f.required ? " *" : "")}
                  rows={4}
                  {...common}
                />
              );
            case "select":
              return (
                <select key={f.name} {...common}>
                  <option value="">{f.label}</option>
                  {(f.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              );
            case "file":
              return (
                <div key={f.name}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontWeight: 500,
                      color: "#444",
                    }}
                  >
                    {f.label + (f.required ? " *" : "")}
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    {...common}
                    style={{
                      border: "1px solid #ccc",
                      padding: "8px",
                      borderRadius: 6,
                      cursor: "pointer",
                      background: "#fafafa",
                      fontFamily: "'Inter', sans-serif",
                    }}
                  />
                </div>
              );
            default:
              return (
                <input
                  key={f.name}
                  type="text"
                  placeholder={f.label + (f.required ? " *" : "")}
                  {...common}
                />
              );
          }
        })}

        <button
          type="submit"
          style={{
            marginTop: 10,
            padding: "10px 20px",
            backgroundColor: "#2c7be5",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 16,
            fontWeight: 600,
            transition: "background-color 0.3s ease, transform 0.2s",
            fontFamily: "'Inter', sans-serif",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#1a5fcc";
            e.currentTarget.style.transform = "scale(1.02)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#2c7be5";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          Submit
        </button>
      </form>

      <div style={{ marginTop: 20, textAlign: "center", color: "#333", fontSize: 15 }}>
        {status}
      </div>
    </div>
  );
}

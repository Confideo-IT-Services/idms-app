import React, { useEffect, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { api } from "../api";
import { FaPlus, FaTrash } from "react-icons/fa";

type Element = {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  font?: string;
  size?: number;
  color?: string;
  isImage?: boolean;
  shape?: "square" | "circle" | "hexagon" | "rectangle" | "rounded" | "sphere";
  align?: "left" | "center" | "right";
};

export default function AdminIdTemplates() {
  const previewWidth = 700;
  const previewHeight = 900;
  const previewRef = useRef<HTMLDivElement | null>(null);

  const [schools, setSchools] = useState<any[]>([]);
  const [formTemplates, setFormTemplates] = useState<any[]>([]);
  const [idTemplates, setIdTemplates] = useState<any[]>([]);

  const [schoolId, setSchoolId] = useState<number | "">("");
  const [selectedFormTemplateId, setSelectedFormTemplateId] = useState<number | "">("");
  const [selectedIdTemplateId, setSelectedIdTemplateId] = useState<number | "">("");
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);

  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgPreviewUrl, setBgPreviewUrl] = useState<string>("");
  const [bgNaturalW, setBgNaturalW] = useState<number>(0);
  const [bgNaturalH, setBgNaturalH] = useState<number>(0);
  const [elements, setElements] = useState<Element[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [cardSizeMM, setCardSizeMM] = useState<{ w: number; h: number }>({ w: 54, h: 86 });

  const [loading, setLoading] = useState(false);

  // load schools once
  useEffect(() => {
    let mounted = true;
    api
      .get("/schools/")
      .then(res => {
        if (!mounted) return;
        setSchools(res.data.results ?? res.data);
      })
      .catch(() => {
        if (!mounted) return;
        setSchools([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // when school changes, load form templates & id templates
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!schoolId) {
        setFormTemplates([]);
        setIdTemplates([]);
        setSelectedFormTemplateId("");
        setSelectedIdTemplateId("");
        setSelectedTemplate(null);
        setBgPreviewUrl("");
        setElements([]);
        return;
      }

      setLoading(true);
      try {
        const ft = await api.get(`/form-templates/?school=${schoolId}`);
        if (cancelled) return;
        setFormTemplates(ft.data.results ?? ft.data);
      } catch (e) {
        if (!cancelled) setFormTemplates([]);
      }

      try {
        const it = await api.get(`/id-templates/?school=${schoolId}`);
        if (cancelled) return;
        const idData = it.data.results ?? it.data;
        setIdTemplates(idData);

        if (idData.length) {
          const def = idData.find((t: any) => t.is_default) ?? idData[0];
          setSelectedIdTemplateId(def.id ?? "");
          setBgPreviewUrl(def.background_url ?? def.background ?? "");
          if (def.card_size_mm) setCardSizeMM(def.card_size_mm);
        } else {
          setSelectedIdTemplateId("");
          setSelectedTemplate(null);
          setBgPreviewUrl("");
          setElements([]);
          setBgNaturalW(0);
          setBgNaturalH(0);
        }
      } catch (e) {
        if (!cancelled) setIdTemplates([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  // when selected ID template changes -> load/display it
  useEffect(() => {
    const tpl =
      idTemplates.find(
        t => String(t.id) === String(selectedIdTemplateId) || t.id === selectedIdTemplateId
      ) ?? null;

    setSelectedTemplate(tpl);

    if (!tpl) {
      setElements([]);
      setBgPreviewUrl("");
      setBgNaturalW(0);
      setBgNaturalH(0);
      return;
    }

    const url = tpl.background_url ?? tpl.background ?? "";
    setBgPreviewUrl(url);
    if (tpl.card_size_mm) setCardSizeMM(tpl.card_size_mm);

    if (url) {
      const img = new Image();
      let attached = true;
      img.onload = () => {
        if (!attached) return;
        try {
          const natW = img.naturalWidth;
          const natH = img.naturalHeight;
          setBgNaturalW(natW);
          setBgNaturalH(natH);

          const scale = Math.min(previewWidth / natW, previewHeight / natH);
          const displayedW = Math.round(natW * scale);
          const displayedH = Math.round(natH * scale);
          const offsetX = Math.round((previewWidth - displayedW) / 2);
          const offsetY = Math.round((previewHeight - displayedH) / 2);

          const fields = tpl.fields ?? {};
          const fieldObj = typeof fields === "object" ? fields : {};
          const elems: Element[] = Object.keys(fieldObj).map((k, i) => {
            const cfg = (fieldObj as any)[k] || {};
            const imageX = Number(cfg.x ?? 0),
              imageY = Number(cfg.y ?? 0);
            const imageW = Number(cfg.width ?? cfg.w ?? 100),
              imageH = Number(cfg.height ?? cfg.h ?? 30);

            const px = Math.round(imageX * scale + offsetX);
            const py = Math.round(imageY * scale + offsetY);
            const pw = Math.round(imageW * scale);
            const ph = Math.round(imageH * scale);

            return {
              id: Date.now() + i,
              name: k,
              x: px,
              y: py,
              width: pw,
              height: ph,
              font: cfg.font ?? "arial.ttf",
              size: cfg.size ?? Math.round(ph * 0.45),
              color: cfg.color ?? "#000000",
              isImage: !!cfg.isImage || k === "photo",
              shape:
                (cfg.shape as Element["shape"]) ?? (cfg.isImage || k === "photo" ? "square" : undefined),
              align:
                (cfg.align as Element["align"]) ?? (cfg.isImage || k === "photo" ? undefined : "left"),
            };
          });
          setElements(elems);
        } catch (err) {
          console.error("Error loading template fields:", err);
          setElements([]);
        }
      };
      img.onerror = () => {
        setBgNaturalW(0);
        setBgNaturalH(0);
        setElements([]);
      };
      img.src = url;
      return () => {
        (img as any).onload = null;
        (img as any).onerror = null;
      };
    } else {
      setBgNaturalW(0);
      setBgNaturalH(0);
      setElements([]);
    }
  }, [selectedIdTemplateId, idTemplates]);

  function onBgFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setBgFile(f);
    if (!f) {
      setBgPreviewUrl("");
      setBgNaturalW(0);
      setBgNaturalH(0);
      return;
    }
    const url = URL.createObjectURL(f);
    setBgPreviewUrl(url);
    const img = new Image();
    img.onload = () => {
      setBgNaturalW(img.naturalWidth);
      setBgNaturalH(img.naturalHeight);
    };
    img.onerror = () => {
      setBgNaturalW(0);
      setBgNaturalH(0);
    };
    img.src = url;
  }

  const availableFields = useMemo(() => {
    const ft =
      formTemplates.find(
        f => String(f.id) === String(selectedFormTemplateId) || f.id === selectedFormTemplateId
      ) ?? null;
    if (!ft) return [];
    const keys: any[] = [];
    if (Array.isArray(ft.fields)) {
      for (const obj of ft.fields) {
        if (typeof obj === "string") keys.push(obj);
        else keys.push(obj.name ?? obj.label ?? JSON.stringify(obj));
      }
    } else if (typeof ft.fields === "object") {
      for (const k of Object.keys(ft.fields)) keys.push(k);
    }
    return keys;
  }, [formTemplates, selectedFormTemplateId]);

  function addField(fieldName: string) {
    const isImage = fieldName === "photo";
    const el: Element = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: fieldName,
      x: 20,
      y: 20,
      width: isImage ? 120 : 160,
      height: isImage ? 160 : 40,
      font: "arial.ttf",
      size: isImage ? 12 : 16,
      color: "#000000",
      isImage,
      shape: isImage ? "square" : undefined,
      align: isImage ? undefined : "left",
    };
    setElements(s => [...s, el]);
    setSelectedId(el.id);
  }

  function updateElement(id: number, patch: Partial<Element>) {
    setElements(s => s.map(e => (e.id === id ? { ...e, ...patch } : e)));
  }

  function removeElement(id: number) {
    setElements(s => s.filter(e => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function convertPreviewToImageCoords(el: Element) {
    if (!bgNaturalW || !bgNaturalH) {
      return {
        x: Math.round(el.x),
        y: Math.round(el.y),
        width: Math.round(el.width),
        height: Math.round(el.height),
      };
    }

    const scale = Math.min(previewWidth / bgNaturalW, previewHeight / bgNaturalH);
    const displayedW = Math.round(bgNaturalW * scale);
    const displayedH = Math.round(bgNaturalH * scale);
    const offsetX = Math.round((previewWidth - displayedW) / 2);
    const offsetY = Math.round((previewHeight - displayedH) / 2);

    const imageX = Math.round((el.x - offsetX) / scale);
    const imageY = Math.round((el.y - offsetY) / scale);
    const imageW = Math.round(el.width / scale);
    const imageH = Math.round(el.height / scale);

    const clamp = (v: number, max: number) => Math.max(0, Math.min(Math.round(v), Math.round(max)));
    return {
      x: clamp(imageX, bgNaturalW),
      y: clamp(imageY, bgNaturalH),
      width: Math.max(0, Math.min(imageW, bgNaturalW)),
      height: Math.max(0, Math.min(imageH, bgNaturalH)),
    };
  }

  // SAVE layout to selected template (PATCH)
  async function saveLayoutToTemplate() {
    if (!selectedIdTemplateId) {
      setStatusMsg("No ID template selected");
      return;
    }

    setStatusMsg("Saving layout...");
    setLoading(true);
    try {
      const fieldsMap: any = {};
      for (const el of elements) {
        const imgcoords = convertPreviewToImageCoords(el);
        fieldsMap[el.name] = {
          x: imgcoords.x,
          y: imgcoords.y,
          width: imgcoords.width,
          height: imgcoords.height,
          font: el.font,
          size: el.size ?? Math.round(el.height * 0.45),
          color: el.color,
          isImage: !!el.isImage,
          shape: el.shape ?? null,
          align: el.align ?? undefined,
        };
      }

      const form = new FormData();
      form.append("fields", JSON.stringify(fieldsMap));
      form.append("card_size_mm", JSON.stringify(cardSizeMM));
      form.append("is_default", String(isDefault));
      if (bgFile) form.append("background", bgFile);

      await api.patch(`/id-templates/${selectedIdTemplateId}/`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      try {
        const refreshed = await api.get(`/id-templates/?school=${schoolId}`);
        const idData = refreshed.data.results ?? refreshed.data;
        setIdTemplates(idData);

        const updatedTemplate = idData.find((t: any) => String(t.id) === String(selectedIdTemplateId));
        if (updatedTemplate) {
          setSelectedTemplate(updatedTemplate);
          if (updatedTemplate.background_url ?? updatedTemplate.background) {
            setBgPreviewUrl(updatedTemplate.background_url ?? updatedTemplate.background);
            if (updatedTemplate.card_size_mm) setCardSizeMM(updatedTemplate.card_size_mm);
          }
        }
      } catch (err) {
        console.warn("Failed to refresh templates after save", err);
      }

      setStatusMsg("✅ Layout saved successfully!");
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      console.error("Failed to save template:", err);
      setStatusMsg(
        "Failed to save: " + (err?.response?.data ? JSON.stringify(err.response.data) : err.message)
      );
    } finally {
      setLoading(false);
    }
  }

  // CREATE a new template (POST)
  async function createNewTemplate() {
    if (!schoolId) {
      setStatusMsg("Select school");
      return;
    }
    if (!newName) {
      setStatusMsg("Provide name");
      return;
    }
    if (!bgFile) {
      setStatusMsg("Upload background");
      return;
    }

    setStatusMsg("Creating template...");
    setLoading(true);

    try {
      const fieldsMap: any = {};
      for (const el of elements) {
        const imgcoords = convertPreviewToImageCoords(el);
        fieldsMap[el.name] = {
          x: imgcoords.x,
          y: imgcoords.y,
          width: imgcoords.width,
          height: imgcoords.height,
          font: el.font,
          size: el.size ?? Math.round(el.height * 0.45),
          color: el.color,
          isImage: !!el.isImage,
          shape: el.shape ?? null,
          align: el.align ?? undefined,
        };
      }

      const form = new FormData();
      form.append("school", String(schoolId));
      form.append("name", newName);
      form.append("fields", JSON.stringify(fieldsMap));
      form.append("is_default", String(isDefault));
      form.append("background", bgFile);
      form.append("card_size_mm", JSON.stringify(cardSizeMM));

      const response = await api.post(`/id-templates/`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      try {
        const refreshed = await api.get(`/id-templates/?school=${schoolId}`);
        const idData = refreshed.data.results ?? refreshed.data;
        setIdTemplates(idData);
      } catch (err) {
        console.warn("Failed to refresh templates after create", err);
      }

      const createdTemplate = response.data;
      setSelectedIdTemplateId(createdTemplate.id ?? "");
      setSelectedTemplate(createdTemplate);
      if (createdTemplate.background_url ?? createdTemplate.background) {
        setBgPreviewUrl(createdTemplate.background_url ?? createdTemplate.background);
        if (createdTemplate.card_size_mm) setCardSizeMM(createdTemplate.card_size_mm);
      }

      setStatusMsg("✅ Template created successfully!");
      setTimeout(() => setStatusMsg(null), 3000);

      setNewName("");
      setBgFile(null);
    } catch (err: any) {
      console.error("Failed to create template:", err);
      setStatusMsg(
        "Failed to create: " + (err?.response?.data ? JSON.stringify(err.response.data) : err.message)
      );
    } finally {
      setLoading(false);
    }
  }

  // DELETE a template
  async function deleteTemplate(templateId: number) {
    // quick safety checks
    if (!templateId) {
      setStatusMsg("No template selected to delete");
      return;
    }

    // Optional: prevent deleting default template without confirmation
    const tpl = idTemplates.find(t => String(t.id) === String(templateId));
    const confirmMsg = tpl
      ? tpl.is_default
        ? `Template "${tpl.name}" is the default. Are you sure you want to delete it?`
        : `Delete template "${tpl.name}"? This action cannot be undone.`
      : "Delete selected template?";
    if (!window.confirm(confirmMsg)) return;

    setStatusMsg("Deleting template...");
    setLoading(true);
    try {
      await api.delete(`/id-templates/${templateId}/`);
      // refresh list
      const refreshed = await api.get(`/id-templates/?school=${schoolId}`);
      const idData = refreshed.data.results ?? refreshed.data;
      setIdTemplates(idData);

      // if deleted template was current selection, pick a fallback
      if (String(selectedIdTemplateId) === String(templateId)) {
        if (idData.length) {
          const def = idData.find((t: any) => t.is_default) ?? idData[0];
          setSelectedIdTemplateId(def.id ?? "");
          setSelectedTemplate(def);
          setBgPreviewUrl(def.background_url ?? def.background ?? "");
          if (def.card_size_mm) setCardSizeMM(def.card_size_mm);
        } else {
          setSelectedIdTemplateId("");
          setSelectedTemplate(null);
          setBgPreviewUrl("");
          setElements([]);
          setBgNaturalW(0);
          setBgNaturalH(0);
        }
      } else {
        // if other selection remains, just ensure selectedTemplate is in sync
        const stillSelected = idData.find((t: any) => String(t.id) === String(selectedIdTemplateId));
        if (!stillSelected) {
          // pick first available or clear
          if (idData.length) {
            const def = idData.find((t: any) => t.is_default) ?? idData[0];
            setSelectedIdTemplateId(def.id ?? "");
            setSelectedTemplate(def);
            setBgPreviewUrl(def.background_url ?? def.background ?? "");
            if (def.card_size_mm) setCardSizeMM(def.card_size_mm);
          } else {
            setSelectedIdTemplateId("");
            setSelectedTemplate(null);
            setBgPreviewUrl("");
            setElements([]);
            setBgNaturalW(0);
            setBgNaturalH(0);
          }
        }
      }

      setStatusMsg("✅ Template deleted");
      setTimeout(() => setStatusMsg(null), 2500);
    } catch (err: any) {
      console.error("Failed to delete template:", err);
      setStatusMsg("Failed to delete: " + (err?.response?.data ? JSON.stringify(err.response.data) : err.message));
    } finally {
      setLoading(false);
    }
  }

  function previewFontSize(el: Element) {
    return Math.max(8, Math.round(el.size ?? Math.round(el.height * 0.45)));
  }

  const LoadingOverlay = () =>
    loading ? (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(255,255,255,0.85)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              borderTop: "4px solid #2c7be5",
              borderRight: "4px solid transparent",
              animation: "spin 1s linear infinite",
              margin: "0 auto 8px",
            }}
          />
          <div style={{ color: "#2c7be5", fontWeight: 600 }}>Processing...</div>
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
      </div>
    ) : null;

  return (
    <div style={{ padding: 20, paddingLeft: 0, paddingRight: 0 }}>
      <LoadingOverlay />

      <div
        style={{
          height: 2,
          width: "100%",
          backgroundColor: "#2c7be5",
          marginTop: 30,
          borderRadius: 2,
        }}
      />

      <div
        style={{
          padding: 20,
          borderRadius: 10,
          marginTop: 20,
        }}
      >
        <h2
          style={{
            marginBottom: 16,
            fontSize: 24,
            fontWeight: "bold",
            color: "#2c7be5",
            marginTop: 0,
          }}
        >
          ID Template Designer
        </h2>

        {statusMsg && (
          <div
            style={{
              marginBottom: 12,
              padding: "8px 12px",
              borderRadius: 6,
              color: statusMsg.includes("Failed") ? "#b00020" : "#266b37ff",
              backgroundColor: statusMsg.includes("Failed") ? "#f8d7da" : "#d4edda",
              border: statusMsg.includes("Failed") ? "1px solid #f5c6cb" : "1px solid #c3e6cb",
            }}
          >
            {statusMsg}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <select
            value={schoolId as any}
            onChange={e => setSchoolId(e.target.value === "" ? "" : Number(e.target.value))}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #ccc",
              outline: "none",
            }}
          >
            <option value="">-- Select School --</option>
            {schools.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={selectedFormTemplateId as any}
            onChange={e =>
              setSelectedFormTemplateId(e.target.value === "" ? "" : Number(e.target.value))
            }
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #ccc",
              outline: "none",
            }}
          >
            <option value="">-- Parent Form Template --</option>
            {formTemplates.map((f: any) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          {/* ID template select + delete button */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select
              value={selectedIdTemplateId as any}
              onChange={e => setSelectedIdTemplateId(e.target.value === "" ? "" : Number(e.target.value))}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #ccc",
                outline: "none",
              }}
            >
              <option value="">-- ID Template --</option>
              {idTemplates.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.is_default ? "(default)" : ""}
                </option>
              ))}
            </select>

            {/* Delete button */}
            <button
              title="Delete selected template"
              onClick={() => {
                if (!selectedIdTemplateId) {
                  setStatusMsg("Select a template to delete");
                  setTimeout(() => setStatusMsg(null), 2500);
                  return;
                }
                deleteTemplate(Number(selectedIdTemplateId));
              }}
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid #e0b4b4",
                backgroundColor: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <FaTrash /> Delete
            </button>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />
            Set default
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Card size:
            <select
              value={`${cardSizeMM.w}x${cardSizeMM.h}`}
              onChange={e => {
                const [w, h] = e.target.value.split("x").map(Number);
                setCardSizeMM({ w, h });
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #ccc",
                outline: "none",
              }}
            >
              <option value="54x86">54 x 86 mm</option>
              <option value="48x72">48 x 72 mm</option>
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: 18 }}>
          {/* Left controls */}
          <div style={{ minWidth: 260 }}>
            <h4 style={{ marginBottom: 12 }}>Controls</h4>

            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Upload / Replace background</label>
              <input type="file" accept="image/*" onChange={onBgFileChange} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Template name (new)</label>
              <input
                className="input"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  outline: "none",
                  width: "100%",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                onClick={createNewTemplate}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  backgroundColor: "#2c7be5",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                <FaPlus style={{ marginRight: 6 }} /> Create Template
              </button>
              <button
                onClick={saveLayoutToTemplate}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  backgroundColor: "#2c7be5",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Save Layout
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h4 style={{ marginBottom: 8 }}>Available Fields</h4>
              <div className="vstack">
                {availableFields.length ? (
                  availableFields.map((f: any) => (
                    <button
                      key={f}
                      className="btn-small"
                      onClick={() => addField(f)}
                      style={{
                        marginBottom: 4,
                        padding: "6px 10px",
                        border: "1px solid #ccc",
                        borderRadius: 4,
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      {f}
                    </button>
                  ))
                ) : (
                  <div className="helper">Select a parent form template</div>
                )}
              </div>
            </div>

            <div>
              <h4 style={{ marginBottom: 8 }}>Selected Element</h4>
              {selectedId ? (
                (() => {
                  const s = elements.find(el => el.id === selectedId)!;
                  if (!s) return <div className="helper">Select a placeholder to edit</div>;
                  return (
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>{s.name}</div>

                      <div style={{ marginBottom: 8 }}>
                        <label className="form-label">Font family</label>
                        <select
                          value={s.font}
                          onChange={e => updateElement(s.id, { font: e.target.value })}
                          style={{
                            padding: "6px 8px",
                            borderRadius: 6,
                            border: "1px solid #ccc",
                            outline: "none",
                            width: "100%",
                          }}
                        >
                          <option value="arial.ttf">Arial</option>
                          <option value="arialbd.ttf">Arial Bold</option>
                          <option value="times.ttf">Times</option>
                        </select>
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <label className="form-label">Font size</label>
                        <input
                          type="number"
                          className="input"
                          value={s.size}
                          onChange={e => updateElement(s.id, { size: Number(e.target.value) })}
                          style={{
                            padding: "6px 8px",
                            borderRadius: 6,
                            border: "1px solid #ccc",
                            outline: "none",
                            width: "100%",
                          }}
                        />
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <label className="form-label">Color</label>
                        <input
                          type="color"
                          value={s.color}
                          onChange={e => updateElement(s.id, { color: e.target.value })}
                          style={{ width: "100%" }}
                        />
                      </div>

                      {s.isImage && (
                        <div style={{ marginBottom: 8 }}>
                          <label className="form-label">Shape</label>
                          <select
                            value={s.shape ?? "square"}
                            onChange={e => updateElement(s.id, { shape: e.target.value as any })}
                            style={{
                              width: "100%",
                              padding: "6px 8px",
                              borderRadius: 6,
                              border: "1px solid #ccc",
                              outline: "none",
                            }}
                          >
                            <option value="square">Square</option>
                            <option value="rectangle">Rectangle</option>
                            <option value="rounded">Rounded</option>
                            <option value="circle">Circle</option>
                            <option value="hexagon">Hexagon</option>
                            <option value="sphere">Sphere</option>
                          </select>
                        </div>
                      )}

                      {!s.isImage && (
                        <div style={{ marginBottom: 8 }}>
                          <label className="form-label">Alignment</label>
                          <select
                            value={s.align ?? "left"}
                            onChange={e => updateElement(s.id, { align: e.target.value as any })}
                            style={{
                              width: "100%",
                              padding: "6px 8px",
                              borderRadius: 6,
                              border: "1px solid #ccc",
                              outline: "none",
                            }}
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                      )}

                      <button
                        className="button secondary"
                        onClick={() => removeElement(s.id)}
                        style={{
                          marginTop: 12,
                          padding: "8px 16px",
                          borderRadius: 6,
                          border: "1px solid #ccc",
                          backgroundColor: "#fff",
                          cursor: "pointer",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })()
              ) : (
                <div className="helper">Select a placeholder to edit</div>
              )}
            </div>
          </div>

          {/* Preview panel */}
          <div style={{ flex: 1 }}>
            <div
              ref={previewRef}
              style={{
                width: previewWidth,
                height: previewHeight,
                border: "1px solid #ddd",
                borderRadius: 8,
                overflow: "hidden",
                position: "relative",
                background: "#fff",
              }}
            >
              {bgPreviewUrl ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: `url(${bgPreviewUrl})`,
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                  }}
                >
                  {elements.map(el => (
                    <Rnd
                      key={el.id}
                      bounds="parent"
                      size={{ width: el.width, height: el.height }}
                      position={{ x: el.x, y: el.y }}
                      onDragStop={(e, d) =>
                        updateElement(el.id, { x: Math.round(d.x), y: Math.round(d.y) })
                      }
                      onResizeStop={(e, dir, ref, delta, pos) => {
                        let w = Math.round(ref.offsetWidth);
                        let h = Math.round(ref.offsetHeight);

                        if (el.shape === "circle" || el.shape === "sphere") w = h = Math.max(w, h);

                        updateElement(el.id, {
                          width: w,
                          height: h,
                          x: Math.round(pos.x),
                          y: Math.round(pos.y),
                        });
                      }}
                      onClick={() => setSelectedId(el.id)}
                      style={{
                        border: selectedId === el.id ? "2px solid #2196f3" : "1px dashed #c00",
                        background: el.isImage ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "move",
                        borderRadius:
                          el.shape === "circle" || el.shape === "sphere" ? "50%" : el.shape === "rounded" ? "6px" : "0%",
                        clipPath: el.shape === "hexagon" ? "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)" : undefined,
                        color: el.color ?? "#000",
                        boxSizing: "border-box",
                        padding: el.isImage ? 0 : "6px 8px",
                        textAlign: el.align ?? (el.isImage ? "center" : "left"),
                      }}
                    >
                      <div
                        style={{
                          fontSize: previewFontSize(el),
                          fontFamily: el.font ?? "Arial",
                          width: "100%",
                          textAlign: el.isImage ? "center" : el.align ?? "left",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {el.isImage ? "PHOTO" : el.name}
                      </div>
                    </Rnd>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 20 }}>Upload/select a background to design</div>
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
              Tip: place fields relative to background. Coordinates saved in image pixels for exact printing.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

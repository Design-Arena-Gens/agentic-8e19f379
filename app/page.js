"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "discipline-table-v1";

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday=0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

function formatISODate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(d, n) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}

function downloadFile(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Page() {
  const [habits, setHabits] = useState([]); // [{id, name}]
  const [checks, setChecks] = useState({}); // { habitId: { dateStr: true } }
  const [weekStart, setWeekStart] = useState(() => getStartOfWeek(new Date()));
  const [newHabitName, setNewHabitName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setHabits(parsed.habits || []);
        setChecks(parsed.checks || {});
      } else {
        const seed = [
          { id: crypto.randomUUID(), name: "Wake early" },
          { id: crypto.randomUUID(), name: "Exercise" },
          { id: crypto.randomUUID(), name: "Deep work (2h)" },
        ];
        setHabits(seed);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    const data = { habits, checks };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }, [habits, checks]);

  function toggleCheck(habitId, dateStr) {
    setChecks((prev) => {
      const forHabit = prev[habitId] || {};
      const next = { ...prev, [habitId]: { ...forHabit, [dateStr]: !forHabit[dateStr] } };
      return next;
    });
  }

  function addHabit() {
    const name = newHabitName.trim();
    if (!name) return;
    const h = { id: crypto.randomUUID(), name };
    setHabits((prev) => [...prev, h]);
    setNewHabitName("");
  }

  function removeHabit(id) {
    if (!confirm("Delete this habit?")) return;
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setChecks((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function startEdit(habit) {
    setEditingId(habit.id);
    setEditingName(habit.name);
  }

  function commitEdit() {
    const name = editingName.trim();
    if (!name) {
      setEditingId(null);
      setEditingName("");
      return;
    }
    setHabits((prev) => prev.map((h) => (h.id === editingId ? { ...h, name } : h)));
    setEditingId(null);
    setEditingName("");
  }

  function exportCSV() {
    const header = ["Habit", ...days.map((d) => formatISODate(d))].join(",");
    const rows = habits.map((h) => {
      const cells = days.map((d) => (checks[h.id]?.[formatISODate(d)] ? "1" : "0"));
      return [escapeCSV(h.name), ...cells].join(",");
    });
    const csv = [header, ...rows].join("\n");
    downloadFile(`discipline-${formatISODate(weekStart)}.csv`, csv);
  }

  function escapeCSV(s) {
    if (s.includes(",") || s.includes("\n") || s.includes("\"")) {
      return '"' + s.replaceAll('"', '""') + '"';
    }
    return s;
  }

  function exportJSON() {
    const payload = JSON.stringify({ habits, checks }, null, 2);
    downloadFile("discipline-data.json", payload);
  }

  function handleImportJSON(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed.habits) || typeof parsed.checks !== "object") {
          alert("Invalid JSON format");
          return;
        }
        setHabits(parsed.habits);
        setChecks(parsed.checks);
      } catch (err) {
        alert("Failed to parse JSON");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // reset
  }

  const weekLabel = useMemo(() => {
    const start = days[0];
    const end = days[6];
    const fmt = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(start)} - ${fmt(end)}`;
  }, [days]);

  const totals = useMemo(() => {
    const perHabit = Object.fromEntries(
      habits.map((h) => [h.id, days.reduce((acc, d) => acc + (checks[h.id]?.[formatISODate(d)] ? 1 : 0), 0)])
    );
    const perDay = days.map((d) => habits.reduce((acc, h) => acc + (checks[h.id]?.[formatISODate(d)] ? 1 : 0), 0));
    return { perHabit, perDay };
  }, [habits, checks, days]);

  return (
    <main className="container">
      <header className="header">
        <h1>Discipline Table</h1>
        <div className="controls">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))}>&larr; Prev</button>
          <span className="week-label" title={formatISODate(weekStart)}>{weekLabel}</span>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))}>Next &rarr;</button>
          <button onClick={() => setWeekStart(getStartOfWeek(new Date()))}>Today</button>
        </div>
        <div className="actions">
          <button onClick={exportCSV}>Export CSV</button>
          <button onClick={exportJSON}>Export JSON</button>
          <label className="import-btn">
            Import JSON
            <input type="file" accept="application/json" onChange={handleImportJSON} />
          </label>
        </div>
      </header>

      <section className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th className="sticky-left">Habit</th>
              {days.map((d) => (
                <th key={formatISODate(d)}>
                  <div className="day-head">
                    <div className="dow">{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
                    <div className="date">{d.getDate()}</div>
                  </div>
                </th>
              ))}
              <th>Week</th>
              <th className="sticky-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {habits.map((h) => (
              <tr key={h.id}>
                <td className="sticky-left">
                  {editingId === h.id ? (
                    <div className="edit-row">
                      <input
                        className="text-input"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") {
                            setEditingId(null);
                            setEditingName("");
                          }
                        }}
                        autoFocus
                      />
                      <button className="small" onClick={commitEdit}>Save</button>
                    </div>
                  ) : (
                    <span className="habit-name" onDoubleClick={() => startEdit(h)} title="Double-click to rename">
                      {h.name}
                    </span>
                  )}
                </td>
                {days.map((d) => {
                  const ds = formatISODate(d);
                  const checked = !!checks[h.id]?.[ds];
                  return (
                    <td key={ds}>
                      <button
                        className={`cell ${checked ? "on" : ""}`}
                        onClick={() => toggleCheck(h.id, ds)}
                        aria-pressed={checked}
                        aria-label={`Toggle ${h.name} on ${ds}`}
                      >
                        {checked ? "?" : ""}
                      </button>
                    </td>
                  );
                })}
                <td>
                  <div className="total">{totals.perHabit[h.id] || 0}/7</div>
                </td>
                <td className="sticky-right">
                  <div className="row-actions">
                    <button className="small" onClick={() => startEdit(h)}>Rename</button>
                    <button className="small danger" onClick={() => removeHabit(h.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="sticky-left">
                <div className="add-row">
                  <input
                    className="text-input"
                    placeholder="Add new habit"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addHabit()}
                  />
                  <button onClick={addHabit}>Add</button>
                </div>
              </td>
              {days.map((d, i) => (
                <td key={i}>
                  <div className="col-total" title="Completed habits this day">
                    {totals.perDay[i] || 0}
                  </div>
                </td>
              ))}
              <td></td>
              <td className="sticky-right"></td>
            </tr>
          </tfoot>
        </table>
      </section>

      <footer className="footer">
        <button className="outline" onClick={() => {
          if (confirm('Clear all data? This cannot be undone.')) {
            setHabits([]);
            setChecks({});
            try { localStorage.removeItem(STORAGE_KEY); } catch {}
          }
        }}>Clear all data</button>
      </footer>
    </main>
  );
}

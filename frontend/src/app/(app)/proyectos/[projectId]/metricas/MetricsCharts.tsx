"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProjectMetrics } from "@/lib/types";
import styles from "./metrics.module.css";

// Colours come from the design tokens (CSS variables also work in SVG attributes).
const COLOR = {
  todo: "var(--line-strong)",
  inProgress: "var(--accent-mid)",
  done: "var(--accent)",
} as const;

const STATUSES = [
  { key: "todo", label: "Por hacer" },
  { key: "inProgress", label: "En curso" },
  { key: "done", label: "Hecha" },
] as const;

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-sm)",
  fontSize: "var(--fs-sm)",
  boxShadow: "var(--shadow)",
};

/** Donut of the tasks by status, with the numbers in a legend next to it (the legend is the accessible version). */
export function StatusChart({ tasks }: { tasks: ProjectMetrics["tasks"] }) {
  const data = STATUSES.map(({ key, label }) => ({ key, label, value: tasks[key] }));
  return (
    <div className={styles.statusRow}>
      <div className={styles.donut} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="100%"
              stroke="var(--surface)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={COLOR[entry.key]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className={styles.donutCenter}>
          <b>{tasks.total}</b>
          <span>{tasks.total === 1 ? "tarea" : "tareas"}</span>
        </div>
      </div>
      <ul className={styles.legend}>
        {data.map((entry) => (
          <li key={entry.key}>
            <i style={{ background: COLOR[entry.key] }} />
            <span>{entry.label}</span>
            <b>{entry.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Stacked horizontal bars: one row per member, split by status. */
export function AssigneeChart({ rows }: { rows: ProjectMetrics["byAssignee"] }) {
  const data = rows.map((row) => ({
    name: row.user.name,
    todo: row.todo,
    inProgress: row.inProgress,
    done: row.done,
  }));
  const height = 40 * data.length + 24;
  return (
    <>
      <div style={{ height }} className={styles.bars} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
            <XAxis type="number" allowDecimals={false} hide />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--text)", fontSize: 13 }}
            />
            <Tooltip cursor={{ fill: "var(--accent-soft)" }} contentStyle={tooltipStyle} />
            {STATUSES.map(({ key, label }) => (
              <Bar
                key={key}
                dataKey={key}
                name={label}
                stackId="tasks"
                fill={COLOR[key]}
                barSize={18}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* The numbers in text, for screen readers and as a quick read. */}
      <ul className={styles.assigneeList}>
        {rows.map((row) => (
          <li key={row.user.id}>
            <span>{row.user.name}</span>
            <span>
              {row.todo + row.inProgress} pendientes · {row.done} hechas
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

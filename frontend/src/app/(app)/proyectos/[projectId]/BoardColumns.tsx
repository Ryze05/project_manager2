"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { TaskStatus } from "@/lib/types";
import { dropTaskAction } from "./actions";
import styles from "./board.module.css";

export interface BoardCard {
  id: string;
  status: TaskStatus;
  /** The card already rendered on the server. */
  node: ReactNode;
}

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "TODO", label: "Por hacer" },
  { status: "IN_PROGRESS", label: "En curso" },
  { status: "DONE", label: "Hecha" },
];

type Order = Record<TaskStatus, string[]>;

const orderOf = (cards: BoardCard[]): Order => ({
  TODO: cards.filter((c) => c.status === "TODO").map((c) => c.id),
  IN_PROGRESS: cards.filter((c) => c.status === "IN_PROGRESS").map((c) => c.id),
  DONE: cards.filter((c) => c.status === "DONE").map((c) => c.id),
});

/** The column a card id sits in, or the column itself when `id` is a column id. */
function containerOf(order: Order, id: string): TaskStatus | undefined {
  if (id in order) return id as TaskStatus;
  return COLUMNS.find(({ status }) => order[status].includes(id))?.status;
}

/** Below this width the columns stack and dragging gives way to the "Mover a…" menu. */
const NARROW = "(max-width: 900px)";
const subscribe = (notify: () => void) => {
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const useNarrow = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(NARROW).matches,
    () => false,
  );

function SortableCard({ id, disabled, children }: { id: string; disabled: boolean; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[styles.item, isDragging && styles.dragging].filter(Boolean).join(" ")}
      {...(disabled ? {} : attributes)}
      {...(disabled ? {} : listeners)}
    >
      {children}
    </li>
  );
}

function Column({
  status,
  label,
  ids,
  cards,
  emptyText,
  disabled,
}: {
  status: TaskStatus;
  label: string;
  ids: string[];
  cards: Map<string, BoardCard>;
  emptyText: string;
  disabled: boolean;
}) {
  // The column is a drop target too, so an empty one can receive a card.
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      className={[styles.column, isOver && styles.over].filter(Boolean).join(" ")}
      aria-label={label}
    >
      <h2 className={styles.columnHead}>
        {label} <span className={styles.count}>{ids.length}</span>
      </h2>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className={styles.cards}>
          {ids.map((id) => (
            <SortableCard key={id} id={id} disabled={disabled}>
              {cards.get(id)?.node}
            </SortableCard>
          ))}
        </ul>
      </SortableContext>
      {ids.length === 0 && <p className={styles.empty}>{emptyText}</p>}
    </section>
  );
}

/**
 * The three columns, with drag and drop. The cards come rendered from the
 * server; here only their order lives. Dropping updates the order at once and
 * tells the server; if it refuses (e.g. pending subtasks) the card goes back.
 * Dragging is off with filters (the visible neighbours are not the real ones)
 * and on narrow screens (columns stack; the menu of each card is used there).
 */
export function BoardColumns({
  projectId,
  cards,
  filtered,
  readOnly = false,
}: {
  projectId: string;
  cards: BoardCard[];
  filtered: boolean;
  /** Archived project: nothing can be dragged. */
  readOnly?: boolean;
}) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const fromServer = orderOf(cards);
  const signature = JSON.stringify(fromServer);

  // The order shown. It follows the server whenever the server sends a new one.
  const [shown, setShown] = useState({ signature, order: fromServer });
  const order = shown.signature === signature ? shown.order : fromServer;
  const setOrder = (next: Order) => setShown({ signature, order: next });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const justDragged = useRef(false);
  const narrow = useNarrow();
  const draggable = !filtered && !narrow && !readOnly;

  // Safety net: if the pointer moves with no button held while a drag is on (its
  // "release" never arrived, e.g. it was swallowed by a native menu), cancel the
  // drag the way Escape does, instead of leaving the card stuck to the cursor.
  useEffect(() => {
    if (!activeId) return;
    const cancelIfReleased = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.buttons === 0) {
        document.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", bubbles: true }));
      }
    };
    document.addEventListener("pointermove", cancelIfReleased);
    return () => document.removeEventListener("pointermove", cancelIfReleased);
  }, [activeId]);

  const sensors = useSensors(
    // A small distance keeps a plain click on the card (it is a link) a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragStart({ active }: DragStartEvent) {
    setError(undefined);
    setActiveId(String(active.id));
  }

  /** While dragging over another column, the card moves into it so the layout previews the drop. */
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = containerOf(order, String(active.id));
    const to = containerOf(order, String(over.id));
    if (!from || !to || from === to) return;

    const target = order[to];
    const overIndex = target.indexOf(String(over.id));
    const insertAt = overIndex >= 0 ? overIndex : target.length;
    setOrder({
      ...order,
      [from]: order[from].filter((id) => id !== active.id),
      [to]: [...target.slice(0, insertAt), String(active.id), ...target.slice(insertAt)],
    });
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 0);

    const id = String(active.id);
    let next = order;
    const column = containerOf(order, id);
    if (over && column) {
      const overId = String(over.id);
      const oldIndex = order[column].indexOf(id);
      const newIndex = order[column].indexOf(overId);
      if (newIndex >= 0 && oldIndex !== newIndex) {
        const moved = [...order[column]];
        moved.splice(oldIndex, 1);
        moved.splice(newIndex, 0, id);
        next = { ...order, [column]: moved };
        setOrder(next);
      }
    }

    // Where it ended up, against where the server has it.
    const status = containerOf(next, id);
    if (!status) return;
    const ids = next[status];
    const index = ids.indexOf(id);
    const unchanged =
      status === byId.get(id)?.status &&
      JSON.stringify(ids) === JSON.stringify(fromServer[status]);
    if (unchanged) return;

    const result = await dropTaskAction(
      projectId,
      id,
      status,
      ids[index - 1] ?? null,
      ids[index + 1] ?? null,
    );
    if (result.error) {
      setError(result.error);
      setOrder(fromServer); // put everything back as the server has it
    }
  }

  return (
    <>
      {filtered && !narrow && !readOnly && (
        <p className={styles.dragHint}>Arrastrar está desactivado mientras haya filtros activos.</p>
      )}
      {error && (
        <p className={styles.dragError} role="alert">
          {error}
        </p>
      )}
      <DndContext
        // A fixed id keeps the generated aria ids equal on the server and in the browser.
        id={`board-${projectId}`}
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setOrder(fromServer);
        }}
      >
        <div
          className={styles.board}
          data-drag={draggable ? "on" : "off"}
          // A drag ends with a click on whatever is under the pointer (the card is a link).
          onClickCapture={(event) => {
            if (justDragged.current) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          {COLUMNS.map(({ status, label }) => (
            <Column
              key={status}
              status={status}
              label={label}
              ids={order[status]}
              cards={byId}
              emptyText={filtered ? "Ninguna coincide" : "Sin tareas"}
              disabled={!draggable}
            />
          ))}
        </div>
        <DragOverlay>{activeId ? <div className={styles.overlay}>{byId.get(activeId)?.node}</div> : null}</DragOverlay>
      </DndContext>
    </>
  );
}

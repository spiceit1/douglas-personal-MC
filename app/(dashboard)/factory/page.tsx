"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "backlog" | "in-progress" | "in-review" | "done";
  priority: "high" | "medium" | "low";
  assignee: string;
  createdAt?: string;
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  model?: string;
  status: "active" | "idle" | "standby" | "scheduled";
  statusText?: string | null;
  type: string;
  description?: string;
}

interface LiveAgent {
  id: string;
  sessionKey?: string;
  name: string;
  emoji: string;
  role: string;
  model?: string;
  status: "active" | "completed" | "failed";
  taskSummary?: string;
  taskId?: string;
  startedAt: string;
  completedAt?: string;
}

interface ScannerInfo {
  lastScan: string | null;
  status: string;
  nextScanMins: number | null;
}

interface Stats {
  activeTasks: number;
  completedToday: number;
  activeAgents: number;
  totalAgents: number;
  liveAgentCount?: number;
}

interface FactoryData {
  tasks: Task[];
  agents: Agent[];
  liveAgents: LiveAgent[];
  scanner: ScannerInfo;
  stats: Stats;
}

// ─── Walking Animation State ────────────────────────────────────────────────

interface WalkingAgent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  model?: string;
  direction: "toWork" | "toDesk";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startTime: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ZONE_CONFIG = {
  backlog: {
    label: "BACKLOG",
    tooltip: "Tasks waiting to be picked up. No agent assigned yet.",
    color: "#aaaaaa",
    bg: "#18181b",
    border: "#3a3a40",
    glow: "rgba(170,170,170,0.10)",
    icon: "📥",
    topBorder: "#666666",
  },
  "in-progress": {
    label: "IN PROGRESS",
    tooltip: "Tasks being actively worked on. Primary agents and sub-agents appear here while working.",
    color: "#ffffff",
    bg: "#14112a",
    border: "#3d2e8c",
    glow: "rgba(124,92,252,0.12)",
    icon: "⚡",
    topBorder: "#7c5cfc",
  },
  "in-review": {
    label: "REVIEW",
    tooltip: "Tasks completed by an agent, waiting for human review or approval.",
    color: "#f0b429",
    bg: "#1e1800",
    border: "#5a4200",
    glow: "rgba(240,180,41,0.10)",
    icon: "🔍",
    topBorder: "#f0b429",
  },
  done: {
    label: "DONE",
    tooltip: "Completed tasks and finished sub-agents. Sub-agents appear here for 24 hours after completion.",
    color: "#26c97a",
    bg: "#081a11",
    border: "#0f4428",
    glow: "rgba(38,201,122,0.10)",
    icon: "✅",
    topBorder: "#26c97a",
  },
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "#f05b5b",
  medium: "#f0b429",
  low: "#4d7cfe",
};

const WALK_DURATION = 1500; // ms

// ─── Helper: Agent color classification ──────────────────────────────────────

function getAgentColor(role: string, status?: string): { shirt: string; border: string; glow: string; bg: string } {
  if (role === "Sub-Agent") {
    return { shirt: "#26c97a", border: "#46e99a", glow: "rgba(38,201,122,0.5)", bg: "#0a1a10" };
  }
  if (role === "Dedicated Agent" || status === "standby" || status === "scheduled") {
    return { shirt: "#4d7cfe", border: "#6d9cff", glow: "rgba(77,124,254,0.5)", bg: "#0f1a2e" };
  }
  return { shirt: "#7c5cfc", border: "#9b7cff", glow: "rgba(124,92,252,0.5)", bg: "#1a1030" };
}

function isPrimaryAgent(role: string, status?: string): boolean {
  return role !== "Sub-Agent" && role !== "Dedicated Agent" && status !== "standby" && status !== "scheduled";
}

function isDedicatedAgent(role: string, status?: string): boolean {
  return role === "Dedicated Agent" || status === "standby" || status === "scheduled";
}

function isShmack(agent: { id?: string; name?: string }): boolean {
  return agent.id === "shmack" || agent.name === "Mr. Shmack";
}

// ─── Person Figure Component ─────────────────────────────────────────────────

function PersonFigure({
  emoji,
  role,
  status,
  size = "normal",
  bouncing = false,
  sitting = false,
  agentId,
  agentName,
}: {
  emoji: string;
  role: string;
  status?: string;
  size?: "normal" | "small";
  bouncing?: boolean;
  sitting?: boolean;
  agentId?: string;
  agentName?: string;
}) {
  const colors = getAgentColor(role, status);
  const isSmall = size === "small";
  const headSize = isSmall ? 14 : 18;
  const bodyW = isSmall ? 22 : 28;
  const bodyH = isSmall ? 16 : 22;
  const fontSize = isSmall ? 9 : 12;
  const legW = isSmall ? 5 : 6;
  const legH = isSmall ? 8 : 10;
  const isShmackAgent = isShmack({ id: agentId, name: agentName });
  const skinColor = isShmackAgent ? "#f5d0b0" : "#d4a574";
  const skinBorder = isShmackAgent ? "#e8c0a0" : "#c4956a";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        animation: bouncing ? "agentBounce 1s ease-in-out infinite" : "none",
      }}
    >
      {/* Hair (Shmack only) */}
      {isShmackAgent && (
        <div style={{
          width: headSize * 0.7,
          height: isSmall ? 4 : 6,
          background: "#c0442a",
          borderRadius: `${isSmall ? 3 : 4}px ${isSmall ? 3 : 4}px 1px 1px`,
          marginBottom: -2,
          zIndex: 3,
          border: "1px solid #a03820",
          borderBottom: "none",
        }} />
      )}
      {/* Head */}
      <div style={{
        width: headSize,
        height: headSize,
        borderRadius: "50%",
        background: skinColor,
        border: `1px solid ${skinBorder}`,
        marginBottom: sitting ? -2 : -3,
        zIndex: 2,
        position: "relative",
      }} />
      {/* Body/Shirt with emoji */}
      <div style={{
        width: bodyW,
        height: bodyH,
        borderRadius: `${isSmall ? 3 : 5}px ${isSmall ? 3 : 5}px 2px 2px`,
        background: colors.shirt,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize,
        lineHeight: 1,
        zIndex: 2,
        border: `1px solid ${colors.border}`,
        boxShadow: bouncing ? `0 0 12px ${colors.glow}` : "none",
      }}>
        {emoji}
      </div>
      {/* Legs (only when standing/walking, not sitting) */}
      {!sitting && (
        <div style={{ display: "flex", gap: isSmall ? 3 : 4, marginTop: -1, zIndex: 1 }}>
          <div style={{
            width: legW,
            height: legH,
            background: "#3a3a50",
            borderRadius: "1px 1px 2px 2px",
            border: "1px solid #4a4a60",
          }} />
          <div style={{
            width: legW,
            height: legH,
            background: "#3a3a50",
            borderRadius: "1px 1px 2px 2px",
            border: "1px solid #4a4a60",
          }} />
        </div>
      )}
    </div>
  );
}

// ─── Desk Component (with chair + nameplate) ────────────────────────────────

function AgentDesk({
  agent,
  isWorking,
  onClick,
  onMount,
}: {
  agent: { id: string; name: string; emoji: string; role: string; model?: string; status: string; taskSummary?: string };
  isWorking: boolean;
  onClick?: () => void;
  onMount?: (el: HTMLDivElement | null) => void;
}) {
  const primary = isPrimaryAgent(agent.role, agent.status);
  const colors = getAgentColor(agent.role, agent.status);
  const modelStr = agent.model || "";
  const modelColor = modelStr.includes("opus") ? "#f0b429" : modelStr.includes("haiku") ? "#26c97a" : "#7c5cfc";
  const statusColor = isWorking ? "#26c97a" : agent.status === "idle" ? "#9898a0" : agent.status === "scheduled" ? "#f0b429" : "#888";
  const statusText = isWorking
    ? "→ In Progress"
    : agent.status === "idle"
    ? "○ IDLE"
    : agent.status === "scheduled"
    ? "⏰ SCHEDULED"
    : "💤 STANDBY";

  const accentColor = primary ? "#7c5cfc" : "#4d7cfe";

  return (
    <div
      ref={(el) => onMount?.(el)}
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "2px",
        padding: "8px 14px 6px",
        background: isWorking
          ? `linear-gradient(135deg, ${colors.bg}80 0%, #151520 100%)`
          : `linear-gradient(135deg, ${colors.bg} 0%, #151520 100%)`,
        border: `1px solid ${accentColor}${isWorking ? "30" : "50"}`,
        borderTop: `2px solid ${accentColor}`,
        borderRadius: "6px",
        minWidth: "85px",
        cursor: onClick && !isWorking ? "pointer" : "default",
        opacity: isWorking ? 0.6 : 1,
        transition: "opacity 0.3s ease",
        position: "relative",
      }}
    >
      {/* Desk area: person + monitor */}
      <div style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "6px",
        minHeight: "52px",
        justifyContent: "center",
      }}>
        {/* Person in chair OR empty chair */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
          {isWorking ? (
            /* Empty chair — agent walked away */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: 0.4 }}>
              {/* Chair back */}
              <div style={{
                width: 22, height: 14,
                background: "#3a3040",
                borderRadius: "4px 4px 0 0",
                border: "1px solid #5a5060",
                borderBottom: "none",
              }} />
              {/* Chair seat */}
              <div style={{
                width: 26, height: 6,
                background: "#4a4050",
                borderRadius: "1px",
                border: "1px solid #5a5060",
              }} />
              {/* Chair legs */}
              <div style={{ display: "flex", gap: 10, marginTop: 1 }}>
                <div style={{ width: 3, height: 8, background: "#5a5060", borderRadius: 1 }} />
                <div style={{ width: 3, height: 8, background: "#5a5060", borderRadius: 1 }} />
              </div>
            </div>
          ) : (
            /* Person sitting */
            <div style={{ position: "relative" }}>
              <div style={{ position: "relative", zIndex: 2 }}>
                <PersonFigure
                  emoji={agent.emoji}
                  role={agent.role}
                  status={agent.status}
                  sitting={true}
                  agentId={agent.id}
                  agentName={agent.name}
                />
              </div>
              {/* Chair under the person */}
              <div style={{
                position: "absolute",
                bottom: -4,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                opacity: 0.5,
              }}>
                <div style={{ width: 26, height: 5, background: "#4a4050", borderRadius: 1, border: "1px solid #5a5060" }} />
                <div style={{ display: "flex", gap: 10, marginTop: 1 }}>
                  <div style={{ width: 3, height: 6, background: "#5a5060", borderRadius: 1 }} />
                  <div style={{ width: 3, height: 6, background: "#5a5060", borderRadius: 1 }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Monitor/desk icon */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: isWorking ? 0.3 : 0.6 }}>
          {/* Monitor screen */}
          <div style={{
            width: 18, height: 14,
            background: isWorking ? "#1a1a2e" : "#1a2a3a",
            border: `1px solid ${isWorking ? "#333" : accentColor}60`,
            borderRadius: "2px 2px 0 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {!isWorking && (
              <div style={{ width: 10, height: 2, background: accentColor, borderRadius: 1, opacity: 0.6 }} />
            )}
          </div>
          {/* Monitor stand */}
          <div style={{ width: 4, height: 4, background: "#555" }} />
          <div style={{ width: 12, height: 2, background: "#555", borderRadius: 1 }} />
        </div>
      </div>

      {/* Nameplate */}
      <div style={{
        background: "#2a2a3a",
        border: `1px solid ${accentColor}40`,
        borderRadius: "2px",
        padding: "2px 8px",
        marginTop: "2px",
      }}>
        <div style={{
          fontSize: "9px",
          fontWeight: 700,
          color: "#ffffff",
          textAlign: "center",
          lineHeight: 1.2,
          whiteSpace: "nowrap",
          fontFamily: "'Courier New', monospace",
          display: "flex",
          alignItems: "center",
          gap: "3px",
        }}>
          {isShmack(agent) && <span style={{ fontSize: "8px" }} title="Main Agent">👑</span>}
          {agent.name}
        </div>
      </div>

      {/* Model badge */}
      {modelStr && (
        <span style={{
          fontSize: "7px",
          color: modelColor,
          background: modelColor + "18",
          border: `1px solid ${modelColor}40`,
          padding: "1px 4px",
          borderRadius: "4px",
          fontWeight: 700,
        }}>
          {modelStr}
        </span>
      )}

      {/* Status */}
      <div style={{
        fontSize: "8px",
        color: statusColor,
        fontWeight: 600,
        textAlign: "center",
        lineHeight: 1.2,
        maxWidth: "90px",
      }}>
        {statusText}
      </div>
    </div>
  );
}

// ─── Workstation Figure (In Progress zone) ──────────────────────────────────

function WorkstationFigure({
  agent,
  onClick,
}: {
  agent: LiveAgent;
  onClick: () => void;
}) {
  const isActive = agent.status === "active";
  const colors = getAgentColor(agent.role);
  const modelColor = agent.model?.includes("opus")
    ? "#f0b429"
    : agent.model?.includes("haiku")
    ? "#26c97a"
    : "#7c5cfc";

  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const started = new Date(agent.startedAt).getTime();
    const update = () => {
      const end = agent.completedAt ? new Date(agent.completedAt).getTime() : Date.now();
      const secs = Math.floor((end - started) / 1000);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      if (m > 0) setElapsed(`${m}m ${s}s`);
      else setElapsed(`${s}s`);
    };
    update();
    if (isActive) {
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }
  }, [agent.startedAt, agent.completedAt, isActive]);

  return (
    <div
      ref={figureRef}
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
        padding: "10px 12px 8px",
        minWidth: "100px",
        maxWidth: "140px",
        background: `linear-gradient(135deg, ${colors.bg} 0%, #151520 100%)`,
        border: `1px solid ${colors.shirt}${isActive ? "60" : "40"}`,
        borderTop: `2px solid ${colors.shirt}`,
        borderRadius: "6px",
        cursor: "pointer",
        position: "relative",
        animation: isActive ? "liveAgentGlow 2s ease-in-out infinite" : "none",
        opacity: agent.status === "completed" || agent.status === "failed" ? 0.65 : 1,
        transition: "opacity 0.5s ease",
      }}
    >
      {/* LIVE badge */}
      {isActive && (
        <div style={{
          position: "absolute",
          top: "-6px",
          right: "-6px",
          background: "#f05b5b",
          color: "#ffffff",
          fontSize: "8px",
          fontWeight: 800,
          padding: "2px 5px",
          borderRadius: "3px",
          letterSpacing: "0.1em",
          animation: "scannerPulse 1.5s ease-in-out infinite",
        }}>
          LIVE
        </div>
      )}

      {/* Completed check */}
      {(agent.status === "completed" || agent.status === "failed") && (
        <div style={{
          position: "absolute",
          top: "-6px",
          right: "-6px",
          background: agent.status === "completed" ? "#26c97a" : "#f05b5b",
          color: "#ffffff",
          fontSize: "10px",
          fontWeight: 800,
          padding: "1px 4px",
          borderRadius: "3px",
        }}>
          {agent.status === "completed" ? "✓" : "✕"}
        </div>
      )}

      {/* Person figure standing at workbench */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: "6px" }}>
        <PersonFigure
          emoji={agent.emoji}
          role={agent.role}
          bouncing={isActive}
          sitting={agent.status === "completed" || agent.status === "failed"}
          agentId={agent.id}
          agentName={agent.name}
        />
        {/* Workbench */}
        {isActive && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: 0.6 }}>
            <div style={{
              width: 16, height: 20,
              background: "#2a2a3a",
              border: `1px solid ${colors.shirt}40`,
              borderRadius: "2px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <div style={{ width: 8, height: 8, background: colors.shirt, borderRadius: 1, opacity: 0.5, animation: "scannerPulse 2s ease-in-out infinite" }} />
            </div>
            <div style={{ width: 20, height: 3, background: "#3a3a4a", borderRadius: 1 }} />
          </div>
        )}
      </div>

      {/* Name */}
      <div style={{
        fontSize: "11px",
        fontWeight: 700,
        color: "#ffffff",
        textAlign: "center",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "120px",
      }} title={agent.name}>
        {agent.name}
      </div>

      {/* Badges */}
      {agent.role === "Sub-Agent" && (
        <span style={{
          fontSize: "8px",
          fontWeight: 700,
          color: "#f0b429",
          background: "#f0b42918",
          border: "1px solid #f0b42940",
          padding: "1px 6px",
          borderRadius: "3px",
          letterSpacing: "0.08em",
        }} title="Spawned for a specific task. Disappears after completion.">
          SUB-AGENT
        </span>
      )}
      {agent.role === "Dedicated Agent" && (
        <span style={{
          fontSize: "8px",
          fontWeight: 700,
          color: "#4d7cfe",
          background: "#4d7cfe18",
          border: "1px solid #4d7cfe40",
          padding: "1px 6px",
          borderRadius: "3px",
          letterSpacing: "0.08em",
        }} title="Always-on agent with a single purpose.">
          DEDICATED
        </span>
      )}

      {/* Task clipboard */}
      {agent.taskSummary && (
        <div style={{
          fontSize: "9px",
          color: "#ffffff",
          opacity: 0.7,
          textAlign: "center",
          lineHeight: 1.3,
          maxWidth: "120px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          background: "#1a1a2e80",
          border: "1px solid #ffffff10",
          borderRadius: "3px",
          padding: "3px 6px",
        }} title={agent.taskSummary}>
          📋 {agent.taskSummary.length > 55 ? agent.taskSummary.slice(0, 52) + "..." : agent.taskSummary}
        </div>
      )}

      {/* Model + time */}
      <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        {agent.model && (
          <span style={{
            fontSize: "9px",
            color: modelColor,
            padding: "1px 6px",
            background: modelColor + "18",
            border: `1px solid ${modelColor}40`,
            borderRadius: "8px",
            fontWeight: 700,
          }}>
            {agent.model}
          </span>
        )}
        <span style={{
          fontSize: "9px",
          color: isActive ? "#4d7cfe" : "#26c97a",
          fontWeight: 600,
        }}>
          {elapsed}
        </span>
      </div>
    </div>
  );
}

// ─── Walking Overlay ─────────────────────────────────────────────────────────

function WalkingOverlay({ walker }: { walker: WalkingAgent }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf: number;
    const animate = () => {
      const now = Date.now();
      const p = Math.min(1, (now - walker.startTime) / WALK_DURATION);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [walker.startTime]);

  // Easing: ease-in-out
  const ease = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  const p = ease(progress);

  const x = walker.startX + (walker.endX - walker.startX) * p;
  const y = walker.startY + (walker.endY - walker.startY) * p;

  // Stand-up effect: rise slightly at the start
  const riseOffset = progress < 0.2 ? -(progress / 0.2) * 10 : progress < 0.3 ? -10 : -10 + (Math.min(progress, 0.8) - 0.3) / 0.5 * 10;

  return (
    <div style={{
      position: "fixed",
      left: x,
      top: y + riseOffset,
      zIndex: 1000,
      pointerEvents: "none",
      transition: "none",
      filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
    }}>
      <div style={{
        animation: progress > 0.15 && progress < 0.85 ? "walkingBounce 0.3s ease-in-out infinite" : "none",
      }}>
        <PersonFigure
          emoji={walker.emoji}
          role={walker.role}
          bouncing={false}
          sitting={false}
          agentId={walker.id}
          agentName={walker.name}
        />
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TaskDetailModal({
  task,
  onClose,
}: {
  task: Task;
  onClose: () => void;
}) {
  const priorityColor = PRIORITY_COLORS[task.priority] || "#aaaaaa";
  const statusColors: Record<string, string> = {
    backlog: "#9898a0",
    "in-progress": "#7c5cfc",
    "in-review": "#f0b429",
    done: "#26c97a",
  };
  const statusColor = statusColors[task.status] || "#9898a0";

  const dateObj = task.createdAt ? new Date(task.createdAt) : null;
  const date = dateObj && !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "rgba(0,0,0,0.7)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}
      >
        {/* Title */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#ffffff", lineHeight: 1.4 }}>
            {task.title}
          </h2>
          <button
            onClick={onClose}
            style={{ color: "#888", background: "none", border: "none", cursor: "pointer", fontSize: "18px", lineHeight: 1, padding: "4px" }}
          >
            ✕
          </button>
        </div>

        {/* Badges */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          <span style={{
            color: "#ffffff", background: priorityColor + "33", border: `1px solid ${priorityColor}60`,
            padding: "3px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 700, textTransform: "uppercase",
          }}>
            {task.priority}
          </span>
          <span style={{
            color: statusColor, background: statusColor + "18", border: `1px solid ${statusColor}40`,
            padding: "3px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 600,
          }}>
            {task.status}
          </span>
          <span style={{
            color: task.assignee === "shmack" ? "#7c5cfc" : "#26c97a",
            background: task.assignee === "shmack" ? "#7c5cfc18" : "#26c97a18",
            padding: "3px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 600,
          }}>
            {task.assignee === "shmack" ? "🤙 Shmack" : "👤 Douglas"}
          </span>
        </div>

        {/* Description */}
        {task.description && (
          <div style={{
            background: "var(--bg-tertiary, #1a1a2e)", border: "1px solid var(--border-subtle)",
            borderRadius: "6px", padding: "12px", marginBottom: "16px",
            fontSize: "14px", color: "#cccccc", lineHeight: 1.6,
          }}>
            {task.description}
          </div>
        )}

        {/* Date */}
        {date && (
          <div style={{ fontSize: "12px", color: "#888", marginBottom: "16px" }}>
            Created {date}
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "10px", borderRadius: "6px", fontSize: "14px", fontWeight: 600,
            background: "transparent", border: "1px solid var(--border-default)", color: "#aaa", cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function PixelTaskCard({ task, onSelect, isMobile }: { task: Task; onSelect: (task: Task) => void; isMobile: boolean }) {
  const priorityColor = PRIORITY_COLORS[task.priority] || "#aaaaaa";
  const isLong = task.title.length > 40;

  return (
    <div
      onClick={() => onSelect(task)}
      style={{
        background: "var(--bg-elevated)",
        border: `1px solid var(--border-subtle)`,
        borderLeft: `3px solid ${priorityColor}`,
        borderRadius: "4px",
        padding: isMobile ? "12px 14px" : "10px 12px",
        marginBottom: "8px",
        fontSize: isMobile ? "14px" : "13px",
        cursor: "pointer",
        minHeight: "50px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "6px",
        transition: "border-color 0.15s ease",
        width: "100%",
        boxSizing: "border-box",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = priorityColor + "80"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.borderLeftColor = priorityColor; }}
    >
      <div
        style={{
          color: "#ffffff",
          lineHeight: "1.4",
          fontWeight: 600,
          maxWidth: "100%",
          ...(isMobile || isLong ? { whiteSpace: "normal" as const } : { overflow: "hidden" as const, textOverflow: "ellipsis" as const, whiteSpace: "nowrap" as const }),
        }}
        title={task.title}
      >
        {task.title}
      </div>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <span
          style={{
            color: "#ffffff",
            background: priorityColor + "33",
            border: `1px solid ${priorityColor}60`,
            padding: "2px 6px",
            borderRadius: "2px",
            fontSize: "11px",
            textTransform: "uppercase",
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          {task.priority}
        </span>
        <span style={{ fontSize: "16px" }}>
          {task.assignee === "shmack" ? "🤙" : "👤"}
        </span>
      </div>
    </div>
  );
}

// ─── Mobile Zone Section ──────────────────────────────────────────────────────

function MobileZoneSection({
  zoneKey,
  tasks,
  liveAgents = [],
  onSelectTask,
  onSelectAgent,
}: {
  zoneKey: keyof typeof ZONE_CONFIG;
  tasks: Task[];
  liveAgents?: LiveAgent[];
  onSelectTask: (task: Task) => void;
  onSelectAgent?: (agent: LiveAgent) => void;
}) {
  const cfg = ZONE_CONFIG[zoneKey];
  const [collapsed, setCollapsed] = useState(zoneKey === "done");

  const zoneLiveAgents = liveAgents.filter((a) => {
    if (zoneKey === "in-progress") return a.status === "active";
    if (zoneKey === "done") return a.status === "completed" || a.status === "failed";
    return false;
  });

  return (
    <div
      style={{
        width: "100%",
        background: "var(--bg-secondary)",
        border: `1px solid var(--border-subtle)`,
        borderTop: `3px solid ${cfg.topBorder}`,
        borderRadius: "6px",
        overflow: "hidden",
        marginBottom: "10px",
      }}
    >
      {/* Header — tap to collapse/expand */}
      <div
        onClick={() => setCollapsed((c) => !c)}
        style={{
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: "18px" }}>{cfg.icon}</span>
        <span
          style={{
            fontSize: "15px",
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            fontFamily: "'Courier New', monospace",
            flex: 1,
          }}
        >
          {cfg.label}<span style={{ marginLeft: "6px", fontSize: "10px", color: "var(--text-muted)", cursor: "help" }} title={cfg.tooltip}>ⓘ</span>
        </span>
        <span
          style={{
            fontSize: "13px",
            color: "#ffffff",
            background: cfg.topBorder + "40",
            border: `1px solid ${cfg.topBorder}60`,
            padding: "2px 10px",
            borderRadius: "3px",
            fontWeight: 700,
            minWidth: "26px",
            textAlign: "center",
          }}
        >
          {tasks.length}
        </span>
        <span style={{ fontSize: "12px", color: "#888", marginLeft: "4px" }}>
          {collapsed ? "▶" : "▼"}
        </span>
      </div>

      {!collapsed && (
        <div style={{ borderTop: `1px solid var(--border-subtle)` }}>
          {/* Live agents in this zone */}
          {zoneLiveAgents.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "8px", padding: "12px 8px 8px", borderBottom: `1px solid var(--border-subtle)` }}>
              {zoneLiveAgents.map((agent) => (
                <WorkstationFigure key={agent.id} agent={agent} onClick={() => onSelectAgent?.(agent)} />
              ))}
            </div>
          )}

          {/* Task cards */}
          <div style={{ padding: "12px 14px" }}>
            {tasks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 12px", fontSize: "13px", color: "#ffffff", opacity: 0.4, letterSpacing: "0.08em" }}>
                [ EMPTY ]
              </div>
            ) : (
              tasks.map((task) => (
                <PixelTaskCard key={task.id} task={task} onSelect={onSelectTask} isMobile={true} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Desktop Zone ─────────────────────────────────────────────────────────────

function FactoryZone({
  zoneKey,
  tasks,
  liveAgents = [],
  onSelectTask,
  onSelectAgent,
}: {
  zoneKey: keyof typeof ZONE_CONFIG;
  tasks: Task[];
  liveAgents?: LiveAgent[];
  onSelectTask: (task: Task) => void;
  onSelectAgent?: (agent: LiveAgent) => void;
}) {
  const cfg = ZONE_CONFIG[zoneKey];

  const zoneLiveAgents = liveAgents.filter((a) => {
    if (zoneKey === "in-progress") return a.status === "active";
    if (zoneKey === "done") return a.status === "completed" || a.status === "failed";
    return false;
  });

  return (
    <div
      style={{
        flex: 1,
        minWidth: "280px",
        background: "var(--bg-secondary)",
        border: `1px solid var(--border-subtle)`,
        borderTop: `3px solid ${cfg.topBorder}`,
        borderRadius: "6px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: "100%",
      }}
    >
      {/* Zone header */}
      <div
        style={{
          padding: "12px 14px",
          borderBottom: `1px solid var(--border-subtle)`,
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "16px" }}>{cfg.icon}</span>
        <span
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            fontFamily: "'Courier New', monospace",
          }}
        >
          {cfg.label}<span style={{ marginLeft: "6px", fontSize: "10px", color: "var(--text-muted)", cursor: "help" }} title={cfg.tooltip}>ⓘ</span>
        </span>
        <span
          style={{
            fontSize: "9px",
            color: cfg.topBorder,
            opacity: 0.7,
            fontFamily: "'Courier New', monospace",
            letterSpacing: "0px",
          }}
          title="task flow direction"
        >
          ▶▶
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: "13px",
            color: "#ffffff",
            background: cfg.topBorder + "40",
            border: `1px solid ${cfg.topBorder}60`,
            padding: "2px 8px",
            borderRadius: "3px",
            fontWeight: 700,
            minWidth: "26px",
            textAlign: "center",
          }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Live agents in this zone */}
      {zoneLiveAgents.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "8px",
            padding: "12px 8px 8px",
            borderBottom: `1px solid var(--border-subtle)`,
          }}
        >
          {zoneLiveAgents.map((agent) => (
            <WorkstationFigure key={agent.id} agent={agent} onClick={() => onSelectAgent?.(agent)} />
          ))}
        </div>
      )}

      {/* Tasks list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
        }}
      >
        {tasks.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "30px 12px",
              fontSize: "12px",
              color: "#ffffff",
              opacity: 0.4,
              letterSpacing: "0.08em",
              userSelect: "none",
            }}
          >
            [ EMPTY ]
          </div>
        ) : (
          tasks.map((task) => <PixelTaskCard key={task.id} task={task} onSelect={onSelectTask} isMobile={false} />)
        )}
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  color,
  isMobile,
}: {
  label: string;
  value: string | number;
  color: string;
  isMobile?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "3px",
        padding: isMobile ? "8px 12px" : "10px 18px",
        background: "var(--bg-elevated)",
        border: `1px solid var(--border-subtle)`,
        borderRadius: "4px",
        minWidth: isMobile ? "70px" : "100px",
        flex: isMobile ? "1 1 auto" : "none",
      }}
    >
      <span
        style={{
          fontSize: isMobile ? "16px" : "20px",
          fontWeight: 700,
          color: color,
          textShadow: `0 0 10px ${color}80`,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: isMobile ? "9px" : "11px",
          color: "#ffffff",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgentFactoryPage() {
  const [data, setData] = useState<FactoryData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [uptime, setUptime] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<LiveAgent | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Walking animation state
  const [walkingAgents, setWalkingAgents] = useState<WalkingAgent[]>([]);
  const [transitioning, setTransitioning] = useState<Set<string>>(new Set());
  const prevStatusRef = useRef<Map<string, string>>(new Map());
  const deskRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/factory");
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (e) {
      console.error("Factory fetch error:", e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const start = Date.now();
    const ticker = setInterval(() => {
      setUptime(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  // ── Walking animation trigger ──
  useEffect(() => {
    if (!data || isMobile) return;

    const liveAgents = data.liveAgents || [];
    const newStatuses = new Map<string, string>();

    // Build current status map for desk agents (primary + dedicated from liveAgents)
    for (const la of liveAgents) {
      if (la.role !== "Sub-Agent") {
        newStatuses.set(la.id, la.status);
      }
    }

    const prev = prevStatusRef.current;

    for (const [id, status] of newStatuses) {
      const oldStatus = prev.get(id);
      if (!oldStatus) continue; // First appearance, skip animation

      const agent = liveAgents.find(a => a.id === id);
      if (!agent) continue;

      // Agent went from not-active to active: walk desk → workstation
      if (oldStatus !== "active" && status === "active") {
        const deskEl = deskRefs.current.get(id);
        // Use a placeholder position for the workstation (center of viewport, slightly down)
        if (deskEl) {
          const deskRect = deskEl.getBoundingClientRect();
          const endX = window.innerWidth / 2;
          const endY = window.innerHeight / 2;

          setTransitioning(prev => new Set(prev).add(id));
          setWalkingAgents(prev => [...prev, {
            id,
            name: agent.name,
            emoji: agent.emoji,
            role: agent.role,
            model: agent.model,
            direction: "toWork",
            startX: deskRect.left + deskRect.width / 2 - 14,
            startY: deskRect.top + 10,
            endX: endX - 14,
            endY: endY - 20,
            startTime: Date.now(),
          }]);

          setTimeout(() => {
            setWalkingAgents(prev => prev.filter(w => w.id !== id));
            setTransitioning(prev => { const s = new Set(prev); s.delete(id); return s; });
          }, WALK_DURATION);
        }
      }

      // Agent went from active to not-active: walk workstation → desk
      if (oldStatus === "active" && status !== "active") {
        const deskEl = deskRefs.current.get(id);
        if (deskEl) {
          const deskRect = deskEl.getBoundingClientRect();
          const startX = window.innerWidth / 2;
          const startY = window.innerHeight / 2;

          setTransitioning(prev => new Set(prev).add(id));
          setWalkingAgents(prev => [...prev, {
            id,
            name: agent.name,
            emoji: agent.emoji,
            role: agent.role,
            model: agent.model,
            direction: "toDesk",
            startX: startX - 14,
            startY: startY - 20,
            endX: deskRect.left + deskRect.width / 2 - 14,
            endY: deskRect.top + 10,
            startTime: Date.now(),
          }]);

          setTimeout(() => {
            setWalkingAgents(prev => prev.filter(w => w.id !== id));
            setTransitioning(prev => { const s = new Set(prev); s.delete(id); return s; });
          }, WALK_DURATION);
        }
      }
    }

    prevStatusRef.current = newStatuses;
  }, [data, isMobile]);

  const formatUptime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatScanTime = (iso: string | null) => {
    if (!iso) return "never";
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  const tasks = data?.tasks || [];
  const agents = data?.agents || [];
  const liveAgents = data?.liveAgents || [];
  const stats = data?.stats || { activeTasks: 0, completedToday: 0, activeAgents: 0, totalAgents: 0, liveAgentCount: 0 };
  const scanner = data?.scanner || { lastScan: null, status: "unknown", nextScanMins: null };

  const zones = (["backlog", "in-progress", "in-review", "done"] as const);

  // ── Categorize agents for desk area ──
  const primaryAgents = liveAgents.filter(a => a.role !== "Sub-Agent" && a.role !== "Dedicated Agent");
  const dedicatedFromFactory = liveAgents.filter(a => a.role === "Dedicated Agent");
  const standbyFromTeam = agents.filter(a => a.status === "standby" || a.status === "scheduled");

  type DeskAgent = {
    id: string;
    name: string;
    emoji: string;
    role: string;
    model?: string;
    status: string;
    taskSummary?: string;
    source: "factory" | "team";
  };

  const allDedicated: DeskAgent[] = [
    ...dedicatedFromFactory.map(a => ({ id: a.id, name: a.name, emoji: a.emoji, role: a.role, model: a.model, status: a.status, taskSummary: a.taskSummary, source: "factory" as const })),
    ...standbyFromTeam.map(a => ({
      id: a.id, name: a.name, emoji: a.emoji, role: a.role,
      model: a.model, status: a.status, taskSummary: a.statusText || "",
      source: "team" as const,
    })),
  ];

  // Build desk agents list (primary + dedicated that have desks)
  const deskAgents: DeskAgent[] = [
    ...primaryAgents.map(a => ({ id: a.id, name: a.name, emoji: a.emoji, role: a.role, model: a.model, status: a.status, taskSummary: a.taskSummary, source: "factory" as const })),
    ...allDedicated,
  ];

  // Note: active/completed filtering happens inside FactoryZone and MobileZoneSection via liveAgents prop

  return (
    <>
      <style>{`
        @keyframes agentBounce {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes walkingBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes scannerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes pixelBlink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes factoryGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(124,92,252,0.1); }
          50% { box-shadow: 0 0 40px rgba(124,92,252,0.2); }
        }
        @keyframes liveAgentGlow {
          0%, 100% { box-shadow: 0 0 8px rgba(77,124,254,0.2), inset 0 0 8px rgba(77,124,254,0.05); }
          50% { box-shadow: 0 0 20px rgba(77,124,254,0.4), inset 0 0 12px rgba(77,124,254,0.1); }
        }
        @keyframes tickerScroll {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes deskIdle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1px); }
        }
      `}</style>

      {/* Walking overlays */}
      {walkingAgents.map(w => (
        <WalkingOverlay key={`walk-${w.id}-${w.startTime}`} walker={w} />
      ))}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          background: "var(--bg-primary)",
          overflow: "hidden",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          style={{
            flexShrink: 0,
            padding: isMobile ? "10px 14px" : "14px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-elevated)",
            display: "flex",
            alignItems: "center",
            gap: isMobile ? "10px" : "20px",
            flexWrap: isMobile ? "wrap" : "nowrap",
          }}
        >
          {/* Title */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ fontSize: isMobile ? "18px" : "22px", animation: "factoryGlow 3s ease-in-out infinite" }}>
              🏭
            </div>
            <div>
              <div style={{ fontSize: isMobile ? "16px" : "20px", fontWeight: 700, color: "#ffffff", letterSpacing: "0.10em" }}>
                AGENT FACTORY
              </div>
              {!isMobile && (
                <div style={{ fontSize: "11px", color: "#ffffff", opacity: 0.5, letterSpacing: "0.08em" }}>
                  MISSION CONTROL v1.0
                </div>
              )}
            </div>
          </div>

          {/* Refresh indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 9px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "3px",
              marginLeft: isMobile ? "auto" : undefined,
            }}
          >
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "1px",
                background: "#26c97a",
                animation: "scannerPulse 2s ease-in-out infinite",
              }}
            />
            <span style={{ fontSize: "10px", color: "#ffffff", letterSpacing: "0.05em" }}>
              {lastRefresh
                ? lastRefresh.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
                : "LOADING"}
            </span>
          </div>

          {/* Live stats pills */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              alignItems: "center",
              flexWrap: "wrap",
              width: isMobile ? "100%" : "auto",
              marginLeft: isMobile ? "0" : "auto",
            }}
          >
            <StatPill label="Active" value={stats.activeTasks} color="#7c5cfc" isMobile={isMobile} />
            <StatPill label="Done Today" value={stats.completedToday} color="#26c97a" isMobile={isMobile} />
            <StatPill label="Agents" value={`${stats.activeAgents}/${stats.totalAgents}`} color="#4d7cfe" isMobile={isMobile} />
            {(stats.liveAgentCount || 0) > 0 && (
              <StatPill label="Live" value={stats.liveAgentCount || 0} color="#f05b5b" isMobile={isMobile} />
            )}
            <StatPill label="Uptime" value={formatUptime(uptime)} color="#f0b429" isMobile={isMobile} />
          </div>
        </div>

        {/* ── Agent Desk Area ── */}
        {deskAgents.length > 0 && (
          <div
            style={{
              flexShrink: 0,
              padding: isMobile ? "8px 14px" : "10px 24px",
              borderBottom: "1px solid var(--border-subtle)",
              background: "linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-secondary) 100%)",
            }}
          >
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
              {/* Primary section */}
              {primaryAgents.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "8px", color: "#7c5cfc", letterSpacing: "0.1em", fontWeight: 700 }}>
                    🟣 PRIMARY
                  </span>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {primaryAgents.map(a => {
                      const isWorking = a.status === "active" && !transitioning.has(a.id);
                      return (
                        <AgentDesk
                          key={a.id}
                          agent={{
                            id: a.id,
                            name: a.name,
                            emoji: a.emoji,
                            role: a.role,
                            model: a.model,
                            status: a.status,
                            taskSummary: a.taskSummary,
                          }}
                          isWorking={isWorking}
                          onClick={() => setSelectedAgent(a)}
                          onMount={(el) => deskRefs.current.set(a.id, el)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Divider */}
              {primaryAgents.length > 0 && allDedicated.length > 0 && (
                <div style={{ width: "1px", background: "var(--border-default)", alignSelf: "stretch", margin: "0 4px" }} />
              )}

              {/* Dedicated section */}
              {allDedicated.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "8px", color: "#4d7cfe", letterSpacing: "0.1em", fontWeight: 700 }}>
                    🔵 DEDICATED
                  </span>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {allDedicated.map(a => {
                      const isWorking = a.status === "active" && !transitioning.has(a.id);
                      return (
                        <AgentDesk
                          key={a.id}
                          agent={a}
                          isWorking={isWorking}
                          onClick={a.source === "factory" ? () => setSelectedAgent(a as unknown as LiveAgent) : undefined}
                          onMount={(el) => deskRefs.current.set(a.id, el)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Floor line */}
            <div style={{
              height: "2px",
              background: "linear-gradient(90deg, transparent 0%, #ffffff08 20%, #ffffff08 80%, transparent 100%)",
              marginTop: "8px",
            }} />
          </div>
        )}

        {/* ── Factory Floor ──────────────────────────────────────────────── */}
        {isMobile ? (
          /* ── MOBILE: vertical stacked sections ── */
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 12px 4px",
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          >
            {zones.map((zoneKey) => (
              <MobileZoneSection
                key={zoneKey}
                zoneKey={zoneKey}
                tasks={tasks.filter((t) => t.status === zoneKey)}
                liveAgents={liveAgents}
                onSelectTask={setSelectedTask}
                onSelectAgent={setSelectedAgent}
              />
            ))}
          </div>
        ) : (
          /* ── DESKTOP: horizontal columns ── */
          <div
            style={{
              flex: 1,
              display: "flex",
              gap: "0",
              padding: "16px 20px",
              overflow: "hidden",
              minHeight: 0,
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          >
            {zones.map((zoneKey, idx) => (
              <div key={zoneKey} style={{ display: "flex", flex: 1, minWidth: 0, alignItems: "stretch" }}>
                <div style={{ flex: 1, minWidth: "280px", display: "flex", flexDirection: "column" }}>
                  <FactoryZone
                    zoneKey={zoneKey}
                    tasks={tasks.filter((t) => t.status === zoneKey)}
                    liveAgents={liveAgents}
                    onSelectTask={setSelectedTask}
                    onSelectAgent={setSelectedAgent}
                  />
                </div>
                {idx < zones.length - 1 && <div style={{ width: "12px", flexShrink: 0 }} />}
              </div>
            ))}
          </div>
        )}

        {/* ── Bottom stats bar ───────────────────────────────────────────── */}
        <div
          style={{
            flexShrink: 0,
            padding: isMobile ? "8px 80px 8px 12px" : "10px 24px",
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--bg-secondary)",
            display: "flex",
            alignItems: isMobile ? "flex-start" : "center",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? "8px" : "24px",
            overflowX: isMobile ? "visible" : "auto",
          }}
        >
          {isMobile ? (
            /* Mobile bottom bar */
            <>
              {/* Row 1: scanner status */}
              <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    style={{
                      width: "8px", height: "8px", borderRadius: "2px",
                      background: scanner.status === "running" ? "#26c97a" : "#4d7cfe",
                      animation: scanner.status === "running" ? "scannerPulse 0.8s ease-in-out infinite" : "none",
                      boxShadow: scanner.status === "running" ? "0 0 6px #26c97a" : "none",
                    }}
                  />
                  <span style={{ fontSize: "14px", color: "#ffffff" }}>
                    Scanner:{" "}
                    <span style={{ color: scanner.status === "running" ? "#26c97a" : "#f0b429", fontWeight: 700 }}>
                      {scanner.status.toUpperCase()}
                    </span>
                  </span>
                </div>
                <span style={{ fontSize: "14px", color: "#ffffff" }}>
                  Last: <span style={{ fontWeight: 600 }}>{formatScanTime(scanner.lastScan)}</span>
                </span>
                {scanner.nextScanMins !== null && (
                  <span style={{ fontSize: "14px", color: "#ffffff" }}>
                    Next:{" "}
                    <span style={{ color: (scanner.nextScanMins || 0) < 10 ? "#f0b429" : "#ffffff", fontWeight: 600 }}>
                      {scanner.nextScanMins === 0 ? "NOW" : `${scanner.nextScanMins}m`}
                    </span>
                  </span>
                )}
              </div>

              {/* Row 2: task counts */}
              <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
                {(["backlog", "in-progress", "in-review", "done"] as const).map((zone) => {
                  const cfg = ZONE_CONFIG[zone];
                  const count = tasks.filter((t) => t.status === zone).length;
                  return (
                    <span key={zone} style={{ fontSize: "14px", color: "#ffffff" }}>
                      <span style={{ color: cfg.topBorder, fontWeight: 700 }}>{count}</span>{" "}
                      <span style={{ opacity: 0.7, fontSize: "12px" }}>{cfg.label}<span style={{ marginLeft: "6px", fontSize: "10px", color: "var(--text-muted)", cursor: "help" }} title={cfg.tooltip}>ⓘ</span></span>
                    </span>
                  );
                })}
                {liveAgents.filter(a => a.status === "active").length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#f05b5b", animation: "scannerPulse 1s ease-in-out infinite", boxShadow: "0 0 6px #f05b5b" }} />
                    <span style={{ fontSize: "14px", color: "#f05b5b", fontWeight: 700 }}>
                      {liveAgents.filter(a => a.status === "active").length} Live
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Desktop bottom bar */
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "8px", height: "8px", borderRadius: "2px",
                    background: scanner.status === "running" ? "#26c97a" : "#4d7cfe",
                    animation: scanner.status === "running" ? "scannerPulse 0.8s ease-in-out infinite" : "none",
                    boxShadow: scanner.status === "running" ? "0 0 6px #26c97a" : "none",
                  }}
                />
                <span style={{ fontSize: "13px", color: "#ffffff" }}>
                  Scanner:{" "}
                  <span style={{ color: scanner.status === "running" ? "#26c97a" : "#f0b429", fontWeight: 700 }}>
                    {scanner.status.toUpperCase()}
                  </span>
                </span>
              </div>

              <div style={{ width: "1px", height: "18px", background: "var(--border-subtle)" }} />

              <span style={{ fontSize: "13px", color: "#ffffff" }}>
                Last Scan: <span style={{ fontWeight: 600 }}>{formatScanTime(scanner.lastScan)}</span>
              </span>

              {scanner.nextScanMins !== null && (
                <>
                  <div style={{ width: "1px", height: "18px", background: "var(--border-subtle)" }} />
                  <span style={{ fontSize: "13px", color: "#ffffff" }}>
                    Next Scan:{" "}
                    <span style={{ color: (scanner.nextScanMins || 0) < 10 ? "#f0b429" : "#ffffff", fontWeight: 600 }}>
                      {scanner.nextScanMins === 0 ? "NOW" : `in ${scanner.nextScanMins} min`}
                    </span>
                  </span>
                </>
              )}

              {liveAgents.filter(a => a.status === "active").length > 0 && (
                <>
                  <div style={{ width: "1px", height: "18px", background: "var(--border-subtle)" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#f05b5b", animation: "scannerPulse 1s ease-in-out infinite", boxShadow: "0 0 6px #f05b5b" }} />
                    <span style={{ fontSize: "13px", color: "#ffffff" }}>
                      Live Agents: <span style={{ color: "#f05b5b", fontWeight: 700 }}>{liveAgents.filter(a => a.status === "active").length}</span>
                    </span>
                  </div>
                </>
              )}

              {/* Ticker tape */}
              <div
                style={{
                  flex: 1,
                  overflow: "hidden",
                  position: "relative",
                  height: "22px",
                  margin: "0 8px",
                  background: "#0a0a14",
                  border: "1px solid #2e2e4a",
                  borderRadius: "2px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "32px", background: "linear-gradient(90deg, #0a0a14 0%, transparent 100%)", zIndex: 1, pointerEvents: "none" }} />
                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "32px", background: "linear-gradient(270deg, #0a0a14 0%, transparent 100%)", zIndex: 1, pointerEvents: "none" }} />
                <div
                  style={{
                    display: "inline-block",
                    whiteSpace: "nowrap",
                    animation: "tickerScroll 22s linear infinite",
                    fontSize: "10px",
                    fontFamily: "'Courier New', monospace",
                    color: "#7c5cfc99",
                    letterSpacing: "0.12em",
                    paddingLeft: "100%",
                  }}
                >
                  {tasks.length > 0
                    ? tasks
                        .filter((t) => t.status === "in-progress" || t.status === "in-review")
                        .concat(tasks.filter((t) => t.status === "backlog").slice(0, 3))
                        .map((t) => `  ▶  ${t.title.toUpperCase()}`)
                        .join("  ·  ") || `  ▶  FACTORY FLOOR OPERATIONAL  ·  AWAITING TASKS`
                    : `  ▶  FACTORY FLOOR OPERATIONAL  ·  ALL SYSTEMS NOMINAL  ·  READY`
                  }
                </div>
              </div>

              {/* Task count breakdown */}
              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                {(["backlog", "in-progress", "in-review", "done"] as const).map((zone) => {
                  const cfg = ZONE_CONFIG[zone];
                  const count = tasks.filter((t) => t.status === zone).length;
                  return (
                    <span key={zone} style={{ fontSize: "13px", color: "#ffffff" }}>
                      <span style={{ color: cfg.topBorder, fontWeight: 700 }}>{count}</span>{" "}
                      {cfg.label}<span style={{ marginLeft: "6px", fontSize: "10px", color: "var(--text-muted)", cursor: "help" }} title={cfg.tooltip}>ⓘ</span>
                    </span>
                  );
                })}
              </div>

              <div style={{ width: "1px", height: "18px", background: "var(--border-subtle)" }} />

              <span style={{ fontSize: "14px", color: "#ffffff", animation: "pixelBlink 1s step-end infinite" }}>█</span>
            </>
          )}
        </div>
      </div>

      {/* ── Task Detail Modal ── */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* ── Agent Detail Modal ── */}
      {selectedAgent && (
        <div
          onClick={() => setSelectedAgent(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "500px",
              width: "100%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <PersonFigure
                  emoji={selectedAgent.emoji}
                  role={selectedAgent.role}
                  bouncing={selectedAgent.status === "active"}
                  agentId={selectedAgent.id}
                  agentName={selectedAgent.name}
                />
                <div>
                  <div style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)" }}>{selectedAgent.name}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>{selectedAgent.role}</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: "20px", cursor: "pointer", padding: "4px 8px" }}
              >✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ padding: "12px", borderRadius: "8px", background: "var(--bg-primary)" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</div>
                <span style={{
                  fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "6px",
                  background: selectedAgent.status === "active" ? "#4d7cfe18" : selectedAgent.status === "completed" ? "#26c97a18" : "#f05b5b18",
                  color: selectedAgent.status === "active" ? "#4d7cfe" : selectedAgent.status === "completed" ? "#26c97a" : "#f05b5b",
                }}>
                  {selectedAgent.status === "active" ? "🟢 LIVE" : selectedAgent.status === "completed" ? "✅ Completed" : selectedAgent.status}
                </span>
              </div>

              <div style={{ padding: "12px", borderRadius: "8px", background: "var(--bg-primary)" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Model</div>
                <div style={{ fontSize: "14px", color: "var(--text-primary)" }}>{selectedAgent.model || "—"}</div>
              </div>

              <div style={{ padding: "12px", borderRadius: "8px", background: "var(--bg-primary)" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Task</div>
                <div style={{ fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.5 }}>{selectedAgent.taskSummary || "No task description"}</div>
              </div>

              {selectedAgent.sessionKey && (
                <div style={{ padding: "12px", borderRadius: "8px", background: "var(--bg-primary)" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Session</div>
                  <div style={{ fontSize: "11px", color: "var(--text-tertiary)", fontFamily: "monospace", wordBreak: "break-all" }}>{selectedAgent.sessionKey}</div>
                </div>
              )}

              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1, padding: "12px", borderRadius: "8px", background: "var(--bg-primary)" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Started</div>
                  <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{new Date(selectedAgent.startedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                </div>
                {selectedAgent.completedAt && (
                  <div style={{ flex: 1, padding: "12px", borderRadius: "8px", background: "var(--bg-primary)" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Completed</div>
                    <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{new Date(selectedAgent.completedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

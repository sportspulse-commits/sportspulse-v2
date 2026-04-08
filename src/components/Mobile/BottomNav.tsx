import React from "react";

export type MobileTab = "games" | "watch" | "bets" | "analytics";

interface BottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

const tabs: { id: MobileTab; label: string; icon: string }[] = [
  { id: "games",     label: "Games",     icon: "🏈" },
  { id: "watch",     label: "Watch",     icon: "⭐" },
  { id: "bets",      label: "Bets",      icon: "📋" },
  { id: "analytics", label: "Analytics", icon: "📊" },
];

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        display: "flex",
        alignItems: "stretch",
        backgroundColor: "var(--nav-bg)",
        borderTop: "1px solid var(--nav-border)",
        zIndex: 9999,
        fontFamily: "monospace",
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.id === "analytics") {
                window.location.href = "/analytics";
                return;
              }
              onTabChange(tab.id);
            }}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: isActive ? "var(--nav-active)" : "var(--nav-inactive)",
              borderTop: isActive ? "2px solid var(--nav-active)" : "2px solid transparent",
              transition: "color 0.15s, border-color 0.15s",
              padding: "6px 0 4px",
            }}
            aria-label={tab.label}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
            <span style={{ fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

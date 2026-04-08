import React, { useState } from "react";
import BottomNav, { MobileTab } from "./BottomNav";

interface MobileLayoutProps {
  gamesScreen: React.ReactNode;
  watchScreen: React.ReactNode;
  betsScreen: React.ReactNode;
  initialTab?: MobileTab;
}

export default function MobileLayout({
  gamesScreen,
  watchScreen,
  betsScreen,
  initialTab = "games",
}: MobileLayoutProps) {
  const [activeTab, setActiveTab] = useState<MobileTab>(initialTab);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--mobile-bg)",
        color: "var(--mobile-text)",
        fontFamily: "monospace",
        overflowY: "hidden",
      }}
    >
      {/* Main content area — fills all space above bottom nav */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          paddingBottom: 60,
        }}
      >
        <div style={{ display: activeTab === "games"   ? "block" : "none" }}>{gamesScreen}</div>
        <div style={{ display: activeTab === "watch"   ? "block" : "none" }}>{watchScreen}</div>
        <div style={{ display: activeTab === "bets"    ? "block" : "none" }}>{betsScreen}</div>
      </div>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

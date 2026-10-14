import { LuckPanel, PotionPanel, RecentRolls, RollControls, StatsPanel } from "../roll/Panels";
import { RollStage } from "../roll/RollStage";
import "../roll/RollPage.css";

export function RollPage() {
  return (
    <div className="page roll-page">
      <div className="roll-page__center">
        <RollStage />
        <RollControls />
        <RecentRolls />
      </div>
      <div className="roll-page__left">
        <StatsPanel />
      </div>
      <div className="roll-page__right">
        <LuckPanel />
        <PotionPanel />
      </div>
    </div>
  );
}

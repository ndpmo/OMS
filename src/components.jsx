import React from "react";
import {
  Award,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Crown,
  Gift,
  Home,
  LayoutList,
  Medal,
  Sparkles,
  UserRound,
  Users
} from "lucide-react";

export const navItems = [
  { id: "home", label: "錢包", icon: CircleDollarSign },
  { id: "missions", label: "任務", icon: LayoutList },
  { id: "rewards", label: "獎賞", icon: Gift },
  { id: "leaderboard", label: "排行", icon: Medal },
  { id: "profile", label: "我的", icon: UserRound }
];

export function BPBadge({ children, tone = "gold" }) {
  return <span className={`bp-badge ${tone}`}>{children}</span>;
}

export function BPBalanceCard({ balance, monthBP }) {
  return (
    <section className="hero-card bp-balance-card">
      <div>
        <p className="eyebrow">Beauty Points 錢包</p>
        <h1>{balance.toLocaleString()} BP</h1>
        <p className="muted">本月已賺取 +{monthBP.toLocaleString()} BP</p>
      </div>
      <div className="bp-coin" aria-label="Beauty Points 金幣">
        BP
      </div>
    </section>
  );
}

export function KPIProgressCard({ mission, large = false }) {
  const progress = getProgress(mission);
  const displayName = translateMissionText(mission["System Display Name"] || mission["Mission Detail"]);
  const displayDetail = mission["System Display Detail"] || mission["Mission Detail"];

  return (
    <section className={`glass-card kpi-card ${large ? "kpi-card-large" : ""}`}>
      <div className="card-topline">
        <BPBadge>新人 KPI</BPBadge>
        <BPBadge tone="soft">獎賞：{Number(mission["Regular Quantum Points"]).toLocaleString()} BP</BPBadge>
      </div>
      <div className="kpi-copy">
        <p className="eyebrow">最重要 KPI</p>
        <h2>{displayName}</h2>
        <p>{translateMissionText(displayDetail)}</p>
      </div>
      <ProgressBar value={progress.value} label={`${mission.progressCurrent} / ${mission.progressTarget}`} />
    </section>
  );
}

export function GrowthEngineCard({ engine, onSelect }) {
  const Icon = engine.title.includes("Customer") || engine.title.includes("客戶") ? Sparkles : Users;

  return (
    <button className={`glass-card engine-card ${engine.accent}`} onClick={() => onSelect(engine.id)}>
      <div className="engine-icon">
        <Icon size={22} />
      </div>
      <div>
        <h3>{engine.title}</h3>
        <p>{engine.subtitle}</p>
      </div>
      <ChevronRight size={20} />
    </button>
  );
}

export function MissionCard({ mission, featured = false }) {
  const progress = getProgress(mission);
  const displayName = mission["System Display Name"] || mission["Mission Detail"];
  const displayDetail = mission["System Display Detail"] || mission["Mission Detail"];
  const translatedName = translateMissionText(displayName);
  const translatedDetail = translateMissionText(displayDetail);
  const missionSearchText = `${displayName} ${displayDetail} ${mission["Mission Detail"]}`;
  const hasBonusProgress =
    isRoundBonusMission(missionSearchText);
  const hasFiniteProgress =
    featured || /reach 30/i.test(missionSearchText) || hasBonusProgress;

  return (
    <article className={`glass-card mission-card ${featured ? "featured-mission" : ""}`}>
      <div className="mission-card-icon">
        {featured ? <Users size={27} /> : <Award size={25} />}
      </div>
      <div className="mission-heading">
        <div>
          <h3>{translatedName}</h3>
          <p className="mission-detail">{translatedDetail}</p>
        </div>
        <ChevronRight className="mission-chevron" size={22} />
      </div>
      {hasFiniteProgress ? (
        <ProgressBar value={progress.value} label={`${mission.progressCurrent} / ${mission.progressTarget}`} />
      ) : null}
      <div className="mission-meta">
        <span>{hasBonusProgress ? "每輪只可領一次" : translateMissionText(mission.Category)}</span>
        <strong>+{Number(mission["Regular Quantum Points"]).toLocaleString()} BP</strong>
      </div>
    </article>
  );
}

export function RewardCard({ reward, canRedeem }) {
  return (
    <article className="glass-card reward-card">
      <div className={`reward-image ${reward.gradient}`}>
        <span className="reward-ribbon">熱門</span>
        <Gift size={42} />
      </div>
      <div className="reward-body">
        <p className="mini-label">{reward.category}</p>
        <h3>{reward.name}</h3>
        {reward.cashValue ? <p className="reward-cash-value">價值 HK${reward.cashValue.toLocaleString()}</p> : null}
        <strong>{reward.cost.toLocaleString()} BP</strong>
      </div>
      <button className="primary-action" disabled={!canRedeem}>
        兌換
      </button>
    </article>
  );
}

export function LeaderboardRow({ item }) {
  return (
    <article className="leaderboard-row">
      <div className="rank-token">#{item.rank}</div>
      <div className="avatar">{getInitials(item.name)}</div>
      <div>
        <h3>{item.name}</h3>
        <p>{item.bp.toLocaleString()} BP</p>
      </div>
      {item.rank <= 3 && <Crown className="leader-icon" size={18} />}
    </article>
  );
}

export function ProfileStatsCard({ label, value, icon: Icon = BarChart3 }) {
  return (
    <article className="glass-card stat-card">
      <Icon size={19} />
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

export function BottomNavigation({ activeScreen, onNavigate }) {
  return (
    <nav className="bottom-nav" aria-label="主要導覽">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            className={activeScreen === item.id ? "active" : ""}
            onClick={() => onNavigate(item.id)}
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function SectionHeader({ eyebrow, title, action }) {
  return (
    <div className="section-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{translateMissionText(title)}</h2>
      </div>
      {action}
    </div>
  );
}

export function SegmentedTabs({ items, active, onChange }) {
  return (
    <div className="segmented-tabs">
      {items.map((item) => (
        <button key={item} className={active === item ? "active" : ""} onClick={() => onChange(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, label }) {
  return (
    <div className="progress-wrap">
      <div className="progress-label">
        <span>進度</span>
        <strong>{label}</strong>
      </div>
      <div className="progress-track">
        <span style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="state-card">
      <CircleDollarSign size={24} />
      <p>正在載入 Beauty Points 任務...</p>
    </div>
  );
}

export function EmptyState({ message }) {
  return (
    <div className="state-card">
      <Award size={24} />
      <p>{message}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = status.toLowerCase().replaceAll(" ", "-");
  return (
    <span className={`status-badge ${normalized}`}>
      {status === "Completed" && <CheckCircle2 size={14} />}
      {translateStatus(status)}
    </span>
  );
}

function MissionCompletionBadge({ mission, isOneTime }) {
  if (isOneTime) {
    return <StatusBadge status={mission.status} />;
  }

  const count = Number(mission.progressCurrent || 0);
  return <span className="status-badge count-badge">完成 {count.toLocaleString()} 次</span>;
}

function isRoundBonusMission(text) {
  return (
    /(^|\s)(3x|5x)\b/i.test(text) ||
    /3X Referee onsales|5X Referee onsales/i.test(text) ||
    /成功招募三位治療師並上數|成功招募五位治療師並上數/.test(text) ||
    /75k|75,000|30 CB|30個ACB|首 3 個月完成 75K/i.test(text)
  );
}

function translateStatus(status) {
  const labels = {
    "In Progress": "進行中",
    Completed: "已完成",
    "Pending Approval": "待審批",
    "Not Started": "未開始"
  };
  return labels[status] || status;
}

export function translateMissionText(text) {
  const labels = {
    "Customer Fibonacci": "客戶 Fibonacci",
    "Therapist Recruitment Fibonacci": "治療師招聘 Fibonacci",
    "Base Building": "基礎客戶建立",
    "Activate Node shop": "啟動 Node Shop",
    "Head Activation": "龍頭啟動",
    "Tail Referal": "龍尾轉介紹",
    Livestream: "直播參與",
    "Successful Offer": "成功 Offer",
    "Successful NJ Referal Offer": "NJ 轉介紹成功 Offer",
    "Successful Undertraining": "成功入職培訓",
    "Successful  Onsale": "成功 Onsale",
    "Successful Onsales": "成功 Onsales",
    "Reach 30 cutomer base": "達成 30 位客戶基礎",
    "Reach 30 customer base": "達成 30 位客戶基礎",
    "Reach 30 Customer Base": "達成 30 位客戶基礎",
    "Redeemed Wellcome Product Pack": "兌換 Wellcome 產品套裝",
    "Head Paid Trial Purchase": "龍頭付費試做購買",
    "Tail Giftcard Book": "龍尾禮品卡預約",
    "ＷeBuy Paid Trial Purchase": "WeBuy 付費試做購買",
    "ACB View Livestream": "ACB 觀看直播",
    "ICB View Livestream": "ICB 觀看直播",
    "Referee accepted offer 龍頭": "被推薦人接受 Offer 龍頭",
    "Referee accepted offer (refer by NJ) 龍尾": "被推薦人接受 Offer（NJ 推薦）龍尾",
    "Referee Onboarded with contract Signed": "被推薦人入職並簽署合約",
    "Referee onsales": "被推薦人開始 Onsales",
    "3X Referee onsales": "3X 被推薦人 Onsales",
    "5X Referee onsales": "5X 被推薦人 Onsales",
    "Referee Complete 75k or 30 CB (within 1st 3 months)": "被推薦人首 3 個月完成 75K 或 30 CB"
  };
  return labels[text] || text;
}

function getProgress(mission) {
  const current = Number(mission.progressCurrent || 0);
  const target = Number(mission.progressTarget || 1);
  return { value: Math.round((current / target) * 100) };
}

function getInitials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  ChartNoAxesColumnIncreasing,
  CircleDollarSign,
  ClipboardCheck,
  Flame,
  Gift,
  History,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  UserPlus,
  Users
} from "lucide-react";
import {
  BPBalanceCard,
  BottomNavigation,
  EmptyState,
  GrowthEngineCard,
  KPIProgressCard,
  LeaderboardRow,
  LoadingState,
  MissionCard,
  ProfileStatsCard,
  RewardCard,
  SectionHeader,
  SegmentedTabs
} from "./components.jsx";
import { fetchMissions } from "./services/missions.js";
import { fetchRewards } from "./services/rewards.js";
import { fetchStaffRows } from "./services/staff.js";
import { activityLog, leaderboard, missionGroups, user } from "./data/mockData.js";

const ALL_MISSIONS = "全部";
const leaderboardTabs = ["全公司", "區域", "分店", "團隊"];
const walletTabs = ["已賺取", "已兌換", "待審批", "調整"];

export default function App() {
  const [activeScreen, setActiveScreen] = useState("home");
  const [missions, setMissions] = useState([]);
  const [staffRows, setStaffRows] = useState([]);
  const [rewardItems, setRewardItems] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [status, setStatus] = useState({ loading: true, message: "" });
  const [loginError, setLoginError] = useState("");
  const [missionFilter, setMissionFilter] = useState(ALL_MISSIONS);
  const [leaderboardFilter, setLeaderboardFilter] = useState("全公司");
  const [walletFilter, setWalletFilter] = useState("已賺取");

  useEffect(() => {
    let active = true;

    Promise.all([fetchMissions(), fetchStaffRows(), fetchRewards()]).then(([missionResult, staffResult, rewardResult]) => {
      if (!active) return;
      setMissions(missionResult.missions);
      setStaffRows(staffResult.staff);
      setRewardItems(rewardResult.rewards);
      setStatus({
        loading: false,
        message: [missionResult.message, staffResult.message, rewardResult.message].filter(Boolean).join(" "),
        isMock: missionResult.source === "mock" || staffResult.source === "mock" || rewardResult.source === "mock"
      });
    });

    return () => {
      active = false;
    };
  }, []);

  const userMissions = useMemo(() => applyStaffProgress(missions, activeUser), [missions, activeUser]);

  const kpiMission = useMemo(
    () =>
      missions.find((mission) =>
        /reach 30/i.test(`${mission["System Display Name"]} ${mission["Mission Detail"]}`)
      ) || userMissions[0],
    [userMissions]
  );

  const missionTabs = useMemo(() => {
    const groups = [...new Set(userMissions.map((mission) => mission.Group).filter(Boolean))];
    return [ALL_MISSIONS, ...groups];
  }, [userMissions]);

  const filteredMissions = useMemo(() => {
    if (missionFilter === ALL_MISSIONS) return userMissions;
    return userMissions.filter((mission) => mission.Group === missionFilter);
  }, [missionFilter, userMissions]);

  const groupedMissions = useMemo(() => {
    return filteredMissions.reduce((groups, mission) => {
      const group = mission.Group || "General";
      const category = mission.Category || "General";
      groups[group] = groups[group] || {};
      groups[group][category] = [...(groups[group][category] || []), mission];
      return groups;
    }, {});
  }, [filteredMissions]);

  function chooseEngine(group) {
    setMissionFilter(group);
    setActiveScreen("missions");
  }

  function handleLogin(staffNo) {
    const trimmedStaffNo = staffNo.trim();

    if (status.loading && staffRows.length === 0) {
      setLoginError("資料載入中，請稍等幾秒再登入。");
      return;
    }

    const matchedUser = staffRows.find((staff) => staff.id.toLowerCase() === trimmedStaffNo.toLowerCase());

    if (!matchedUser) {
      setLoginError("搵唔到呢個 staff no，請確認 RAW DATA staff no 已填正確。");
      return;
    }

    setLoginError("");
    setActiveUser(matchedUser);
  }

  function handleLogout() {
    setActiveUser(null);
    setActiveScreen("home");
    setMissionFilter(ALL_MISSIONS);
  }

  return (
    <div className="app-shell">
      <main className="phone-frame">
        <div className="screen-glow" />
        {!activeUser ? (
          <LoginScreen
            staffRows={staffRows}
            loginError={loginError}
            status={status}
            onLogin={handleLogin}
          />
        ) : (
          <>
        {!["missions", "rewards"].includes(activeScreen) && <div className="top-bar">
          <div>
            <p className="eyebrow">OMS Beauty Points</p>
            <h1>{screenTitle(activeScreen)}</h1>
          </div>
          <button className="icon-button" aria-label="登出" onClick={handleLogout}>
            <UserRound size={20} />
          </button>
        </div>}

        {status.loading ? (
          <LoadingState />
        ) : (
          <>
            {status.message && <div className={`data-banner ${status.isMock ? "mock" : ""}`}>{status.message}</div>}

            {activeScreen === "home" && (
              <HomeScreen currentUser={activeUser} onNavigate={setActiveScreen} />
            )}
            {activeScreen === "missions" && (
              <MissionsScreen
                currentUser={activeUser}
                groupedMissions={groupedMissions}
                missionTabs={missionTabs}
                missionFilter={missionFilter}
                setMissionFilter={setMissionFilter}
              />
            )}
            {activeScreen === "rewards" && <RewardsScreen currentUser={activeUser} rewards={rewardItems} />}
            {activeScreen === "leaderboard" && (
              <LeaderboardScreen currentUser={activeUser} active={leaderboardFilter} onChange={setLeaderboardFilter} />
            )}
            {activeScreen === "profile" && (
              <ProfileScreen currentUser={activeUser} active={walletFilter} onChange={setWalletFilter} />
            )}
          </>
        )}
          </>
        )}
      </main>
      {activeUser && <BottomNavigation activeScreen={activeScreen} onNavigate={setActiveScreen} />}
    </div>
  );
}

function LoginScreen({ staffRows, loginError, status, onLogin }) {
  const [staffNo, setStaffNo] = useState("");
  const sampleStaffNo = staffRows[0]?.id;

  function submitLogin(event) {
    event.preventDefault();
    onLogin(staffNo);
  }

  return (
    <section className="login-screen">
      <div className="growth-poster image-poster" aria-label="OMS Growth OS"></div>
      {status.message && <div className={`data-banner ${status.isMock ? "mock" : ""}`}>{status.message}</div>}
      <form className="glass-card login-card" onSubmit={submitLogin}>
        <div className="login-card-title">
          <div className="login-icon">♡</div>
          <div>
            <h2>Staff Login</h2>
            <p>員工登入</p>
          </div>
        </div>
        <div className="login-field">
          <label htmlFor="staff-no">Staff Login No.<span>員工登入編號</span></label>
          <div className="login-input-wrap">
            <span>♙</span>
            <input
              id="staff-no"
              value={staffNo}
              onChange={(event) => setStaffNo(event.target.value)}
              placeholder={sampleStaffNo ? `例如 ${sampleStaffNo}` : "請輸入員工登入編號"}
              autoComplete="off"
            />
          </div>
        </div>
        {loginError && <p className="login-error">{loginError}</p>}
        <button className="primary-action" type="submit">登入</button>
      </form>
    </section>
  );
}

function HomeScreen({ currentUser, onNavigate }) {
  return (
    <div className="screen-stack wallet-home-screen">
      <section className="greeting">
        <div>
          <p>歡迎回來，</p>
          <h2>{currentUser.name}</h2>
        </div>
        <span>{currentUser.branch}</span>
      </section>

      <BPBalanceCard balance={currentUser.currentBP} monthBP={currentUser.monthBP} />
      <div className="quick-stats two-col">
        <ProfileStatsCard label="我的排名" value={`#${currentUser.rank}`} icon={Trophy} />
        <ProfileStatsCard label="已完成任務" value={currentUser.completedMissions} icon={BadgeCheck} />
      </div>
      <div className="wallet-action-grid">
        <button className="primary-action" type="button" onClick={() => onNavigate("missions")}>去做任務</button>
        <button className="secondary-action" type="button" onClick={() => onNavigate("rewards")}>兌換獎賞</button>
      </div>
      <SectionHeader eyebrow="最新紀錄" title="BP 活動" />
      <div className="activity-list">
        {activityLog.slice(0, 3).map((item) => (
          <article className="activity-row" key={`${item.amount}-${item.label}`}>
            <span className={item.amount > 0 ? "positive" : "negative"}>
              {item.amount > 0 ? "+" : ""}
              {item.amount} BP
            </span>
            <p>{item.label}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function MissionsScreen({ currentUser, groupedMissions, missionTabs, missionFilter, setMissionFilter }) {
  const hasMissions = Object.keys(groupedMissions).length > 0;

  return (
    <div className="screen-stack mission-center-screen">
      <section className="mission-kv">
        <div className="mission-kv-top">
          <div className="mission-nd-logo">
            <strong>ND</strong>
            <span>Neo Derm</span>
          </div>
          <button className="mission-bell" aria-label="通知">●</button>
        </div>
        <div className="mission-kv-title">
          <h1>Mission Center</h1>
          <p>任務中心</p>
        </div>
      </section>
      <section className="mission-progress-panel">
        <h2>我的進度總覽</h2>
        <div className="mission-stat-grid">
          <MissionStat icon={BadgeCheck} label="已完成任務" value={currentUser.completedMissions} />
          <MissionStat icon={Trophy} label="我的排名" value={`#${currentUser.rank}`} />
        </div>
      </section>
      <SegmentedTabs items={missionTabs} active={missionFilter} onChange={setMissionFilter} />
      {!hasMissions && <EmptyState message="此成長引擎暫時未有任務。" />}
      {Object.entries(groupedMissions).map(([group, categories]) => (
        <section className="mission-group" key={group}>
          <SectionHeader eyebrow="Fibonacci 引擎" title={group} />
          {Object.entries(categories).map(([category, categoryMissions]) => (
            <div className="mission-category" key={`${group}-${category}`}>
              <SectionHeader title={category} />
              <div className="card-list">
                {categoryMissions.map((mission) => (
                  <MissionCard
                    key={`${mission.Group}-${mission.Category}-${mission["System Display Name"]}`}
                    mission={mission}
                    featured={/reach 30/i.test(`${mission["System Display Name"]} ${mission["Mission Detail"]}`)}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
      <section className="mission-reward-banner">
        <div>
          <Trophy size={34} />
        </div>
        <p><strong>完成任務，贏取更多 BP</strong><span>累積 BP，兌換豐盛獎賞！</span></p>
      </section>
    </div>
  );
}

function MissionStat({ icon: Icon, label, value }) {
  return (
    <div className="mission-stat">
      <div className="mission-stat-icon">
        <Icon size={20} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DailyQuestCard({ completedCount }) {
  const todayCount = Math.min(completedCount, 3);

  return (
    <section className="glass-card daily-quest-card">
      <div className="quest-orbit">
        <Target size={22} />
      </div>
      <div>
        <p className="eyebrow">今日挑戰</p>
        <h2>完成 3 個客戶任務</h2>
        <p>完成後即時累積 BP，推高本週排行。</p>
      </div>
      <div className="quest-progress">
        <span>{todayCount} / 3</span>
      </div>
    </section>
  );
}

function AchievementStrip() {
  const achievements = [
    { icon: Flame, label: "連續活躍 4 日" },
    { icon: Sparkles, label: "轉介紹節奏良好" },
    { icon: Trophy, label: "距離 Top 10 差 320 BP" }
  ];

  return (
    <section className="achievement-strip" aria-label="Achievement highlights">
      {achievements.map((achievement) => {
        const Icon = achievement.icon;
        return (
          <div className="achievement-chip" key={achievement.label}>
            <Icon size={15} />
            <span>{achievement.label}</span>
          </div>
        );
      })}
    </section>
  );
}

function RewardsScreen({ currentUser, rewards }) {
  const categories = [ALL_MISSIONS, ...new Set(rewards.map((reward) => reward.category).filter(Boolean))];
  const [activeCategory, setActiveCategory] = useState(ALL_MISSIONS);
  const visibleRewards =
    activeCategory === ALL_MISSIONS ? rewards : rewards.filter((reward) => reward.category === activeCategory);

  return (
    <div className="screen-stack gift-center-screen">
      <section className="gift-kv">
        <div className="mission-kv-top">
          <div className="mission-nd-logo">
            <strong>ND</strong>
            <span>Neo Derm</span>
          </div>
          <button className="mission-bell" aria-label="通知">●</button>
        </div>
        <div className="gift-kv-title">
          <h1>兌換禮物</h1>
          <p>用 BP 換取豐富獎賞</p>
        </div>
      </section>
      <section className="gift-wallet-panel">
        <div className="bp-coin">BP</div>
        <div>
          <span>可用 BP</span>
          <strong>{currentUser.currentBP.toLocaleString()} <small>BP</small></strong>
          <p>Keep going, you’re doing amazing! ✨</p>
        </div>
        <button className="gift-history" type="button">
          <History size={24} />
          <span>兌換紀錄</span>
        </button>
      </section>
      <SegmentedTabs items={categories} active={activeCategory} onChange={setActiveCategory} />
      <div className="reward-grid gift-grid">
        {visibleRewards.map((reward) => (
          <RewardCard key={`${reward.category}-${reward.name}-${reward.cost}`} reward={reward} canRedeem={currentUser.currentBP >= reward.cost} />
        ))}
      </div>
      <section className="mission-reward-banner">
        <div>
          <Gift size={34} />
        </div>
        <p><strong>更多精選禮物陸續上架！</strong><span>完成任務賺取更多 BP，換取心儀獎賞！</span></p>
      </section>
    </div>
  );
}

function LeaderboardScreen({ currentUser, active, onChange }) {
  return (
    <div className="screen-stack leaderboard-screen">
      <SegmentedTabs items={leaderboardTabs} active={active} onChange={onChange} />
      <section className="glass-card sticky-rank-card">
        <div>
          <p className="eyebrow">你的排名：#{currentUser.rank}</p>
          <h2>{currentUser.name}</h2>
          <p>{currentUser.currentBP.toLocaleString()} BP</p>
        </div>
        <div className="bp-coin small">BP</div>
      </section>
      <div className="leaderboard-list">
        {leaderboard.map((item) => (
          <LeaderboardRow key={item.rank} item={item} />
        ))}
      </div>
    </div>
  );
}

function ProfileScreen({ currentUser, active, onChange }) {
  const filteredActivity = activityLog.filter((item) => {
    if (active === "已賺取") return item.type === "earned";
    if (active === "已兌換") return item.type === "redeemed";
    if (active === "待審批") return item.type === "pending";
    return item.type === "adjustment";
  });

  return (
    <div className="screen-stack">
      <section className="glass-card profile-card">
        <div className="profile-avatar">{getInitials(currentUser.name)}</div>
        <div>
          <h2>{currentUser.name}</h2>
          <p>{currentUser.role}</p>
          <span>{currentUser.branch}</span>
        </div>
      </section>

      <div className="quick-stats">
        <ProfileStatsCard label="目前 BP" value={currentUser.currentBP.toLocaleString()} icon={CircleDollarSign} />
        <ProfileStatsCard label="累計 BP" value={currentUser.lifetimeBP.toLocaleString()} icon={AwardIcon} />
        <ProfileStatsCard label="本月 BP" value={currentUser.monthBP.toLocaleString()} icon={Activity} />
        <ProfileStatsCard label="已完成" value={currentUser.completedMissions} icon={BadgeCheck} />
      </div>

      <KPIProgressCard
        mission={{
          "System Display Name": "Reach 30 Customer Base",
          "Mission Detail": "客戶基礎進度",
          "Bonus mechanics": "客戶基礎進度",
          "Regular Quantum Points": 2000,
          progressCurrent: currentUser.customerBase.current,
          progressTarget: currentUser.customerBase.target
        }}
      />

      <div className="quick-stats two-col">
        <ProfileStatsCard label="轉介紹數" value={currentUser.referrals} icon={Sparkles} />
        <ProfileStatsCard label="招聘數" value={currentUser.recruitment} icon={Users} />
      </div>

      <SectionHeader eyebrow="BP 錢包" title="紀錄" />
      <SegmentedTabs items={walletTabs} active={active} onChange={onChange} />
      <div className="activity-list">
        {(filteredActivity.length ? filteredActivity : activityLog).map((item) => (
          <article className="activity-row" key={`${item.amount}-${item.label}`}>
            <span className={item.amount > 0 ? "positive" : "negative"}>
              {item.amount > 0 ? "+" : ""}
              {item.amount} BP
            </span>
            <p>{item.label}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function screenTitle(screen) {
  const titles = {
    home: "BP 錢包",
    missions: "任務",
    rewards: "獎賞",
    leaderboard: "排行榜",
    profile: "個人檔案"
  };
  return titles[screen];
}

function AwardIcon(props) {
  return <Sparkles {...props} />;
}

function applyStaffProgress(missions, currentUser) {
  if (!currentUser) return missions;

  return missions.map((mission) => {
    const displayName = mission["System Display Name"] || mission["Mission Detail"];
    const rawDetail = mission["Mission Detail"];
    const roundTarget = getRoundBonusTarget(`${displayName} ${rawDetail} ${mission["System Display Detail"] || ""}`);
    const rawCount = normalizeMissionCount(
      currentUser.missionCounts?.[displayName] ?? currentUser.missionCounts?.[rawDetail]
    );
    const count = roundTarget ? Number(rawCount > 0) : rawCount;
    return {
      ...mission,
      progressCurrent: count,
      progressTarget: roundTarget || mission.progressTarget,
      status: roundTarget && count >= roundTarget ? "Completed" : count > 0 ? "In Progress" : "Not Started"
    };
  });
}

function normalizeMissionCount(value) {
  if (value === "Y") return 1;
  return Number(value || 0);
}

function getRoundBonusTarget(text) {
  if (/3X Referee onsales|成功招募三位治療師並上數/i.test(text)) return 1;
  if (/5X Referee onsales|成功招募五位治療師並上數/i.test(text)) return 1;
  if (/75k|75,000|30 CB|30個ACB|新治療師完成/i.test(text)) return 1;
  return null;
}

function getInitials(name) {
  return name
    .split(/[.\s]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

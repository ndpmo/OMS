export const missionGroups = {
  customer: {
    id: "客戶 Fibonacci",
    title: "客戶 Fibonacci",
    subtitle: "客戶啟動與複製",
    description: "累積客戶基礎，推動啟動、轉化與轉介紹。",
    accent: "rose"
  },
  therapist: {
    id: "治療師招聘 Fibonacci",
    title: "治療師招聘 Fibonacci",
    subtitle: "團隊建立與晉升",
    description: "透過招聘、培訓及表現建立團隊動能。",
    accent: "violet"
  }
};

export const mockMissions = [
  {
    Type: "Customer",
    "Mission Type": "Base Building",
    "Mission Detail": "Reach 30 cutomer base",

    "System Display Name": "Reach 30 cutomer base",

    "System Display Detail": "Reach 30 cutomer base",
    "Bonus mechanics": "完成任務即可賺取 BP",
    "Regular Quantum Points": 2000,
    Group: "客戶 Fibonacci",
    Category: "Base Building",
    "New Joiner Only": true,
    progressCurrent: 18,
    progressTarget: 30,
    status: "In Progress"
  },
  {
    Type: "Customer",
    "Mission Type": "Activate Node shop",
    "Mission Detail": "Redeemed Wellcome Product Pack",

    "System Display Name": "Redeemed Wellcome Product Pack",

    "System Display Detail": "Redeemed Wellcome Product Pack",
    "Bonus mechanics": "完成任務即可賺取 BP",
    "Regular Quantum Points": 50,
    Group: "客戶 Fibonacci",
    Category: "Activate Node shop",
    "New Joiner Only": false,
    progressCurrent: 6,
    progressTarget: 10,
    status: "In Progress"
  },
  {
    Type: "Customer",
    "Mission Type": "Head Activation",
    "Mission Detail": "Head Paid Trial Purchase",

    "System Display Name": "Head Paid Trial Purchase",

    "System Display Detail": "Head Paid Trial Purchase",
    "Bonus mechanics": "完成任務即可賺取 BP",
    "Regular Quantum Points": 100,
    Group: "客戶 Fibonacci",
    Category: "Head Activation",
    "New Joiner Only": false,
    progressCurrent: 10,
    progressTarget: 10,
    status: "Completed"
  },
  {
    Type: "Customer",
    "Mission Type": "Tail Referal",
    "Mission Detail": "Tail Giftcard Book",

    "System Display Name": "Tail Giftcard Book",

    "System Display Detail": "Tail Giftcard Book",
    "Bonus mechanics": "完成任務即可賺取 BP",
    "Regular Quantum Points": 250,
    Group: "客戶 Fibonacci",
    Category: "Tail Referal",
    "New Joiner Only": false,
    progressCurrent: 2,
    progressTarget: 5,
    status: "Pending Approval"
  },
  {
    Type: "Customer",
    "Mission Type": "Tail Referal",
    "Mission Detail": "ＷeBuy Paid Trial Purchase",

    "System Display Name": "ＷeBuy Paid Trial Purchase",

    "System Display Detail": "ＷeBuy Paid Trial Purchase",
    "Bonus mechanics": "完成任務即可賺取 BP",
    "Regular Quantum Points": 500,
    Group: "客戶 Fibonacci",
    Category: "Tail Referal",
    "New Joiner Only": false,
    progressCurrent: 0,
    progressTarget: 3,
    status: "Not Started"
  },
  {
    Type: "Customer",
    "Mission Type": "Livestream",
    "Mission Detail": "ACB View Livestream",

    "System Display Name": "ACB View Livestream",

    "System Display Detail": "ACB View Livestream",
    "Bonus mechanics": "完成任務即可賺取 BP",
    "Regular Quantum Points": 25,
    Group: "客戶 Fibonacci",
    Category: "Livestream",
    "New Joiner Only": false,
    progressCurrent: 3,
    progressTarget: 4,
    status: "In Progress"
  },
  {
    Type: "Customer",
    "Mission Type": "Livestream",
    "Mission Detail": "ICB View Livestream",

    "System Display Name": "ICB View Livestream",

    "System Display Detail": "ICB View Livestream",
    "Bonus mechanics": "完成任務即可賺取 BP",
    "Regular Quantum Points": 100,
    Group: "客戶 Fibonacci",
    Category: "Livestream",
    "New Joiner Only": false,
    progressCurrent: 2,
    progressTarget: 4,
    status: "In Progress"
  },
  {
    Type: "Recruitment",
    "Mission Type": "Successful Offer",
    "Mission Detail": "Referee accepted offer 龍頭",

    "System Display Name": "Referee accepted offer 龍頭",

    "System Display Detail": "Referee accepted offer 龍頭",
    "Bonus mechanics": "完成任務即可賺取 BP",
    "Regular Quantum Points": 100,
    Group: "治療師招聘 Fibonacci",
    Category: "Successful Offer",
    "New Joiner Only": false,
    progressCurrent: 2,
    progressTarget: 3,
    status: "Pending Approval"
  },
  {
    Type: "Recruitment",
    "Mission Type": "Successful NJ Referal Offer",
    "Mission Detail": "Referee accepted offer (refer by NJ) 龍尾",

    "System Display Name": "Referee accepted offer (refer by NJ) 龍尾",

    "System Display Detail": "Referee accepted offer (refer by NJ) 龍尾",
    "Bonus mechanics": "完成任務即可賺取 BP",
    "Regular Quantum Points": 500,
    Group: "治療師招聘 Fibonacci",
    Category: "Successful NJ Referal Offer",
    "New Joiner Only": false,
    progressCurrent: 1,
    progressTarget: 3,
    status: "Pending Approval"
  },
  {
    Type: "Recruitment",
    "Mission Type": "Successful Undertraining",
    "Mission Detail": "Referee Onboarded with contract Signed",

    "System Display Name": "Referee Onboarded with contract Signed",

    "System Display Detail": "Referee Onboarded with contract Signed",
    "Bonus mechanics": "完成任務即可賺取 BP",
    "Regular Quantum Points": 500,
    Group: "治療師招聘 Fibonacci",
    Category: "Successful Undertraining",
    "New Joiner Only": false,
    progressCurrent: 1,
    progressTarget: 2,
    status: "In Progress"
  },
  {
    Type: "Recruitment",
    "Mission Type": "Successful  Onsale",
    "Mission Detail": "Referee onsales",

    "System Display Name": "Referee onsales",

    "System Display Detail": "Referee onsales",
    "Bonus mechanics": "完成任務即可賺取 BP",
    "Regular Quantum Points": 900,
    Group: "治療師招聘 Fibonacci",
    Category: "Successful  Onsale",
    "New Joiner Only": false,
    progressCurrent: 1,
    progressTarget: 1,
    status: "Completed"
  },
  {
    Type: "Recruitment",
    "Mission Type": "Successful  Onsale",
    "Mission Detail": "3X Referee onsales",

    "System Display Name": "3X Referee onsales",

    "System Display Detail": "3X Referee onsales",
    "Bonus mechanics": "完成任務即可賺取 BP",
    "Regular Quantum Points": 1000,
    Group: "治療師招聘 Fibonacci",
    Category: "Successful  Onsale",
    "New Joiner Only": false,
    progressCurrent: 0,
    progressTarget: 3,
    status: "Not Started"
  },
  {
    Type: "Recruitment",
    "Mission Type": "Successful  Onsale",
    "Mission Detail": "5X Referee onsales",

    "System Display Name": "5X Referee onsales",

    "System Display Detail": "5X Referee onsales",
    "Bonus mechanics": "完成任務即可賺取 BP",
    "Regular Quantum Points": 2000,
    Group: "治療師招聘 Fibonacci",
    Category: "Successful  Onsale",
    "New Joiner Only": false,
    progressCurrent: 0,
    progressTarget: 5,
    status: "Not Started"
  },
  {
    Type: "Recruitment",
    "Mission Type": "Successful Onsales",
    "Mission Detail": "Referee Complete 75k or 30 CB (within 1st 3 months)",

    "System Display Name": "Referee Complete 75k or 30 CB (within 1st 3 months)",

    "System Display Detail": "Referee Complete 75k or 30 CB (within 1st 3 months)",
    "Bonus mechanics": "完成任務即可賺取 BP",
    "Regular Quantum Points": 2000,
    Group: "治療師招聘 Fibonacci",
    Category: "Successful Onsales",
    "New Joiner Only": false,
    progressCurrent: 3,
    progressTarget: 5,
    status: "In Progress"
  }
];

export const rewards = [
  { name: "保濕護理套裝", category: "產品", cost: 1500, gradient: "pearl" },
  { name: "療程金額", category: "療程", cost: 3000, gradient: "blush" },
  { name: "HK$500 現金券", category: "現金券", cost: 5000, gradient: "orchid" },
  { name: "旅遊獎賞", category: "旅遊", cost: 20000, gradient: "sunrise" },
  { name: "VIP 尊尚體驗", category: "尊尚獎賞", cost: 8000, gradient: "champagne" }
];

export const leaderboard = [
  { rank: 1, name: "Amy Chan", bp: 12800 },
  { rank: 2, name: "Carmen Lee", bp: 10500 },
  { rank: 3, name: "Sarah Lam", bp: 9800 },
  { rank: 4, name: "Mandy Ho", bp: 8400 },
  { rank: 5, name: "Kelly Wong", bp: 7900 }
];

export const user = {
  name: "Jessica Wong",
  role: "美容治療師",
  branch: "中環分店",
  currentBP: 5280,
  lifetimeBP: 26800,
  monthBP: 3150,
  rank: 12,
  customerBase: { current: 18, target: 30 },
  referrals: 7,
  recruitment: 3,
  completedMissions: 16
};

export const mockStaffRows = [
  {
    Center: "D 23-24/F PP (A)",
    Therapist: "amber.aulk",
    "staff no": "A001",
    "Reach 30 ACB": 1,
    "Redeemed Welcome Product Pack": 20,
    "Head Paid Trial Purchase": 10,
    "Tail Giftcard Book": 5,
    "ＷeBuy Paid Trial Purchase": 5,
    "ACB View Livestream": 5,
    "ICB View Livestream": 5,
    "Referee accepted offer 龍頭": 5,
    "Referee accepted offer (refer by NJ) 龍尾": 5,
    "Referee Onboarded with contract Signed": 5,
    "Referee onsales": 5,
    "3X Referee onsales": 1,
    "5X Referee onsales": 1,
    "Referee Complete 75k or 30 CB (within 1st 3 months)": 3,
    "Reward point": 27375
  },
  {
    Center: "D 35/F TS (A)",
    Therapist: "cy.li",
    "staff no": "C001",
    "Reach 30 ACB": 0,
    "Redeemed Welcome Product Pack": 3,
    "Head Paid Trial Purchase": 2,
    "Tail Giftcard Book": 1,
    "ACB View Livestream": 2,
    "Reward point": 850
  }
];

export const activityLog = [
  { type: "earned", amount: 100, label: "付費試做購買" },
  { type: "earned", amount: 250, label: "禮品卡轉介紹" },
  { type: "earned", amount: 500, label: "招聘網絡 Bonus" },
  { type: "redeemed", amount: -1500, label: "兌換保濕護理套裝" },
  { type: "pending", amount: 200, label: "Offer 接受待審批" }
];

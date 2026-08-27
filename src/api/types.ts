export type Member = {
  id: string;
  email: string;
  revenueCatUserId: string;
  displayName: string;
  bio: string;
  bankName: string;
  jobTitle: string;
  avatarUrl: string | null;
  isPremium: boolean;
  premiumExpiresAt: string | null;
  createdAt: string;
};

export type MemberSession = {
  token: string;
  expiresAt: string;
  user: Member;
};

export type FeedAuthor = Pick<
  Member,
  'id' | 'displayName' | 'bankName' | 'jobTitle' | 'avatarUrl'
>;

export type FeedPost = {
  id: string;
  body: string;
  imageUrl: string | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  createdAt: string;
  author: FeedAuthor;
};

export type FeedComment = {
  id: string;
  body: string;
  createdAt: string;
  author: FeedAuthor;
};

export type LoanRequestLink = {
  id: string;
  requestId: string;
  label: string;
  bankerPhone: string;
  showEmail: boolean;
  defaultLoanType: 'consumer' | 'vehicle' | 'housing' | 'commercial' | null;
  isActive: boolean;
  expiresAt?: string | null;
  viewCount: number;
  submissionCount: number;
  lastViewedAt: string | null;
  createdAt: string;
};

export type LoanRequest = {
  id: string;
  linkId: string;
  fullName: string;
  phone: string;
  email: string | null;
  loanType: 'consumer' | 'vehicle' | 'housing' | 'commercial';
  amount: string;
  termMonths: number;
  notes: string;
  documentUrls: string[];
  status: 'new' | 'contacted' | 'closed';
  createdAt: string;
};

export type BankerNote = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

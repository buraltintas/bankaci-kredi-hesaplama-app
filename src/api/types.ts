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

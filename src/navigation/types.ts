export type RootStackParamList = {
  MainTabs: { screen?: keyof MainTabParamList } | undefined;
  Read: { bookSlug: string; chapterSlug?: string };
  ReadUnavailable: {
    bookSlug: string;
    title: string;
    author: string;
    standardEbooksUrl?: string;
    openLibraryUrl?: string;
  };
};

export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Library: undefined;
  Community: undefined;
  Profile: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

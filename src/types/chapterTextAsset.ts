/** Reading payload stored in Supabase Storage `text/` bucket. */
export interface ChapterTextAssetSentence {
  id: string;
  index: number;
  text: string;
  page_number: number;
}

export interface ChapterTextAsset {
  schema_version: 1;
  chapter_slug: string;
  sentences: ChapterTextAssetSentence[];
}

export interface TextCacheManifest {
  chapterSlug: string;
  textHash: string;
  textVersion: number;
  localPath: string;
  updatedAt: string;
}

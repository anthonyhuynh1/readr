import type { Book, Chapter } from '../types';
import type { ChapterSyncAsset } from '../types/syncAsset';
import { buildWordIndex, chapterToSyncAsset } from '../utils/syncAsset';
import {
  buildChapterFromParagraphs,
  DEFAULT_LIBRIVOX_OFFSET_MS,
  DEMO_CHAPTER_AUDIO_OFFSET_MS,
} from '../utils/chapterBuilder';

export { DEFAULT_LIBRIVOX_OFFSET_MS };

const buildChapter = buildChapterFromParagraphs;
export const mockChapter: Chapter = buildChapter({
  slug: 'the-great-gatsby-ch-1',
  bookSlug: 'the-great-gatsby',
  title: 'Chapter 1',
  chapterIndex: 1,
  pageNumber: 1,
  audioPath: 'audio/the-great-gatsby/ch-1.mp3',
  syncMetadataPath: 'sync/the-great-gatsby/ch-1.json',
  audioOffsetMs: DEMO_CHAPTER_AUDIO_OFFSET_MS,
  paragraphs: [
    'In my younger and more vulnerable years my father gave me some advice that I have been turning over in my mind ever since.',
    'Whenever you feel like criticizing any one, he told me, just remember that all the people in this world have not had the advantages that you have had.',
    'Reserving judgments is a matter of infinite hope.',
    'I am still a little afraid of missing something if I forget that, as my father snobbishly suggested, and I snobbishly repeat, a sense of the fundamental decencies is parcelled out unequally at birth.',
    'Readr pairs this text with spoken narration so every sentence can be followed with precision.',
  ],
});

export const mockBook: Book = {
  slug: 'the-great-gatsby',
  title: 'The Great Gatsby',
  author: 'F. Scott Fitzgerald',
  description:
    'A Jazz Age novel of longing, status, and illusion set on Long Island.',
  coverImageUrl:
    'https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg',
  standardEbooksUrl:
    'https://standardebooks.org/ebooks/f-scott-fitzgerald/the-great-gatsby',
  librivoxUrl: 'https://librivox.org/the-great-gatsby-by-f-scott-fitzgerald/',
  chapters: [
    mockChapter,
    buildChapter({
      slug: 'the-great-gatsby-ch-2',
      bookSlug: 'the-great-gatsby',
      title: 'Chapter 2',
      chapterIndex: 2,
      pageNumber: 2,
      audioPath: 'audio/the-great-gatsby/ch-2.mp3',
      syncMetadataPath: 'sync/the-great-gatsby/ch-2.json',
      audioOffsetMs: DEFAULT_LIBRIVOX_OFFSET_MS,
      paragraphs: [
        'About halfway between West Egg and New York the motor road hastily joins the railroad and runs beside it for a quarter of a mile.',
        'This is a valley of ashes—a fantastic farm where ashes grow like wheat into ridges and hills and grotesque gardens.',
      ],
    }),
    buildChapter({
      slug: 'the-great-gatsby-ch-3',
      bookSlug: 'the-great-gatsby',
      title: 'Chapter 3',
      chapterIndex: 3,
      pageNumber: 3,
      audioPath: 'audio/the-great-gatsby/ch-3.mp3',
      syncMetadataPath: 'sync/the-great-gatsby/ch-3.json',
      audioOffsetMs: DEFAULT_LIBRIVOX_OFFSET_MS,
      paragraphs: [
        'There was music from my neighbor\'s house through the summer nights.',
        'In his blue gardens men and girls came and went like moths among the whisperings and the champagne and the stars.',
      ],
    }),
  ],
};

export const seededBooks: Book[] = [
  mockBook,
  {
    slug: 'the-adventures-of-sherlock-holmes',
    title: 'The Adventures of Sherlock Holmes',
    author: 'Arthur Conan Doyle',
    description:
      'A collection of detective stories featuring Sherlock Holmes and Dr. Watson.',
    coverImageUrl:
      'https://standardebooks.org/ebooks/arthur-conan-doyle/the-adventures-of-sherlock-holmes',
    standardEbooksUrl:
      'https://standardebooks.org/ebooks/arthur-conan-doyle/the-adventures-of-sherlock-holmes',
    librivoxUrl:
      'https://librivox.org/the-adventures-of-sherlock-holmes-by-sir-arthur-conan-doyle/',
    chapters: [
      buildChapter({
        slug: 'the-adventures-of-sherlock-holmes-ch-1',
        bookSlug: 'the-adventures-of-sherlock-holmes',
        title: 'A Scandal in Bohemia',
        chapterIndex: 1,
        pageNumber: 1,
        audioPath: 'audio/the-adventures-of-sherlock-holmes/ch-1.mp3',
        syncMetadataPath: 'sync/the-adventures-of-sherlock-holmes/ch-1.json',
        audioOffsetMs: DEFAULT_LIBRIVOX_OFFSET_MS,
        paragraphs: [
          'To Sherlock Holmes she is always the woman.',
          'I have seldom heard him mention her under any other name.',
          'In his eyes she eclipses and predominates the whole of her sex.',
        ],
      }),
    ],
  },
  {
    slug: 'meditations',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    description:
      'Private reflections on virtue, discipline, and living in accordance with nature.',
    coverImageUrl:
      'https://standardebooks.org/ebooks/marcus-aurelius/meditations/george-long',
    standardEbooksUrl:
      'https://standardebooks.org/ebooks/marcus-aurelius/meditations/george-long',
    librivoxUrl: 'https://librivox.org/meditations-by-marcus-aurelius/',
    chapters: [
      buildChapter({
        slug: 'meditations-ch-1',
        bookSlug: 'meditations',
        title: 'Book I',
        chapterIndex: 1,
        pageNumber: 1,
        audioPath: 'audio/meditations/ch-1.mp3',
        syncMetadataPath: 'sync/meditations/ch-1.json',
        audioOffsetMs: DEFAULT_LIBRIVOX_OFFSET_MS,
        paragraphs: [
          'From my grandfather Verus I learned good morals and the government of my temper.',
          'From the reputation and remembrance of my father, modesty and a manly character.',
          'From my mother, piety and beneficence and abstinence from evil.',
        ],
      }),
    ],
  },
  {
    slug: 'alices-adventures-in-wonderland',
    title: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    description: 'A playful descent into a surreal world of logic and nonsense.',
    coverImageUrl:
      'https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland',
    standardEbooksUrl:
      'https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland',
    librivoxUrl:
      'https://librivox.org/alices-adventures-in-wonderland-by-lewis-carroll/',
    chapters: [
      buildChapter({
        slug: 'alices-adventures-in-wonderland-ch-1',
        bookSlug: 'alices-adventures-in-wonderland',
        title: 'Down the Rabbit-Hole',
        chapterIndex: 1,
        pageNumber: 1,
        audioPath: 'audio/alices-adventures-in-wonderland/ch-1.mp3',
        syncMetadataPath: 'sync/alices-adventures-in-wonderland/ch-1.json',
        audioOffsetMs: DEFAULT_LIBRIVOX_OFFSET_MS,
        paragraphs: [
          'Alice was beginning to get very tired of sitting by her sister on the bank.',
          'So she was considering in her own mind whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies.',
          'Suddenly a White Rabbit with pink eyes ran close by her.',
        ],
      }),
    ],
  },
  {
    slug: 'the-art-of-war',
    title: 'The Art of War',
    author: 'Sun Tzu',
    description:
      'Ancient strategic principles on conflict, planning, and decision-making.',
    coverImageUrl: 'https://standardebooks.org/ebooks/sun-tzu/the-art-of-war',
    standardEbooksUrl:
      'https://standardebooks.org/ebooks/sun-tzu/the-art-of-war',
    librivoxUrl: 'https://librivox.org/the-art-of-war-by-sun-tzu/',
    chapters: [
      buildChapter({
        slug: 'the-art-of-war-ch-1',
        bookSlug: 'the-art-of-war',
        title: 'Laying Plans',
        chapterIndex: 1,
        pageNumber: 1,
        audioPath: 'audio/the-art-of-war/ch-1.mp3',
        syncMetadataPath: 'sync/the-art-of-war/ch-1.json',
        audioOffsetMs: DEFAULT_LIBRIVOX_OFFSET_MS,
        paragraphs: [
          'The art of war is of vital importance to the State.',
          'It is a matter of life and death, a road either to safety or to ruin.',
          'Hence it is a subject of inquiry which can on no account be neglected.',
        ],
      }),
    ],
  },
];

export function getBundledSyncAsset(chapter: Chapter): ChapterSyncAsset {
  return chapterToSyncAsset(chapter);
}

export { buildWordIndex };

export const mockWordIndex = buildWordIndex(mockChapter);

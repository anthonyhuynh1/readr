import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getCuratedBookLinks } from '../config/curatedBookLinks';
import { canReadBook } from '../services/content/repository';
import type { Book } from '../types';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function useOpenBook() {
  const navigation = useNavigation<Nav>();

  return (book: Pick<Book, 'slug' | 'title' | 'author' | 'standardEbooksUrl'>) => {
    if (canReadBook(book.slug)) {
      navigation.navigate('Read', { bookSlug: book.slug });
      return;
    }

    const curated = getCuratedBookLinks(book.slug);
    navigation.navigate('ReadUnavailable', {
      bookSlug: book.slug,
      title: book.title,
      author: book.author,
      standardEbooksUrl: book.standardEbooksUrl || curated?.standardEbooksUrl,
      openLibraryUrl: curated?.openLibraryUrl,
    });
  };
}

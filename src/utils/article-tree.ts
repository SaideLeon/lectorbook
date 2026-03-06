import { Article } from '@/types';

export function groupArticlesBySource(articles: Article[]) {
  return articles.reduce<Record<string, Article[]>>((acc, article) => {
    const source = article.source || 'Outros';
    if (!acc[source]) acc[source] = [];
    acc[source].push(article);
    return acc;
  }, {});
}

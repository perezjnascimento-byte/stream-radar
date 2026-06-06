import { Movie } from '../types';

const TMDB_GENRES: Record<number, string> = {
  28: 'Ação',
  12: 'Aventura',
  16: 'Animação',
  35: 'Comédia',
  80: 'Crime',
  99: 'Documentário',
  18: 'Drama',
  10751: 'Família',
  14: 'Fantasia',
  36: 'História',
  27: 'Terror',
  10402: 'Música',
  9648: 'Mistério',
  10749: 'Romance',
  878: 'Ficção Científica',
  10770: 'Cinema TV',
  53: 'Suspense',
  10752: 'Guerra',
  37: 'Faroeste'
};

function getPlotCategory(genreIds: number[]): Movie['plotCategory'] {
  if (!genreIds || genreIds.length === 0) return 'Outros';
  
  if (genreIds.includes(878)) return 'Ficção Científica';
  if (genreIds.includes(27)) return 'Terror';
  if (genreIds.includes(53) || genreIds.includes(9648) || genreIds.includes(80)) return 'Suspense';
  if (genreIds.includes(14)) return 'Fantasia';
  if (genreIds.includes(35)) return 'Comédia';
  if (genreIds.includes(10749)) return 'Romance';
  if (genreIds.includes(28) || genreIds.includes(12) || genreIds.includes(37) || genreIds.includes(10752)) return 'Ação';
  if (genreIds.includes(18) || genreIds.includes(99) || genreIds.includes(36)) return 'Drama';
  
  return 'Outros';
}

function getMoviePlatforms(popularity: number): string[] {
  // Distribute platforms deterministically or randomly based on popularity
  const platforms = ['Netflix', 'Prime Video', 'Max', 'Disney+', 'Apple TV+'];
  const index1 = Math.floor(popularity) % platforms.length;
  const index2 = (index1 + 2) % platforms.length;
  
  if (popularity > 150) {
    return [platforms[index1], platforms[index2]];
  } else if (popularity > 50) {
    return [platforms[index1]];
  } else {
    return ['Cinema'];
  }
}

export async function fetchMovieCredits(movieId: number, apiKey: string): Promise<{ director: string; cast: string[] }> {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${apiKey}&language=pt-BR`);
    if (!res.ok) throw new Error('Falha ao buscar créditos');
    const data = await res.json();
    
    const directorObj = data.crew?.find((c: any) => c.job === 'Director');
    const director = directorObj ? directorObj.name : 'Não informado';
    const cast = (data.cast || []).slice(0, 4).map((c: any) => c.name);
    
    return { director, cast };
  } catch (error) {
    console.warn(`Erro ao buscar créditos para o filme ${movieId}:`, error);
    return { director: 'Não informado', cast: [] };
  }
}

export async function fetchTrendingOrDiscover(apiKey: string): Promise<Movie[]> {
  if (!apiKey) {
    throw new Error('Chave de API do TMDB não configurada.');
  }

  // Fetch popular or trending sci-fi/drama movies
  // Genres: 878 (Sci-Fi), 18 (Drama)
  const url = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=pt-BR&sort_by=popularity.desc&with_genres=878,18&vote_count.gte=100`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Erro na resposta do TMDB ao buscar descobertas.');
  }

  const data = await res.json();
  const results = data.results || [];

  // Fetch credits in parallel for the top 8 results
  const topResults = results.slice(0, 8);
  const movies = await Promise.all(topResults.map(async (item: any): Promise<Movie> => {
    const credits = await fetchMovieCredits(item.id, apiKey);
    const genres = (item.genre_ids || []).map((id: number) => TMDB_GENRES[id] || 'Outros').filter((g: string) => g !== 'Outros');
    const posterUrl = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined;
    
    return {
      id: `tmdb-${item.id}`,
      title: item.title,
      originalTitle: item.original_title,
      type: 'Filme',
      year: item.release_date ? new Date(item.release_date).getFullYear() : 2026,
      genres: genres.length > 0 ? genres : ['Drama'],
      director: credits.director,
      cast: credits.cast,
      platforms: getMoviePlatforms(item.popularity || 0),
      plotType: item.overview ? item.overview.slice(0, 100) + '...' : 'Trama não detalhada.',
      plotCategory: getPlotCategory(item.genre_ids),
      similarIds: [],
      synopsis: item.overview || 'Sinopse indisponível.',
      posterUrl // custom property used by getStablePosterUrl
    } as any; // Cast as any because posterUrl is an extra field
  }));

  return movies;
}

export async function searchMoviesTMDB(query: string, apiKey: string): Promise<Movie[]> {
  if (!apiKey) {
    throw new Error('Chave de API do TMDB não configurada.');
  }

  const url = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=pt-BR`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Erro na resposta do TMDB ao buscar filmes.');
  }

  const data = await res.json();
  const results = data.results || [];

  // Fetch credits in parallel for the top 6 results
  const topResults = results.slice(0, 6);
  const movies = await Promise.all(topResults.map(async (item: any): Promise<Movie> => {
    const credits = await fetchMovieCredits(item.id, apiKey);
    const genres = (item.genre_ids || []).map((id: number) => TMDB_GENRES[id] || 'Outros').filter((g: string) => g !== 'Outros');
    const posterUrl = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined;
    
    return {
      id: `tmdb-${item.id}`,
      title: item.title,
      originalTitle: item.original_title,
      type: 'Filme',
      year: item.release_date ? new Date(item.release_date).getFullYear() : 2026,
      genres: genres.length > 0 ? genres : ['Drama'],
      director: credits.director,
      cast: credits.cast,
      platforms: getMoviePlatforms(item.popularity || 0),
      plotType: item.overview ? item.overview.slice(0, 100) + '...' : 'Trama não detalhada.',
      plotCategory: getPlotCategory(item.genre_ids),
      similarIds: [],
      synopsis: item.overview || 'Sinopse indisponível.',
      posterUrl
    } as any;
  }));

  return movies;
}

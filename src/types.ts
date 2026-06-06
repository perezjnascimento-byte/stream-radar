export interface Movie {
  id: string;
  title: string;
  originalTitle?: string;
  type: 'Filme' | 'Série';
  year: number;
  genres: string[];
  director: string;
  cast: string[];
  platforms: string[];
  plotType: string; // Trope/Description style of plot, e.g. "Quebra-cabeça existencial", "Mistério psicológico"
  plotCategory: 'Ação' | 'Drama' | 'Comédia' | 'Ficção Científica' | 'Suspense' | 'Fantasia' | 'Romance' | 'Terror' | 'Outros';
  similarIds: string[]; // List of IDs in dataset which are highly similar/style matches
  synopsis: string;
  posterUrl?: string; // Optional property containing constructed TMDB poster URL
}


export interface UserRating {
  movieId: string;
  watched: boolean;
  liked?: 'love' | 'like' | 'ok' | 'dislike'; // Love, Like, Neutral OK, Dislike ratings
  dontRemember?: boolean; // Indicates if the user forgot details of this cinematic work
  actingScore?: number; // 1 to 5 scale
  scriptScore?: number; // 1 to 5 scale
  visualScore?: number; // 1 to 5 scale
  notWatched?: boolean; // Marcou como "Não Assistido"
  noInterest?: boolean; // Marcou como "Sem Interesse"
  watchProgress?: 'complete' | 'stopped_middle' | 'watching'; // Progresso de consumo do filme/série
  vibeTags?: string[]; // Custom aesthetic/vibe tags selected by the user
}

export interface LocalStats {
  totalWatched: number;
  totalWatchlist: number;
  likesCount: number;
  dislikesCount: number;
  lovesCount: number;
  oksCount: number; // For movies marked as "Achei OK"
  genresDistribution: { name: string; count: number; percentage: number }[];
  directorsDistribution: { name: string; count: number }[];
  actorsDistribution: { name: string; count: number }[];
  plotsDistribution: { name: string; count: number }[];
  categoriesBreakdown: { category: string; matchScore: number; count: number }[];
  averageAspects: {
    acting: number;
    script: number;
    visual: number;
    totalRatedCount: number;
  };
}

export interface RecommendRequest {
  ratings: UserRating[];
  favorites: string[];
}

export interface AIRecommendation {
  title: string;
  year: number;
  type: 'Filme' | 'Série';
  genres: string[];
  director: string;
  cast: string[];
  whereToWatch: string[];
  matchPercentage: number;
  reasonForSuggestion: string;
  plotCategory: string;
}

export interface AISpectatorProfile {
  archetypeName: string; // E.g., "O Explorador de Labirintos Mentais"
  archetypeDescription: string;
  psychologicalAssessment: string; // Paragraph describing the narrative elements they love
  narrativeThemesInCommon: string[]; // 3-4 common narrative patterns
  statisticsSummary: {
    dominantGenre: string;
    preferredPacing: string; // e.g. "Rápido/Eletrizante", "Lento e Contemplativo", "Densidade Psicológica"
    thematicFocus: string; // e.g. "Existencialismo, Identidade e Conspiração"
  };
  genreBreakdownDetails: {
    genre: string;
    analysis: string; // Why they like it, common aspects
  }[];
  customRecommendations: AIRecommendation[];
}

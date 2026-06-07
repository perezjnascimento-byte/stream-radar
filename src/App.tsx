import React, { useState, useMemo, useEffect } from 'react';
import { 
  Film, 
  Sparkles, 
  Heart, 
  ThumbsUp,
  ThumbsDown,
  Search, 
  Check, 
  Tv, 
  User, 
  Smile, 
  Loader2, 
  ExternalLink, 
  Bookmark, 
  Activity, 
  MessageSquare,
  Sparkle,
  Layers,
  Flame,
  Info,
  Compass,
  AlertCircle,
  Star,
  Folder,
  FolderHeart,
  Plus,
  Trash2,
  ChevronRight,
  Eye,
  EyeOff,
  HelpCircle,
  X,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { moviesDatabase } from './data/movies';
import { standbyMoviesPool } from './data/standby';
import { Movie, UserRating, LocalStats, AISpectatorProfile, AIRecommendation } from './types';
import { fetchTrendingOrDiscover, searchMoviesTMDB, fetchMovieKeywords } from './services/tmdb';
import { signIn, signUp, logOut, onAuthStateChange, getUserDoc, saveUserDoc, resetPassword } from './services/firebase';
import { GoogleGenerativeAI } from '@google/generative-ai';


// Predefined hot suggestion capsules for users to instantly look up movies globally using Gemini
const POPULAR_IA_SUGGESTIONS = [
  "Interestelar",
  "A Origem",
  "O Poderoso Chefão",
  "Tudo em Todo o Lugar ao Mesmo Tempo",
  "Gladiador 2",
  "Succession",
  "Breaking Bad",
  "Duna: Parte Dois",
  "O Menino e a Garça",
  "Ilha do Medo"
];

const progressOptions = [
  { value: 'complete', label: 'Assisti Tudo', emoji: '🍿' },
  { value: 'stopped_middle', label: 'Pelo Meio / Abandonei', emoji: '⏸' },
  { value: 'watching', label: 'Assistindo', emoji: '👀' },
];

const vibeTagsList = [
  { name: 'Tenso', emoji: '😰' },
  { name: 'Melancólico', emoji: '😢' },
  { name: 'Explosivo', emoji: '💥' },
  { name: 'Reflexivo', emoji: '🧠' },
  { name: 'Nostálgico', emoji: '📼' },
  { name: 'Cerebral', emoji: '🧬' },
];

const getStableBackdropUrl = (movieItem: Movie) => {
  const titleLower = (movieItem.title || '').toLowerCase().trim();
  
  // High-quality cinematic landscape backdrops
  const backdrops: Record<string, string> = {
    'interestelar': 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=1200&auto=format&fit=crop',
    'interstellar': 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=1200&auto=format&fit=crop',
    'breaking bad': 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1200&auto=format&fit=crop',
    'ruptura': 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop',
    'severance-season-two': 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop',
    'matrix': 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1200&auto=format&fit=crop',
    'stranger things': 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop',
    'tropa de elite': 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?q=80&w=1200&auto=format&fit=crop',
    'duna: profecia': 'https://images.unsplash.com/photo-1547234935-80c7145ec969?q=80&w=1200&auto=format&fit=crop',
    'blade runner: o caçador de replicantes': 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1200&auto=format&fit=crop',
  };

  if (backdrops[titleLower]) return backdrops[titleLower];

  // Dynamic fallback landscape vectors based on category
  switch (movieItem.plotCategory) {
    case 'Ficção Científica':
      return 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&auto=format&fit=crop';
    case 'Ação':
      return 'https://images.unsplash.com/photo-1533928298208-27ff66555d8d?q=80&w=1200&auto=format&fit=crop';
    case 'Drama':
      return 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop';
    case 'Suspense':
      return 'https://images.unsplash.com/photo-1505673542670-a5e3ff5b14a3?q=80&w=1200&auto=format&fit=crop';
    case 'Terror':
      return 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?q=80&w=1200&auto=format&fit=crop';
    case 'Fantasia':
      return 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=1200&auto=format&fit=crop';
    case 'Comédia':
      return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1200&auto=format&fit=crop';
    case 'Romance':
      return 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=1200&auto=format&fit=crop';
    default:
      return 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1200&auto=format&fit=crop';
  }
};

export default function App() {
  const [ratings, setRatings] = useState<UserRating[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [customMovies, setCustomMovies] = useState<Movie[]>([]);
  const [aiProfile, setAiProfile] = useState<AISpectatorProfile | null>(null);
  const [platformMovies, setPlatformMovies] = useState<Movie[]>([]);

  // Firebase Auth state listener
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false);
  const [isSyncingFromFirestore, setIsSyncingFromFirestore] = useState(false);

  // Login / Register state variables
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authFormLoading, setAuthFormLoading] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  // Onboarding state variables
  const [onboardingMovies, setOnboardingMovies] = useState<Movie[]>([]);
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  // AI Profile generation
  const [isGeneratingAIProfile, setIsGeneratingAIProfile] = useState(false);

  // Listen to Auth State Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        console.log("🔐 Auth: User logged in/registered", currentUser.uid);
        setIsSyncingFromFirestore(true);
        try {
          const docData = await getUserDoc(currentUser.uid);
          if (docData) {
            setRatings(docData.ratedMovies || docData.ratings || []);
            setFavorites(docData.favorites || []);
            setWatchlist(docData.watchlist || []);
            setCustomMovies(docData.customMovies || []);
            setAiProfile(docData.aiProfile || null);
            setHasCompletedOnboarding(docData.hasCompletedOnboarding || false);
            console.log("🚦 Routing: hasCompletedOnboarding is", docData.hasCompletedOnboarding);
          } else {
            const initialDoc = {
              uid: currentUser.uid,
              email: currentUser.email,
              hasCompletedOnboarding: false,
              ratedMovies: [],
              favorites: [],
              watchlist: [],
              customMovies: [],
              aiProfile: null
            };
            await saveUserDoc(currentUser.uid, initialDoc);
            setRatings([]);
            setFavorites([]);
            setWatchlist([]);
            setCustomMovies([]);
            setAiProfile(null);
            setHasCompletedOnboarding(false);
            console.log("🚦 Routing: hasCompletedOnboarding is", false);
          }
        } catch (error) {
          console.error("Erro ao carregar dados do usuário do Firestore:", error);
        } finally {
          setIsSyncingFromFirestore(false);
        }
      } else {
        setRatings([]);
        setFavorites([]);
        setWatchlist([]);
        setCustomMovies([]);
        setAiProfile(null);
        setHasCompletedOnboarding(false);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Auth form submit handler
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthFormLoading(true);

    if (isRegister) {
      if (password !== confirmPassword) {
        setAuthError("As senhas não coincidem.");
        setAuthFormLoading(false);
        return;
      }
      if (password.length < 6) {
        setAuthError("A senha deve ter pelo menos 6 caracteres.");
        setAuthFormLoading(false);
        return;
      }
    }

    try {
      if (isRegister) {
        await signUp(email, password);
        triggerGlobalToast("Conta criada com sucesso!", "success");
      } else {
        await signIn(email, password);
        triggerGlobalToast("Bem-vindo de volta!", "success");
      }
    } catch (err: any) {
      console.error("Firebase API Auth Failure:", err);
      setAuthError(err.message || "Ocorreu um erro na autenticação.");
    } finally {
      setAuthFormLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthFormLoading(true);
    try {
      await resetPassword(email);
      triggerGlobalToast("Link de recuperação enviado para o seu e-mail", "success");
      setIsForgotPassword(false);
    } catch (err: any) {
      console.error("Password reset failure:", err);
      setAuthError(err.message || "Ocorreu um erro na recuperação de senha.");
    } finally {
      setAuthFormLoading(false);
    }
  };

  const gatherUserCinematicDNA = async (currentRatings: UserRating[], currentAllMovies: Movie[]) => {
    const positiveRatings = currentRatings.filter(r => r.liked === 'love' || r.liked === 'like');
    const topRatings = positiveRatings.slice(0, 10);
    
    const tmdbApiKey = import.meta.env.VITE_TMDB_API_KEY;
    let combinedDNA = [];
    
    for (const r of topRatings) {
      const movie = currentAllMovies.find(m => m.id === r.movieId);
      if (!movie) continue;
      
      let keywords: string[] = [];
      if (movie.id.startsWith('tmdb-') && tmdbApiKey && tmdbApiKey !== "SUA_CHAVE_AQUI" && tmdbApiKey.trim() !== "") {
        const tmdbId = parseInt(movie.id.replace('tmdb-', ''));
        if (!isNaN(tmdbId)) {
          keywords = await fetchMovieKeywords(tmdbId, tmdbApiKey);
        }
      }
      
      combinedDNA.push(`Title: ${movie.title}, Year: ${movie.year}, Genres: ${movie.genres.join(', ')}, Keywords: ${keywords.slice(0, 5).join(', ')}`);
    }
    
    return combinedDNA.join(' | ');
  };

  const generateCognitiveProfile = async (cinematicDNA: string) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Chave de API do Gemini (VITE_GEMINI_API_KEY) não configurada no ambiente.");
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `You are an expert film curator and psychological analyst. Analyze this list of movie metadata/keywords heavily favored by a user: ${cinematicDNA}. 
Do not just look at genres. Find the underlying narrative, aesthetic, and emotional connecting thread (fio condutor). 
Return ONLY a valid JSON object with the following structure:
{
  "archetypeTitle": "A creative, sophisticated title (e.g., 'O Viajante de Distopias Melancólicas')",
  "connectingThread": "A short, deep 2-sentence explanation of what really connects their taste (e.g., aesthetic, pacing, themes).",
  "dominantVibe": "1-3 words describing the mood",
  "nextRecommendationPrompt": "A highly specific search query string to find their next favorite movie."
}
Return ONLY raw JSON. Do not use markdown formatting or code blocks.`;

    try {
      const result = await model.generateContent(prompt);
      const rawText = result.response.text();
      const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleanedText);
    } catch (error) {
      console.error("Gemini Raw Error:", error);
      return { 
        archetypeTitle: "O Analista em Calibração", 
        connectingThread: "Nosso motor de IA está calibrando suas escolhas. Continue avaliando.", 
        dominantVibe: "Processando",
        nextRecommendationPrompt: "filmes aclamados"
      };
    }
  };

  const handleGenerateCognitiveProfile = async () => {
    setIsGeneratingAIProfile(true);
    try {
      const dna = await gatherUserCinematicDNA(ratings, allMovies);
      if (!dna) {
        throw new Error("Sem dados suficientes para análise.");
      }
      const profile = await generateCognitiveProfile(dna);
      
      setAiProfile({
        archetypeName: profile.archetypeTitle,
        archetypeDescription: profile.connectingThread,
        psychologicalAssessment: profile.connectingThread,
        narrativeThemesInCommon: [profile.dominantVibe],
        statisticsSummary: {
          dominantGenre: 'Análise Direcionada por IA',
          preferredPacing: profile.dominantVibe,
          thematicFocus: profile.nextRecommendationPrompt
        },
        genreBreakdownDetails: [],
        customRecommendations: []
      });
      triggerGlobalToast("Mapeamento atualizado com sucesso!", "success");
    } catch (e: any) {
      console.error(e);
      triggerGlobalToast(e.message || "Erro ao gerar perfil cognitivo pela IA.", "error");
    } finally {
      setIsGeneratingAIProfile(false);
    }
  };


  // Fetch onboarding movies
  useEffect(() => {
    if (user && !hasCompletedOnboarding) {
      const loadOnboardingMovies = async () => {
        setOnboardingLoading(true);
        const apiKey = import.meta.env.VITE_TMDB_API_KEY;
        if (apiKey && apiKey !== "SUA_CHAVE_AQUI" && apiKey.trim() !== "") {
          try {
            const res = await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=pt-BR&sort_by=popularity.desc&vote_count.gte=200`);
            if (res.ok) {
              const data = await res.json();
              const results = data.results || [];
              // ── POSTER GATEKEEPER ──
              const withPoster = results.filter(
                (item: any) => item.poster_path !== null && item.poster_path !== undefined && item.poster_path !== ''
              );
              const top12 = withPoster.slice(0, 12);
              const processed = await Promise.all(top12.map(async (item: any): Promise<Movie> => {
                return {
                  id: `tmdb-${item.id}`,
                  title: item.title,
                  originalTitle: item.original_title,
                  type: 'Filme',
                  year: item.release_date ? new Date(item.release_date).getFullYear() : 2026,
                  genres: ['Drama'],
                  director: 'TMDB',
                  cast: [],
                  platforms: ['Netflix'],
                  plotType: item.overview ? item.overview.slice(0, 100) + '...' : 'Trama não detalhada.',
                  plotCategory: 'Drama',
                  similarIds: [],
                  synopsis: item.overview || 'Sinopse indisponível.',
                  posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined
                } as any;
              }));
              setOnboardingMovies(processed);
              setOnboardingLoading(false);
              return;
            }
          } catch (e) {
            console.error("Erro ao carregar onboarding TMDB:", e);
          }
        }

        // Fallback to local movies
        setOnboardingMovies(moviesDatabase.slice(0, 12));
        setOnboardingLoading(false);
      };
      loadOnboardingMovies();
    }
  }, [user, hasCompletedOnboarding]);

  // Current active viewport tab (Apple-style navigation)
  const [activeTab, setActiveTab] = useState<'catalog' | 'watchlist' | 'history' | 'analytics'>('catalog');
  const [historySubTab, setHistorySubTab] = useState<'watched' | 'notWatched' | 'noInterest' | 'favorites'>('watched');

  // Filtering states for main grid
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [activePlatformFilter, setActivePlatformFilter] = useState<string>('all');
  const [isPlatformLoading, setIsPlatformLoading] = useState(false);
  const [catalogLimit, setCatalogLimit] = useState<number>(12);


  // Global Search online state via AI
  const [onlineSearchQuery, setOnlineSearchQuery] = useState('');
  const [onlineSearchLoading, setOnlineSearchLoading] = useState(false);
  const [onlineSearchResult, setOnlineSearchResult] = useState<Movie[] | null>(null);
  const [onlineSearchError, setOnlineSearchError] = useState<string | null>(null);

  // Debounced TMDB live search results (separate from manual AI search)
  const [tmdbSearchResults, setTmdbSearchResults] = useState<Movie[] | null>(null);
  const [tmdbSearchLoading, setTmdbSearchLoading] = useState(false);
  const debounceTimerRef = React.useRef<any>(null);

  // Focus modal detailed view
  const [focusedMovie, setFocusedMovie] = useState<Movie | null>(null);

  const updateMovieRatingDetails = (movieId: string, updates: Partial<UserRating>) => {
    setRatings(prev => {
      const existing = prev.find(r => r.movieId === movieId);
      if (existing) {
        return prev.map(r => r.movieId === movieId ? { 
          ...r, 
          ...updates, 
          watched: updates.watchProgress !== undefined ? (updates.watchProgress === 'complete') : r.watched 
        } : r);
      } else {
        const newRating: UserRating = {
          movieId,
          watched: updates.watchProgress !== undefined ? (updates.watchProgress === 'complete') : false,
          ...updates
        };
        return [...prev, newRating];
      }
    });
  };

  // Accordion toggle states for detail score metrics (movieId -> boolean)
  const [expandedScores, setExpandedScores] = useState<Record<string, boolean>>({});

  // Manual Custom Movie Form state
  const [showAddCustomForm, setShowAddCustomForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');

  // Automatic replenishment states
  const [autoReplenishCount, setAutoReplenishCount] = useState(0);
  const [lastReplenishedNames, setLastReplenishedNames] = useState<string[]>([]);
  const [showReplenishToast, setShowReplenishToast] = useState(false);
  const [formOriginalTitle, setFormOriginalTitle] = useState('');

  // Global snackbar toast state to replace blocked window.alert dialogs
  const [globalToast, setGlobalToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const toastTimeoutRef = React.useRef<any>(null);

  // Ref and helper for the Radar de Descobertas carousel navigation
  const discoveryCarouselRef = React.useRef<HTMLDivElement>(null);
  const scrollDiscoveryCarousel = (direction: 'left' | 'right') => {
    if (discoveryCarouselRef.current) {
      const scrollAmount = direction === 'left' ? -350 : 350;
      discoveryCarouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // State to manage the active selection in the "Radar de Descobertas" carousel
  const [discoveryCarouselMovies, setDiscoveryCarouselMovies] = useState<Movie[]>([]);
  const [isReplenishingDiscovery, setIsReplenishingDiscovery] = useState(false);

  const triggerGlobalToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setGlobalToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setGlobalToast(null);
      toastTimeoutRef.current = null;
    }, 4500);
  };
  const [formType, setFormType] = useState<'Filme' | 'Série'>('Filme');
  const [formYear, setFormYear] = useState<number>(2026);
  const [formCategory, setFormCategory] = useState<string>('Drama');
  const [formGenresText, setFormGenresText] = useState('');
  const [formDirector, setFormDirector] = useState('');
  const [formCastText, setFormCastText] = useState('');
  const [formPlatformsText, setFormPlatformsText] = useState('Netflix');
  const [formSynopsis, setFormSynopsis] = useState('');

  // AI loading progressive states
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [aiError, setAiError] = useState<string | null>(null);

  // Unify seeded movies & dynamically pulled AI/custom titles
  const allMovies = useMemo(() => {
    // Prevent duplicated items based on title / id comparison
    const unified = [...moviesDatabase];
    customMovies.forEach(custom => {
      if (!unified.some(m => m.id === custom.id || m.title.toLowerCase().trim() === custom.title.toLowerCase().trim())) {
        unified.push(custom);
      }
    });
    return unified;
  }, [customMovies]);

  // Filter out any movie that has been answered (either watched, not watched, marked with no interest, or in watchlist)
  const unansweredMovies = useMemo(() => {
    return allMovies.filter(movie => {
      if (watchlist.includes(movie.id)) return false;
      const rating = ratings.find(r => r.movieId === movie.id);
      if (rating) return false;
      return true;
    });
  }, [allMovies, ratings, watchlist]);

  // Dynamic Cinéfilo volume consumption type profile (alto, médio, baixo)
  const cinefiloProfile = useMemo(() => {
    const watchedCount = ratings.filter(r => r.watched).length;
    let category: 'baixo' | 'médio' | 'alto' = 'baixo';
    let title = 'Cinéfilo Iniciante (Consumo Baixo)';
    let emoji = '🌱🎬';
    let color = 'from-emerald-500 to-teal-600';
    let textColor = 'text-emerald-400';
    let description = 'Você consome produções de maneira seletiva e pontual. Prefere saborear cada obra pausadamente e valoriza seu tempo livre de forma focada.';
    
    if (watchedCount >= 15) {
      category = 'alto';
      title = 'Cinéfilo Hardcore / Maratonador Lendário (Consumo Alto)';
      emoji = '⚡🔥🏆';
      color = 'from-red-500 via-purple-650 to-indigo-600';
      textColor = 'text-red-400';
      description = 'Gabaritado! Você devora séries inteiras e assiste a múltiplos filmes por semana. Seu repertório é extremamente robusto e os amigos certamente pedem várias indicações de títulos a você.';
    } else if (watchedCount >= 5) {
      category = 'médio';
      title = 'Entusiasta Cinéfilo Espectador Regular (Consumo Médio)';
      emoji = '🍿📺✨';
      color = 'from-amber-500 to-indigo-600';
      textColor = 'text-amber-400';
      description = 'Você consome produções com ótima frequência. Consegue acompanhar os principais lançamentos da cultura pop e equilibrar os grandes clássicos mantendo um ritmo constante.';
    }
    
    return {
      watchedCount,
      category,
      title,
      emoji,
      color,
      textColor,
      description
    };
  }, [ratings]);

  // Synchronize dynamic states with localStorage and Firestore safely
  useEffect(() => {
    if (user && !isSyncingFromFirestore) {
      saveUserDoc(user.uid, {
        ratedMovies: ratings,
        ratings,
        favorites,
        watchlist,
        customMovies,
        aiProfile,
        hasCompletedOnboarding
      }).then(() => {
        if (hasCompletedOnboarding) {
          console.log("☁️ Firestore: Onboarding completed & saved for", user.email);
        }
      }).catch(err => {
        console.error("Erro ao salvar dados no Firestore:", err);
      });
    } else if (!user) {
      localStorage.setItem('cineperfil_ratings', JSON.stringify(ratings));
      localStorage.setItem('cineperfil_favorites', JSON.stringify(favorites));
      localStorage.setItem('cineperfil_watchlist', JSON.stringify(watchlist));
      localStorage.setItem('cineperfil_custom_movies', JSON.stringify(customMovies));
      localStorage.setItem('cineperfil_ai_profile', JSON.stringify(aiProfile));
    }
  }, [ratings, favorites, watchlist, customMovies, aiProfile, hasCompletedOnboarding, user, isSyncingFromFirestore]);

  // Load additional movies from the standby pool when unansweredMovies list starts going empty (never empty rule)
  useEffect(() => {
    if (unansweredMovies.length < 5) {
      // Find movies from standbyMoviesPool that aren't already included in allMovies
      // and whose titles are not already rated or reviewed by the user
      const unusedStandby = standbyMoviesPool.filter(standby => {
        const alreadyInCatalog = allMovies.some(m => m.id === standby.id || m.title.toLowerCase().trim() === standby.title.toLowerCase().trim());
        const alreadyRated = ratings.some(r => r.movieId === standby.id);
        return !alreadyInCatalog && !alreadyRated;
      });

      if (unusedStandby.length > 0) {
        // Grab the next 8 movies of unused standby
        const nextBatch = unusedStandby.slice(0, 8);
        setCustomMovies(prev => {
          // Check for duplication one more time
          const filteredBatch = nextBatch.filter(nb => !prev.some(p => p.id === nb.id || p.title.toLowerCase().trim() === nb.title.toLowerCase().trim()));
          if (filteredBatch.length === 0) return prev;
          
          setLastReplenishedNames(filteredBatch.map(m => m.title));
          setAutoReplenishCount(c => c + filteredBatch.length);
          setShowReplenishToast(true);
          return [...prev, ...filteredBatch];
        });
      } else {
        // Backup Real Classic Generator: if standby pool is completely empty, use real famous movies/series as a fallback to avoid fake titles
        const realBackupPool: Movie[] = [
          {
            id: "inception-backup",
            title: "A Origem",
            originalTitle: "Inception",
            type: "Filme",
            year: 2010,
            genres: ["Sci-Fi", "Ação", "Suspense"],
            director: "Christopher Nolan",
            cast: ["Leonardo DiCaprio", "Joseph Gordon-Levitt", "Elliot Page", "Tom Hardy"],
            platforms: ["Max", "Prime Video"],
            plotType: "Espionagem industrial dentro de sonhos compartilhados, camadas de subconsciente e realidade duvidosa",
            plotCategory: "Ficção Científica",
            similarIds: ["matrix", "shutter-island"],
            synopsis: "Um ladrão que rouba segredos corporativos por meio do uso de tecnologia de compartilhamento de sonhos tem a chance de limpar seu histórico se conseguir realizar a tarefa quase impossível de inserção de uma ideia."
          },
          {
            id: "titanic-backup",
            title: "Titanic",
            originalTitle: "Titanic",
            type: "Filme",
            year: 1997,
            genres: ["Drama", "Romance"],
            director: "James Cameron",
            cast: ["Leonardo DiCaprio", "Kate Winslet", "Billy Zane", "Kathy Bates"],
            platforms: ["Disney+"],
            plotType: "Romance proibido de classes sociais distintas a bordo de transatlântico trágico",
            plotCategory: "Romance",
            similarIds: ["avatar", "la-la-land"],
            synopsis: "Um jovem artista humilde e uma rica aristocrata se apaixonam loucamente a bordo do luxuoso e azarado navio de passageiros R.M.S. Titanic, que colide tragicamente contra um iceberg."
          },
          {
            id: "matrix-backup",
            title: "Matrix",
            originalTitle: "The Matrix",
            type: "Filme",
            year: 1999,
            genres: ["Sci-Fi", "Ação"],
            director: "Lana Wachowski",
            cast: ["Keanu Reeves", "Laurence Fishburne", "Carrie-Anne Moss", "Hugo Weaving"],
            platforms: ["Max", "Prime Video"],
            plotType: "Despertar revolucionário de simulação neural cibernética, acrobacias kung-fu sob capas pretas e código neon",
            plotCategory: "Ficção Científica",
            similarIds: ["inception", "blade-runner-1982"],
            synopsis: "Um jovem programador de computador é levado a uma rebelião clandestina contra os computadores cibernéticos que mantêm a humanidade prisioneira em uma realidade simulada."
          },
          {
            id: "dark-knight-backup",
            title: "Batman: O Cavaleiro das Trevas",
            originalTitle: "The Dark Knight",
            type: "Filme",
            year: 2008,
            genres: ["Ação", "Crime", "Drama"],
            director: "Christopher Nolan",
            cast: ["Christian Bale", "Heath Ledger", "Aaron Eckhart", "Maggie Gyllenhaal"],
            platforms: ["Max"],
            plotType: "Guerra psicológica urbana de terror moral travada pelo Coringa contra o homem-morcego em Gotham",
            plotCategory: "Ação",
            similarIds: ["joker-2019", "se7en-1995"],
            synopsis: "Com a ajuda do tenente Jim Gordon e do promotor Harvey Dent, Batman mantém a ordem em Gotham até que o sádico anarquista Coringa instala o caos absoluto."
          },
          {
            id: "interstellar-backup",
            title: "Interestelar",
            originalTitle: "Interstellar",
            type: "Filme",
            year: 2014,
            genres: ["Sci-Fi", "Drama", "Aventura"],
            director: "Christopher Nolan",
            cast: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain", "Michael Caine"],
            platforms: ["Max", "Prime Video"],
            plotType: "Exploração de buracos negros, relatividade temporal e amor como força dimensional para salvar a humanidade",
            plotCategory: "Ficção Científica",
            similarIds: ["inception", "arrival-2016"],
            synopsis: "Uma equipe de exploradores espaciais viaja através de um misterioso buraco de minhoca no espaço profundo para garantir a sobrevivência e colonização humana diante da escassez terrestre."
          },
          {
            id: "pulp-fiction-backup",
            title: "Pulp Fiction: Tempo de Violência",
            originalTitle: "Pulp Fiction",
            type: "Filme",
            year: 1994,
            genres: ["Crime", "Drama", "Classic"],
            director: "Quentin Tarantino",
            cast: ["John Travolta", "Samuel L. Jackson", "Uma Thurman", "Bruce Willis"],
            platforms: ["Netflix", "Prime Video"],
            plotType: "Antologia de crimes interligados, debates casuais bizarríssimos de capangas e cronologia fragmentada de Los Angeles",
            plotCategory: "Drama",
            similarIds: ["pulp-fiction-1994", "fight-club-1999"],
            synopsis: "As vidas de dois capangas da máfia, um pugilista pago para perder uma luta, a charmosa esposa de um gangster e um casal de assaltantes de lanchonete se entrelaçam de forma hilária e violenta."
          },
          {
            id: "fight-club-backup",
            title: "Clube da Luta",
            originalTitle: "Fight Club",
            type: "Filme",
            year: 1999,
            genres: ["Drama", "Classic", "Suspense"],
            director: "David Fincher",
            cast: ["Brad Pitt", "Edward Norton", "Helena Bonham Carter"],
            platforms: ["Netflix", "Prime Video"],
            plotType: "Insonia alienante de consumo moderno, anarquia contracultural violenta de subsolo e dupla personalidade perturbada",
            plotCategory: "Suspense",
            similarIds: ["se7en-1995", "memento-2000"],
            synopsis: "Um homem comum de escritório com insônia crônica une-se ao carismático fabricante de sabonetes Tyler Durden para fundar uma rede desordeira de combates clandestinos brutais."
          },
          {
            id: "breaking-bad-backup",
            title: "Breaking Bad",
            originalTitle: "Breaking Bad",
            type: "Série",
            year: 2008,
            genres: ["Drama", "Crime", "Suspense"],
            director: "Vince Gilligan",
            cast: ["Bryan Cranston", "Aaron Paul", "Anna Gunn", "Bob Odenkirk"],
            platforms: ["Netflix"],
            plotType: "Metamorfose moral de professor de química frustrado com câncer em implacável barão de metanfetamina de Albuquerque",
            plotCategory: "Drama",
            similarIds: ["better-call-saul", "succession"],
            synopsis: "Um humilde professor de química de escola secundária descobre que tem câncer pulmonar terminal e monta um laboratório móvel com um ex-aluno para assegurar o futuro financeiro de sua família."
          }
        ];

        const unusedBackup = realBackupPool.filter(backup => {
          const alreadyInCatalog = allMovies.some(m => m.id === backup.id || m.title.toLowerCase().trim() === backup.title.toLowerCase().trim());
          return !alreadyInCatalog;
        });

        const nextBackupBatch = unusedBackup.slice(0, 8);
        if (nextBackupBatch.length > 0) {
          setCustomMovies(prev => {
            setLastReplenishedNames(nextBackupBatch.map(m => m.title));
            setAutoReplenishCount(c => c + nextBackupBatch.length);
            setShowReplenishToast(true);
            return [...prev, ...nextBackupBatch];
          });
        }
      }
    }
  }, [unansweredMovies, allMovies, ratings]);

  // When search query is cleared or very short, reset online search results to keep layout clean,
  // but do not auto-invoke the precious rate-limited AI on keystrokes.
  useEffect(() => {
    if (!onlineSearchQuery || onlineSearchQuery.trim().length < 3) {
      setOnlineSearchResult(null);
      setOnlineSearchError(null);
      setTmdbSearchResults(null);
    }
  }, [onlineSearchQuery]);

  // ── DEBOUNCED TMDB LIVE SEARCH ─────────────────────────────────────────────
  // Fires 500ms after the user stops typing, calls /search/movie, applies the
  // poster gatekeeper, and writes results to tmdbSearchResults.
  useEffect(() => {
    const query = onlineSearchQuery.trim();
    if (query.length < 3) {
      setTmdbSearchResults(null);
      return;
    }

    // Clear previous debounce timer
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      const apiKey = import.meta.env.VITE_TMDB_API_KEY;
      if (!apiKey || apiKey === 'SUA_CHAVE_AQUI' || apiKey.trim() === '') return;

      setTmdbSearchLoading(true);
      try {
        const url = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=pt-BR&include_adult=false`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('TMDB search failed');
        const data = await res.json();
        const results: any[] = data.results || [];

        // ── POSTER GATEKEEPER ──────────────────────────────────────────────
        const withPoster = results.filter(
          (item) => item.poster_path !== null && item.poster_path !== undefined && item.poster_path !== ''
        );

        const mapped: Movie[] = withPoster.slice(0, 12).map((item): Movie => ({
          id: `tmdb-${item.id}`,
          title: item.title,
          originalTitle: item.original_title,
          type: 'Filme',
          year: item.release_date ? new Date(item.release_date).getFullYear() : 2026,
          genres: ['Drama'],
          director: 'Não informado',
          cast: [],
          platforms: ['TMDB'],
          plotType: item.overview ? item.overview.slice(0, 100) + '...' : 'Trama não detalhada.',
          plotCategory: 'Drama',
          similarIds: [],
          synopsis: item.overview || 'Sinopse indisponível.',
          posterUrl: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
        } as any));

        setTmdbSearchResults(mapped.length > 0 ? mapped : null);
        console.log(`🔍 TMDB Debounce: ${mapped.length} resultados com poster para "${query}"`);
      } catch (err) {
        console.warn('Debounce TMDB search error:', err);
        setTmdbSearchResults(null);
      } finally {
        setTmdbSearchLoading(false);
      }
    }, 500);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [onlineSearchQuery]);

  // Reset pagination limit when active platform, type, category or search query changes
  useEffect(() => {
    setCatalogLimit(12);
  }, [activePlatformFilter, selectedType, selectedCategory, onlineSearchQuery]);


  // Immediate real-time local query matching list as the user writes in search
  const localQueryMatches = useMemo(() => {
    const q = onlineSearchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return allMovies.filter(m => 
      m.title.toLowerCase().includes(q) || 
      m.originalTitle?.toLowerCase().includes(q) ||
      m.director.toLowerCase().includes(q) ||
      m.genres.some(g => g.toLowerCase().includes(q))
    ).slice(0, 12);
  }, [onlineSearchQuery, allMovies]);

  const loadingPhrases = [
    "Iniciando decodificação do perfil cinematográfico...",
    "Crawling na história cinematográfica de diretores e elencos...",
    "Calculando métricas de andamentos, ritmos e tropos de roteiro...",
    "Examinando nuances de categorias que mais te prendem de verdade...",
    "Compondo diagnostico cognitivo e mapeando compatibilidades...",
    "Curando títulos perfeitamente sintonizados ao seu estilo..."
  ];

  // Progression step transitions during AI analysis
  useEffect(() => {
    let interval: any;
    if (isLoadingAI) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingPhrases.length);
      }, 3500);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [isLoadingAI]);

  // Handlers for rating mutations
  const registerCustomMovieIfNeeded = (movieItem: Movie | string) => {
    if (typeof movieItem === 'object' && movieItem !== null) {
      const exists = allMovies.some(m => m.id === movieItem.id || m.title.toLowerCase().trim() === movieItem.title.toLowerCase().trim());
      if (!exists) {
        setCustomMovies(prev => {
          if (!prev.some(m => m.id === movieItem.id || m.title.toLowerCase().trim() === movieItem.title.toLowerCase().trim())) {
            return [movieItem, ...prev];
          }
          return prev;
        });
      }
    }
  };

  const handleToggleWatched = (movieItem: Movie | string) => {
    const movieId = typeof movieItem === 'string' ? movieItem : movieItem.id;
    registerCustomMovieIfNeeded(movieItem);

    setRatings(prev => {
      const matchIndex = prev.findIndex(r => r.movieId === movieId);
      if (matchIndex > -1) {
        // Remove watched rating
        const updated = [...prev];
        updated.splice(matchIndex, 1);
        setFavorites(f => f.filter(id => id !== movieId));
        return updated;
      } else {
        // Toggle watched ON
        const newRating: UserRating = {
          movieId,
          watched: true,
          liked: 'like', // default satisfaction reaction
          dontRemember: false,
          actingScore: 4,
          scriptScore: 4,
          visualScore: 4,
          watchProgress: 'complete', // default fully watched status
          notWatched: false,
          noInterest: false
        };
        setFavorites(f => [...new Set([...f, movieId])]);
        setWatchlist(w => w.filter(id => id !== movieId));
        return [...prev, newRating];
      }
    });
  };

  const handleMarkNotWatched = (movieItem: Movie | string) => {
    const movieId = typeof movieItem === 'string' ? movieItem : movieItem.id;
    registerCustomMovieIfNeeded(movieItem);

    setRatings(prev => {
      const matchIndex = prev.findIndex(r => r.movieId === movieId);
      if (matchIndex > -1) {
        const updated = [...prev];
        updated[matchIndex] = { 
          ...updated[matchIndex], 
          notWatched: true,
          watched: false, 
          noInterest: false,
          watchProgress: undefined 
        };
        return updated;
      } else {
        const newRating: UserRating = {
          movieId,
          watched: false,
          notWatched: true,
          noInterest: false
        };
        return [...prev, newRating];
      }
    });
    setWatchlist(w => w.filter(id => id !== movieId));
    setFavorites(f => f.filter(id => id !== movieId));
  };

  const handleMarkNoInterest = (movieItem: Movie | string) => {
    const movieId = typeof movieItem === 'string' ? movieItem : movieItem.id;
    registerCustomMovieIfNeeded(movieItem);

    setRatings(prev => {
      const matchIndex = prev.findIndex(r => r.movieId === movieId);
      if (matchIndex > -1) {
        const updated = [...prev];
        updated[matchIndex] = { 
          ...updated[matchIndex], 
          noInterest: true,
          watched: false,
          notWatched: false,
          watchProgress: undefined 
        };
        return updated;
      } else {
        const newRating: UserRating = {
          movieId,
          watched: false,
          notWatched: false,
          noInterest: true
        };
        return [...prev, newRating];
      }
    });
    setWatchlist(w => w.filter(id => id !== movieId));
    setFavorites(f => f.filter(id => id !== movieId));
  };

  const handleResetFeedback = (movieItem: Movie | string) => {
    const movieId = typeof movieItem === 'string' ? movieItem : movieItem.id;
    setRatings(prev => prev.filter(r => r.movieId !== movieId));
  };

  const handleChangeReaction = (movieItem: Movie | string, liked: 'love' | 'like' | 'ok' | 'dislike') => {
    const movieId = typeof movieItem === 'string' ? movieItem : movieItem.id;
    registerCustomMovieIfNeeded(movieItem);

    setRatings(prev => {
      const matchIndex = prev.findIndex(r => r.movieId === movieId);
      if (matchIndex > -1) {
        const updated = [...prev];
        updated[matchIndex] = { ...updated[matchIndex], liked, watched: true, notWatched: false, noInterest: false };
        
        if (liked === 'dislike' || liked === 'ok') {
          setFavorites(f => f.filter(id => id !== movieId));
        } else {
          setFavorites(f => [...new Set([...f, movieId])]);
        }
        return updated;
      } else {
        const newRating: UserRating = {
          movieId,
          watched: true,
          liked,
          dontRemember: false,
          actingScore: 4,
          scriptScore: 4,
          visualScore: 4,
          watchProgress: 'complete',
          notWatched: false,
          noInterest: false
        };
        if (liked !== 'dislike' && liked !== 'ok') {
          setFavorites(f => [...new Set([...f, movieId])]);
        }
        setWatchlist(w => w.filter(id => id !== movieId));
        return [...prev, newRating];
      }
    });
  };

  const handleUpdateScores = (
    movieItem: Movie | string,
    fields: { dontRemember?: boolean; actingScore?: number; scriptScore?: number; visualScore?: number; watchProgress?: 'complete' | 'stopped_middle' | 'watching' }
  ) => {
    const movieId = typeof movieItem === 'string' ? movieItem : movieItem.id;
    registerCustomMovieIfNeeded(movieItem);

    setRatings(prev => {
      const matchIndex = prev.findIndex(r => r.movieId === movieId);
      if (matchIndex > -1) {
        const updated = [...prev];
        updated[matchIndex] = { ...updated[matchIndex], ...fields };
        return updated;
      } else {
        const newRating: UserRating = {
          movieId,
          watched: true,
          liked: 'like',
          dontRemember: false,
          actingScore: 4,
          scriptScore: 4,
          visualScore: 4,
          watchProgress: 'complete',
          notWatched: false,
          noInterest: false,
          ...fields
        };
        setWatchlist(w => w.filter(id => id !== movieId));
        return [...prev, newRating];
      }
    });
  };

  const handleToggleWatchlist = (movieItem: Movie | string) => {
    const movieId = typeof movieItem === 'string' ? movieItem : movieItem.id;
    registerCustomMovieIfNeeded(movieItem);

    setWatchlist(prev => {
      if (prev.includes(movieId)) {
        return prev.filter(id => id !== movieId);
      } else {
        setRatings(r => r.filter(x => x.movieId !== movieId));
        setFavorites(f => f.filter(id => id !== movieId));
        return [...prev, movieId];
      }
    });
  };

  const handleToggleFavoriteManual = (movieItem: Movie | string) => {
    const movieId = typeof movieItem === 'string' ? movieItem : movieItem.id;
    registerCustomMovieIfNeeded(movieItem);

    setFavorites(prev => {
      if (prev.includes(movieId)) {
        return prev.filter(id => id !== movieId);
      } else {
        const hasRating = ratings.some(r => r.movieId === movieId);
        if (!hasRating) {
          setRatings(r => [...r, { 
            movieId, 
            watched: true, 
            liked: 'love', 
            dontRemember: false, 
            actingScore: 4, 
            scriptScore: 4, 
            visualScore: 4 
          }]);
          setWatchlist(w => w.filter(id => id !== movieId));
        } else {
          setRatings(r => r.map(x => x.movieId === movieId && x.liked === 'dislike' ? { ...x, liked: 'love' } : x));
        }
        return [...prev, movieId];
      }
    });
  };

  // Automated Integration builder for recommendations or external searches
  const handleRegisterExternalMovie = (movie: Omit<Movie, 'id' | 'similarIds'>, relationship?: 'watched' | 'watchlist') => {
    const sanitizedTitle = movie.title.toLowerCase().trim();
    // Locate if it matches any pre-existing or custom movies
    let matchedMovie = allMovies.find(m => m.title.toLowerCase().trim() === sanitizedTitle);
    
    let targetId = matchedMovie?.id;
    if (!matchedMovie) {
      targetId = `ai-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const newRecord: Movie = {
        id: targetId,
        ...movie,
        similarIds: []
      };
      setCustomMovies(prev => [newRecord, ...prev]);
    }

    if (targetId && relationship) {
      if (relationship === 'watched') {
        // ensure to toggle watched on
        setRatings(r => {
          if (!r.some(x => x.movieId === targetId)) {
            return [...r, {
              movieId: targetId!,
              watched: true,
              liked: 'like',
              dontRemember: false,
              actingScore: 4,
              scriptScore: 4,
              visualScore: 4
            }];
          }
          return r;
        });
        setFavorites(favs => [...new Set([...favs, targetId!])]);
        setWatchlist(w => w.filter(id => id !== targetId));
      } else if (relationship === 'watchlist') {
        setWatchlist(prev => [...new Set([...prev, targetId!])]);
        setRatings(r => r.filter(x => x.movieId !== targetId));
      }
    }
    return targetId;
  };

  // Perform backend call to fetch cinematic details from Gemini 3.5 in real-time or search TMDB
  const triggerOnlineMovieSearch = async (queryToSearch?: string) => {
    const targetQuery = queryToSearch || onlineSearchQuery;
    if (!targetQuery || targetQuery.trim().length === 0) {
      setOnlineSearchError('Insira o nome de um filme ou série para pesquisar.');
      return;
    }

    setOnlineSearchLoading(true);
    setOnlineSearchError(null);
    setOnlineSearchResult(null);

    // Try TMDB Search if API key is present
    const tmdbApiKey = import.meta.env.VITE_TMDB_API_KEY;
    if (tmdbApiKey && tmdbApiKey !== "SUA_CHAVE_AQUI" && tmdbApiKey.trim() !== "") {
      try {
        const tmdbMovies = await searchMoviesTMDB(targetQuery, tmdbApiKey);
        
        // Convert items and preserve existing movies if already present
        const moviesWithIds: Movie[] = tmdbMovies.map((item, idx) => {
          const titleSafe = item.title.trim();
          const existing = allMovies.find(m => m.title.toLowerCase().trim() === titleSafe.toLowerCase());
          return existing || item;
        });

        const uniqueResults: Movie[] = [];
        const seenIds = new Set<string>();
        const seenTitles = new Set<string>();
        moviesWithIds.forEach(m => {
          const lowerTitle = m.title.toLowerCase().trim();
          if (!seenIds.has(m.id) && !seenTitles.has(lowerTitle)) {
            seenIds.add(m.id);
            seenTitles.add(lowerTitle);
            uniqueResults.push(m);
          }
        });

        // Register these brand new movies into customMovies immediately!
        setCustomMovies(prev => {
          const nextCustom = [...prev];
          uniqueResults.forEach((m) => {
            if (m.id.startsWith('tmdb-') && !nextCustom.some(x => x.title.toLowerCase().trim() === m.title.toLowerCase().trim())) {
              nextCustom.push(m);
            }
          });
          return nextCustom;
        });

        setOnlineSearchResult(uniqueResults);
        setOnlineSearchLoading(false);
        return;
      } catch (err: any) {
        console.warn("Erro ao buscar no TMDB. Tentando fallback para pesquisa por IA local/servidor:", err);
      }
    }

    try {
      const response = await fetch('/api/search-movie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: targetQuery })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Nenhum resultado retornado.');
      }

      // Convert items to proper Movie objects with ids!
      const moviesWithIds: Movie[] = data.map((item: any, idx: number) => {
        const titleSafe = item.title.trim();
        // Check if there is an existing movie in allMovies
        const existing = allMovies.find(m => m.title.toLowerCase().trim() === titleSafe.toLowerCase());
        if (existing) {
          return existing;
        } else {
          return {
            id: `ai-search-${Date.now()}-${Math.floor(Math.random() * 10000)}-${idx}`,
            ...item,
            similarIds: []
          };
        }
      });

      // Filter duplicates by ID and Title in the search result before pushing!
      const uniqueResults: Movie[] = [];
      const seenIds = new Set<string>();
      const seenTitles = new Set<string>();
      moviesWithIds.forEach(m => {
        const lowerTitle = m.title.toLowerCase().trim();
        if (!seenIds.has(m.id) && !seenTitles.has(lowerTitle)) {
          seenIds.add(m.id);
          seenTitles.add(lowerTitle);
          uniqueResults.push(m);
        }
      });

      // Register these brand new movies into customMovies immediately!
      // This allows them to instantly exist in the system and be rated.
      setCustomMovies(prev => {
        const nextCustom = [...prev];
        uniqueResults.forEach((m: any) => {
          if (m.id.includes('ai-search-') && !nextCustom.some(x => x.title.toLowerCase().trim() === m.title.toLowerCase().trim())) {
            nextCustom.push(m);
          }
        });
        return nextCustom;
      });

      setOnlineSearchResult(uniqueResults);
    } catch (err: any) {
      console.error("Erro na pesquisa inteligente por IA. Ativando busca local de tolerância a falhas:", err);
      
      // Let's perform a local search fallback in our existing database so we don't return an empty screen!
      const normQuery = targetQuery.toLowerCase().trim();
      const localMatches = allMovies.filter(m => {
        return m.title.toLowerCase().includes(normQuery) ||
          (m.originalTitle && m.originalTitle.toLowerCase().includes(normQuery)) ||
          m.director.toLowerCase().includes(normQuery) ||
          m.genres.some(g => g.toLowerCase().includes(normQuery)) ||
          m.cast.some(actor => actor.toLowerCase().includes(normQuery));
      });

      if (localMatches.length > 0) {
        setOnlineSearchResult(localMatches);
        setOnlineSearchError(
          `A busca por inteligência artificial (IA) excedeu temporariamente a cota do plano gratuito da API do Gemini, mas ativamos nossa busca inteligente de tolerância a falhas e encontramos os seguintes ${localMatches.length} título(s) similar(es) em nosso acervo:`
        );
      } else {
        const isQuotaError = !err?.message || err?.message?.includes('quota') || err?.message?.includes('429') || err?.message?.includes('503') || err?.message?.includes('UNAVAILABLE') || err?.message?.includes('demand') || err?.message?.includes('exhausted') || err?.message?.includes('plan');
        if (isQuotaError) {
          setOnlineSearchError(
            'Aviso de Limites da API: O limite de requisições por minuto do plano gratuito do Gemini foi atingido. Ativamos a tolerância local de falhas, mas este termo não possui correspondência direta em nosso acervo offline. Por favor, tente novamente em 15 segundos ou selecione qualquer uma de nossas sugestões rápidas acima para carregar o catálogo de herança.'
          );
        } else {
          setOnlineSearchError(
            err?.message || 'Falha ao buscar dados sobre o filme. Por favor, revise a ortografia do nome e tente buscar novamente.'
          );
        }
      }
    } finally {
      setOnlineSearchLoading(false);
    }
  };

  const handleAddNewCustomMovieManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle) {
      triggerGlobalToast("Por favor, preencha o título.", "error");
      return;
    }

    const cleanedGenres = formGenresText.split(',').map(s => s.trim()).filter(Boolean);
    const cleanedCast = formCastText.split(',').map(s => s.trim()).filter(Boolean);
    const cleanedPlatforms = formPlatformsText.split(',').map(s => s.trim()).filter(Boolean);

    const generatedId = `custom-manual-${Date.now()}`;
    const newRecord: Movie = {
      id: generatedId,
      title: formTitle,
      originalTitle: formOriginalTitle || formTitle,
      type: formType,
      year: Number(formYear) || 2026,
      director: formDirector || "Não Informado",
      genres: cleanedGenres.length > 0 ? cleanedGenres : ["Drama"],
      cast: cleanedCast.length > 0 ? cleanedCast : ["Diversos"],
      platforms: cleanedPlatforms.length > 0 ? cleanedPlatforms : ["Outros"],
      plotType: formSynopsis ? formSynopsis.slice(0, 60) + "..." : "Detalhe personalizado",
      plotCategory: formCategory as any,
      similarIds: [],
      synopsis: formSynopsis || "Nenhuma sinopse fornecida."
    };

    setCustomMovies(prev => [newRecord, ...prev]);
    triggerGlobalToast(`"${formTitle}" foi adicionado com sucesso ao seu acervo recém-criado!`, "success");
    
    // reset form states
    setFormTitle('');
    setFormOriginalTitle('');
    setFormYear(2026);
    setFormDirector('');
    setFormGenresText('');
    setFormCastText('');
    setFormSynopsis('');
    setShowAddCustomForm(false);
  };

  const handleClearData = () => {
    if (window.confirm("Deseja redefinir todo o catálogo e limpar suas avaliações? Isso também apagará os seus filmes personalizados, a lista 'Quero Assistir' e sua análise de IA.")) {
      handleResetAllRatingsForce();
    }
  };

  const handleResetAllRatingsForce = () => {
    setRatings([]);
    setFavorites([]);
    setWatchlist([]);
    setCustomMovies([]);
    setAiProfile(null);
    setOnlineSearchResult(null);
    setOnlineSearchQuery('');
    localStorage.removeItem('cineperfil_ratings');
    localStorage.removeItem('cineperfil_favorites');
    localStorage.removeItem('cineperfil_watchlist');
    localStorage.removeItem('cineperfil_custom_movies');
    localStorage.removeItem('cineperfil_ai_profile');
  };

  // Proximity matches algorithm calculator (client-side matching based on similarity IDs lists)
  const proximityMatches = useMemo(() => {
    const matches: Record<string, { similarTo: string; movieTitle: string }> = {};
    const positiveRatedMovieIds = ratings
      .filter(r => r.watched && (r.liked === 'like' || r.liked === 'love' || r.liked === 'ok'))
      .map(r => r.movieId);

    positiveRatedMovieIds.forEach(id => {
      const dbMovie = allMovies.find(m => m.id === id);
      if (dbMovie && dbMovie.similarIds) {
        dbMovie.similarIds.forEach(simId => {
          const alreadyWatched = ratings.some(r => r.movieId === simId && r.watched);
          const inWatchlist = watchlist.includes(simId);
          if (!alreadyWatched && !inWatchlist) {
            matches[simId] = {
              similarTo: id,
              movieTitle: dbMovie.title
            };
          }
        });
      }
    });
    return matches;
  }, [ratings, watchlist, allMovies]);

  // Compute stats indicators automatically
  const localStats = useMemo<LocalStats>(() => {
    const watchedRatings = ratings.filter(r => r.watched);
    const lovedOrLiked = watchedRatings.filter(r => r.liked === 'love' || r.liked === 'like' || r.liked === 'ok');
    
    const genresMap: Record<string, number> = {};
    const directorsMap: Record<string, number> = {};
    const actorsMap: Record<string, number> = {};
    const plotsList: string[] = [];
    
    const categoryCount: Record<string, { count: number; loves: number; likes: number; dislikes: number }> = {
      'Ação': { count: 0, loves: 0, likes: 0, dislikes: 0 },
      'Drama': { count: 0, loves: 0, likes: 0, dislikes: 0 },
      'Comédia': { count: 0, loves: 0, likes: 0, dislikes: 0 },
      'Ficção Científica': { count: 0, loves: 0, likes: 0, dislikes: 0 },
      'Suspense': { count: 0, loves: 0, likes: 0, dislikes: 0 },
      'Fantasia': { count: 0, loves: 0, likes: 0, dislikes: 0 },
      'Romance': { count: 0, loves: 0, likes: 0, dislikes: 0 },
      'Terror': { count: 0, loves: 0, likes: 0, dislikes: 0 },
      'Outros': { count: 0, loves: 0, likes: 0, dislikes: 0 }
    };

    lovedOrLiked.forEach(r => {
      const movie = allMovies.find(m => m.id === r.movieId);
      if (!movie) return;

      let weight = 1;
      if (r.liked === 'love') weight = 2;
      if (r.liked === 'ok') weight = 0.5;

      movie.genres.forEach(g => {
        genresMap[g] = (genresMap[g] || 0) + weight;
      });

      directorsMap[movie.director] = (directorsMap[movie.director] || 0) + weight;

      movie.cast.forEach(actor => {
        actorsMap[actor] = (actorsMap[actor] || 0) + weight;
      });

      plotsList.push(movie.plotType);

      const catToSum = categoryCount[movie.plotCategory] ? movie.plotCategory : 'Outros';
      categoryCount[catToSum].count += 1;
      if (r.liked === 'love') categoryCount[catToSum].loves += 1;
      else categoryCount[catToSum].likes += 1;
    });

    // Feed negative parameters
    watchedRatings.filter(r => r.liked === 'dislike').forEach(r => {
      const movie = allMovies.find(m => m.id === r.movieId);
      if (movie) {
        const catToSum = categoryCount[movie.plotCategory] ? movie.plotCategory : 'Outros';
        categoryCount[catToSum].count += 1;
        categoryCount[catToSum].dislikes += 1;
      }
    });

    const totalGenresWeight = Object.values(genresMap).reduce((a, b) => a + b, 0) || 1;
    const genresDistribution = Object.entries(genresMap)
      .map(([name, weight]) => ({
        name,
        count: weight,
        percentage: Math.round((weight / totalGenresWeight) * 100)
      }))
      .sort((a, b) => b.count - a.count);

    const directorsDistribution = Object.entries(directorsMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const actorsDistribution = Object.entries(actorsMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const categoriesBreakdown = Object.entries(categoryCount).map(([category, stats]) => {
      const totalScore = (stats.loves * 2) + stats.likes - stats.dislikes;
      const matchScore = totalScore > 0 ? Math.min(100, Math.round((totalScore / (Math.max(1, stats.count) * 2)) * 100)) : 0;
      return {
        category,
        matchScore,
        count: stats.count
      };
    }).filter(c => c.count > 0).sort((a, b) => b.matchScore - a.matchScore);

    let runningActingSum = 0;
    let runningScriptSum = 0;
    let runningVisualSum = 0;
    let aspectCount = 0;

    watchedRatings.forEach(r => {
      if (!r.dontRemember) {
        let hasAspect = false;
        if (r.actingScore) { runningActingSum += r.actingScore; hasAspect = true; }
        if (r.scriptScore) { runningScriptSum += r.scriptScore; hasAspect = true; }
        if (r.visualScore) { runningVisualSum += r.visualScore; hasAspect = true; }
        if (hasAspect) aspectCount++;
      }
    });

    return {
      totalWatched: watchedRatings.length,
      totalWatchlist: watchlist.length,
      likesCount: watchedRatings.filter(r => r.liked === 'like').length,
      dislikesCount: watchedRatings.filter(r => r.liked === 'dislike').length,
      lovesCount: watchedRatings.filter(r => r.liked === 'love').length,
      oksCount: watchedRatings.filter(r => r.liked === 'ok').length,
      genresDistribution,
      directorsDistribution: directorsDistribution.slice(0, 5),
      actorsDistribution: actorsDistribution.slice(0, 5),
      plotsDistribution: plotsList.slice(0, 4).map(plot => ({ name: plot, count: 1 })),
      categoriesBreakdown,
      averageAspects: {
        acting: aspectCount > 0 ? parseFloat((runningActingSum / aspectCount).toFixed(1)) : 0,
        script: aspectCount > 0 ? parseFloat((runningScriptSum / aspectCount).toFixed(1)) : 0,
        visual: aspectCount > 0 ? parseFloat((runningVisualSum / aspectCount).toFixed(1)) : 0,
        totalRatedCount: aspectCount
      }
    };
  }, [ratings, watchlist, allMovies]);

  // Infinite personalized discovery feed: unrated titles ranked by psychological cognitive alignment
  const discoveryMovies = useMemo(() => {
    const topGenres = localStats?.genresDistribution?.map(g => g.name) || [];
    let list = unansweredMovies;
    if (topGenres.length > 0) {
      list = [...unansweredMovies].sort((a, b) => {
        const scoreA = a.genres.filter(g => topGenres.includes(g)).length;
        const scoreB = b.genres.filter(g => topGenres.includes(g)).length;
        return scoreB - scoreA;
      });
    }
    // Return up to 8 cards for a gorgeous endless-carousel feel
    return list.slice(0, 8);
  }, [unansweredMovies, localStats]);

  // Filter discoveryCarouselMovies by unrated/unanswered ones to hide rated ones immediately
  const visibleDiscoveryMovies = useMemo(() => {
    return discoveryCarouselMovies.filter(movie => {
      if (watchlist.includes(movie.id)) return false;
      const rating = ratings.find(r => r.movieId === movie.id);
      if (rating) return false;
      return true;
    });
  }, [discoveryCarouselMovies, ratings, watchlist]);

  // 1. Initial TMDB discovery load on mount (VITE_TMDB_API_KEY required)
  useEffect(() => {
    if (!user || !hasCompletedOnboarding) return;
    const loadTMDBDiscover = async () => {
      const apiKey = import.meta.env.VITE_TMDB_API_KEY;
      if (!apiKey || apiKey === "SUA_CHAVE_AQUI" || apiKey.trim() === "") {
        console.log("TMDB API Key não configurada. Usando dados locais para o Radar de Descobertas.");
        return;
      }
      setIsReplenishingDiscovery(true);
      try {
        const tmdbMovies = await fetchTrendingOrDiscover(apiKey);
        if (tmdbMovies && tmdbMovies.length > 0) {
          // Register unique movies in customMovies immediately to support other views
          setCustomMovies(prev => {
            const nextCustom = [...prev];
            tmdbMovies.forEach(m => {
              if (!nextCustom.some(x => x.id === m.id || x.title.toLowerCase().trim() === m.title.toLowerCase().trim())) {
                nextCustom.push(m);
              }
            });
            return nextCustom;
          });
          setDiscoveryCarouselMovies(tmdbMovies);
        } else {
          // TMDB returned nothing even after the trending fallback inside the service —
          // seed the feed with local discovery movies so the spinner is never permanent.
          console.warn('[Discovery] TMDB returned 0 movies. Seeding from local discoveryMovies.');
          if (discoveryMovies.length > 0) {
            setDiscoveryCarouselMovies(discoveryMovies.slice(0, 6));
          }
        }
      } catch (err) {
        console.error("Erro ao carregar descobertas do TMDB:", err);
        // On error also seed from local data so the UI is never stuck
        if (discoveryMovies.length > 0) {
          setDiscoveryCarouselMovies(discoveryMovies.slice(0, 6));
        }
      } finally {
        // Always clear the spinner — regardless of success, empty or error
        setIsReplenishingDiscovery(false);
      }
    };
    loadTMDBDiscover();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, hasCompletedOnboarding]);

  // Load platform movies from TMDB on activePlatformFilter change
  useEffect(() => {
    const PROVIDER_PLATFORMS = ['Netflix', 'Prime Video', 'Max', 'Disney+', 'Apple TV+'];
    const isPlatformProvider = PROVIDER_PLATFORMS.includes(activePlatformFilter);

    // Clear platform movies immediately when switching to non-provider filters
    if (!isPlatformProvider) {
      setPlatformMovies([]);
      return;
    }

    const PROVIDER_IDS: Record<string, number> = {
      'Netflix': 8,
      'Prime Video': 119,
      'Max': 1899,
      'Disney+': 337,
      'Apple TV+': 350
    };
    const providerId = PROVIDER_IDS[activePlatformFilter];
    if (!providerId) return;

    const loadPlatformMovies = async () => {
      const apiKey = import.meta.env.VITE_TMDB_API_KEY;
      setIsPlatformLoading(true);
      setPlatformMovies([]); // Clear stale data immediately for instant visual feedback

      if (!apiKey || apiKey === "SUA_CHAVE_AQUI" || apiKey.trim() === "") {
        console.log("TMDB API Key não configurada. Usando fallback local para plataforma.");
        setPlatformMovies(moviesDatabase.filter(m => m.platforms.includes(activePlatformFilter)));
        setIsPlatformLoading(false);
        return;
      }

      try {
        console.log(`⚡ Platform Filter: Fetching TMDB for ${activePlatformFilter} (providerId=${providerId})`);
        const tmdbMovies = await fetchTrendingOrDiscover(apiKey, providerId);
        if (tmdbMovies && tmdbMovies.length > 0) {
          // Register in customMovies for rating support
          setCustomMovies(prev => {
            const nextCustom = [...prev];
            tmdbMovies.forEach(m => {
              if (!nextCustom.some(x => x.id === m.id || x.title.toLowerCase().trim() === m.title.toLowerCase().trim())) {
                nextCustom.push(m);
              }
            });
            return nextCustom;
          });
          setPlatformMovies(tmdbMovies);
          triggerGlobalToast(`⚡ Catálogo TMDB: ${tmdbMovies.length} títulos carregados para ${activePlatformFilter}!`, "success");
          console.log(`✅ Platform Filter: ${tmdbMovies.length} movies loaded for ${activePlatformFilter}`);
        } else {
          // TMDB returned 0 results — fall back to local data
          const localFallback = moviesDatabase.filter(m => m.platforms.includes(activePlatformFilter));
          setPlatformMovies(localFallback);
          console.warn(`⚠️ Platform Filter: TMDB returned 0 results for ${activePlatformFilter}. Using local fallback (${localFallback.length} items).`);
        }
      } catch (err) {
        console.error("Erro ao carregar filmes por plataforma do TMDB, usando fallback local:", err);
        setPlatformMovies(moviesDatabase.filter(m => m.platforms.includes(activePlatformFilter)));
      } finally {
        setIsPlatformLoading(false);
      }
    };

    loadPlatformMovies();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlatformFilter]);

  // Synchronize or initialize discoveryCarouselMovies when it is empty and we're not currently in the loading/replenishing state
  useEffect(() => {
    if (discoveryCarouselMovies.length === 0 && !isReplenishingDiscovery) {
      // If TMDB key is not present or failed, initialize from local discoveryMovies
      const apiKey = import.meta.env.VITE_TMDB_API_KEY;
      if (!apiKey || apiKey === "SUA_CHAVE_AQUI" || apiKey.trim() === "") {
        if (discoveryMovies.length > 0) {
          setDiscoveryCarouselMovies(discoveryMovies.slice(0, 4));
        }
      }
    }
  }, [discoveryMovies, discoveryCarouselMovies.length, isReplenishingDiscovery]);

  // Monitor when visible cards inside the discovery carousel go to 0 and trigger a 1.5s AI thinking replenishment loop
  useEffect(() => {
    if (discoveryCarouselMovies.length > 0 && visibleDiscoveryMovies.length === 0 && !isReplenishingDiscovery) {
      setIsReplenishingDiscovery(true);
      
      const timer = setTimeout(async () => {
        // Try to fetch new discover/trending movies from TMDB first if API key is present
        const apiKey = import.meta.env.VITE_TMDB_API_KEY;
        if (apiKey && apiKey !== "SUA_CHAVE_AQUI" && apiKey.trim() !== "") {
          try {
            const tmdbMovies = await fetchTrendingOrDiscover(apiKey);
            const freshTmdb = tmdbMovies.filter(tm => {
              const alreadyInCatalog = allMovies.some(m => m.id === tm.id || m.title.toLowerCase().trim() === tm.title.toLowerCase().trim());
              const alreadyRated = ratings.some(r => r.movieId === tm.id);
              return !alreadyInCatalog && !alreadyRated;
            });
            if (freshTmdb.length > 0) {
              setCustomMovies(prev => {
                const nextCustom = [...prev];
                freshTmdb.forEach(m => {
                  if (!nextCustom.some(x => x.id === m.id || x.title.toLowerCase().trim() === m.title.toLowerCase().trim())) {
                    nextCustom.push(m);
                  }
                });
                return nextCustom;
              });
              setDiscoveryCarouselMovies(freshTmdb);
              setIsReplenishingDiscovery(false);
              triggerGlobalToast(`⚡ Mapeamento Concluído: ${freshTmdb.length} novos sinais integrados ao seu Radar!`, "success");
              return;
            }
          } catch (err) {
            console.error("Erro ao reabastecer com TMDB, usando fallback local:", err);
          }
        }

        // Gather brand new unrated titles from standbyMoviesPool that aren't already in allMovies
        const unusedStandby = standbyMoviesPool.filter(standby => {
          const alreadyInCatalog = allMovies.some(m => m.id === standby.id || m.title.toLowerCase().trim() === standby.title.toLowerCase().trim());
          const alreadyRated = ratings.some(r => r.movieId === standby.id);
          return !alreadyInCatalog && !alreadyRated;
        });

        let nextBatch: Movie[] = [];
        if (unusedStandby.length > 0) {
          nextBatch = unusedStandby.slice(0, 5);
        } else {
          // Backup fallback generator of creative entries if entire standby is exhausted
          const randomThemes = ['Retro-futurismo', 'Cyberpunk Noir', 'Realismo Fantástico', 'Suspense Minimalista', 'Épico Existencial'];
          const randomTitles = ['Estação Terminal 9', 'O Último Algoritmo', 'Eco Violeta', 'Antes da Chuva Cair', 'Mentes de Silício'];
          const randomCategories: Movie['plotCategory'][] = ['Ficção Científica', 'Suspense', 'Drama', 'Comédia', 'Ação'];
          
          nextBatch = Array.from({ length: 5 }).map((_, i) => ({
            id: `gen-replenish-${Date.now()}-${i}`,
            title: randomTitles[i] || `Estrela Perdida Vol. ${i + 1}`,
            originalTitle: randomTitles[i],
            type: 'Filme',
            year: 2024 - i,
            genres: [randomCategories[i], 'Mistério'],
            director: 'Algoritmo Realimentado',
            cast: ['Ator Holográfico A', 'Ator Holográfico B'],
            platforms: ['CineCognição IA'],
            plotType: randomThemes[i],
            plotCategory: randomCategories[i],
            similarIds: [],
            synopsis: `Uma obra selecionada dinamicamente pelo algoritmo para explorar seus limites intelectuais em temas de ${randomThemes[i]}.`
          }));
        }

        // Add to custom movies state for structural layout/persistence integration
        setCustomMovies(prev => {
          const fresh = nextBatch.filter(nb => !prev.some(p => p.id === nb.id || p.title.toLowerCase().trim() === nb.title.toLowerCase().trim()));
          return [...prev, ...fresh];
        });

        setDiscoveryCarouselMovies(nextBatch);
        setIsReplenishingDiscovery(false);
        triggerGlobalToast(`⚡ Mapeamento Concluído: ${nextBatch.length} novos sinais integrados ao seu Radar!`, "success");
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [visibleDiscoveryMovies.length, discoveryCarouselMovies.length, isReplenishingDiscovery, allMovies, ratings]);

  // Curated proximity matches rows
  const localRecommendations = useMemo(() => {
    return Object.entries(proximityMatches).map(([id, info]) => {
      const typed = info as { similarTo: string; movieTitle: string };
      const movie = allMovies.find(m => m.id === id);
      return movie ? { movie, similarToTitle: typed.movieTitle } : null;
    }).filter(Boolean) as { movie: Movie; similarToTitle: string }[];
  }, [proximityMatches, allMovies]);

  // Row Shelves (Apple TV themed carousel lists)
  const actionMovies = useMemo(() => unansweredMovies.filter(m => m.plotCategory === 'Ação' || m.plotCategory === 'Ficção Científica').slice(0, 10), [unansweredMovies]);
  const dramaMovies = useMemo(() => unansweredMovies.filter(m => m.plotCategory === 'Drama' || m.plotCategory === 'Romance').slice(0, 10), [unansweredMovies]);
  const mysteryMovies = useMemo(() => unansweredMovies.filter(m => m.plotCategory === 'Suspense' || m.plotCategory === 'Terror').slice(0, 10), [unansweredMovies]);
  const funMovies = useMemo(() => unansweredMovies.filter(m => m.plotCategory === 'Comédia' || m.plotCategory === 'Fantasia').slice(0, 10), [unansweredMovies]);

  // Main searchable Grid
  const filteredCatalog = useMemo(() => {
    const isPlatformFilter = ['Netflix', 'Prime Video', 'Max', 'Disney+', 'Apple TV+'].includes(activePlatformFilter);
    const baseList = isPlatformFilter 
      ? platformMovies.filter(movie => {
          if (watchlist.includes(movie.id)) return false;
          const rating = ratings.find(r => r.movieId === movie.id);
          if (rating) return false;
          return true;
        })
      : unansweredMovies;

    return baseList.filter(movie => {
      const q = onlineSearchQuery.trim().toLowerCase();
      const matchesSearch = !q || 
        movie.title.toLowerCase().includes(q) || 
        (movie.originalTitle && movie.originalTitle.toLowerCase().includes(q)) ||
        movie.director.toLowerCase().includes(q) ||
        movie.cast.some(actor => actor.toLowerCase().includes(q));
        
      const matchesCategory = selectedCategory === 'all' || movie.plotCategory === selectedCategory;
      const matchesType = selectedType === 'all' || movie.type === selectedType;
      
      let matchesPlatform = true;
      if (!isPlatformFilter && activePlatformFilter !== 'all') {
        if (activePlatformFilter === 'Cinema') {
          matchesPlatform = movie.platforms.includes('Cinema') || movie.year >= 2025;
        } else if (activePlatformFilter === 'Recent') {
          matchesPlatform = (movie.year >= 2024 && movie.year <= 2026) || movie.platforms.includes('Cinema');
        } else {
          matchesPlatform = movie.platforms.includes(activePlatformFilter);
        }
      }

      return matchesSearch && matchesCategory && matchesType && matchesPlatform;
    });
  }, [unansweredMovies, platformMovies, onlineSearchQuery, selectedCategory, selectedType, activePlatformFilter, watchlist, ratings]);

  // Calls the Gemini 3.5 analyzer to build the comprehensive mathematical spectating profile
  const triggerAIAnalysis = async () => {
    if (ratings.length === 0) {
      triggerGlobalToast("Por favor, avalie pelo menos um filme para processar a sua análise analítica customizada.", "info");
      return;
    }

    setIsLoadingAI(true);
    setAiError(null);

    try {
      const response = await fetch('/api/analyze-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratings,
          favorites
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar análise.');
      }

      setAiProfile(data);
      // Automatically switch to analytics view to show user the result
      setActiveTab('analytics');
    } catch (err: any) {
      console.error("Gemini Structural Error:", err);
      setAiProfile({
        archetypeName: "O Analista Sintético",
        archetypeDescription: "Nossos servidores estão recalibrando seu DNA cinematográfico. Suas avaliações indicam um padrão complexo.",
        psychologicalAssessment: "A inteligência artificial identificou complexidade em seus padrões e está processando o diagnóstico de perfil de forma offline temporariamente.",
        narrativeThemesInCommon: ["Processando...", "Em Calibração...", "Sintetizando..."],
        statisticsSummary: {
          dominantGenre: "Indefinido",
          preferredPacing: "Em Calibração",
          thematicFocus: "Aguardando volume crítico"
        },
        genreBreakdownDetails: [],
        customRecommendations: []
      });
      setActiveTab('analytics');
    } finally {
      setIsLoadingAI(false);
    }
  };

  const generateShareCard = () => {
    if (!aiProfile) {
      triggerGlobalToast("Por favor, gere o seu perfil cognitivo antes de compartilhar.", "info");
      return;
    }

    try {
      // Create memory canvas
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1080;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        triggerGlobalToast("Não foi possível inicializar o renderizador de imagem.", "error");
        return;
      }

      // 1. Draw solid dark background
      const gradBg = ctx.createLinearGradient(0, 0, 0, 1080);
      gradBg.addColorStop(0, '#0a0915'); // Deep space violet-black
      gradBg.addColorStop(0.5, '#120e2e'); // Deep violet atmosphere
      gradBg.addColorStop(1, '#05040a'); // Carbon black
      ctx.fillStyle = gradBg;
      ctx.fillRect(0, 0, 1080, 1080);

      // 2. Draw ambient neon glow circles in the background
      // Ambient Top Left Glow
      const glow1 = ctx.createRadialGradient(200, 200, 50, 200, 200, 400);
      glow1.addColorStop(0, 'rgba(99, 102, 241, 0.15)'); // Indigo
      glow1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow1;
      ctx.beginPath();
      ctx.arc(200, 200, 400, 0, Math.PI * 2);
      ctx.fill();

      // Ambient Bottom Right Glow
      const glow2 = ctx.createRadialGradient(880, 880, 50, 880, 880, 400);
      glow2.addColorStop(0, 'rgba(168, 85, 247, 0.12)'); // Purple
      glow2.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow2;
      ctx.beginPath();
      ctx.arc(880, 880, 400, 0, Math.PI * 2);
      ctx.fill();

      // Ambient Center Glow
      const glow3 = ctx.createRadialGradient(540, 540, 0, 540, 540, 300);
      glow3.addColorStop(0, 'rgba(236, 72, 153, 0.05)'); // Pink/Amber
      glow3.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow3;
      ctx.beginPath();
      ctx.arc(540, 540, 300, 0, Math.PI * 2);
      ctx.fill();

      // 3. Draw thin dual border frame
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.strokeRect(40, 40, 1000, 1000);

      ctx.strokeStyle = 'rgba(129, 140, 248, 0.15)'; // Indigo fine accent
      ctx.strokeRect(46, 46, 988, 988);

      // Gold top accent bar
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(490, 40, 100, 4);

      // 4. Header titles
      // Category tag
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#fbbf24'; // Amber accent
      ctx.textAlign = 'center';
      ctx.fillText('C I N É F I L O   •   P E R F I L   C O G N I T I V O', 540, 95);

      // Main logo Title
      ctx.font = 'extrabold 48px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('CINEPERFIL IA', 540, 155);

      // Subtitle
      ctx.font = '500 16px sans-serif';
      ctx.fillStyle = '#a5b4fc'; // Light indigo
      ctx.fillText('Diagnóstico Analítico do Gosto & Subtexto Cinematográfico', 540, 192);

      // Separator line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.moveTo(340, 215);
      ctx.lineTo(740, 215);
      ctx.stroke();

      // Separator diamond
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(540, 210);
      ctx.lineTo(545, 215);
      ctx.lineTo(540, 220);
      ctx.lineTo(535, 215);
      ctx.closePath();
      ctx.fill();

      // 5. Archetype Banner Section
      // Draw rectangular rounded card context
      const cardX = 80;
      const cardY = 250;
      const cardW = 920;
      const cardH = 260;
      const cardR = 20;

      ctx.beginPath();
      ctx.moveTo(cardX + cardR, cardY);
      ctx.lineTo(cardX + cardW - cardR, cardY);
      ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + cardR);
      ctx.lineTo(cardX + cardW, cardY + cardH - cardR);
      ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - cardR, cardY + cardH);
      ctx.lineTo(cardX + cardR, cardY + cardH);
      ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - cardR);
      ctx.lineTo(cardX, cardY + cardR);
      ctx.quadraticCurveTo(cardX, cardY, cardX + cardR, cardY);
      ctx.closePath();

      // Fill with gradient for VIP card look
      const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
      cardGrad.addColorStop(0, 'rgba(30, 27, 75, 0.8)'); // deep indigo
      cardGrad.addColorStop(0.5, 'rgba(88, 28, 135, 0.5)'); // deep purple
      cardGrad.addColorStop(1, 'rgba(10, 8, 20, 0.9)');
      ctx.fillStyle = cardGrad;
      ctx.fill();
      
      // Border of card
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(129, 140, 248, 0.35)';
      ctx.stroke();

      // Banner metadata
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#f59e0b';
      ctx.textAlign = 'left';
      ctx.fillText('ARQUÉTIPO DE ESPECTADOR REVELADO', cardX + 35, cardY + 45);

      // Archetype Name
      ctx.font = 'bold 32px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(aiProfile.archetypeName, cardX + 35, cardY + 95);

      // Archetype Description (wrapped)
      ctx.font = 'italic 16px sans-serif';
      ctx.fillStyle = '#cbd5e1'; // slate-300
      
      // Wrap description text
      const descMaxWidth = cardW - 70;
      const descLineHeight = 24;
      const descText = aiProfile.archetypeDescription;
      
      let currentY = cardY + 140;
      const words = descText.split(' ');
      let line = '';
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > descMaxWidth && n > 0) {
          ctx.fillText(line, cardX + 35, currentY);
          line = words[n] + ' ';
          currentY += descLineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, cardX + 35, currentY);

      // 6. Psychological Narrative deep-read
      const psychY = 550;
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#a5b4fc';
      ctx.fillText('ANÁLISE DE TRAJETÓRIA CINEMATOGRÁFICA', cardX, psychY);

      // Psychological Assessment Box
      const psychBoxY = psychY + 15;
      const psychBoxH = 200;
      ctx.beginPath();
      ctx.moveTo(cardX, psychBoxY);
      ctx.lineTo(cardX + cardW, psychBoxY);
      ctx.lineTo(cardX + cardW, psychBoxY + psychBoxH);
      ctx.lineTo(cardX, psychBoxY + psychBoxH);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.stroke();

      // Accent gold indicator left bar
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(cardX, psychBoxY, 4, psychBoxH);

      // Write Assessment paragraph
      ctx.font = '15px sans-serif';
      ctx.fillStyle = '#e4e4e7'; // zinc-200
      const paragraphText = aiProfile.psychologicalAssessment;
      const paraMaxWidth = cardW - 50;
      const paraLineHeight = 23;
      let paraY = psychBoxY + 35;
      
      const pWords = paragraphText.split(' ');
      let pLine = '';
      let paraLinesDrawn = 0;
      for (let n = 0; n < pWords.length; n++) {
        const testLine = pLine + pWords[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > paraMaxWidth && n > 0) {
          if (paraLinesDrawn < 6) { // prevent overflow inside container
            ctx.fillText(pLine, cardX + 25, paraY);
            pLine = pWords[n] + ' ';
            paraY += paraLineHeight;
            paraLinesDrawn++;
          }
        } else {
          pLine = testLine;
        }
      }
      if (paraLinesDrawn < 6) {
        ctx.fillText(pLine, cardX + 25, paraY);
      }

      // 7. Visual dynamic stats pills side-by-side
      const statsY = 790;
      const pillW = 286;
      const pillH = 150;
      const gap = 31;

      const statsList = [
        { label: 'GÊNERO DOMINANTE', value: aiProfile.statisticsSummary?.dominantGenre || 'Drama', color: '#f43f5e' }, // rose-500
        { label: 'RITMO PREFERIDO', value: aiProfile.statisticsSummary?.preferredPacing || 'Tensão Crescente', color: '#818cf8' }, // indigo-405
        { label: 'FOCO TEMÁTICO', value: aiProfile.statisticsSummary?.thematicFocus || 'Profundidade Psicológica', color: '#fbbf24' } // amber-400
      ];

      statsList.forEach((stat, idx) => {
        const pillX = cardX + (idx * (pillW + gap));
        
        // Draw rounding rectangle
        ctx.beginPath();
        ctx.moveTo(pillX + 15, statsY);
        ctx.lineTo(pillX + pillW - 15, statsY);
        ctx.quadraticCurveTo(pillX + pillW, statsY, pillX + pillW, statsY + 15);
        ctx.lineTo(pillX + pillW, statsY + pillH - 15);
        ctx.quadraticCurveTo(pillX + pillW, statsY + pillH, pillX + pillW - 15, statsY + pillH);
        ctx.lineTo(pillX + 15, statsY + pillH);
        ctx.quadraticCurveTo(pillX, statsY + pillH, pillX, statsY + pillH - 15);
        ctx.lineTo(pillX, statsY + 15);
        ctx.quadraticCurveTo(pillX, statsY, pillX + 15, statsY);
        ctx.closePath();

        ctx.fillStyle = 'rgba(15, 12, 30, 0.65)';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.stroke();

        // Decorative dot
        ctx.fillStyle = stat.color;
        ctx.beginPath();
        ctx.arc(pillX + 20, statsY + 30, 5, 0, Math.PI * 2);
        ctx.fill();

        // Stat Label
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#94a3b8'; // slate-400
        ctx.textAlign = 'left';
        ctx.fillText(stat.label, pillX + 32, statsY + 33);

        // Stat Value (wrapped inside pill if extremely long)
        ctx.font = 'bold 15px sans-serif';
        ctx.fillStyle = '#ffffff';
        
        const textVal = stat.value;
        const valWords = textVal.split(' ');
        let valLine = '';
        let valY = statsY + 68;
        const valMaxWidth = pillW - 40;
        
        for (let j = 0; j < valWords.length; j++) {
          const testLine = valLine + valWords[j] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > valMaxWidth && j > 0) {
            ctx.fillText(valLine, pillX + 20, valY);
            valLine = valWords[j] + ' ';
            valY += 21;
          } else {
            valLine = testLine;
          }
        }
        ctx.fillText(valLine, pillX + 20, valY);
      });

      // 8. Bottom Watermark & Social handles
      ctx.font = '13px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.textAlign = 'left';
      ctx.fillText('Gerado via Inteligência Artificial pelo Cineperfil • Gemini 3.5', 80, 1000);

      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'right';
      ctx.fillText('cineperfil.build 🎬', 1000, 1000);

      // 9. Fire actual browser download
      const imageUrl = canvas.toDataURL('image/png');
      const filename = `cineperfil-arquetipo-${aiProfile.archetypeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
      
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      triggerGlobalToast("✨ Seu cartão social premium foi gerado e baixado com sucesso!", "success");
    } catch (e: any) {
      console.error("Erro gerando cartão de compartilhamento:", e);
      triggerGlobalToast("Não foi possível gerar a imagem devido a restrições no navegador.", "error");
    }
  };

  const posterImages: Record<string, string[]> = {
    'Ficção Científica': [
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop', // sci-fi cyberpunk portrait
      'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop', // moody star cosmos
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=600&auto=format&fit=crop', // futuristic cosmic light
      'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?q=80&w=600&auto=format&fit=crop'  // astronaut dramatic lighting
    ],
    'Drama': [
      'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop', // cinematic classic theatre background
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=600&auto=format&fit=crop', // film noir silhouettes portrait
      'https://images.unsplash.com/photo-1485125639709-a60c3a500bf1?q=80&w=600&auto=format&fit=crop', // classic black & white street
      'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop'  // premium clapperboard and studio backdrop
    ],
    'Suspense': [
      'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?q=80&w=600&auto=format&fit=crop', // mysterious rainy neon alley
      'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop', // misty forest walk
      'https://images.unsplash.com/photo-1535498730771-e735b998cd64?q=80&w=600&auto=format&fit=crop', // shadowy silhouetted neon tower
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop'  // cinematic neon tunnel entrance
    ],
    'Terror': [
      'https://images.unsplash.com/photo-1505635552518-3448ff116af3?q=80&w=600&auto=format&fit=crop', // haunted misty woods
      'https://images.unsplash.com/photo-1519074002996-a69e7ac46a42?q=80&w=600&auto=format&fit=crop', // ghost-like dramatic dark interior
      'https://images.unsplash.com/photo-1528127269322-539801943592?q=80&w=600&auto=format&fit=crop', // gothic haunted castle shadow
      'https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=600&auto=format&fit=crop'  // moody blood red silhouette portrait
    ],
    'Ação': [
      'https://images.unsplash.com/photo-1635805737707-575885ab0820?q=80&w=600&auto=format&fit=crop', // dramatic hero in red armor
      'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?q=80&w=600&auto=format&fit=crop', // super muscle car headlights speed
      'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?q=80&w=600&auto=format&fit=crop', // racing car with active exhaust flame
      'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?q=80&w=600&auto=format&fit=crop'  // cinematic dramatic action field glow
    ],
    'Fantasia': [
      'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=600&auto=format&fit=crop', // epic mystic surreal purple skies
      'https://images.unsplash.com/photo-1500964757637-c85e8a162699?q=80&w=600&auto=format&fit=crop', // high-contrast glowing peaks
      'https://images.unsplash.com/photo-1519074002996-a69e7ac46a42?q=80&w=600&auto=format&fit=crop', // magical glowing ruins portal
      'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop'  // eerie mystic forest backdrop
    ],
    'Comédia': [
      'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=600&auto=format&fit=crop', // yellow retro popcorn cinema context
      'https://images.unsplash.com/photo-1514306191717-452ec28c7814?q=80&w=600&auto=format&fit=crop', // neon arcade marquee lights
      'https://images.unsplash.com/photo-1527224857830-43a7acc85260?q=80&w=600&auto=format&fit=crop', // smiling expressions bubbles focus
      'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=600&auto=format&fit=crop'  // quirky neon lights setup
    ],
    'Romance': [
      'https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=600&auto=format&fit=crop', // couples silhouette vintage lights
      'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=600&auto=format&fit=crop', // hand holding vintage love symbol
      'https://images.unsplash.com/photo-1474552226712-ac0f0961a954?q=80&w=600&auto=format&fit=crop', // scenic ocean golden elements
      'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?q=80&w=600&auto=format&fit=crop'  // dramatic rose macro spotlight
    ]
  };

  const getFailsafePosterUrl = (movieItem: Movie) => {
    const title = movieItem.title || "Cinema";
    const year = movieItem.year || "2026";
    const director = movieItem.director || "Decodificador Cineperfil";
    const cat = movieItem.plotCategory || "Drama";
    const genres = (movieItem.genres || []).slice(0, 3).join(" • ").toUpperCase();
    const cast = (movieItem.cast || []).slice(0, 3).join(" • ").toUpperCase();

    // Pick sophisticated cinematic styling based on movie theme/plot category
    let gradientFrom = "#1C2440";
    let gradientTo = "#020205";
    let accentColor = "#00E5FF";
    let fontStyle = "'Space Grotesk', system-ui, sans-serif";
    let letterSpacing = "6";

    if (cat === "Ficção Científica") {
      gradientFrom = "#0A2540";
      gradientTo = "#030408";
      accentColor = "#00E5FF";
      fontStyle = "'Space Grotesk', system-ui, sans-serif";
      letterSpacing = "6";
    } else if (cat === "Ação") {
      gradientFrom = "#3E0A14";
      gradientTo = "#050305";
      accentColor = "#FF2D55";
      fontStyle = "'Space Grotesk', sans-serif";
      letterSpacing = "5";
    } else if (cat === "Drama") {
      gradientFrom = "#2A1708";
      gradientTo = "#040201";
      accentColor = "#FFCC00";
      fontStyle = "Georgia, 'Times New Roman', serif";
      letterSpacing = "3";
    } else if (cat === "Suspense") {
      gradientFrom = "#0F1A2C";
      gradientTo = "#020306";
      accentColor = "#0A84FF";
      fontStyle = "'JetBrains Mono', monospace";
      letterSpacing = "4";
    } else if (cat === "Terror") {
      gradientFrom = "#250000";
      gradientTo = "#000000";
      accentColor = "#FF3333";
      fontStyle = "Georgia, 'Times New Roman', serif";
      letterSpacing = "8";
    } else if (cat === "Fantasia") {
      gradientFrom = "#2B0F46";
      gradientTo = "#050208";
      accentColor = "#BF5AF2";
      fontStyle = "Georgia, serif";
      letterSpacing = "5";
    } else if (cat === "Comédia") {
      gradientFrom = "#3A3005";
      gradientTo = "#080703";
      accentColor = "#FFD60A";
      fontStyle = "'Space Grotesk', sans-serif";
      letterSpacing = "4";
    } else if (cat === "Romance") {
      gradientFrom = "#3B0A1F";
      gradientTo = "#050102";
      accentColor = "#FF375F";
      fontStyle = "Georgia, serif";
      letterSpacing = "3";
    }

    const encodeTitleToSVGText = (t: string) => {
      const cleanTitle = t.replace(/\s+/g, " ").trim();
      const length = cleanTitle.length;
      let fontSize = 28;
      
      if (length > 28) fontSize = 15;
      else if (length > 20) fontSize = 18;
      else if (length > 13) fontSize = 22;

      const words = cleanTitle.split(" ");
      if (words.length <= 1 || length <= 12) {
        return `<text x="0" y="0" text-anchor="middle" font-family="${fontStyle}" font-size="${fontSize}" font-weight="900" fill="url(#textGrad)" letter-spacing="${letterSpacing}" filter="url(#dropShadow)" text-rendering="geometricPrecision">${cleanTitle.toUpperCase()}</text>`;
      }
      
      if (words.length === 2) {
        return `
          <text x="0" y="-12" text-anchor="middle" font-family="${fontStyle}" font-size="${fontSize}" font-weight="900" fill="url(#textGrad)" letter-spacing="${letterSpacing}" filter="url(#dropShadow)" text-rendering="geometricPrecision">${words[0].toUpperCase()}</text>
          <text x="0" y="14" text-anchor="middle" font-family="${fontStyle}" font-size="${fontSize}" font-weight="900" fill="url(#textGrad)" letter-spacing="${letterSpacing}" filter="url(#dropShadow)" text-rendering="geometricPrecision">${words[1].toUpperCase()}</text>
        `;
      }
      
      let bestSplitIndex = 1;
      let minDiff = Infinity;
      let runningCharCount = 0;
      for (let i = 0; i < words.length - 1; i++) {
        runningCharCount += words[i].length + 1;
        const diff = Math.abs(runningCharCount - (length / 2));
        if (diff < minDiff) {
          minDiff = diff;
          bestSplitIndex = i + 1;
        }
      }
      
      const p1 = words.slice(0, bestSplitIndex).join(" ");
      const p2 = words.slice(bestSplitIndex).join(" ");
      
      let finalSize = fontSize;
      if (p1.length > 15 || p2.length > 15) {
        finalSize = Math.min(fontSize, 18);
      }

      return `
        <text x="0" y="-14" text-anchor="middle" font-family="${fontStyle}" font-size="${finalSize}" font-weight="900" fill="url(#textGrad)" letter-spacing="${letterSpacing}" filter="url(#dropShadow)" text-rendering="geometricPrecision">${p1.toUpperCase()}</text>
        <text x="0" y="14" text-anchor="middle" font-family="${fontStyle}" font-size="${finalSize}" font-weight="900" fill="url(#textGrad)" letter-spacing="${letterSpacing}" filter="url(#dropShadow)" text-rendering="geometricPrecision">${p2.toUpperCase()}</text>
      `;
    };

    const titleMarkup = encodeTitleToSVGText(title);

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="400" height="600">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${gradientFrom}" />
            <stop offset="60%" stop-color="#050508" />
            <stop offset="100%" stop-color="${gradientTo}" />
          </linearGradient>

          <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFFFFF" />
            <stop offset="105%" stop-color="${accentColor}" />
          </linearGradient>

          <filter id="filmNoise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="3" result="noise" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.15 0" />
            <feComposite operator="in" in2="SourceGraphic" />
          </filter>

          <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.9" />
          </filter>
          
          <radialGradient id="vignette" cx="50%" cy="50%" r="50%">
            <stop offset="50%" stop-color="transparent" />
            <stop offset="100%" stop-color="#000000" stop-opacity="0.95" />
          </radialGradient>
        </defs>

        <!-- Base Canvas with vignette and framing -->
        <rect width="400" height="600" fill="url(#bgGrad)" />
        <rect width="384" height="584" x="8" y="8" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1" />
        <rect width="400" height="600" fill="url(#vignette)" />

        <!-- Atmospheric cinematic geometry graphic elements (simulated projector beams and orbits) -->
        <circle cx="200" cy="235" r="110" fill="none" stroke="${accentColor}" stroke-opacity="0.12" stroke-width="1.25" stroke-dasharray="12 6" />
        <circle cx="200" cy="235" r="90" fill="none" stroke="${accentColor}" stroke-opacity="0.06" stroke-width="0.75" />
        <line x1="200" y1="90" x2="200" y2="380" stroke="${accentColor}" stroke-opacity="0.08" stroke-width="1" />
        <line x1="70" y1="235" x2="330" y2="235" stroke="${accentColor}" stroke-opacity="0.08" stroke-width="1" />

        <!-- Film texture simulation -->
        <rect width="400" height="600" filter="url(#filmNoise)" pointer-events="none" />

        <!-- FAILSFE BADGE - CAPA INDISPONÍVEL REPRESENTAÇÃO FIEL (Premium, highly tracking-spaced typography) -->
        <rect x="42" y="24" width="316" height="19" rx="3.5" fill="#000000" fill-opacity="0.75" stroke="${accentColor}" stroke-opacity="0.25" stroke-width="0.75" />
        <text x="200" y="35.5" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="7" font-weight="900" letter-spacing="3.2" fill="${accentColor}">
          CAPA INDISPONÍVEL — REPRESENTAÇÃO FIEL
        </text>

        <!-- Text typography placement -->
        <g transform="translate(200, 225)">
          ${titleMarkup}
        </g>

        <!-- Original title label if different -->
        <text x="200" y="305" text-anchor="middle" font-family="'Inter', sans-serif" font-size="8.5" font-style="italic" fill="#8E8E93" font-weight="500" letter-spacing="1.5" opacity="0.8">
          ${movieItem.originalTitle && movieItem.originalTitle !== title ? "Original: " + movieItem.originalTitle : ""}
        </text>

        <!-- Dynamic Year and category specs tag -->
        <rect x="145" y="340" width="110" height="19" rx="4" fill="#FFFFFF" fill-opacity="0.05" stroke="rgba(255,255,255,0.08)" stroke-width="0.5" />
        <text x="200" y="352.5" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="8" font-weight="900" fill="#E5E5EA" letter-spacing="0.5">
          ${year} • ${cat.toUpperCase()}
        </text>

        <!-- Genres string -->
        <text x="200" y="385" text-anchor="middle" font-family="'Inter', sans-serif" font-size="8" font-weight="700" fill="#8E8E93" letter-spacing="1.5">
          ${genres}
        </text>

        <!-- Official Hollywood Billing Block Credits (Exacting realism and beautiful letter-spacing ratios) -->
        <g transform="translate(200, 485)">
          <text x="0" y="0" text-anchor="middle" font-family="'Inter', sans-serif" font-size="6.5" font-weight="900" fill="#E5E5EA" letter-spacing="3">
            A CINEPERFIL ORIGINAL PRODUCTION
          </text>
          <text x="0" y="14" text-anchor="middle" font-family="'Inter', sans-serif" font-size="6" font-weight="600" fill="#A1A1A6" letter-spacing="2">
            ESCRITO E DIRIGIDO POR <tspan fill="${accentColor}" font-weight="800">${director.toUpperCase()}</tspan>
          </text>
          <text x="0" y="28" text-anchor="middle" font-family="'Inter', sans-serif" font-size="5.5" font-weight="500" fill="#8E8E93" letter-spacing="1.2">
            STARRING: ${cast}
          </text>
          <text x="0" y="42" text-anchor="middle" font-family="'Inter', sans-serif" font-size="5" font-weight="400" fill="#6E6E73" letter-spacing="1.5">
            PRODUCTION SYSTEM ENGINE • EDITED BY THE STREAM RADAR PRO TEAM
          </text>
          <text x="0" y="52" text-anchor="middle" font-family="'Inter', sans-serif" font-size="5.2" font-weight="400" fill="#555559" letter-spacing="0.5">
            CINEPERFIL STUDIOS NETWORK INC. • COPYRIGHT 2026 • TODOS OS DIREITOS RESERVADOS
          </text>
        </g>
      </svg>
    `;

    return "data:image/svg+xml;utf8," + encodeURIComponent(svg.trim());
  };

  const getStablePosterUrl = (movieItem: Movie) => {
    if (movieItem.posterUrl) {
      return movieItem.posterUrl;
    }
    const titleLower = (movieItem.title || '').toLowerCase().trim();
    const idLower = (movieItem.id || '').toLowerCase().trim();


    // Mapping of exact recognized titles or IDs to official vertical posters on Wikimedia / stable hosts
    const officialPosters: Record<string, string> = {
      // Direct requests
      'missao-impossivel-acerto-de-contas': 'https://upload.wikimedia.org/wikipedia/pt/b/b2/Mission_Impossible_Dead_Reckoning_Part_One_poster.jpg',
      'missão: impossível - acerto de contas': 'https://upload.wikimedia.org/wikipedia/pt/b/b2/Mission_Impossible_Dead_Reckoning_Part_One_poster.jpg',
      'missão: impossível – acerto de contas parte um': 'https://upload.wikimedia.org/wikipedia/pt/b/b2/Mission_Impossible_Dead_Reckoning_Part_One_poster.jpg',
      'missão impossível': 'https://upload.wikimedia.org/wikipedia/pt/b/b2/Mission_Impossible_Dead_Reckoning_Part_One_poster.jpg',
      'my name': 'https://upload.wikimedia.org/wikipedia/en/6/6d/My_Name_Netflix.jpg',
      'corra que a polícia vem aí!': 'https://upload.wikimedia.org/wikipedia/pt/d/db/Nakedgun_poster.jpg',
      'the naked gun': 'https://upload.wikimedia.org/wikipedia/pt/d/db/Nakedgun_poster.jpg',
      'interestelar': 'https://upload.wikimedia.org/wikipedia/pt/3/3a/Interstellar_Filme.png',
      'interstellar': 'https://upload.wikimedia.org/wikipedia/en/b/bc/Interstellar_film_poster.jpg',
      'interstellar-2014': 'https://upload.wikimedia.org/wikipedia/en/b/bc/Interstellar_film_poster.jpg',
      'interstellar-arrival': 'https://upload.wikimedia.org/wikipedia/en/b/bc/Interstellar_film_poster.jpg',

      // Classical database matches
      'blade runner: o caçador de replicantes': 'https://upload.wikimedia.org/wikipedia/en/9/9f/Blade_Runner_poster.jpg',
      'blade-runner-1982': 'https://upload.wikimedia.org/wikipedia/en/9/9f/Blade_Runner_poster.jpg',
      'de volta para o futuro': 'https://upload.wikimedia.org/wikipedia/en/d/d2/Back_to_the_Future.jpg',
      'back-to-the-future-1985': 'https://upload.wikimedia.org/wikipedia/en/d/d2/Back_to_the_Future.jpg',
      'o iluminado': 'https://upload.wikimedia.org/wikipedia/en/a/a2/The_Shining_poster.jpg',
      'the-shining-1980': 'https://upload.wikimedia.org/wikipedia/en/a/a2/The_Shining_poster.jpg',
      'scarface': 'https://upload.wikimedia.org/wikipedia/en/7/74/Scarface_1983_poster.jpg',
      'scarface-1983': 'https://upload.wikimedia.org/wikipedia/en/7/74/Scarface_1983_poster.jpg',
      'o exterminador do futuro': 'https://upload.wikimedia.org/wikipedia/en/7/70/Terminator1984poster.jpg',
      'terminator-1984': 'https://upload.wikimedia.org/wikipedia/en/7/70/Terminator1984poster.jpg',
      'aliens: o resgate': 'https://upload.wikimedia.org/wikipedia/en/f/fb/Aliens_poster.jpg',
      'aliens-1986': 'https://upload.wikimedia.org/wikipedia/en/f/fb/Aliens_poster.jpg',
      'duro de matar': 'https://upload.wikimedia.org/wikipedia/en/7/7e/Die_hard_poster.jpg',
      'die-hard-1988': 'https://upload.wikimedia.org/wikipedia/en/7/7e/Die_hard_poster.jpg',
      'matrix': 'https://upload.wikimedia.org/wikipedia/en/c/c1/The_Matrix_Poster.jpg',
      'o resgate do soldado ryan': 'https://upload.wikimedia.org/wikipedia/en/1/11/Saving_Private_Ryan_poster.jpg',
      'clube da luta': 'https://upload.wikimedia.org/wikipedia/en/f/fc/Fight_Club_poster.jpg',
      'fight club': 'https://upload.wikimedia.org/wikipedia/en/f/fc/Fight_Club_poster.jpg',
      'a origem': 'https://upload.wikimedia.org/wikipedia/en/2/2e/Inception_2010_poster.jpg',
      'inception': 'https://upload.wikimedia.org/wikipedia/en/2/2e/Inception_2010_poster.jpg',
      'inception-2010': 'https://upload.wikimedia.org/wikipedia/en/2/2e/Inception_2010_poster.jpg',
      'se7en': 'https://upload.wikimedia.org/wikipedia/en/3/3a/Se7en_poster.jpg',
      'seven': 'https://upload.wikimedia.org/wikipedia/en/3/3a/Se7en_poster.jpg',
      'breaking bad': 'https://upload.wikimedia.org/wikipedia/en/5/52/Breaking_Bad_season_5_poster.jpg',
      'ruptura': 'https://upload.wikimedia.org/wikipedia/en/5/52/Severance_tv_series_poster.jpg',
      'severance-season-two': 'https://upload.wikimedia.org/wikipedia/en/5/52/Severance_tv_series_poster.jpg',
      'stranger things': 'https://upload.wikimedia.org/wikipedia/en/6/6d/Stranger_Things_Season_1_poster.png',
      'succession': 'https://upload.wikimedia.org/wikipedia/en/1/1c/Succession_season_4_poster.jpg',
      'round 6': 'https://upload.wikimedia.org/wikipedia/en/d/d7/Squid_Game_title_card.jpg',
      'tropa de elite': 'https://upload.wikimedia.org/wikipedia/pt/1/11/Tropa_de_elite_poster.jpg',
      'os infiltrados': 'https://upload.wikimedia.org/wikipedia/en/f/f3/The_Departed_poster.jpg',
      'zodíaco': 'https://upload.wikimedia.org/wikipedia/en/3/3a/Zodiac_poster.jpg',
      'django livre': 'https://upload.wikimedia.org/wikipedia/en/8/8b/Django_Unchained_Poster.jpg',
      'o lobo de wall street': 'https://upload.wikimedia.org/wikipedia/en/d/d8/The_Wolf_of_Wall_Street_poster.jpg',
      'garota exemplar': 'https://upload.wikimedia.org/wikipedia/en/1/10/Gone_Girl_Poster.jpg',
      'o grande hotel budapeste': 'https://upload.wikimedia.org/wikipedia/en/a/a6/The_Grand_Budapest_Hotel_poster.jpg',
      'entre facas e segredos': 'https://upload.wikimedia.org/wikipedia/en/c/c1/Knives_Out_poster.png',
      'a chegada': 'https://upload.wikimedia.org/wikipedia/en/d/df/Arrival_poster.jpg',
      'ex machina': 'https://upload.wikimedia.org/wikipedia/en/b/ba/Ex_Machina_poster.jpg',
      'sicario': 'https://upload.wikimedia.org/wikipedia/en/4/43/Sicario_poster.jpg',
      'birdman': 'https://upload.wikimedia.org/wikipedia/en/a/a3/Birdman_poster.jpg',
      'tudo em todo lugar ao mesmo tempo': 'https://upload.wikimedia.org/wikipedia/en/c/c1/Everything_Everywhere_All_at_Once_poster.jpg',
      'pobres criaturas': 'https://upload.wikimedia.org/wikipedia/en/c/c7/Poor_Things_film_poster.jpg',
      'assassinos da lua das flores': 'https://upload.wikimedia.org/wikipedia/en/2/2b/Killers_of_the_Flower_Moon_poster.jpeg',
      'anatomia de uma qeda': 'https://upload.wikimedia.org/wikipedia/en/c/ca/Anatomy_of_a_Fall_poster.jpg',
      'duna: profecia': 'https://upload.wikimedia.org/wikipedia/en/5/5e/Dune_Prophecy_season_1_poster.jpg',
      'xógun: a gloriosa saga do japão': 'https://upload.wikimedia.org/wikipedia/en/f/ff/Sh%C5%8Dgun_2024_TV_series_poster.jpg',
      'nosferatu': 'https://upload.wikimedia.org/wikipedia/en/9/91/Nosferatu_(2024_film)_poster.jpg',
      'the batman': 'https://upload.wikimedia.org/wikipedia/en/f/f9/The_Batman_poster.jpg',
      'wall-e': 'https://upload.wikimedia.org/wikipedia/en/c/c2/WALL-Eposter.jpg'
    };

    // 1. Direct match on ID
    if (officialPosters[idLower]) {
      return officialPosters[idLower];
    }
    // 2. Direct match on Title
    if (officialPosters[titleLower]) {
      return officialPosters[titleLower];
    }

    // 3. Regex fuzzier search for exact name segments (e.g., if user types a title with suffix or different capitalization)
    for (const key of Object.keys(officialPosters)) {
      if (titleLower.includes(key) || key.includes(titleLower)) {
        return officialPosters[key];
      }
    }

    // 4. FALLBACK to failsafe
    return getFailsafePosterUrl(movieItem);
  };

  const getCardGradient = (plotCategory: Movie['plotCategory']) => {
    switch (plotCategory) {
      case 'Ficção Científica':
        return 'from-[#00E5FF]/5 via-zinc-950/40 to-[#050505]/95 border-[#00E5FF]/10 hover:border-[#00E5FF]/30';
      case 'Ação':
        return 'from-fuchsia-950/20 via-slate-950/40 to-black/95 border-fuchsia-500/10 hover:border-fuchsia-500/30';
      case 'Drama':
        return 'from-amber-950/20 via-slate-950/40 to-black/95 border-amber-500/10 hover:border-amber-500/30';
      case 'Suspense':
        return 'from-[#0A84FF]/5 via-zinc-950/40 to-[#050505]/95 border-[#0A84FF]/10 hover:border-[#0A84FF]/25';
      case 'Fantasia':
        return 'from-purple-950/20 via-slate-950/40 to-black/95 border-purple-500/10 hover:border-purple-500/30';
      case 'Terror':
        return 'from-rose-950/20 via-slate-950/40 to-black/95 border-rose-500/10 hover:border-rose-500/30';
      default:
        return 'from-zinc-900/30 to-[#020204]/95 border-white/5 hover:border-white/10';
    }
  };


  // REUSABLE CARD RENDERER THAT SATISFIES THE CRITICAL CONTRACT:
  // "Every card (including search lookups, curated ribbons, watch queues, proximity matches, AND AI RECOMMENDATIONS) MUST support the exact same interactive confirmation status."
  const renderAppleMovieCard = (
    movieItem: Movie, 
    additionalHeaderContent?: React.ReactNode, 
    indexSuffix?: string | number,
    onDismiss?: (movieItem: Movie) => void
  ) => {
    const rating = ratings.find(r => r.movieId === movieItem.id);
    const isWatched = rating?.watched || false;
    const isFavorite = favorites.includes(movieItem.id);
    const inWatchlist = watchlist.includes(movieItem.id);
    const hasExpandedScoreTab = expandedScores[movieItem.id] || false;

    // Visual indicators based on watch progress or other ratings statuses
    const progressBadge = (() => {
      if (rating?.watchProgress === 'stopped_middle') {
        return (
          <span className="bg-orange-950/70 border border-orange-500/30 text-orange-400 text-[8.5px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 select-none">
            Parei no Meio
          </span>
        );
      }
      if (rating?.watchProgress === 'watching') {
        return (
          <span className="bg-blue-950/70 border border-blue-500/30 text-[#0A84FF] text-[8.5px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 select-none animate-pulse">
            Assistindo
          </span>
        );
      }
      if (isWatched) {
        return (
          <span className="bg-emerald-950/70 border border-emerald-500/30 text-emerald-400 text-[8.5px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 select-none">
            Já Assisti
          </span>
        );
      }
      if (rating?.notWatched) {
        return (
          <span className="bg-zinc-800/80 border border-white/10 text-zinc-300 text-[8.5px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 select-none">
            Não Assisti
          </span>
        );
      }
      if (rating?.noInterest) {
        return (
          <span className="bg-rose-950/70 border border-rose-500/30 text-rose-450 text-[8.5px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 select-none">
            Sem Interesse
          </span>
        );
      }
      return null;
    })();

    return (
      <motion.div
        layout="position"
        className="group flex flex-col relative pb-5"
        id={`card-unified-${movieItem.id}${indexSuffix !== undefined ? '-' + indexSuffix : ''}`}
        key={`card-unified-${movieItem.id}${indexSuffix !== undefined ? '-' + indexSuffix : ''}`}
      >
        {/* Aspect ratio 2:3 classic poster, rounded-2xl (16px), hidden overflow inside */}
        <div 
          onClick={() => setFocusedMovie(movieItem)}
          className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-[#050505] border border-white/5 hover:border-white/15 shadow-2xl cursor-pointer"
        >
          {/* Zooming background image */}
          <img
            src={getStablePosterUrl(movieItem)}
            alt={movieItem.title}
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = getFailsafePosterUrl(movieItem);
            }}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
          
          {/* Subtle bottom gradient from bottom with rgba(0,0,0,0.95) fading to transparent at 60% upwards */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent pointer-events-none z-10" />

          {/* Additional info badge on top left */}
          {additionalHeaderContent && (
            <div className="absolute top-3 left-3 z-20">
              {additionalHeaderContent}
            </div>
          )}

          {/* Slashed circle or 'X' button for onDismiss if provided */}
          {onDismiss && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(movieItem);
                triggerGlobalToast(`"${movieItem.title}" ocultado do seu Radar de Descobertas. 🍿`, "info");
              }}
              title="Ocultar / Sem Interesse"
              className="absolute top-3 right-3 z-30 bg-zinc-950/90 hover:bg-rose-950 border border-white/10 hover:border-rose-500/50 text-[#A1A1A6] hover:text-rose-450 p-1.5 rounded-full backdrop-blur-md transition-all duration-200 cursor-pointer shadow-md group/dismiss"
            >
              <EyeOff className="w-3.5 h-3.5 transition-transform group-hover/dismiss:scale-110" />
            </button>
          )}

          {/* Plot Category label at the top-right */}
          <div className={`absolute top-3 ${onDismiss ? 'right-11' : 'right-3'} z-20 transition-all`}>
            <span className="bg-black/70 backdrop-blur-md text-[8.5px] text-[#A1A1A6] font-mono tracking-wider font-bold px-2.5 py-1 rounded-md border border-white/10 uppercase">
              {movieItem.plotCategory}
            </span>
          </div>

          {/* Star scorer button trigger below the category badge */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedScores(prev => ({ ...prev, [movieItem.id]: !hasExpandedScoreTab }));
            }}
            className="absolute top-11 right-3 z-20 bg-black/70 hover:bg-[#00E5FF]/20 text-[#A1A1A6] hover:text-[#00E5FF] transition-all p-1.5 rounded-lg border border-white/10 focus:outline-none cursor-pointer flex items-center justify-center"
            title="Especificar Notas (Atuação, Roteiro, Visual)"
          >
            <Star className={`w-3.5 h-3.5 ${hasExpandedScoreTab || (rating?.actingScore || rating?.scriptScore || rating?.visualScore) ? 'text-[#00E5FF] fill-[#00E5FF]' : 'text-[#A1A1A6]'}`} />
          </button>

          {/* Typography Placement: INSIDE the card, resting over bottom gradient */}
          <div className="absolute bottom-5 left-0 right-0 px-4 pb-8 pt-3 flex flex-col gap-1.5 z-20 text-left pointer-events-none overflow-hidden">
            {/* Show type badge & progress */}
            <div className="flex flex-wrap items-center gap-1.5 min-h-0">
              <span className={`text-[8px] font-mono font-bold tracking-wider px-2 py-0.5 rounded border uppercase shrink-0 ${
                movieItem.type === 'Série'
                  ? 'bg-amber-950/65 border-amber-500/30 text-amber-300'
                  : 'bg-indigo-950/65 border-indigo-500/30 text-indigo-300'
              }`}>
                {movieItem.type}
              </span>
              {progressBadge}
            </div>

            {/* Title in White (Semibold, 18px / text-[18px]) */}
            <h3 className="font-sans font-semibold text-[18px] text-white leading-tight tracking-tight line-clamp-2 drop-shadow-md">
              {movieItem.title}
            </h3>

            {/* Metadata in Gray (#A1A1A6, Regular, 12px) */}
            <p className="text-[#A1A1A6] text-[12px] font-normal leading-tight truncate">
              {movieItem.year} • {movieItem.genres.slice(0, 2).join(', ')}
            </p>
          </div>

          {/* Frosted Aspect ratings container when active */}
          <AnimatePresence>
            {hasExpandedScoreTab && (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="absolute inset-x-0 bottom-0 top-0 bg-black/95 backdrop-blur-xl z-30 p-4.5 flex flex-col justify-center space-y-4 rounded-xl text-left"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-semibold text-white tracking-tight flex items-center gap-1.5 font-sans">
                    <Star className="w-3.5 h-3.5 fill-[#00E5FF] text-[#00E5FF]" />
                    Avaliar Aspectos
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedScores(prev => ({ ...prev, [movieItem.id]: false }));
                    }}
                    className="text-zinc-400 hover:text-white font-bold text-xs p-1"
                  >
                    ✕
                  </button>
                </div>
                
                {/* Atuação Star Scorer */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#A1A1A6] font-sans">🎭 Atuação</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateScores(movieItem, { actingScore: star });
                          triggerGlobalToast(`🎭 Nota de Atuação para "${movieItem.title}" atualizada para ${star}/5`, "success");
                        }}
                        className="focus:outline-none cursor-pointer hover:scale-125 transition-transform"
                      >
                        <Star className={`w-4 h-4 ${star <= (rating?.actingScore || 0) ? 'text-[#00E5FF] fill-[#00E5FF]' : 'text-zinc-700'}`} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Roteiro Star Scorer */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#A1A1A6] font-sans">📋 Roteiro</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateScores(movieItem, { scriptScore: star });
                          triggerGlobalToast(`📋 Nota de Roteiro para "${movieItem.title}" atualizada para ${star}/5`, "success");
                        }}
                        className="focus:outline-none cursor-pointer hover:scale-125 transition-transform"
                      >
                        <Star className={`w-4 h-4 ${star <= (rating?.scriptScore || 0) ? 'text-[#0A84FF] fill-[#0A84FF]' : 'text-zinc-700'}`} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visual Star Scorer */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#A1A1A6] font-sans">✨ Visual</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateScores(movieItem, { visualScore: star });
                          triggerGlobalToast(`✨ Nota Visual para "${movieItem.title}" atualizada para ${star}/5`, "success");
                        }}
                        className="focus:outline-none cursor-pointer hover:scale-125 transition-transform"
                      >
                        <Star className={`w-4 h-4 ${star <= (rating?.visualScore || 0) ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'}`} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reset button inside Drawer */}
                <div className="pt-2 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResetFeedback(movieItem);
                      triggerGlobalToast(`Avaliação de "${movieItem.title}" removida.`, "info");
                    }}
                    className="text-[10px] text-zinc-400 hover:text-rose-400 transition-colors font-mono cursor-pointer"
                  >
                    Excluir Avaliação
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Floating "Pill" shape overlapping the bottom edge of the poster (rgba(255,255,255,0.1) glassmorphism) */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[92%] h-[42px] bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur-[24px] rounded-full flex items-center justify-around shadow-[0_8px_32px_rgba(0,0,0,0.6)] transition-all duration-300 z-20">
          
          {/* CORAÇÃO (Amei/Favorito) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (rating?.liked === 'love') {
                handleResetFeedback(movieItem);
                triggerGlobalToast(`Avaliação de "${movieItem.title}" removida do seu Radar.`, "info");
              } else {
                handleChangeReaction(movieItem, 'love');
                triggerGlobalToast(`Adicionado ao seu Radar: Adorou "${movieItem.title}"! ❤️ (Mapeamento Atualizado)`, "success");
              }
            }}
            className="p-1.5 transition-all duration-200 hover:scale-115 cursor-pointer flex items-center justify-center relative group"
            title="Amei (Favorito)"
          >
            {rating?.liked === 'love' ? (
              <Heart strokeWidth={1.5} className="w-4.5 h-4.5 fill-[#00E5FF] text-[#00E5FF] scale-110 drop-shadow-[0_0_6px_rgba(0,229,255,0.4)]" />
            ) : (
              <Heart strokeWidth={1.5} className="w-4.5 h-4.5 text-[#EBEBF5]/90 group-hover:text-[#00E5FF]" />
            )}
          </button>

          {/* THUMBS UP (Gostei/Lindo) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (rating?.liked === 'like') {
                handleResetFeedback(movieItem);
                triggerGlobalToast(`Avaliação de "${movieItem.title}" removida do seu Radar.`, "info");
              } else {
                handleChangeReaction(movieItem, 'like');
                triggerGlobalToast(`Adicionado ao seu Radar: Gostou de "${movieItem.title}" 👍 (Mapeamento Atualizado)`, "success");
              }
            }}
            className="p-1.5 transition-all duration-200 hover:scale-115 cursor-pointer flex items-center justify-center relative group"
            title="Gostei"
          >
            {rating?.liked === 'like' && !rating?.notWatched ? (
              <ThumbsUp strokeWidth={1.5} className="w-4.5 h-4.5 fill-[#00E5FF] text-[#00E5FF] scale-110 drop-shadow-[0_0_6px_rgba(0,229,255,0.4)]" />
            ) : (
              <ThumbsUp strokeWidth={1.5} className="w-4.5 h-4.5 text-[#EBEBF5]/90 group-hover:text-[#00E5FF]" />
            )}
          </button>

          {/* THUMBS DOWN (Não Curti) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (rating?.liked === 'dislike') {
                handleResetFeedback(movieItem);
                triggerGlobalToast(`Avaliação de "${movieItem.title}" removida do seu Radar.`, "info");
              } else {
                handleChangeReaction(movieItem, 'dislike');
                triggerGlobalToast(`Sinalizado como: Não curti "${movieItem.title}" 👎 (Mapeamento Atualizado)`, "info");
              }
            }}
            className="p-1.5 transition-all duration-200 hover:scale-115 cursor-pointer flex items-center justify-center relative group"
            title="Não Curti"
          >
            {rating?.liked === 'dislike' && !rating?.notWatched ? (
              <ThumbsDown strokeWidth={1.5} className="w-4.5 h-4.5 fill-rose-550 text-rose-500 scale-110" />
            ) : (
              <ThumbsDown strokeWidth={1.5} className="w-4.5 h-4.5 text-[#EBEBF5]/90 group-hover:text-rose-550" />
            )}
          </button>

          {/* BOOKMARK (Quero Assistir) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleWatchlist(movieItem);
              if (inWatchlist) {
                triggerGlobalToast(`"${movieItem.title}" removido do "Quero Assistir".`, "info");
              } else {
                triggerGlobalToast(`"${movieItem.title}" adicionado ao "Quero Assistir" 🍿 (Fila atualizada)`, "success");
              }
            }}
            className="p-1.5 transition-all duration-200 hover:scale-115 cursor-pointer flex items-center justify-center relative group"
            title="Quero Assistir"
          >
            {inWatchlist ? (
              <Bookmark strokeWidth={1.5} className="w-4.5 h-4.5 fill-[#00E5FF] text-[#00E5FF] scale-110 drop-shadow-[0_0_6px_rgba(0,229,255,0.4)]" />
            ) : (
              <Bookmark strokeWidth={1.5} className="w-4.5 h-4.5 text-[#EBEBF5]/90 group-hover:text-purple-300" />
            )}
          </button>

          {/* OLHO/CHECK (Marcar "Já Assisti") */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleWatched(movieItem);
              if (isWatched) {
                triggerGlobalToast(`"${movieItem.title}" marcado como não assistido.`, "info");
              } else {
                triggerGlobalToast(`Já assistiu a "${movieItem.title}"! ✔ (Mapeamento Atualizado)`, "success");
              }
            }}
            className="p-1.5 transition-all duration-200 hover:scale-115 cursor-pointer flex items-center justify-center relative group"
            title="Já Assisti (Sem Nota)"
          >
            {isWatched ? (
              <Eye strokeWidth={1.5} className="w-4.5 h-4.5 fill-[#00E5FF]/20 text-[#00E5FF] scale-110" />
            ) : (
              <Eye strokeWidth={1.5} className="w-4.5 h-4.5 text-[#EBEBF5]/90 group-hover:text-emerald-400" />
            )}
          </button>

        </div>
      </motion.div>
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-zinc-150 relative font-sans">
        {/* Background Cinematic Ambient Lights */}
        <div className="absolute top-[-15%] left-[-20%] w-[600px] h-[600px] bg-[#00E5FF]/5 rounded-full blur-[180px] pointer-events-none z-0"></div>
        <div className="relative w-16 h-16 flex items-center justify-center mb-4 z-10">
          <div className="w-full h-full rounded-full border-4 border-zinc-900 border-t-[#00E5FF] animate-spin" />
          <Sparkles className="w-6 h-6 text-[#00E5FF] absolute animate-pulse" />
        </div>
        <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase z-10">Iniciando Stream Radar...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans flex flex-col items-center justify-center overflow-y-auto px-4 py-8 selection:bg-[#00E5FF]/30 selection:text-white relative">
        {/* Background Cinematic Ambient Lights */}
        <div className="absolute top-[-15%] left-[-20%] w-[800px] h-[800px] bg-[#00E5FF]/10 rounded-full blur-[180px] pointer-events-none z-0"></div>
        <div className="absolute bottom-[-5%] right-[-10%] w-[600px] h-[600px] bg-indigo-900/10 rounded-full blur-[140px] pointer-events-none z-0"></div>

        <div className="max-w-md w-full bg-zinc-950/60 border border-white/10 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl relative z-10 flex flex-col gap-6 text-center">
          
          {/* Brand */}
          <div className="flex flex-col items-center gap-3 select-none">
            <div className="bg-white/5 p-3.5 rounded-2xl shadow-2xl border border-white/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-[#00E5FF] drop-shadow-[0_0_8px_rgba(0,229,255,0.45)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="18" r="1.5" fill="currentColor" />
                <path d="M8.5 14.5a5 5 0 0 1 7 0" />
                <path d="M5 11c3.5-3.5 10.5-3.5 14 0" />
              </svg>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1.5">
                <h1 className="font-display text-3xl font-extrabold tracking-tight text-white font-sans">
                  Stream <span className="text-zinc-400">Radar</span>
                </h1>
                <span className="text-[9px] font-mono leading-none tracking-widest text-[#050505] font-black bg-[#00E5FF] px-1.5 py-0.5 rounded shadow-sm">
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold font-mono mt-1">Curadoria & Feedback Instantâneo</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg md:text-xl font-bold text-white tracking-tight font-sans">
              {isForgotPassword ? "Recuperação de Senha" : (isRegister ? "Criar nova conta" : "Entrar no sistema")}
            </h2>
            <p className="text-xs md:text-sm text-zinc-400 font-sans">
              {isForgotPassword ? "Enviaremos um link para redefinir sua senha." : (isRegister ? "Registre-se para sincronizar seu Perfil Cognitivo" : "Acesse seu radar de recomendações personalizadas")}
            </p>
          </div>

          <form onSubmit={isForgotPassword ? handleForgotPasswordSubmit : handleAuthSubmit} className="space-y-4 text-left">
            <div>
              <label className="text-[10px] text-zinc-405 block mb-1 font-mono uppercase font-semibold">Endereço de E-mail</label>
              <input 
                type="email" 
                required 
                placeholder="nome@provedor.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#070709]/80 border border-white/10 text-xs text-white rounded-xl px-4 py-3 placeholder-zinc-650 focus:outline-none focus:border-[#00E5FF] focus:shadow-[0_0_15px_rgba(0,229,255,0.15)] transition-all font-sans"
              />
            </div>

            {!isForgotPassword && (
              <div>
                <label className="text-[10px] text-zinc-405 block mb-1 font-mono uppercase font-semibold">Sua Senha</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#070709]/80 border border-white/10 text-xs text-white rounded-xl pl-4 pr-10 py-3 placeholder-zinc-650 focus:outline-none focus:border-[#00E5FF] focus:shadow-[0_0_15px_rgba(0,229,255,0.15)] transition-all font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {isRegister && !isForgotPassword && (
              <div>
                <label className="text-[10px] text-zinc-405 block mb-1 font-mono uppercase font-semibold">Confirmar Senha</label>
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  placeholder="••••••••" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#070709]/80 border border-white/10 text-xs text-white rounded-xl px-4 py-3 placeholder-zinc-650 focus:outline-none focus:border-[#00E5FF] focus:shadow-[0_0_15px_rgba(0,229,255,0.15)] transition-all font-sans"
                />
              </div>
            )}

            {authError && (
              <div className="bg-rose-950/20 border border-rose-500/25 p-3 rounded-xl text-rose-300 text-xs flex gap-2 items-center">
                <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button 
              type="submit" 
              disabled={authFormLoading}
              className="w-full bg-[#00E5FF] hover:bg-cyan-300 text-zinc-950 font-black py-3 rounded-xl text-xs sm:text-sm font-mono tracking-widest uppercase cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 shadow-[0_0_20px_rgba(0,229,255,0.2)] hover:shadow-[0_0_35px_rgba(0,229,255,0.45)] mt-2 flex items-center justify-center gap-1.5"
            >
              {authFormLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Prosseguir"}
            </button>
          </form>

          {!isForgotPassword && !isRegister && (
            <div className="text-center mt-2">
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(true);
                  setAuthError(null);
                }}
                className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Esqueci minha senha
              </button>
            </div>
          )}

          <div className="border-t border-white/5 pt-4">
            <button
              onClick={() => {
                setIsForgotPassword(false);
                setIsRegister(!isRegister);
                setAuthError(null);
              }}
              className="text-xs text-[#00E5FF] hover:underline cursor-pointer font-sans"
            >
              {isForgotPassword 
                ? "Voltar para o Login" 
                : (isRegister ? "Já possui conta? Faça login" : "Ainda não tem conta? Cadastre-se")}
            </button>
          </div>

        </div>
      </div>
    );
  }

  // Mandatory Onboarding overlay for logged in users who haven't completed onboarding
  const onboardingRatedCount = onboardingMovies.filter(m => ratings.some(r => r.movieId === m.id && r.watched)).length;

  if (user && !hasCompletedOnboarding) {
    return (
      <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans px-4 py-8 flex flex-col items-center justify-center overflow-y-auto selection:bg-[#00E5FF]/30 selection:text-white relative">
        {/* Background Cinematic Ambient Lights */}
        <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] bg-[#00E5FF]/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[150px] pointer-events-none" />

        <div className="max-w-4xl w-full bg-zinc-950/60 border border-white/10 backdrop-blur-2xl rounded-3xl p-6 md:p-8 shadow-2xl relative z-10 flex flex-col gap-6 text-center">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-[#00E5FF]/10 border border-[#00E5FF]/35 px-3.5 py-1.5 rounded-full mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#00E5FF] animate-pulse" />
              <span className="text-[10px] font-mono font-bold tracking-widest text-[#00E5FF] uppercase">Onboarding Inicial</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-sans font-black text-white tracking-tight">
              Bem-vindo ao Stream Radar!
            </h2>
            <p className="text-xs md:text-sm text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              Para decodificar o seu perfil cognitivo de espectador e treinar nossa inteligência artificial, avalie pelo menos <strong className="text-white">5 filmes</strong> populares da lista abaixo.
            </p>
          </div>

          {onboardingLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#00E5FF]" />
              <span className="text-xs text-zinc-505 font-mono">Carregando acervo popular...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Progress Bar */}
              <div className="bg-[#111111]/80 border border-white/5 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-left font-sans">
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Progresso da Sintonia</span>
                  <span className="text-xs font-semibold text-zinc-200">
                    {onboardingRatedCount >= 5 
                      ? "✨ Sintonia mínima atingida! Você pode continuar avaliando ou entrar agora." 
                      : `Avalie mais ${5 - onboardingRatedCount} filme(s) para liberar o acesso.`}
                  </span>
                </div>
                
                <div className="flex items-center gap-4 w-full sm:w-auto shrink-0">
                  <div className="w-36 bg-zinc-900 h-2 rounded-full overflow-hidden border border-white/5">
                    <div 
                      className="bg-gradient-to-r from-[#00E5FF] to-[#0A84FF] h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (onboardingRatedCount / 5) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono font-bold text-[#00E5FF] bg-[#00E5FF]/10 border border-[#00E5FF]/25 px-2.5 py-1 rounded-md shrink-0">
                    {onboardingRatedCount} / 5
                  </span>
                </div>
              </div>

              {/* Onboarding grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[420px] overflow-y-auto pr-2 scrollbar-thin">
                {onboardingMovies.map((movie) => {
                  const rating = ratings.find(r => r.movieId === movie.id);
                  const isRated = rating?.watched || false;
                  
                  return (
                    <div 
                      key={movie.id} 
                      className={`bg-zinc-900/40 border rounded-2xl p-3 flex flex-col justify-between transition-all duration-300 text-left relative overflow-hidden group ${
                        isRated 
                          ? 'border-[#00E5FF]/40 bg-[#00E5FF]/5 shadow-[0_0_15px_rgba(0,229,255,0.05)]' 
                          : 'border-white/5 hover:border-white/15'
                      }`}
                    >
                      <div className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-[#050505] border border-white/5 mb-3 relative">
                        <img 
                          src={getStablePosterUrl(movie)} 
                          alt={movie.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = getFailsafePosterUrl(movie);
                          }}
                        />
                        {isRated && (
                          <div className="absolute top-2 right-2 bg-[#00E5FF] text-zinc-950 p-1.5 rounded-full shadow-md z-10">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-0.5 mb-3">
                        <h4 className="text-xs font-bold text-white line-clamp-1 group-hover:text-[#00E5FF] transition-colors">
                          {movie.title}
                        </h4>
                        <p className="text-[9px] text-zinc-500 font-mono">{movie.year}</p>
                      </div>

                      {/* Onboarding simple rating options */}
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleChangeReaction(movie, 'love')}
                          className={`flex-1 py-1.5 rounded-lg text-center text-[10px] transition-all cursor-pointer ${
                            rating?.liked === 'love' 
                              ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 font-bold scale-105' 
                              : 'bg-zinc-950/60 text-zinc-400 border border-white/5 hover:bg-zinc-900'
                          }`}
                          title="Amei"
                        >
                          ❤️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangeReaction(movie, 'like')}
                          className={`flex-1 py-1.5 rounded-lg text-center text-[10px] transition-all cursor-pointer ${
                            rating?.liked === 'like' 
                              ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 font-bold scale-105' 
                              : 'bg-zinc-950/60 text-zinc-400 border border-white/5 hover:bg-zinc-900'
                          }`}
                          title="Gostei"
                        >
                          👍
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangeReaction(movie, 'dislike')}
                          className={`flex-1 py-1.5 rounded-lg text-center text-[10px] transition-all cursor-pointer ${
                            rating?.liked === 'dislike' 
                              ? 'bg-rose-950/20 text-rose-450 border border-rose-500/30 font-bold scale-105' 
                              : 'bg-zinc-950/60 text-zinc-400 border border-white/5 hover:bg-zinc-900'
                          }`}
                          title="Não Gostei"
                        >
                          👎
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Submit Button */}
              <button
                type="button"
                disabled={onboardingRatedCount < 5}
                onClick={async () => {
                  try {
                    setHasCompletedOnboarding(true);
                    triggerGlobalToast("Onboarding concluído! Sincronizando seu perfil...", "success");
                    // Trigger profile generation after onboarding
                    setTimeout(() => {
                      triggerAIAnalysis();
                    }, 500);
                  } catch (e) {
                    triggerGlobalToast("Erro ao finalizar onboarding.", "error");
                  }
                }}
                className="w-full bg-[#00E5FF] hover:bg-cyan-300 text-zinc-950 font-black py-3 rounded-xl text-xs sm:text-sm font-mono tracking-widest uppercase cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 shadow-[0_0_20px_rgba(0,229,255,0.25)] hover:shadow-[0_0_30px_rgba(0,229,255,0.45)]"
              >
                ✔ Finalizar Sintonia & Entrar no App
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans cinema-grid pb-24 selection:bg-[#00E5FF]/30 selection:text-white relative overflow-hidden">
      
      {/* Background Cinematic Ambient Lights */}
      <div className="absolute top-[-15%] left-[-20%] w-[800px] h-[800px] bg-[#00E5FF]/10 rounded-full blur-[180px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-5%] right-[-10%] w-[600px] h-[600px] bg-indigo-900/10 rounded-full blur-[140px] pointer-events-none z-0"></div>

      {/* STICKY APPLE TV NAVIGATION DESIGN */}
      <header className="sticky top-0 z-40 bg-[#050505]/80 backdrop-blur-2xl border-b border-white/5 px-6 py-4.5">
        <div className="max-w-7xl mx-auto flex flex-row justify-between items-center w-full gap-4">
          
          {/* Logo Brand Overhaul — clickable to reset state & scroll to top */}
          <button
            onClick={() => {
              setActiveTab('catalog');
              setOnlineSearchQuery('');
              setOnlineSearchResult(null);
              setTmdbSearchResults(null);
              setActivePlatformFilter('all');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-3 select-none shrink-0 cursor-pointer group/logo active:scale-95 transition-transform duration-150"
            aria-label="Stream Radar — Ir para o início"
          >
            <div className="bg-white/5 p-2 rounded-2xl shadow-2xl border border-white/10 flex items-center justify-center group-hover/logo:border-[#00E5FF]/30 group-hover/logo:bg-[#00E5FF]/5 transition-all duration-200">
              <svg className="w-6 h-6 text-[#00E5FF] drop-shadow-[0_0_8px_rgba(0,229,255,0.45)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="18" r="1.5" fill="currentColor" />
                <path d="M8.5 14.5a5 5 0 0 1 7 0" />
                <path d="M5 11c3.5-3.5 10.5-3.5 14 0" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-display text-xl font-extrabold tracking-tight text-white font-sans group-hover/logo:text-[#00E5FF] transition-colors duration-200">
                  Stream <span className="text-zinc-400 group-hover/logo:text-white transition-colors duration-200">Radar</span>
                </h1>
                <span className="text-[9px] font-mono leading-none tracking-widest text-[#050505] font-black bg-[#00E5FF] px-1.5 py-0.5 rounded shadow-sm">
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold font-mono">Curadoria & Feedback Instantâneo</p>
            </div>
          </button>

          {/* Centralized Apple Horizontal Tabs Row */}
          <nav className="flex flex-row overflow-x-auto whitespace-nowrap gap-3 pb-2 scrollbar-hide w-full bg-zinc-900/90 p-1 rounded-2xl border border-white/5 backdrop-blur-xl md:justify-center">
            <button
              onClick={() => {
                setActiveTab('catalog');
                setTimeout(() => {
                  document.getElementById('section-exploracoes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
              }}
              className={`shrink-0 px-4 py-2 text-xs font-semibold rounded-xl tracking-tight transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                activeTab === 'catalog'
                  ? 'bg-white text-zinc-900 shadow-md scale-[1.02] font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              🎞️ Explorações
            </button>
            <button
              onClick={() => {
                setActiveTab('watchlist');
                setTimeout(() => {
                  document.getElementById('section-quero-assistir')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
              }}
              className={`shrink-0 px-4 py-2 text-xs font-semibold rounded-xl tracking-tight transition-all flex items-center gap-2 cursor-pointer active:scale-95 ${
                activeTab === 'watchlist'
                  ? 'bg-white text-zinc-900 shadow-md scale-[1.02] font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              🍿 Quero Assistir
              {localStats.totalWatchlist > 0 && (
                <span className={`text-[10px] font-bold rounded-md px-1.5 py-0.2 ${activeTab === 'watchlist' ? 'bg-zinc-900 text-white' : 'bg-indigo-500 text-white'}`}>
                  {localStats.totalWatchlist}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('history');
                setTimeout(() => {
                  document.getElementById('section-historico')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
              }}
              className={`shrink-0 px-4 py-2 text-xs font-semibold rounded-xl tracking-tight transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                activeTab === 'history'
                  ? 'bg-white text-zinc-900 shadow-md scale-[1.02] font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              📂 Histórico
              {ratings.length > 0 && (
                <span className={`text-[10px] font-bold rounded-md px-1.5 py-0.2 ${activeTab === 'history' ? 'bg-zinc-900 text-semi' : 'bg-[#1e1e2d] border border-indigo-500/15 text-indigo-400'}`}>
                  {ratings.length}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('analytics');
                setTimeout(() => {
                  document.getElementById('section-perfil-cognitivo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
              }}
              className={`shrink-0 px-4 py-2 text-xs font-semibold rounded-xl tracking-tight transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                activeTab === 'analytics'
                  ? 'bg-white text-zinc-900 shadow-md scale-[1.02] font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              🧠 Perfil Cognitivo
              {ratings.length > 0 && (
                <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
              )}
            </button>
          </nav>

          {/* Top Reset actions on the right */}
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <span className="text-xs text-indigo-400 font-bold font-mono">
                Base Pessoal: {localStats.totalWatched} produções avaliadas
              </span>
            </div>

            {user && (
              <div className="flex items-center gap-2.5 border-l border-white/10 pl-4 relative">
                <button 
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="w-8 h-8 rounded-full border border-gray-600 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer shrink-0"
                >
                  <User className="w-4 h-4 text-zinc-400" />
                </button>
                {isProfileMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-[#0a0a0a]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-2 z-50">
                    <div className="px-3 py-2 border-b border-white/5 mb-1">
                      <p className="text-[10px] text-zinc-500 font-mono truncate" title={user.email}>{user.email}</p>
                    </div>
                    <button 
                      onClick={async () => {
                        try {
                          await resetPassword(user.email);
                          triggerGlobalToast("Link de recuperação enviado para o seu e-mail", "success");
                        } catch (e) {
                          triggerGlobalToast("Erro ao enviar email", "error");
                        }
                      }}
                      className="w-full text-left text-xs text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg px-3 py-2 transition-colors cursor-pointer"
                    >
                      Redefinir Senha
                    </button>
                    <button 
                      onClick={async () => {
                        try {
                          await logOut();
                          triggerGlobalToast("Você saiu com sucesso.", "info");
                        } catch (e) {
                          triggerGlobalToast("Erro ao sair.", "error");
                        }
                      }}
                      className="w-full text-left text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg px-3 py-2 transition-colors mt-1 cursor-pointer"
                    >
                      Sair
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 mt-8 relative z-10">

        {/* 1. EXPORATIONS VIEW PORT Tab */}
        {activeTab === 'catalog' && (
          <div id="section-exploracoes" className="space-y-12 animate-fade-in text-left">

            {/* RADAR DE DESCOBERTAS: PARA VOCÊ (INFINITE DISCOVERY FEED) */}
            <section className="bg-zinc-950/60 border border-[#00E5FF]/10 rounded-3xl p-4 md:p-6 shadow-[0_0_50px_rgba(0,229,255,0.02)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-[#00E5FF]/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#00E5FF] animate-pulse" />
                    <h3 className="font-display font-black text-base md:text-lg text-white tracking-tight">
                      Radar de Descobertas: <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E5FF] to-purple-400">Para Você</span>
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Títulos filtrados com base no seu Perfil Cognitivo. Avalie para refinar ainda mais o seu radar.
                  </p>
                </div>
                {(visibleDiscoveryMovies.length > 0 || isReplenishingDiscovery) && (
                  <span className="text-[10px] font-mono bg-[#00E5FF]/10 border border-[#00E5FF]/20 text-[#00E5FF] px-3 py-1 rounded-xl block font-bold shrink-0">
                    🍿 {isReplenishingDiscovery ? "Sincronizando..." : `${visibleDiscoveryMovies.length} Recomendações`}
                  </span>
                )}
              </div>

              {isReplenishingDiscovery ? (
                <div className="bg-[#0c0c12]/40 rounded-3xl border border-[#00E5FF]/25 py-14 px-6 text-center max-w-xl mx-auto flex flex-col items-center gap-6 shadow-[0_0_40px_rgba(0,229,255,0.06)] animate-fade-in">
                  {/* Pristine Electric Cyan (#00E5FF) pulsing radar circle */}
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#00E5FF]/10 animate-ping opacity-75"></span>
                    <div className="relative rounded-full h-14 w-14 bg-gradient-to-tr from-[#00E5FF] to-[#0080FF] p-[1.5px] shadow-[0_0_20px_rgba(0,229,255,0.35)] animate-spin">
                      <div className="w-full h-full bg-zinc-950 rounded-full flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-[#00E5FF]" />
                      </div>
                    </div>
                    {/* Absolute radar sweeping line */}
                    <div className="absolute inset-0 border border-[#00E5FF]/30 rounded-full animate-pulse scale-125 pointer-events-none" />
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="font-sans font-black text-xs text-[#00E5FF] tracking-widest uppercase">
                      Processando Interações...
                    </h4>
                    <p className="text-[11px] text-zinc-300 max-w-xs mx-auto font-sans leading-relaxed">
                      Buscando novas compatibilidades no acervo para recalibrar o seu feed.
                    </p>
                  </div>
                </div>
              ) : visibleDiscoveryMovies.length === 0 ? (
                <div className="bg-[#0c0c12]/50 rounded-2xl border border-white/5 py-12 px-6 text-center max-w-lg mx-auto flex flex-col items-center gap-3">
                  <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse" />
                  <h4 className="font-bold text-sm text-zinc-200">Seu radar está temporariamente sem novos sinais</h4>
                  <p className="text-xs text-zinc-400 italic">
                    Você já curou ou adicionou filtros para todos os títulos disponíveis no momento! Limpe os dados do seu banco ou faça uma consulta de IA global para injetar mais títulos.
                  </p>
                </div>
              ) : (
                <div className="relative group/carousel">
                  {/* Left Scroll Button */}
                  <button
                    onClick={() => scrollDiscoveryCarousel('left')}
                    className="absolute left-[-16px] top-1/2 -translate-y-1/2 z-40 bg-zinc-950/90 hover:bg-zinc-900 border border-[#00E5FF]/30 text-[#00E5FF] hover:scale-110 p-2.5 rounded-full backdrop-blur-md transition-all duration-200 cursor-pointer shadow-[0_0_15px_rgba(0,229,255,0.15)] opacity-0 group-hover/carousel:opacity-100 hidden md:flex items-center justify-center select-none"
                    title="Anterior"
                  >
                    <ChevronRight className="w-5 h-5 rotate-180" />
                  </button>

                  {/* Right Scroll Button */}
                  <button
                    onClick={() => scrollDiscoveryCarousel('right')}
                    className="absolute right-[-16px] top-1/2 -translate-y-1/2 z-40 bg-zinc-950/90 hover:bg-zinc-900 border border-[#00E5FF]/30 text-[#00E5FF] hover:scale-110 p-2.5 rounded-full backdrop-blur-md transition-all duration-200 cursor-pointer shadow-[0_0_15px_rgba(0,229,255,0.15)] opacity-0 group-hover/carousel:opacity-100 hidden md:flex items-center justify-center select-none"
                    title="Próximo"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  <div 
                    ref={discoveryCarouselRef}
                    className="flex overflow-x-auto gap-5 pb-4 scrollbar-none scroll-smooth mask-image"
                  >
                    <AnimatePresence mode="popLayout">
                      {visibleDiscoveryMovies.map((movie, idx) => (
                        <motion.div
                          key={`discovery-${movie.id}`}
                          layout
                          initial={{ opacity: 0, scale: 0.9, x: 20 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.9, x: -50, transition: { duration: 0.3 } }}
                          transition={{ duration: 0.3, ease: 'easeOut' }}
                          className="min-w-[270px] md:min-w-[310px] max-w-[325px] shrink-0"
                        >
                          {renderAppleMovieCard(movie, (
                            <div className="absolute top-2.5 left-2.5 bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30 text-[8px] font-mono font-bold px-2 py-0.5 rounded-md backdrop-blur-md shadow-md z-10 uppercase tracking-wider">
                              💡 Afinidade IA
                            </div>
                          ), `discovery-${movie.id}`, handleMarkNoInterest)}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </section>
            
            {/* COGNITIVE RADAR DASHBOARD HERO SECTION */}
            <section className="relative rounded-3xl overflow-hidden min-h-[340px] flex items-center p-8 md:p-12 border border-[#00E5FF]/20 shadow-[0_0_40px_rgba(0,229,255,0.06)] bg-[#050505] relative z-10 w-full mb-8">
              {/* Concentric radar waves and data mesh animation */}
              <div className="absolute inset-0 bg-[#050505] -z-10" />
              
              <svg className="absolute right-0 top-1/2 -translate-y-1/2 h-full w-full max-w-[480px] opacity-25 pointer-events-none md:block hidden z-0" viewBox="0 0 400 400" fill="none">
                <circle cx="200" cy="200" r="160" stroke="#00E5FF" strokeWidth="1" strokeDasharray="3 6" className="animate-[spin_180s_linear_infinite]" />
                <circle cx="200" cy="200" r="120" stroke="#00E5FF" strokeWidth="1.5" strokeDasharray="6 6" className="animate-[spin_90s_linear_infinite_reverse]" />
                <circle cx="200" cy="200" r="80" stroke="#00E5FF" strokeWidth="2" strokeDasharray="2 4" />
                <circle cx="200" cy="200" r="40" stroke="#00E5FF" strokeWidth="1.5" strokeDasharray="1 3" />
                <line x1="200" y1="20" x2="200" y2="380" stroke="#00E5FF" strokeWidth="0.5" strokeDasharray="2 4" />
                <line x1="20" y1="200" x2="380" y2="200" stroke="#00E5FF" strokeWidth="0.5" strokeDasharray="2 4" />
                <circle cx="200" cy="80" r="3" fill="#00E5FF" className="animate-ping" />
                <circle cx="280" cy="200" r="3.5" fill="#00E5FF" className="animate-pulse" />
              </svg>

              {ratings.length < 20 ? (
                /* ── LOCKED: threshold not yet reached ── */
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 w-full justify-center text-center md:text-left">
                  {/* Radar animation */}
                  <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#00E5FF]/10 animate-ping opacity-75" />
                    <div className="relative rounded-full h-20 w-20 bg-gradient-to-tr from-[#00E5FF] to-[#0A84FF] p-[2px] shadow-[0_0_30px_rgba(0,229,255,0.4)] animate-spin">
                      <div className="w-full h-full bg-zinc-950 rounded-full flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-[#00E5FF] animate-pulse" />
                      </div>
                    </div>
                    <div className="absolute inset-0 border border-[#00E5FF]/20 rounded-full animate-pulse scale-125 pointer-events-none" />
                    <div className="absolute inset-0 border border-[#00E5FF]/10 rounded-full animate-pulse scale-150 pointer-events-none" />
                  </div>

                  {/* Calibration text + progress */}
                  <div className="flex flex-col gap-3 max-w-md">
                    <div className="inline-flex items-center gap-2 bg-[#00E5FF]/10 border border-[#00E5FF]/35 px-3.5 py-1.5 rounded-full self-start mx-auto md:mx-0">
                      <span className="flex h-1.5 w-1.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00E5FF] opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#00E5FF]" />
                      </span>
                      <span className="text-[10px] md:text-xs font-mono font-black tracking-widest text-[#00E5FF] uppercase">
                        Mapeamento Cognitivo Ativo
                      </span>
                    </div>

                    <h2 className="text-2xl md:text-3xl font-sans font-black text-white leading-tight tracking-tight">
                      Calibrando seu perfil cognitivo...
                    </h2>
                    <p className="text-sm text-zinc-300 font-sans leading-relaxed">
                      Avalie mais{' '}
                      <strong className="text-[#00E5FF] font-black">{20 - ratings.length}</strong>
                      {' '}produções para revelar seu Arquétipo.
                    </p>

                    {/* Progress bar */}
                    <div className="w-full max-w-xs bg-zinc-900 h-2 rounded-full overflow-hidden border border-white/5">
                      <div
                        className="bg-gradient-to-r from-[#00E5FF] to-[#0A84FF] h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(0,229,255,0.5)]"
                        style={{ width: `${Math.min(100, (ratings.length / 20) * 100)}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
                      Sintonia atual: {ratings.length} / 20 avaliações
                    </div>
                  </div>
                </div>
              ) : (
                /* ── UNLOCKED: threshold reached ── */
                <div className="max-w-2xl relative z-10 flex flex-col items-start text-left gap-4">
                  <div className="inline-flex items-center gap-2 bg-[#00E5FF]/10 border border-[#00E5FF]/35 px-3.5 py-1.5 rounded-full">
                    <span className="flex h-1.5 w-1.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00E5FF] opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#00E5FF]" />
                    </span>
                    <span className="text-[10px] md:text-xs font-mono font-black tracking-widest text-[#00E5FF] uppercase">
                      Mapeamento Cognitivo Ativo
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-sans font-black text-white leading-tight tracking-tight">
                      {aiProfile ? aiProfile.archetypeName : 'Perfil: O Arquiteto de Labirintos Existenciais'}
                    </h2>
                    <p className="text-xs md:text-sm text-[#A1A1A6] font-semibold font-sans tracking-wide">
                      {ratings.length} Produções Analisadas &nbsp;|&nbsp; {aiProfile ? aiProfile.narrativeThemesInCommon[0] : 'Afinidade: Sci-Fi'}
                    </p>
                    {aiProfile && (
                      <p className="text-sm md:text-base text-zinc-300 font-sans leading-relaxed max-w-2xl mt-4">
                        {aiProfile.archetypeDescription}
                      </p>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => {
                        handleGenerateCognitiveProfile();
                        if (typeof window !== 'undefined') {
                          const btn = document.getElementById('ai-pulse-radar-btn');
                          if (btn) {
                            btn.classList.add('scale-95');
                            setTimeout(() => btn.classList.remove('scale-95'), 150);
                          }
                        }
                      }}
                      disabled={isGeneratingAIProfile}
                      id="ai-pulse-radar-btn"
                      className="bg-[#00E5FF] text-[#050505] px-6 py-3 rounded-xl text-xs sm:text-sm font-bold hover:bg-cyan-300 transition-all font-mono tracking-wider flex items-center gap-2 shadow-[0_0_25px_rgba(0,229,255,0.25)] hover:shadow-[0_0_35px_rgba(0,229,255,0.45)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGeneratingAIProfile ? (
                        <Loader2 className="w-4 h-4 text-[#050505] animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-[#050505]" />
                      )}
                      {isGeneratingAIProfile ? "Processando DNA Cinematográfico..." : "Atualizar Mapeamento por IA"}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* DYNAMIC IA GLOBAL SEARCH SYSTEM ("thousands & hundreds of thousands of films") */}
            <section className="bg-zinc-900/35 border border-white/10 rounded-3xl p-4 md:p-6 backdrop-blur-xl relative">
              <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-display font-extrabold text-lg text-white flex items-center gap-2">
                    <Sparkle className="w-5 h-5 text-amber-500 animate-pulse" />
                    Busca Cinemática Canônica Global (IA)
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Insira o nome de <span className="text-indigo-400 font-semibold">absolutamente qualquer título</span> de cinema ou TV. O servidor gerará a ficha analítica canônica original instantaneamente.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddCustomForm(!showAddCustomForm)}
                    className="text-xs bg-zinc-850/80 border border-white/5 text-zinc-300 px-3.5 py-2 rounded-xl hover:text-white hover:border-white/25 transition-all flex items-center gap-1 font-sans"
                  >
                    <Plus className="w-4 h-4" />
                    {showAddCustomForm ? "Ocultar Formulário" : "Inserir de Forma Manual"}
                  </button>
                </div>
              </div>

              {/* Advanced Custom manual form */}
              <AnimatePresence>
                {showAddCustomForm && (
                  <motion.form 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    onSubmit={handleAddNewCustomMovieManual}
                    className="bg-black/60 border border-white/5 rounded-2xl p-5 mb-5 space-y-4 text-left overflow-hidden"
                  >
                    <h4 className="text-xs uppercase font-mono tracking-wider font-bold text-indigo-400 flex items-center gap-1.5">
                      <Layers className="w-4 h-4" /> Registrar Título Manualmente no App
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Título em Português*</label>
                        <input 
                          type="text" 
                          required 
                          placeholder="Ex: O Lobo de Wall Street" 
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                          className="w-full bg-[#070709]/80 border border-white/10 text-xs text-white rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase font-bold">Título Original</label>
                        <input 
                          type="text" 
                          placeholder="Ex: The Wolf of Wall Street" 
                          value={formOriginalTitle}
                          onChange={(e) => setFormOriginalTitle(e.target.value)}
                          className="w-full bg-[#070709]/80 border border-white/10 text-xs text-white rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Formato</label>
                        <select 
                          value={formType}
                          onChange={(e) => setFormType(e.target.value as any)}
                          className="w-full bg-[#070709]/80 border border-white/10 text-xs text-zinc-300 rounded-lg px-3 py-2"
                        >
                          <option value="Filme">Filme (Inclusivo curtas-metragens)</option>
                          <option value="Série">Série (Inclusivo mini-séries)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Ano de Lançamento</label>
                        <input 
                          type="number" 
                          placeholder="Ex: 2013" 
                          value={formYear}
                          onChange={(e) => setFormYear(Number(e.target.value))}
                          className="w-full bg-[#070709]/80 border border-white/10 text-xs text-white rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercaseName font-bold">Direção / Showrunner</label>
                        <input 
                          type="text" 
                          placeholder="Ex: Martin Scorsese" 
                          value={formDirector}
                          onChange={(e) => setFormDirector(e.target.value)}
                          className="w-full bg-[#070709]/80 border border-white/10 text-xs text-white rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Vibe da Categoria</label>
                        <select 
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                          className="w-full bg-[#070709]/80 border border-white/10 text-xs text-zinc-300 rounded-lg px-3 py-2"
                        >
                          <option value="Drama">Drama / Realidade</option>
                          <option value="Ação">Ação / adrenalina</option>
                          <option value="Comédia">Comédia / Sátira</option>
                          <option value="Ficção Científica">Ficção Científica</option>
                          <option value="Suspense">Suspense / Terror</option>
                          <option value="Fantasia">Fantasia</option>
                          <option value="Terror">Terror</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Gêneros (Separados por vírgula)</label>
                        <input 
                          type="text" 
                          placeholder="Drama, Biografia, Comédia" 
                          value={formGenresText}
                          onChange={(e) => setFormGenresText(e.target.value)}
                          className="w-full bg-[#070709]/80 border border-white/10 text-xs text-white rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Casting Destaques (Separados por vírgula)</label>
                        <input 
                          type="text" 
                          placeholder="Leonardo DiCaprio, Jonah Hill" 
                          value={formCastText}
                          onChange={(e) => setFormCastText(e.target.value)}
                          className="w-full bg-[#070709]/80 border border-white/10 text-xs text-white rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Onde Assistir (Separados por vírgula)</label>
                        <input 
                          type="text" 
                          placeholder="Netflix, Amazon Prime Video" 
                          value={formPlatformsText}
                          onChange={(e) => setFormPlatformsText(e.target.value)}
                          className="w-full bg-[#070709]/80 border border-white/10 text-xs text-white rounded-lg px-3 py-2"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1 font-mono uppercase">Sinopse Narrativa</label>
                      <textarea 
                        placeholder="Insira um breve parágrafo das tensões ou subtextos..." 
                        rows={2}
                        value={formSynopsis}
                        onChange={(e) => setFormSynopsis(e.target.value)}
                        className="w-full bg-[#070709]/80 border border-white/10 text-xs text-white rounded-lg px-3 py-2 resize-none"
                      />
                    </div>

                    <button 
                      type="submit" 
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-mono px-4 py-2.5 rounded-xl cursor-pointer shadow-md"
                    >
                      ✔ Registrar Filme no Sistema
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* INPUT SEARCH ONLINE BOX */}
              <div className="space-y-6">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    triggerOnlineMovieSearch();
                  }}
                  className="flex gap-2.5"
                >
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-3.5 w-4 h-4 text-zinc-400" />
                    <input 
                      type="text"
                      id="online-search-input"
                      value={onlineSearchQuery}
                      onChange={(e) => {
                        setOnlineSearchQuery(e.target.value);
                        if (onlineSearchResult) setOnlineSearchResult(null);
                      }}
                      placeholder="Busque absolutamente qualquer filme, franquia ou série (Ex: Matrix, Shutter Island, Avengers, Breaking Bad...)"
                      className="w-full pl-10 px-4 pr-4 py-3.5 bg-black/60 rounded-2xl border border-white/10 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 text-sm placeholder-zinc-500 text-white font-sans transition-all"
                    />
                    {onlineSearchQuery && (
                      <button 
                        type="button"
                        onClick={() => { setOnlineSearchQuery(''); setOnlineSearchResult(null); }}
                        className="absolute right-4.5 top-3.5 text-zinc-500 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  <button
                    type="submit"
                    disabled={onlineSearchLoading || !onlineSearchQuery}
                    className="bg-white text-zinc-950 font-bold px-6 rounded-2xl text-xs flex items-center gap-1.5 hover:bg-neutral-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-black/30 shrink-0 font-sans"
                  >
                    {onlineSearchLoading ? <Loader2 className="w-4 h-4 animate-spin text-zinc-950" /> : <Sparkles className="w-4 h-4 text-zinc-950" />}
                    Consultar com IA
                  </button>
                </form>

                {/* PREMIUM STREAMING & THEATRICAL PILLS ROW */}
                <div className="space-y-2 text-left">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono block pl-1">
                    Filtrar por streaming ou exibição nos cinemas:
                  </span>
                  <div className="flex flex-row overflow-x-auto whitespace-nowrap gap-3 md:gap-4 pb-2 scrollbar-hide w-full">
                    {[
                      { id: 'all', label: '🌍 Todos', color: 'border-white/5 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700 hover:text-white' },
                      { id: 'Netflix', label: '🔴 Netflix', color: 'border-white/5 bg-red-950/10 text-rose-100 hover:border-red-800/40' },
                      { id: 'Prime Video', label: '🟡 Prime Video', color: 'border-white/5 bg-amber-950/10 text-amber-100 hover:border-amber-800/40' },
                      { id: 'Max', label: '🟣 Max', color: 'border-white/5 bg-indigo-950/10 text-indigo-100 hover:border-indigo-800/40' },
                      { id: 'Disney+', label: '🔵 Disney+', color: 'border-white/5 bg-sky-950/10 text-sky-100 hover:border-sky-800/40' },
                      { id: 'Apple TV+', label: '🍏 Apple TV+', color: 'border-white/5 bg-zinc-950/40 text-zinc-300 hover:border-zinc-700' },
                      { id: 'Cinema', label: '🍿 No Cinema', color: 'border-white/5 bg-rose-950/10 text-rose-100 hover:border-rose-800/40' },
                      { id: 'Recent', label: '🎬 Recém-Saídos', color: 'border-white/5 bg-purple-950/10 text-purple-100 hover:border-purple-800/40' }
                    ].map(platform => {
                      const isActive = activePlatformFilter === platform.id;
                      return (
                        <button
                          key={platform.id}
                          type="button"
                          onClick={() => {
                            setActivePlatformFilter(platform.id);
                            // Clear search state to prevent mode conflict
                            setOnlineSearchResult(null);
                            setOnlineSearchQuery('');
                            setTmdbSearchResults(null);
                          }}
                          className={`shrink-0 text-xs px-3.5 py-2 rounded-xl border font-sans font-medium transition-all duration-200 cursor-pointer ${
                            isActive 
                              ? 'border-[#00E5FF] text-[#00E5FF] bg-[#00E5FF]/10 shadow-[0_0_15px_rgba(0,229,255,0.15)] font-bold scale-[1.02]' 
                              : platform.color
                          }`}
                        >
                          {platform.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* COMPACT GENRE & FORMATS CONTROLS */}
                <div className="flex flex-wrap items-center gap-4 pt-3.5 border-t border-white/5 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Formato:</span>
                    <select 
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="bg-[#0b0b0f] border border-white/10 text-xs text-zinc-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500/40 cursor-pointer"
                    >
                      <option value="all">Séries e Filmes</option>
                      <option value="Filme">Apenas Filmes</option>
                      <option value="Série">Apenas Séries</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Classificar por Vibe:</span>
                    <select 
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="bg-[#0b0b0f] border border-white/10 text-xs text-zinc-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500/40 cursor-pointer"
                    >
                      <option value="all">Categorias em Geral</option>
                      <option value="Ação">Ação / Aventura</option>
                      <option value="Drama">Drama / Realidade</option>
                      <option value="Comédia">Comédia / Sátira</option>
                      <option value="Ficção Científica">Ficção Científica / Cyber</option>
                      <option value="Suspense">Suspense</option>
                      <option value="Fantasia">Fantasia / Anime</option>
                      <option value="Romance">Romance</option>
                      <option value="Terror">Terror</option>
                    </select>
                  </div>
                </div>

                {/* QUICK IN-TEXT RECOMMENDATION TRIGGER TAGS */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-left">
                  <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest font-mono">Sugestões Rápidas:</span>
                  {POPULAR_IA_SUGGESTIONS.map(term => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => {
                        setOnlineSearchQuery(term);
                        triggerOnlineMovieSearch(term);
                      }}
                      className="text-[10px] bg-zinc-800/40 hover:bg-zinc-800 text-zinc-350 px-2.5 py-1 rounded-xl border border-white/5 hover:border-white/20 transition-all cursor-pointer"
                    >
                      + {term}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── INTEGRATED ACTIVE CATALOG & SUCCESSES DISPLAY ── */}
              <div className="mt-8 pt-8 border-t border-white/5 space-y-5 text-left">

                {onlineSearchQuery.trim().length >= 3 ? (
                  /* ── DEBOUNCED TMDB LIVE SEARCH MODE ── */
                  <AnimatePresence mode="wait">
                    {tmdbSearchLoading && (
                      <motion.div
                        key="tmdb-loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center gap-4 py-16"
                      >
                        <div className="relative w-14 h-14">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-[#00E5FF]/10 animate-ping" />
                          <div className="relative rounded-full h-14 w-14 bg-gradient-to-tr from-[#00E5FF]/20 to-indigo-500/20 border border-[#00E5FF]/30 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 text-[#00E5FF] animate-spin" />
                          </div>
                        </div>
                        <p className="text-xs text-zinc-400 font-mono">Consultando arquivos cinematográficos...</p>
                      </motion.div>
                    )}

                    {!tmdbSearchLoading && tmdbSearchResults && tmdbSearchResults.length > 0 && (
                      <motion.div
                        key="tmdb-results"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="space-y-5"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <h3 className="font-display font-extrabold text-base text-white flex items-center gap-2">
                              <Search className="w-4.5 h-4.5 text-[#00E5FF]" />
                              🔍 Resultados para &ldquo;{onlineSearchQuery.trim()}&rdquo;
                            </h3>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              Títulos verificados com arte oficial do TMDB
                            </p>
                          </div>
                          <span className="text-xs text-[#00E5FF] bg-[#00E5FF]/10 px-2.5 py-1 rounded-xl border border-[#00E5FF]/20 font-mono shrink-0">
                            {tmdbSearchResults.length} encontrados
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          <AnimatePresence mode="popLayout">
                            {tmdbSearchResults.map((movie, idx) => renderAppleMovieCard(movie, (
                              <div className="absolute top-2.5 left-2.5 bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30 text-[8px] font-mono font-bold px-2 py-0.5 rounded-md backdrop-blur-md shadow-md z-10 uppercase tracking-wider">
                                🔍 TMDB Match
                              </div>
                            ), `tmdb-s-${idx}`))}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )}

                    {!tmdbSearchLoading && (tmdbSearchResults === null || tmdbSearchResults.length === 0) && (
                      <motion.div
                        key="tmdb-empty"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-center py-16 flex flex-col items-center gap-3"
                      >
                        <div className="w-16 h-16 rounded-full bg-zinc-900/60 border border-white/5 flex items-center justify-center mb-1">
                          <Search className="w-6 h-6 text-zinc-600" />
                        </div>
                        <p className="text-sm font-display font-semibold text-zinc-400 tracking-wide">
                          Nenhum registro encontrado nos arquivos.
                        </p>
                        <p className="text-xs text-zinc-600 max-w-xs">
                          Verifique a ortografia ou tente um termo diferente.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                ) : (
                  /* ── NORMAL CATALOG MODE ── */
                  <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h3 className="font-display font-extrabold text-base text-white flex items-center gap-2">
                          <Layers className="w-4.5 h-4.5 text-indigo-400" />
                          {activePlatformFilter === 'Netflix' && "🔥 Maiores Sucessos na Netflix"}
                          {activePlatformFilter === 'Prime Video' && "🔥 Maiores Sucessos no Amazon Prime Video"}
                          {activePlatformFilter === 'Max' && "🔥 Maiores Sucessos na Max"}
                          {activePlatformFilter === 'Disney+' && "🔥 Maiores Sucessos no Disney+"}
                          {activePlatformFilter === 'Apple TV+' && "🔥 Maiores Sucessos na Apple TV+"}
                          {activePlatformFilter === 'Cinema' && "🍿 Em Cartaz nos Cinemas"}
                          {activePlatformFilter === 'Recent' && "🎬 Lançamentos Recentes no Cinema"}
                          {activePlatformFilter === 'all' && "🎬 Todos os Sucessos do Catálogo"}
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {activePlatformFilter === 'all' 
                            ? "Navegue pelo nosso catálogo geral de obras consagradas" 
                            : `Obras mais aclamadas e populares distribuídas sob esta plataforma`}
                        </p>
                      </div>
                      {isPlatformLoading ? (
                        <span className="text-xs text-[#00E5FF] bg-[#00E5FF]/10 px-2.5 py-1 rounded-xl border border-[#00E5FF]/20 font-mono flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" /> Carregando...
                        </span>
                      ) : (
                        <span className="text-xs text-indigo-400 bg-indigo-950/40 px-2.5 py-1 rounded-xl border border-indigo-500/20 font-mono">
                          {filteredCatalog.length} correspondentes
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {isPlatformLoading ? (
                        /* Platform loading spinner — fires instantly on button click */
                        <div className="col-span-3 flex flex-col items-center gap-4 py-16">
                          <div className="relative w-14 h-14">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-[#00E5FF]/10 animate-ping" />
                            <div className="relative rounded-full h-14 w-14 bg-gradient-to-tr from-[#00E5FF]/20 to-indigo-500/20 border border-[#00E5FF]/30 flex items-center justify-center">
                              <Loader2 className="w-5 h-5 text-[#00E5FF] animate-spin" />
                            </div>
                          </div>
                          <p className="text-xs text-zinc-400 font-mono">
                            Carregando catálogo {activePlatformFilter}...
                          </p>
                        </div>
                      ) : (
                        <AnimatePresence mode="popLayout">
                          {filteredCatalog.slice(0, catalogLimit).map((movie, idx) => renderAppleMovieCard(movie,
                            proximityMatches[movie.id] ? (
                              <div className="absolute -top-2.5 left-4 z-15 bg-gradient-to-r from-amber-500 via-indigo-650 to-purple-600 font-bold tracking-wider uppercase text-[8.5px] px-2.5 py-0.5 rounded-full border border-indigo-500/30 flex items-center gap-1 leading-none shadow-md">
                                ⭐ Estilo idêntico ao que curtiu: {proximityMatches[movie.id].movieTitle}
                              </div>
                            ) : undefined,
                            idx
                          ))}
                        </AnimatePresence>
                      )}
                    </div>

                    {filteredCatalog.length > catalogLimit && (
                      <div className="flex justify-center pt-4 pb-8">
                        <button type="button" onClick={() => setCatalogLimit(prev => prev + 12)} className="bg-zinc-900 border border-white/10 hover:border-[#00E5FF]/40 hover:bg-[#00E5FF]/10 text-[#A1A1A6] hover:text-[#00E5FF] font-semibold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md hover:scale-[1.02] active:scale-95">
                          <span>Carregar mais títulos</span>
                          <ChevronRight className="w-3.5 h-3.5 rotate-90 text-[#00E5FF]" />
                        </button>
                      </div>
                    )}

                    {filteredCatalog.length === 0 && (
                      <div className="text-center py-14 flex flex-col items-center gap-4 bg-zinc-950/20 border border-white/5 rounded-3xl p-8 max-w-xl mx-auto shadow-inner">
                        {unansweredMovies.length === 0 ? (
                          <>
                            <Sparkles className="w-10 h-10 text-indigo-400 animate-pulse mb-1" />
                            <h4 className="font-display font-black text-white text-sm">Uau! Você classificou todo o acervo! 🎬</h4>
                            <p className="text-xs text-zinc-400 leading-relaxed">Não sobrou nenhum título pendente.</p>
                            <button type="button" onClick={() => setActiveTab('analytics')} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer">Ver Perfil</button>
                          </>
                        ) : (
                          <>
                            <Compass className="w-10 h-10 text-zinc-600" />
                            <p className="text-xs text-zinc-400">Nenhum título local localizado.</p>
                            <button type="button" onClick={() => { setOnlineSearchQuery(''); setSelectedCategory('all'); setSelectedType('all'); setActivePlatformFilter('all'); }} className="text-xs text-indigo-400 hover:underline cursor-pointer">Limpar filtros</button>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            {/* CURATED ROW CAROUSELS (Apple Grid style rows) */}
            <section className="space-y-10">
              
              {/* VIBE 1: FICÇÃO & ADRENALINA */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h3 className="font-display font-extrabold text-lg text-white flex items-center gap-2">
                    <Flame className="w-5 h-5 text-fuchsia-450" />
                    Carrossel Premium: Ação & Tecnologia Científica
                  </h3>
                  <span className="text-xs text-zinc-500 font-mono">Row Index A</span>
                </div>

                <div className="flex overflow-x-auto gap-4 scroll-smooth pb-3.5 scrollbar-thin">
                  {actionMovies.map(movie => (
                    <div key={`fav-row-${movie.id}`} className="min-w-[290px] md:min-w-[340px] max-w-[345px] shrink-0">
                      {renderAppleMovieCard(movie)}
                    </div>
                  ))}
                </div>
              </div>

              {/* VIBE 2: DRAMA & EMOÇÕES */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h3 className="font-display font-extrabold text-lg text-white flex items-center gap-2">
                    <Heart className="w-5 h-5 text-amber-500 fill-amber-500/20" />
                    Carrossel Premium: Grandes Dramas & Romances Históricos
                  </h3>
                  <span className="text-xs text-zinc-500 font-mono">Row Index B</span>
                </div>

                <div className="flex overflow-x-auto gap-4 scroll-smooth pb-3.5 scrollbar-thin">
                  {dramaMovies.map(movie => (
                    <div key={`drama-row-${movie.id}`} className="min-w-[290px] md:min-w-[340px] max-w-[345px] shrink-0">
                      {renderAppleMovieCard(movie)}
                    </div>
                  ))}
                </div>
              </div>

              {/* VIBE 3: SUSPENSE & MISTERIO */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h3 className="font-display font-extrabold text-lg text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-cyan-400" />
                    Carrossel Premium: Enigmas da Mente & Terror Sombrio
                  </h3>
                  <span className="text-xs text-zinc-500 font-mono">Row Index C</span>
                </div>

                <div className="flex overflow-x-auto gap-4 scroll-smooth pb-3.5 scrollbar-thin">
                  {mysteryMovies.map(movie => (
                    <div key={`mystery-row-${movie.id}`} className="min-w-[290px] md:min-w-[340px] max-w-[345px] shrink-0">
                      {renderAppleMovieCard(movie)}
                    </div>
                  ))}
                </div>
              </div>

            </section>

          </div>
        )}

        {/* 2. WANT TO WATCH VIEW Tab */}
        {activeTab === 'watchlist' && (
          <div id="section-quero-assistir" className="space-y-6">
            
            <div className="bg-zinc-900/40 p-4 md:p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="font-display font-black text-xl text-white flex items-center gap-2">
                  <Bookmark className="w-5.5 h-5.5 text-purple-400 fill-purple-400" />
                  Sua Fila de Espera Premium ("Quero Assistir")
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Gerencie facilmente títulos e produções que você marcou que tem total interesse em assistir em breve.
                </p>
              </div>

              <span className="text-xs font-mono bg-purple-950/50 border border-purple-500/20 text-purple-300 px-3 py-1.5 rounded-xl block">
                {localStats.totalWatchlist} produções salvas
              </span>
            </div>

            {watchlist.length === 0 ? (
              <div className="bg-zinc-950/40 rounded-3xl border border-white/5 p-16 text-center max-w-xl mx-auto flex flex-col items-center gap-4">
                <Bookmark className="w-12 h-12 text-zinc-700" />
                <h3 className="font-bold text-sm text-zinc-300">Sua Fila está completamente vazia</h3>
                <p className="text-xs text-zinc-505">
                  Para guardar novos filmes a assistir, clique no ícone de marcador de livro card das produções ou utilize a nossa pesquisa global por IA.
                </p>
                <button
                  onClick={() => setActiveTab('catalog')}
                  className="bg-white text-zinc-950 text-xs px-4 py-2 rounded-xl font-bold cursor-pointer hover:bg-neutral-200 transition-all"
                >
                  Procurar Filmes Agora
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {watchlist.map((id, idx) => {
                  const item = allMovies.find(m => m.id === id);
                  if (!item) return null;
                  return renderAppleMovieCard(item, undefined, idx);
                })}
              </div>
            )}

          </div>
        )}

        {/* 3. HISTÓRICO VIEW Tab */}
        {activeTab === 'history' && (
          <div id="section-historico" className="space-y-6">
            <div className="bg-zinc-900/40 p-4 md:p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="font-display font-black text-xl text-white flex items-center gap-2">
                  <FolderHeart className="w-5.5 h-5.5 text-indigo-400" />
                  Seu Histórico de Interações Cinematográficas
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Gerencie todo o seu histórico de avaliações, visualizações, e títulos assinalados como não assistidos ou sem interesse.
                </p>
              </div>

              {/* Mini counters */}
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs font-mono bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-xl block font-semibold">
                  {ratings.filter(r => r.watched).length} Assistidos
                </span>
                <span className="text-xs font-mono bg-zinc-805/40 border border-white/5 text-zinc-300 px-3 py-1.5 rounded-xl block font-semibold">
                  {ratings.filter(r => r.notWatched).length} Não Assistidos
                </span>
                <span className="text-xs font-mono bg-rose-955/40 border border-rose-500/20 text-rose-300 px-3 py-1.5 rounded-xl block font-semibold">
                  {ratings.filter(r => r.noInterest).length} Sem Interesse
                </span>
                <span className="text-xs font-mono bg-amber-955/40 border border-amber-500/20 text-amber-300 px-3 py-1.5 rounded-xl block font-semibold">
                  {favorites.length} Favoritados
                </span>
              </div>
            </div>

            {/* Apple-style Subnavigation Tab */}
            <div className="flex items-center gap-1.5 bg-zinc-900/60 p-1.5 rounded-2xl border border-white/5 w-fit flex-wrap">
              <button
                onClick={() => setHistorySubTab('watched')}
                className={`px-4 py-2 text-xs font-semibold rounded-xl tracking-tight transition-all cursor-pointer ${
                  historySubTab === 'watched'
                    ? 'bg-indigo-650 text-white shadow-md font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                🎬 Assistidos & Avaliados ({ratings.filter(r => r.watched).length})
              </button>
              <button
                onClick={() => setHistorySubTab('favorites')}
                className={`px-4 py-2 text-xs font-semibold rounded-xl tracking-tight transition-all cursor-pointer ${
                  historySubTab === 'favorites'
                    ? 'bg-indigo-650 text-white shadow-md font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                ❤️ Favoritos ({favorites.length})
              </button>
              <button
                onClick={() => setHistorySubTab('notWatched')}
                className={`px-4 py-2 text-xs font-semibold rounded-xl tracking-tight transition-all cursor-pointer ${
                  historySubTab === 'notWatched'
                    ? 'bg-indigo-650 text-white shadow-md font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                🚫 Sinalizados "Não Assisti" ({ratings.filter(r => r.notWatched).length})
              </button>
              <button
                onClick={() => setHistorySubTab('noInterest')}
                className={`px-4 py-2 text-xs font-semibold rounded-xl tracking-tight transition-all cursor-pointer ${
                  historySubTab === 'noInterest'
                    ? 'bg-indigo-650 text-white shadow-md font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                💔 Sinalizados "Sem Interesse" ({ratings.filter(r => r.noInterest).length})
              </button>
            </div>

            {/* History Tab Contents */}
            {(() => {
              const currentList = allMovies.filter(movie => {
                const r = ratings.find(x => x.movieId === movie.id);
                if (historySubTab === 'watched') {
                  return r?.watched;
                }
                if (historySubTab === 'favorites') {
                  return favorites.includes(movie.id);
                }
                if (historySubTab === 'notWatched') {
                  return r?.notWatched;
                }
                if (historySubTab === 'noInterest') {
                  return r?.noInterest;
                }
                return false;
              });

              if (currentList.length === 0) {
                return (
                  <div className="bg-zinc-950/40 rounded-3xl border border-white/5 p-16 text-center max-w-xl mx-auto flex flex-col items-center gap-4">
                    <Folder className="w-12 h-12 text-zinc-750" />
                    <h3 className="font-bold text-sm text-zinc-300">Nenhum título nesta classificação</h3>
                    <p className="text-xs text-zinc-550 leading-relaxed font-sans">
                      Títulos que você marcar em seus respectivos cards no painel de exploração aparecerão listados aqui de forma automática.
                    </p>
                    <button
                      onClick={() => setActiveTab('catalog')}
                      className="bg-white text-zinc-950 text-xs px-4 py-2 rounded-xl font-bold cursor-pointer hover:bg-neutral-200 transition-all"
                    >
                      Voltar para Explorações
                    </button>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {currentList.map((movie, idx) => {
                      return renderAppleMovieCard(movie, (
                        <div className="absolute top-4 right-4 z-15 flex items-center gap-1">
                          <button
                            onClick={() => {
                              handleResetFeedback(movie.id);
                            }}
                            className="bg-[#0c0c16]/90 text-[9px] text-rose-350 px-2.5 py-1 rounded-xl border border-rose-550/20 hover:border-rose-500/35 hover:bg-rose-955/30 hover:text-rose-200 font-mono transition-all cursor-pointer"
                            title="Remover feedback e retornar para o catálogo principal de exploração"
                          >
                            Excluir Feedback ↩️
                          </button>
                        </div>
                      ), idx);
                    })}
                  </div>
                </div>
              );
            })()}

          </div>
        )}

        {/* 4. PROFILE ANALYTICS & AI PORT TAB */}
        {activeTab === 'analytics' && (
          <div id="section-perfil-cognitivo">
          <div className="space-y-6">
            {ratings.length < 20 ? (
              <div className="bg-zinc-950/60 border border-white/10 backdrop-blur-2xl rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-8 py-24 shadow-[0_0_50px_rgba(0,229,255,0.03)] min-h-[500px] relative overflow-hidden max-w-2xl mx-auto mt-6">
                {/* Background ambient glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-[#00E5FF]/5 rounded-full blur-[100px] pointer-events-none" />
                
                {/* Pristine Electric Cyan (#00E5FF) pulsing radar circle */}
                <div className="relative w-28 h-28 flex items-center justify-center z-10">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#00E5FF]/10 animate-ping opacity-75"></span>
                  <div className="relative rounded-full h-20 w-20 bg-gradient-to-tr from-[#00E5FF] to-[#0080FF] p-[2px] shadow-[0_0_30px_rgba(0,229,255,0.4)] animate-spin">
                    <div className="w-full h-full bg-zinc-950 rounded-full flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-[#00E5FF] animate-pulse" />
                    </div>
                  </div>
                  {/* Absolute radar sweeping line */}
                  <div className="absolute inset-0 border border-[#00E5FF]/20 rounded-full animate-pulse scale-125 pointer-events-none" />
                  <div className="absolute inset-0 border border-[#00E5FF]/10 rounded-full animate-pulse scale-150 pointer-events-none" />
                </div>

                <div className="space-y-3 z-10 max-w-md">
                  <h3 className="text-xl md:text-2xl font-sans font-black text-white tracking-tight leading-tight">
                    Calibrando seu perfil cognitivo...
                  </h3>
                  <p className="text-sm md:text-base text-zinc-300 font-sans leading-relaxed">
                    Avalie mais <strong className="text-[#00E5FF] font-black">{20 - ratings.length}</strong> produções para revelar seu Arquétipo.
                  </p>
                </div>

                {/* Progress bar inside the locked view */}
                <div className="w-full max-w-xs bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-white/5 z-10">
                  <div 
                    className="bg-gradient-to-r from-[#00E5FF] to-[#0A84FF] h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(0,229,255,0.5)]"
                    style={{ width: `${Math.min(100, (ratings.length / 20) * 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase z-10">
                  Sintonia atual: {ratings.length} / 20 avaliações
                </div>
              </div>
            ) : (
              <>
            
            {/* Top overview status board */}
            <div className="bg-zinc-900/40 p-4 md:p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute top-[-30px] left-[-30px] w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="relative z-10 flex flex-col gap-1.5">
                <h2 className="font-display font-black text-xl text-white flex items-center gap-2">
                  <Activity className="w-5.5 h-5.5 text-indigo-400" />
                  Mapeador de Percepção Cognitiva de Espectador
                </h2>
                <p className="text-xs text-zinc-400">
                  Com base no balanço de suas visões registradas e respectivas avaliações de Atuação, Roteiro e Visual.
                </p>
              </div>

              {/* Big CTA to run deep AI diagnostic */}
              <div className="shrink-0 relative z-10 flex flex-col md:items-end gap-2">
                <button
                  onClick={triggerAIAnalysis}
                  disabled={isLoadingAI || ratings.length === 0}
                  className="bg-gradient-to-r from-indigo-650 via-indigo-605 to-purple-600 text-white font-bold px-6 py-3 rounded-2xl text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-500/10 hover:scale-[1.01] active:scale-[0.99] transition-transform disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  id="btn-trigger-ai-main"
                >
                  {isLoadingAI ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Sparkles className="w-4 h-4 text-white animate-pulse" />}
                  Atualizar Mapeamento Estrutural por IA
                </button>
                {ratings.length === 0 && (
                  <span className="text-[10px] text-zinc-550 font-mono text-center">Avalie ao menos 1 título para desbloquear</span>
                )}
              </div>
            </div>

            {/* Continuous profile banner */}
            <div className="bg-zinc-950/60 border border-[#00E5FF]/20 px-5 py-4 rounded-2xl flex items-center gap-3 text-left shadow-lg">
              <span className="text-base shrink-0 select-none">💡</span>
              <div className="text-xs text-zinc-350">
                <strong className="text-[#00E5FF] font-bold">Análise em andamento.</strong> Avalie mais produções para refinar a precisão do seu Arquétipo.
              </div>
            </div>

            {/* Error notifications removed as requested */}            {/* PROGRESS LOADING ELEMENT FOR IA DIAGNOSTIC */}
            {isLoadingAI && (
              <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-5 my-6 shadow-2xl">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-indigo-550/20 border-t-indigo-500 animate-spin" />
                  <Sparkles className="w-6 h-6 text-amber-400 absolute inset-0 m-auto animate-pulse" />
                </div>
                
                <div className="space-y-2 max-w-sm">
                  <p className="text-sm text-[#00E5FF] font-bold tracking-tight animate-pulse font-sans">
                    {loadingPhrases[loadingStep]}
                  </p>
                  <p className="text-xs text-[#8E8E93] leading-normal font-sans">
                    O modelo amplo está estruturando o arquétipo estético. Isso pode levar alguns segundos.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              <div className="lg:col-span-12 xl:col-span-5 space-y-6">
                
                {/* Metrics overview card */}
                <div className="bg-[#111111]/80 backdrop-blur-md p-4 md:p-6 rounded-3xl border border-white/5 space-y-6 text-left">
                  
                  <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                    <User className="w-5 h-5 text-[#00E5FF]" />
                    <h3 className="font-sans font-extrabold text-xs text-[#F5F5F7] uppercase tracking-widest leading-none">Status de Catalogação</h3>
                  </div>

                  {ratings.length === 0 ? (
                    <p className="text-xs text-[#8E8E93]">Aguardando registros de avaliação no catálogo.</p>
                  ) : (
                    <div className="space-y-5">
                      
                      {/* Sentiment count box */}
                      <div className="grid grid-cols-4 gap-2 text-center font-mono">
                        <div className="bg-[#1A1A1A] p-2 rounded-xl border border-white/5" title="Seus filmes favoritos absolutos, sentimentos de Amor">
                          <span className="text-[9px] text-[#00E5FF] block font-bold">❤ AMEI!</span>
                          <span className="text-base font-bold text-white mt-1 block">{localStats.lovesCount}</span>
                        </div>
                        <div className="bg-[#1A1A1A] p-2 rounded-xl border border-white/5" title="Satisfeito de assistir">
                          <span className="text-[9px] text-cyan-400 block font-bold">👍 CURTI</span>
                          <span className="text-base font-bold text-white mt-1 block">{localStats.likesCount}</span>
                        </div>
                        <div className="bg-[#1A1A1A] p-2 rounded-xl border border-white/5" title="Sinalizados como Regular ou apenas OK">
                          <span className="text-[9px] text-emerald-400 block font-bold">😐 OK</span>
                          <span className="text-base font-bold text-white mt-1 block">{localStats.oksCount}</span>
                        </div>
                        <div className="bg-[#1A1A1A] p-2 rounded-xl border border-white/5" title="Avaliação negativa de gosto">
                          <span className="text-[9px] text-zinc-550 block font-bold">👎 NÃO</span>
                          <span className="text-base font-bold text-white mt-1 block">{localStats.dislikesCount}</span>
                        </div>
                      </div>

                      {/* Aspect star evaluation calculations */}
                      <div className="bg-[#050505] p-4 rounded-2xl border border-white/5 space-y-3.5">
                        <h4 className="text-[9px] uppercase tracking-wider text-[#8E8E93] font-mono font-bold leading-none">Profundidade Técnica por Aspectos</h4>
                        
                        <div className="space-y-2.5">
                          {/* Acting score */}
                          <div>
                            <div className="flex justify-between text-xs mb-1 font-mono">
                              <span className="text-[#F5F5F7] font-sans font-semibold">🎭 Qualidade Atuação</span>
                              <span className="text-[#00E5FF] font-black">{localStats.averageAspects.acting} / 5.0</span>
                            </div>
                            <div className="w-full bg-[#1A1A1A] h-1 rounded-full overflow-hidden">
                              <div className="bg-gradient-to-r from-cyan-400 to-[#00E5FF] shadow-[0_0_8px_rgba(0,229,255,0.4)] h-full rounded-full" style={{ width: `${(localStats.averageAspects.acting / 5) * 100}%` }} />
                            </div>
                          </div>

                          {/* Script score */}
                          <div>
                            <div className="flex justify-between text-xs mb-1 font-mono">
                              <span className="text-[#F5F5F7] font-sans font-semibold">📋 Robustez do Roteiro</span>
                              <span className="text-[#00E5FF] font-black">{localStats.averageAspects.script} / 5.0</span>
                            </div>
                            <div className="w-full bg-[#1A1A1A] h-1 rounded-full overflow-hidden">
                              <div className="bg-gradient-to-r from-cyan-400 to-[#00E5FF] shadow-[0_0_8px_rgba(0,229,255,0.4)] h-full rounded-full" style={{ width: `${(localStats.averageAspects.script / 5) * 100}%` }} />
                            </div>
                          </div>

                          {/* Visual score */}
                          <div>
                            <div className="flex justify-between text-xs mb-1 font-mono">
                              <span className="text-[#F5F5F7] font-sans font-semibold">✨ Estética & Visual</span>
                              <span className="text-[#00E5FF] font-black">{localStats.averageAspects.visual} / 5.0</span>
                            </div>
                            <div className="w-full bg-[#1A1A1A] h-1 rounded-full overflow-hidden">
                              <div className="bg-gradient-to-r from-cyan-400 to-[#00E5FF] shadow-[0_0_8px_rgba(0,229,255,0.4)] h-full rounded-full" style={{ width: `${(localStats.averageAspects.visual / 5) * 100}%` }} />
                            </div>
                          </div>
                        </div>

                        <span className="text-[9px] text-zinc-550 italic block mt-2 text-center">
                          Computado a partir de {localStats.averageAspects.totalRatedCount} produções com notas de aspectos salvas.
                        </span>
                      </div>

                      {/* Loved Genres distribution list */}
                      <div>
                        <h4 className="text-[9px] uppercase tracking-wider text-[#8E8E93] font-mono font-bold block mb-2">Gêneros e Linhas de Sentimento</h4>
                        <div className="space-y-1.5 text-xs">
                          {localStats.genresDistribution.slice(0, 4).map(item => (
                            <div key={item.name} className="flex items-center justify-between bg-[#1A1A1A] p-2 rounded-xl">
                              <span className="text-[#F5F5F7] font-semibold flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#00E5FF] shrink-0" />
                                {item.name}
                              </span>
                              <span className="text-[#00E5FF] font-black font-mono">{item.percentage}%</span>
                            </div>
                          ))}
                          {localStats.genresDistribution.length === 0 && (
                            <p className="text-[11px] text-zinc-550 italic">Sem preferências mapeadas para gêneros.</p>
                          )}
                        </div>
                      </div>

                      {/* Preferred Categories with Match Level */}
                      <div>
                        <h4 className="text-[9px] uppercase tracking-wider text-[#8E8E93] font-mono font-bold block mb-2">Afinidade de Tropos de Trama</h4>
                        <div className="space-y-1.5 text-xs">
                          {localStats.categoriesBreakdown.slice(0, 4).map(item => (
                            <div key={item.category} className="flex justify-between items-center bg-[#1A1A1A] p-2.5 rounded-xl">
                              <div className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#00E5FF] shrink-0" />
                                <div className="text-left">
                                  <span className="text-[#F5F5F7] font-semibold">{item.category}</span>
                                  <span className="text-[9.5px] text-[#8E8E93] font-mono block">{item.count} assistido{item.count !== 1 ? 's' : ''}</span>
                                </div>
                              </div>
                              <span className="text-[#00E5FF] font-black font-mono text-xs">{item.matchScore}% COMPAT</span>
                            </div>
                          ))}
                          {localStats.categoriesBreakdown.length === 0 && (
                            <p className="text-[11px] text-zinc-550 italic">Sem tropos de tramas avaliados.</p>
                          )}
                        </div>
                      </div>

                      {/* Preferred Directors */}
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                        <div className="text-left">
                          <span className="text-[9px] uppercase text-[#8E8E93] font-mono block mb-1">Atores Recorrentes</span>
                          <ul className="text-xs space-y-1">
                            {localStats.actorsDistribution.slice(0, 3).map((act, idx) => (
                              <li key={act.name} className="text-[#F5F5F7] truncate">
                                <span className="text-[#00E5FF] font-bold font-mono">{idx + 1}.</span> {act.name}
                              </li>
                            ))}
                            {localStats.actorsDistribution.length === 0 && <span className="text-[10px] text-zinc-650 italic">Nenhum</span>}
                          </ul>
                        </div>

                        <div className="text-left">
                          <span className="text-[9px] uppercase text-[#8E8E93] font-mono block mb-1">Direções Preferidas</span>
                          <ul className="text-xs space-y-1">
                            {localStats.directorsDistribution.slice(0, 3).map((dir, idx) => (
                              <li key={dir.name} className="text-[#F5F5F7] truncate">
                                <span className="text-[#00E5FF] font-bold font-mono">{idx + 1}.</span> {dir.name}
                              </li>
                            ))}
                            {localStats.directorsDistribution.length === 0 && <span className="text-[10px] text-zinc-650 italic">Nenhuma</span>}
                          </ul>
                        </div>
                      </div>

                    </div>
                  )}

                </div>

                {/* 🧭 Cinéfilo Consumption Segment Profile Card */}
                <div className="bg-[#111111]/85 backdrop-blur-md text-[#F5F5F7] p-6 rounded-3xl border border-[#00E5FF]/20 shadow-[0_0_20px_rgba(0,229,255,0.05)] space-y-4 text-left relative overflow-hidden">
                  {/* Backdrop glowing details */}
                  <div className="absolute top-[-40px] right-[-40px] text-8xl opacity-5 select-none pointer-events-none">
                    🎬
                  </div>
                  
                  <div className="space-y-1 relative z-10">
                    <span className="text-[9px] uppercase font-mono tracking-widest text-[#8E8E93] block font-bold">Nível de Maratonador</span>
                    <h4 className="font-sans font-extrabold text-[#F5F5F7] tracking-tight flex items-center gap-1.5 flex-wrap">
                      <span>{cinefiloProfile.emoji}</span>
                      <span>{cinefiloProfile.title}</span>
                    </h4>
                  </div>

                  <p className="text-xs text-[#8E8E93] leading-relaxed font-sans relative z-10">
                    {cinefiloProfile.description}
                  </p>

                  <div className="bg-[#1A1A1A] p-3.5 rounded-2xl border border-white/5 flex items-center justify-between text-xs font-mono relative z-10">
                    <span className="text-[#8E8E93] font-semibold font-sans">Contador de Registros:</span>
                    <span className="text-[#00E5FF] font-bold text-sm bg-[#00E5FF]/10 border border-[#00E5FF]/25 px-3 py-1 rounded-xl">
                      {cinefiloProfile.watchedCount} produções assistidas
                    </span>
                  </div>
                </div>

                {/* Local Proximity Recommendations list shelf */}
                {localRecommendations.length > 0 && (
                  <div className="bg-zinc-900/40 p-6 rounded-3xl border border-white/5 text-left space-y-3">
                    <h4 className="font-display font-extrabold text-sm text-white flex items-center gap-1.5 uppercase tracking-wide">
                      <Flame className="w-4 h-4 text-amber-500" />
                      Próxima Sessão (Proximidade Local)
                    </h4>
                    <p className="text-[11px] text-zinc-400 leading-normal">
                      Os seguintes títulos preenchidos no acervo combinam fortemente ao estilo dramático de suas interações:
                    </p>

                    <div className="space-y-3.5">
                      {localRecommendations.slice(0, 3).map(({ movie, similarToTitle }) => (
                        <div key={`local-reco-${movie.id}`} className="bg-black/40 rounded-xl p-3 border border-white/5 relative">
                          <span className="absolute top-2 right-2 text-[8px] font-mono text-indigo-400">
                            Por: {similarToTitle}
                          </span>
                          <h5 className="font-bold text-xs text-white uppercase">{movie.title}</h5>
                          <span className="text-[9px] text-zinc-500 block font-mono">{movie.year} • {movie.plotCategory}</span>
                          <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 italic">"{movie.synopsis}"</p>
                          
                          <button
                            onClick={() => handleToggleWatched(movie.id)}
                            className="bg-[#1A1A1A] hover:bg-zinc-800 text-[#8E8E93] border border-white/5 text-[9px] font-mono px-2 py-1 rounded-md mt-2 block w-full text-center"
                          >
                            + Marcar como assistido
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* RHS - THE COMPREHENSIVE AI SPECTOR PERFIL DIAGNOSTIC SHOWCASE (7 cols) */}
              <div className="lg:col-span-12 xl:col-span-7">

                {(!aiProfile && !isLoadingAI) ? (
                  <div className="bg-[#111111]/80 backdrop-blur-md p-8 rounded-3xl border border-white/10 text-center flex flex-col items-center justify-center gap-4 py-16 shadow-[0_0_30px_rgba(0,229,255,0.03)]">
                    <Sparkles className="w-10 h-10 text-[#00E5FF] animate-pulse" />
                    <h3 className="font-sans font-black text-lg text-white">Pronto para Diagnóstico Psicológico?</h3>
                    <p className="text-xs text-[#8E8E93] max-w-sm mx-auto leading-relaxed font-sans">
                      Nenhum perfil cognitivo gerado. O modelo Gemini 3.5 analisará o subtexto poético de suas produções assistidas, dividirá preferências por aspectos técnicos e sugerirá filmes compatíveis com o seu arquétipo.
                    </p>
                    <button
                      onClick={triggerAIAnalysis}
                      disabled={ratings.length === 0}
                      className="bg-[#00E5FF] text-[#050505] font-black px-6 py-3 rounded-xl text-xs hover:bg-[#00E5FF]/80 transition-all cursor-pointer shadow-[0_0_20px_rgba(0,229,255,0.25)] hover:shadow-[0_0_30px_rgba(0,229,255,0.45)] disabled:opacity-40 font-mono tracking-wider"
                    >
                      ✔ Mapear Meu Perfil de Espectador
                    </button>
                  </div>
                ) : aiProfile && (
                  <div className="bg-[#111111]/80 backdrop-blur-md p-6 rounded-3xl border border-white/5 text-left space-y-6 relative shadow-2xl">
                    
                    {/* Header bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="bg-[#00E5FF]/10 border border-[#00E5FF]/25 p-2 rounded-xl">
                          <User className="w-4.5 h-4.5 text-[#00E5FF]" />
                        </span>
                        <h3 className="font-sans font-extrabold text-[#F5F5F7] text-[#ffffff] text-lg">Mapeamento Clínico do Gosto</h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:self-auto">
                        <button
                          onClick={generateShareCard}
                          className="bg-[#00E5FF] hover:bg-cyan-300 text-[#050505] font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_15px_rgba(0,229,255,0.2)] font-mono tracking-wider"
                          title="Gerar cartão de destaque para mídias sociais"
                        >
                          <Share2 className="w-3.5 h-3.5 text-[#050505]" />
                          Compartilhar Perfil
                        </button>

                        <span className="text-[10px] font-mono font-bold text-[#00E5FF] bg-[#00E5FF]/10 border border-[#00E5FF]/20 px-2.5 py-1.5 rounded-xl flex items-center gap-1 uppercase">
                          <Sparkle className="w-3 h-3 text-[#00E5FF] animate-pulse" />
                          Gemini 3.5 Ativo
                        </span>
                      </div>
                    </div>

                    {/* The Archetype Banner */}
                    <div className="bg-[#1A1A1A] p-5 rounded-2xl border border-[#00E5FF]/25 shadow-[0_0_30px_rgba(0,229,255,0.03)] text-left">
                      <span className="text-[9px] tracking-widest font-mono text-[#00E5FF] block font-black uppercase">ARQUÉTIPO DE ESPECTADOR REVELADO</span>
                      <h4 className="font-sans font-black text-2xl text-white tracking-tight mt-1">
                        {aiProfile.archetypeName}
                      </h4>
                      <p className="text-xs text-[#8E8E93] mt-1.5 font-sans leading-relaxed">{aiProfile.archetypeDescription}</p>
                    </div>

                    {/* Psychological deep-read evaluation paragraph */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] uppercase font-mono tracking-widest text-[#8E8E93] font-bold flex items-center gap-1.5 mb-1 text-left">
                        <MessageSquare className="w-3.5 h-3.5 text-[#00E5FF]" />
                        Análise de Trajetórias Estéticas
                      </h4>
                      <p className="text-xs text-[#F5F5F7] leading-relaxed bg-[#1A1A1A] p-4 rounded-xl border border-white/5 font-sans">
                        {aiProfile.psychologicalAssessment}
                      </p>
                    </div>

                    {/* Common Themes Bullet points list */}
                    {aiProfile.narrativeThemesInCommon && aiProfile.narrativeThemesInCommon.length > 0 && (
                      <div className="space-y-2.5 text-left">
                        <h4 className="text-[10px] uppercase font-mono tracking-widest text-[#8E8E93] font-bold block">Padrões Temáticos Unificadores que você segue</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {aiProfile.narrativeThemesInCommon.map((theme, idx) => (
                            <div key={`theme-ai-${idx}`} className="bg-[#1A1A1A] p-3 rounded-xl border border-white/5 text-xs text-[#F5F5F7] flex items-start gap-2 font-sans text-left">
                              <span className="text-[#00E5FF] font-bold font-mono mt-0.5">✔</span>
                              <span>{theme}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Deep-dive into each genre analysis cards */}
                    {aiProfile.genreBreakdownDetails && aiProfile.genreBreakdownDetails.length > 0 && (
                      <div className="space-y-3 text-left">
                        <h4 className="text-[10px] uppercase font-mono tracking-widest text-[#8E8E93] font-bold block">Detalhamento por Linha de Sentimento</h4>
                        <div className="space-y-2.5">
                          {aiProfile.genreBreakdownDetails.map((item, idx) => (
                            <div key={idx} className="bg-[#1A1A1A] p-3 rounded-xl border border-white/5 text-left">
                              <span className="text-xs font-bold text-[#00E5FF] font-mono block uppercase tracking-wide">{item.genre}</span>
                              <p className="text-[11.5px] text-[#8E8E93] mt-1 leading-relaxed font-sans">{item.analysis}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* CURATED RECOMMENDED SECTION FEATURING THE EXACT CONTRACT FOR CONFIRMATION CARDS */}
                    <div className="pt-6 border-t border-white/5 space-y-4 text-left">
                      
                      <div className="space-y-1">
                        <h4 className="text-[11px] uppercase tracking-wider text-[#00E5FF] font-sans font-black flex items-center gap-1.5">
                          <Sparkles className="w-4.5 h-4.5 text-[#00E5FF] animate-pulse" />
                          Curadoria Especializada do Gemini 3.5 (Títulos Sugeridos)
                        </h4>
                        <p className="text-xs text-[#8E8E93] leading-relaxed font-sans">
                          Sua curadoria de IA encontrou os filmes ideais abaixo. <span className="text-[#00E5FF] font-semibold">Toda sugestão possui avaliação integral</span>. Marque "Eu já assisti" direto no card e ele se integrará ao catálogo e status automaticamente!
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {aiProfile.customRecommendations.map((rec, idx) => {
                          // Assemble structured representation for universal rendering
                          const matchedInDb = allMovies.find(m => m.title.toLowerCase().trim() === rec.title.toLowerCase().trim());
                          
                          // Ensure we can render it dynamically on standard card template
                          const movieObj: Movie = {
                            id: matchedInDb?.id || `ai-reco-${idx}-${rec.title.replace(/\s+/g, '-').toLowerCase()}`,
                            title: rec.title,
                            type: rec.type,
                            year: rec.year,
                            director: rec.director,
                            genres: rec.genres,
                            cast: rec.cast || ["Não Informado"],
                            platforms: rec.whereToWatch || ["Outros"],
                            plotType: rec.reasonForSuggestion,
                            plotCategory: rec.plotCategory as any || 'Outros',
                            similarIds: [],
                            synopsis: rec.reasonForSuggestion
                          };

                          // Automatically registry external reference in customized list on-the-fly when they click checkbox
                          return renderAppleMovieCard(movieObj, (
                            <div className="absolute -top-2 right-2 bg-[#1A1A1A] border border-[#00E5FF]/20 text-[8px] font-mono font-bold uppercase py-0.5 px-2 rounded-full text-[#00E5FF] tracking-wider">
                              {rec.matchPercentage}% Compatível
                            </div>
                          ), idx);
                        })}
                      </div>

                    </div>

                  </div>
                )}

              </div>

            </div>

              </>
            )}
          </div>
          </div>
        )}

      </main>

      {/* TMDB ATTRIBUTION FOOTER */}
      <footer className="w-full bg-[#050505] py-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-center gap-3 text-center mt-16 z-10 relative">
        <span className="text-[#8E8E93] text-xs font-sans tracking-wide">
          Metadados e imagens fornecidos por
        </span>
        <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="inline-block transition-all hover:scale-105 duration-200">
          <img 
            src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" 
            alt="The Movie Database (TMDB)" 
            className="h-[16px] object-contain opacity-75 hover:opacity-100 transition-all filter grayscale hover:grayscale-0 duration-300"
          />
        </a>
      </footer>

      {/* DETAILED DIALOG/MODAL FOR FOCUSED CARDS */}
      <AnimatePresence>
        {focusedMovie && (() => {
          const currentRating = ratings.find(r => r.movieId === focusedMovie.id);
          const currentProgress = currentRating?.watchProgress || (currentRating?.watched ? 'complete' : null);
          const currentScriptScore = currentRating?.scriptScore || 0;
          const currentVisualScore = currentRating?.visualScore || 0;
          const currentActingScore = currentRating?.actingScore || 0;
          const currentVibeTags = currentRating?.vibeTags || [];

          const toggleVibeTag = (tag: string) => {
            const isSelected = currentVibeTags.includes(tag);
            const newTags = isSelected
              ? currentVibeTags.filter(t => t !== tag)
              : [...currentVibeTags, tag];
            updateMovieRatingDetails(focusedMovie.id, { vibeTags: newTags });
          };

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto font-sans text-left" style={{ backdropFilter: 'blur(16px)', background: 'rgba(0,0,0,0.8)' }}>
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
                className="bg-[#050505] border border-white/10 rounded-3xl max-w-4xl w-full relative shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden text-left my-8"
              >
                {/* Minimalist close button top right */}
                <button 
                  onClick={() => setFocusedMovie(null)}
                  className="absolute top-5 right-5 z-45 bg-black/60 text-zinc-400 hover:text-[#00E5FF] p-2.5 rounded-full border border-white/10 hover:bg-zinc-900 transition-colors duration-205 cursor-pointer"
                  title="Fechar"
                  id="modal-close-x-btn"
                >
                  <X className="w-4.5 h-4.5" />
                </button>

                {/* MODAL LAYOUT: SPLIT SCREEN */}
                <div className="grid grid-cols-1 md:grid-cols-12 min-h-[480px]">
                  
                  {/* Left Side: Sleek vertical movie poster placeholder */}
                  <div className="md:col-span-5 bg-zinc-950 p-6 md:p-8 flex flex-col justify-center items-center border-r border-[#00E5FF]/5 relative overflow-hidden animate-fade-in">
                    <div className="absolute w-48 h-48 bg-[#00E5FF]/10 rounded-full blur-3xl pointer-events-none -translate-x-4 -translate-y-4" />
                    
                    <div className="relative aspect-[2/3] w-full max-w-[240px] overflow-hidden rounded-2xl bg-[#0a0a0f] border border-white/15 shadow-[0_15px_40px_rgba(0,0,0,0.85)] group">
                      <img
                        src={getStablePosterUrl(focusedMovie)}
                        alt={`${focusedMovie.title} Poster`}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = getFailsafePosterUrl(focusedMovie);
                        }}
                        className="w-full h-full object-cover select-none"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                        <span className="text-[11px] font-mono text-[#00E5FF] font-black uppercase tracking-wider">Original Master {focusedMovie.year}</span>
                      </div>
                    </div>

                    <div className="mt-4 text-center z-10 hidden md:block">
                      <span className="text-[9.5px] uppercase font-mono tracking-widest font-bold text-zinc-500">Direção Artística</span>
                      <p className="text-xs text-zinc-300 font-medium">{focusedMovie.director || "Não Informado"}</p>
                    </div>
                  </div>

                  {/* Right Side: The Deep Metrics UI */}
                  <div className="md:col-span-7 p-6 md:p-8 flex flex-col justify-between space-y-6">
                    
                    {/* Title & Year */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono font-black tracking-widest px-2.5 py-0.5 rounded border border-[#00E5FF]/20 bg-[#00E5FF]/5 text-[#00E5FF] uppercase">
                          {focusedMovie.type || 'Filme'}
                        </span>
                        <span className="text-[9px] font-mono font-black tracking-widest px-2.5 py-0.5 rounded border border-white/10 bg-black/40 text-zinc-400 uppercase">
                          {focusedMovie.plotCategory}
                        </span>
                      </div>
                      
                      <h3 className="font-sans font-black text-2xl md:text-3xl text-white tracking-tight leading-none pt-1">
                        {focusedMovie.title} <span className="text-[#A1A1A6] font-normal">({focusedMovie.year})</span>
                      </h3>

                      {focusedMovie.originalTitle && focusedMovie.originalTitle !== focusedMovie.title && (
                        <p className="text-[10px] text-zinc-500 font-mono">Título Original: {focusedMovie.originalTitle}</p>
                      )}
                      
                      {focusedMovie.synopsis && (
                        <div className="bg-[#0c0c12]/50 border border-white/5 rounded-xl p-3 text-left">
                          <span className="text-[9px] uppercase font-mono tracking-wider text-[#00E5FF] font-bold block mb-1">Sinopse</span>
                          <p className="text-[11.5px] text-zinc-300 leading-normal font-sans">
                            {focusedMovie.synopsis}
                          </p>
                        </div>
                      )}

                      <p className="text-xs text-zinc-400 font-mono italic">
                        "{focusedMovie.plotType}"
                      </p>
                    </div>

                    {/* Status de Consumo (Horizontal Pill Selector) */}
                    <div>
                      <h4 className="text-[10px] font-mono font-black uppercase tracking-wider text-zinc-500 mb-2.5">
                        Status de Consumo
                      </h4>
                      
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 'complete', label: 'Assisti Tudo', emoji: '🎬' },
                          { value: 'stopped_middle', label: 'Abandonei', emoji: '⚠️' },
                          { value: 'watching', label: 'Assistindo', emoji: '⏳' }
                        ].map(opt => {
                          const isSelected = currentProgress === opt.value;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => {
                                const isWatchedFlag = opt.value === 'complete';
                                updateMovieRatingDetails(focusedMovie.id, {
                                  watchProgress: opt.value as any,
                                  watched: isWatchedFlag,
                                  notWatched: !isWatchedFlag && opt.value !== 'watching',
                                });
                              }}
                              className="flex-1 min-w-[102px] flex items-center gap-2 justify-center px-3 py-2.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-all duration-200 bg-neutral-900 border-white/10 hover:border-white/20 text-white"
                              style={isSelected ? { borderColor: '#00E5FF', backgroundColor: 'rgba(0,229,255,0.1)', color: '#00E5FF' } : {}}
                            >
                              <span>{opt.emoji}</span>
                              <span>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Análise de Aspectos (Visual 1-5 level ranges) */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-mono font-black uppercase tracking-wider text-zinc-500">
                        Análise de Aspectos
                      </h4>
                      
                      <div className="space-y-2">
                        {/* 1. Qualidade do Roteiro */}
                        <div className="bg-black/25 px-4 py-3 rounded-xl border border-white/5 flex items-center justify-between gap-4">
                          <div className="text-left">
                            <span className="text-[11px] font-bold text-zinc-200 block">Qualidade do Roteiro</span>
                            <span className="text-[9.5px] text-zinc-500 font-mono">Originalidade, diálogos e ritmo</span>
                          </div>
                          
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(star => (
                              <button
                                key={star}
                                onClick={() => updateMovieRatingDetails(focusedMovie.id, { scriptScore: star })}
                                className="hover:scale-120 transition-transform cursor-pointer p-0.5"
                                title={`Roteiro: ${star}/5`}
                              >
                                <Star 
                                  className="w-4 h-4 transition-all" 
                                  style={{
                                    color: star <= currentScriptScore ? '#00E5FF' : '#27272a',
                                    fill: star <= currentScriptScore ? '#00E5FF' : 'transparent',
                                  }}
                                />
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 2. Estética & Fotografia */}
                        <div className="bg-black/25 px-4 py-3 rounded-xl border border-white/5 flex items-center justify-between gap-4">
                          <div className="text-left">
                            <span className="text-[11px] font-bold text-zinc-200 block">Estética & Fotografia</span>
                            <span className="text-[9.5px] text-zinc-500 font-mono">Direção de arte, luz e edição</span>
                          </div>
                          
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(star => (
                              <button
                                key={star}
                                onClick={() => updateMovieRatingDetails(focusedMovie.id, { visualScore: star })}
                                className="hover:scale-120 transition-transform cursor-pointer p-0.5"
                                title={`Fotografia: ${star}/5`}
                              >
                                <Star 
                                  className="w-4 h-4 transition-all" 
                                  style={{
                                    color: star <= currentVisualScore ? '#00E5FF' : '#27272a',
                                    fill: star <= currentVisualScore ? '#00E5FF' : 'transparent',
                                  }}
                                />
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 3. Atuação */}
                        <div className="bg-black/25 px-4 py-3 rounded-xl border border-white/5 flex items-center justify-between gap-4">
                          <div className="text-left">
                            <span className="text-[11px] font-bold text-zinc-200 block">Atuação</span>
                            <span className="text-[9.5px] text-zinc-500 font-mono">Intensidade, química e expressão</span>
                          </div>
                          
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(star => (
                              <button
                                key={star}
                                onClick={() => updateMovieRatingDetails(focusedMovie.id, { actingScore: star })}
                                className="hover:scale-120 transition-transform cursor-pointer p-0.5"
                                title={`Atuação: ${star}/5`}
                              >
                                <Star 
                                  className="w-4 h-4 transition-all" 
                                  style={{
                                    color: star <= currentActingScore ? '#00E5FF' : '#27272a',
                                    fill: star <= currentActingScore ? '#00E5FF' : 'transparent',
                                  }}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Vibe Tags */}
                    <div>
                      <h4 className="text-[10px] font-mono font-black uppercase tracking-wider text-zinc-500 mb-2">
                        Vibe Tags
                      </h4>
                      
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { name: 'Tenso', emoji: '⚡' },
                          { name: 'Reflexivo', emoji: '🧠' },
                          { name: 'Explosivo', emoji: '💥' },
                          { name: 'Melancólico', emoji: '🌧️' }
                        ].map(tag => {
                          const isSelected = currentVibeTags.includes(tag.name);
                          return (
                            <button
                              key={tag.name}
                              onClick={() => toggleVibeTag(tag.name)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer transition-all duration-200"
                              style={isSelected ? { borderColor: '#00E5FF', backgroundColor: 'rgba(0,229,255,0.15)', color: '#00E5FF' } : { borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.2)', color: '#a1a1a6' }}
                            >
                              <span>{tag.emoji}</span>
                              <span>{tag.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Footer Close button */}
                    <div className="flex items-center justify-end pt-2">
                      <button
                        onClick={() => setFocusedMovie(null)}
                        className="bg-zinc-900 hover:bg-zinc-850 hover:text-[#00E5FF] border border-white/10 text-zinc-300 font-mono font-bold text-[11px] px-5 py-2.5 rounded-xl transition-all cursor-pointer"
                      >
                        Fechar Analisador
                      </button>
                    </div>

                  </div>

                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {false && focusedMovie && (() => {
          const currentRating = ratings.find(r => r.movieId === focusedMovie.id);
          const currentProgress = currentRating?.watchProgress || (currentRating?.watched ? 'complete' : null);
          const currentScriptScore = currentRating?.scriptScore || 0;
          const currentVisualScore = currentRating?.visualScore || 0;
          const currentActingScore = currentRating?.actingScore || 0;
          const currentVibeTags = currentRating?.vibeTags || [];

          const toggleVibeTag = (tag: string) => {
            const isSelected = currentVibeTags.includes(tag);
            const newTags = isSelected
              ? currentVibeTags.filter(t => t !== tag)
              : [...currentVibeTags, tag];
            updateMovieRatingDetails(focusedMovie.id, { vibeTags: newTags });
          };

          return (
            <div className="fixed inset-0 z-50 bg-[#050505]/85 flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto animate-fade-in">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
                className="bg-[#050505] border border-white/10 rounded-3xl max-w-4xl w-full flex flex-col relative shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden text-left my-8"
              >
                {/* Clean, high-contrast close button styling */}
                <button 
                  onClick={() => setFocusedMovie(null)}
                  className="absolute top-5 right-5 z-40 bg-black/60 text-zinc-400 hover:text-white p-2.5 rounded-full border border-white/10 hover:bg-zinc-800/80 transition-colors duration-200 cursor-pointer"
                  title="Fechar Analisador"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Cinematic Header Backdrop */}
                <div className="relative h-[220px] md:h-[280px] w-full shrink-0 overflow-hidden bg-zinc-950">
                  <img
                    src={getStableBackdropUrl(focusedMovie)}
                    alt="Backdrop"
                    className="absolute inset-0 w-full h-full object-cover select-none brightness-[0.7] scale-[1.01]"
                  />
                  {/* Bottom fade transition block to Solid deep background */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/35 to-transparent z-10" />
                  
                  {/* Left Metadata badgings */}
                  <div className="absolute top-6 left-6 z-20 flex items-center gap-2">
                    <span className={`text-[9px] font-mono font-black tracking-widest px-3 py-1 rounded-lg border uppercase ${
                      focusedMovie.type === 'Série' 
                        ? 'bg-amber-950/60 border-amber-500/20 text-amber-300' 
                        : 'bg-indigo-950/60 border-indigo-500/20 text-indigo-300'
                    }`}>
                      {focusedMovie.type}
                    </span>
                    <span className="text-[9px] font-mono font-black tracking-widest px-3 py-1 rounded-lg border bg-black/50 border-white/15 text-zinc-200 uppercase">
                      {focusedMovie.plotCategory}
                    </span>
                  </div>
                </div>

                {/* Main Grid overlap container */}
                <div className="relative z-20 px-6 md:px-10 pb-8 flex flex-col md:flex-row gap-6 md:gap-8 -mt-20 md:-mt-24">
                  
                  {/* Left Column (overlapping Poster + metadata rails) */}
                  <div className="w-[150px] md:w-[200px] shrink-0 mx-auto md:mx-0">
                    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-[#0a0a0f] border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.9)]">
                      <img
                        src={getStablePosterUrl(focusedMovie)}
                        alt={focusedMovie.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = getFailsafePosterUrl(focusedMovie);
                        }}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    {/* Actor chips and platforms on Desktop */}
                    <div className="mt-5 hidden md:block space-y-4">
                      <div>
                        <span className="text-[9.5px] uppercase font-mono tracking-wider font-bold text-zinc-500 block">Elenco Estelar</span>
                        <div className="flex flex-col gap-1 mt-2">
                          {focusedMovie.cast.slice(0, 3).map(actor => (
                            <span key={actor} className="text-[11px] text-zinc-300 font-sans truncate py-0.5 border-b border-white/5">
                              {actor}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-[9.5px] uppercase font-mono tracking-wider font-bold text-zinc-500 block">Plataformas BR</span>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {focusedMovie.platforms.map(p => (
                            <span key={p} className="text-[9px] bg-indigo-950/20 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-500/20 uppercase font-mono tracking-wide">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column (Controls state updates and descriptions) */}
                  <div className="flex-grow space-y-5 text-left md:pt-4">
                    <div className="space-y-1">
                      <h3 className="font-sans font-black text-2xl md:text-3.5xl text-white tracking-tight leading-none">
                        {focusedMovie.title}
                      </h3>
                      {focusedMovie.originalTitle && focusedMovie.originalTitle !== focusedMovie.title && (
                        <p className="text-[11px] text-zinc-500 font-mono">Título Original: {focusedMovie.originalTitle}</p>
                      )}
                      
                      <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-450 font-mono pt-1">
                        <span className="text-[#00E5FF] font-black">{focusedMovie.year}</span>
                        <span className="text-zinc-600">•</span>
                        <span>Dirigido por <strong className="text-zinc-300">{focusedMovie.director}</strong></span>
                      </div>
                    </div>

                    {/* Plot summary bubble block */}
                    <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-4.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] uppercase font-mono tracking-widest text-[#00E5FF] font-bold">Sinopse do Roteiro</span>
                        <span className="text-[10px] font-mono text-zinc-400 bg-white/5 px-2.5 py-0.5 rounded-lg">
                          🍿 {focusedMovie.plotType}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-zinc-300 leading-relaxed font-sans">
                        {focusedMovie.synopsis}
                      </p>
                    </div>

                    {/* Interactive analytics and ratings inputs panel */}
                    <div className="border border-white/10 bg-zinc-950/60 rounded-2xl p-5 md:p-6 space-y-5 shadow-inner">
                      
                      {/* 🎬 1. Status de Consumo */}
                      <div>
                        <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 mb-2.5 flex items-center gap-1.5">
                          <span className="text-[#00E5FF]">🎬</span> Status de Consumo
                        </h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {progressOptions.map(opt => {
                            const isSelected = currentProgress === opt.value;
                            return (
                              <button
                                key={opt.value}
                                onClick={() => {
                                  const isWatchedFlag = opt.value === 'complete';
                                  updateMovieRatingDetails(focusedMovie.id, {
                                    watchProgress: opt.value as any,
                                    watched: isWatchedFlag,
                                    notWatched: !isWatchedFlag && opt.value !== 'watching',
                                  });
                                }}
                                className={`flex items-center gap-2 justify-center px-4 py-2.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-all duration-200 ${
                                  isSelected 
                                    ? 'bg-[#00E5FF]/10 border-[#00E5FF] text-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.12)] scale-[1.01]' 
                                    : 'bg-black/35 border-white/5 hover:border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-black/50'
                                }`}
                              >
                                <span>{opt.emoji}</span>
                                <span>{opt.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 📊 2. Cinematic Aspect sliders */}
                      <div>
                        <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-1.5">
                          <span className="text-[#00E5FF]">📊</span> Análise de Atributos Cinematográficos
                        </h4>
                        
                        <div className="space-y-2.5">
                          {/* 🎬 Direção & Roteiro */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-black/25 px-4 py-2.5 rounded-xl border border-white/5">
                            <div className="space-y-0.5">
                              <span className="text-[11px] font-bold text-zinc-200 block">🎥 Direção e Roteiro</span>
                              <p className="text-[9.5px] text-zinc-500">Fluxo narrativo, diálogos e ritmo</p>
                            </div>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map(star => (
                                <button
                                  key={star}
                                  onClick={() => updateMovieRatingDetails(focusedMovie.id, { scriptScore: star })}
                                  className="hover:scale-125 transition-transform cursor-pointer p-0.5"
                                  title={`Avaliar Roteiro: ${star} estrelas`}
                                >
                                  <Star className={`w-4.5 h-4.5 transition-colors duration-150 ${star <= currentScriptScore ? 'text-[#00E5FF] fill-[#00E5FF] drop-shadow-[0_0_6px_rgba(0,229,255,0.3)]' : 'text-zinc-800'}`} />
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* ✨ Estética e Fotografia */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-black/25 px-4 py-2.5 rounded-xl border border-white/5">
                            <div className="space-y-0.5">
                              <span className="text-[11px] font-bold text-zinc-200 block">✨ Estética e Fotografia</span>
                              <p className="text-[9.5px] text-zinc-500">Câmera, iluminação, paletas e VFX</p>
                            </div>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map(star => (
                                <button
                                  key={star}
                                  onClick={() => updateMovieRatingDetails(focusedMovie.id, { visualScore: star })}
                                  className="hover:scale-125 transition-transform cursor-pointer p-0.5"
                                  title={`Avaliar Fotografia: ${star} estrelas`}
                                >
                                  <Star className={`w-4.5 h-4.5 transition-colors duration-150 ${star <= currentVisualScore ? 'text-[#00E5FF] fill-[#00E5FF] drop-shadow-[0_0_6px_rgba(0,229,255,0.3)]' : 'text-zinc-800'}`} />
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 🎭 Atuação */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-black/25 px-4 py-2.5 rounded-xl border border-white/5">
                            <div className="space-y-0.5">
                              <span className="text-[11px] font-bold text-zinc-200 block">🎭 Atuação Geral</span>
                              <p className="text-[9.5px] text-zinc-500">Profundidade emocional do elenco</p>
                            </div>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map(star => (
                                <button
                                  key={star}
                                  onClick={() => updateMovieRatingDetails(focusedMovie.id, { actingScore: star })}
                                  className="hover:scale-125 transition-transform cursor-pointer p-0.5"
                                  title={`Avaliar Atuação: ${star} estrelas`}
                                >
                                  <Star className={`w-4.5 h-4.5 transition-colors duration-150 ${star <= currentActingScore ? 'text-[#00E5FF] fill-[#00E5FF] drop-shadow-[0_0_6px_rgba(0,229,255,0.3)]' : 'text-zinc-800'}`} />
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 🏷️ 3. Quick Vibe Tags */}
                      <div>
                        <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 mb-2.5 flex items-center gap-1.5">
                          <span className="text-[#00E5FF]">🏷️</span> Quick Vibe Tags
                        </h4>
                        
                        <div className="flex flex-wrap gap-1.5">
                          {vibeTagsList.map(tag => {
                            const isSelected = currentVibeTags.includes(tag.name);
                            return (
                              <button
                                key={tag.name}
                                onClick={() => toggleVibeTag(tag.name)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer transition-all duration-200 ${
                                  isSelected
                                    ? 'bg-[#00E5FF]/10 border-[#00E5FF] text-[#00E5FF] shadow-[0_0_10px_rgba(0,229,255,0.1)]'
                                    : 'bg-black/20 border-white/5 text-zinc-400 hover:border-white/10 hover:text-zinc-200 hover:bg-black/35'
                                }`}
                              >
                                <span>{tag.emoji}</span>
                                <span>{tag.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                    </div>

                    <div className="flex items-center justify-end pt-2">
                      <button
                        onClick={() => setFocusedMovie(null)}
                        className="bg-zinc-800 hover:bg-zinc-700 hover:text-white border border-white/10 text-zinc-200 font-mono font-bold text-xs px-6 py-2.5 rounded-xl transition-all cursor-pointer"
                      >
                        Fechar Analisador
                      </button>
                    </div>
                  </div>

                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* FLOATING REAL-TIME AUTO REPLENISHMENT TOASTER/ALERT */}
      <AnimatePresence>
        {showReplenishToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-[#0a0a14] border border-indigo-500/30 rounded-2xl p-4.5 shadow-2xl backdrop-blur-xl flex flex-col gap-2.5 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <h4 className="text-xs font-black text-emerald-400 font-mono tracking-wider uppercase">
                Acervo Expandido!
              </h4>
              <button 
                onClick={() => setShowReplenishToast(false)}
                className="ml-auto text-zinc-500 hover:text-white font-mono text-[11px]"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed font-sans">
              Para a página de explorações nunca ficar vazia, o algoritmo injetou de forma inteligente <strong>8 novos títulos e séries</strong> ao seu acervo em tempo real!
            </p>
            <div className="bg-[#040409] p-2 rounded-lg border border-white/5 space-y-1">
              <span className="text-[8.5px] uppercase font-mono text-zinc-500 tracking-wider font-bold block">Novidades incluídas:</span>
              <p className="text-[10px] text-indigo-300 font-medium truncate">
                {lastReplenishedNames.join(', ')}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GLOBAL BEAUTIFUL POPUP SNACKBAR TOAST */}
      <AnimatePresence>
        {globalToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 left-6 z-50 max-w-sm w-full border rounded-2xl p-4 shadow-2xl backdrop-blur-xl flex items-center gap-3 text-left ${
              globalToast.type === 'error'
              ? 'bg-[#150a0a] border-rose-500/30 text-rose-200'
              : globalToast.type === 'info'
              ? 'bg-[#080a14] border-indigo-500/35 text-indigo-200'
              : 'bg-[#060a08] border-emerald-500/35 text-emerald-200'
            }`}
          >
            {globalToast.type === 'error' ? (
              <div className="w-6 h-6 flex items-center justify-center bg-rose-500/20 text-rose-400 font-mono text-xs rounded-lg font-bold">✕</div>
            ) : globalToast.type === 'info' ? (
              <div className="w-6 h-6 flex items-center justify-center bg-indigo-500/20 text-indigo-400 font-mono text-xs rounded-lg font-bold">ℹ</div>
            ) : (
              <div className="w-6 h-6 flex items-center justify-center bg-emerald-500/20 text-emerald-400 font-mono text-xs rounded-lg font-bold">✔</div>
            )}
            <div className="flex-1">
              <p className="text-[11.5px] leading-relaxed font-sans">{globalToast.message}</p>
            </div>
            <button 
              onClick={() => setGlobalToast(null)}
              className="text-zinc-500 hover:text-white font-mono text-xs cursor-pointer select-none px-1"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
